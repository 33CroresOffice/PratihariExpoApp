/*
  # Fix biswa@unitortechnology.com auth user required fields

  The manually inserted user was missing required non-null fields:
  - is_sso_user (must be false for email/password users)
  - is_anonymous (must be false for real accounts)
  - confirmation_token, recovery_token, and other token fields need empty string defaults

  Also ensures all token fields have proper empty string values as Supabase expects.
*/

UPDATE auth.users
SET
  is_sso_user = false,
  is_anonymous = false,
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  reauthentication_token = COALESCE(reauthentication_token, ''),
  email_change_confirm_status = COALESCE(email_change_confirm_status, 0),
  updated_at = now()
WHERE email = 'biswa@unitortechnology.com';
