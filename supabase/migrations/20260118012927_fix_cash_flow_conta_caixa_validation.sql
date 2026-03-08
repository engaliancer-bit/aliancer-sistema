/*
  # Corrigir Validação de conta_caixa_id no Trigger de Cash Flow

  1. Problema Identificado
    - O trigger auto_create_cash_flow_on_receivable_paid estava tentando inserir valores inválidos
      no campo conta_caixa_id da tabela cash_flow
    - Valores como "caixa_proprio" ou IDs de bancos causavam violação de foreign key constraint
    - O campo conta_caixa_id em cash_flow tem constraint REFERENCES contas_caixa(id)

  2. Solução Implementada
    - Modificar a função do trigger para validar se conta_caixa_id é um UUID válido
    - Verificar se o UUID existe na tabela contas_caixa antes de inserir
    - Se não for válido ou não existir, inserir NULL
    - Isso permite que recebimentos sejam confirmados mesmo sem conta_caixa específica

  3. Comportamento Esperado
    - Quando conta_caixa_id for um UUID válido de contas_caixa: inserir normalmente
    - Quando conta_caixa_id for "caixa_proprio", ID de banco, ou inválido: inserir NULL
    - O sistema continua funcionando sem erros de foreign key constraint
*/

-- Atualizar função para validar conta_caixa_id antes de inserir no cash_flow
CREATE OR REPLACE FUNCTION public.auto_create_cash_flow_on_receivable_paid()
RETURNS TRIGGER AS $$
DECLARE
  v_venda record;
  v_cash_flow_id uuid;
  v_business_unit text;
  v_valid_conta_caixa_id uuid;
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

    -- Validar se conta_caixa_id é um UUID válido que existe na tabela contas_caixa
    v_valid_conta_caixa_id := NULL;
    
    IF NEW.conta_caixa_id IS NOT NULL THEN
      -- Verificar se o UUID existe na tabela contas_caixa
      BEGIN
        SELECT id INTO v_valid_conta_caixa_id
        FROM public.contas_caixa
        WHERE id = NEW.conta_caixa_id
          AND ativo = true
        LIMIT 1;
      EXCEPTION WHEN OTHERS THEN
        -- Se houver erro (UUID inválido, etc), manter NULL
        v_valid_conta_caixa_id := NULL;
        RAISE NOTICE 'conta_caixa_id inválido ou não encontrado: %. Usando NULL no cash_flow.', NEW.conta_caixa_id;
      END;
    END IF;

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
      v_valid_conta_caixa_id,  -- Usar conta validada ou NULL
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

    RAISE NOTICE 'Movimento de caixa % criado para recebível % com conta_caixa_id %', 
      v_cash_flow_id, NEW.id, COALESCE(v_valid_conta_caixa_id::text, 'NULL');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;