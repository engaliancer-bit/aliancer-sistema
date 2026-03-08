/*
  # Sistema Detalhado de Parcelas por Orçamento

  1. Novas Tabelas
    - `quote_installments` - Parcelas individuais de um orçamento
      - `id` (uuid, chave primária)
      - `quote_id` (uuid, FK referenciando quotes)
      - `installment_number` (integer) - número sequencial (1, 2, 3...)
      - `due_date` (date) - data de vencimento da parcela
      - `installment_amount` (numeric) - valor desta parcela específica
      - `payment_status` (text) - 'pending', 'partial', 'paid'
      - `paid_amount` (numeric) - quanto já foi pago desta parcela
      - `notes` (text) - observações específicas
      - `created_at`, `updated_at` (timestamps)

    - `installment_payments` - Histórico de pagamentos de cada parcela
      - `id` (uuid, chave primária)
      - `installment_id` (uuid, FK para quote_installments)
      - `payment_date` (date) - quando foi pago
      - `payment_amount` (numeric) - quanto foi pago
      - `payment_method` (text) - forma de pagamento
      - `receipt_number` (text) - número único do recibo gerado
      - `is_settlement` (boolean) - true se é quitação completa
      - `notes` (text) - observações do pagamento
      - `created_at` (timestamp)

  2. Modificações em Tabelas Existentes
    - `quotes` adiciona:
      - `has_installment_schedule` (boolean) - usa novo sistema detalhado
      - `auto_generated_dates` (boolean) - se datas foram auto-geradas
      - `installment_count` (integer) - número total de parcelas

  3. Índices para Performance
    - Índices em quote_id, due_date, payment_status

  4. Segurança
    - RLS habilitado com políticas permissivas
    - Triggers para sincronização com customer_revenue
*/

-- Criar tabela de parcelas de orçamentos
CREATE TABLE IF NOT EXISTS quote_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid REFERENCES quotes(id) ON DELETE CASCADE NOT NULL,
  installment_number integer NOT NULL,
  due_date date NOT NULL,
  installment_amount numeric(15,2) NOT NULL,
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid')),
  paid_amount numeric(15,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de pagamentos de parcelas
CREATE TABLE IF NOT EXISTS installment_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id uuid REFERENCES quote_installments(id) ON DELETE CASCADE NOT NULL,
  payment_date date NOT NULL,
  payment_amount numeric(15,2) NOT NULL,
  payment_method text NOT NULL,
  receipt_number text UNIQUE,
  is_settlement boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Adicionar campos à tabela quotes se não existirem
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'has_installment_schedule'
  ) THEN
    ALTER TABLE quotes ADD COLUMN has_installment_schedule boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'auto_generated_dates'
  ) THEN
    ALTER TABLE quotes ADD COLUMN auto_generated_dates boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'installment_count'
  ) THEN
    ALTER TABLE quotes ADD COLUMN installment_count integer DEFAULT 1;
  END IF;
END $$;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_quote_installments_quote_id ON quote_installments(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_installments_due_date ON quote_installments(due_date);
CREATE INDEX IF NOT EXISTS idx_quote_installments_status ON quote_installments(payment_status);
CREATE INDEX IF NOT EXISTS idx_installment_payments_installment_id ON installment_payments(installment_id);
CREATE INDEX IF NOT EXISTS idx_installment_payments_payment_date ON installment_payments(payment_date);

-- Habilitar RLS
ALTER TABLE quote_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE installment_payments ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público (ambiente empresarial interno)
CREATE POLICY "Permitir tudo em quote_installments"
  ON quote_installments
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Permitir tudo em installment_payments"
  ON installment_payments
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Função para atualizar updated_at em quote_installments
CREATE OR REPLACE FUNCTION update_quote_installments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trigger_update_quote_installments_updated_at ON quote_installments;
CREATE TRIGGER trigger_update_quote_installments_updated_at
  BEFORE UPDATE ON quote_installments
  FOR EACH ROW
  EXECUTE FUNCTION update_quote_installments_updated_at();

-- Função para gerar datas de vencimento automaticamente
CREATE OR REPLACE FUNCTION generate_installment_dates(
  p_num_installments integer,
  p_start_date date
)
RETURNS TABLE (installment_number integer, due_date date) AS $$
BEGIN
  FOR i IN 1..p_num_installments LOOP
    RETURN QUERY SELECT 
      i as installment_number,
      p_start_date + (i * interval '30 days')::integer * interval '1 day' as due_date;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Função para sincronizar parcelas com customer_revenue
CREATE OR REPLACE FUNCTION sync_installments_to_customer_revenue()
RETURNS TRIGGER AS $$
DECLARE
  v_quote RECORD;
  v_total_paid numeric(15,2);
  v_total_amount numeric(15,2);
BEGIN
  -- Buscar dados do orçamento
  SELECT q.customer_id, q.total_value, q.origin_type INTO v_quote
  FROM quotes q
  WHERE q.id = NEW.quote_id
  LIMIT 1;

  IF v_quote IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calcular total pago em todas as parcelas
  SELECT COALESCE(SUM(paid_amount), 0) INTO v_total_paid
  FROM quote_installments
  WHERE quote_id = NEW.quote_id;

  -- Determinar status geral
  v_total_amount := v_quote.total_value;
  
  IF v_total_paid >= v_total_amount THEN
    UPDATE quotes SET payment_status = 'paid' WHERE id = NEW.quote_id;
  ELSIF v_total_paid > 0 THEN
    UPDATE quotes SET payment_status = 'partial' WHERE id = NEW.quote_id;
  ELSE
    UPDATE quotes SET payment_status = 'unpaid' WHERE id = NEW.quote_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para sincronizar quando parcela é atualizada
DROP TRIGGER IF EXISTS trigger_sync_installments_on_update ON quote_installments;
CREATE TRIGGER trigger_sync_installments_on_update
  AFTER UPDATE ON quote_installments
  FOR EACH ROW
  EXECUTE FUNCTION sync_installments_to_customer_revenue();

-- Função para atualizar status de parcela após pagamento
CREATE OR REPLACE FUNCTION update_installment_after_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_remaining_amount numeric(15,2);
  v_installment RECORD;
BEGIN
  -- Buscar informações da parcela
  SELECT * INTO v_installment
  FROM quote_installments
  WHERE id = NEW.installment_id;

  -- Calcular quanto ainda falta pagar
  v_remaining_amount := v_installment.installment_amount - v_installment.paid_amount - NEW.payment_amount;

  -- Atualizar parcela
  IF v_remaining_amount <= 0 THEN
    -- Parcela totalmente paga
    UPDATE quote_installments
    SET 
      paid_amount = installment_amount,
      payment_status = 'paid'
    WHERE id = NEW.installment_id;
  ELSE
    -- Parcela parcialmente paga
    UPDATE quote_installments
    SET 
      paid_amount = paid_amount + NEW.payment_amount,
      payment_status = 'partial'
    WHERE id = NEW.installment_id;
  END IF;

  -- Sincronizar com status do orçamento
  PERFORM sync_installments_to_customer_revenue();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar status após pagamento registrado
DROP TRIGGER IF EXISTS trigger_update_installment_after_payment ON installment_payments;
CREATE TRIGGER trigger_update_installment_after_payment
  AFTER INSERT ON installment_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_installment_after_payment();
