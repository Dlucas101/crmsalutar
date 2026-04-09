
-- =============================================
-- FASE 1: CORREÇÕES CRÍTICAS
-- =============================================

-- 1. VISITS: public → authenticated
DROP POLICY IF EXISTS "visits_select" ON public.visits;
DROP POLICY IF EXISTS "visits_insert" ON public.visits;
DROP POLICY IF EXISTS "visits_update" ON public.visits;
DROP POLICY IF EXISTS "visits_delete" ON public.visits;

CREATE POLICY "visits_select" ON public.visits FOR SELECT TO authenticated USING (true);
CREATE POLICY "visits_insert" ON public.visits FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "visits_update" ON public.visits FOR UPDATE TO authenticated USING (true);
CREATE POLICY "visits_delete" ON public.visits FOR DELETE TO authenticated USING (public.is_admin_or_gestor(auth.uid()) OR member_id = auth.uid());

-- 2. USER_ROLES: restringir escrita a admin/gestor
DROP POLICY IF EXISTS "user_roles_all" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view roles" ON public.user_roles;

CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_roles_insert" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_gestor(auth.uid()));
CREATE POLICY "user_roles_update" ON public.user_roles FOR UPDATE TO authenticated USING (public.is_admin_or_gestor(auth.uid()));
CREATE POLICY "user_roles_delete" ON public.user_roles FOR DELETE TO authenticated USING (public.is_admin_or_gestor(auth.uid()));

-- 3. NOTIFICATIONS: restringir por user_id
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;

CREATE POLICY "notifications_select" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 4. PROFILES: restringir UPDATE ao próprio ou admin/gestor
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;

CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id OR public.is_admin_or_gestor(auth.uid()));

-- =============================================
-- FASE 2: RESTRIÇÕES POR ROLE NAS TABELAS DE DADOS
-- =============================================

-- LEADS
DROP POLICY IF EXISTS "leads_insert" ON public.leads;
DROP POLICY IF EXISTS "leads_update" ON public.leads;
DROP POLICY IF EXISTS "leads_delete" ON public.leads;

CREATE POLICY "leads_insert" ON public.leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "leads_update" ON public.leads FOR UPDATE TO authenticated USING (public.is_admin_or_gestor(auth.uid()) OR responsible_id = auth.uid() OR assigned_user_id = auth.uid());
CREATE POLICY "leads_delete" ON public.leads FOR DELETE TO authenticated USING (public.is_admin_or_gestor(auth.uid()));

-- CLIENTS
DROP POLICY IF EXISTS "clients_insert" ON public.clients;
DROP POLICY IF EXISTS "clients_update" ON public.clients;
DROP POLICY IF EXISTS "clients_delete" ON public.clients;

CREATE POLICY "clients_insert" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "clients_update" ON public.clients FOR UPDATE TO authenticated USING (public.is_admin_or_gestor(auth.uid()) OR responsavel_id = auth.uid());
CREATE POLICY "clients_delete" ON public.clients FOR DELETE TO authenticated USING (public.is_admin_or_gestor(auth.uid()));

-- TASKS
DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;

CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE TO authenticated USING (public.is_admin_or_gestor(auth.uid()) OR assigned_user_id = auth.uid());
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE TO authenticated USING (public.is_admin_or_gestor(auth.uid()));

-- MENSALIDADES
DROP POLICY IF EXISTS "mensalidades_insert" ON public.mensalidades;
DROP POLICY IF EXISTS "mensalidades_update" ON public.mensalidades;
DROP POLICY IF EXISTS "mensalidades_delete" ON public.mensalidades;

CREATE POLICY "mensalidades_insert" ON public.mensalidades FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_gestor(auth.uid()));
CREATE POLICY "mensalidades_update" ON public.mensalidades FOR UPDATE TO authenticated USING (public.is_admin_or_gestor(auth.uid()));
CREATE POLICY "mensalidades_delete" ON public.mensalidades FOR DELETE TO authenticated USING (public.is_admin_or_gestor(auth.uid()));

-- PROJECTS
DROP POLICY IF EXISTS "projects_insert" ON public.projects;
DROP POLICY IF EXISTS "projects_update" ON public.projects;
DROP POLICY IF EXISTS "projects_delete" ON public.projects;

CREATE POLICY "projects_insert" ON public.projects FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_gestor(auth.uid()));
CREATE POLICY "projects_update" ON public.projects FOR UPDATE TO authenticated USING (public.is_admin_or_gestor(auth.uid()));
CREATE POLICY "projects_delete" ON public.projects FOR DELETE TO authenticated USING (public.is_admin_or_gestor(auth.uid()));

-- CUSTOM_ROLES
DROP POLICY IF EXISTS "custom_roles_all" ON public.custom_roles;

CREATE POLICY "custom_roles_insert" ON public.custom_roles FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_gestor(auth.uid()));
CREATE POLICY "custom_roles_update" ON public.custom_roles FOR UPDATE TO authenticated USING (public.is_admin_or_gestor(auth.uid()));
CREATE POLICY "custom_roles_delete" ON public.custom_roles FOR DELETE TO authenticated USING (public.is_admin_or_gestor(auth.uid()));
