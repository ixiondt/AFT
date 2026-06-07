import { PDFDocument } from "pdf-lib";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

for (const f of ["data/forms/da5500-clean.pdf", "data/forms/da5501-clean.pdf"]) {
  console.log("\n=== " + f + " ===");
  try {
    const bytes = readFileSync(resolve(f));
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    console.log("Pages:", doc.getPageCount());
    const form = doc.getForm();
    const fields = form.getFields();
    console.log("Fields seen by pdf-lib:", fields.length);
    for (const field of fields) {
      console.log(`  ${field.constructor.name.padEnd(14)} ${field.getName()}`);
    }
  } catch (e) {
    console.log("ERROR:", e.message);
  }
}
