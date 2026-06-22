import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

async function guard() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const unauthorized = await guard();
  if (unauthorized) return unauthorized;

  const sb = getSupabase();
  const { data, error } = await sb
    .from("items")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const unauthorized = await guard();
  if (unauthorized) return unauthorized;

  let body: { name?: string; quantity?: number; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const quantity = Number.isFinite(body.quantity)
    ? Math.max(0, Math.trunc(Number(body.quantity)))
    : 0;
  const notes = String(body.notes ?? "");

  const sb = getSupabase();
  const { data, error } = await sb
    .from("items")
    .insert({ name, quantity, notes })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ item: data }, { status: 201 });
}
