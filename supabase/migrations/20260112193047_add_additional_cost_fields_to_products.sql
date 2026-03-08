/*
  # Adiciona campos de custos adicionais aos produtos

  1. Alterações na Tabela `products`
    - Adiciona `labor_cost` (numeric) - Custo de mão de obra por unidade
    - Adiciona `fixed_cost` (numeric) - Custos fixos rateados por unidade  
    - Adiciona `transport_cost` (numeric) - Custo de transporte por unidade
    - Adiciona `loss_cost` (numeric) - Custo de perdas por unidade
    - Adiciona `material_cost` (numeric) - Custo de materiais calculado automaticamente

  2. Observações
    - Todos os campos são editáveis pelo usuário
    - production_cost será a soma de todos esses custos
    - Valores padrão são 0.00
*/

-- Adicionar campos de custos adicionais
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'material_cost'
  ) THEN
    ALTER TABLE products ADD COLUMN material_cost numeric DEFAULT 0 CHECK (material_cost >= 0);
    COMMENT ON COLUMN products.material_cost IS 'Custo de materiais baseado no traço (calculado automaticamente)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'labor_cost'
  ) THEN
    ALTER TABLE products ADD COLUMN labor_cost numeric DEFAULT 0 CHECK (labor_cost >= 0);
    COMMENT ON COLUMN products.labor_cost IS 'Custo de mão de obra por unidade (editável)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'fixed_cost'
  ) THEN
    ALTER TABLE products ADD COLUMN fixed_cost numeric DEFAULT 0 CHECK (fixed_cost >= 0);
    COMMENT ON COLUMN products.fixed_cost IS 'Custos fixos rateados por unidade (editável)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'transport_cost'
  ) THEN
    ALTER TABLE products ADD COLUMN transport_cost numeric DEFAULT 0 CHECK (transport_cost >= 0);
    COMMENT ON COLUMN products.transport_cost IS 'Custo de transporte por unidade (editável)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'loss_cost'
  ) THEN
    ALTER TABLE products ADD COLUMN loss_cost numeric DEFAULT 0 CHECK (loss_cost >= 0);
    COMMENT ON COLUMN products.loss_cost IS 'Custo de perdas por unidade (editável)';
  END IF;
END $$;