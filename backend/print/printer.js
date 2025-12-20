import escpos from "escpos";
import escposUsb from "escpos-usb";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";

// Set the adapter
escpos.USB = escposUsb;

const PRINTER_TYPE = process.env.PRINTER_TYPE || "USB"; // 'USB', 'NETWORK', 'WINDOWS'
const PRINTER_NAME = process.env.PRINTER_NAME; // e.g., "BILL" or "Thermal Printer"

// Helper to format currency
const formatPrice = (p) => p.toFixed(2);

// Custom Adapter for Windows Raw Printing
class WindowsPrinterAdapter {
  constructor(printerName) {
    this.printerName = printerName;
    this.buffer = Buffer.alloc(0);
  }

  open(callback) {
    // No physical connection to open, just proceed
    if (callback) callback(null);
  }

  write(data, callback) {
    this.buffer = Buffer.concat([this.buffer, data]);
    if (callback) callback(null);
  }

  close(callback, options) {
    // Write buffer to temp file and print
    const tempFile = path.join(process.cwd(), `temp_print_${Date.now()}.bin`);
    fs.writeFile(tempFile, this.buffer, (err) => {
      if (err) {
        console.error("Failed to write temp print file:", err);
        if (callback) callback(err);
        return;
      }

      const helperPath = path.join(process.cwd(), "print", "RawPrinterHelper.exe");
      
      // Execute the helper
      execFile(helperPath, [this.printerName, tempFile], (execErr, stdout, stderr) => {
        // Cleanup temp file
        fs.unlink(tempFile, () => {});

        if (execErr) {
          console.error("RawPrinterHelper failed:", execErr);
          console.error("Stderr:", stderr);
          if (callback) callback(execErr);
        } else {
          console.log("RawPrinterHelper output:", stdout.trim());
          if (callback) callback(null);
        }
      });
    });
  }
}

// Generate the text content for the bill (used for preview and console log)
function generateBillText(order) {
  const header = "SREE KUMARAN SWEETS & BAKERY";
  const lines = [];
  lines.push(header);
  lines.push(`Table: ${order.tableNumber}`);
  lines.push(new Date().toLocaleString());
  lines.push("-".repeat(32));

  order.items.forEach((i) => {
    const name = i.name.substring(0, 16).padEnd(16, " ");
    const qty = String(i.quantity).padStart(2, " ");
    const price = formatPrice(i.price * i.quantity).padStart(10, " ");
    lines.push(`${name} x${qty} ${price}`);
  });

  lines.push("-".repeat(32));
  lines.push(`TOTAL`.padEnd(20, " ") + formatPrice(order.total).padStart(12, " "));
  lines.push("Thank you!");

  return lines.join("\n");
}

// Generate the text content for the KOT
function generateKotText(order) {
  const lines = [];
  lines.push("KOT");
  lines.push(`Table: ${order.tableNumber}`);
  lines.push(new Date().toLocaleString());
  lines.push("-".repeat(32));
  order.items.forEach((i) => {
    const name = i.name.substring(0, 22).padEnd(22, " ");
    const qty = String(i.quantity).padStart(3, " ");
    lines.push(`${name}${qty}`);
  });
  lines.push("-".repeat(32));
  return lines.join("\n");
}

function getDevice() {
  try {
    if (PRINTER_TYPE === "WINDOWS" || PRINTER_NAME) {
       const name = PRINTER_NAME || "BILL"; // Default to BILL if not specified
       console.log(`Using Windows Printer: ${name}`);
       return new WindowsPrinterAdapter(name);
    }

    if (PRINTER_TYPE === "NETWORK") {
        // Example for network printer
        // const ip = process.env.PRINTER_IP || "192.168.1.200";
        // const port = process.env.PRINTER_PORT || 9100;
        // return new escpos.Network(ip, port);
        console.warn("Network printer configured but not fully implemented/imported.");
        return null;
    }
    
    // Default to USB
    return new escpos.USB();
  } catch (err) {
    // This often happens if no USB printer is connected or driver issues
    console.error("Failed to initialize printer device:", err.message);
    return null;
  }
}

export async function printBill(order) {
  const text = generateBillText(order);
  console.log("\n--- PRINT BILL (Hardware Attempt) ---\n" + text + "\n-------------------------------------\n");

  const device = getDevice();
  if (!device) {
    console.warn("No printer device found. Skipping hardware print.");
    return { printed: false, preview: text, error: "Printer not found" };
  }

  return new Promise((resolve) => {
    device.open((err) => {
      if (err) {
        console.error("Could not open printer:", err);
        resolve({ printed: false, preview: text, error: err.message });
        return;
      }

      try {
        const printer = new escpos.Printer(device);
        
        printer
          .font("a")
          .align("ct")
          .style("bu")
          .size(1, 1)
          .text("SREE KUMARAN SWEETS & BAKERY")
          .style("normal")
          .text(`Table: ${order.tableNumber}`)
          .text(new Date().toLocaleString())
          .text("-".repeat(32))
          .align("lt");

        order.items.forEach((i) => {
          const name = i.name.substring(0, 16).padEnd(16, " ");
          const qty = String(i.quantity).padStart(2, " ");
          const price = formatPrice(i.price * i.quantity).padStart(10, " ");
          printer.text(`${name} x${qty} ${price}`);
        });

        printer
          .text("-".repeat(32))
          .align("rt")
          .text(`TOTAL: ${formatPrice(order.total)}`)
          .align("ct")
          .text("Thank you!")
          .cut()
          .close();

        resolve({ printed: true, preview: text });
      } catch (printErr) {
        console.error("Error during printing commands:", printErr);
        resolve({ printed: false, preview: text, error: printErr.message });
      }
    });
  });
}

export async function printKot(order) {
  const text = generateKotText(order);
  console.log("\n--- PRINT KOT (Hardware Attempt) ---\n" + text + "\n------------------------------------\n");

  const device = getDevice();
  if (!device) {
    console.warn("No printer device found. Skipping hardware print.");
    return { printed: false, preview: text, error: "Printer not found" };
  }

  return new Promise((resolve) => {
    device.open((err) => {
      if (err) {
        console.error("Could not open printer:", err);
        resolve({ printed: false, preview: text, error: err.message });
        return;
      }

      try {
        const printer = new escpos.Printer(device);
        
        printer
          .font("a")
          .align("ct")
          .style("bu")
          .text("KOT")
          .style("normal")
          .text(`Table: ${order.tableNumber}`)
          .text(new Date().toLocaleString())
          .text("-".repeat(32))
          .align("lt");

        order.items.forEach((i) => {
          const name = i.name.substring(0, 22).padEnd(22, " ");
          const qty = String(i.quantity).padStart(3, " ");
          printer.text(`${name}${qty}`);
        });

        printer
          .text("-".repeat(32))
          .cut()
          .close();

        resolve({ printed: true, preview: text });
      } catch (printErr) {
        console.error("Error during printing commands:", printErr);
        resolve({ printed: false, preview: text, error: printErr.message });
      }
    });
  });
}
