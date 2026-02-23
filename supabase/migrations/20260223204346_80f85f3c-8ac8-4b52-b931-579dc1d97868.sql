
-- Fix all RESTRICTIVE policies to be PERMISSIVE

-- LEADS
DROP POLICY IF EXISTS "Admins and gestores can view all leads" ON public.leads;
DROP POLICY IF EXISTS "Assigned users admins gestores can update leads" ON public.leads;
DROP POLICY IF EXISTS "Authorized users can create leads" ON public.leads;
DROP POLICY IF EXISTS "Only admins can delete leads" ON public.leads;

CREATE POLICY "Admins gestores or assigned can view leads" ON public.leads FOR SELECT TO authenticated USING (is_admin_or_gestor(auth.uid()) OR assigned_user_id = auth.uid());
CREATE POLICY "Authorized users can create leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role) OR has_role(auth.uid(), 'vendas'::app_role));
CREATE POLICY "Assigned users admins gestores can update leads" ON public.leads FOR UPDATE TO authenticated USING (is_admin_or_gestor(auth.uid()) OR assigned_user_id = auth.uid());
CREATE POLICY "Only admins can delete leads" ON public.leads FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ACTIVITIES
DROP POLICY IF EXISTS "Admins and gestores can view all activities" ON public.activities;
DROP POLICY IF EXISTS "Authenticated users can insert activities" ON public.activities;

CREATE POLICY "Users can view activities" ON public.activities FOR SELECT TO authenticated USING (is_admin_or_gestor(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "Users can insert activities" ON public.activities FOR INSERT TO authenticated WITH CHECK (true);

-- CLIENTS
DROP POLICY IF EXISTS "Admins and gestores can manage clients" ON public.clients;
DROP POLICY IF EXISTS "Admins gestores can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clients;

CREATE POLICY "Users can view clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins gestores can insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (is_admin_or_gestor(auth.uid()));
CREATE POLICY "Admins gestores can update clients" ON public.clients FOR UPDATE TO authenticated USING (is_admin_or_gestor(auth.uid()));
CREATE POLICY "Admins can delete clients" ON public.clients FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- CUSTOM_ROLES
DROP POLICY IF EXISTS "Admins can insert custom_roles" ON public.custom_roles;
DROP POLICY IF EXISTS "Admins can manage custom_roles" ON public.custom_roles;
DROP POLICY IF EXISTS "Authenticated users can view custom_roles" ON public.custom_roles;

CREATE POLICY "Users can view custom_roles" ON public.custom_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage custom_roles" ON public.custom_roles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- NOTIFICATIONS
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- PROFILES
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Users or admins can update profiles" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- PROJECTS
DROP POLICY IF EXISTS "Admins and gestores can manage projects" ON public.projects;
DROP POLICY IF EXISTS "Admins gestores can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated users can view projects" ON public.projects;

CREATE POLICY "Users can view projects" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins gestores can insert projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (is_admin_or_gestor(auth.uid()));
CREATE POLICY "Admins gestores can update projects" ON public.projects FOR UPDATE TO authenticated USING (is_admin_or_gestor(auth.uid()));
CREATE POLICY "Admins can delete projects" ON public.projects FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- TASKS
DROP POLICY IF EXISTS "Assigned users and admins can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authorized users can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Only admins can delete tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view assigned tasks or admins gestores all" ON public.tasks;

CREATE POLICY "Users can view tasks" ON public.tasks FOR SELECT TO authenticated USING (is_admin_or_gestor(auth.uid()) OR assigned_user_id = auth.uid());
CREATE POLICY "Users can create tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (is_admin_or_gestor(auth.uid()) OR assigned_user_id = auth.uid());
CREATE POLICY "Users can update tasks" ON public.tasks FOR UPDATE TO authenticated USING (is_admin_or_gestor(auth.uid()) OR assigned_user_id = auth.uid());
CREATE POLICY "Admins can delete tasks" ON public.tasks FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- USER_ROLES
DROP POLICY IF EXISTS "Only admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;

CREATE POLICY "Users can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
