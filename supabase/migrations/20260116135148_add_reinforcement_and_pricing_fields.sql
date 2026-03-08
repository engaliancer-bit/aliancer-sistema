/*
  # Adicionar campos de reforço e precificação

  1. Alterações em `ribbed_slab_rooms`
    - Adicionar `needs_reinforcement` (boolean) - indica se o cômodo precisa de reforço
    - Adicionar `reinforcement_material_id` (uuid, nullable) - material usado no reforço
    - Adicionar `reinforcement_diameter` (text, nullable) - diâmetro do ferro (será removido depois)

  2. Alterações em `ribbed_slab_quotes`
    - Adicionar `fixed_costs_percentage` (numeric) - percentual de custos fixos
*/

-- Adicionar campos de reforço na tabela ribbed_slab_rooms
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ribbed_slab_rooms' AND column_name = 'needs_reinforcement'
  ) THEN
    ALTER TABLE ribbed_slab_rooms ADD COLUMN needs_reinforcement boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ribbed_slab_rooms' AND column_name = 'reinforcement_material_id'
  ) THEN
    ALTER TABLE ribbed_slab_rooms ADD COLUMN reinforcement_material_id uuid REFERENCES materials(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ribbed_slab_rooms' AND column_name = 'reinforcement_diameter'
  ) THEN
    ALTER TABLE ribbed_slab_rooms ADD COLUMN reinforcement_diameter text;
  END IF;
END $$;

-- Adicionar campo de percentual de custos fixos na tabela ribbed_slab_quotes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ribbed_slab_quotes' AND column_name = 'fixed_costs_percentage'
  ) THEN
    ALTER TABLE ribbed_slab_quotes ADD COLUMN fixed_costs_percentage numeric DEFAULT 0;
  END IF;
END $$;