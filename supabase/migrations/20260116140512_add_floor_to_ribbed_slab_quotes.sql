/*
  # Adicionar campo de pavimento aos orçamentos de laje treliçada

  1. Alterações em `ribbed_slab_quotes`
    - Adicionar `floor` (text, nullable) - identificador do pavimento/nível
    
  2. Alterações em `ribbed_slab_rooms`
    - Adicionar `floor` (text, nullable) - identificador do pavimento/nível para agrupar cômodos
    
  Nota: Permitirá organizar orçamentos por pavimento (Térreo, 1º Andar, etc)
*/

-- Adicionar campo de pavimento na tabela ribbed_slab_quotes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ribbed_slab_quotes' AND column_name = 'floor'
  ) THEN
    ALTER TABLE ribbed_slab_quotes ADD COLUMN floor text;
  END IF;
END $$;

-- Adicionar campo de pavimento na tabela ribbed_slab_rooms  
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ribbed_slab_rooms' AND column_name = 'floor'
  ) THEN
    ALTER TABLE ribbed_slab_rooms ADD COLUMN floor text;
  END IF;
END $$;