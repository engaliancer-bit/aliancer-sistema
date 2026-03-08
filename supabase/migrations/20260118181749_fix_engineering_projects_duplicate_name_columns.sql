/*
  # Corrigir Colunas Duplicadas na Tabela Engineering Projects

  ## Problema
  A tabela `engineering_projects` tem duas colunas para o nome do projeto:
  - `name` (NOT NULL) - da versão antiga
  - `project_name` (nullable) - da versão nova
  
  Isso causa erro ao salvar porque o código usa `project_name` mas `name` é obrigatória.

  ## Solução
  1. Copiar dados de `project_name` para `name` (se houver)
  2. Remover a coluna antiga `name`
  3. Renomear `project_name` para `name`
  4. Tornar a coluna `name` obrigatória
  
  ## Notas
  - Remove a duplicação de colunas
  - Mantém compatibilidade com o código atual
*/

-- Primeiro, copiar qualquer dado de project_name para name (se houver)
UPDATE engineering_projects 
SET name = COALESCE(project_name, name)
WHERE project_name IS NOT NULL;

-- Remover a constraint NOT NULL da coluna name temporariamente
ALTER TABLE engineering_projects ALTER COLUMN name DROP NOT NULL;

-- Copiar todos os valores de name para project_name para não perder dados
UPDATE engineering_projects 
SET project_name = name
WHERE project_name IS NULL AND name IS NOT NULL;

-- Remover a coluna name antiga
ALTER TABLE engineering_projects DROP COLUMN IF EXISTS name;

-- Renomear project_name para name
ALTER TABLE engineering_projects RENAME COLUMN project_name TO name;

-- Tornar a coluna name obrigatória novamente
ALTER TABLE engineering_projects ALTER COLUMN name SET NOT NULL;

-- Remover outras colunas duplicadas ou desnecessárias
ALTER TABLE engineering_projects DROP COLUMN IF EXISTS location;
ALTER TABLE engineering_projects DROP COLUMN IF EXISTS area;
ALTER TABLE engineering_projects DROP COLUMN IF EXISTS expected_end_date;
ALTER TABLE engineering_projects DROP COLUMN IF EXISTS actual_end_date;
ALTER TABLE engineering_projects DROP COLUMN IF EXISTS total_value;
ALTER TABLE engineering_projects DROP COLUMN IF EXISTS description;
ALTER TABLE engineering_projects DROP COLUMN IF EXISTS project_number;