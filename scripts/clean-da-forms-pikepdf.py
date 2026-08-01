"""Round-trip the DA Form 5500 (Jul 2026) WHtR worksheet through pikepdf.

The source PDF from APD ships encrypted with a broken xref table that pdf-lib
refuses to load. pikepdf is far more permissive: opening + re-saving strips the
encryption/permissions and rebuilds the xref so `fillDa5500` can read it.

Usage: drop the raw APD download at data/forms/da5500-raw.pdf, run this, and it
writes the cleaned template to data/forms/da5500.pdf.

DA 5501 (the old female body-fat worksheet) is rescinded by Army Directive
2026-13 and no longer processed.
"""
from pathlib import Path
import pikepdf

FORMS = Path("data/forms")
src = FORMS / "da5500-raw.pdf"
dest = FORMS / "da5500.pdf"

print(f"=== da5500 (Jul 2026 WHtR worksheet) ===")
if not src.exists():
    raise SystemExit(f"missing source: {src} (place the raw APD download there)")

with pikepdf.open(src, allow_overwriting_input=False) as pdf:
    print(f"  Pages: {len(pdf.pages)}")
    pdf.save(dest, normalize_content=False, linearize=False)
print(f"  -> {dest}")

# Inspect the fillable fields so field-name drift is caught early.
with pikepdf.open(dest) as pdf:
    acroform = pdf.Root.get("/AcroForm")
    fields = acroform.get("/Fields", []) if acroform else []
    count = 0

    def walk(node, depth=0):
        global count
        name = node.get("/T")
        ft = node.get("/FT")
        if name is not None:
            print(f"    {'  ' * depth}{str(ft) if ft else '     ':8s}  {name}")
            count += 1
        for kid in node.get("/Kids", []) or []:
            walk(kid, depth + 1)

    for field in fields:
        walk(field)
    print(f"  Total fields (incl. children): {count}")
