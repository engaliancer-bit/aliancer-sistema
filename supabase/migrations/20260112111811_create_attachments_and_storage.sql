/*
  # Criar sistema de anexos

  1. Nova Tabela
    - attachments
      - id (uuid, primary key)
      - entity_type (text) - tipo da entidade (product, composition, quote, customer)
      - entity_id (uuid) - id da entidade relacionada
      - file_name (text) - nome original do arquivo
      - file_path (text) - caminho no storage
      - file_type (text) - tipo MIME do arquivo
      - file_size (bigint) - tamanho do arquivo em bytes
      - description (text) - descrição opcional do anexo
      - created_at (timestamptz)
  
  2. Storage Bucket
    - Criar bucket público para anexos
  
  3. Segurança
    - Habilitar RLS na tabela attachments
    - Adicionar políticas para acesso autenticado
    - Configurar políticas do storage bucket
  
  4. Observações
    - Os arquivos serão organizados por tipo de entidade no storage
    - Suporta múltiplos anexos por entidade
    - Permite anexar imagens, PDFs e outros documentos
*/

CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('product', 'composition', 'quote', 'customer')),
  entity_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read attachments"
  ON attachments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert attachments"
  ON attachments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update attachments"
  ON attachments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete attachments"
  ON attachments FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_attachments_created_at ON attachments(created_at DESC);

INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow authenticated users to upload files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'attachments');

CREATE POLICY "Allow authenticated users to update files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'attachments')
  WITH CHECK (bucket_id = 'attachments');

CREATE POLICY "Allow authenticated users to delete files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'attachments');

CREATE POLICY "Allow public to read files"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'attachments');
