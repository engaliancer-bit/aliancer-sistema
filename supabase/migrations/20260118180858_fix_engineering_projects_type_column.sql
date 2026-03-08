/*
  # Corrigir Coluna Type da Tabela Engineering Projects

  ## Mudanças
  1. Remover a coluna "type" que era da versão antiga da tabela
  2. Garantir que não há conflitos entre versões antigas e novas
  
  ## Notas
  - A tabela foi recriada sem a coluna "type"
  - Mas pode haver uma coluna antiga causando conflito
*/

-- Remover a coluna type se existir (era da versão antiga)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'engineering_projects' 
    AND column_name = 'type'
  ) THEN
    ALTER TABLE engineering_projects DROP COLUMN type;
  END IF;
END $$;

-- Garantir que project_number seja opcional (pode ser gerado automaticamente)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'engineering_projects' 
    AND column_name = 'project_number'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE engineering_projects ALTER COLUMN project_number DROP NOT NULL;
  END IF;
END $$;