/*
  # Remover campo de diâmetro do reforço

  1. Alterações em `ribbed_slab_rooms`
    - Remover coluna `reinforcement_diameter` (não será mais utilizada)
    
  Nota: O campo foi substituído por uma seleção direta do material de reforço
  sem necessidade de especificar o diâmetro separadamente.
*/

-- Remover coluna reinforcement_diameter
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ribbed_slab_rooms' AND column_name = 'reinforcement_diameter'
  ) THEN
    ALTER TABLE ribbed_slab_rooms DROP COLUMN reinforcement_diameter;
  END IF;
END $$;