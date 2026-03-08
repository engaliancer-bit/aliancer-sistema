/*
  # Sistema de Receitas e Extrato de Clientes

  1. Novas Tabelas
    - `customer_revenue` - Controla receitas/pagamentos de clientes
      - `id` (uuid, primary key)
      - `customer_id` (uuid, referência a customers)
      - `origin_type` (text) - tipo de origem: 'quote', 'ribbed_slab_quote', 'construction_work'
      - `origin_id` (uuid) - ID do orçamento ou obra
      - `origin_description` (text) - descrição da origem
      - `total_amount` (numeric) - valor total devido
      - `paid_amount` (numeric) - valor já pago
      - `balance` (numeric) - saldo devedor
      - `payment_date` (date) - data do pagamento
      - `payment_amount` (numeric) - valor deste pagamento
      - `payment_method` (text) - forma de pagamento
      - `notes` (text) - observações
      - `receipt_number` (text) - número do recibo gerado
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `customer_statement` - Extrato do cliente
      - `id` (uuid, primary key)
      - `customer_id` (uuid, referência a customers)
      - `transaction_type` (text) - 'payment', 'sale', 'adjustment'
      - `transaction_date` (date) - data da transação
      - `description` (text) - descrição
      - `debit_amount` (numeric) - valor de débito
      - `credit_amount` (numeric) - valor de crédito
      - `balance` (numeric) - saldo após transação
      - `reference_type` (text) - tipo de referência
      - `reference_id` (uuid) - ID da referência
      - `revenue_id` (uuid) - referência a customer_revenue
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Segurança
    - Habilitar RLS em todas as tabelas
    - Políticas de acesso público para permitir operações autenticadas
*/

-- Criar tabela de receitas de clientes
CREATE TABLE IF NOT EXISTS customer_revenue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  origin_type text NOT NULL CHECK (origin_type IN ('quote', 'ribbed_slab_quote', 'construction_work')),
  origin_id uuid NOT NULL,
  origin_description text,
  total_amount numeric(15,2) NOT NULL DEFAULT 0,
  paid_amount numeric(15,2) NOT NULL DEFAULT 0,
  balance numeric(15,2) NOT NULL DEFAULT 0,
  payment_date date NOT NULL,
  payment_amount numeric(15,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL,
  notes text,
  receipt_number text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de extrato do cliente
CREATE TABLE IF NOT EXISTS customer_statement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('payment', 'sale', 'adjustment', 'debit')),
  transaction_date date NOT NULL,
  description text NOT NULL,
  debit_amount numeric(15,2) DEFAULT 0,
  credit_amount numeric(15,2) DEFAULT 0,
  balance numeric(15,2) DEFAULT 0,
  reference_type text,
  reference_id uuid,
  revenue_id uuid REFERENCES customer_revenue(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_customer_revenue_customer ON customer_revenue(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_revenue_origin ON customer_revenue(origin_type, origin_id);
CREATE INDEX IF NOT EXISTS idx_customer_statement_customer ON customer_statement(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_statement_date ON customer_statement(transaction_date);

-- Habilitar RLS
ALTER TABLE customer_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_statement ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público (temporário para desenvolvimento)
CREATE POLICY "Permitir tudo em customer_revenue"
  ON customer_revenue
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Permitir tudo em customer_statement"
  ON customer_statement
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_customer_revenue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_customer_statement_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar updated_at
DROP TRIGGER IF EXISTS trigger_update_customer_revenue_updated_at ON customer_revenue;
CREATE TRIGGER trigger_update_customer_revenue_updated_at
  BEFORE UPDATE ON customer_revenue
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_revenue_updated_at();

DROP TRIGGER IF EXISTS trigger_update_customer_statement_updated_at ON customer_statement;
CREATE TRIGGER trigger_update_customer_statement_updated_at
  BEFORE UPDATE ON customer_statement
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_statement_updated_at();

-- Função para lançar no extrato após registrar receita
CREATE OR REPLACE FUNCTION create_statement_entry_from_revenue()
RETURNS TRIGGER AS $$
BEGIN
  -- Inserir lançamento de crédito no extrato
  INSERT INTO customer_statement (
    customer_id,
    transaction_type,
    transaction_date,
    description,
    credit_amount,
    reference_type,
    reference_id,
    revenue_id
  )
  VALUES (
    NEW.customer_id,
    'payment',
    NEW.payment_date,
    CASE 
      WHEN NEW.origin_type = 'quote' OR NEW.origin_type = 'ribbed_slab_quote' THEN
        'Pagamento relacionado a compras de produtos ou materiais de construção.'
      WHEN NEW.origin_type = 'construction_work' THEN
        'Pagamento ' || 
        CASE 
          WHEN NEW.balance = 0 THEN 'de quitação'
          ELSE 'parcial'
        END || 
        ' da Obra: ' || COALESCE(NEW.origin_description, 'N/A')
    END,
    NEW.payment_amount,
    NEW.origin_type,
    NEW.origin_id,
    NEW.id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para criar lançamento no extrato
DROP TRIGGER IF EXISTS trigger_create_statement_from_revenue ON customer_revenue;
CREATE TRIGGER trigger_create_statement_from_revenue
  AFTER INSERT ON customer_revenue
  FOR EACH ROW
  EXECUTE FUNCTION create_statement_entry_from_revenue();