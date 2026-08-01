// Fills in pricing on EXISTING items from the Big Geyser order sheet.
//
//   node scripts/apply-prices.mjs              # dry run — shows the match plan
//   node scripts/apply-prices.mjs --confirm    # writes the prices
//
// Only ever writes case_cost, unit_price and sku. Never writes cases or
// loose_units, so stock counts cannot be affected. units_per_case mismatches
// are reported for review rather than changed silently, because total units
// derives from it.
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

// name, sku, case price, units/case, sale price  — from the Big Geyser sheet.
// Blank case price means the sheet showed #DIV/0!.
const SHEET = [
  ["Bloom (Crisp Apple)", "842595138214", 28.0, 12, 2.99],
  ["Bloom (Juicy Orange)", "842595136616", 28.0, 12, 2.99],
  ["Bloom (Strawberry Watermelon)", "842595135091", 28.0, 12, 2.99],
  ["C4 (Frozen Bombsicle)", "842595106596", 28.0, 12, 3.5],
  ["C4 (Pink Lemonade)", "842595109368", 28.0, 12, 3.5],
  ["C4 (Godzilla)", "842595139099", 28.0, 12, 3.5],
  ["Celsius (Peach Vibe)", "889392010190", null, null, 2.99],
  ["Celsius (Sparkling Orange)", "889392000313", null, null, 2.99],
  ["Celsius (Arctic Vibe)", "889392021417", null, null, 2.99],
  ["Celsius (Tropical Vibe)", "889392021394", null, null, 2.99],
  ["Poppi (Shirley Temple)", "", 20.0, 12, 2.99],
  ["Poppi (Raspberry Rose)", "709586514894", 20.0, 12, 2.99],
  ["Poppi (Strawberry Lemon)", "709586514856", 20.0, 12, 2.99],
  ["essentia (1 L)", "657227000339", 22.6, 12, 2.79],
  ["essentia (1.5 L)", "657227000506", 26.6, 12, 3.99],
  ["essentia (20 oz)", "657227001206", 30.2, 24, 2.99],
  ["Throne Sport Coffe Latte (Coffee Latte)", "", 34.0, 12, 3.5],
  ["Throne Sport Coffe Latte (Mocha Java)", "", 34.0, 12, 3.5],
  ["Throne Sport Coffe Latte (Mocha Cocoa)", "", null, null, 3.5],
];

const norm = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const squash = (s) => norm(s).replace(/ /g, "");
const tokens = (s) => new Set(norm(s).split(" ").filter(Boolean));

function findMatch(sheetName, items) {
  const sN = norm(sheetName);
  const sS = squash(sheetName);
  const sT = tokens(sheetName);

  for (const it of items) if (norm(it.name) === sN) return [it, "exact"];
  for (const it of items) if (squash(it.name) === sS) return [it, "spacing"];

  // Every word of the stored name appears in the sheet name (or vice versa),
  // e.g. "Shirley Temple" inside "Poppi (Shirley Temple)".
  let best = null;
  for (const it of items) {
    const iT = tokens(it.name);
    const dbInSheet = [...iT].every((t) => sT.has(t));
    const sheetInDb = [...sT].every((t) => iT.has(t));
    if (dbInSheet || sheetInDb) {
      const overlap = [...iT].filter((t) => sT.has(t)).length;
      if (!best || overlap > best[2]) best = [it, "tokens", overlap];
    }
  }
  return best ? [best[0], best[1]] : [null, null];
}

const { data: items, error } = await sb
  .from("items")
  .select("id, name, category, units_per_case, cases, loose_units, case_cost, unit_price, sku");

if (error) {
  console.error("Read failed:", error.message);
  process.exit(1);
}

const updates = [];
const unmatched = [];
const conflicts = [];
const claimed = new Set();

for (const [name, sku, casePrice, unitsPerCase, salePrice] of SHEET) {
  const pool = items.filter((i) => !claimed.has(i.id));
  const [match, how] = findMatch(name, pool);
  if (!match) {
    unmatched.push(name);
    continue;
  }
  claimed.add(match.id);

  if (unitsPerCase !== null && match.units_per_case !== unitsPerCase) {
    conflicts.push(
      `${match.name}: app has ${match.units_per_case}/case, sheet says ${unitsPerCase}/case (left unchanged)`
    );
  }

  updates.push({
    id: match.id,
    dbName: match.name,
    sheetName: name,
    how,
    patch: {
      ...(casePrice !== null ? { case_cost: casePrice } : {}),
      ...(salePrice !== null ? { unit_price: salePrice } : {}),
      ...(sku ? { sku } : {}),
    },
  });
}

console.log(`Sheet rows: ${SHEET.length}`);
console.log(`Matched to existing items: ${updates.length}`);
console.log(`No match (would need adding): ${unmatched.length}\n`);

console.log("PLANNED UPDATES  (prices only — counts untouched)\n");
for (const u of updates) {
  const p = u.patch;
  const bits = [];
  if (p.case_cost !== undefined) bits.push(`case $${p.case_cost.toFixed(2)}`);
  if (p.unit_price !== undefined) bits.push(`sale $${p.unit_price.toFixed(2)}`);
  if (p.sku) bits.push(`sku ${p.sku}`);
  console.log(`  ${u.dbName}`);
  console.log(`      <- ${u.sheetName}  [${u.how}]`);
  console.log(`      ${bits.join(", ")}`);
}

if (conflicts.length) {
  console.log(`\nUNITS/CASE MISMATCHES — reported only, not changed:`);
  for (const c of conflicts) console.log(`  ${c}`);
}

if (unmatched.length) {
  console.log(`\nNOT IN YOUR INVENTORY — add manually if you carry them:`);
  for (const n of unmatched) console.log(`  ${n}`);
}

if (!CONFIRM) {
  console.log(`\nDry run — nothing changed.`);
  console.log(`Re-run with --confirm to write these ${updates.length} update(s).`);
  process.exit(0);
}

let ok = 0;
for (const u of updates) {
  const { error: e } = await sb.from("items").update(u.patch).eq("id", u.id);
  if (e) console.error(`  FAILED ${u.dbName}: ${e.message}`);
  else ok++;
}
console.log(`\nUpdated ${ok} of ${updates.length} item(s). Counts untouched.`);
