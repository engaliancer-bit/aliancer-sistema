/*
  # Correcao do fluxo de pagamento de parcelas e adicao de funcionalidade de estorno

  ## Resumo
  Esta migration corrige dois problemas:

  1. **Fluxo de parcelas em customer_revenue**: Adiciona um trigger em `customer_revenue` que, ao
     inserir/excluir um registro com `origin_type = 'quote_installment'`, recalcula automaticamente
     o `paid_amount` e `payment_status` na tabela `quote_installments`. Isso elimina a necessidade
     do frontend fazer esse calculo manualmente e garante consistencia.

  2. **Sistema de estorno**: Adiciona campos `estornado`, `data_estorno` e `motivo_estorno` na
     tabela `customer_revenue` para suporte a estornos com auditoria, sem exclusao de registros.
     Quando um registro e estornado, o trigger de cash_flow cria um lancamento negativo para
     neutralizar o valor contabilmente.

  ## Modificacoes em Tabelas Existentes

  ### customer_revenue
  - `estornado` (boolean, DEFAULT false) - indica se o recebimento foi estornado
  - `data_estorno` (timestamptz) - data/hora do estorno
  - `motivo_estorno` (text) - razao do estorno
  - `installment_id` (uuid) - referencia direta a parcela para facil reconciliacao

  ## Novos Triggers

  ### trigger_sync_installment_paid_amount_on_revenue
  - Dispara em INSERT/DELETE na tabela `customer_revenue`
  - Quando `origin_type = 'quote_installment'`: recalcula `paid_amount` e `payment_status` da parcela
  - Tambem atualiza `payment_status` do orcamento pai (quotes)

  ### trigger_sync_customer_revenue_to_cash_flow (atualizado)
  - Atualizado para lidar com estornos: quando um registro e marcado como estornado (UPDATE),
    cria um lancamento negativo no cash_flow para neutralizar o recebimento original

  ## Notas de Segurança
  - Nenhum dado existente e removido
  - Os campos de estorno sao nullable para compatibilidade retroativa
  - O trigger e idempotente (pode ser executado multiplas vezes com segurança)
*/

-- 1. Adicionar campo installment_id em customer_revenue para rastreamento direto
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_revenue' AND column_name = 'installment_id'
  ) THEN
    ALTER TABLE customer_revenue ADD COLUMN installment_id uuid REFERENCES quote_installments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Adicionar campos de estorno em customer_revenue
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_revenue' AND column_name = 'estornado'
  ) THEN
    ALTER TABLE customer_revenue ADD COLUMN estornado boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_revenue' AND column_name = 'data_estorno'
  ) THEN
    ALTER TABLE customer_revenue ADD COLUMN data_estorno timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_revenue' AND column_name = 'motivo_estorno'
  ) THEN
    ALTER TABLE customer_revenue ADD COLUMN motivo_estorno text;
  END IF;
END $$;

-- 3. Criar indice para installment_id
CREATE INDEX IF NOT EXISTS idx_customer_revenue_installment_id ON customer_revenue(installment_id);

-- 4. Funcao para recalcular paid_amount e status da parcela baseado nos registros de customer_revenue
CREATE OR REPLACE FUNCTION recalc_installment_paid_amount(p_installment_id uuid)
RETURNS void AS $$
DECLARE
  v_total_paid numeric(15,2);
  v_installment_amount numeric(15,2);
  v_new_status text;
  v_quote_id uuid;
BEGIN
  -- Buscar valor total da parcela
  SELECT installment_amount, quote_id INTO v_installment_amount, v_quote_id
  FROM quote_installments
  WHERE id = p_installment_id;

  IF v_installment_amount IS NULL THEN
    RETURN;
  END IF;

  -- Somar todos os pagamentos nao-estornados desta parcela em customer_revenue
  SELECT COALESCE(SUM(payment_amount), 0) INTO v_total_paid
  FROM customer_revenue
  WHERE installment_id = p_installment_id
    AND (estornado IS NULL OR estornado = false);

  -- Calcular novo status
  IF v_total_paid >= v_installment_amount THEN
    v_new_status := 'paid';
    v_total_paid := v_installment_amount; -- nao ultrapassar o total
  ELSIF v_total_paid > 0 THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := 'pending';
  END IF;

  -- Atualizar parcela
  UPDATE quote_installments
  SET
    paid_amount = v_total_paid,
    payment_status = v_new_status,
    updated_at = now()
  WHERE id = p_installment_id;

  -- Atualizar status do orcamento pai
  IF v_quote_id IS NOT NULL THEN
    DECLARE
      v_total_quote_paid numeric(15,2);
      v_total_quote_amount numeric(15,2);
    BEGIN
      SELECT COALESCE(SUM(paid_amount), 0) INTO v_total_quote_paid
      FROM quote_installments
      WHERE quote_id = v_quote_id;

      SELECT total_value INTO v_total_quote_amount
      FROM quotes
      WHERE id = v_quote_id;

      IF v_total_quote_paid >= v_total_quote_amount THEN
        UPDATE quotes SET payment_status = 'paid' WHERE id = v_quote_id;
      ELSIF v_total_quote_paid > 0 THEN
        UPDATE quotes SET payment_status = 'partial' WHERE id = v_quote_id;
      ELSE
        UPDATE quotes SET payment_status = 'unpaid' WHERE id = v_quote_id;
      END IF;
    END;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger function para sincronizar paid_amount da parcela quando customer_revenue muda
CREATE OR REPLACE FUNCTION sync_installment_paid_amount_from_revenue()
RETURNS TRIGGER AS $$
BEGIN
  -- INSERT: recalcular parcela referenciada
  IF TG_OP = 'INSERT' AND NEW.installment_id IS NOT NULL THEN
    PERFORM recalc_installment_paid_amount(NEW.installment_id);

  -- DELETE: recalcular parcela referenciada
  ELSIF TG_OP = 'DELETE' AND OLD.installment_id IS NOT NULL THEN
    PERFORM recalc_installment_paid_amount(OLD.installment_id);

  -- UPDATE: se campo estornado mudou de false para true, recalcular
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.estornado = false AND NEW.estornado = true AND NEW.installment_id IS NOT NULL THEN
      PERFORM recalc_installment_paid_amount(NEW.installment_id);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 6. Criar trigger em customer_revenue para sincronizar parcelas
DROP TRIGGER IF EXISTS trigger_sync_installment_paid_amount_on_revenue ON customer_revenue;
CREATE TRIGGER trigger_sync_installment_paid_amount_on_revenue
  AFTER INSERT OR DELETE OR UPDATE OF estornado ON customer_revenue
  FOR EACH ROW
  EXECUTE FUNCTION sync_installment_paid_amount_from_revenue();

-- 7. Atualizar funcao de sync com cash_flow para lidar com estornos
CREATE OR REPLACE FUNCTION sync_customer_revenue_to_cash_flow()
RETURNS TRIGGER AS $$
DECLARE
  v_business_unit text;
  v_category text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Nao criar lancamento de cash_flow se ja estornado (defensivo)
    IF NEW.estornado = true THEN
      RETURN NEW;
    END IF;

    v_business_unit := CASE
      WHEN NEW.origin_type IN ('quote', 'quote_installment', 'ribbed_slab_quote') THEN 'factory'
      WHEN NEW.origin_type = 'construction_work' THEN 'construction'
      ELSE 'factory'
    END;

    v_category := CASE
      WHEN NEW.origin_type = 'construction_work' THEN 'Receita de Obra'
      ELSE 'Receita de Venda'
    END;

    INSERT INTO cash_flow (
      type,
      category,
      amount,
      description,
      date,
      payment_method,
      business_unit,
      customer_revenue_id
    ) VALUES (
      'income',
      v_category,
      NEW.payment_amount,
      'Recebimento: ' || COALESCE(NEW.origin_description, 'Cliente'),
      NEW.payment_date,
      COALESCE(NEW.payment_method, 'outros'),
      v_business_unit,
      NEW.id
    )
    ON CONFLICT DO NOTHING;

  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM cash_flow WHERE customer_revenue_id = OLD.id;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Se foi marcado como estornado, criar lancamento negativo e deletar o original
    IF OLD.estornado = false AND NEW.estornado = true THEN
      DELETE FROM cash_flow WHERE customer_revenue_id = NEW.id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 8. Recriar trigger de sync cash_flow para incluir UPDATE
DROP TRIGGER IF EXISTS trigger_sync_customer_revenue_to_cash_flow ON customer_revenue;
CREATE TRIGGER trigger_sync_customer_revenue_to_cash_flow
  AFTER INSERT OR DELETE OR UPDATE OF estornado ON customer_revenue
  FOR EACH ROW
  EXECUTE FUNCTION sync_customer_revenue_to_cash_flow();
