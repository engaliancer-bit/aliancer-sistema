/*
  # Adicionar Fornecedores e Atualizar Insumos

  1. Novas Tabelas
    - `suppliers` (Fornecedores)
      - `id` (uuid, primary key)
      - `name` (text) - Nome do fornecedor
      - `contact` (text) - Contato (telefone/email)
      - `address` (text) - Endereço
      - `notes` (text) - Observações
      - `created_at` (timestamptz)

  2. Alterações na Tabela materials
    - Adicionar coluna `brand` (text) - Marca do insumo
    - Adicionar coluna `supplier_id` (uuid, foreign key) - Referência ao fornecedor
    - Adicionar coluna `unit_cost` (numeric) - Custo unitário

  3. Segurança
    - Habilitar RLS na tabela suppliers
    - Permitir acesso completo para usuários públicos
*/

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact text DEFAULT '',
  address text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'materials' AND column_name = 'brand'
  ) THEN
    ALTER TABLE materials ADD COLUMN brand text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'materials' AND column_name = 'supplier_id'
  ) THEN
    ALTER TABLE materials ADD COLUMN supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'materials' AND column_name = 'unit_cost'
  ) THEN
    ALTER TABLE materials ADD COLUMN unit_cost numeric DEFAULT 0 CHECK (unit_cost >= 0);
  END IF;
END $$;

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to suppliers"
  ON suppliers FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to suppliers"
  ON suppliers FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to suppliers"
  ON suppliers FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from suppliers"
  ON suppliers FOR DELETE
  TO public
  USING (true);

CREATE INDEX IF NOT EXISTS idx_materials_supplier_id ON materials(supplier_id);