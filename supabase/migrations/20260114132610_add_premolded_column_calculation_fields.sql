/*
  # Adiciona campos para cálculo de volume de pilares pré-moldados

  1. Novos Campos na Tabela `products`
    - `column_section_width_cm` (decimal) - Largura da seção do pilar em centímetros
    - `column_section_height_cm` (decimal) - Altura da seção do pilar em centímetros
    - `column_section_area_m2` (decimal) - Área da seção em m² (calculada automaticamente)
    - `column_length_total` (decimal) - Comprimento total do pilar
    - `reference_measurement` (decimal) - Medida de referência para cálculos
    - `reference_volume` (decimal) - Volume de referência para cálculos proporcionais

  2. Descrição
    - Estes campos são opcionais e específicos para produtos pré-moldados tipo pilar
    - A área da seção é calculada automaticamente: (largura_cm × altura_cm) / 10000
    - O volume total pode ser calculado proporcionalmente usando o volume de referência
    - Permite calcular volumes para diferentes comprimentos de pilares

  3. Notas
    - Campos com valores DEFAULT 0 para facilitar cálculos
    - Todos os campos são opcionais (produtos não-pilares não precisam preencher)
*/

DO $$
BEGIN
  -- Adiciona campo de largura da seção
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'column_section_width_cm'
  ) THEN
    ALTER TABLE products ADD COLUMN column_section_width_cm decimal(10,2) DEFAULT 0;
    COMMENT ON COLUMN products.column_section_width_cm IS 'Largura da seção do pilar em centímetros';
  END IF;

  -- Adiciona campo de altura da seção
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'column_section_height_cm'
  ) THEN
    ALTER TABLE products ADD COLUMN column_section_height_cm decimal(10,2) DEFAULT 0;
    COMMENT ON COLUMN products.column_section_height_cm IS 'Altura da seção do pilar em centímetros';
  END IF;

  -- Adiciona campo de área da seção em m²
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'column_section_area_m2'
  ) THEN
    ALTER TABLE products ADD COLUMN column_section_area_m2 decimal(10,6) DEFAULT 0;
    COMMENT ON COLUMN products.column_section_area_m2 IS 'Área da seção do pilar em m² (calculada: largura × altura / 10000)';
  END IF;

  -- Adiciona campo de comprimento total
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'column_length_total'
  ) THEN
    ALTER TABLE products ADD COLUMN column_length_total decimal(10,2) DEFAULT 0;
    COMMENT ON COLUMN products.column_length_total IS 'Comprimento total do pilar';
  END IF;

  -- Adiciona campo de medida de referência
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'reference_measurement'
  ) THEN
    ALTER TABLE products ADD COLUMN reference_measurement decimal(10,2) DEFAULT 0;
    COMMENT ON COLUMN products.reference_measurement IS 'Medida de referência para cálculo de volume proporcional';
  END IF;

  -- Adiciona campo de volume de referência
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'reference_volume'
  ) THEN
    ALTER TABLE products ADD COLUMN reference_volume decimal(10,6) DEFAULT 0;
    COMMENT ON COLUMN products.reference_volume IS 'Volume de referência para cálculo proporcional de volumes com diferentes comprimentos';
  END IF;
END $$;