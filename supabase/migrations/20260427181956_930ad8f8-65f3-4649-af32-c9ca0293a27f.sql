-- Restore EXECUTE on trigger functions for authenticated role.
-- These functions are only invoked by triggers, but Postgres still checks
-- EXECUTE privilege against the role performing the underlying DML.
GRANT EXECUTE ON FUNCTION public.handle_lead_ganho() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_lead_novo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_lead_won_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_lead_won_at_insert() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;