/*
  # Adicionar Peso aos Produtos e Rastreamento de Consumo de Materiais

  1. Alterações na Tabela products
    - Adicionar coluna `total_weight` (numeric) - Peso total do produto em kg

  2. Nova Tabela product_material_weights
    - `id` (uuid, primary key)
    - `product_id` (uuid, foreign key) - Referência ao produto
    - `material_id` (uuid, foreign key) - Referência ao material/insumo
    - `weight_per_unit` (numeric) - Peso do material usado por unidade de produto (em kg)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  3. Segurança
    - Habilitar RLS na tabela product_material_weights
    - Adicionar políticas de acesso para usuários autenticados
*/

-- Adicionar coluna de peso total aos produtos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'total_weight'
  ) THEN
    ALTER TABLE products ADD COLUMN total_weight numeric DEFAULT 0;
  END IF;
END $$;

-- Criar tabela para armazenar o peso de cada material por produto
CREATE TABLE IF NOT EXISTS product_material_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  material_id uuid REFERENCES materials(id) ON DELETE CASCADE NOT NULL,
  weight_per_unit numeric DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(product_id, material_id)
);

-- Habilitar RLS
ALTER TABLE product_material_weights ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_material_weights' AND policyname = 'Users can view product material weights'
  ) THEN
    CREATE POLICY "Users can view product material weights"
      ON product_material_weights FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_material_weights' AND policyname = 'Users can insert product material weights'
  ) THEN
    CREATE POLICY "Users can insert product material weights"
      ON product_material_weights FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_material_weights' AND policyname = 'Users can update product material weights'
  ) THEN
    CREATE POLICY "Users can update product material weights"
      ON product_material_weights FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_material_weights' AND policyname = 'Users can delete product material weights'
  ) THEN
    CREATE POLICY "Users can delete product material weights"
      ON product_material_weights FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;