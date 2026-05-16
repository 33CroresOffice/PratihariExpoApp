/*
  # Add beddha_number to seba_sessions

  Stores the specific beddha number that was active when the sebayat
  started a session, so history can display exactly which beddha was served.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seba_sessions' AND column_name = 'beddha_number'
  ) THEN
    ALTER TABLE seba_sessions ADD COLUMN beddha_number integer;
  END IF;
END $$;
