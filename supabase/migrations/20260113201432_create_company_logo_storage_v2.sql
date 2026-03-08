/*
  # Criar Storage para Logotipo da Empresa

  1. Storage Bucket
    - Cria bucket 'company-logo' para armazenar o logotipo da empresa
    - Configurado como público para acesso direto aos relatórios
    - Limite de tamanho de arquivo: 2MB
    - Tipos de arquivo permitidos: imagens (jpg, jpeg, png, svg)

  2. Políticas de Acesso
    - Leitura pública para todos (necessário para PDF)
    - Upload permitido para todos
    - Atualização/exclusão permitido para todos
*/

-- Criar bucket para logos da empresa
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logo',
  'company-logo',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Política: Permitir leitura pública
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow public read access to company logo'
  ) THEN
    CREATE POLICY "Allow public read access to company logo"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'company-logo');
  END IF;
END $$;

-- Política: Permitir upload
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow upload company logo'
  ) THEN
    CREATE POLICY "Allow upload company logo"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'company-logo');
  END IF;
END $$;

-- Política: Permitir atualização
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow update company logo'
  ) THEN
    CREATE POLICY "Allow update company logo"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'company-logo')
    WITH CHECK (bucket_id = 'company-logo');
  END IF;
END $$;

-- Política: Permitir exclusão
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow delete company logo'
  ) THEN
    CREATE POLICY "Allow delete company logo"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'company-logo');
  END IF;
END $$;