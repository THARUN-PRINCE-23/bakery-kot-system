import { printBill } from "./print/printer.js";

const dummyOrder = {
  tableNumber: "TEST-99",
  items: [
    { name: "Test Item 1", quantity: 2, price: 50 },
    { name: "Test Item 2", quantity: 1, price: 100 },
  ],
  total: 200,
};

console.log("Attempting to print test bill...");
printBill(dummyOrder)
  .then((res) => {
    console.log("Print result:", res);
  })
  .catch((err) => {
    console.error("Print error:", err);
  });
