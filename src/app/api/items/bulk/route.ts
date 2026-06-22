import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

type InputRow = {
  name?: unknown;
  category?: unknown;
  units_per_case?: unknown;
  cases?: unknown;
  loose_units?: unknown;
  min_threshold?: unknown;
  notes?: unknown;
};

function toNonNegInt(v: unknown, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.trunc(n));
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { items?: InputRow[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rows = Array.isArray(body.items) ? body.items : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: "No items provided" }, { status: 400 });
  }
  if (rows.length > 500) {
    return NextResponse.json(
      { error: "Too many items at once (max 500)" },
      { status: 400 }
    );
  }

  const inserts: Record<string, unknown>[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = String(r.name ?? "").trim();
    if (!name) {
      return NextResponse.json(
        { error: `Row ${i + 1}: name is required` },
        { status: 400 }
      );
    }
    inserts.push({
      name,
      category: String(r.category ?? "").trim(),
      units_per_case: Math.max(1, toNonNegInt(r.units_per_case, 1)),
      cases: toNonNegInt(r.cases, 0),
      loose_units: toNonNegInt(r.loose_units, 0),
      min_threshold: toNonNegInt(r.min_threshold, 0),
      notes: String(r.notes ?? ""),
    });
  }

  const sb = getSupabase();
  const { data, error } = await sb.from("items").insert(inserts).select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(
    { items: data ?? [], inserted: data?.length ?? 0 },
    { status: 201 }
  );
}
