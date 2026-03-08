/*
  # Sistema de Orçamento de Laje Treliçada

  1. Novas Tabelas
    - `ribbed_slab_quotes`
      - `id` (uuid, primary key)
      - `name` (text) - Nome do projeto/obra
      - `customer_id` (uuid) - Cliente
      - `total_area` (decimal) - Área total da obra
      - `joist_spacing` (decimal) - Espaçamento entre vigotas (metros)
      - `block_side_a` (decimal) - Tamanho lado A da tavela (metros)
      - `block_side_b` (decimal) - Tamanho lado B da tavela (metros)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `ribbed_slab_rooms`
      - `id` (uuid, primary key)
      - `quote_id` (uuid) - Referência ao projeto
      - `name` (text) - Nome do cômodo
      - `side_a` (decimal) - Medida lado A (metros)
      - `side_b` (decimal) - Medida lado B (metros)
      - `slab_type` (text) - Tipo: H8 ou H12
      - `material_id` (uuid) - Insumo utilizado
      - `material_unit_price` (decimal) - Valor unitário do insumo
      - `mold_id` (uuid) - Fôrma selecionada
      - `recipe_id` (uuid) - Traço selecionado
      - `joist_count` (integer) - Quantidade calculada de vigotas
      - `joist_length` (decimal) - Comprimento de cada vigota
      - `concrete_volume_per_joist` (decimal) - Volume de concreto por vigota
      - `total_concrete_volume` (decimal) - Volume total de concreto
      - `created_at` (timestamp)

  2. Segurança
    - Habilitar RLS em todas as tabelas
    - Políticas de acesso público para leitura/escrita (sistema sem autenticação)
*/

-- Tabela de projetos/orçamentos de laje treliçada
CREATE TABLE IF NOT EXISTS ribbed_slab_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  total_area decimal(10,2) DEFAULT 0,
  joist_spacing decimal(5,2) NOT NULL DEFAULT 0.40,
  block_side_a decimal(5,2) NOT NULL DEFAULT 0.30,
  block_side_b decimal(5,2) NOT NULL DEFAULT 0.12,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de cômodos do projeto
CREATE TABLE IF NOT EXISTS ribbed_slab_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES ribbed_slab_quotes(id) ON DELETE CASCADE,
  name text NOT NULL,
  side_a decimal(10,2) NOT NULL,
  side_b decimal(10,2) NOT NULL,
  slab_type text NOT NULL CHECK (slab_type IN ('H8', 'H12')),
  material_id uuid REFERENCES materials(id) ON DELETE SET NULL,
  material_unit_price decimal(10,2) DEFAULT 0,
  mold_id uuid REFERENCES molds(id) ON DELETE SET NULL,
  recipe_id uuid REFERENCES recipes(id) ON DELETE SET NULL,
  joist_count integer DEFAULT 0,
  joist_length decimal(10,2) DEFAULT 0,
  concrete_volume_per_joist decimal(10,4) DEFAULT 0,
  total_concrete_volume decimal(10,4) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE ribbed_slab_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ribbed_slab_rooms ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público
CREATE POLICY "Allow public read access to ribbed_slab_quotes"
  ON ribbed_slab_quotes FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to ribbed_slab_quotes"
  ON ribbed_slab_quotes FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to ribbed_slab_quotes"
  ON ribbed_slab_quotes FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to ribbed_slab_quotes"
  ON ribbed_slab_quotes FOR DELETE
  TO public
  USING (true);

CREATE POLICY "Allow public read access to ribbed_slab_rooms"
  ON ribbed_slab_rooms FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to ribbed_slab_rooms"
  ON ribbed_slab_rooms FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to ribbed_slab_rooms"
  ON ribbed_slab_rooms FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to ribbed_slab_rooms"
  ON ribbed_slab_rooms FOR DELETE
  TO public
  USING (true);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_ribbed_slab_rooms_quote_id ON ribbed_slab_rooms(quote_id);
CREATE INDEX IF NOT EXISTS idx_ribbed_slab_rooms_material_id ON ribbed_slab_rooms(material_id);
CREATE INDEX IF NOT EXISTS idx_ribbed_slab_rooms_mold_id ON ribbed_slab_rooms(mold_id);
CREATE INDEX IF NOT EXISTS idx_ribbed_slab_rooms_recipe_id ON ribbed_slab_rooms(recipe_id);