import catalogJson from "@data/exercise_catalog.json" with { type: "json" };
import type { Equipment, Injury } from "./types";

export type CatalogCategory =
  | "accessory_pull"
  | "accessory_squat_uni"
  | "accessory_hinge"
  | "accessory_push"
  | "accessory_core"
  | "accessory_carry"
  | "accessory_explosive";

export type CatalogItem = {
  id: string;
  name: string;
  category: CatalogCategory;
  /** Equipment items required; empty = bodyweight, always available. */
  requires: readonly Equipment[];
  /** True if it's a bodyweight / gymnastic movement (no loaded barbell needed). */
  calisthenic: boolean;
  forbiddenInjuries?: readonly Injury[];
  sets: number;
  reps: string | number;
  weightDescriptor?: string;
};

const CATALOG: readonly CatalogItem[] = (
  catalogJson as unknown as { exercises: CatalogItem[] }
).exercises;

export type FilterContext = {
  equipment: readonly Equipment[];
  injuries: readonly Injury[];
  calisthenicsPreferred: boolean;
};

export function filterCatalog(
  category: CatalogCategory,
  ctx: FilterContext,
): CatalogItem[] {
  const filtered = CATALOG.filter((ex) => {
    if (ex.category !== category) return false;
    if (ex.requires.some((req) => !ctx.equipment.includes(req))) return false;
    if (ex.forbiddenInjuries?.some((inj) => ctx.injuries.includes(inj))) return false;
    return true;
  });

  // Stable sort: calisthenic-first when preferred, otherwise keep file order.
  return filtered.sort((a, b) => {
    if (!ctx.calisthenicsPreferred) return 0;
    if (a.calisthenic === b.calisthenic) return 0;
    return a.calisthenic ? -1 : 1;
  });
}

/**
 * Deterministic rotation pick. Same (category, weekIndex, ctx) → same item.
 * Different weeks → different items (rotating through the filtered pool).
 */
export function pickFromCatalog(
  category: CatalogCategory,
  ctx: FilterContext,
  rotation: number,
): CatalogItem | null {
  const pool = filterCatalog(category, ctx);
  if (pool.length === 0) return null;
  const idx = ((rotation % pool.length) + pool.length) % pool.length;
  return pool[idx] ?? pool[0]!;
}

export function catalogItemAsExerciseRow(item: CatalogItem): {
  name: string;
  sets: number;
  reps: string | number;
  weightDescriptor?: string;
} {
  return {
    name: item.name,
    sets: item.sets,
    reps: item.reps,
    ...(item.weightDescriptor ? { weightDescriptor: item.weightDescriptor } : {}),
  };
}
