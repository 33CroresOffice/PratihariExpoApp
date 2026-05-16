/*
  # Add is_super_admin flag to pratihari_admins

  ## Changes
  - Adds `is_super_admin` boolean column (default false) to `pratihari_admins`
  - Super admins get access to the Settings page (cycle anchor configuration)
  - The biswa admin account (added_by IS NULL, first record) is set as super admin
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pratihari_admins' AND column_name = 'is_super_admin'
  ) THEN
    ALTER TABLE pratihari_admins ADD COLUMN is_super_admin boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Mark the first admin (biswa/system account with no added_by) as super admin
UPDATE pratihari_admins
SET is_super_admin = true
WHERE added_by IS NULL;
