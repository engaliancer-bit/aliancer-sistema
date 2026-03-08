/*
  # Adicionar Colunas Faltantes na Tabela engineering_projects

  ## Mudanças
  1. Adicionar coluna `project_name` (alias para `name`)
  2. Adicionar coluna `grand_total` (alias para `total_value`)
  3. Manter compatibilidade com código existente

  ## Notas
  - As colunas `name` e `total_value` continuam existindo
  - As novas colunas são para compatibilidade com o EngineeringProjectsManager
*/

-- Adicionar coluna project_name se não existir
DO $$ BEGIN
  ALTER TABLE engineering_projects 
  ADD COLUMN IF NOT EXISTS project_name text;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Adicionar coluna grand_total se não existir
DO $$ BEGIN
  ALTER TABLE engineering_projects 
  ADD COLUMN IF NOT EXISTS grand_total numeric DEFAULT 0;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Copiar dados existentes de name para project_name
UPDATE engineering_projects 
SET project_name = name 
WHERE project_name IS NULL AND name IS NOT NULL;

-- Copiar dados existentes de total_value para grand_total
UPDATE engineering_projects 
SET grand_total = total_value 
WHERE grand_total = 0 AND total_value IS NOT NULL;

-- Criar trigger para sincronizar project_name com name
CREATE OR REPLACE FUNCTION sync_project_name_with_name()
RETURNS TRIGGER AS $$
BEGIN
  -- Se project_name foi definido, copiar para name
  IF NEW.project_name IS NOT NULL AND NEW.project_name != '' THEN
    NEW.name = NEW.project_name;
  END IF;
  
  -- Se name foi definido e project_name está vazio, copiar para project_name
  IF NEW.name IS NOT NULL AND NEW.name != '' AND (NEW.project_name IS NULL OR NEW.project_name = '') THEN
    NEW.project_name = NEW.name;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_project_name_trigger ON engineering_projects;
CREATE TRIGGER sync_project_name_trigger
  BEFORE INSERT OR UPDATE ON engineering_projects
  FOR EACH ROW
  EXECUTE FUNCTION sync_project_name_with_name();

-- Criar trigger para sincronizar grand_total com total_value
CREATE OR REPLACE FUNCTION sync_grand_total_with_total_value()
RETURNS TRIGGER AS $$
BEGIN
  -- Se grand_total foi definido, copiar para total_value
  IF NEW.grand_total IS NOT NULL THEN
    NEW.total_value = NEW.grand_total;
  END IF;
  
  -- Se total_value foi definido e grand_total é nulo/zero, copiar para grand_total
  IF NEW.total_value IS NOT NULL AND (NEW.grand_total IS NULL OR NEW.grand_total = 0) THEN
    NEW.grand_total = NEW.total_value;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_grand_total_trigger ON engineering_projects;
CREATE TRIGGER sync_grand_total_trigger
  BEFORE INSERT OR UPDATE ON engineering_projects
  FOR EACH ROW
  EXECUTE FUNCTION sync_grand_total_with_total_value();

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_engineering_projects_project_name ON engineering_projects(project_name);
CREATE INDEX IF NOT EXISTS idx_engineering_projects_grand_total ON engineering_projects(grand_total);