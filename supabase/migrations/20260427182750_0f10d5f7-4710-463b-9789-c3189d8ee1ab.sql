CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(_user_id = auth.uid(), false)
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    )
$function$;

CREATE OR REPLACE FUNCTION public.is_admin_or_gestor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(_user_id = auth.uid(), false)
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role IN ('admin', 'gestor')
    )
$function$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
    AND _user_id = auth.uid()
  LIMIT 1
$function$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_gestor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_gestor(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon, public;

REVOKE EXECUTE ON FUNCTION public.handle_lead_ganho() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_lead_novo() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_lead_won_at() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_lead_won_at_insert() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.record_trigger_audit(text, text, text, text, uuid, uuid, text, text, boolean, text, text, jsonb) FROM anon, authenticated, public;

GRANT EXECUTE ON FUNCTION public.handle_lead_ganho() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_lead_novo() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_lead_won_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_lead_won_at_insert() TO service_role;
GRANT EXECUTE ON FUNCTION public.record_trigger_audit(text, text, text, text, uuid, uuid, text, text, boolean, text, text, jsonb) TO service_role;