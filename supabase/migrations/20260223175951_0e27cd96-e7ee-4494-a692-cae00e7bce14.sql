-- Tighten INSERT policies to require authenticated user context

-- Leads: only vendas, admin, gestor can create
DROP POLICY "Authenticated users can create leads" ON public.leads;
CREATE POLICY "Authorized users can create leads"
  ON public.leads FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'gestor') OR 
    public.has_role(auth.uid(), 'vendas')
  );

-- Clients: only admin/gestor can create
DROP POLICY "Authenticated users can insert clients" ON public.clients;
CREATE POLICY "Admins gestores can insert clients"
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_gestor(auth.uid()));

-- Projects: only admin/gestor can create
DROP POLICY "Authenticated users can insert projects" ON public.projects;
CREATE POLICY "Admins gestores can insert projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_gestor(auth.uid()));

-- Tasks: admin/gestor/assigned can create
DROP POLICY "Authenticated users can create tasks" ON public.tasks;
CREATE POLICY "Authorized users can create tasks"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_gestor(auth.uid()) OR assigned_user_id = auth.uid());

-- Activities: keep permissive (system logging)
-- Notifications: keep permissive (system creates for any user)