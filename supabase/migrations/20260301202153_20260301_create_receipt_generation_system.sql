/*
  # Sistema de Geração de Recibos por Parcela

  1. Nova Tabela
    - `payment_receipts` - Registro de recibos gerados
      - `id` (uuid, chave primária)
      - `receipt_number` (text, único)
      - `installment_payment_id` (uuid, FK para installment_payments)
      - `quote_id` (uuid, referência ao orçamento)
      - `customer_id` (uuid, referência ao cliente)
      - `receipt_type` (text) - 'installment' ou 'settlement'
      - `installment_number` (integer) - número da parcela
      - `total_installments` (integer) - total de parcelas do orçamento
      - `due_date` (date) - data de vencimento da parcela
      - `payment_date` (date) - data que foi pago
      - `payment_amount` (numeric) - valor do pagamento
      - `remaining_balance` (numeric) - saldo restante
      - `generated_at` (timestamp)

  2. Funcionalidades
    - Geração automática de número de recibo
    - Sincronização com installment_payments
    - Suporte para recibo consolidado de quitação
*/

-- Criar tabela de recibos
CREATE TABLE IF NOT EXISTS payment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text UNIQUE NOT NULL,
  installment_payment_id uuid REFERENCES installment_payments(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES quotes(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  receipt_type text NOT NULL DEFAULT 'installment' CHECK (receipt_type IN ('installment', 'settlement')),
  installment_number integer,
  total_installments integer,
  due_date date,
  payment_date date NOT NULL,
  payment_amount numeric(15,2) NOT NULL,
  remaining_balance numeric(15,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_payment_receipts_receipt_number ON payment_receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_quote_id ON payment_receipts(quote_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_customer_id ON payment_receipts(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_payment_date ON payment_receipts(payment_date);

-- RLS
ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir tudo em payment_receipts"
  ON payment_receipts
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Função para gerar número de recibo único
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS text AS $$
DECLARE
  v_year text;
  v_month text;
  v_sequence integer;
  v_receipt_number text;
BEGIN
  v_year := TO_CHAR(now(), 'YYYY');
  v_month := TO_CHAR(now(), 'MM');
  
  -- Buscar próximo número sequencial do mês
  SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_number, 10, 5) AS integer)), 0) + 1
  INTO v_sequence
  FROM payment_receipts
  WHERE receipt_number LIKE v_year || v_month || '%';
  
  v_receipt_number := v_year || v_month || LPAD(v_sequence::text, 5, '0');
  
  RETURN v_receipt_number;
END;
$$ LANGUAGE plpgsql;

-- Função para criar recibo após pagamento
CREATE OR REPLACE FUNCTION create_payment_receipt()
RETURNS TRIGGER AS $$
DECLARE
  v_quote RECORD;
  v_receipt_number text;
  v_remaining_balance numeric(15,2);
  v_total_paid numeric(15,2);
  v_is_settlement boolean;
  v_total_installments integer;
BEGIN
  -- Buscar dados do orçamento e cliente
  SELECT q.id, q.customer_id, q.total_value, qi.installment_number,
         (SELECT COUNT(*) FROM quote_installments WHERE quote_id = NEW.installment_id::text)
  INTO v_quote.id, v_quote.customer_id, v_quote.total_value, v_quote.installment_number, v_total_installments
  FROM quote_installments qi
  JOIN quotes q ON q.id = qi.quote_id
  WHERE qi.id = NEW.installment_id;

  -- Gerar número de recibo
  v_receipt_number := generate_receipt_number();

  -- Calcular saldo restante
  SELECT COALESCE(SUM(installment_amount), 0) INTO v_total_paid
  FROM quote_installments
  WHERE quote_id = v_quote.id AND payment_status = 'paid';

  v_remaining_balance := v_quote.total_value - v_total_paid;

  -- Verificar se é quitação completa (última parcela sendo paga)
  v_is_settlement := v_remaining_balance <= 0;

  -- Criar recibo
  INSERT INTO payment_receipts (
    receipt_number,
    installment_payment_id,
    quote_id,
    customer_id,
    receipt_type,
    installment_number,
    total_installments,
    due_date,
    payment_date,
    payment_amount,
    remaining_balance
  )
  VALUES (
    v_receipt_number,
    NEW.id,
    v_quote.id,
    v_quote.customer_id,
    CASE WHEN v_is_settlement THEN 'settlement' ELSE 'installment' END,
    v_quote.installment_number,
    v_total_installments,
    NEW.payment_date,
    NEW.payment_date,
    NEW.payment_amount,
    GREATEST(v_remaining_balance, 0)
  );

  -- Atualizar número de recibo no pagamento
  UPDATE installment_payments
  SET receipt_number = v_receipt_number
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para criar recibo automaticamente
DROP TRIGGER IF EXISTS trigger_create_payment_receipt ON installment_payments;
CREATE TRIGGER trigger_create_payment_receipt
  AFTER INSERT ON installment_payments
  FOR EACH ROW
  EXECUTE FUNCTION create_payment_receipt();

-- Função para gerar recibo de quitação consolidado
CREATE OR REPLACE FUNCTION generate_settlement_receipt(
  p_quote_id uuid
)
RETURNS text AS $$
DECLARE
  v_quote RECORD;
  v_customer RECORD;
  v_receipt_number text;
  v_total_paid numeric(15,2);
BEGIN
  -- Buscar dados do orçamento
  SELECT q.id, q.customer_id, q.total_value, c.name
  INTO v_quote.id, v_quote.customer_id, v_quote.total_value, v_customer.name
  FROM quotes q
  JOIN customers c ON c.id = q.customer_id
  WHERE q.id = p_quote_id;

  -- Gerar número especial de quitação
  v_receipt_number := 'QUI-' || TO_CHAR(now(), 'YYYY') || TO_CHAR(now(), 'MM') || 
                      LPAD((SELECT COUNT(*) + 1 FROM payment_receipts WHERE receipt_type = 'settlement')::text, 5, '0');

  -- Calcular total pago
  SELECT COALESCE(SUM(installment_amount), 0) INTO v_total_paid
  FROM quote_installments
  WHERE quote_id = p_quote_id;

  -- Criar recibo de quitação
  INSERT INTO payment_receipts (
    receipt_number,
    quote_id,
    customer_id,
    receipt_type,
    payment_date,
    payment_amount,
    remaining_balance
  )
  VALUES (
    v_receipt_number,
    p_quote_id,
    v_quote.customer_id,
    'settlement',
    now()::date,
    v_total_paid,
    0
  );

  RETURN v_receipt_number;
END;
$$ LANGUAGE plpgsql;
