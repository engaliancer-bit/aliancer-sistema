/*
  # Reestrutura sistema de orçamentos para suportar múltiplos itens

  1. Nova Estrutura
    - Tabela `quotes` passa a ser o cabeçalho do orçamento (cliente, data, status geral, formas de pagamento)
    - Nova tabela `quote_items` para armazenar os itens individuais do orçamento
  
  2. Tabela `quote_items`
    - `id` (uuid, primary key)
    - `quote_id` (uuid, foreign key para quotes)
    - `item_type` (text: 'product', 'material', 'composition')
    - `product_id` (uuid, foreign key para products, nullable)
    - `material_id` (uuid, foreign key para materials, nullable)
    - `composition_id` (uuid, foreign key para compositions, nullable)
    - `quantity` (integer)
    - `suggested_price` (decimal)
    - `proposed_price` (decimal)
    - `notes` (text, nullable)
    - `created_at` (timestamp)
    - `updated_at` (timestamp)
  
  3. Modificações na tabela `quotes`
    - Remove campos específicos de itens (item_type, product_id, material_id, composition_id, quantity, suggested_price, proposed_price)
    - Mantém campos do cabeçalho (customer_id, status, quote_type, structure_type, etc.)
    - Adiciona campos de formas de pagamento:
      - `payment_method` (text: 'cash', 'credit_card', 'debit_card', 'pix', 'bank_transfer', 'installments', 'other')
      - `installments` (integer, nullable)
      - `installment_value` (decimal, nullable)
      - `payment_notes` (text, nullable)
      - `discount_percentage` (decimal, nullable)
      - `discount_value` (decimal, nullable)
      - `total_value` (decimal)
  
  4. Segurança
    - Habilita RLS em quote_items
    - Políticas para acesso público (matching com sistema atual)
  
  5. Migração de Dados
    - Migra orçamentos existentes para a nova estrutura
    - Cada orçamento antigo vira um cabeçalho + um item
*/

-- Criar tabela de itens de orçamento
CREATE TABLE IF NOT EXISTS quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('product', 'material', 'composition')),
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  material_id uuid REFERENCES materials(id) ON DELETE SET NULL,
  composition_id uuid REFERENCES compositions(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  suggested_price decimal(10,2) NOT NULL DEFAULT 0,
  proposed_price decimal(10,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público para quote_items
CREATE POLICY "Allow public read access to quote_items"
  ON quote_items FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to quote_items"
  ON quote_items FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to quote_items"
  ON quote_items FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to quote_items"
  ON quote_items FOR DELETE
  TO public
  USING (true);

-- Migrar dados existentes
INSERT INTO quote_items (
  quote_id,
  item_type,
  product_id,
  material_id,
  composition_id,
  quantity,
  suggested_price,
  proposed_price,
  notes
)
SELECT 
  id,
  item_type,
  product_id,
  material_id,
  composition_id,
  quantity,
  suggested_price,
  proposed_price,
  notes
FROM quotes
WHERE item_type IS NOT NULL;

-- Adicionar novos campos de pagamento à tabela quotes
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS installments integer;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS installment_value decimal(10,2);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS payment_notes text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS discount_percentage decimal(5,2);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS discount_value decimal(10,2);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS total_value decimal(10,2) DEFAULT 0;

-- Calcular e definir total_value para orçamentos existentes
UPDATE quotes
SET total_value = quantity * proposed_price
WHERE total_value IS NULL OR total_value = 0;

-- Remover campos específicos de itens da tabela quotes
-- Nota: Mantemos os campos por enquanto para não quebrar o sistema existente
-- Eles serão ignorados pelo novo código e podem ser removidos manualmente após validação

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_product_id ON quote_items(product_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_material_id ON quote_items(material_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_composition_id ON quote_items(composition_id);

-- Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_quote_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_quote_items_updated_at_trigger ON quote_items;
CREATE TRIGGER update_quote_items_updated_at_trigger
  BEFORE UPDATE ON quote_items
  FOR EACH ROW
  EXECUTE FUNCTION update_quote_items_updated_at();
