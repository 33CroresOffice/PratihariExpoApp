/*
  # Decouple sebayat id from auth.users

  ## Problem
  The sebayats.id column was a direct foreign key to auth.users.id with no default,
  meaning admin-created profiles (where no auth user exists yet) would fail with a
  null constraint violation.

  ## Changes

  ### Modified: `sebayats` table
  - Drop the FK constraint linking `id → auth.users(id)`
  - Add `DEFAULT gen_random_uuid()` to the `id` column so admin-created rows get a random UUID
  - Add nullable `auth_user_id` (uuid) column — used to link to auth.users once the sebayat registers via phone
  - Add unique index on `auth_user_id` (when not null)

  ### Notes
  - Existing rows already have UUIDs matching auth.users.id; they will still work
  - When a sebayat registers via phone OTP and creates an auth account, the backend
    should update `auth_user_id = auth.uid()` on their sebayat row
  - RLS policies that relied on `id = auth.uid()` are updated to also check `auth_user_id = auth.uid()`
*/

-- 1. Drop the FK constraint from id → auth.users
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'sebayats' AND constraint_name = 'sebayats_id_fkey'
  ) THEN
    ALTER TABLE sebayats DROP CONSTRAINT sebayats_id_fkey;
  END IF;
END $$;

-- 2. Add default to the id column so new inserts without id get a generated UUID
ALTER TABLE sebayats ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 3. Add auth_user_id column to link to the auth account (nullable for admin-created profiles)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayats' AND column_name = 'auth_user_id'
  ) THEN
    ALTER TABLE sebayats ADD COLUMN auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. For existing rows that were created by self-registration (id = auth user id),
--    backfill auth_user_id with id (best effort — only works if auth user still exists)
UPDATE sebayats SET auth_user_id = id
WHERE auth_user_id IS NULL
  AND EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = sebayats.id);

-- 5. Unique index on auth_user_id (only one sebayat profile per auth account)
CREATE UNIQUE INDEX IF NOT EXISTS sebayats_auth_user_id_unique ON sebayats(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- 6. Index for lookup by auth_user_id
CREATE INDEX IF NOT EXISTS sebayats_auth_user_id_idx ON sebayats(auth_user_id);

-- 7. Update RLS policies to use auth_user_id OR id for self-access
-- Drop old self-access policies that used id = auth.uid()
DROP POLICY IF EXISTS "Sebayats can read own profile" ON sebayats;
DROP POLICY IF EXISTS "Sebayats can update own profile" ON sebayats;
DROP POLICY IF EXISTS "Sebayats can insert own profile" ON sebayats;

-- Recreate with auth_user_id check
CREATE POLICY "Sebayats can read own profile"
  ON sebayats FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid() OR id = auth.uid());

CREATE POLICY "Sebayats can update own profile"
  ON sebayats FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid() OR id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid() OR id = auth.uid());
