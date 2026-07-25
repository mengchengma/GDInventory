import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { deleteFromStorage } from "@/lib/storage";

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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};

  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) {
      return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    }
    patch.title = title;
  }
  if (body.description !== undefined) patch.description = String(body.description);
  if (body.event_date !== undefined) {
    patch.event_date = body.event_date ? String(body.event_date) : null;
  }
  if (body.event_time !== undefined) {
    patch.event_time = body.event_time ? String(body.event_time) : null;
  }
  if (body.image_url !== undefined) {
    const u = String(body.image_url).trim();
    if (!u) {
      return NextResponse.json({ error: "Image URL cannot be empty" }, { status: 400 });
    }
    patch.image_url = u;
  }
  if (body.image_key !== undefined) {
    patch.image_key = body.image_key ? String(body.image_key) : null;
  }
  if (body.sort_order !== undefined) {
    const n = Number(body.sort_order);
    if (Number.isFinite(n)) patch.sort_order = Math.trunc(n);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const sb = getSupabase();
  const { data, error } = await sb
    .from("events")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  return NextResponse.json({ event: data });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const unauthorized = await guard();
  if (unauthorized) return unauthorized;

  const { id } = await ctx.params;
  const sb = getSupabase();

  // Read the row first so we know which R2 object to delete (if any).
  const { data: existing } = await sb
    .from("events")
    .select("image_key")
    .eq("id", id)
    .maybeSingle();

  const { error } = await sb.from("events").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (existing?.image_key) {
    // Best-effort — don't fail the request if R2 delete errors.
    deleteFromStorage(existing.image_key).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
