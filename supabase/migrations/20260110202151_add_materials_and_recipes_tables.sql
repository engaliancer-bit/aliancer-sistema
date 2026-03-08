/*
  # Adicionar Tabelas de Insumos e Traços

  1. Novas Tabelas
    - `materials` (Insumos/Matérias-primas)
      - `id` (uuid, primary key)
      - `name` (text) - Nome do insumo (ex: "Cimento", "Areia")
      - `description` (text) - Descrição do insumo
      - `unit` (text) - Unidade de medida (ex: "kg", "litro")
      - `created_at` (timestamptz)
    
    - `recipes` (Traços/Receitas)
      - `id` (uuid, primary key)
      - `name` (text) - Nome do traço (ex: "Traço 1:2:3")
      - `description` (text) - Descrição do traço
      - `created_at` (timestamptz)
    
    - `recipe_items` (Itens do traço)
      - `id` (uuid, primary key)
      - `recipe_id` (uuid, foreign key) - Referência ao traço
      - `material_id` (uuid, foreign key) - Referência ao insumo
      - `quantity` (numeric) - Quantidade do insumo por traço
      - `created_at` (timestamptz)

  2. Alterações
    - Adicionar coluna `recipe_id` na tabela `products`
    - Criar índices para melhorar performance

  3. Segurança
    - Habilitar RLS em todas as tabelas
    - Permitir acesso completo para usuários públicos (conforme sistema existente)
*/

CREATE TABLE IF NOT EXISTS materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  unit text NOT NULL DEFAULT 'kg',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recipe_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  quantity numeric NOT NULL CHECK (quantity > 0),
  created_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'recipe_id'
  ) THEN
    ALTER TABLE products ADD COLUMN recipe_id uuid REFERENCES recipes(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to materials"
  ON materials FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to materials"
  ON materials FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to materials"
  ON materials FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from materials"
  ON materials FOR DELETE
  TO public
  USING (true);

CREATE POLICY "Allow public read access to recipes"
  ON recipes FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to recipes"
  ON recipes FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to recipes"
  ON recipes FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from recipes"
  ON recipes FOR DELETE
  TO public
  USING (true);

CREATE POLICY "Allow public read access to recipe_items"
  ON recipe_items FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to recipe_items"
  ON recipe_items FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to recipe_items"
  ON recipe_items FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from recipe_items"
  ON recipe_items FOR DELETE
  TO public
  USING (true);

CREATE INDEX IF NOT EXISTS idx_recipe_items_recipe_id ON recipe_items(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_items_material_id ON recipe_items(material_id);
CREATE INDEX IF NOT EXISTS idx_products_recipe_id ON products(recipe_id);