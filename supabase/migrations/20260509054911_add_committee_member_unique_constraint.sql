/*
  # Add unique constraint to committee_members

  1. Removes duplicate committee member rows (same sebayat_id + role in same committee),
     keeping only the most recently created one (highest id lexicographically).
  2. Adds a partial unique index on (committee_id, sebayat_id, role) WHERE sebayat_id IS NOT NULL
     to prevent future duplicates at the database level.
*/

-- Remove duplicates: keep only the row with the max id per (committee_id, sebayat_id, role)
DELETE FROM committee_members
WHERE id NOT IN (
  SELECT DISTINCT ON (committee_id, sebayat_id, role) id
  FROM committee_members
  WHERE sebayat_id IS NOT NULL
  ORDER BY committee_id, sebayat_id, role, id DESC
)
AND sebayat_id IS NOT NULL;

-- Now add the unique partial index
CREATE UNIQUE INDEX IF NOT EXISTS committee_members_sebayat_role_unique
  ON committee_members (committee_id, sebayat_id, role)
  WHERE sebayat_id IS NOT NULL;
