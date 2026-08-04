import { describe, expect, it } from "vitest";
import { mmssToSec } from "@/lib/scoring";
import { generateAtPlan } from "./index";
import { renderAtPlanPdf } from "./pdf";
import type { AtMemberInput } from "./types";

function member(over: Partial<AtMemberInput> & { id: string; displayName: string }): AtMemberInput {
  return { age: 30, sex: "MC", baseline: null, twoMileSec: null, mdlLb: null, ...over };
}

const NOW = new Date("2026-06-06T12:00:00Z");

describe("renderAtPlanPdf", () => {
  it("produces a valid, non-trivial PDF (handles non-ASCII glyphs without throwing)", async () => {
    const plan = generateAtPlan(
      {
        unitName: "B Co, 1-158 IN — ×÷",
        startDateISO: "2026-07-06",
        days: 14,
        members: [
          member({ id: "a", displayName: "SGT Alpha", twoMileSec: mmssToSec("13:30"), mdlLb: 320 }),
          member({ id: "b", displayName: "SPC Bravo", twoMileSec: mmssToSec("18:30"), mdlLb: 210 }),
          member({
            id: "p",
            displayName: "PFC Profile",
            twoMileSec: mmssToSec("16:00"),
            mdlLb: 400,
            profile: {
              restrictions: ["no_run", "lift_limit"],
              exemptEvents: ["HRP"],
              alternateAerobic: "row",
              liftLimitLb: 135,
            },
          }),
        ],
      },
      NOW,
    );

    const bytes = await renderAtPlanPdf(plan);
    expect(bytes.length).toBeGreaterThan(1000);
    // PDF magic header "%PDF"
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x25, 0x50, 0x44, 0x46]);
  });

  it("renders an empty-roster plan without throwing", async () => {
    const plan = generateAtPlan(
      { unitName: "Empty", startDateISO: "2026-07-06", days: 7, members: [] },
      NOW,
    );
    const bytes = await renderAtPlanPdf(plan);
    expect(bytes.length).toBeGreaterThan(500);
  });
});
