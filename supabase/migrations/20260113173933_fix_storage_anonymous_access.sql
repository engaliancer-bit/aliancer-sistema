/*
  # Corrigir Acesso Anônimo ao Storage

  1. Alterações
    - Remove políticas antigas que exigem autenticação
    - Adiciona políticas que permitem acesso anônimo para upload, atualização e exclusão
    - Mantém leitura pública
  
  2. Segurança
    - Permite operações de storage para usuários anônimos
    - Necessário para o funcionamento do sistema sem autenticação
*/

-- Remove políticas antigas
DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete files" ON storage.objects;
DROP POLICY IF EXISTS "Allow public to read files" ON storage.objects;

-- Criar novas políticas que permitem acesso anônimo
CREATE POLICY "Allow anyone to upload files"
  ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'attachments');

CREATE POLICY "Allow anyone to read files"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'attachments');

CREATE POLICY "Allow anyone to update files"
  ON storage.objects
  FOR UPDATE
  TO public
  USING (bucket_id = 'attachments')
  WITH CHECK (bucket_id = 'attachments');

CREATE POLICY "Allow anyone to delete files"
  ON storage.objects
  FOR DELETE
  TO public
  USING (bucket_id = 'attachments');
