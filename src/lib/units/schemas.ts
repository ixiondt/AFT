import { z } from "zod";
import {
  alternateAerobicEnum,
  emptyToUndefined,
  eventEnum,
  goNoGoEnum,
  restrictionEnum,
} from "@/lib/aft/schemas";

/** "m:ss" → seconds, or null if malformed. */
function parseMmss(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(raw);
  if (!m) return null;
  const min = Number(m[1]);
  const sec = Number(m[2]);
  if (sec >= 60) return null;
  return min * 60 + sec;
}

/** Optional m:ss field — blank/absent → undefined, malformed → error. */
const optMmss = emptyToUndefined(
  z
    .string()
    .refine((s) => parseMmss(s) !== null, "Use m:ss format, e.g. 17:37")
    .transform((s) => parseMmss(s) as number),
);

/** Optional integer field — blank/absent → undefined. */
const optInt = (min: number, max: number) =>
  emptyToUndefined(z.coerce.number().int().min(min).max(max));

export const CREATE_UNIT_SCHEMA = z.object({
  name: z.string().trim().min(1, "Name your unit").max(120),
});
export type CreateUnitInput = z.infer<typeof CREATE_UNIT_SCHEMA>;

export const MEMBER_SCHEMA = z.object({
  displayName: z.string().trim().min(1, "Name required").max(120),
  role: z.preprocess(
    (v) => (v === "" || v == null ? "member" : v),
    z.enum(["mft", "member"]),
  ),

  // Baseline snapshot — all optional (MFT may add a member before scores are known).
  age: optInt(17, 80),
  sex: emptyToUndefined(z.enum(["MC", "F"])),
  bodyweightLb: optInt(80, 500),
  heightIn: emptyToUndefined(
    z.coerce.number().multipleOf(0.5, "Nearest 0.5 inch").min(48).max(96),
  ),
  mdlLb: optInt(50, 700),
  hrpReps: optInt(0, 150),
  sdcSec: optMmss,
  plkSec: optMmss,
  twoMileSec: optMmss,

  // Medical profile (optional) — mirrors the individual profile form.
  hasMedicalProfile: z.coerce.boolean().default(false),
  profileType: emptyToUndefined(z.enum(["temporary", "permanent"])),
  profileStart: emptyToUndefined(z.string()),
  profileExpires: emptyToUndefined(z.string()),
  restrictions: z.array(restrictionEnum).default([]),
  exemptEvents: z.array(eventEnum).default([]),
  alternateAerobic: alternateAerobicEnum.default("none"),
  alternateResult: emptyToUndefined(goNoGoEnum),
  liftLimitLb: optInt(0, 700),
  profileNotes: emptyToUndefined(z.string().max(500)),
});
export type MemberInput = z.infer<typeof MEMBER_SCHEMA>;
