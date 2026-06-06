"""Extract AFT scoring tables from the official PDF into JSON."""
import json
import pdfplumber
from pathlib import Path

PDF = Path(__file__).parent.parent / "AFT_Scoring_Scales_250601.pdf"
OUT_DIR = Path(__file__).parent.parent / "data"
OUT_DIR.mkdir(exist_ok=True)


def main() -> None:
    pages_text: list[str] = []
    pages_tables: list[list[list[list[str]]]] = []
    with pdfplumber.open(PDF) as pdf:
        for i, page in enumerate(pdf.pages):
            pages_text.append(page.extract_text() or "")
            pages_tables.append(page.extract_tables() or [])

    raw_dump = {
        "page_count": len(pages_text),
        "pages": [
            {"index": i, "text": pages_text[i], "tables": pages_tables[i]}
            for i in range(len(pages_text))
        ],
    }
    (OUT_DIR / "aft_scoring_raw.json").write_text(
        json.dumps(raw_dump, indent=2), encoding="utf-8"
    )
    print(f"Wrote {OUT_DIR / 'aft_scoring_raw.json'}")
    print(f"Pages: {len(pages_text)}")
    for i, t in enumerate(pages_text):
        print(f"\n--- Page {i + 1} (len {len(t)}) ---")
        print(t[:600])


if __name__ == "__main__":
    main()
