/*
  # Sistema de Gerenciamento de Pavimentos para Lajes Nervuradas

  1. Nova Tabela
    - `ribbed_slab_floors`
      - `id` (uuid, primary key)
      - `quote_id` (uuid, foreign key) - Referência ao orçamento
      - `name` (text) - Nome do pavimento (ex: "Térreo", "1º Andar", "Cobertura")
      - `display_order` (integer) - Ordem de exibição
      - `notes` (text) - Observações sobre o pavimento
      - `created_at` (timestamptz)

  2. Alterações
    - Adicionar `floor_id` à tabela `ribbed_slab_rooms` para referência direta ao pavimento
    - Manter o campo `floor` (text) para compatibilidade

  3. Segurança
    - Habilitar RLS na nova tabela
    - Permitir acesso público (conforme padrão do sistema)
*/

-- Criar tabela de pavimentos
CREATE TABLE IF NOT EXISTS ribbed_slab_floors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES ribbed_slab_quotes(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Adicionar campo floor_id à tabela de cômodos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ribbed_slab_rooms' AND column_name = 'floor_id'
  ) THEN
    ALTER TABLE ribbed_slab_rooms ADD COLUMN floor_id uuid REFERENCES ribbed_slab_floors(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Habilitar RLS
ALTER TABLE ribbed_slab_floors ENABLE ROW LEVEL SECURITY;

-- Policies para acesso público
CREATE POLICY "Allow public read access to ribbed_slab_floors"
  ON ribbed_slab_floors FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to ribbed_slab_floors"
  ON ribbed_slab_floors FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to ribbed_slab_floors"
  ON ribbed_slab_floors FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from ribbed_slab_floors"
  ON ribbed_slab_floors FOR DELETE
  TO public
  USING (true);

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_ribbed_slab_floors_quote_id ON ribbed_slab_floors(quote_id);
CREATE INDEX IF NOT EXISTS idx_ribbed_slab_floors_display_order ON ribbed_slab_floors(quote_id, display_order);
CREATE INDEX IF NOT EXISTS idx_ribbed_slab_rooms_floor_id ON ribbed_slab_rooms(floor_id);