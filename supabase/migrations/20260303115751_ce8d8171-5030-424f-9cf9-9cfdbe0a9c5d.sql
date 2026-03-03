
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS valor_pago numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS mensalidades_pagas integer DEFAULT 0;
