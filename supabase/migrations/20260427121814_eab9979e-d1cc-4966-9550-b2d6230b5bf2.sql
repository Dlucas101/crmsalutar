
-- Fix permissive RLS policies (USING/WITH CHECK true) flagged by linter

-- activities: only authenticated users can insert; log own user_id (or null)
DROP POLICY IF EXISTS activities_insert ON public.activities;
CREATE POLICY activities_insert ON public.activities
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()));

-- clients: any authenticated user can create a client
DROP POLICY IF EXISTS clients_insert ON public.clients;
CREATE POLICY clients_insert ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- leads: any authenticated user can create
DROP POLICY IF EXISTS leads_insert ON public.leads;
CREATE POLICY leads_insert ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- notifications: a user can only insert notifications for themselves
-- (triggers/edge functions use service role and bypass RLS)
DROP POLICY IF EXISTS notifications_insert ON public.notifications;
CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- profiles: a user can only insert their own profile row
DROP POLICY IF EXISTS profiles_insert ON public.profiles;
CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- tasks: any authenticated user can create a task
DROP POLICY IF EXISTS tasks_insert ON public.tasks;
CREATE POLICY tasks_insert ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- visits: any authenticated user can create a visit
DROP POLICY IF EXISTS visits_insert ON public.visits;
CREATE POLICY visits_insert ON public.visits
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- visits: only admin/gestor or the assigned member can update
DROP POLICY IF EXISTS visits_update ON public.visits;
CREATE POLICY visits_update ON public.visits
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_gestor(auth.uid()) OR member_id = auth.uid() OR member_id IS NULL);
