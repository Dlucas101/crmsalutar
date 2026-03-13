
ALTER TABLE public.clients
ADD COLUMN dividir_contrato boolean DEFAULT false,
ADD COLUMN parceiro_id uuid DEFAULT NULL;
