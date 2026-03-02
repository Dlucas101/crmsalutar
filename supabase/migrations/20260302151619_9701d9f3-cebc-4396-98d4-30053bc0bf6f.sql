ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS valor_negociado numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_custo numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS responsavel_id uuid;