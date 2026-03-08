/*
  # Criar tabela de itens de ordem de produção

  1. Nova Tabela: production_order_items
    - `id` (uuid, primary key) - Identificador único do item
    - `production_order_id` (uuid, foreign key) - Referência à ordem de produção
    - `quote_item_id` (uuid, foreign key) - Referência ao item do orçamento
    - `item_type` (text) - Tipo do item: 'product', 'material', 'composition'
    - `product_id` (uuid, nullable) - Referência ao produto
    - `material_id` (uuid, nullable) - Referência ao material
    - `composition_id` (uuid, nullable) - Referência à composição
    - `quantity` (integer) - Quantidade total do item
    - `produced_quantity` (integer) - Quantidade já produzida
    - `unit_price` (decimal) - Preço unitário do item
    - `notes` (text, nullable) - Observações do item
    - `created_at` (timestamptz) - Data de criação
    - `updated_at` (timestamptz) - Data de última atualização

  2. Alterações
    - Esta tabela permite que múltiplos itens sejam associados a uma única ordem
    - Elimina a necessidade de criar uma ordem para cada item do orçamento

  3. Segurança
    - Habilita RLS na tabela
    - Políticas para acesso público (compatível com sistema atual)

  4. Índices
    - Índices para melhorar performance nas consultas
*/

-- Criar tabela de itens de ordem de produção
CREATE TABLE IF NOT EXISTS production_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id uuid NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  quote_item_id uuid REFERENCES quote_items(id) ON DELETE SET NULL,
  item_type text NOT NULL CHECK (item_type IN ('product', 'material', 'composition')),
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  material_id uuid REFERENCES materials(id) ON DELETE SET NULL,
  composition_id uuid REFERENCES compositions(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 0,
  produced_quantity integer NOT NULL DEFAULT 0,
  unit_price decimal(10,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE production_order_items ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público
CREATE POLICY "Allow public read access to production_order_items"
  ON production_order_items FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to production_order_items"
  ON production_order_items FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to production_order_items"
  ON production_order_items FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to production_order_items"
  ON production_order_items FOR DELETE
  TO public
  USING (true);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_production_order_items_order_id ON production_order_items(production_order_id);
CREATE INDEX IF NOT EXISTS idx_production_order_items_quote_item_id ON production_order_items(quote_item_id);
CREATE INDEX IF NOT EXISTS idx_production_order_items_product_id ON production_order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_production_order_items_material_id ON production_order_items(material_id);
CREATE INDEX IF NOT EXISTS idx_production_order_items_composition_id ON production_order_items(composition_id);

-- Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_production_order_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_production_order_items_updated_at_trigger ON production_order_items;
CREATE TRIGGER update_production_order_items_updated_at_trigger
  BEFORE UPDATE ON production_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_production_order_items_updated_at();