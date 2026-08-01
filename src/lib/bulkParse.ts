// Pure parsing logic for the bulk importer. No React, so it can be unit-tested.

export type BulkRow = {
  name: string;
  category: string;
  units_per_case: number;
  cases: number;
  loose_units: number;
  min_threshold: number;
  case_cost: number | null;
  unit_price: number | null;
  sku: string;
  notes: string;
  _lineNumber: number;
  _error?: string;
};

// Canonical fields, and the header spellings we accept for each. Lets a
// distributor order sheet ("Item Name", "Case Price", "Items Per Case", …) be
// pasted straight in, whatever order its columns happen to be in.
const FIELD_ALIASES: Record<string, string[]> = {
  name: ["name", "item name", "item", "product", "product name", "description"],
  sku: ["sku", "upc", "barcode", "item code", "code"],
  category: ["category", "brand", "type", "group"],
  units_per_case: [
    "units per case",
    "items per case",
    "units/case",
    "unitspercase",
    "pack size",
    "pack",
    "count",
  ],
  cases: ["cases", "case qty", "qty cases", "full cases", "on hand cases"],
  loose_units: ["loose units", "loose", "singles", "open units", "each"],
  min_threshold: ["low threshold", "low at", "threshold", "min", "par"],
  case_cost: ["case price", "case cost", "cost per case", "case", "cost"],
  unit_price: [
    "sale price",
    "retail price",
    "selling price",
    "price",
    "sell price",
  ],
  notes: ["notes", "note", "comment", "comments"],
};

// Columns we knowingly ignore — they're derived, so importing them would be
// stale the moment a price changes.
const DERIVED_HEADERS = [
  "unit price",
  "unit cost",
  "cost per unit",
  "profit margin",
  "margin",
  "profit",
  "total",
  "total value",
  "order value",
  "extended",
];

const POSITIONAL_ORDER = [
  "name",
  "category",
  "units_per_case",
  "cases",
  "loose_units",
  "min_threshold",
  "case_cost",
  "unit_price",
  "notes",
];

function normaliseHeader(s: string): string {
  return s
    .toLowerCase()
    .replace(/[$#()]/g, "")
    .replace(/[_\-/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Try to read a row as a header. Returns a map of column index → field name,
 * or null if this doesn't look like a header row.
 */
function detectHeaderMap(cells: string[]): Map<number, string> | null {
  const map = new Map<number, string>();
  let matched = 0;
  let looksLikeHeader = 0;

  cells.forEach((raw, i) => {
    const h = normaliseHeader(raw);
    if (!h) return;

    if (DERIVED_HEADERS.includes(h)) {
      looksLikeHeader++;
      return; // recognised, but deliberately not imported
    }

    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (aliases.includes(h)) {
        // First column wins, so "Case Price" doesn't get clobbered by "Price".
        if (![...map.values()].includes(field)) {
          map.set(i, field);
          matched++;
          looksLikeHeader++;
        }
        return;
      }
    }
  });

  // Need a name column and at least two recognised headers to be confident.
  if (!([...map.values()].includes("name")) || looksLikeHeader < 2) return null;
  return matched > 0 ? map : null;
}

function parseLine(line: string): string[] {
  // If tabs are present, split by tab (Excel paste). Else CSV with quote handling.
  if (line.includes("\t")) {
    return line.split("\t").map((s) => s.trim());
  }
  const cells: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === ",") {
      cells.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}


function toIntOr(value: string, fallback: number): { n: number; ok: boolean } {
  const raw = value.trim();
  if (raw === "" || SHEET_ERRORS.test(raw)) return { n: fallback, ok: true };
  const n = Number(raw.replace(/[,\s]/g, ""));
  if (!Number.isFinite(n)) return { n: fallback, ok: false };
  return { n: Math.max(0, Math.trunc(n)), ok: true };
}

/** Spreadsheet error literals — treat as "no value", not as a broken row. */
const SHEET_ERRORS = /^#(div\/0|n\/a|value|ref|name|num|null)[!?]?$/i;

/** Money is optional — blank means "not priced", not zero. Tolerates $ and commas. */
function toMoneyOr(value: string): { n: number | null; ok: boolean } {
  const raw = value.trim();
  if (raw === "" || SHEET_ERRORS.test(raw)) return { n: null, ok: true };
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (cleaned === "") return { n: null, ok: true };
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return { n: null, ok: false };
  return { n: Math.round(n * 100) / 100, ok: true };
}

export type ParseResult = {
  rows: BulkRow[];
  /** Which field each column maps to, when a header row was recognised. */
  headerMap: Map<number, string> | null;
};

/** How many leading rows to search for a header before giving up. Exported
 *  sheets often carry a title row, a totals row, and a blank line first. */
const HEADER_SEARCH_DEPTH = 10;

export function parseBulkInput(text: string): ParseResult {
  const out: BulkRow[] = [];

  // Collect real content lines, keeping their original line numbers for errors.
  const content: Array<{ lineNumber: number; cells: string[] }> = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    content.push({ lineNumber: i + 1, cells: parseLine(raw) });
  });

  // Look for a header within the first few rows, so a title/summary row above
  // it doesn't stop us finding it. Everything up to and including the header
  // is preamble and gets dropped.
  let headerMap: Map<number, string> | null = null;
  let dataStart = 0;
  const depth = Math.min(HEADER_SEARCH_DEPTH, content.length);
  for (let i = 0; i < depth; i++) {
    const detected = detectHeaderMap(content[i].cells);
    if (detected) {
      headerMap = detected;
      dataStart = i + 1;
      break;
    }
  }

  for (let i = dataStart; i < content.length; i++) {
    const { lineNumber, cells } = content[i];

    const get = (field: string): string => {
      if (headerMap) {
        for (const [idx, f] of headerMap) {
          if (f === field) return cells[idx] ?? "";
        }
        return "";
      }
      const idx = POSITIONAL_ORDER.indexOf(field);
      return idx === -1 ? "" : (cells[idx] ?? "");
    };

    const name = get("name");
    let error: string | undefined;
    if (!name.trim()) error = "missing name";

    const upc = toIntOr(get("units_per_case"), 1);
    const cs = toIntOr(get("cases"), 0);
    const ls = toIntOr(get("loose_units"), 0);
    const th = toIntOr(get("min_threshold"), 0);
    const cc = toMoneyOr(get("case_cost"));
    const up = toMoneyOr(get("unit_price"));
    if (!upc.ok) error = error ?? "bad units/case";
    if (!cs.ok) error = error ?? "bad cases";
    if (!ls.ok) error = error ?? "bad loose units";
    if (!th.ok) error = error ?? "bad threshold";
    if (!cc.ok) error = error ?? "bad case price";
    if (!up.ok) error = error ?? "bad sale price";

    out.push({
      _lineNumber: lineNumber,
      _error: error,
      name: name.trim(),
      category: get("category").trim(),
      units_per_case: Math.max(1, upc.n),
      cases: cs.n,
      loose_units: ls.n,
      min_threshold: th.n,
      case_cost: cc.n,
      unit_price: up.n,
      sku: get("sku").trim(),
      notes: get("notes").trim(),
    });
  }

  return { rows: out, headerMap };
}
