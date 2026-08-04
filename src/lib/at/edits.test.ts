import { describe, expect, it } from "vitest";
import { mmssToSec } from "@/lib/scoring";
import { generateAtPlan } from "./index";
import { applyAtEdit } from "./edits";
import type { AtMemberInput } from "./types";

function member(over: Partial<AtMemberInput> & { id: string; displayName: string }): AtMemberInput {
  return { age: 30, sex: "MC", baseline: null, twoMileSec: null, mdlLb: null, ...over };
}

const NOW = new Date("2026-06-06T12:00:00Z");

function plan() {
  return generateAtPlan(
    {
      unitName: "B Co",
      startDateISO: "2026-07-06",
      days: 14,
      members: [
        member({ id: "a", displayName: "SGT Alpha", twoMileSec: mmssToSec("13:00") }), // A
        member({ id: "b", displayName: "SPC Bravo", twoMileSec: mmssToSec("16:00") }), // B
        member({
          id: "p",
          displayName: "PFC Profile",
          twoMileSec: mmssToSec("15:00"),
          profile: { restrictions: ["no_run"], exemptEvents: [], alternateAerobic: "row" },
        }), // ALT
      ],
    },
    NOW,
  );
}

describe("applyAtEdit", () => {
  it("add_day_note appends a note line to the day", () => {
    const p = applyAtEdit(plan(), { type: "add_day_note", dayIndex: 0, text: "PT in ACUs" });
    expect(p.schedule[0]!.activities.join(" ")).toContain("PT in ACUs");
  });

  it("set_rest converts a day to rest", () => {
    const p = applyAtEdit(plan(), { type: "set_rest", dayIndex: 2, reason: "range day" });
    expect(p.schedule[2]!.rest).toBe(true);
    expect(p.schedule[2]!.activities[0]).toContain("range day");
  });

  it("set_day replaces title + activities and restores prep/recovery", () => {
    const rested = applyAtEdit(plan(), { type: "set_rest", dayIndex: 3 });
    const p = applyAtEdit(rested, {
      type: "set_day",
      dayIndex: 3,
      title: "Foot march",
      activities: ["6-mile foot march @ 15 min/mi with 35 lb"],
    });
    expect(p.schedule[3]!.rest).toBe(false);
    expect(p.schedule[3]!.title).toBe("Foot march");
    expect(p.schedule[3]!.preparation.length).toBeGreaterThan(0);
    expect(p.schedule[3]!.recovery.length).toBeGreaterThan(0);
  });

  it("move_member reassigns group and updates the card", () => {
    const p = applyAtEdit(plan(), { type: "move_member", memberId: "b", toGroup: "A" });
    const groupA = p.groups.find((g) => g.key === "A")!;
    const groupB = p.groups.find((g) => g.key === "B");
    expect(groupA.memberIds).toContain("b");
    expect(groupB?.memberIds ?? []).not.toContain("b");
    expect(p.cards.find((c) => c.memberId === "b")!.abilityGroup).toBe("A");
  });

  it("no-ops on a bad day index or unknown member", () => {
    const p = plan();
    expect(applyAtEdit(p, { type: "set_rest", dayIndex: 99 })).toEqual(p);
    expect(applyAtEdit(p, { type: "move_member", memberId: "nope", toGroup: "A" })).toBe(p);
  });

  it("move_member to a non-existent group is a no-op (won't invent a group)", () => {
    const p = plan();
    // No UNASSESSED group exists in this plan (all members are grouped).
    expect(applyAtEdit(p, { type: "move_member", memberId: "a", toGroup: "UNASSESSED" })).toBe(p);
  });
});
