
-- Leads: restrict SELECT
DROP POLICY IF EXISTS leads_select ON public.leads;
CREATE POLICY leads_select ON public.leads
FOR SELECT TO authenticated
USING (
  public.is_admin_or_gestor(auth.uid())
  OR responsible_id = auth.uid()
  OR assigned_user_id = auth.uid()
);

-- Clients: restrict SELECT
DROP POLICY IF EXISTS clients_select ON public.clients;
CREATE POLICY clients_select ON public.clients
FOR SELECT TO authenticated
USING (
  public.is_admin_or_gestor(auth.uid())
  OR responsavel_id = auth.uid()
);

-- Notifications: allow user to delete own
CREATE POLICY notifications_delete ON public.notifications
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Storage: tighten contratos-gerados bucket
DROP POLICY IF EXISTS "Authenticated users can read generated contracts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload generated contracts" ON storage.objects;

CREATE POLICY "contratos_gerados_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'contratos-gerados'
  AND (
    public.is_admin_or_gestor(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.generated_contracts gc
      WHERE gc.file_path = storage.objects.name
        AND gc.generated_by = auth.uid()
    )
  )
);

CREATE POLICY "contratos_gerados_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'contratos-gerados'
  AND public.is_admin_or_gestor(auth.uid())
);

CREATE POLICY "contratos_gerados_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'contratos-gerados'
  AND public.is_admin_or_gestor(auth.uid())
);
