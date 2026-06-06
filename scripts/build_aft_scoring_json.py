"""Second pass: turn raw pdfplumber tables into clean structured scoring JSON.

Output shape:
{
  "source": "AFT_Scoring_Scales_250601.pdf",
  "effective_date": "2025-06-01",
  "brackets": ["17-21","22-26",...,"62+"],
  "sexes": ["MC","F"],
  "events": {
    "MDL": { "unit": "lb",  "higher_is_better": true,
             "tables": { "37-41": { "MC": [[100,350],[99,340],...], "F": [...] }, ... } },
    "HRP": { "unit": "reps", "higher_is_better": true, ...},
    "SDC": { "unit": "sec",  "higher_is_better": false, ...},
    "PLK": { "unit": "sec",  "higher_is_better": true,  ...},
    "2MR": { "unit": "sec",  "higher_is_better": false, ...}
  }
}
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).parent.parent
RAW = ROOT / "data" / "aft_scoring_raw.json"
OUT = ROOT / "data" / "aft_scoring.json"

BRACKETS = [
    "17-21", "22-26", "27-31", "32-36", "37-41",
    "42-46", "47-51", "52-56", "57-61", "62+",
]
SEXES = ["MC", "F"]


def mmss_to_sec(s: str) -> int | None:
    """Parse 'm:ss' into total seconds. Returns None for blanks/dashes."""
    if not s or s.strip() in ("---", "--", "-", ""):
        return None
    m = re.match(r"^\s*(\d{1,2}):(\d{2})\s*$", s)
    if not m:
        return None
    return int(m.group(1)) * 60 + int(m.group(2))


def to_int(s: str) -> int | None:
    if not s or s.strip() in ("---", "--", "-", ""):
        return None
    try:
        return int(s.strip())
    except ValueError:
        return None


def event_for_page(page_text: str) -> str | None:
    if "Max Deadlift" in page_text:
        return "MDL"
    if "Hand-release Push-up" in page_text:
        return "HRP"
    if "Sprint / Drag / Carry" in page_text:
        return "SDC"
    if "Plank (PLK)" in page_text:
        return "PLK"
    if "Two-Mile Run" in page_text:
        return "2MR"
    return None


def find_data_rows(table: list[list]) -> list[list]:
    """Skip header rows; return only rows whose first cell is a numeric point value."""
    out = []
    for row in table:
        if not row:
            continue
        first = (row[0] or "").strip()
        if re.match(r"^\d{1,3}$", first):
            out.append(row)
    return out


def parse_event_pages(pages: list[dict], event: str) -> dict:
    """Merge all tables for `event` (some events span two pages) into bracket→sex→[(points, raw)]."""
    rows: list[list[str]] = []
    for p in pages:
        if event_for_page(p["text"]) != event:
            continue
        for table in p["tables"]:
            rows.extend(find_data_rows(table))

    # Build the bracket × sex map. Column layout: col 0 = points,
    # then 10 pairs of (M|C, F), then col 21 = points-right.
    is_time = event in ("SDC", "PLK", "2MR")
    parse = mmss_to_sec if is_time else to_int

    tables: dict[str, dict[str, list[list[int]]]] = {
        b: {s: [] for s in SEXES} for b in BRACKETS
    }

    for row in rows:
        points = int(row[0].strip())
        # Pad row to 22 columns if pdfplumber dropped trailing Nones
        cells = list(row) + [None] * (22 - len(row))
        for bi, bracket in enumerate(BRACKETS):
            mc_cell = cells[1 + bi * 2]
            f_cell = cells[2 + bi * 2]
            mc_val = parse(mc_cell or "")
            f_val = parse(f_cell or "")
            if mc_val is not None:
                tables[bracket]["MC"].append([points, mc_val])
            if f_val is not None:
                tables[bracket]["F"].append([points, f_val])

    # Sort by points descending so the lookup can short-circuit
    for b in tables:
        for s in tables[b]:
            tables[b][s].sort(key=lambda x: -x[0])

    higher_is_better = event in ("MDL", "HRP", "PLK")
    unit = {"MDL": "lb", "HRP": "reps", "SDC": "sec", "PLK": "sec", "2MR": "sec"}[event]
    return {"unit": unit, "higher_is_better": higher_is_better, "tables": tables}


def main() -> None:
    raw = json.loads(RAW.read_text(encoding="utf-8"))
    pages = raw["pages"]

    result = {
        "source": "AFT_Scoring_Scales_250601.pdf",
        "effective_date": "2025-06-01",
        "brackets": BRACKETS,
        "sexes": SEXES,
        "events": {},
    }
    for event in ("MDL", "HRP", "SDC", "PLK", "2MR"):
        result["events"][event] = parse_event_pages(pages, event)

    OUT.write_text(json.dumps(result, indent=2), encoding="utf-8")

    # Sanity report
    print(f"Wrote {OUT}")
    for ev, data in result["events"].items():
        sample = data["tables"]["37-41"]["MC"]
        print(
            f"  {ev:4s} unit={data['unit']:5s} 37-41 MC rows={len(sample)} "
            f"top={sample[0] if sample else '-'} bottom={sample[-1] if sample else '-'}"
        )


if __name__ == "__main__":
    main()
