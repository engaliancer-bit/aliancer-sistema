/*
  # Adicionar Responsável aos Itens do Checklist dos Templates

  ## Descrição
  Adiciona a capacidade de definir responsáveis pré-definidos para cada etapa do checklist nos templates de serviços.
  Quando um projeto é criado a partir do template, os responsáveis são automaticamente copiados para as etapas do projeto.

  ## Mudanças
  1. Adiciona coluna `responsible_employee_id` à tabela `engineering_service_checklist_items`
  2. Cria índice para melhor performance nas consultas
  3. Adiciona chave estrangeira para a tabela `employees`

  ## Benefícios
  - Colaboradores saberão antecipadamente sua competência no projeto
  - Menos trabalho manual ao criar novos projetos
  - Padronização da distribuição de tarefas
*/

-- Adicionar coluna de responsável aos itens do checklist do template
ALTER TABLE engineering_service_checklist_items 
ADD COLUMN IF NOT EXISTS responsible_employee_id uuid REFERENCES employees(id) ON DELETE SET NULL;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_checklist_items_responsible 
ON engineering_service_checklist_items(responsible_employee_id);

-- Adicionar comentário explicativo
COMMENT ON COLUMN engineering_service_checklist_items.responsible_employee_id IS 
'Colaborador responsável pré-definido para esta etapa. Será copiado automaticamente ao criar projetos a partir deste template';
