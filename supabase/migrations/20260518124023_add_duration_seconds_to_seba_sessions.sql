/*
  # Add duration_seconds to seba_sessions

  1. Changes
    - `seba_sessions` table: add `duration_seconds` (integer, nullable)
      Stores the total session duration in whole seconds for sub-minute precision.
      Existing rows will have NULL; future sessions will populate this alongside
      the existing `duration_minutes` column.

  2. Notes
    - `duration_minutes` is kept for backwards compatibility.
    - `duration_seconds` gives exact precision so history can show "45s" instead of "0m".
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seba_sessions' AND column_name = 'duration_seconds'
  ) THEN
    ALTER TABLE seba_sessions ADD COLUMN duration_seconds integer;
  END IF;
END $$;
