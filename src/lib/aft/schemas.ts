import { z } from "zod";

/** Parse a "m:ss" string into total seconds. */
function parseMmss(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(raw);
  if (!m) return null;
  const min = Number(m[1]);
  const sec = Number(m[2]);
  if (sec >= 60) return null;
  return min * 60 + sec;
}

const mmssField = z
  .string()
  .min(1)
  .max(8)
  .refine((s) => parseMmss(s) !== null, "Use m:ss format, e.g. 17:37")
  .transform((s) => parseMmss(s) as number);

export const equipmentEnum = z.enum([
  "barbell",
  "rack",
  "dumbbells",
  "kettlebell",
  "sled",
  "pullup_bar",
  "track",
  "treadmill",
]);

export const injuryEnum = z.enum([
  "knee",
  "lower_back",
  "achilles",
  "shoulder",
  "hip",
  "wrist",
]);

export const restrictionEnum = z.enum([
  "no_run",
  "no_impact",
  "no_ruck",
  "no_overhead",
  "lift_limit",
  "run_own_pace",
]);

export const eventEnum = z.enum(["MDL", "HRP", "SDC", "PLK", "2MR"]);

export const alternateAerobicEnum = z.enum(["none", "walk", "row", "bike", "swim"]);

/** An empty-string form field coerces to `undefined` (optional not submitted). */
const optionalDateField = z
  .string()
  .optional()
  .or(z.literal("").transform(() => undefined));

export const PROFILE_FORM_SCHEMA = z.object({
  age: z.coerce.number().int().min(17).max(80),
  sex: z.enum(["MC", "F"]),
  bodyweightLb: z.coerce.number().int().min(80).max(500),
  goalBodyweightLb: z.coerce
    .number()
    .int()
    .min(80)
    .max(500)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  heightIn: z.coerce
    .number()
    .multipleOf(0.5, "Height must be to the nearest 0.5 inch")
    .min(48)
    .max(96)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  daysPerWeek: z.coerce.number().int().refine((n) => [3, 4, 5, 6].includes(n), "Choose 3, 4, 5, or 6"),
  durationWeeks: z.coerce.number().int().min(6).max(26),
  testDate: z.string().min(1, "Pick a test date"),
  equipment: z.array(equipmentEnum).default([]),
  injuries: z.array(injuryEnum).default([]),
  calisthenicsPreferred: z.coerce.boolean().default(false),
  activeRecovery: z.coerce.boolean().default(true),

  // ---- Medical profile (DA 3349) accommodations — all optional ----
  hasMedicalProfile: z.coerce.boolean().default(false),
  profileType: z.enum(["temporary", "permanent"]).optional(),
  profileStart: optionalDateField,
  profileExpires: optionalDateField,
  restrictions: z.array(restrictionEnum).default([]),
  exemptEvents: z.array(eventEnum).default([]),
  alternateAerobic: alternateAerobicEnum.default("none"),
  liftLimitLb: z.coerce
    .number()
    .int()
    .min(0)
    .max(700)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  profileNotes: z
    .string()
    .max(500)
    .optional()
    .or(z.literal("").transform(() => undefined)),

  currentMdlLb: z.coerce.number().int().min(50).max(700),
  currentHrpReps: z.coerce.number().int().min(0).max(150),
  currentSdc: mmssField,
  currentPlk: mmssField,
  current2MR: mmssField,

  goalMdlLb: z.coerce.number().int().min(50).max(700),
  goalHrpReps: z.coerce.number().int().min(0).max(150),
  goalSdc: mmssField,
  goalPlk: mmssField,
  goal2MR: mmssField,
});

export type ProfileFormInput = z.infer<typeof PROFILE_FORM_SCHEMA>;

/** Pull multi-value array from FormData (e.g., a set of checkboxes with the same name). */
export function multiValue(formData: FormData, name: string): string[] {
  return formData.getAll(name).map(String).filter(Boolean);
}

/** Read 1 if checkbox is present, 0 otherwise. */
export function checkboxValue(formData: FormData, name: string): boolean {
  return formData.get(name) === "on" || formData.get(name) === "true";
}
