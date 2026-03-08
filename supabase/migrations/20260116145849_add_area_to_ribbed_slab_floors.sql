/*
  # Adicionar Campo de Área aos Pavimentos

  1. Alterações
    - Adicionar campo `area` (numeric) à tabela `ribbed_slab_floors`
    - Campo para armazenar a área em m² de cada pavimento
    - Permite que cada pavimento tenha sua própria área definida

  2. Notas
    - O campo `area` é opcional (pode ser NULL)
    - Cada pavimento terá sua área calculada independentemente
*/

-- Adicionar campo de área aos pavimentos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ribbed_slab_floors' AND column_name = 'area'
  ) THEN
    ALTER TABLE ribbed_slab_floors ADD COLUMN area numeric(10,2) DEFAULT 0;
  END IF;
END $$;