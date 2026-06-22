import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  let body: { delta?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const delta = Math.trunc(Number(body.delta));
  if (!Number.isFinite(delta) || delta === 0) {
    return NextResponse.json({ error: "Invalid delta" }, { status: 400 });
  }

  const sb = getSupabase();
  const { data: current, error: readErr } = await sb
    .from("items")
    .select("quantity")
    .eq("id", id)
    .single();

  if (readErr || !current) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const next = Math.max(0, current.quantity + delta);
  const { data, error } = await sb
    .from("items")
    .update({ quantity: next })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ item: data });
}
