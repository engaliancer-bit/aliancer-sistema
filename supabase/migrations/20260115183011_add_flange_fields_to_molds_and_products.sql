/*
  # Adicionar campos de aba (flange) para fôrmas e produtos

  1. Alterações na tabela `molds`
    - `has_flange` (boolean) - Indica se a fôrma possui aba
    - `flange_section_width_cm` (numeric) - Largura da seção da aba em cm
    - `flange_section_height_cm` (numeric) - Altura da seção da aba em cm
    - `flange_reference_measurement_meters` (numeric) - Comprimento de referência da aba em metros
    - `flange_reference_volume_m3` (numeric) - Volume de referência da aba em m³

  2. Alterações na tabela `products`
    - `has_flange` (boolean) - Indica se o produto pré-moldado possui aba
    - `flange_length_meters` (numeric) - Comprimento da aba do produto em metros
    - `flange_volume_m3` (numeric) - Volume de concreto da aba calculado

  3. Notas
    - Campos são opcionais (nullable)
    - Para produtos pré-moldados, o volume da aba é calculado com base nas medidas da fôrma
    - Esses campos são relevantes principalmente para tesouras pré-moldadas
*/

-- Adicionar campos de aba na tabela molds
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'molds' AND column_name = 'has_flange'
  ) THEN
    ALTER TABLE molds ADD COLUMN has_flange boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'molds' AND column_name = 'flange_section_width_cm'
  ) THEN
    ALTER TABLE molds ADD COLUMN flange_section_width_cm numeric(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'molds' AND column_name = 'flange_section_height_cm'
  ) THEN
    ALTER TABLE molds ADD COLUMN flange_section_height_cm numeric(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'molds' AND column_name = 'flange_reference_measurement_meters'
  ) THEN
    ALTER TABLE molds ADD COLUMN flange_reference_measurement_meters numeric(10,4);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'molds' AND column_name = 'flange_reference_volume_m3'
  ) THEN
    ALTER TABLE molds ADD COLUMN flange_reference_volume_m3 numeric(10,4);
  END IF;
END $$;

-- Adicionar campos de aba na tabela products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'has_flange'
  ) THEN
    ALTER TABLE products ADD COLUMN has_flange boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'flange_length_meters'
  ) THEN
    ALTER TABLE products ADD COLUMN flange_length_meters numeric(10,4);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'flange_volume_m3'
  ) THEN
    ALTER TABLE products ADD COLUMN flange_volume_m3 numeric(10,4);
  END IF;
END $$;