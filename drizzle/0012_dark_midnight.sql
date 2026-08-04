-- Resolve any pre-existing duplicate (owner, lower(name)) BEFORE enforcing
-- uniqueness, so the index can build on a DB that already has duplicates.
-- Non-destructive: keep the earliest-created unit, suffix the rest ("(2)", …).
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY owner_user_id, lower(name)
           ORDER BY created_at, id
         ) AS rn
  FROM units
)
UPDATE units u
SET name = u.name || ' (' || r.rn || ')',
    updated_at = now()
FROM ranked r
WHERE u.id = r.id
  AND r.rn > 1;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "units_owner_name_unique" ON "units" USING btree ("owner_user_id",lower("name"));
