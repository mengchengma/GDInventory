// Deletes items created inside a given time window — used to undo a bad bulk
// import. Refuses to touch anything holding a stock count, so a mistake here
// can't destroy counting work.
//
//   node scripts/revert-import.mjs                 # dry run, shows the plan
//   node scripts/revert-import.mjs --confirm       # actually deletes
//
// Window defaults to the most recent creation-minute cluster.
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

const CONFIRM = process.argv.includes("--confirm");
const WINDOW_ARG = process.argv.find((a) => a.startsWith("--window="));
const WINDOW = WINDOW_ARG ? WINDOW_ARG.split("=")[1] : null;

const { data, error } = await sb
  .from("items")
  .select("id, name, cases, loose_units, created_at")
  .order("created_at", { ascending: false });

if (error) {
  console.error("Read failed:", error.message);
  process.exit(1);
}

const targetWindow = WINDOW ?? data[0]?.created_at.slice(0, 16);
if (!targetWindow) {
  console.log("No items found.");
  process.exit(0);
}

const inWindow = data.filter((it) => it.created_at.startsWith(targetWindow));
const withStock = inWindow.filter((i) => i.cases > 0 || i.loose_units > 0);
const safe = inWindow.filter((i) => i.cases === 0 && i.loose_units === 0);

console.log(`Window:  ${targetWindow.replace("T", " ")} UTC`);
console.log(`Matched: ${inWindow.length} item(s)\n`);

if (withStock.length > 0) {
  console.log(
    `PROTECTED — ${withStock.length} item(s) hold stock counts and will NOT be deleted:`
  );
  for (const it of withStock) {
    console.log(`   ${it.name}  (${it.cases} cases, ${it.loose_units} loose)`);
  }
  console.log();
}

console.log(`To delete: ${safe.length} item(s), all at zero stock`);
for (const it of safe) console.log(`   ${it.name}`);
console.log();

if (safe.length === 0) {
  console.log("Nothing to do.");
  process.exit(0);
}

if (!CONFIRM) {
  console.log(`Dry run — nothing changed.`);
  console.log(`Re-run with --confirm to delete these ${safe.length} item(s).`);
  process.exit(0);
}

const { error: delErr } = await sb
  .from("items")
  .delete()
  .in(
    "id",
    safe.map((i) => i.id)
  );

if (delErr) {
  console.error("Delete failed:", delErr.message);
  process.exit(1);
}

const { count } = await sb
  .from("items")
  .select("id", { count: "exact", head: true });

console.log(`Deleted ${safe.length} item(s).`);
console.log(`Items remaining: ${count}`);
