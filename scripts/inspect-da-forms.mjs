/**
 * Inspect the DA 5500 / 5501 PDFs to see if they have fillable form fields,
 * and dump the field names so we know how to map our data → form.
 */
import { PDFDocument } from "pdf-lib";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const files = [
  { name: "DA 5500 (male)", path: "data/forms/da5500.pdf" },
  { name: "DA 5501 (female)", path: "data/forms/da5501.pdf" },
];

for (const f of files) {
  console.log("\n=== " + f.name + " ===");
  const bytes = readFileSync(resolve(f.path));
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  console.log("Pages:", doc.getPageCount());
  const form = doc.getForm();
  const fields = form.getFields();
  console.log("Form fields:", fields.length);
  for (const field of fields) {
    const type = field.constructor.name;
    const name = field.getName();
    // Show widget locations + dimensions so we know where each field lives
    const widgets = field.acroField.getWidgets();
    const rects = widgets.map((w) => {
      const r = w.getRectangle();
      return `[x=${r.x.toFixed(1)} y=${r.y.toFixed(1)} w=${r.width.toFixed(1)} h=${r.height.toFixed(1)}]`;
    }).join(",");
    console.log(`  ${type.padEnd(14)} ${name}  ${rects}`);
  }
}
