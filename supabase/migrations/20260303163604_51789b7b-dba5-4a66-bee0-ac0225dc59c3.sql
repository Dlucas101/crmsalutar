
CREATE TABLE public.mensalidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  numero_mensalidade integer NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  data_pagamento date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mensalidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mensalidades_select" ON public.mensalidades FOR SELECT TO authenticated USING (true);
CREATE POLICY "mensalidades_insert" ON public.mensalidades FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "mensalidades_update" ON public.mensalidades FOR UPDATE TO authenticated USING (true);
CREATE POLICY "mensalidades_delete" ON public.mensalidades FOR DELETE TO authenticated USING (true);

-- Unique constraint: one record per client per mensalidade number
ALTER TABLE public.mensalidades ADD CONSTRAINT mensalidades_client_numero_unique UNIQUE (client_id, numero_mensalidade);
