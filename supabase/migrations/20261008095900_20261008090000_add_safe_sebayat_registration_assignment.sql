/*
# Add safe PN registration assignment for Sebayat approvals

1. Purpose
- Replace the old year-based automatic registration numbering with the PN-101 onward sequence.
- Keep manual registration numbers available for special or VIP cases.
- Make approval and automatic number assignment atomic so concurrent approvals cannot receive the same number.

2. Modified behavior
- Blank registration input assigns the first available sequential number beginning at PN-101.
- A manually entered value such as PN-001 is preserved after validation.
- Existing registration numbers on a Sebayat are preserved when an approval is repeated after resubmission unless an administrator explicitly enters a replacement.
- Existing historical registration values are not rewritten.

3. Security
- Adds a SECURITY DEFINER function callable only by authenticated Pratihari administrators.
- The function derives the approving administrator from auth.uid(), validates the target application status, validates registration-number format, checks uniqueness, and records the review history.
- The function uses a transaction-scoped advisory lock so simultaneous approvals receive different numbers.
- The function uses a fixed public search_path and does not grant access to anon.

4. Important notes
- The frontend must call this function for approvals instead of calculating registration numbers in the browser.
- The function returns the final registration number assigned to the approved Sebayat.
*/

CREATE OR REPLACE FUNCTION public.approve_sebayat_with_registration(
  p_sebayat_id uuid,
  p_registration_no text DEFAULT NULL,
  p_admin_remarks text DEFAULT ''
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sebayat sebayats%ROWTYPE;
  v_registration_no text;
  v_candidate integer;
  v_manual text := NULLIF(upper(trim(coalesce(p_registration_no, ''))), '');
  v_remarks text := coalesce(p_admin_remarks, '');
BEGIN
  IF NOT is_pratihari_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('sebayat_registration_no', 0));

  SELECT * INTO v_sebayat
  FROM sebayats
  WHERE id = p_sebayat_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sebayat not found';
  END IF;

  IF v_sebayat.profile_status NOT IN ('submitted', 'resubmitted', 'under_review') THEN
    RAISE EXCEPTION 'Sebayat is not awaiting approval';
  END IF;

  IF v_manual IS NOT NULL THEN
    IF v_manual !~ '^PN-[0-9]+$' THEN
      RAISE EXCEPTION 'Invalid registration number';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM sebayats
      WHERE registration_no = v_manual
        AND id <> p_sebayat_id
    ) THEN
      RAISE EXCEPTION 'Registration number already exists';
    END IF;

    v_registration_no := v_manual;
  ELSIF NULLIF(trim(coalesce(v_sebayat.registration_no, '')), '') IS NOT NULL THEN
    v_registration_no := trim(v_sebayat.registration_no);
  ELSE
    SELECT coalesce(max((substring(registration_no from '^PN-([0-9]+)$'))::integer), 100) + 1
    INTO v_candidate
    FROM sebayats
    WHERE registration_no ~ '^PN-[0-9]+$'
      AND (substring(registration_no from '^PN-([0-9]+)$'))::integer >= 101;

    v_registration_no := 'PN-' || v_candidate::text;

    WHILE EXISTS (SELECT 1 FROM sebayats WHERE registration_no = v_registration_no) LOOP
      v_candidate := v_candidate + 1;
      v_registration_no := 'PN-' || v_candidate::text;
    END LOOP;
  END IF;

  UPDATE sebayats
  SET profile_status = 'approved',
      registration_no = v_registration_no,
      admin_remarks = v_remarks,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  WHERE id = p_sebayat_id;

  INSERT INTO profile_review_history (
    sebayat_id,
    from_status,
    to_status,
    remarks,
    changed_by
  ) VALUES (
    p_sebayat_id,
    v_sebayat.profile_status,
    'approved',
    v_remarks,
    auth.uid()
  );

  RETURN v_registration_no;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_sebayat_with_registration(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_sebayat_with_registration(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_sebayat_with_registration(uuid, text, text) TO authenticated;