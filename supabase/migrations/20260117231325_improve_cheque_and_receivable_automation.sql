/*
  # Melhorias nas Automações de Cheques e Recebíveis

  1. Ajustes
    - Atualizar trigger de cash_flow para incluir conta_caixa_id
    - Criar função para sincronizar status de cheque com recebível
    - Melhorar função de replanejamento

  2. Regras de Negócio
    - Quando recebível com forma_pagamento='cheque' virar 'pago':
      - Criar entrada no caixa
      - Atualizar status_cheque para 'compensado' (se existir)
    - Quando cheque_details.status_cheque virar 'compensado':
      - Atualizar receivable.status para 'pago'
*/

-- 1. Atualizar função de criação de cash_flow para incluir conta_caixa
CREATE OR REPLACE FUNCTION public.auto_create_cash_flow_on_receivable_paid()
RETURNS TRIGGER AS $$
DECLARE
  v_venda record;
  v_cash_flow_id uuid;
  v_business_unit text;
BEGIN
  -- Só processa quando status mudou para 'pago'
  IF NEW.status = 'pago' AND (OLD.status IS NULL OR OLD.status != 'pago') THEN

    -- Buscar dados da venda
    SELECT * INTO v_venda
    FROM public.unified_sales
    WHERE id = NEW.venda_id;

    -- Determinar business_unit do cash_flow baseado na unidade
    v_business_unit := CASE
      WHEN NEW.unidade_negocio = 'Fábrica' OR NEW.unidade_negocio = 'Fábrica - Laje' THEN 'factory'
      WHEN NEW.unidade_negocio = 'Escritório de Engenharia' THEN 'engineering'
      WHEN NEW.unidade_negocio = 'Construtora' THEN 'construction'
      ELSE 'factory'
    END;

    -- Criar movimento no fluxo de caixa
    INSERT INTO public.cash_flow (
      date,
      type,
      category,
      description,
      amount,
      business_unit,
      conta_caixa_id,
      created_at
    ) VALUES (
      COALESCE(NEW.data_recebimento::date, CURRENT_DATE),
      'income',
      'Venda',
      'Recebimento Venda ' || COALESCE(v_venda.sale_number, 'S/N') ||
      ' - Parcela ' || NEW.parcela_numero ||
      CASE
        WHEN NEW.forma_pagamento IS NOT NULL THEN ' (' || NEW.forma_pagamento || ')'
        ELSE ''
      END ||
      ' - ' || COALESCE(v_venda.customer_name_snapshot, 'Cliente') ||
      ' [' || COALESCE(v_venda.unidade_negocio, 'N/A') || ']',
      COALESCE(NEW.valor_recebido, NEW.valor_parcela),
      v_business_unit,
      NEW.conta_caixa_id,
      now()
    )
    RETURNING id INTO v_cash_flow_id;

    -- Vincular movimento ao recebível
    NEW.cash_flow_id := v_cash_flow_id;

    -- Se for cheque, atualizar status do cheque para compensado
    IF NEW.forma_pagamento = 'cheque' THEN
      UPDATE public.cheque_details
      SET status_cheque = 'compensado',
          data_compensacao = COALESCE(NEW.data_recebimento::date, CURRENT_DATE),
          updated_at = now()
      WHERE receivable_id = NEW.id
        AND status_cheque != 'compensado';
    END IF;

    RAISE NOTICE 'Movimento de caixa % criado para recebível %', v_cash_flow_id, NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar trigger
DROP TRIGGER IF EXISTS trigger_auto_create_cash_flow ON public.receivables;
CREATE TRIGGER trigger_auto_create_cash_flow
  BEFORE UPDATE ON public.receivables
  FOR EACH ROW
  WHEN (NEW.status = 'pago')
  EXECUTE FUNCTION public.auto_create_cash_flow_on_receivable_paid();

-- 2. Criar trigger para sincronizar status de cheque com recebível
CREATE OR REPLACE FUNCTION public.sync_cheque_status_to_receivable()
RETURNS TRIGGER AS $$
BEGIN
  -- Quando cheque for marcado como compensado, marcar recebível como pago
  IF NEW.status_cheque = 'compensado' AND (OLD.status_cheque IS NULL OR OLD.status_cheque != 'compensado') THEN
    UPDATE public.receivables
    SET 
      status = 'pago',
      data_recebimento = COALESCE(NEW.data_compensacao, CURRENT_DATE)::timestamptz,
      valor_recebido = COALESCE(valor_recebido, valor_parcela),
      updated_at = now()
    WHERE id = NEW.receivable_id
      AND status != 'pago';

    RAISE NOTICE 'Recebível % marcado como pago devido a compensação de cheque', NEW.receivable_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_cheque_to_receivable ON public.cheque_details;
CREATE TRIGGER trigger_sync_cheque_to_receivable
  AFTER UPDATE ON public.cheque_details
  FOR EACH ROW
  WHEN (NEW.status_cheque = 'compensado')
  EXECUTE FUNCTION public.sync_cheque_status_to_receivable();

-- 3. Melhorar função de replanejamento
CREATE OR REPLACE FUNCTION public.replan_receivables(
  p_venda_id uuid,
  p_new_receivables jsonb
)
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
  v_receivable jsonb;
  v_paid_count int;
  v_cancelled_count int;
  v_new_id uuid;
BEGIN
  -- Contar recebíveis já pagos
  SELECT COUNT(*)
  INTO v_paid_count
  FROM public.receivables
  WHERE venda_id = p_venda_id
    AND status = 'pago';

  -- Cancelar recebíveis não pagos (mantém os pagos)
  UPDATE public.receivables
  SET
    status = 'cancelado',
    observacoes = COALESCE(observacoes, '') || ' | Cancelado por replanejamento em ' || NOW()::text,
    updated_at = NOW()
  WHERE venda_id = p_venda_id
    AND status NOT IN ('pago', 'cancelado');

  GET DIAGNOSTICS v_cancelled_count = ROW_COUNT;

  -- Criar novos recebíveis
  FOR v_receivable IN SELECT * FROM jsonb_array_elements(p_new_receivables)
  LOOP
    INSERT INTO public.receivables (
      venda_id,
      parcela_numero,
      descricao,
      valor_parcela,
      data_vencimento,
      forma_pagamento,
      status,
      unidade_negocio,
      observacoes
    ) VALUES (
      p_venda_id,
      (v_receivable->>'parcela_numero')::integer,
      v_receivable->>'descricao',
      (v_receivable->>'valor_parcela')::numeric,
      (v_receivable->>'data_vencimento')::date,
      v_receivable->>'forma_pagamento',
      COALESCE(v_receivable->>'status', 'pendente'),
      v_receivable->>'unidade_negocio',
      v_receivable->>'observacoes'
    )
    RETURNING id INTO v_new_id;
  END LOOP;

  -- Retornar resultado
  v_result := jsonb_build_object(
    'success', true,
    'paid_kept', v_paid_count,
    'cancelled', v_cancelled_count,
    'message', 'Replanejamento concluído. ' || v_paid_count || ' parcelas pagas mantidas, ' || v_cancelled_count || ' canceladas.'
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
