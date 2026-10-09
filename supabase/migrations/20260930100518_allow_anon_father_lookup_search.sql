/*
# Allow anonymous father lookup during registration

## Problem
The FatherSearchField on the registration page queries the `sebayats` table
to find a registered father by name or alias. However, the registration page
is accessed by unauthenticated users (before they have an account). The existing
SELECT policy "Authenticated users can search sebayats for father lookup" is
scoped to `TO authenticated` only, so an anonymous user gets zero rows — the
search appears broken even though the query and `alias_name` column are correct.

## Fix
Add a new SELECT policy `TO anon, authenticated` that allows reading the
search-relevant columns (`id, full_name, first_name, last_name, alias_name,
date_of_birth, profile_status`) for rows in submitted/resubmitted/approved
status. Narrow the anon role's column-level SELECT grant to only those columns
so anonymous users cannot read sensitive data (phone, email, address, etc.).

## Security
- anon SELECT is restricted to 7 non-sensitive columns only.
- The policy predicate is `true` (matching the existing authenticated lookup
  policy), but the column grant ensures anon can only read the safe subset.
- authenticated retains its existing table-wide SELECT grant.
*/ 

-- 1. Add anon SELECT policy for father lookup (matches existing authenticated one)
DROP POLICY IF EXISTS "Anon can search sebayats for father lookup" ON sebayats;
CREATE POLICY "Anon can search sebayats for father lookup"
ON sebayats FOR SELECT
TO anon
USING (profile_status IN ('submitted', 'resubmitted', 'approved'));

-- 2. Narrow anon SELECT to only the non-sensitive columns needed for lookup
REVOKE SELECT ON sebayats FROM anon;
GRANT SELECT (id, full_name, first_name, last_name, alias_name, date_of_birth, profile_status) ON sebayats TO anon;
