/*
  # Remover Sistema de Anexos e Storage

  1. Limpeza de Dados
    - Deletar todos os registros da tabela attachments
    - Remover políticas RLS de attachments
    - Remover políticas de storage
    - Deletar bucket de storage
  
  2. Observações
    - Remove completamente o sistema de upload/armazenamento de arquivos
    - Mantém a tabela para possível referência futura mas sem dados
    - Melhora significativa de performance ao remover overhead de storage
*/

-- 1. Deletar TODOS os registros de attachments
DELETE FROM attachments;

-- 2. Remover políticas RLS da tabela attachments
DROP POLICY IF EXISTS "Allow authenticated users to read attachments" ON attachments;
DROP POLICY IF EXISTS "Allow authenticated users to insert attachments" ON attachments;
DROP POLICY IF EXISTS "Allow authenticated users to update attachments" ON attachments;
DROP POLICY IF EXISTS "Allow authenticated users to delete attachments" ON attachments;
DROP POLICY IF EXISTS "Allow public to read attachments" ON attachments;

-- 3. Remover políticas do storage bucket
DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete files" ON storage.objects;
DROP POLICY IF EXISTS "Allow public to read files" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access to attachments bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated access to attachments" ON storage.objects;

-- 4. Deletar todos os objetos do bucket attachments
DELETE FROM storage.objects WHERE bucket_id = 'attachments';

-- 5. Deletar o bucket de attachments
DELETE FROM storage.buckets WHERE id = 'attachments';

-- 6. Opcional: Drop da tabela attachments (descomente se quiser remover completamente)
-- DROP TABLE IF EXISTS attachments CASCADE;

-- Nota: Mantemos a tabela por ora, mas vazia. Se quiser remover completamente, descomente a linha acima.
