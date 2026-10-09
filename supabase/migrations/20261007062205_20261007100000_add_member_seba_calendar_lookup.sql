/*
# Add member-wide Seba calendar lookup

1. New database function
- `get_seba_calendar_assignments(start_date, end_date)` returns the assignment details needed by the member calendar.
- Results include the service date, assigned Sebayat name, substitute name when present, Seba/Niti name, group, Beddha number, Nijog status, absence status, and assignment notes.

2. Access rules
- Only authenticated, approved Sebayats can call the function.
- The function does not expose phone numbers, addresses, identity documents, profile photos, or other private member fields.
- The function reads the existing schedule and roster ledgers without changing them.

3. Safety limits
- The requested range must be valid and no longer than 62 days, keeping calendar reads bounded to a month-sized view.
- The caller is checked from the active session using `auth.uid()`; caller-supplied Sebayat IDs are not trusted.

4. Existing tables
- No tables, columns, rows, or policies are removed or changed.
- Existing member and administrator access rules remain in place.
*/

CREATE OR REPLACE FUNCTION public.get_seba_calendar_assignments(
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  assignment_id uuid,
  service_date date,
  sebayat_id uuid,
  sebayat_name text,
  substitute_sebayat_name text,
  seba_name text,
  seba_name_or text,
  group_name text,
  group_name_or text,
  beddha_number integer,
  is_nijog boolean,
  is_absent boolean,
  notes text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sebayats
    WHERE profile_status = 'approved'
      AND (auth_user_id = auth.uid() OR id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL
     OR p_end_date < p_start_date
     OR p_end_date > p_start_date + 62 THEN
    RAISE EXCEPTION 'invalid_date_range';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    s.service_date,
    r.sebayat_id,
    COALESCE(assigned.full_name, 'Unknown Sebayat'),
    substitute.full_name,
    c.name,
    c.name_or,
    g.name,
    g.name_or,
    r.beddha_number,
    EXISTS (
      SELECT 1
      FROM public.nijog_assignments na
      WHERE na.sebayat_id = r.sebayat_id
        AND na.seba_category_id = r.seba_category_id
        AND na.beddha_number = r.beddha_number
        AND na.year = EXTRACT(YEAR FROM s.service_date)::integer
    ),
    r.is_absent,
    r.notes
  FROM public.seba_roster r
  JOIN public.seba_schedule s ON s.id = r.schedule_id
  JOIN public.seba_categories c ON c.id = r.seba_category_id
  JOIN public.seba_groups g ON g.id = c.group_id
  JOIN public.sebayats assigned ON assigned.id = r.sebayat_id
  LEFT JOIN public.sebayats substitute ON substitute.id = r.substitute_sebayat_id
  WHERE s.service_date BETWEEN p_start_date AND p_end_date
  ORDER BY s.service_date, g.name, r.beddha_number, c.sort_order, c.name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_seba_calendar_assignments(date, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_seba_calendar_assignments(date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_seba_calendar_assignments(date, date) TO authenticated;
