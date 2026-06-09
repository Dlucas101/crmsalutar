
-- ============================================================
-- 1. meta_tiers: faixas configuráveis por mês
-- ============================================================
CREATE TABLE public.meta_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_id uuid NOT NULL REFERENCES public.metas(id) ON DELETE CASCADE,
  ordem integer NOT NULL,
  nome text NOT NULL,
  quantidade_minima integer NOT NULL DEFAULT 0,
  valor_por_contrato numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meta_id, ordem)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_tiers TO authenticated;
GRANT ALL ON public.meta_tiers TO service_role;
ALTER TABLE public.meta_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meta_tiers_select_auth" ON public.meta_tiers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "meta_tiers_admin_write" ON public.meta_tiers
  FOR ALL TO authenticated
  USING (public.is_admin_or_gestor(auth.uid()))
  WITH CHECK (public.is_admin_or_gestor(auth.uid()));

CREATE TRIGGER trg_meta_tiers_updated_at
  BEFORE UPDATE ON public.meta_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. meta_apuracao: snapshot do fechamento do mês
-- ============================================================
CREATE TABLE public.meta_apuracao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes integer NOT NULL,
  ano integer NOT NULL,
  faixa_atingida_id uuid REFERENCES public.meta_tiers(id) ON DELETE SET NULL,
  valor_por_contrato_congelado numeric NOT NULL DEFAULT 0,
  total_contratos integer NOT NULL DEFAULT 0,
  fechada_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mes, ano)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_apuracao TO authenticated;
GRANT ALL ON public.meta_apuracao TO service_role;
ALTER TABLE public.meta_apuracao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meta_apuracao_select_auth" ON public.meta_apuracao
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "meta_apuracao_admin_write" ON public.meta_apuracao
  FOR ALL TO authenticated
  USING (public.is_admin_or_gestor(auth.uid()))
  WITH CHECK (public.is_admin_or_gestor(auth.uid()));

CREATE TRIGGER trg_meta_apuracao_updated_at
  BEFORE UPDATE ON public.meta_apuracao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. premiacoes: premiação por contrato
-- ============================================================
CREATE TABLE public.premiacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  mes_referencia integer NOT NULL,
  ano_referencia integer NOT NULL,
  valor_total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','cancelada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.premiacoes TO authenticated;
GRANT ALL ON public.premiacoes TO service_role;
ALTER TABLE public.premiacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "premiacoes_admin_all" ON public.premiacoes
  FOR ALL TO authenticated
  USING (public.is_admin_or_gestor(auth.uid()))
  WITH CHECK (public.is_admin_or_gestor(auth.uid()));
CREATE POLICY "premiacoes_select_own" ON public.premiacoes
  FOR SELECT TO authenticated
  USING (responsavel_id = auth.uid());

CREATE TRIGGER trg_premiacoes_updated_at
  BEFORE UPDATE ON public.premiacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. premiacao_parcelas: 3 parcelas por premiação
-- ============================================================
CREATE TABLE public.premiacao_parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  premiacao_id uuid NOT NULL REFERENCES public.premiacoes(id) ON DELETE CASCADE,
  numero integer NOT NULL CHECK (numero BETWEEN 1 AND 3),
  valor numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','liberada','cancelada')),
  mensalidade_id uuid REFERENCES public.mensalidades(id) ON DELETE SET NULL,
  responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  liberada_em timestamptz,
  ajustada_manualmente boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (premiacao_id, numero)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.premiacao_parcelas TO authenticated;
GRANT ALL ON public.premiacao_parcelas TO service_role;
ALTER TABLE public.premiacao_parcelas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parcelas_admin_all" ON public.premiacao_parcelas
  FOR ALL TO authenticated
  USING (public.is_admin_or_gestor(auth.uid()))
  WITH CHECK (public.is_admin_or_gestor(auth.uid()));
CREATE POLICY "parcelas_select_own" ON public.premiacao_parcelas
  FOR SELECT TO authenticated
  USING (
    responsavel_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.premiacoes p WHERE p.id = premiacao_id AND p.responsavel_id = auth.uid())
  );

CREATE TRIGGER trg_parcelas_updated_at
  BEFORE UPDATE ON public.premiacao_parcelas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_parcelas_premiacao ON public.premiacao_parcelas(premiacao_id);
CREATE INDEX idx_parcelas_responsavel ON public.premiacao_parcelas(responsavel_id);
CREATE INDEX idx_premiacoes_responsavel ON public.premiacoes(responsavel_id);
CREATE INDEX idx_premiacoes_mes_ano ON public.premiacoes(mes_referencia, ano_referencia);

-- ============================================================
-- 5. Funções auxiliares
-- ============================================================

-- Calcula a faixa atingida para (mes, ano) com base nos leads ganhos
CREATE OR REPLACE FUNCTION public.calc_faixa_atingida(_mes integer, _ano integer)
RETURNS TABLE (tier_id uuid, valor_por_contrato numeric, total_contratos integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _meta_id uuid;
  _total integer;
BEGIN
  SELECT id INTO _meta_id FROM public.metas WHERE mes = _mes AND ano = _ano;
  IF _meta_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO _total
  FROM public.leads l
  JOIN public.profiles p ON p.id = l.responsible_id
  WHERE l.status = 'fechado_ganho'
    AND l.won_at IS NOT NULL
    AND EXTRACT(MONTH FROM l.won_at) = _mes
    AND EXTRACT(YEAR FROM l.won_at) = _ano
    AND COALESCE(p.participa_comissao, true) = true;

  RETURN QUERY
  SELECT t.id, t.valor_por_contrato, _total
  FROM public.meta_tiers t
  WHERE t.meta_id = _meta_id
    AND t.quantidade_minima <= _total
  ORDER BY t.quantidade_minima DESC, t.ordem DESC
  LIMIT 1;
END;
$$;

-- Retorna o valor por contrato vigente (congelado se mês fechado, senão calculado)
CREATE OR REPLACE FUNCTION public.get_valor_premiacao_vigente(_mes integer, _ano integer)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _v numeric;
BEGIN
  SELECT valor_por_contrato_congelado INTO _v
  FROM public.meta_apuracao
  WHERE mes = _mes AND ano = _ano AND fechada_em IS NOT NULL;

  IF FOUND THEN
    RETURN COALESCE(_v, 0);
  END IF;

  SELECT valor_por_contrato INTO _v FROM public.calc_faixa_atingida(_mes, _ano);
  RETURN COALESCE(_v, 0);
END;
$$;

-- Recalcula valor_total e parcelas pendentes de uma premiação
CREATE OR REPLACE FUNCTION public.recalc_premiacao(_premiacao_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _mes integer;
  _ano integer;
  _novo_valor numeric;
  _parcela_valor numeric;
BEGIN
  SELECT mes_referencia, ano_referencia INTO _mes, _ano
  FROM public.premiacoes WHERE id = _premiacao_id;

  IF NOT FOUND THEN RETURN; END IF;

  _novo_valor := public.get_valor_premiacao_vigente(_mes, _ano);
  _parcela_valor := ROUND((_novo_valor / 3.0)::numeric, 2);

  UPDATE public.premiacoes
  SET valor_total = _novo_valor
  WHERE id = _premiacao_id;

  -- Atualiza parcelas pendentes não ajustadas manualmente
  UPDATE public.premiacao_parcelas
  SET valor = _parcela_valor
  WHERE premiacao_id = _premiacao_id
    AND status = 'pendente'
    AND ajustada_manualmente = false;
END;
$$;

-- Atualiza apuração em tempo real para um mês aberto
CREATE OR REPLACE FUNCTION public.refresh_apuracao_aberta(_mes integer, _ano integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row record;
  _premiacao_id uuid;
BEGIN
  -- Se já fechada, não mexe
  IF EXISTS (SELECT 1 FROM public.meta_apuracao WHERE mes = _mes AND ano = _ano AND fechada_em IS NOT NULL) THEN
    RETURN;
  END IF;

  SELECT * INTO _row FROM public.calc_faixa_atingida(_mes, _ano);

  INSERT INTO public.meta_apuracao (mes, ano, faixa_atingida_id, valor_por_contrato_congelado, total_contratos)
  VALUES (_mes, _ano, _row.tier_id, COALESCE(_row.valor_por_contrato, 0), COALESCE(_row.total_contratos, 0))
  ON CONFLICT (mes, ano) DO UPDATE
    SET faixa_atingida_id = EXCLUDED.faixa_atingida_id,
        valor_por_contrato_congelado = EXCLUDED.valor_por_contrato_congelado,
        total_contratos = EXCLUDED.total_contratos
    WHERE public.meta_apuracao.fechada_em IS NULL;

  -- Recalcula todas premiações daquele mês
  FOR _premiacao_id IN
    SELECT id FROM public.premiacoes WHERE mes_referencia = _mes AND ano_referencia = _ano AND status = 'ativa'
  LOOP
    PERFORM public.recalc_premiacao(_premiacao_id);
  END LOOP;
END;
$$;

-- Fecha apuração do mês (congela valor)
CREATE OR REPLACE FUNCTION public.close_apuracao(_mes integer, _ano integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row record;
BEGIN
  SELECT * INTO _row FROM public.calc_faixa_atingida(_mes, _ano);

  INSERT INTO public.meta_apuracao (mes, ano, faixa_atingida_id, valor_por_contrato_congelado, total_contratos, fechada_em)
  VALUES (_mes, _ano, _row.tier_id, COALESCE(_row.valor_por_contrato, 0), COALESCE(_row.total_contratos, 0), now())
  ON CONFLICT (mes, ano) DO UPDATE
    SET faixa_atingida_id = EXCLUDED.faixa_atingida_id,
        valor_por_contrato_congelado = EXCLUDED.valor_por_contrato_congelado,
        total_contratos = EXCLUDED.total_contratos,
        fechada_em = COALESCE(public.meta_apuracao.fechada_em, now());

  -- Recalcula premiações daquele mês com valor congelado
  PERFORM public.recalc_premiacao(p.id)
  FROM public.premiacoes p
  WHERE p.mes_referencia = _mes AND p.ano_referencia = _ano AND p.status = 'ativa';
END;
$$;

-- Garante existência de premiação + 3 parcelas para um cliente
CREATE OR REPLACE FUNCTION public.ensure_premiacao(_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lead_id uuid;
  _responsavel uuid;
  _won timestamptz;
  _mes integer;
  _ano integer;
  _valor numeric;
  _parcela numeric;
  _premiacao_id uuid;
  _participa boolean;
BEGIN
  SELECT c.lead_id, COALESCE(c.responsavel_id, l.responsible_id), l.won_at
    INTO _lead_id, _responsavel, _won
  FROM public.clients c
  LEFT JOIN public.leads l ON l.id = c.lead_id
  WHERE c.id = _client_id;

  IF _won IS NULL OR _responsavel IS NULL THEN RETURN; END IF;

  SELECT COALESCE(participa_comissao, true) INTO _participa FROM public.profiles WHERE id = _responsavel;
  IF NOT COALESCE(_participa, true) THEN RETURN; END IF;

  _mes := EXTRACT(MONTH FROM _won)::int;
  _ano := EXTRACT(YEAR FROM _won)::int;
  _valor := public.get_valor_premiacao_vigente(_mes, _ano);
  _parcela := ROUND((_valor / 3.0)::numeric, 2);

  INSERT INTO public.premiacoes (client_id, responsavel_id, mes_referencia, ano_referencia, valor_total, status)
  VALUES (_client_id, _responsavel, _mes, _ano, _valor, 'ativa')
  ON CONFLICT (client_id) DO UPDATE
    SET responsavel_id = EXCLUDED.responsavel_id,
        mes_referencia = EXCLUDED.mes_referencia,
        ano_referencia = EXCLUDED.ano_referencia
  RETURNING id INTO _premiacao_id;

  -- Cria as 3 parcelas se não existirem
  INSERT INTO public.premiacao_parcelas (premiacao_id, numero, valor, responsavel_id)
  SELECT _premiacao_id, n, _parcela, _responsavel
  FROM generate_series(1,3) n
  ON CONFLICT (premiacao_id, numero) DO NOTHING;
END;
$$;

-- ============================================================
-- 6. Triggers de automação
-- ============================================================

-- Quando cliente é criado/atualizado com lead ganho, garante premiação
CREATE OR REPLACE FUNCTION public.trg_client_premiacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Cancelamento via historico
  IF TG_OP = 'UPDATE' AND COALESCE(NEW.historico, false) = true AND COALESCE(OLD.historico, false) = false THEN
    UPDATE public.premiacoes SET status = 'cancelada' WHERE client_id = NEW.id;
    UPDATE public.premiacao_parcelas
      SET status = 'cancelada'
      WHERE premiacao_id IN (SELECT id FROM public.premiacoes WHERE client_id = NEW.id)
        AND status = 'pendente';
    RETURN NEW;
  END IF;

  -- Reativação
  IF TG_OP = 'UPDATE' AND COALESCE(NEW.historico, false) = false AND COALESCE(OLD.historico, false) = true THEN
    UPDATE public.premiacoes SET status = 'ativa' WHERE client_id = NEW.id;
  END IF;

  -- Transferência de responsável: atualiza parcelas pendentes
  IF TG_OP = 'UPDATE' AND NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id AND NEW.responsavel_id IS NOT NULL THEN
    UPDATE public.premiacoes SET responsavel_id = NEW.responsavel_id WHERE client_id = NEW.id;
    UPDATE public.premiacao_parcelas
      SET responsavel_id = NEW.responsavel_id
      WHERE premiacao_id IN (SELECT id FROM public.premiacoes WHERE client_id = NEW.id)
        AND status = 'pendente';
  END IF;

  PERFORM public.ensure_premiacao(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clients_premiacao
  AFTER INSERT OR UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.trg_client_premiacao();

-- Quando mensalidade 1-3 é registrada, libera parcela correspondente
CREATE OR REPLACE FUNCTION public.trg_mensalidade_libera_parcela()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _premiacao_id uuid;
  _responsavel uuid;
BEGIN
  IF NEW.numero_mensalidade NOT BETWEEN 1 AND 3 THEN RETURN NEW; END IF;

  PERFORM public.ensure_premiacao(NEW.client_id);

  SELECT id, responsavel_id INTO _premiacao_id, _responsavel
  FROM public.premiacoes WHERE client_id = NEW.client_id;

  IF _premiacao_id IS NULL THEN RETURN NEW; END IF;

  UPDATE public.premiacao_parcelas
    SET status = 'liberada',
        mensalidade_id = NEW.id,
        liberada_em = now(),
        responsavel_id = COALESCE(responsavel_id, _responsavel)
    WHERE premiacao_id = _premiacao_id
      AND numero = NEW.numero_mensalidade
      AND status = 'pendente';

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mensalidade_premiacao
  AFTER INSERT ON public.mensalidades
  FOR EACH ROW EXECUTE FUNCTION public.trg_mensalidade_libera_parcela();

-- Quando lead muda para fechado_ganho, garante premiação no cliente
CREATE OR REPLACE FUNCTION public.trg_lead_won_premiacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _client_id uuid;
BEGIN
  IF NEW.status = 'fechado_ganho' THEN
    SELECT id INTO _client_id FROM public.clients WHERE lead_id = NEW.id;
    IF _client_id IS NOT NULL THEN
      PERFORM public.ensure_premiacao(_client_id);
      PERFORM public.refresh_apuracao_aberta(EXTRACT(MONTH FROM NEW.won_at)::int, EXTRACT(YEAR FROM NEW.won_at)::int);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_leads_won_premiacao
  AFTER INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.trg_lead_won_premiacao();

-- ============================================================
-- 7. Backfill de dados existentes
-- ============================================================

-- 7a. Criar faixas para metas existentes
INSERT INTO public.meta_tiers (meta_id, ordem, nome, quantidade_minima, valor_por_contrato)
SELECT id, 1, 'Meta', quantidade_meta, valor_contrato
FROM public.metas
ON CONFLICT DO NOTHING;

INSERT INTO public.meta_tiers (meta_id, ordem, nome, quantidade_minima, valor_por_contrato)
SELECT id, 2, 'Super Meta', meta_bonus_quantidade, COALESCE(meta_bonus_valor, valor_contrato)
FROM public.metas
WHERE COALESCE(meta_bonus_quantidade, 0) > 0
ON CONFLICT DO NOTHING;

-- 7b. Criar premiações para clientes existentes
DO $$
DECLARE
  _c record;
BEGIN
  FOR _c IN SELECT id FROM public.clients LOOP
    PERFORM public.ensure_premiacao(_c.id);
  END LOOP;
END $$;

-- 7c. Marcar parcelas como liberadas para mensalidades já pagas
UPDATE public.premiacao_parcelas pp
SET status = 'liberada',
    mensalidade_id = m.id,
    liberada_em = m.created_at
FROM public.premiacoes p
JOIN public.mensalidades m ON m.client_id = p.client_id
WHERE pp.premiacao_id = p.id
  AND pp.numero = m.numero_mensalidade
  AND m.numero_mensalidade BETWEEN 1 AND 3
  AND pp.status = 'pendente';

-- 7d. Fechar apurações de meses anteriores ao atual
DO $$
DECLARE
  _m record;
  _now_m int := EXTRACT(MONTH FROM now())::int;
  _now_y int := EXTRACT(YEAR FROM now())::int;
BEGIN
  FOR _m IN SELECT DISTINCT mes, ano FROM public.metas LOOP
    IF (_m.ano < _now_y) OR (_m.ano = _now_y AND _m.mes < _now_m) THEN
      PERFORM public.close_apuracao(_m.mes, _m.ano);
    ELSE
      PERFORM public.refresh_apuracao_aberta(_m.mes, _m.ano);
    END IF;
  END LOOP;
END $$;
