DROP POLICY IF EXISTS trigger_audit_select_admin ON public.trigger_audit;

CREATE POLICY trigger_audit_select_admin
ON public.trigger_audit
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));