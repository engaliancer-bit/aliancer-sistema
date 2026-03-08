/*
  # Adicionar campos de comprimento e custo por metro aos materiais

  1. Mudanças
    - Adiciona `unit_length_meters` à tabela `materials`
      - Comprimento da unidade em metros (ex: 12 para barras de 12m)
    - Adiciona `cost_per_meter` à tabela `materials`
      - Custo calculado por metro linear
    - Adiciona comentários explicativos
  
  2. Uso
    - Para materiais como barras de ferro:
      - Informar `unit_cost` = preço da barra completa (ex: R$ 120,00)
      - Informar `unit_length_meters` = comprimento da barra (ex: 12)
      - `cost_per_meter` será calculado automaticamente (ex: R$ 10,00/metro)
*/

-- Adicionar campo de comprimento da unidade
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'materials' AND column_name = 'unit_length_meters'
  ) THEN
    ALTER TABLE materials ADD COLUMN unit_length_meters numeric DEFAULT NULL;
    COMMENT ON COLUMN materials.unit_length_meters IS 'Comprimento da unidade em metros (ex: 12 para barras de 12m)';
  END IF;
END $$;

-- Adicionar campo de custo por metro
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'materials' AND column_name = 'cost_per_meter'
  ) THEN
    ALTER TABLE materials ADD COLUMN cost_per_meter numeric DEFAULT NULL;
    COMMENT ON COLUMN materials.cost_per_meter IS 'Custo por metro linear, calculado automaticamente quando unit_length_meters está preenchido';
  END IF;
END $$;

-- Criar função para calcular custo por metro automaticamente
CREATE OR REPLACE FUNCTION calculate_cost_per_meter()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.unit_length_meters IS NOT NULL AND NEW.unit_length_meters > 0 THEN
    NEW.cost_per_meter := NEW.unit_cost / NEW.unit_length_meters;
  ELSE
    NEW.cost_per_meter := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para calcular automaticamente
DROP TRIGGER IF EXISTS trigger_calculate_cost_per_meter ON materials;
CREATE TRIGGER trigger_calculate_cost_per_meter
  BEFORE INSERT OR UPDATE ON materials
  FOR EACH ROW
  EXECUTE FUNCTION calculate_cost_per_meter();