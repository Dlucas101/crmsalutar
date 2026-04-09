-- Tabela de modelos de contrato
CREATE TABLE public.contract_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  file_path text NOT NULL,
  campos jsonb NOT NULL DEFAULT '[]'::jsonb,
  secoes_condicionais jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_templates_select" ON public.contract_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "contract_templates_insert" ON public.contract_templates
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_gestor(auth.uid()));

CREATE POLICY "contract_templates_update" ON public.contract_templates
  FOR UPDATE TO authenticated USING (is_admin_or_gestor(auth.uid()));

CREATE POLICY "contract_templates_delete" ON public.contract_templates
  FOR DELETE TO authenticated USING (is_admin_or_gestor(auth.uid()));

CREATE TRIGGER update_contract_templates_updated_at
  BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de contratos gerados
CREATE TABLE public.generated_contracts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.contract_templates(id) ON DELETE CASCADE,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  file_path text,
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.generated_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "generated_contracts_select" ON public.generated_contracts
  FOR SELECT TO authenticated USING (
    generated_by = auth.uid() OR is_admin_or_gestor(auth.uid())
  );

CREATE POLICY "generated_contracts_insert" ON public.generated_contracts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = generated_by);

CREATE POLICY "generated_contracts_delete" ON public.generated_contracts
  FOR DELETE TO authenticated USING (is_admin_or_gestor(auth.uid()));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', false);

-- Storage policies
CREATE POLICY "contracts_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contracts' AND is_admin_or_gestor(auth.uid()));

CREATE POLICY "contracts_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'contracts');

CREATE POLICY "contracts_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'contracts' AND is_admin_or_gestor(auth.uid()));

CREATE POLICY "contracts_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'contracts' AND is_admin_or_gestor(auth.uid()));