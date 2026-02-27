
-- Metas table for monthly goals
CREATE TABLE public.metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes integer NOT NULL CHECK (mes >= 1 AND mes <= 12),
  ano integer NOT NULL,
  quantidade_meta integer NOT NULL DEFAULT 0,
  valor_contrato numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(mes, ano)
);

ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "metas_select" ON public.metas FOR SELECT TO authenticated USING (true);
CREATE POLICY "metas_insert" ON public.metas FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_gestor(auth.uid()));
CREATE POLICY "metas_update" ON public.metas FOR UPDATE TO authenticated USING (public.is_admin_or_gestor(auth.uid()));
CREATE POLICY "metas_delete" ON public.metas FOR DELETE TO authenticated USING (public.is_admin_or_gestor(auth.uid()));

-- Add valor_contrato to leads for tracking contract value when won
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS valor_contrato numeric(12,2) DEFAULT 0;
