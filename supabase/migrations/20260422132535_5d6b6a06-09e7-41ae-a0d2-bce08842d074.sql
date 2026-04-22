-- Bucket privado para PDFs gerados
INSERT INTO storage.buckets (id, name, public)
VALUES ('contratos-gerados', 'contratos-gerados', false)
ON CONFLICT (id) DO NOTHING;

-- Policies: usuários autenticados podem ler/escrever no bucket
CREATE POLICY "Authenticated users can upload generated contracts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'contratos-gerados');

CREATE POLICY "Authenticated users can read generated contracts"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'contratos-gerados');