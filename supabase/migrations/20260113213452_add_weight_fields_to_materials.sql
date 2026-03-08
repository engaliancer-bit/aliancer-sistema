/*
  # Adicionar Campos de Peso aos Insumos
  
  1. Alterações na Tabela `materials`
    - `total_weight_kg` (numeric) - Peso total da embalagem/unidade de compra em quilogramas
    
  2. Funcionalidade
    - Armazena o peso total do insumo na sua unidade de compra
    - Permite calcular automaticamente o peso por unidade de medida
    - Exemplo: Uma barra de ferro de 12 metros pesa 8kg
      - total_weight_kg = 8
      - unit_length_meters = 12
      - peso por metro = 8 / 12 = 0.666 kg/m
    
  3. Notas
    - O campo é opcional e aplica-se principalmente a materiais onde o peso é relevante
    - A conversão é calculada automaticamente pela interface
*/

-- Adicionar campo de peso total
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'materials' AND column_name = 'total_weight_kg'
  ) THEN
    ALTER TABLE materials ADD COLUMN total_weight_kg numeric CHECK (total_weight_kg > 0);
    COMMENT ON COLUMN materials.total_weight_kg IS 'Peso total da embalagem/unidade de compra em quilogramas';
  END IF;
END $$;
