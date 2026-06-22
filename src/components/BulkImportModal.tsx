"use client";

import { useMemo, useState, FormEvent } from "react";

export type BulkRow = {
  name: string;
  category: string;
  units_per_case: number;
  cases: number;
  loose_units: number;
  min_threshold: number;
  notes: string;
  _lineNumber: number;
  _error?: string;
};

const HEADER_KEYWORDS = [
  "name",
  "item",
  "product",
  "category",
  "units",
  "cases",
  "loose",
  "threshold",
  "notes",
];

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

function isHeaderRow(cells: string[]): boolean {
  const lowered = cells.map((c) => c.toLowerCase());
  let hits = 0;
  for (const c of lowered) {
    if (HEADER_KEYWORDS.some((k) => c.includes(k))) hits++;
  }
  return hits >= 2;
}

function toIntOr(value: string, fallback: number): { n: number; ok: boolean } {
  if (value.trim() === "") return { n: fallback, ok: true };
  const n = Number(value);
  if (!Number.isFinite(n)) return { n: fallback, ok: false };
  return { n: Math.max(0, Math.trunc(n)), ok: true };
}

export function parseBulkInput(text: string): BulkRow[] {
  const out: BulkRow[] = [];
  const lines = text.split(/\r?\n/);
  let skippedHeader = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const cells = parseLine(raw);

    if (!skippedHeader && isHeaderRow(cells)) {
      skippedHeader = true;
      continue;
    }

    const [
      name = "",
      category = "",
      unitsPerCaseRaw = "",
      casesRaw = "",
      looseRaw = "",
      thresholdRaw = "",
      notes = "",
    ] = cells;

    let error: string | undefined;

    if (!name.trim()) {
      error = "missing name";
    }

    const upc = toIntOr(unitsPerCaseRaw, 1);
    const cs = toIntOr(casesRaw, 0);
    const ls = toIntOr(looseRaw, 0);
    const th = toIntOr(thresholdRaw, 0);
    if (!upc.ok) error = error ?? "bad units/case";
    if (!cs.ok) error = error ?? "bad cases";
    if (!ls.ok) error = error ?? "bad loose units";
    if (!th.ok) error = error ?? "bad threshold";

    out.push({
      _lineNumber: i + 1,
      _error: error,
      name: name.trim(),
      category: category.trim(),
      units_per_case: Math.max(1, upc.n),
      cases: cs.n,
      loose_units: ls.n,
      min_threshold: th.n,
      notes: notes.trim(),
    });
  }

  return out;
}

export default function BulkImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const rows = useMemo(() => parseBulkInput(text), [text]);
  const validRows = useMemo(() => rows.filter((r) => !r._error), [rows]);
  const errorCount = rows.length - validRows.length;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (validRows.length === 0) {
      setErr("Nothing to import — paste some rows first.");
      return;
    }
    if (errorCount > 0) {
      if (
        !confirm(
          `${errorCount} row(s) have errors and will be skipped. Import ${validRows.length} valid row(s)?`
        )
      ) {
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/items/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: validRows.map(
            ({ _lineNumber: _l, _error: _e, ...rest }) => rest
          ),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Import failed");
      }
      const data = await res.json();
      onImported(data.inserted ?? validRows.length);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <form
        onSubmit={submit}
        className="flex max-h-[95vh] w-full max-w-3xl flex-col rounded-t-2xl border border-zinc-800 bg-zinc-900 shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 p-4 sm:p-5">
          <h3 className="text-base font-semibold text-zinc-100">Bulk import</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Close"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="mb-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-400">
            <div className="mb-1.5 font-medium text-zinc-300">
              Format — one item per line:
            </div>
            <code className="block text-[11px] text-emerald-300">
              name, category, units_per_case, cases, loose_units, low_threshold, notes
            </code>
            <div className="mt-2 space-y-0.5 text-[11px]">
              <div>
                • Only <span className="text-zinc-300">name</span> is required;
                missing columns default to 0 (or 1 for units/case).
              </div>
              <div>
                • Tab-separated also works — paste directly from Excel / Google
                Sheets.
              </div>
              <div>
                • Header row is auto-detected and skipped (if it contains words
                like &quot;name&quot;, &quot;category&quot;).
              </div>
              <div>• Lines starting with # are treated as comments.</div>
            </div>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Coca-Cola, CAN SODA, 24, 5, 2\nSprite, CAN SODA, 24, 3, 0\nSnapple Peach, SNAPPLE, 12, 2, 1`}
            rows={8}
            spellCheck={false}
            className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
          />

          {rows.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-xs">
                <div className="font-medium text-zinc-300">
                  Preview ({rows.length} row{rows.length !== 1 ? "s" : ""})
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-emerald-300">
                    {validRows.length} valid
                  </span>
                  {errorCount > 0 && (
                    <span className="text-red-300">
                      {errorCount} with errors
                    </span>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto rounded-lg border border-zinc-800">
                <table className="min-w-full text-xs">
                  <thead className="bg-zinc-950/60 text-[10px] uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium">Name</th>
                      <th className="px-2 py-2 text-left font-medium">
                        Category
                      </th>
                      <th className="px-2 py-2 text-right font-medium">U/C</th>
                      <th className="px-2 py-2 text-right font-medium">
                        Cases
                      </th>
                      <th className="px-2 py-2 text-right font-medium">
                        Loose
                      </th>
                      <th className="px-2 py-2 text-right font-medium">Low</th>
                      <th className="px-2 py-2 text-left font-medium">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {rows.slice(0, 50).map((r) => (
                      <tr
                        key={r._lineNumber}
                        className={
                          r._error
                            ? "bg-red-950/30 text-red-300"
                            : "text-zinc-200"
                        }
                      >
                        <td className="px-2 py-1.5">
                          {r.name || (
                            <span className="text-red-400">—</span>
                          )}
                          {r._error && (
                            <span className="ml-2 text-[10px] uppercase tracking-wider text-red-400">
                              {r._error}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-zinc-400">
                          {r.category || (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {r.units_per_case}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {r.cases}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {r.loose_units}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-zinc-500">
                          {r.min_threshold || ""}
                        </td>
                        <td className="px-2 py-1.5 text-zinc-500">
                          {r.notes && (
                            <span className="line-clamp-1 italic">
                              {r.notes}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {rows.length > 50 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-2 py-2 text-center text-[11px] text-zinc-500"
                        >
                          + {rows.length - 50} more row
                          {rows.length - 50 !== 1 ? "s" : ""} (not shown in
                          preview)
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {err && (
            <div className="mt-3 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {err}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-zinc-800 p-4 sm:p-5">
          <span className="text-xs text-zinc-500">
            {validRows.length > 0
              ? `Ready to import ${validRows.length} item${
                  validRows.length !== 1 ? "s" : ""
                }`
              : "Paste rows above to preview"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-800 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || validRows.length === 0}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? "Importing…"
                : `Import ${validRows.length} item${
                    validRows.length !== 1 ? "s" : ""
                  }`}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
