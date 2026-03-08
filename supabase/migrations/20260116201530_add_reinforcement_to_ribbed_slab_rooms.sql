/*
  # Adicionar Reforço Estrutural para Vigotas de Laje Treliçada

  1. Alterações
    - Adiciona campos de reforço estrutural à tabela `ribbed_slab_rooms`
    - `needs_reinforcement` (boolean) - indica se a vigota precisa de reforço
    - `reinforcement_material_id` (uuid) - material usado como reforço
    - `reinforcement_diameter` (text) - diâmetro do ferro de construção

  2. Regras de Negócio
    - Vigotas com comprimento > 3.01m devem ter sugestão de reforço
    - Vigotas com comprimento <= 3.00m não precisam de reforço
    - O reforço deve ter o mesmo comprimento da vigota
    - O reforço deve ser aplicado em todas as vigotas do cômodo
*/

-- Adicionar campos de reforço à tabela ribbed_slab_rooms
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
    ALTER TABLE ribbed_slab_rooms ADD COLUMN reinforcement_material_id uuid REFERENCES materials(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ribbed_slab_rooms' AND column_name = 'reinforcement_diameter'
  ) THEN
    ALTER TABLE ribbed_slab_rooms ADD COLUMN reinforcement_diameter text;
  END IF;
END $$;
