/*
  # Recriar Módulo de Vendas Completo
  
  Este script substitui o sistema de vendas existente por um sistema mais robusto e completo.

  1. Nova Tabela: services (Serviços)
    - `id` (uuid, primary key)
    - `name` (text) - Nome do serviço
    - `description` (text) - Descrição
    - `unit` (text) - Unidade (hora, dia, m², etc.)
    - `default_price` (numeric) - Preço padrão
    - `is_active` (boolean) - Ativo/Inativo
    - `created_at` (timestamp)
    - `updated_at` (timestamp)

  2. Recriar Tabela: sales (Vendas - Cabeçalho Completo)
    - `id` (uuid, primary key)
    - `sale_number` (text, único) - Número da venda (VND-2026-000123)
    - `sale_date` (date) - Data da venda
    - `customer_id` (uuid, FK -> customers) - Cliente
    - `salesperson` (text) - Vendedor/Responsável
    - `origin_type` (text) - Tipo: 'avulsa', 'orcamento', 'ordem_producao'
    - `quote_id` (uuid, FK -> quotes) - Orçamento vinculado
    - `ribbed_slab_quote_id` (uuid, FK -> ribbed_slab_quotes) - Orçamento laje vinculado
    - `production_order_id` (uuid, FK -> production_orders) - OP vinculada
    - `status` (text) - 'rascunho', 'aberta', 'faturada', 'cancelada'
    - `delivery_required` (boolean) - Requer entrega?
    - `delivery_status` (text) - 'pendente', 'separacao', 'em_rota', 'entregue', 'retornado'
    - `delivery_date` (timestamp) - Data da entrega
    - `delivery_person` (text) - Responsável pela entrega
    - `delivery_location` (text) - Local de entrega
    - `delivery_notes` (text) - Observações da entrega
    - `payment_status` (text) - 'pendente', 'parcial', 'pago', 'cancelado'
    - `subtotal` (numeric) - Total bruto
    - `discount_total` (numeric) - Total de descontos
    - `total` (numeric) - Total líquido
    - `notes` (text) - Observações gerais
    - `created_by` (text) - Criado por
    - `updated_by` (text) - Alterado por
    - `created_at` (timestamp)
    - `updated_at` (timestamp)

  3. Recriar Tabela: sale_items (Itens da Venda)
    - `id` (uuid, primary key)
    - `sale_id` (uuid, FK -> sales)
    - `item_type` (text) - 'produto', 'composicao', 'insumo', 'servico'
    - `product_id` (uuid, FK -> products)
    - `composition_id` (uuid, FK -> compositions)
    - `material_id` (uuid, FK -> materials)
    - `service_id` (uuid, FK -> services)
    - `item_name` (text) - Nome do item
    - `unit` (text) - Unidade
    - `quantity` (numeric) - Quantidade
    - `unit_price` (numeric) - Preço unitário
    - `discount_percent` (numeric) - Desconto %
    - `discount_amount` (numeric) - Desconto R$
    - `subtotal` (numeric) - Subtotal do item
    - `notes` (text) - Observações
    - `created_at` (timestamp)

  4. Recriar Tabela: sale_payments (Formas de Pagamento)
    - `id` (uuid, primary key)
    - `sale_id` (uuid, FK -> sales)
    - `payment_method` (text) - 'dinheiro', 'pix', 'debito', 'credito', 'boleto', 'transferencia', 'cheque', 'a_prazo'
    - `payment_condition` (text) - 'a_vista', 'parcelado'
    - `amount` (numeric) - Valor
    - `installments_count` (integer) - Número de parcelas
    - `first_due_date` (date) - Vencimento 1ª parcela
    - `installment_interval_days` (integer) - Intervalo entre parcelas (dias)
    - `status` (text) - 'pendente', 'confirmado', 'cancelado'
    - `confirmed_at` (timestamp) - Data de confirmação
    - `confirmed_by` (text) - Confirmado por
    - `created_at` (timestamp)

  5. Nova Tabela: sale_payment_installments (Parcelas)
    - `id` (uuid, primary key)
    - `sale_payment_id` (uuid, FK -> sale_payments)
    - `sale_id` (uuid, FK -> sales)
    - `installment_number` (integer) - Número da parcela
    - `due_date` (date) - Vencimento
    - `amount` (numeric) - Valor
    - `status` (text) - 'pendente', 'pago', 'atrasado', 'cancelado'
    - `paid_at` (timestamp) - Data do pagamento
    - `cash_flow_id` (uuid, FK -> cash_flow) - Lançamento financeiro vinculado
    - `created_at` (timestamp)

  6. Segurança
    - Habilitar RLS em todas as tabelas
    - Políticas para acesso público
*/

-- 1. Remover tabelas existentes em ordem
DROP TRIGGER IF EXISTS trigger_set_sale_number ON sales;
DROP TRIGGER IF EXISTS update_sales_updated_at ON sales;
DROP TABLE IF EXISTS sale_payments CASCADE;
DROP TABLE IF EXISTS sale_items CASCADE;
DROP TABLE IF EXISTS sales CASCADE;

-- 2. Criar tabela de Serviços
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  unit text DEFAULT 'un',
  default_price numeric(15,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Criar tabela de Vendas (cabeçalho completo)
CREATE TABLE sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number text UNIQUE NOT NULL,
  sale_date date NOT NULL DEFAULT CURRENT_DATE,
  customer_id uuid REFERENCES customers(id) ON DELETE RESTRICT,
  salesperson text DEFAULT '',
  origin_type text NOT NULL DEFAULT 'avulsa' CHECK (origin_type IN ('avulsa', 'orcamento', 'ordem_producao')),
  quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
  ribbed_slab_quote_id uuid REFERENCES ribbed_slab_quotes(id) ON DELETE SET NULL,
  production_order_id uuid REFERENCES production_orders(id) ON DELETE SET NULL,
  status text DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'aberta', 'faturada', 'cancelada')),
  delivery_required boolean DEFAULT false,
  delivery_status text DEFAULT 'pendente' CHECK (delivery_status IN ('pendente', 'separacao', 'em_rota', 'entregue', 'retornado')),
  delivery_date timestamptz,
  delivery_person text DEFAULT '',
  delivery_location text DEFAULT '',
  delivery_notes text DEFAULT '',
  payment_status text DEFAULT 'pendente' CHECK (payment_status IN ('pendente', 'parcial', 'pago', 'cancelado')),
  subtotal numeric(15,2) DEFAULT 0,
  discount_total numeric(15,2) DEFAULT 0,
  total numeric(15,2) DEFAULT 0,
  notes text DEFAULT '',
  created_by text DEFAULT '',
  updated_by text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Criar tabela de Itens da Venda
CREATE TABLE sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('produto', 'composicao', 'insumo', 'servico')),
  product_id uuid REFERENCES products(id) ON DELETE RESTRICT,
  composition_id uuid REFERENCES compositions(id) ON DELETE RESTRICT,
  material_id uuid REFERENCES materials(id) ON DELETE RESTRICT,
  service_id uuid REFERENCES services(id) ON DELETE RESTRICT,
  item_name text NOT NULL,
  unit text DEFAULT 'un',
  quantity numeric(15,3) NOT NULL DEFAULT 1,
  unit_price numeric(15,2) NOT NULL DEFAULT 0,
  discount_percent numeric(5,2) DEFAULT 0,
  discount_amount numeric(15,2) DEFAULT 0,
  subtotal numeric(15,2) DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- 5. Criar tabela de Formas de Pagamento
CREATE TABLE sale_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  payment_method text NOT NULL CHECK (payment_method IN ('dinheiro', 'pix', 'debito', 'credito', 'boleto', 'transferencia', 'cheque', 'a_prazo')),
  payment_condition text NOT NULL DEFAULT 'a_vista' CHECK (payment_condition IN ('a_vista', 'parcelado')),
  amount numeric(15,2) NOT NULL DEFAULT 0,
  installments_count integer DEFAULT 1,
  first_due_date date,
  installment_interval_days integer DEFAULT 30,
  status text DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'cancelado')),
  confirmed_at timestamptz,
  confirmed_by text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- 6. Criar tabela de Parcelas
CREATE TABLE sale_payment_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_payment_id uuid NOT NULL REFERENCES sale_payments(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  installment_number integer NOT NULL,
  due_date date NOT NULL,
  amount numeric(15,2) NOT NULL DEFAULT 0,
  status text DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'atrasado', 'cancelado')),
  paid_at timestamptz,
  cash_flow_id uuid REFERENCES cash_flow(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sales_quote ON sales(quote_id);
CREATE INDEX idx_sales_ribbed_quote ON sales(ribbed_slab_quote_id);
CREATE INDEX idx_sales_production_order ON sales(production_order_id);
CREATE INDEX idx_sales_date ON sales(sale_date);
CREATE INDEX idx_sales_status ON sales(status);
CREATE INDEX idx_sales_payment_status ON sales(payment_status);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_payments_sale ON sale_payments(sale_id);
CREATE INDEX idx_sale_installments_sale ON sale_payment_installments(sale_id);
CREATE INDEX idx_sale_installments_payment ON sale_payment_installments(sale_payment_id);

-- Função para gerar número de venda sequencial
CREATE OR REPLACE FUNCTION generate_sale_number()
RETURNS text AS $$
DECLARE
  next_num integer;
  year_str text;
  sale_num text;
BEGIN
  year_str := to_char(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(sale_number FROM 'VND-' || year_str || '-(\d+)') AS integer
    )
  ), 0) + 1 INTO next_num
  FROM sales
  WHERE sale_number LIKE 'VND-' || year_str || '-%';
  
  sale_num := 'VND-' || year_str || '-' || LPAD(next_num::text, 6, '0');
  RETURN sale_num;
END;
$$ LANGUAGE plpgsql;

-- Trigger para gerar número automático
CREATE OR REPLACE FUNCTION set_sale_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sale_number IS NULL OR NEW.sale_number = '' THEN
    NEW.sale_number := generate_sale_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_sale_number
  BEFORE INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION set_sale_number();

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sales_updated_at
  BEFORE UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_payment_installments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (acesso público temporário)
CREATE POLICY "Allow public access to services"
  ON services FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public access to sales"
  ON sales FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public access to sale_items"
  ON sale_items FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public access to sale_payments"
  ON sale_payments FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public access to sale_payment_installments"
  ON sale_payment_installments FOR ALL
  USING (true)
  WITH CHECK (true);