/*
  # Sistema de Cadastro de Fôrmas para Produtos Pré-Moldados

  ## Descrição
  Este sistema permite cadastrar fôrmas (moldes) com suas medidas padrão e configurações
  de armaduras. Quando um produto pré-moldado é cadastrado, ele pode referenciar uma fôrma
  e herdar automaticamente todas as suas configurações, simplificando o processo.

  ## 1. Nova Tabela: molds (Fôrmas)
  Armazena as informações básicas da fôrma:
    - `id` (uuid, primary key)
    - `name` (text) - Nome da fôrma
    - `description` (text) - Descrição
    - `section_width_meters` (numeric) - Largura da seção em metros
    - `section_height_meters` (numeric) - Altura da seção em metros
    - `reference_measurement_meters` (numeric) - Medida de referência em metros
    - `reference_volume_m3` (numeric) - Volume de referência em m³
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## 2. Nova Tabela: mold_reinforcements (Armaduras da Fôrma)
  Armazena as configurações de cada armadura da fôrma:
    - `id` (uuid, primary key)
    - `mold_id` (uuid, foreign key)
    - `type` (text) - Tipo: longitudinal, transversal, lifting, threaded_bar_hook
    - `identifier` (text) - Identificador (A, B, C, etc.)
    - `position` (text) - Posição da armadura
    - `quantity` (integer) - Quantidade de barras
    - `reference_length_meters` (numeric) - Para longitudinais: comprimento de referência
    - `length_adjustment_meters` (numeric) - Para longitudinais: ajuste de comprimento
    - `stirrup_spacing_meters` (numeric) - Para transversais: espaçamento entre estribos
    - `stirrup_standard_length_meters` (numeric) - Para transversais: comprimento de cada estribo
    - `stirrup_standard_quantity` (integer) - Para transversais: quantidade padrão de estribos
    - `bar_length_meters` (numeric) - Para içamento e ganchos: comprimento da barra
    - `description` (text)
    - `notes` (text)
    - `created_at` (timestamptz)

  ## 3. Atualização da Tabela: products
  Adiciona referência à fôrma:
    - `mold_id` (uuid, foreign key) - Referência à fôrma usada

  ## 4. Segurança
  - RLS habilitado em todas as tabelas
  - Políticas permitem acesso público para leitura/escrita (modo atual do sistema)
*/

-- Criar tabela de fôrmas
CREATE TABLE IF NOT EXISTS molds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  section_width_meters numeric(10, 3),
  section_height_meters numeric(10, 3),
  reference_measurement_meters numeric(10, 3),
  reference_volume_m3 numeric(10, 6),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de armaduras da fôrma
CREATE TABLE IF NOT EXISTS mold_reinforcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mold_id uuid NOT NULL REFERENCES molds(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('longitudinal', 'transversal', 'lifting', 'threaded_bar_hook')),
  identifier text,
  position text,
  quantity integer DEFAULT 1,
  reference_length_meters numeric(10, 3),
  length_adjustment_meters numeric(10, 3),
  stirrup_spacing_meters numeric(10, 3),
  stirrup_standard_length_meters numeric(10, 3),
  stirrup_standard_quantity integer,
  bar_length_meters numeric(10, 3),
  description text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Adicionar campo mold_id na tabela products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'mold_id'
  ) THEN
    ALTER TABLE products ADD COLUMN mold_id uuid REFERENCES molds(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Habilitar RLS
ALTER TABLE molds ENABLE ROW LEVEL SECURITY;
ALTER TABLE mold_reinforcements ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público para molds
CREATE POLICY "Allow public read access to molds"
  ON molds FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to molds"
  ON molds FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to molds"
  ON molds FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to molds"
  ON molds FOR DELETE
  TO public
  USING (true);

-- Políticas de acesso público para mold_reinforcements
CREATE POLICY "Allow public read access to mold_reinforcements"
  ON mold_reinforcements FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to mold_reinforcements"
  ON mold_reinforcements FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to mold_reinforcements"
  ON mold_reinforcements FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to mold_reinforcements"
  ON mold_reinforcements FOR DELETE
  TO public
  USING (true);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_mold_reinforcements_mold_id ON mold_reinforcements(mold_id);
CREATE INDEX IF NOT EXISTS idx_mold_reinforcements_type ON mold_reinforcements(type);
CREATE INDEX IF NOT EXISTS idx_products_mold_id ON products(mold_id);