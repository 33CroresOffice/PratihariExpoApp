/*
  # Add change_section to sebayats

  Stores which registration step the admin wants the user to navigate
  to when changes are requested. Values match step indices:
    - 'contact'   → step 0
    - 'personal'  → step 1 (Personal / Profile)
    - 'seba'      → step 2 (Seba Details)
    - 'family'    → step 3
    - 'address'   → step 4
    - 'documents' → step 5
  NULL means no specific step (default to step 0).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayats' AND column_name = 'change_section'
  ) THEN
    ALTER TABLE sebayats ADD COLUMN change_section text;
  END IF;
END $$;
