import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");

const env = readFileSync(envPath, "utf8")
  .split("\n")
  .filter((l) => l.trim() && !l.trim().startsWith("#"))
  .reduce((acc, line) => {
    const eq = line.indexOf("=");
    if (eq === -1) return acc;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim();
    acc[k] = v;
    return acc;
  }, {});

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const items = [
  // Can soda
  { category: "Can soda", name: "Coca-Cola", units_per_case: 35 },
  { category: "Can soda", name: "Diet Coke", units_per_case: 35 },
  { category: "Can soda", name: "Coke Zero", units_per_case: 35 },
  { category: "Can soda", name: "Orange Fanta", units_per_case: 12 },
  { category: "Can soda", name: "Sprite", units_per_case: 35 },
  { category: "Can soda", name: "Dr. Pepper", units_per_case: 35 },
  { category: "Can soda", name: "Ginger Ale (Canada Dry)", units_per_case: 24 },
  { category: "Can soda", name: "Mountain Dew", units_per_case: 36 },

  // Poppi
  { category: "Poppi", name: "Shirley Temple", units_per_case: 12 },
  { category: "Poppi", name: "Strawberry Lemon", units_per_case: 12 },
  { category: "Poppi", name: "Cherry Cola", units_per_case: 12 },
  { category: "Poppi", name: "Raspberry Rose", units_per_case: 12 },
  { category: "Poppi", name: "Wild Berry", units_per_case: 12 },

  // Snapple
  { category: "Snapple", name: "Snapple Apple", units_per_case: 12 },
  { category: "Snapple", name: "Kiwi Peach", units_per_case: 12 },
  { category: "Snapple", name: "Peach Tea", units_per_case: 12 },
  { category: "Snapple", name: "Lemon Tea", units_per_case: 12 },

  // Welch's
  { category: "Welch's", name: "Welch's Grape", units_per_case: 12 },

  // Bottle soda
  { category: "Bottle soda", name: "Coca-Cola (Bottle)", units_per_case: 24 },
  { category: "Bottle soda", name: "Diet Coke (Bottle)", units_per_case: 24 },
  { category: "Bottle soda", name: "Coke Zero (Bottle)", units_per_case: 24 },
  { category: "Bottle soda", name: "Orange Fanta (Bottle)", units_per_case: 24 },
  { category: "Bottle soda", name: "Sprite (Bottle)", units_per_case: 24 },
  { category: "Bottle soda", name: "Ginger Ale Canada Dry (Bottle)", units_per_case: 24 },
  { category: "Bottle soda", name: "Mountain Dew (Bottle)", units_per_case: 24 },

  // Essentia
  { category: "Essentia", name: "Essentia 20oz", units_per_case: 24 },
  { category: "Essentia", name: "Essentia 1L", units_per_case: 12 },
  { category: "Essentia", name: "Essentia 1.5L", units_per_case: 12 },

  // Poland Spring
  { category: "Poland Spring", name: "Poland Spring 16.9oz", units_per_case: 40 },
  { category: "Poland Spring", name: "Poland Spring 700mL", units_per_case: 24 },

  // Foreign drinks
  { category: "Foreign drinks", name: "Chi Sparkling - White Lychee", units_per_case: 12 },
  { category: "Foreign drinks", name: "Chi Sparkling - White Peach", units_per_case: 12 },
  { category: "Foreign drinks", name: "Chi Sparkling - Grape", units_per_case: 12 },
  { category: "Foreign drinks", name: "Kang Shi Fu - Iced Black Tea", units_per_case: 1, notes: "case size TBD" },
  { category: "Foreign drinks", name: "VLT - Box", units_per_case: 24 },
  { category: "Foreign drinks", name: "Chrysanthemum Tea - Box", units_per_case: 24 },
  { category: "Foreign drinks", name: "Coconut Milk - Can", units_per_case: 24 },
  { category: "Foreign drinks", name: "Mogu Mogu", units_per_case: 1, notes: "case size TBD" },

  // C4
  { category: "C4", name: "C4 Godzilla", units_per_case: 12 },
  { category: "C4", name: "C4 Bombsicle", units_per_case: 12 },
  { category: "C4", name: "C4 Pink Lemonade", units_per_case: 12 },
  { category: "C4", name: "C4 Cosmic Rainbow", units_per_case: 12 },
  { category: "C4", name: "C4 Strawberry Watermelon Ice", units_per_case: 12 },

  // Bloom
  { category: "Bloom", name: "Bloom Crisp Apple", units_per_case: 12 },
  { category: "Bloom", name: "Bloom Strawberry Watermelon", units_per_case: 12 },

  // Monster
  { category: "Monster", name: "Monster Black", units_per_case: 12 },
  { category: "Monster", name: "Monster White", units_per_case: 12 },
  { category: "Monster", name: "Monster Ultra Fantasy Ruby Red", units_per_case: 12 },
  { category: "Monster", name: "Monster Ultra Blue Hawaiian", units_per_case: 12 },
  { category: "Monster", name: "Monster Ultra Vice Guava", units_per_case: 12 },
  { category: "Monster", name: "Monster Lo-Carb", units_per_case: 12 },
  { category: "Monster", name: "Monster Ultra Peachy Keen", units_per_case: 12 },

  // Red Bull
  { category: "Red Bull", name: "Red Bull Original 8.4oz", units_per_case: 12 },
  { category: "Red Bull", name: "Red Bull Sugar Free 8.4oz", units_per_case: 12 },
  { category: "Red Bull", name: "Red Bull Red 8.4oz", units_per_case: 12 },
  { category: "Red Bull", name: "Red Bull Peach 8.4oz", units_per_case: 12 },
  { category: "Red Bull", name: "Red Bull Summer 8.4oz", units_per_case: 12 },
  { category: "Red Bull", name: "Red Bull Original 12oz", units_per_case: 12 },
  { category: "Red Bull", name: "Red Bull Sugar Free 12oz", units_per_case: 12 },
  { category: "Red Bull", name: "Red Bull Winter Edition 12oz", units_per_case: 12 },
];

console.log(`Seeding ${items.length} items…`);

// Check for existing items so we don't duplicate
const { data: existing, error: readErr } = await sb
  .from("items")
  .select("name, category");

if (readErr) {
  console.error("Failed to read existing items:", readErr.message);
  process.exit(1);
}

const existingKeys = new Set(
  (existing ?? []).map((it) => `${it.category}|${it.name}`)
);
const toInsert = items.filter(
  (it) => !existingKeys.has(`${it.category}|${it.name}`)
);
const skipped = items.length - toInsert.length;

if (toInsert.length === 0) {
  console.log(`Nothing to insert — all ${items.length} items already exist.`);
  process.exit(0);
}

// Ensure required fields are non-null
const normalized = toInsert.map((it) => ({
  name: it.name,
  category: it.category ?? "",
  units_per_case: it.units_per_case ?? 1,
  cases: it.cases ?? 0,
  loose_units: it.loose_units ?? 0,
  notes: it.notes ?? "",
}));

const { data, error } = await sb.from("items").insert(normalized).select();
if (error) {
  console.error("Insert error:", error.message);
  console.error("If this mentions a missing column, re-run supabase-schema.sql first.");
  process.exit(1);
}

console.log(`Inserted ${data?.length ?? 0} items.`);
if (skipped > 0) console.log(`Skipped ${skipped} that already existed.`);
