import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local"
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false },
  });
  return cached;
}

export type Item = {
  id: string;
  name: string;
  category: string;
  units_per_case: number;
  cases: number;
  loose_units: number;
  min_threshold: number;
  archived: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
};

export function totalUnits(item: Pick<Item, "cases" | "units_per_case" | "loose_units">): number {
  return item.cases * item.units_per_case + item.loose_units;
}

export function stockState(
  item: Pick<Item, "cases" | "units_per_case" | "loose_units" | "min_threshold">
): "out" | "low" | "ok" {
  const t = totalUnits(item);
  if (t === 0) return "out";
  if (item.min_threshold > 0 && t <= item.min_threshold) return "low";
  return "ok";
}
