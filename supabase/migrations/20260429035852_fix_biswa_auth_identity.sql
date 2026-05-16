/*
  # Fix missing auth identity for biswa@unitortechnology.com

  The auth.identities row was not created when the user was inserted manually,
  causing "Database error querying schema" on login. This adds the required identity record.
*/

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  id,
  jsonb_build_object('sub', id::text, 'email', email),
  'email',
  id::text,
  now(),
  now(),
  now()
FROM auth.users
WHERE email = 'biswa@unitortechnology.com'
  AND NOT EXISTS (
    SELECT 1 FROM auth.identities WHERE user_id = (SELECT id FROM auth.users WHERE email = 'biswa@unitortechnology.com')
  );
