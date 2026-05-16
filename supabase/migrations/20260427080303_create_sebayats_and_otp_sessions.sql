/*
  # Create sebayats table and OTP sessions

  1. New Tables
    - `sebayats` - Stores sebayat (servitor) profiles linked to Supabase Auth users
      - `id` (uuid, primary key, references auth.users)
      - `phone` (text, unique, not null) - Phone number with country code e.g. 919876543210
      - `name` (text) - Full name of the sebayat
      - `role` (text, default 'member') - Role within the Nijog (member, admin, nayak)
      - `is_active` (boolean, default true) - Whether the sebayat is currently active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `otp_sessions` - Tracks OTP send/verify attempts for rate limiting and auditing
      - `id` (uuid, primary key)
      - `phone` (text, not null) - Phone number the OTP was sent to
      - `request_id` (text) - MSG91 request ID returned on send
      - `verified` (boolean, default false) - Whether OTP was successfully verified
      - `channel` (text, default 'sms') - Delivery channel: sms or whatsapp
      - `expires_at` (timestamptz) - When the OTP expires
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - sebayats: authenticated users can read their own profile, update their own profile
    - otp_sessions: no direct client access (managed by edge functions using service role)
*/

-- Sebayats table
CREATE TABLE IF NOT EXISTS sebayats (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text UNIQUE NOT NULL,
  name text DEFAULT '',
  role text NOT NULL DEFAULT 'member',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sebayats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sebayats can read own profile"
  ON sebayats
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Sebayats can update own profile"
  ON sebayats
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- OTP sessions table (managed by edge functions only, no client access)
CREATE TABLE IF NOT EXISTS otp_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  request_id text DEFAULT '',
  verified boolean NOT NULL DEFAULT false,
  channel text NOT NULL DEFAULT 'sms',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE otp_sessions ENABLE ROW LEVEL SECURITY;

-- No RLS policies = no client access. Only service_role can read/write.
