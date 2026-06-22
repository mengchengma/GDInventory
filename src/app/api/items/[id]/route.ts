import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

async function guard() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const unauthorized = await guard();
  if (unauthorized) return unauthorized;

  const { id } = await ctx.params;

  let body: { name?: string; quantity?: number; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    patch.name = name;
  }
  if (body.quantity !== undefined) {
    const q = Number(body.quantity);
    if (!Number.isFinite(q)) {
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
    }
    patch.quantity = Math.max(0, Math.trunc(q));
  }
  if (body.notes !== undefined) {
    patch.notes = String(body.notes);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const sb = getSupabase();
  const { data, error } = await sb
    .from("items")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  return NextResponse.json({ item: data });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const unauthorized = await guard();
  if (unauthorized) return unauthorized;

  const { id } = await ctx.params;
  const sb = getSupabase();
  const { error } = await sb.from("items").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
