/*
  # Atualizar Criação Automática de Entregas com Status Correto

  ## Problema
  Entregas automáticas devem ser criadas com status 'open' (aguardando)
  e não 'in_progress', para não interferirem com o carregamento ativo do usuário.

  ## Solução
  Atualizar a função create_delivery_from_quote para criar entregas com status 'open'.
  O usuário deve iniciar manualmente o carregamento (mudando para 'in_progress').

  ## Fluxo Correto
  1. Sistema cria entrega automática → status: 'open' (aguardando)
  2. Usuário clica para iniciar carregamento → status: 'in_progress' (em progresso)
  3. Usuário finaliza carregamento → status: 'closed' (finalizada)
  4. Usuário pode estornar 'in_progress' → volta para 'open'
*/

-- Atualizar função de criação automática de entregas
CREATE OR REPLACE FUNCTION create_delivery_from_quote(p_quote_id uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_quote_record RECORD;
  v_delivery_id uuid;
  v_item RECORD;
  v_has_stock boolean := true;
  v_product_stock numeric;
BEGIN
  -- Buscar dados do orçamento
  SELECT * INTO v_quote_record
  FROM quotes
  WHERE id = p_quote_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado: %', p_quote_id;
  END IF;
  
  RAISE NOTICE 'Processando orçamento % para cliente %', p_quote_id, v_quote_record.customer_id;
  
  -- Verificar se todos os itens do tipo produto têm estoque
  FOR v_item IN 
    SELECT qi.*
    FROM quote_items qi
    WHERE qi.quote_id = p_quote_id
      AND qi.item_type = 'product'
      AND qi.product_id IS NOT NULL
  LOOP
    -- Buscar estoque disponível usando a função
    v_product_stock := get_product_available_stock(v_item.product_id);
    
    RAISE NOTICE 'Verificando estoque - Produto: %, Necessário: %, Disponível: %', 
      v_item.product_id, v_item.quantity, v_product_stock;
    
    -- Verificar se há estoque suficiente
    IF v_product_stock < v_item.quantity THEN
      v_has_stock := false;
      RAISE NOTICE 'Produto % não tem estoque suficiente (necessário: %, disponível: %)', 
        v_item.product_id, v_item.quantity, v_product_stock;
      EXIT;
    END IF;
  END LOOP;
  
  -- Se não houver estoque completo, não criar entrega
  IF NOT v_has_stock THEN
    UPDATE quotes 
    SET awaiting_production = true
    WHERE id = p_quote_id;
    
    RAISE NOTICE 'Orçamento % marcado como aguardando produção por falta de estoque', p_quote_id;
    RETURN NULL;
  END IF;
  
  RAISE NOTICE 'Estoque verificado com sucesso. Criando entrega com status open (aguardando)...';
  
  -- Criar a entrega com status 'open' (aguardando para ser iniciada pelo usuário)
  INSERT INTO deliveries (
    quote_id,
    customer_id,
    delivery_date,
    status,
    auto_created
  ) VALUES (
    p_quote_id,
    v_quote_record.customer_id,
    CURRENT_DATE + INTERVAL '7 days',
    'open',  -- Status 'open' = aguardando para ser iniciada
    true
  )
  RETURNING id INTO v_delivery_id;
  
  RAISE NOTICE 'Entrega % criada com sucesso (status: open)', v_delivery_id;
  
  -- Criar itens da entrega baseados nos itens do orçamento
  INSERT INTO delivery_items (
    delivery_id,
    product_id,
    quote_item_id,
    quantity,
    unit_price
  )
  SELECT
    v_delivery_id,
    qi.product_id,
    qi.id,
    qi.quantity,
    qi.proposed_price
  FROM quote_items qi
  WHERE qi.quote_id = p_quote_id
    AND qi.item_type = 'product'
    AND qi.product_id IS NOT NULL;
  
  -- Verificar quantos itens foram inseridos
  DECLARE
    v_items_count integer;
  BEGIN
    SELECT COUNT(*) INTO v_items_count
    FROM delivery_items
    WHERE delivery_id = v_delivery_id;
    
    RAISE NOTICE 'Inseridos % itens na entrega %', v_items_count, v_delivery_id;
    
    IF v_items_count = 0 THEN
      RAISE WARNING 'Nenhum item foi adicionado à entrega %! Verificar quote_items', v_delivery_id;
    END IF;
  END;
  
  -- Atualizar flag do orçamento
  UPDATE quotes 
  SET awaiting_production = false
  WHERE id = p_quote_id;
  
  RAISE NOTICE 'Entrega % criada automaticamente para orçamento % - aguardando início do carregamento', v_delivery_id, p_quote_id;
  RETURN v_delivery_id;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erro ao criar entrega para orçamento %: %', p_quote_id, SQLERRM;
    RETURN NULL;
END;
$$;
