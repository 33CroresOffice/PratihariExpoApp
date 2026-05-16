/*
  # Create admin account for biswa@unitortechnology.com

  1. Creates a new auth user with email/password login
  2. Adds the user to pratihari_admins table
  3. Temporary password: Pratihari@2026 (should be changed after first login)
*/

DO $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Create the auth user with a temporary password
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'biswa@unitortechnology.com',
    crypt('Pratihari@2026', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    'authenticated',
    'authenticated',
    now(),
    now()
  )
  RETURNING id INTO new_user_id;

  -- Add to pratihari_admins
  INSERT INTO pratihari_admins (user_id)
  VALUES (new_user_id);
END $$;
