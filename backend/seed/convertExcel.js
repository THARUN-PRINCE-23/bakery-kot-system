import path from "path";
import fs from "fs";
import xlsx from "xlsx";

const sourcePath = path.join(process.cwd(), "..", "sancks product list.xlsx");
const outputPath = path.join(process.cwd(), "seed", "menu.json");

function main() {
  if (!fs.existsSync(sourcePath)) {
    console.error("Excel file not found at", sourcePath);
    process.exit(1);
  }

  const wb = xlsx.readFile(sourcePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

let currentCategory = "Bakery";
const items = [];

rows.forEach((row) => {
  const rawName =
    row.Name ||
    row.Item ||
    row.ItemName ||
    row["Item Name"] ||
    row["item names"] ||
    row["item"];
  const rawPrice =
    row.Price ||
    row.Rate ||
    row["MRP"] ||
    row["sellling price"] ||
    row["selling price"];

  if (rawName && rawPrice === "") {
    // Treat as category header row
    currentCategory = String(rawName).trim() || currentCategory;
    return;
  }

  const price = Number(rawPrice);
  if (!rawName || Number.isNaN(price)) return;

  items.push({
    name: String(rawName),
    price: price,
    category: currentCategory,
    imageUrl: row.ImageUrl || "https://via.placeholder.com/150?text=Bakery",
    available: true,
  });
});

  fs.writeFileSync(outputPath, JSON.stringify(items, null, 2));
  console.log(`Converted ${items.length} items to ${outputPath}`);
}

main();

