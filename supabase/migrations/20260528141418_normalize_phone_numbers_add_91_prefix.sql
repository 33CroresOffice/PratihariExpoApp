/*
  # Normalize phone numbers to include India country code (91 prefix)

  ## Problem
  The mobile app prepends "91" to all phone numbers before calling the OTP edge
  functions (e.g. user enters 9090909090 → app sends 919090909090). The verify-otp
  function queries sebayats by this 12-digit number. However, sebayats created via
  the admin "Add Profile" flow were stored as raw 10-digit numbers (e.g. 9090909090),
  causing the lookup to fail and showing "Continue Registration" to approved users.

  ## Changes

  ### sebayats.phone
  - Prepend "91" to all phone values that are exactly 10 digits
  - Skips rows where the 91-prefixed version would conflict with an existing row
    (those rows are already normalized)

  ### sebayats.primary_phone / whatsapp_number
  - Same normalization for bare 10-digit values

  ### Backfill primary_phone
  - Copy phone → primary_phone for rows where primary_phone is empty/null

  ## Notes
  - Safe against the unique constraint on phone: skips any 10-digit row whose
    91-prefixed counterpart already exists in the table
  - Idempotent: regex guard prevents double-prefixing
*/

-- Normalize phone: prepend 91 to bare 10-digit numbers,
-- skipping rows where the prefixed version already exists (already normalized)
UPDATE sebayats s
SET phone = '91' || s.phone
WHERE s.phone ~ '^\d{10}$'
  AND NOT EXISTS (
    SELECT 1 FROM sebayats other
    WHERE other.phone = '91' || s.phone
      AND other.id != s.id
  );

-- Normalize whatsapp_number: prepend 91 to bare 10-digit numbers
UPDATE sebayats
SET whatsapp_number = '91' || whatsapp_number
WHERE whatsapp_number ~ '^\d{10}$';

-- Normalize primary_phone: prepend 91 to bare 10-digit numbers
UPDATE sebayats
SET primary_phone = '91' || primary_phone
WHERE primary_phone ~ '^\d{10}$';

-- Backfill primary_phone from phone where primary_phone is empty/null
UPDATE sebayats
SET primary_phone = phone
WHERE (primary_phone IS NULL OR primary_phone = '')
  AND phone IS NOT NULL
  AND phone != '';
