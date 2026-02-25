
-- Add color field to profiles for member identification
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cor text DEFAULT NULL;

-- Create visits table
CREATE TABLE public.visits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  descricao text,
  visit_date timestamp with time zone NOT NULL,
  visit_end timestamp with time zone,
  member_id uuid REFERENCES auth.users(id),
  lead_id uuid REFERENCES public.leads(id),
  client_id uuid REFERENCES public.clients(id),
  status text NOT NULL DEFAULT 'agendado',
  cor text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY visits_select ON public.visits FOR SELECT USING (true);
CREATE POLICY visits_insert ON public.visits FOR INSERT WITH CHECK (true);
CREATE POLICY visits_update ON public.visits FOR UPDATE USING (true);
CREATE POLICY visits_delete ON public.visits FOR DELETE USING (true);
