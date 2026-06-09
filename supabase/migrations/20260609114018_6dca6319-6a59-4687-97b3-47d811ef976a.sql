
REVOKE EXECUTE ON FUNCTION public.calc_faixa_atingida(integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_valor_premiacao_vigente(integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recalc_premiacao(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.refresh_apuracao_aberta(integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.close_apuracao(integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ensure_premiacao(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trg_client_premiacao() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trg_mensalidade_libera_parcela() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trg_lead_won_premiacao() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.calc_faixa_atingida(integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_valor_premiacao_vigente(integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalc_premiacao(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_apuracao_aberta(integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.close_apuracao(integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_premiacao(uuid) TO authenticated, service_role;
