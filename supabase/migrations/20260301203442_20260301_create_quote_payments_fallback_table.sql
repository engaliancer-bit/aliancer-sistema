/*
  # Tabela Fallback para Pagamentos de Orçamentos

  1. Nova Tabela
    - `quote_payments` - Registros de pagamentos diretos de orçamentos (para compatibilidade)
      - `id` (uuid, chave primária)
      - `quote_id` (uuid, FK para quotes)
      - `payment_amount` (numeric) - valor do pagamento
      - `payment_date` (date) - data do pagamento
      - `payment_method` (text) - forma de pagamento
      - `receipt_number` (text) - número do recibo
      - `notes` (text) - observações
      - `created_at` (timestamp)

  2. Objetivo
    - Compatibilidade com PaymentRegistrationModal do CustomerStatement
    - Fallback para pagamentos que não usam o sistema detalhado de parcelas
    - Sincronização com quote.paid_amount
*/

CREATE TABLE IF NOT EXISTS quote_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid REFERENCES quotes(id) ON DELETE CASCADE NOT NULL,
  payment_amount numeric(15,2) NOT NULL,
  payment_date date NOT NULL,
  payment_method text NOT NULL,
  receipt_number text UNIQUE,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_quote_payments_quote_id ON quote_payments(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_payments_payment_date ON quote_payments(payment_date);

-- Habilitar RLS
ALTER TABLE quote_payments ENABLE ROW LEVEL SECURITY;

-- Política permissiva
CREATE POLICY "Permitir tudo em quote_payments"
  ON quote_payments
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Função para sincronizar pagamentos com quote.paid_amount
CREATE OR REPLACE FUNCTION sync_quote_payments_to_paid_amount()
RETURNS TRIGGER AS $$
DECLARE
  v_total_paid numeric(15,2);
BEGIN
  -- Calcular total pago para este orçamento
  SELECT COALESCE(SUM(payment_amount), 0) INTO v_total_paid
  FROM quote_payments
  WHERE quote_id = NEW.quote_id;

  -- Atualizar quote.paid_amount
  UPDATE quotes
  SET paid_amount = v_total_paid
  WHERE id = NEW.quote_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para sincronizar após inserção ou exclusão
DROP TRIGGER IF EXISTS trigger_sync_quote_payments_insert ON quote_payments;
CREATE TRIGGER trigger_sync_quote_payments_insert
  AFTER INSERT ON quote_payments
  FOR EACH ROW
  EXECUTE FUNCTION sync_quote_payments_to_paid_amount();

DROP TRIGGER IF EXISTS trigger_sync_quote_payments_delete ON quote_payments;
CREATE TRIGGER trigger_sync_quote_payments_delete
  AFTER DELETE ON quote_payments
  FOR EACH ROW
  EXECUTE FUNCTION sync_quote_payments_to_paid_amount();

-- Criar trigger para UPDATE também
DROP TRIGGER IF EXISTS trigger_sync_quote_payments_update ON quote_payments;
CREATE TRIGGER trigger_sync_quote_payments_update
  AFTER UPDATE ON quote_payments
  FOR EACH ROW
  WHEN (NEW.payment_amount IS DISTINCT FROM OLD.payment_amount)
  EXECUTE FUNCTION sync_quote_payments_to_paid_amount();
