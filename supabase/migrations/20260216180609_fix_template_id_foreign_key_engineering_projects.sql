/*
  # Correção: Foreign Key do template_id em engineering_projects

  ## Problema Identificado
  A foreign key `template_id` na tabela `engineering_projects` está referenciando a tabela errada.
  
  **Estado Atual:**
  - template_id → engineering_project_templates (ERRADO)
  
  **Estado Correto:**
  - template_id → engineering_service_templates (CORRETO)

  ## Contexto
  Existem duas tabelas de templates:
  1. `engineering_project_templates` - Templates de projetos completos (Levantamento Topográfico, etc.)
  2. `engineering_service_templates` - Templates de serviços individuais (Laudo APP, Avaliação, etc.)

  Quando o usuário cadastra um projeto selecionando "Laudo APP", está trabalhando com 
  `engineering_service_templates`, então o campo `template_id` deve referenciar essa tabela.

  ## Alterações
  1. Remove a foreign key incorreta
  2. Adiciona a foreign key correta apontando para engineering_service_templates
*/

-- 1. Remover a foreign key incorreta
ALTER TABLE engineering_projects
DROP CONSTRAINT IF EXISTS engineering_projects_template_id_fkey;

-- 2. Adicionar a foreign key correta
ALTER TABLE engineering_projects
ADD CONSTRAINT engineering_projects_template_id_fkey
FOREIGN KEY (template_id)
REFERENCES engineering_service_templates(id)
ON DELETE SET NULL;

-- 3. Criar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_engineering_projects_template_id 
ON engineering_projects(template_id)
WHERE template_id IS NOT NULL;
