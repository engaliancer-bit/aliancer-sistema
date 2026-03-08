/*
  # Sistema Automático de Registro de Contas a Pagar no Fluxo de Caixa

  ## Descrição
  Cria integração automática entre contas a pagar e o fluxo de caixa, permitindo:
  - Registro automático de contas a pagar no fluxo de caixa quando criadas
  - Atualização automática quando a conta é paga
  - Visualização de despesas pendentes e pagas na mesma interface
  - Vínculo bidirecional entre payable_accounts e cash_flow

  ## Alterações

  1. **Adiciona campo payable_account_id em cash_flow**
     - Cria vínculo com contas a pagar

  2. **Triggers automáticos**
     - auto_create_cashflow_for_payable: Cria registro no fluxo ao criar conta a pagar
     - auto_update_cashflow_on_payment: Atualiza fluxo quando conta é paga
     - auto_sync_cashflow_on_payable_update: Sincroniza alterações

  3. **Regras**
     - Contas pendentes aparecem com due_date (vencimento)
     - Contas pagas aparecem com payment_date e conta_caixa
     - Descrição inclui status da parcela
     - Categoria automática: "Conta a Pagar"
*/

-- Adicionar campo payable_account_id à tabela cash_flow
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_flow' AND column_name = 'payable_account_id'
  ) THEN
    ALTER TABLE cash_flow ADD COLUMN payable_account_id uuid REFERENCES payable_accounts(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_cash_flow_payable_account ON cash_flow(payable_account_id);
  END IF;
END $$;

-- Adicionar campo supplier_id à tabela cash_flow se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_flow' AND column_name = 'supplier_id'
  ) THEN
    ALTER TABLE cash_flow ADD COLUMN supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_cash_flow_supplier ON cash_flow(supplier_id);
  END IF;
END $$;

-- Função para criar registro no cash_flow quando uma conta a pagar é criada
CREATE OR REPLACE FUNCTION auto_create_cashflow_for_payable()
RETURNS TRIGGER AS $$
DECLARE
  supplier_name text;
BEGIN
  -- Buscar nome do fornecedor
  SELECT name INTO supplier_name
  FROM suppliers
  WHERE id = NEW.supplier_id;

  -- Criar registro no fluxo de caixa (despesa pendente)
  INSERT INTO cash_flow (
    date,
    type,
    category,
    description,
    amount,
    purchase_id,
    supplier_id,
    payable_account_id,
    due_date,
    reference,
    notes
  ) VALUES (
    NEW.due_date,  -- Usa a data de vencimento como data do registro
    'expense',
    'Conta a Pagar',
    NEW.description || ' - ' || COALESCE(supplier_name, 'Fornecedor não informado'),
    NEW.amount,
    NEW.purchase_id,
    NEW.supplier_id,
    NEW.id,
    NEW.due_date,
    CASE 
      WHEN NEW.total_installments > 1 
      THEN 'Parcela ' || NEW.installment_number || '/' || NEW.total_installments
      ELSE 'Pagamento único'
    END,
    NEW.notes
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para criar cash_flow ao criar conta a pagar
DROP TRIGGER IF EXISTS auto_create_cashflow_for_payable_trigger ON payable_accounts;
CREATE TRIGGER auto_create_cashflow_for_payable_trigger
  AFTER INSERT ON payable_accounts
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_cashflow_for_payable();

-- Função para atualizar cash_flow quando conta a pagar é paga
CREATE OR REPLACE FUNCTION auto_update_cashflow_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  supplier_name text;
BEGIN
  -- Verificar se o status mudou para 'paid'
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'paid') THEN
    
    -- Buscar nome do fornecedor
    SELECT name INTO supplier_name
    FROM suppliers
    WHERE id = NEW.supplier_id;

    -- Atualizar registro existente no cash_flow
    UPDATE cash_flow
    SET
      date = COALESCE(NEW.payment_date, CURRENT_DATE),
      description = NEW.description || ' - PAGO - ' || COALESCE(supplier_name, 'Fornecedor não informado'),
      conta_caixa_id = NEW.cash_account_id,
      notes = COALESCE(NEW.notes, '') || ' | Pago em ' || COALESCE(NEW.payment_date::text, CURRENT_DATE::text)
    WHERE payable_account_id = NEW.id;

  -- Se voltou para pendente, restaurar estado anterior
  ELSIF OLD.payment_status = 'paid' AND NEW.payment_status != 'paid' THEN
    
    -- Buscar nome do fornecedor
    SELECT name INTO supplier_name
    FROM suppliers
    WHERE id = NEW.supplier_id;

    UPDATE cash_flow
    SET
      date = NEW.due_date,
      description = NEW.description || ' - ' || COALESCE(supplier_name, 'Fornecedor não informado'),
      conta_caixa_id = NULL,
      notes = NEW.notes
    WHERE payable_account_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para atualizar cash_flow ao pagar conta
DROP TRIGGER IF EXISTS auto_update_cashflow_on_payment_trigger ON payable_accounts;
CREATE TRIGGER auto_update_cashflow_on_payment_trigger
  AFTER UPDATE ON payable_accounts
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_cashflow_on_payment();

-- Função para sincronizar alterações gerais (valor, vencimento, descrição)
CREATE OR REPLACE FUNCTION auto_sync_cashflow_on_payable_update()
RETURNS TRIGGER AS $$
DECLARE
  supplier_name text;
  status_suffix text;
BEGIN
  -- Buscar nome do fornecedor
  SELECT name INTO supplier_name
  FROM suppliers
  WHERE id = NEW.supplier_id;

  -- Definir sufixo baseado no status
  status_suffix := CASE 
    WHEN NEW.payment_status = 'paid' THEN ' - PAGO'
    WHEN NEW.payment_status = 'overdue' THEN ' - VENCIDO'
    ELSE ''
  END;

  -- Atualizar valores no cash_flow
  UPDATE cash_flow
  SET
    amount = NEW.amount,
    due_date = NEW.due_date,
    date = CASE 
      WHEN NEW.payment_status = 'paid' THEN COALESCE(NEW.payment_date, date)
      ELSE NEW.due_date
    END,
    description = NEW.description || status_suffix || ' - ' || COALESCE(supplier_name, 'Fornecedor não informado'),
    notes = NEW.notes
  WHERE payable_account_id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para sincronizar alterações gerais
DROP TRIGGER IF EXISTS auto_sync_cashflow_on_payable_update_trigger ON payable_accounts;
CREATE TRIGGER auto_sync_cashflow_on_payable_update_trigger
  AFTER UPDATE ON payable_accounts
  FOR EACH ROW
  WHEN (
    OLD.amount IS DISTINCT FROM NEW.amount OR
    OLD.due_date IS DISTINCT FROM NEW.due_date OR
    OLD.description IS DISTINCT FROM NEW.description OR
    OLD.notes IS DISTINCT FROM NEW.notes
  )
  EXECUTE FUNCTION auto_sync_cashflow_on_payable_update();

-- Criar registros retroativos para contas a pagar já existentes que não têm cash_flow
INSERT INTO cash_flow (
  date,
  type,
  category,
  description,
  amount,
  purchase_id,
  supplier_id,
  payable_account_id,
  due_date,
  conta_caixa_id,
  reference,
  notes
)
SELECT
  CASE 
    WHEN pa.payment_status = 'paid' THEN COALESCE(pa.payment_date, pa.due_date)
    ELSE pa.due_date
  END as date,
  'expense' as type,
  'Conta a Pagar' as category,
  pa.description || 
    CASE 
      WHEN pa.payment_status = 'paid' THEN ' - PAGO'
      WHEN pa.payment_status = 'overdue' THEN ' - VENCIDO'
      ELSE ''
    END || ' - ' || COALESCE(s.name, 'Fornecedor não informado') as description,
  pa.amount,
  pa.purchase_id,
  pa.supplier_id,
  pa.id as payable_account_id,
  pa.due_date,
  pa.cash_account_id,
  CASE 
    WHEN pa.total_installments > 1 
    THEN 'Parcela ' || pa.installment_number || '/' || pa.total_installments
    ELSE 'Pagamento único'
  END as reference,
  pa.notes
FROM payable_accounts pa
LEFT JOIN suppliers s ON s.id = pa.supplier_id
WHERE NOT EXISTS (
  SELECT 1 FROM cash_flow cf 
  WHERE cf.payable_account_id = pa.id
);
