-- Reset password for biswa@unitortechnology.com to Pratihari@2026
UPDATE auth.users
SET encrypted_password = crypt('Pratihari@2026', gen_salt('bf'))
WHERE email = 'biswa@unitortechnology.com';