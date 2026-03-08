/*
  # Criar Tabela de Movimentação de Insumos

  1. Novas Tabelas
    - `material_movements` (Movimentação de insumos)
      - `id` (uuid, primary key)
      - `material_id` (uuid, foreign key) - Referência ao insumo
      - `quantity` (numeric) - Quantidade movida
      - `movement_type` (text) - Tipo de movimento (entrada ou saída)
      - `notes` (text) - Observações
      - `created_at` (timestamptz) - Data do movimento

  2. Segurança
    - Habilitar RLS na tabela
    - Permitir acesso completo para usuários públicos
*/

CREATE TABLE IF NOT EXISTS material_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  quantity numeric NOT NULL CHECK (quantity > 0),
  movement_type text NOT NULL CHECK (movement_type IN ('entrada', 'saida')),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE material_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to material_movements"
  ON material_movements FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to material_movements"
  ON material_movements FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to material_movements"
  ON material_movements FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from material_movements"
  ON material_movements FOR DELETE
  TO public
  USING (true);

CREATE INDEX IF NOT EXISTS idx_material_movements_material_id ON material_movements(material_id);
CREATE INDEX IF NOT EXISTS idx_material_movements_created_at ON material_movements(created_at);