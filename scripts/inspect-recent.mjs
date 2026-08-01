// Read-only. Shows items grouped by creation time so a bad import can be
// identified precisely before anything is deleted.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dirname, "..", ".env.local"), "utf8")
  .split("\n")
  .filter((l) => l.trim() && !l.trim().startsWith("#"))
  .reduce((acc, line) => {
    const eq = line.indexOf("=");
    if (eq > -1) acc[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    return acc;
  }, {});

const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data, error } = await sb
  .from("items")
  .select("id, name, category, cases, loose_units, units_per_case, created_at")
  .order("created_at", { ascending: false });

if (error) {
  console.error("Read failed:", error.message);
  process.exit(1);
}

console.log(`Total items in database: ${data.length}\n`);

// Cluster by creation minute — a bulk import lands in a single burst.
const clusters = new Map();
for (const it of data) {
  const key = it.created_at.slice(0, 16); // YYYY-MM-DDTHH:MM
  if (!clusters.has(key)) clusters.set(key, []);
  clusters.get(key).push(it);
}

console.log("Items grouped by creation time (newest first):\n");
let n = 0;
for (const [when, items] of clusters) {
  n++;
  const withStock = items.filter(
    (i) => i.cases > 0 || i.loose_units > 0
  ).length;
  console.log(
    `[${n}] ${when.replace("T", " ")} UTC  —  ${items.length} item(s)` +
      (withStock > 0 ? `  ⚠️  ${withStock} HAVE STOCK COUNTS` : "  (all zero stock)")
  );
  for (const it of items.slice(0, 8)) {
    const stock =
      it.cases > 0 || it.loose_units > 0
        ? `  <-- ${it.cases} cases, ${it.loose_units} loose`
        : "";
    console.log(`      ${it.name}${stock}`);
  }
  if (items.length > 8) console.log(`      … and ${items.length - 8} more`);
  console.log();
}

// Flag duplicate names, which is what a re-import usually produces.
const byName = new Map();
for (const it of data) {
  const k = it.name.trim().toLowerCase();
  byName.set(k, (byName.get(k) ?? 0) + 1);
}
const dupes = [...byName.entries()].filter(([, c]) => c > 1);
if (dupes.length) {
  console.log(`Duplicate names: ${dupes.length}`);
  for (const [name, count] of dupes.slice(0, 20)) {
    console.log(`   ${count}x  ${name}`);
  }
}
