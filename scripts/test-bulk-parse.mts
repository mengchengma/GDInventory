import { parseBulkInput } from "../src/lib/bulkParse.ts";

// Verbatim paste from the Big Geyser Google Sheet, tabs and all.
const T = "\t";
const input = [
  `Big Geyser Beverage Order${T}${T}${T}${T}${T}Total Order Value${T}#DIV/0!`,
  ``,
  ``,
  `Item Name${T}SKU${T}Case Price${T}Items Per Case${T}Unit Price${T}Sale Price${T}Profit Margin`,
  `Bloom (Crisp Apple)${T}842595138214${T}$28.00${T}12${T}$2.33${T}$2.99${T}$0.66`,
  `Celsius (Peach Vibe)${T}889392010190${T}${T}${T}#DIV/0!${T}$2.99${T}#DIV/0!`,
  `Poppi (Shirley Temple)${T}${T}$20.00${T}12${T}$1.67${T}$2.99${T}$1.32`,
  `essentia (20 oz)${T}657227001206${T}$30.20${T}24${T}$1.26${T}$2.99${T}$1.73`,
  `Throne Sport Coffe Latte (Mocha Cocoa)${T}${T}${T}${T}#DIV/0!${T}$3.50${T}#DIV/0!`,
].join("\n");

const { rows, headerMap } = parseBulkInput(input);

console.log("headerMap:", headerMap ? [...headerMap.entries()] : null);
console.log("row count:", rows.length);
console.log();
for (const r of rows) {
  console.log(
    [
      r._error ? `ERR(${r._error})` : "ok  ",
      JSON.stringify(r.name),
      `sku=${r.sku || "-"}`,
      `upc=${r.units_per_case}`,
      `case=${r.case_cost}`,
      `sale=${r.unit_price}`,
    ].join("  ")
  );
}
