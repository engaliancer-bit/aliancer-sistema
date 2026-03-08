/*
  # Adicionar novos tipos de custo ao enum project_cost_type

  ## Descrição
  Adiciona os tipos 'material' e 'terceirizado' ao enum project_cost_type
  para permitir categorizar melhor os custos adicionais dos projetos.

  ## Mudanças
  1. Adiciona 'material' ao enum project_cost_type
  2. Adiciona 'terceirizado' ao enum project_cost_type
*/

-- Adicionar novos valores ao enum
ALTER TYPE project_cost_type ADD VALUE IF NOT EXISTS 'material';
ALTER TYPE project_cost_type ADD VALUE IF NOT EXISTS 'terceirizado';

-- Comentário atualizado
COMMENT ON TYPE project_cost_type IS 
'Tipos de custos adicionais: taxa, deslocamento, hospedagem, alimentacao, material, terceirizado, outros';
