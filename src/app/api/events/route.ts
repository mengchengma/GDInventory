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
    .from("events")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("event_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ events: data ?? [] });
}

export async function POST(req: NextRequest) {
  const unauthorized = await guard();
  if (unauthorized) return unauthorized;

  let body: {
    title?: string;
    description?: string;
    event_date?: string | null;
    event_time?: string | null;
    image_url?: string;
    image_key?: string | null;
    sort_order?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = String(body.title ?? "").trim();
  const image_url = String(body.image_url ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!image_url) {
    return NextResponse.json(
      { error: "Image URL is required" },
      { status: 400 }
    );
  }

  const insert = {
    title,
    description: String(body.description ?? ""),
    event_date: body.event_date ? String(body.event_date) : null,
    event_time: body.event_time ? String(body.event_time) : null,
    image_url,
    image_key: body.image_key ? String(body.image_key) : null,
    sort_order: Number.isFinite(Number(body.sort_order))
      ? Math.trunc(Number(body.sort_order))
      : 0,
  };

  const sb = getSupabase();
  const { data, error } = await sb
    .from("events")
    .insert(insert)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ event: data }, { status: 201 });
}
