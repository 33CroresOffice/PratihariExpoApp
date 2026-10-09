/*
# Create dev team accounts for sidhanta.rout@33crores.com and prangya.mohapatra@33crores.com

1. What this does
- Creates two new email/password login accounts in the authentication system:
  - sidhanta.rout@33crores.com
  - prangya.mohapatra@33crores.com
- Sets the password for both: QWEQAZ@123
- Registers both users in the `pratihari_admins` table so they are recognized as
  dev team admins (required for testing page access, admin dashboard, and the
  test case result tables).

2. New rows
- Two rows in `auth.users` (the built-in authentication user list).
- One matching row in `auth.identities` per user (required for email login to work).
- Two rows in `pratihari_admins`.

3. Security
- No schema changes, no RLS changes. Rows are created idempotently: if an account
  already exists, its password is updated instead of failing or duplicating.
- Passwords are stored only as bcrypt hashes, never in plain text.

4. Important notes
- Email confirmation is off, so both accounts can log in immediately.
- Both accounts follow the same pattern as the existing biswa@unitortechnology.com
  admin account, including the required identity record and non-null token fields
  that manual inserts otherwise miss.
*/

DO $$
DECLARE
  sidhanta_id uuid;
  prangya_id uuid;
BEGIN
  -- ── Account 1: sidhanta.rout@33crores.com ──────────────────────────────
  SELECT id INTO sidhanta_id FROM auth.users WHERE email = 'sidhanta.rout@33crores.com';
  IF sidhanta_id IS NULL THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, aud, role,
      is_sso_user, is_anonymous,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token,
      reauthentication_token, email_change_confirm_status,
      created_at, updated_at
    )
    VALUES (
      gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
      'sidhanta.rout@33crores.com',
      crypt('QWEQAZ@123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}', '{}',
      'authenticated', 'authenticated',
      false, false,
      '', '', '', '',
      '', '', '',
      '', 0,
      now(), now()
    )
    RETURNING id INTO sidhanta_id;
  ELSE
    UPDATE auth.users
    SET encrypted_password = crypt('QWEQAZ@123', gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = sidhanta_id;
  END IF;

  -- ── Account 2: prangya.mohapatra@33crores.com ──────────────────────────
  SELECT id INTO prangya_id FROM auth.users WHERE email = 'prangya.mohapatra@33crores.com';
  IF prangya_id IS NULL THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, aud, role,
      is_sso_user, is_anonymous,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token,
      reauthentication_token, email_change_confirm_status,
      created_at, updated_at
    )
    VALUES (
      gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
      'prangya.mohapatra@33crores.com',
      crypt('QWEQAZ@123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}', '{}',
      'authenticated', 'authenticated',
      false, false,
      '', '', '', '',
      '', '', '',
      '', 0,
      now(), now()
    )
    RETURNING id INTO prangya_id;
  ELSE
    UPDATE auth.users
    SET encrypted_password = crypt('QWEQAZ@123', gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = prangya_id;
  END IF;

  -- ── Email identities (required for email/password sign-in) ─────────────
  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  SELECT gen_random_uuid(), u.id,
         jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
         'email', u.id::text, now(), now(), now()
  FROM auth.users u
  WHERE u.email IN ('sidhanta.rout@33crores.com', 'prangya.mohapatra@33crores.com')
    AND NOT EXISTS (
      SELECT 1 FROM auth.identities i
      WHERE i.provider = 'email' AND i.provider_id = u.id::text
    );

  -- ── Register both as dev team admins ────────────────────────────────────
  INSERT INTO pratihari_admins (user_id)
  VALUES (sidhanta_id), (prangya_id)
  ON CONFLICT (user_id) DO NOTHING;
END $$;
