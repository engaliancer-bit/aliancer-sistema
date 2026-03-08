/*
  # Sincronizar customer_revenue com cash_flow

  ## Objetivo
  Garantir que todos os pagamentos registrados em customer_revenue apareçam automaticamente
  no cash_flow (Receitas/Despesas da Fábrica), evitando duplicidade e mantendo o extrato
  do cliente consistente independente de onde o lançamento foi feito.

  ## Alterações

  ### 1. Nova coluna em cash_flow
  - `customer_revenue_id` (uuid, nullable, unique): vincula um registro de cash_flow
    ao seu registro de origem em customer_revenue. A constraint UNIQUE impede fisicamente
    qualquer duplicidade no banco.

  ### 2. Triggers de sincronização
  - INSERT em customer_revenue → cria automaticamente um registro correspondente em cash_flow
    com type='income', business_unit='factory', category='receita_cliente'
  - UPDATE em customer_revenue → atualiza o registro espelho em cash_flow (valor, data, descrição)
  - DELETE em customer_revenue → remove o registro espelho em cash_flow

  ### 3. Notas importantes
  - Registros com customer_revenue_id preenchido são gerenciados pelo trigger e não devem
    ser editados/excluídos manualmente na tela de Receitas/Despesas
  - O trigger de customer_statement (extrato do cliente) continua funcionando normalmente
*/

-- 1. Adicionar coluna de vínculo com constraint UNIQUE para evitar duplicidade
ALTER TABLE cash_flow
  ADD COLUMN IF NOT EXISTS customer_revenue_id uuid REFERENCES customer_revenue(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cash_flow_customer_revenue_id_key'
      AND conrelid = 'cash_flow'::regclass
  ) THEN
    ALTER TABLE cash_flow
      ADD CONSTRAINT cash_flow_customer_revenue_id_key UNIQUE (customer_revenue_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cash_flow_customer_revenue_id
  ON cash_flow(customer_revenue_id)
  WHERE customer_revenue_id IS NOT NULL;

-- 2. Função para sincronizar INSERT de customer_revenue → cash_flow
CREATE OR REPLACE FUNCTION sync_customer_revenue_insert_to_cash_flow()
RETURNS TRIGGER AS $$
DECLARE
  v_category text;
BEGIN
  -- Só sincroniza se houve um pagamento registrado
  IF NEW.payment_amount IS NULL OR NEW.payment_amount = 0 THEN
    RETURN NEW;
  END IF;

  -- Determina a descrição baseada na origem
  v_category := 'receita_cliente';

  INSERT INTO cash_flow (
    date,
    type,
    category,
    description,
    amount,
    notes,
    business_unit,
    customer_revenue_id
  ) VALUES (
    COALESCE(NEW.payment_date, CURRENT_DATE),
    'income',
    v_category,
    COALESCE(NEW.origin_description, 'Recebimento de Cliente'),
    NEW.payment_amount,
    CASE
      WHEN NEW.receipt_number IS NOT NULL
        THEN 'Recibo: ' || NEW.receipt_number
      ELSE NEW.notes
    END,
    'factory',
    NEW.id
  )
  ON CONFLICT (customer_revenue_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Função para sincronizar UPDATE de customer_revenue → cash_flow
CREATE OR REPLACE FUNCTION sync_customer_revenue_update_to_cash_flow()
RETURNS TRIGGER AS $$
BEGIN
  -- Se não há valor pago, remove o espelho se existir
  IF NEW.payment_amount IS NULL OR NEW.payment_amount = 0 THEN
    DELETE FROM cash_flow WHERE customer_revenue_id = NEW.id;
    RETURN NEW;
  END IF;

  -- Atualiza o espelho se já existir
  UPDATE cash_flow
  SET
    date        = COALESCE(NEW.payment_date, CURRENT_DATE),
    description = COALESCE(NEW.origin_description, 'Recebimento de Cliente'),
    amount      = NEW.payment_amount,
    notes       = CASE
                    WHEN NEW.receipt_number IS NOT NULL
                      THEN 'Recibo: ' || NEW.receipt_number
                    ELSE NEW.notes
                  END
  WHERE customer_revenue_id = NEW.id;

  -- Se não existia espelho ainda (ex: payment_amount era 0), cria agora
  IF NOT FOUND THEN
    INSERT INTO cash_flow (
      date,
      type,
      category,
      description,
      amount,
      notes,
      business_unit,
      customer_revenue_id
    ) VALUES (
      COALESCE(NEW.payment_date, CURRENT_DATE),
      'income',
      'receita_cliente',
      COALESCE(NEW.origin_description, 'Recebimento de Cliente'),
      NEW.payment_amount,
      CASE
        WHEN NEW.receipt_number IS NOT NULL
          THEN 'Recibo: ' || NEW.receipt_number
        ELSE NEW.notes
      END,
      'factory',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Criação dos triggers
DROP TRIGGER IF EXISTS trigger_sync_customer_revenue_insert ON customer_revenue;
CREATE TRIGGER trigger_sync_customer_revenue_insert
  AFTER INSERT ON customer_revenue
  FOR EACH ROW
  EXECUTE FUNCTION sync_customer_revenue_insert_to_cash_flow();

DROP TRIGGER IF EXISTS trigger_sync_customer_revenue_update ON customer_revenue;
CREATE TRIGGER trigger_sync_customer_revenue_update
  AFTER UPDATE OF payment_amount, payment_date, origin_description, receipt_number, notes
  ON customer_revenue
  FOR EACH ROW
  EXECUTE FUNCTION sync_customer_revenue_update_to_cash_flow();
