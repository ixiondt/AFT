"""pikepdf round-trip — much more permissive about broken xref tables."""
from pathlib import Path
import pikepdf

for short, src_name in [("da5500", "da5500.pdf"), ("da5501", "da5501.pdf")]:
    src = Path("data/forms") / src_name
    dest = Path("data/forms") / f"{short}-clean.pdf"
    print(f"\n=== {short} ===")
    try:
        with pikepdf.open(src, allow_overwriting_input=False) as pdf:
            print(f"  Pages: {len(pdf.pages)}")
            # Drop encryption + permissions; rewrite linearized
            pdf.save(dest, normalize_content=False, linearize=False)
        print(f"  -> {dest}")
        # Now inspect form fields
        with pikepdf.open(dest) as pdf:
            try:
                acroform = pdf.Root.AcroForm
                fields = acroform.get("/Fields", [])
                print(f"  Top-level field count: {len(fields)}")
                # Walk all fields recursively
                count = 0
                def walk(node, depth=0):
                    global count
                    name = node.get("/T")
                    kids = node.get("/Kids")
                    ft = node.get("/FT")
                    if name is not None:
                        rect = node.get("/Rect")
                        print(f"    {'  '*depth}{str(ft):8s}  {str(name):40s}  rect={rect}")
                        count += 1
                    if kids is not None:
                        for k in kids:
                            walk(k, depth + 1)
                for f in fields:
                    walk(f)
                print(f"  Total fields (incl. children): {count}")
            except (AttributeError, KeyError) as e:
                print(f"  No AcroForm: {e}")
    except Exception as e:
        print(f"  failed: {type(e).__name__}: {e}")
