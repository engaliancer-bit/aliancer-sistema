/*
  # Adicionar categorização de itens de compra e controle de ativos

  1. Alterações
    - Adiciona coluna `item_category` à tabela `purchase_items` para categorizar itens como:
      * 'insumo' - Itens que compõem o estoque de insumos
      * 'servico' - Serviços contratados (custo de produção)
      * 'manutencao' - Manutenção (custo de produção)
      * 'investimento' - Investimentos e patrimônio (ativo/passivo)
    
  2. Nova Tabela: assets
    - `id` (uuid, primary key)
    - `name` (text) - Nome do ativo
    - `description` (text) - Descrição
    - `purchase_item_id` (uuid) - Referência ao item de compra
    - `acquisition_date` (date) - Data de aquisição
    - `acquisition_value` (numeric) - Valor de aquisição
    - `current_value` (numeric) - Valor atual
    - `depreciation_rate` (numeric) - Taxa de depreciação anual (%)
    - `status` (text) - Status: 'ativo', 'inativo', 'vendido', 'descartado'
    - `notes` (text) - Observações
    - `created_at` (timestamptz)
  
  3. Security
    - Enable RLS on `assets` table
    - Add policies for authenticated users
*/

-- Adicionar coluna de categoria aos itens de compra
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_items' AND column_name = 'item_category'
  ) THEN
    ALTER TABLE purchase_items ADD COLUMN item_category text DEFAULT 'insumo' CHECK (item_category IN ('insumo', 'servico', 'manutencao', 'investimento'));
  END IF;
END $$;

-- Criar tabela de ativos (patrimônio)
CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  purchase_item_id uuid REFERENCES purchase_items(id) ON DELETE SET NULL,
  acquisition_date date NOT NULL,
  acquisition_value numeric NOT NULL DEFAULT 0,
  current_value numeric NOT NULL DEFAULT 0,
  depreciation_rate numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'vendido', 'descartado')),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- Policies para assets
CREATE POLICY "Users can view assets"
  ON assets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert assets"
  ON assets FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update assets"
  ON assets FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete assets"
  ON assets FOR DELETE
  TO authenticated
  USING (true);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_purchase_items_category ON purchase_items(item_category);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_acquisition_date ON assets(acquisition_date);