import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * PUBLIC, READ-ONLY events feed — consumed by the marketing site
 * (gamingdojo.co), which is statically hosted and therefore cannot hold a
 * database key. The Supabase secret key stays server-side here on Vercel.
 *
 * Deliberately unauthenticated: it exposes only fields meant to be shown to
 * customers. GET only — no writes are possible through this route.
 */
export const dynamic = "force-dynamic";

// The feed is public data, so any origin may read it. (CORS only constrains
// browsers anyway — it is not a security boundary.)
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET() {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("events")
      // Explicit column list — never `*`. Internal fields such as image_key
      // (the ImgBB delete hash) must never leave the server.
      .select("id, title, description, event_date, event_time, image_url, sort_order")
      .order("sort_order", { ascending: true })
      .order("event_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      // Don't leak internal error details to an anonymous caller.
      return NextResponse.json(
        { error: "Unable to load events" },
        { status: 500, headers: CORS },
      );
    }

    return NextResponse.json(
      { events: data ?? [] },
      {
        headers: {
          ...CORS,
          // Cache at Vercel's edge so customer traffic doesn't hit Supabase
          // on every page view; still refreshes about once a minute.
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to load events" },
      { status: 500, headers: CORS },
    );
  }
}
