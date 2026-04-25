-- 1. Coluna won_at
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS won_at TIMESTAMPTZ;

-- 2. Função do trigger
CREATE OR REPLACE FUNCTION public.set_lead_won_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'fechado_ganho' AND (OLD.status IS DISTINCT FROM 'fechado_ganho') THEN
    NEW.won_at = now();
  ELSIF NEW.status <> 'fechado_ganho' AND OLD.status = 'fechado_ganho' THEN
    NEW.won_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Trigger
DROP TRIGGER IF EXISTS trg_set_lead_won_at ON public.leads;
CREATE TRIGGER trg_set_lead_won_at
BEFORE UPDATE OF status ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.set_lead_won_at();

-- Trigger também em INSERT (caso já entre como ganho)
CREATE OR REPLACE FUNCTION public.set_lead_won_at_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'fechado_ganho' AND NEW.won_at IS NULL THEN
    NEW.won_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_lead_won_at_insert ON public.leads;
CREATE TRIGGER trg_set_lead_won_at_insert
BEFORE INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.set_lead_won_at_insert();

-- 4. Backfill: leads que já estão como ganhos
UPDATE public.leads
SET won_at = updated_at
WHERE status = 'fechado_ganho' AND won_at IS NULL;

-- 5. Índice
CREATE INDEX IF NOT EXISTS idx_leads_won_at ON public.leads(won_at) WHERE won_at IS NOT NULL;