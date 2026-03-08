/*
  # Sistema de Vendas e Fluxo de Caixa

  1. Novas Tabelas
    - `payment_methods` - Métodos de pagamento disponíveis (Dinheiro, PIX, Cartão, etc.)
      - `id` (uuid, chave primária)
      - `name` (text) - Nome do método
      - `active` (boolean) - Ativo ou inativo
      - `created_at` (timestamptz)

    - `sales` - Registro de vendas
      - `id` (uuid, chave primária)
      - `sale_number` (text, único) - Número da venda
      - `customer_id` (uuid) - FK para customers
      - `quote_id` (uuid, opcional) - FK para quotes se vier de orçamento
      - `sale_date` (date) - Data da venda
      - `subtotal` (decimal) - Subtotal dos itens
      - `discount` (decimal) - Desconto aplicado
      - `total` (decimal) - Total da venda
      - `notes` (text) - Observações
      - `status` (text) - pending, completed, cancelled
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `sale_items` - Itens da venda
      - `id` (uuid, chave primária)
      - `sale_id` (uuid) - FK para sales
      - `product_id` (uuid, opcional) - FK para products
      - `production_order_id` (uuid, opcional) - FK para production_orders
      - `description` (text) - Descrição do item
      - `quantity` (decimal) - Quantidade vendida
      - `unit` (text) - Unidade (m³, kg, un, etc.)
      - `unit_price` (decimal) - Preço unitário
      - `total` (decimal) - Total do item
      - `created_at` (timestamptz)

    - `sale_payments` - Pagamentos da venda
      - `id` (uuid, chave primária)
      - `sale_id` (uuid) - FK para sales
      - `payment_method_id` (uuid) - FK para payment_methods
      - `amount` (decimal) - Valor do pagamento
      - `payment_date` (date) - Data do pagamento
      - `notes` (text) - Observações
      - `created_at` (timestamptz)

    - `cash_flow` - Fluxo de caixa
      - `id` (uuid, chave primária)
      - `date` (date) - Data do movimento
      - `type` (text) - income (receita) ou expense (despesa)
      - `category` (text) - Categoria do movimento
      - `description` (text) - Descrição
      - `amount` (decimal) - Valor
      - `payment_method_id` (uuid, opcional) - FK para payment_methods
      - `sale_id` (uuid, opcional) - FK para sales se for receita de venda
      - `purchase_id` (uuid, opcional) - FK para pending_purchases se for despesa
      - `cost_category_id` (uuid, opcional) - FK para cost_categories
      - `reference` (text) - Referência externa (número de documento, etc.)
      - `notes` (text) - Observações
      - `created_at` (timestamptz)

  2. Segurança
    - RLS habilitado em todas as tabelas
    - Políticas permissivas para acesso autenticado (ambiente empresarial interno)
*/

-- Criar tabela de métodos de pagamento
CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Inserir métodos de pagamento padrão
INSERT INTO payment_methods (name) VALUES
  ('Dinheiro'),
  ('PIX'),
  ('Cartão de Crédito'),
  ('Cartão de Débito'),
  ('Boleto'),
  ('Transferência Bancária'),
  ('Cheque')
ON CONFLICT DO NOTHING;

-- Criar tabela de vendas
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number text UNIQUE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
  sale_date date NOT NULL DEFAULT CURRENT_DATE,
  subtotal decimal(15,2) NOT NULL DEFAULT 0,
  discount decimal(15,2) DEFAULT 0,
  total decimal(15,2) NOT NULL DEFAULT 0,
  notes text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de itens da venda
CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  production_order_id uuid REFERENCES production_orders(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity decimal(15,3) NOT NULL,
  unit text NOT NULL DEFAULT 'un',
  unit_price decimal(15,2) NOT NULL,
  total decimal(15,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Criar tabela de pagamentos da venda
CREATE TABLE IF NOT EXISTS sale_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  payment_method_id uuid NOT NULL REFERENCES payment_methods(id),
  amount decimal(15,2) NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Criar tabela de fluxo de caixa
CREATE TABLE IF NOT EXISTS cash_flow (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL DEFAULT CURRENT_DATE,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  category text NOT NULL,
  description text NOT NULL,
  amount decimal(15,2) NOT NULL,
  payment_method_id uuid REFERENCES payment_methods(id) ON DELETE SET NULL,
  sale_id uuid REFERENCES sales(id) ON DELETE SET NULL,
  purchase_id uuid REFERENCES pending_purchases(id) ON DELETE SET NULL,
  cost_category_id uuid REFERENCES cost_categories(id) ON DELETE SET NULL,
  reference text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_sale ON sale_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_cash_flow_date ON cash_flow(date);
CREATE INDEX IF NOT EXISTS idx_cash_flow_type ON cash_flow(type);
CREATE INDEX IF NOT EXISTS idx_cash_flow_sale ON cash_flow(sale_id);

-- Habilitar RLS
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_flow ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para payment_methods
CREATE POLICY "Métodos de pagamento visíveis para todos"
  ON payment_methods FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Métodos de pagamento editáveis por autenticados"
  ON payment_methods FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Políticas RLS para sales
CREATE POLICY "Vendas visíveis para todos"
  ON sales FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Vendas editáveis por autenticados"
  ON sales FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Vendas atualizáveis por autenticados"
  ON sales FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Vendas deletáveis por autenticados"
  ON sales FOR DELETE
  TO authenticated
  USING (true);

-- Políticas RLS para sale_items
CREATE POLICY "Itens de venda visíveis para todos"
  ON sale_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Itens de venda editáveis por autenticados"
  ON sale_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Políticas RLS para sale_payments
CREATE POLICY "Pagamentos visíveis para todos"
  ON sale_payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Pagamentos editáveis por autenticados"
  ON sale_payments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Políticas RLS para cash_flow
CREATE POLICY "Fluxo de caixa visível para todos"
  ON cash_flow FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Fluxo de caixa editável por autenticados"
  ON cash_flow FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at em sales
DROP TRIGGER IF EXISTS update_sales_updated_at ON sales;
CREATE TRIGGER update_sales_updated_at
  BEFORE UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Função para gerar número de venda automático
CREATE OR REPLACE FUNCTION generate_sale_number()
RETURNS text AS $$
DECLARE
  next_number integer;
  year_suffix text;
BEGIN
  year_suffix := TO_CHAR(CURRENT_DATE, 'YY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(sale_number FROM 'VD-(\d+)-') AS integer)), 0) + 1
  INTO next_number
  FROM sales
  WHERE sale_number LIKE 'VD-%-' || year_suffix;
  
  RETURN 'VD-' || LPAD(next_number::text, 5, '0') || '-' || year_suffix;
END;
$$ LANGUAGE plpgsql;

-- Trigger para gerar número de venda automaticamente
CREATE OR REPLACE FUNCTION set_sale_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sale_number IS NULL OR NEW.sale_number = '' THEN
    NEW.sale_number := generate_sale_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_sale_number ON sales;
CREATE TRIGGER trigger_set_sale_number
  BEFORE INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION set_sale_number();