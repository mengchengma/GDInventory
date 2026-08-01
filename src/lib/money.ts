// Cost / price math for inventory items.
//
// Model: you BUY by the case and SELL by the unit.
//   case_cost  — what one case costs from the supplier
//   unit_price — what one unit sells for
// Unit cost is derived (case_cost / units_per_case) so it's never hand-entered.
//
// Both fields are optional. Anything that can't be computed returns null, and
// callers should render a dash rather than a zero — "$0.00 margin" and "no
// price entered" are very different things.

export type Priced = {
  units_per_case: number;
  cases: number;
  loose_units: number;
  case_cost: number | null;
  unit_price: number | null;
};

// PostgREST can hand back `numeric` as a string; normalise before doing math.
function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function unitCost(item: Priced): number | null {
  const cost = num(item.case_cost);
  if (cost === null) return null;
  const per = item.units_per_case;
  if (!Number.isFinite(per) || per < 1) return null;
  return cost / per;
}

export function unitMargin(item: Priced): number | null {
  const price = num(item.unit_price);
  const cost = unitCost(item);
  if (price === null || cost === null) return null;
  return price - cost;
}

export function marginPct(item: Priced): number | null {
  const price = num(item.unit_price);
  const margin = unitMargin(item);
  if (price === null || margin === null || price === 0) return null;
  return (margin / price) * 100;
}

export function totalUnitsOf(item: Priced): number {
  return item.cases * item.units_per_case + item.loose_units;
}

/** What the stock currently on hand cost you. */
export function valueAtCost(item: Priced): number | null {
  const cost = unitCost(item);
  if (cost === null) return null;
  return totalUnitsOf(item) * cost;
}

/** What the stock currently on hand is worth at retail. */
export function valueAtRetail(item: Priced): number | null {
  const price = num(item.unit_price);
  if (price === null) return null;
  return totalUnitsOf(item) * price;
}

export function formatMoney(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Compact form for header stats: $1,234 (no cents once we're in the hundreds). */
export function formatMoneyCompact(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const digits = Math.abs(v) >= 100 ? 0 : 2;
  return v.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatPct(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v.toFixed(0)}%`;
}

/** Margin below this reads as thin and gets flagged in the UI. */
export const LOW_MARGIN_PCT = 20;
