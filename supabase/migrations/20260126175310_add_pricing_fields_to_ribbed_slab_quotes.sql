/*
  # Adicionar Campos de Precificação aos Orçamentos de Laje Treliçada

  1. Problema
    - Sistema tenta salvar campos de precificação que não existem
    - Campos: labor_cost_percentage, loss_percentage, transport_cost, profit_margin_percentage
    - Erro ao salvar precificação no frontend

  2. Solução
    - Adicionar campos de precificação em ribbed_slab_quotes
    - Permitir cálculo completo de custos e margens

  3. Campos Adicionados
    - `labor_cost_percentage` (numeric) - Percentual de custo com mão de obra
    - `loss_percentage` (numeric) - Percentual de perda de materiais
    - `transport_cost` (numeric) - Custo fixo de transporte
    - `profit_margin_percentage` (numeric) - Percentual de margem de lucro

  Nota: Campo fixed_costs_percentage já existe, campo total_value já existe
*/

-- Adicionar campo de percentual de mão de obra
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ribbed_slab_quotes' AND column_name = 'labor_cost_percentage'
  ) THEN
    ALTER TABLE ribbed_slab_quotes ADD COLUMN labor_cost_percentage numeric DEFAULT 0;
  END IF;
END $$;

-- Adicionar campo de percentual de perda
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ribbed_slab_quotes' AND column_name = 'loss_percentage'
  ) THEN
    ALTER TABLE ribbed_slab_quotes ADD COLUMN loss_percentage numeric DEFAULT 0;
  END IF;
END $$;

-- Adicionar campo de custo de transporte
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ribbed_slab_quotes' AND column_name = 'transport_cost'
  ) THEN
    ALTER TABLE ribbed_slab_quotes ADD COLUMN transport_cost numeric DEFAULT 0;
  END IF;
END $$;

-- Adicionar campo de margem de lucro
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ribbed_slab_quotes' AND column_name = 'profit_margin_percentage'
  ) THEN
    ALTER TABLE ribbed_slab_quotes ADD COLUMN profit_margin_percentage numeric DEFAULT 0;
  END IF;
END $$;

-- Comentários explicativos
COMMENT ON COLUMN ribbed_slab_quotes.labor_cost_percentage IS 
'Percentual de custo com mão de obra sobre o custo de materiais';

COMMENT ON COLUMN ribbed_slab_quotes.loss_percentage IS 
'Percentual de perda estimada de materiais no processo';

COMMENT ON COLUMN ribbed_slab_quotes.transport_cost IS 
'Custo fixo de transporte para o orçamento';

COMMENT ON COLUMN ribbed_slab_quotes.profit_margin_percentage IS 
'Percentual de margem de lucro desejada sobre o custo total';
