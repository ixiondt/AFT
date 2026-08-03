import { z } from "zod";
import { alternateAerobicEnum, eventEnum, restrictionEnum } from "@/lib/aft/schemas";

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

/** Optional m:ss field — blank → undefined, malformed → error. */
const optMmss = z
  .union([
    z.literal("").transform(() => undefined),
    z
      .string()
      .refine((s) => parseMmss(s) !== null, "Use m:ss format, e.g. 17:37")
      .transform((s) => parseMmss(s) as number),
  ])
  .optional();

/** Optional positive integer field — blank → undefined. */
const optInt = (min: number, max: number) =>
  z.coerce
    .number()
    .int()
    .min(min)
    .max(max)
    .optional()
    .or(z.literal("").transform(() => undefined));

export const CREATE_UNIT_SCHEMA = z.object({
  name: z.string().min(1, "Name your unit").max(120),
});
export type CreateUnitInput = z.infer<typeof CREATE_UNIT_SCHEMA>;

export const MEMBER_SCHEMA = z.object({
  displayName: z.string().min(1, "Name required").max(120),
  role: z.enum(["mft", "member"]).default("member"),

  // Baseline snapshot — all optional (MFT may add a member before scores are known).
  age: optInt(17, 80),
  sex: z
    .enum(["MC", "F"])
    .optional()
    .or(z.literal("").transform(() => undefined)),
  bodyweightLb: optInt(80, 500),
  heightIn: z.coerce
    .number()
    .multipleOf(0.5, "Nearest 0.5 inch")
    .min(48)
    .max(96)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  mdlLb: optInt(50, 700),
  hrpReps: optInt(0, 150),
  sdcSec: optMmss,
  plkSec: optMmss,
  twoMileSec: optMmss,

  // Medical profile (optional) — mirrors the individual profile form.
  hasMedicalProfile: z.coerce.boolean().default(false),
  profileType: z.enum(["temporary", "permanent"]).optional(),
  profileStart: z
    .string()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  profileExpires: z
    .string()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  restrictions: z.array(restrictionEnum).default([]),
  exemptEvents: z.array(eventEnum).default([]),
  alternateAerobic: alternateAerobicEnum.default("none"),
  liftLimitLb: optInt(0, 700),
  profileNotes: z
    .string()
    .max(500)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
export type MemberInput = z.infer<typeof MEMBER_SCHEMA>;
