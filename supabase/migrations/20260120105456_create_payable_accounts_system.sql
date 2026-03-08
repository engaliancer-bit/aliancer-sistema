/*
  # Sistema de Contas a Pagar

  ## Descrição
  Cria o sistema completo de gestão de contas a pagar, permitindo:
  - Registro de contas com vencimento
  - Controle de pagamentos realizados
  - Alertas de vencimento
  - Vinculação com compras e XML importados
  - Parcelamento automático

  ## Novas Tabelas

  1. **payable_accounts** - Contas a pagar
     - `id` (uuid, PK)
     - `purchase_id` (uuid, FK -> purchases) - Compra vinculada
     - `supplier_id` (uuid, FK -> suppliers) - Fornecedor
     - `description` (text) - Descrição da conta
     - `installment_number` (int) - Número da parcela
     - `total_installments` (int) - Total de parcelas
     - `amount` (decimal) - Valor da parcela
     - `due_date` (date) - Data de vencimento
     - `payment_date` (date) - Data do pagamento
     - `payment_status` (text) - pending, paid, overdue
     - `cash_account_id` (uuid, FK -> contas_caixa) - Conta que pagou
     - `cash_flow_id` (uuid, FK -> cash_flow) - Lançamento no fluxo
     - `notes` (text) - Observações
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

  ## Segurança
  - RLS habilitado em todas as tabelas
  - Políticas para acesso público (modo desenvolvimento)
*/

-- Criar tabela de contas a pagar
CREATE TABLE IF NOT EXISTS payable_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid REFERENCES purchases(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE RESTRICT,
  description text NOT NULL,
  installment_number integer DEFAULT 1,
  total_installments integer DEFAULT 1,
  amount decimal(15,2) NOT NULL,
  due_date date NOT NULL,
  payment_date date,
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'overdue')),
  cash_account_id uuid REFERENCES contas_caixa(id) ON DELETE SET NULL,
  cash_flow_id uuid REFERENCES cash_flow(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_payable_accounts_purchase ON payable_accounts(purchase_id);
CREATE INDEX IF NOT EXISTS idx_payable_accounts_supplier ON payable_accounts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_payable_accounts_due_date ON payable_accounts(due_date);
CREATE INDEX IF NOT EXISTS idx_payable_accounts_status ON payable_accounts(payment_status);
CREATE INDEX IF NOT EXISTS idx_payable_accounts_cash_flow ON payable_accounts(cash_flow_id);

-- Habilitar RLS
ALTER TABLE payable_accounts ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público (desenvolvimento)
CREATE POLICY "Allow public read access to payable_accounts"
  ON payable_accounts FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to payable_accounts"
  ON payable_accounts FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to payable_accounts"
  ON payable_accounts FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to payable_accounts"
  ON payable_accounts FOR DELETE
  TO public
  USING (true);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_payable_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_payable_accounts_updated_at_trigger ON payable_accounts;
CREATE TRIGGER update_payable_accounts_updated_at_trigger
  BEFORE UPDATE ON payable_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_payable_accounts_updated_at();

-- Função para atualizar status de contas vencidas
CREATE OR REPLACE FUNCTION update_overdue_payable_accounts()
RETURNS void AS $$
BEGIN
  UPDATE payable_accounts
  SET payment_status = 'overdue'
  WHERE payment_status = 'pending'
    AND due_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Função para criar contas a pagar a partir de uma compra
CREATE OR REPLACE FUNCTION create_payable_accounts_from_purchase(
  purchase_id_param uuid,
  supplier_id_param uuid,
  description_param text,
  total_amount_param decimal,
  installments_param integer,
  first_due_date_param date
)
RETURNS void AS $$
DECLARE
  installment_amount decimal;
  current_due_date date;
  i integer;
BEGIN
  -- Calcular valor de cada parcela
  installment_amount := total_amount_param / installments_param;
  current_due_date := first_due_date_param;

  -- Criar as parcelas
  FOR i IN 1..installments_param LOOP
    INSERT INTO payable_accounts (
      purchase_id,
      supplier_id,
      description,
      installment_number,
      total_installments,
      amount,
      due_date,
      payment_status
    ) VALUES (
      purchase_id_param,
      supplier_id_param,
      description_param || ' - Parcela ' || i || '/' || installments_param,
      i,
      installments_param,
      installment_amount,
      current_due_date,
      'pending'
    );

    -- Adicionar 30 dias para a próxima parcela
    current_due_date := current_due_date + INTERVAL '30 days';
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Função para processar pagamento de conta
CREATE OR REPLACE FUNCTION process_payable_account_payment(
  payable_account_id_param uuid,
  payment_date_param date,
  cash_account_id_param uuid
)
RETURNS uuid AS $$
DECLARE
  payable_record RECORD;
  cash_flow_id_result uuid;
BEGIN
  -- Buscar dados da conta a pagar
  SELECT * INTO payable_record
  FROM payable_accounts
  WHERE id = payable_account_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta a pagar não encontrada';
  END IF;

  IF payable_record.payment_status = 'paid' THEN
    RAISE EXCEPTION 'Conta já está paga';
  END IF;

  -- Criar lançamento no fluxo de caixa
  INSERT INTO cash_flow (
    date,
    type,
    category,
    description,
    amount,
    conta_caixa_id,
    supplier_id
  ) VALUES (
    payment_date_param,
    'expense',
    'Pagamento de Fornecedor',
    payable_record.description,
    payable_record.amount,
    cash_account_id_param,
    payable_record.supplier_id
  ) RETURNING id INTO cash_flow_id_result;

  -- Atualizar conta a pagar
  UPDATE payable_accounts
  SET
    payment_status = 'paid',
    payment_date = payment_date_param,
    cash_account_id = cash_account_id_param,
    cash_flow_id = cash_flow_id_result,
    updated_at = now()
  WHERE id = payable_account_id_param;

  RETURN cash_flow_id_result;
END;
$$ LANGUAGE plpgsql;

-- View para contas vencendo hoje ou atrasadas
CREATE OR REPLACE VIEW payable_accounts_alerts AS
SELECT
  pa.*,
  s.name as supplier_name,
  CASE
    WHEN pa.due_date < CURRENT_DATE THEN 'overdue'
    WHEN pa.due_date = CURRENT_DATE THEN 'due_today'
    WHEN pa.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
    ELSE 'normal'
  END as alert_level,
  CURRENT_DATE - pa.due_date as days_overdue
FROM payable_accounts pa
LEFT JOIN suppliers s ON s.id = pa.supplier_id
WHERE pa.payment_status IN ('pending', 'overdue')
  AND pa.due_date <= CURRENT_DATE + INTERVAL '7 days'
ORDER BY pa.due_date ASC;
