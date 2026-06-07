"""
Some official Army PDFs ship with restricted permissions + malformed cross-refs
that pdf-lib's parser refuses. Round-trip them through pypdf to drop the
restrictions and rebuild the xref table cleanly. Output files become the
canonical templates we vendor.
"""
import sys
from pathlib import Path
from pypdf import PdfReader, PdfWriter


def clean(src: Path, dest: Path) -> None:
    reader = PdfReader(src, strict=False)
    if reader.is_encrypted:
        try:
            reader.decrypt("")
        except Exception:
            pass
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    # Carry over form fields
    if "/AcroForm" in reader.trailer["/Root"]:
        writer._root_object[reader.trailer["/Root"]["/AcroForm"].indirect_reference.idnum]  # noqa: SLF001
    with open(dest, "wb") as f:
        writer.write(f)
    print(f"  Pages: {len(writer.pages)}  ->  {dest}")


def inspect_fields(path: Path) -> None:
    reader = PdfReader(path, strict=False)
    if "/AcroForm" not in reader.trailer["/Root"]:
        print("  No AcroForm")
        return
    fields = reader.get_fields()
    if not fields:
        print("  No fillable fields")
        return
    print(f"  {len(fields)} fields:")
    for name, info in fields.items():
        field_type = info.get("/FT", "?")
        value = info.get("/V", "")
        print(f"    {str(field_type):8s}  {name:48s}  v={value!r}")


for short, src_name in [("da5500", "da5500.pdf"), ("da5501", "da5501.pdf")]:
    src = Path("data/forms") / src_name
    if not src.exists():
        print(f"missing: {src}")
        sys.exit(1)
    print(f"\n=== {short} ===")
    try:
        clean(src, Path("data/forms") / f"{short}-clean.pdf")
    except Exception as e:
        print(f"  clean failed: {e}")
        continue
    inspect_fields(Path("data/forms") / f"{short}-clean.pdf")
