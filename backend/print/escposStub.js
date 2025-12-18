// Stubbed ESC/POS printing; replace with real printer integration when ready.
// For real printing on Windows, install a compatible driver and use a library like `escpos` or `printer`.

export async function printBillStub(order) {
  const header = "SREE KUMARAN SWEETS & BAKERY";
  const lines = [];
  lines.push(header);
  lines.push(`Table: ${order.tableNumber}`);
  lines.push(new Date().toLocaleString());
  lines.push("-".repeat(32));

  order.items.forEach((i) => {
    const name = i.name.substring(0, 16).padEnd(16, " ");
    const qty = String(i.quantity).padStart(2, " ");
    const price = (i.price * i.quantity).toFixed(2).padStart(10, " ");
    lines.push(`${name} x${qty} ${price}`);
  });

  lines.push("-".repeat(32));
  lines.push(`TOTAL`.padEnd(20, " ") + order.total.toFixed(2).padStart(12, " "));
  lines.push("Thank you!");

  const receiptText = lines.join("\n");
  console.log("\n--- PRINT STUB START ---\n" + receiptText + "\n--- PRINT STUB END ---\n");

  return { printed: true, preview: receiptText };
}

