
-- 1. CHECK constraints + UNIQUE em meta_tiers
ALTER TABLE public.meta_tiers
  ADD CONSTRAINT meta_tiers_qtd_min_nonneg CHECK (quantidade_minima >= 0),
  ADD CONSTRAINT meta_tiers_valor_nonneg CHECK (valor_por_contrato >= 0),
  ADD CONSTRAINT meta_tiers_nome_nonempty CHECK (length(btrim(nome)) > 0);

CREATE UNIQUE INDEX IF NOT EXISTS meta_tiers_meta_qtd_uniq
  ON public.meta_tiers (meta_id, quantidade_minima);

-- 2. Audit log
CREATE TABLE public.meta_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  entity_type text NOT NULL CHECK (entity_type IN ('meta','tier','apuracao')),
  entity_id uuid,
  action text NOT NULL CHECK (action IN ('create','update','delete','close','reopen')),
  mes integer,
  ano integer,
  before jsonb,
  after jsonb,
  changes jsonb
);

GRANT SELECT ON public.meta_audit_log TO authenticated;
GRANT ALL ON public.meta_audit_log TO service_role;
ALTER TABLE public.meta_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_select_admin" ON public.meta_audit_log
  FOR SELECT TO authenticated
  USING (public.is_admin_or_gestor(auth.uid()));

CREATE INDEX idx_meta_audit_created ON public.meta_audit_log (created_at DESC);
CREATE INDEX idx_meta_audit_mes_ano ON public.meta_audit_log (ano DESC, mes DESC);

-- 3. Função genérica para calcular diff
CREATE OR REPLACE FUNCTION public.jsonb_diff(_old jsonb, _new jsonb)
RETURNS jsonb
LANGUAGE sql IMMUTABLE
AS $$
  SELECT COALESCE(jsonb_object_agg(key, jsonb_build_object('before', _old->key, 'after', _new->key)), '{}'::jsonb)
  FROM (
    SELECT key FROM jsonb_object_keys(COALESCE(_new, '{}'::jsonb)) key
    UNION
    SELECT key FROM jsonb_object_keys(COALESCE(_old, '{}'::jsonb)) key
  ) k
  WHERE COALESCE(_old, '{}'::jsonb)->key IS DISTINCT FROM COALESCE(_new, '{}'::jsonb)->key
    AND key NOT IN ('updated_at','created_at');
$$;

-- 4. Triggers de auditoria
CREATE OR REPLACE FUNCTION public.audit_metas()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _before jsonb;
  _after jsonb;
  _changes jsonb;
  _action text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _before := NULL; _after := to_jsonb(NEW); _changes := _after; _action := 'create';
  ELSIF TG_OP = 'UPDATE' THEN
    _before := to_jsonb(OLD); _after := to_jsonb(NEW);
    _changes := public.jsonb_diff(_before, _after);
    IF _changes = '{}'::jsonb THEN RETURN NEW; END IF;
    _action := 'update';
  ELSE
    _before := to_jsonb(OLD); _after := NULL; _changes := _before; _action := 'delete';
  END IF;
  INSERT INTO public.meta_audit_log (user_id, entity_type, entity_id, action, mes, ano, before, after, changes)
  VALUES (auth.uid(), 'meta', COALESCE(NEW.id, OLD.id), _action, COALESCE(NEW.mes, OLD.mes), COALESCE(NEW.ano, OLD.ano), _before, _after, _changes);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_meta_tiers()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _before jsonb; _after jsonb; _changes jsonb; _action text;
  _mes int; _ano int; _meta_id uuid;
BEGIN
  _meta_id := COALESCE(NEW.meta_id, OLD.meta_id);
  SELECT mes, ano INTO _mes, _ano FROM public.metas WHERE id = _meta_id;
  IF TG_OP = 'INSERT' THEN
    _before := NULL; _after := to_jsonb(NEW); _changes := _after; _action := 'create';
  ELSIF TG_OP = 'UPDATE' THEN
    _before := to_jsonb(OLD); _after := to_jsonb(NEW);
    _changes := public.jsonb_diff(_before, _after);
    IF _changes = '{}'::jsonb THEN RETURN NEW; END IF;
    _action := 'update';
  ELSE
    _before := to_jsonb(OLD); _after := NULL; _changes := _before; _action := 'delete';
  END IF;
  INSERT INTO public.meta_audit_log (user_id, entity_type, entity_id, action, mes, ano, before, after, changes)
  VALUES (auth.uid(), 'tier', COALESCE(NEW.id, OLD.id), _action, _mes, _ano, _before, _after, _changes);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_meta_apuracao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _before jsonb; _after jsonb; _changes jsonb; _action text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _before := NULL; _after := to_jsonb(NEW); _changes := _after;
    _action := CASE WHEN NEW.fechada_em IS NOT NULL THEN 'close' ELSE 'create' END;
  ELSIF TG_OP = 'UPDATE' THEN
    _before := to_jsonb(OLD); _after := to_jsonb(NEW);
    _changes := public.jsonb_diff(_before, _after);
    IF _changes = '{}'::jsonb THEN RETURN NEW; END IF;
    IF OLD.fechada_em IS NULL AND NEW.fechada_em IS NOT NULL THEN _action := 'close';
    ELSIF OLD.fechada_em IS NOT NULL AND NEW.fechada_em IS NULL THEN _action := 'reopen';
    ELSE _action := 'update'; END IF;
  ELSE
    _before := to_jsonb(OLD); _after := NULL; _changes := _before; _action := 'delete';
  END IF;
  INSERT INTO public.meta_audit_log (user_id, entity_type, entity_id, action, mes, ano, before, after, changes)
  VALUES (auth.uid(), 'apuracao', COALESCE(NEW.id, OLD.id), _action, COALESCE(NEW.mes, OLD.mes), COALESCE(NEW.ano, OLD.ano), _before, _after, _changes);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_metas
AFTER INSERT OR UPDATE OR DELETE ON public.metas
FOR EACH ROW EXECUTE FUNCTION public.audit_metas();

CREATE TRIGGER trg_audit_meta_tiers
AFTER INSERT OR UPDATE OR DELETE ON public.meta_tiers
FOR EACH ROW EXECUTE FUNCTION public.audit_meta_tiers();

CREATE TRIGGER trg_audit_meta_apuracao
AFTER INSERT OR UPDATE OR DELETE ON public.meta_apuracao
FOR EACH ROW EXECUTE FUNCTION public.audit_meta_apuracao();

-- 5. Reabrir apuração
CREATE OR REPLACE FUNCTION public.reopen_apuracao(_mes integer, _ano integer)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_or_gestor(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  UPDATE public.meta_apuracao SET fechada_em = NULL WHERE mes = _mes AND ano = _ano;
  PERFORM public.refresh_apuracao_aberta(_mes, _ano);
END;
$$;
