/*
  # Allow admins to read all identity documents

  ## Problem
  The Documents tab in the admin sebayat drawer showed "No documents uploaded" even
  when documents existed. The identity_documents table only had a SELECT policy for
  sebayats viewing their own rows (sebayat_id = auth.uid()). Admins authenticated with
  their own uid could not read any other sebayat's documents.

  ## Change
  - Add SELECT policy "Admins can view all identity documents" so any authenticated
    pratihari admin can read every row in identity_documents.

  ## Security
  - Uses the existing public.is_pratihari_admin() helper — same pattern used across
    all other admin-readable tables (seba_roster, seba_categories, sebayat_seba_selections, etc.)
  - Sebayats still cannot read each other's documents (existing own-row policy unchanged)
*/

CREATE POLICY "Admins can view all identity documents"
  ON identity_documents FOR SELECT
  TO authenticated
  USING (public.is_pratihari_admin(auth.uid()));
