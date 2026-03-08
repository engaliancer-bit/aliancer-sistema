/*
  # Migração de Orçamentos Existentes para Sistema de Parcelas (Versão Corrigida)

  1. Objetivo
    - Migrar orçamentos com parcelamento definido para o novo sistema detalhado
    - Criar registros em quote_installments para orçamentos já aprovados
    - Calcular datas automaticamente com intervalo de 30 dias
    - Distribuir pagamentos já feitos nas parcelas anteriores
*/

-- Função auxiliar para migrar orçamentos existentes
CREATE OR REPLACE FUNCTION migrate_quotes_to_installments()
RETURNS void AS $$
DECLARE
  v_quote RECORD;
  v_installment_count INTEGER;
  v_start_date DATE;
  v_amount_per_installment NUMERIC(15,2);
  v_remaining_amount NUMERIC(15,2);
  v_paid_per_installment NUMERIC(15,2);
  v_remaining_paid NUMERIC(15,2);
  i INTEGER;
  v_due_date DATE;
  v_paid_amount NUMERIC(15,2);
BEGIN
  -- Processar cada orçamento que tem installments definido
  FOR v_quote IN 
    SELECT 
      id,
      customer_id,
      total_value,
      installment_count,
      created_at::DATE as creation_date,
      COALESCE(paid_amount, 0) as paid_amount,
      has_installment_schedule
    FROM quotes
    WHERE installment_count > 1 
      AND (has_installment_schedule = false OR has_installment_schedule IS NULL)
      AND status = 'approved'
  LOOP
    -- Se já tem cronograma criado, pular
    IF EXISTS (SELECT 1 FROM quote_installments WHERE quote_id = v_quote.id) THEN
      CONTINUE;
    END IF;

    v_installment_count := v_quote.installment_count;
    v_start_date := v_quote.creation_date;
    v_amount_per_installment := v_quote.total_value / v_installment_count;
    v_remaining_amount := v_quote.total_value;
    v_remaining_paid := v_quote.paid_amount;

    -- Criar parcelas
    FOR i IN 1..v_installment_count LOOP
      v_due_date := v_start_date + (i * 30)::INTEGER * INTERVAL '1 day';
      
      -- Calcular valor desta parcela (última parcela recebe o restante)
      IF i = v_installment_count THEN
        v_amount_per_installment := v_remaining_amount;
      END IF;

      -- Calcular quanto já foi pago desta parcela
      IF v_remaining_paid > 0 THEN
        v_paid_amount := LEAST(v_amount_per_installment, v_remaining_paid);
        v_remaining_paid := GREATEST(0, v_remaining_paid - v_paid_amount);
      ELSE
        v_paid_amount := 0;
      END IF;

      -- Inserir parcela
      INSERT INTO quote_installments (
        quote_id,
        installment_number,
        due_date,
        installment_amount,
        payment_status,
        paid_amount,
        notes
      )
      VALUES (
        v_quote.id,
        i,
        v_due_date,
        v_amount_per_installment,
        CASE 
          WHEN v_paid_amount >= v_amount_per_installment THEN 'paid'
          WHEN v_paid_amount > 0 THEN 'partial'
          ELSE 'pending'
        END,
        v_paid_amount,
        'Migrado automaticamente do sistema anterior'
      );

      v_remaining_amount := v_remaining_amount - v_amount_per_installment;
    END LOOP;

    -- Marcar quote como tendo cronograma de parcelas
    UPDATE quotes
    SET 
      has_installment_schedule = true,
      auto_generated_dates = true
    WHERE id = v_quote.id;

  END LOOP;

  RAISE NOTICE 'Migração de parcelas concluída com sucesso';
END;
$$ LANGUAGE plpgsql;

-- Executar migração
SELECT migrate_quotes_to_installments();

-- Deletar função após execução
DROP FUNCTION IF EXISTS migrate_quotes_to_installments();
