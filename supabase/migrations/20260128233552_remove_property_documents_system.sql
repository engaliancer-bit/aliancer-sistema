/*
  # Remover Sistema de Documentos de Imóveis

  ## Objetivo
  Remover completamente o sistema de upload e armazenamento de documentos PDF para imóveis,
  reduzindo o tamanho e complexidade do sistema.

  ## Contexto
  - A tabela property_documents está vazia (0 registros)
  - O sistema de upload nunca foi utilizado em produção
  - O bucket de storage 'attachments' já foi removido anteriormente
  - A funcionalidade de upload estava quebrada (bucket não existe)

  ## Alterações

  1. **Remover Índices**
     - idx_property_documents_property
     - idx_property_documents_type

  2. **Remover Políticas RLS**
     - Todas as políticas da tabela property_documents

  3. **Dropar Tabela**
     - property_documents (com CASCADE para remover todas as dependências)

  ## Benefícios

  - Sistema mais leve e performático
  - Remove código não utilizado
  - Elimina funcionalidade quebrada
  - Reduz complexidade de manutenção

  ## Segurança

  - Tabela está vazia, não há perda de dados
  - Nenhum dado de produção será afetado
*/

-- 1. Remover índices
DROP INDEX IF EXISTS idx_property_documents_property;
DROP INDEX IF EXISTS idx_property_documents_type;

-- 2. Remover políticas RLS
DROP POLICY IF EXISTS "Allow authenticated users to read property_documents" ON property_documents;
DROP POLICY IF EXISTS "Allow authenticated users to insert property_documents" ON property_documents;
DROP POLICY IF EXISTS "Allow authenticated users to update property_documents" ON property_documents;
DROP POLICY IF EXISTS "Allow authenticated users to delete property_documents" ON property_documents;

-- 3. Dropar tabela completamente (CASCADE remove todas as dependências)
DROP TABLE IF EXISTS property_documents CASCADE;

-- Nota: A tabela properties foi mantida, apenas a tabela de documentos foi removida
