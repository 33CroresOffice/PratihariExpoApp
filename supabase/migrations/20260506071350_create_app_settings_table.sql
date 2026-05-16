/*
  # Create app_settings table for system configuration

  1. New Tables
    - `app_settings`
      - `key` (text, primary key) - setting identifier
      - `value` (jsonb) - setting value (flexible type)
      - `updated_at` (timestamp)
      - `updated_by` (uuid, FK to auth.users)

  2. Initial Data
    - otp_sms_enabled: true (SMS OTP channel enabled by default)
    - otp_whatsapp_enabled: true (WhatsApp OTP channel enabled by default)

  3. Security
    - Enable RLS
    - Authenticated admins can read all settings
    - Only super admins can update settings
*/

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT 'null'::jsonb,
  description text DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Any authenticated admin can read settings
CREATE POLICY "Admins can read app settings"
  ON app_settings FOR SELECT
  TO authenticated
  USING (public.is_pratihari_admin(auth.uid()));

-- Only super admins can update settings
CREATE POLICY "Super admins can update app settings"
  ON app_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid() AND is_super_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid() AND is_super_admin = true)
  );

-- Only super admins can insert settings
CREATE POLICY "Super admins can insert app settings"
  ON app_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid() AND is_super_admin = true)
  );

-- Seed default OTP channel settings
INSERT INTO app_settings (key, value, description) VALUES
  ('otp_sms_enabled', 'true'::jsonb, 'Allow users to receive OTP via SMS'),
  ('otp_whatsapp_enabled', 'true'::jsonb, 'Allow users to receive OTP via WhatsApp')
ON CONFLICT (key) DO NOTHING;
