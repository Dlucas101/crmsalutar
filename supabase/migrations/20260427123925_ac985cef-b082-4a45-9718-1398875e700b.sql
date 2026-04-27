-- Hardening: revoke EXECUTE from authenticated for SECURITY DEFINER role-check functions.
-- These functions are intended to be called only inside RLS policies (server-side),
-- not directly from client code. Revoking EXECUTE prevents signed-in users from invoking
-- them via the exposed PostgREST API.

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_gestor(uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM authenticated, anon, public;

-- Ensure service_role and postgres keep access.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_or_gestor(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO service_role;