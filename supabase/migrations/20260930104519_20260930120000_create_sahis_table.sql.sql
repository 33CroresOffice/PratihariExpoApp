CREATE TABLE public.sahis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_or text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sahis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_active_sahis_public"
  ON public.sahis FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "select_all_sahis_admin"
  ON public.sahis FOR SELECT
  TO authenticated
  USING (public.is_pratihari_admin(auth.uid()));

CREATE POLICY "insert_sahis_admin"
  ON public.sahis FOR INSERT
  TO authenticated
  WITH CHECK (public.is_pratihari_admin(auth.uid()));

CREATE POLICY "update_sahis_admin"
  ON public.sahis FOR UPDATE
  TO authenticated
  USING (public.is_pratihari_admin(auth.uid()))
  WITH CHECK (public.is_pratihari_admin(auth.uid()));

CREATE POLICY "delete_sahis_admin"
  ON public.sahis FOR DELETE
  TO authenticated
  USING (public.is_pratihari_admin(auth.uid()));

CREATE UNIQUE INDEX sahis_name_unique ON public.sahis (lower(trim(name)));
CREATE INDEX sahis_active_sort ON public.sahis (is_active, sort_order, name);
