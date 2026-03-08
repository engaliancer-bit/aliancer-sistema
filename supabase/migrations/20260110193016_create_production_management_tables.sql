/*
  # Sistema de Gestão de Produção de Artefatos de Concreto

  1. Novas Tabelas
    - `products`
      - `id` (uuid, primary key)
      - `name` (text) - Nome do produto (ex: "Bloco 14x19x39", "Laje Pré-moldada")
      - `description` (text) - Descrição detalhada do produto
      - `unit` (text) - Unidade de medida (ex: "unidade", "m²", "m³")
      - `created_at` (timestamptz) - Data de cadastro
    
    - `production`
      - `id` (uuid, primary key)
      - `product_id` (uuid, foreign key) - Referência ao produto
      - `quantity` (numeric) - Quantidade produzida
      - `production_date` (date) - Data da produção
      - `notes` (text) - Observações sobre a produção
      - `created_at` (timestamptz) - Data de registro no sistema

  2. Segurança
    - Habilitar RLS em todas as tabelas
    - Permitir acesso completo para usuários autenticados
    - Para este sistema de produção, permitir acesso público (sem autenticação) 
      para simplificar o uso na fábrica
*/

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  unit text NOT NULL DEFAULT 'unidade',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity numeric NOT NULL CHECK (quantity > 0),
  production_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE production ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to products"
  ON products FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to products"
  ON products FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to products"
  ON products FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from products"
  ON products FOR DELETE
  TO public
  USING (true);

CREATE POLICY "Allow public read access to production"
  ON production FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to production"
  ON production FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to production"
  ON production FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from production"
  ON production FOR DELETE
  TO public
  USING (true);

CREATE INDEX IF NOT EXISTS idx_production_product_id ON production(product_id);
CREATE INDEX IF NOT EXISTS idx_production_date ON production(production_date);