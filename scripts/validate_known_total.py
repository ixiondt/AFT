"""Validate the parsed scoring JSON against MAJ Soriano's known 422 total."""
import json
from pathlib import Path

ROOT = Path(__file__).parent.parent
DATA = json.loads((ROOT / "data" / "aft_scoring.json").read_text(encoding="utf-8"))


def score_raw(event: str, bracket: str, sex: str, raw: int | float) -> int:
    e = DATA["events"][event]
    table = e["tables"][bracket][sex]
    higher_is_better = e["higher_is_better"]
    # table is sorted points desc, raw goes with point direction.
    # For higher_is_better (MDL/HRP/PLK): walk top down, first raw_threshold <= raw wins.
    # For lower_is_better (SDC/2MR):     walk top down, first raw_threshold >= raw wins.
    for points, threshold in table:
        if higher_is_better:
            if raw >= threshold:
                return points
        else:
            if raw <= threshold:
                return points
    return 0


def mmss(s: str) -> int:
    m, ss = s.split(":")
    return int(m) * 60 + int(ss)


CASE = {
    "bracket": "37-41",
    "sex": "MC",
    "scores": {
        "MDL": 300,
        "HRP": 40,
        "SDC": mmss("1:51"),
        "PLK": mmss("2:07"),
        "2MR": mmss("17:37"),
    },
}

print(f"Athlete: 37yo male, bracket {CASE['bracket']}/{CASE['sex']}")
total = 0
for event, raw in CASE["scores"].items():
    pts = score_raw(event, CASE["bracket"], CASE["sex"], raw)
    unit = DATA["events"][event]["unit"]
    raw_disp = f"{raw // 60}:{raw % 60:02d}" if unit == "sec" else f"{raw} {unit}"
    print(f"  {event:4s} {raw_disp:>10s}  ->  {pts:3d} pts")
    total += pts

print(f"\nTotal:    {total} pts")
print(f"Expected: 422 pts (from existing plan PDF)")
print("MATCH" if total == 422 else "MISMATCH — debug needed")
