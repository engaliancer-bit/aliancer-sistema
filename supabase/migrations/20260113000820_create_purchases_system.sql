/*
  # Sistema de Compras e Importação de NF-e

  1. Novas Tabelas
    - `purchases` (compras/notas fiscais)
      - `id` (uuid, primary key)
      - `invoice_number` (texto) - Número da nota fiscal
      - `invoice_series` (texto) - Série da nota fiscal
      - `invoice_key` (texto) - Chave de acesso da NF-e (44 dígitos)
      - `invoice_date` (date) - Data de emissão da nota
      - `supplier_id` (uuid) - Fornecedor
      - `total_amount` (decimal) - Valor total da nota
      - `xml_content` (text) - Conteúdo do XML (opcional)
      - `notes` (texto) - Observações
      - `created_at` (timestamp)
    
    - `purchase_items` (itens da compra)
      - `id` (uuid, primary key)
      - `purchase_id` (uuid) - Referência à compra
      - `material_id` (uuid) - Referência ao insumo
      - `product_code` (texto) - Código do produto no XML
      - `product_description` (texto) - Descrição do produto no XML
      - `quantity` (decimal) - Quantidade comprada
      - `unit` (texto) - Unidade
      - `unit_price` (decimal) - Valor unitário
      - `total_price` (decimal) - Valor total do item
      - `created_at` (timestamp)

  2. Segurança
    - Habilitar RLS em todas as tabelas
    - Políticas para usuários autenticados

  3. Observações
    - Sistema integrado com material_movements para atualizar estoque
    - Permite importação de XML de NF-e
    - Registra histórico de compras
*/

-- Criar tabela de compras (notas fiscais)
CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL,
  invoice_series text,
  invoice_key text UNIQUE,
  invoice_date date NOT NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  total_amount decimal(15,2) NOT NULL DEFAULT 0,
  xml_content text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Criar tabela de itens da compra
CREATE TABLE IF NOT EXISTS purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  material_id uuid REFERENCES materials(id) ON DELETE SET NULL,
  product_code text,
  product_description text NOT NULL,
  quantity decimal(15,3) NOT NULL,
  unit text NOT NULL,
  unit_price decimal(15,4) NOT NULL,
  total_price decimal(15,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(invoice_date);
CREATE INDEX IF NOT EXISTS idx_purchases_key ON purchases(invoice_key);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_material ON purchase_items(material_id);

-- Habilitar RLS
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;

-- Políticas para purchases
CREATE POLICY "Usuários autenticados podem visualizar compras"
  ON purchases FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir compras"
  ON purchases FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar compras"
  ON purchases FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem excluir compras"
  ON purchases FOR DELETE
  TO authenticated
  USING (true);

-- Políticas para purchase_items
CREATE POLICY "Usuários autenticados podem visualizar itens de compra"
  ON purchase_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir itens de compra"
  ON purchase_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar itens de compra"
  ON purchase_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem excluir itens de compra"
  ON purchase_items FOR DELETE
  TO authenticated
  USING (true);