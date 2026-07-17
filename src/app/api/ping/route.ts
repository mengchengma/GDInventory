import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// Public endpoint. Runs a trivial DB query so Supabase sees activity and
// doesn't auto-pause the project on the free tier. Called daily by Vercel Cron.
export async function GET() {
  try {
    const sb = getSupabase();
    const { error } = await sb
      .from("items")
      .select("id", { count: "exact", head: true });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, at: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
