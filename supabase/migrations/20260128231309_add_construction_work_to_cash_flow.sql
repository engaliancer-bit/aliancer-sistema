/*
  # Adicionar Vínculo de Obra ao Fluxo de Caixa

  ## Descrição
  Adiciona a capacidade de vincular despesas e receitas manuais do fluxo de caixa
  diretamente a obras cadastradas. Isso permite rastrear custos específicos de cada
  obra, como mão de obra de terceiros, materiais externos, etc.

  ## Alterações

  1. **cash_flow** - Adiciona referência à obra
     - `construction_work_id` (uuid, FK -> construction_works) - Obra vinculada (opcional)

  2. **Índice**
     - Cria índice para melhorar performance de consultas por obra

  ## Casos de Uso

  - Registrar custos de mão de obra de terceiros vinculados à obra específica
  - Rastrear despesas com materiais comprados externamente para uma obra
  - Gerar relatórios de custos por obra
  - Controlar margem de lucro e custos totais de cada obra
  - Vincular receitas de medições/parcelas a obras específicas

  ## Segurança
  - Foreign key com ON DELETE SET NULL para preservar histórico
  - Índice para otimizar consultas
*/

-- Adicionar coluna de vínculo com obra
ALTER TABLE cash_flow
ADD COLUMN IF NOT EXISTS construction_work_id uuid REFERENCES construction_works(id) ON DELETE SET NULL;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_cash_flow_construction_work
ON cash_flow(construction_work_id)
WHERE construction_work_id IS NOT NULL;

-- Adicionar comentários para documentação
COMMENT ON COLUMN cash_flow.construction_work_id IS 'Obra vinculada (opcional) - permite rastrear receitas/despesas por obra';