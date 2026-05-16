/*
  # Allow public read access to OTP channel settings

  The login screen is unauthenticated, so it cannot read app_settings
  under the existing authenticated-only policy. We add a narrow public
  SELECT policy restricted to only the two OTP toggle keys so the login
  screen can hide disabled channels without exposing other settings.
*/

CREATE POLICY "Public can read OTP channel settings"
  ON app_settings FOR SELECT
  TO anon
  USING (key IN ('otp_sms_enabled', 'otp_whatsapp_enabled'));
