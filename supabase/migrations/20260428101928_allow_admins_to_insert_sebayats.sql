/*
  # Allow admins to insert sebayat profiles

  1. Changes
    - Add INSERT policy on `sebayats` for pratihari admins so they can create profiles on behalf of sebayats
    - Also add INSERT policy on `identity_documents` for admins (same reason)
*/

CREATE POLICY "Admins can insert sebayat profiles"
  ON sebayats
  FOR INSERT
  TO authenticated
  WITH CHECK (is_pratihari_admin(auth.uid()));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'identity_documents' AND policyname = 'Admins can insert identity documents'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admins can insert identity documents"
        ON identity_documents
        FOR INSERT
        TO authenticated
        WITH CHECK (is_pratihari_admin(auth.uid()))
    $policy$;
  END IF;
END $$;
