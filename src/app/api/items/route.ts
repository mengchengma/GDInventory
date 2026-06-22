import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

async function guard() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

function toNonNegativeInt(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.trunc(n));
}

export async function GET(req: NextRequest) {
  const unauthorized = await guard();
  if (unauthorized) return unauthorized;

  const archivedParam = req.nextUrl.searchParams.get("archived");
  // "true" → archived only, "all" → both, default → active only
  const includeArchived = archivedParam === "all";
  const onlyArchived = archivedParam === "true";

  const sb = getSupabase();
  let query = sb
    .from("items")
    .select("*")
    .order("category", { ascending: true })
    .order("created_at", { ascending: true });

  if (!includeArchived) {
    query = query.eq("archived", onlyArchived);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const unauthorized = await guard();
  if (unauthorized) return unauthorized;

  let body: {
    name?: string;
    category?: string;
    units_per_case?: number;
    cases?: number;
    loose_units?: number;
    min_threshold?: number;
    notes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const insert = {
    name,
    category: String(body.category ?? "").trim(),
    units_per_case: Math.max(1, toNonNegativeInt(body.units_per_case, 1)),
    cases: toNonNegativeInt(body.cases, 0),
    loose_units: toNonNegativeInt(body.loose_units, 0),
    min_threshold: toNonNegativeInt(body.min_threshold, 0),
    notes: String(body.notes ?? ""),
  };

  const sb = getSupabase();
  const { data, error } = await sb
    .from("items")
    .insert(insert)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ item: data }, { status: 201 });
}
