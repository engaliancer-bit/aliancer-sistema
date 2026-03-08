/*
  # Correção da Foreign Key de engineering_project_services

  ## Descrição
  Corrige a foreign key da tabela engineering_project_services para referenciar
  engineering_service_templates ao invés de engineering_services, pois o sistema
  utiliza os templates de serviços.

  ## Mudanças
  1. Remove a constraint antiga que referencia engineering_services
  2. Adiciona nova constraint que referencia engineering_service_templates
  3. Mantém a nomenclatura da coluna como service_id para compatibilidade
*/

-- Remove a constraint antiga
ALTER TABLE engineering_project_services 
  DROP CONSTRAINT IF EXISTS engineering_project_services_service_id_fkey;

-- Adiciona a nova constraint referenciando engineering_service_templates
ALTER TABLE engineering_project_services
  ADD CONSTRAINT engineering_project_services_service_id_fkey 
  FOREIGN KEY (service_id) 
  REFERENCES engineering_service_templates(id) 
  ON DELETE RESTRICT;
