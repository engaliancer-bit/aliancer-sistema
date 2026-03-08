/*
  # Correção Completa do Sistema de Criação Automática de Entregas

  ## Descrição
  Corrige completamente o sistema de criação automática de entregas ao aprovar orçamentos.
  
  ## Mudanças
  1. Adiciona coluna customer_id à tabela deliveries
  2. Reescreve a função create_delivery_from_quote para usar a estrutura correta das tabelas
  3. Corrige os campos de delivery_items para usar product_id e quote_item_id
  
  ## Problema Original
  - A função estava tentando inserir customer_id em deliveries (campo inexistente)
  - A função estava tentando inserir item_type, item_id, item_name em delivery_items (campos inexistentes)
  - A estrutura correta usa product_id e quote_item_id
*/

-- Adicionar customer_id à tabela deliveries
ALTER TABLE deliveries 
ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id);

-- Recriar a função com a estrutura correta
CREATE OR REPLACE FUNCTION create_delivery_from_quote(p_quote_id uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_quote_record RECORD;
  v_delivery_id uuid;
  v_item RECORD;
  v_has_stock boolean := true;
  v_product_stock integer;
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
    -- Buscar estoque disponível
    SELECT COALESCE(quantity, 0) INTO v_product_stock
    FROM inventory
    WHERE product_id = v_item.product_id;
    
    RAISE NOTICE 'Verificando estoque - Produto: %, Necessário: %, Disponível: %', 
      v_item.product_id, v_item.quantity, v_product_stock;
    
    -- Verificar se há estoque suficiente
    IF v_product_stock < v_item.quantity THEN
      v_has_stock := false;
      RAISE NOTICE 'Produto % não tem estoque suficiente', v_item.product_id;
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
  
  -- Criar a entrega
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
    'open',
    true
  )
  RETURNING id INTO v_delivery_id;
  
  RAISE NOTICE 'Entrega % criada com sucesso', v_delivery_id;
  
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
  
  -- Verificar se itens foram inseridos
  DECLARE
    v_items_count integer;
  BEGIN
    SELECT COUNT(*) INTO v_items_count
    FROM delivery_items
    WHERE delivery_id = v_delivery_id;
    
    RAISE NOTICE 'Inseridos % itens na entrega %', v_items_count, v_delivery_id;
  END;
  
  -- Atualizar flag do orçamento
  UPDATE quotes 
  SET awaiting_production = false
  WHERE id = p_quote_id;
  
  RAISE NOTICE 'Entrega % criada automaticamente para orçamento % com sucesso completo', v_delivery_id, p_quote_id;
  RETURN v_delivery_id;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erro ao criar entrega para orçamento %: %', p_quote_id, SQLERRM;
    RETURN NULL;
END;
$$;

-- Recriar a trigger function com melhor tratamento
CREATE OR REPLACE FUNCTION auto_create_delivery_on_quote_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_delivery_id uuid;
  v_error_message text;
BEGIN
  -- Verificar se o status mudou para 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    RAISE NOTICE 'Orçamento % aprovado. Iniciando criação automática de entrega...', NEW.id;
    
    -- Verificar se já existe uma entrega para este orçamento
    IF EXISTS (SELECT 1 FROM deliveries WHERE quote_id = NEW.id) THEN
      RAISE NOTICE 'Entrega já existe para orçamento %', NEW.id;
      RETURN NEW;
    END IF;
    
    BEGIN
      -- Tentar criar entrega automática
      v_delivery_id := create_delivery_from_quote(NEW.id);
      
      IF v_delivery_id IS NOT NULL THEN
        RAISE NOTICE 'Entrega % criada automaticamente para orçamento %', v_delivery_id, NEW.id;
      ELSE
        RAISE NOTICE 'Orçamento % aguardando produção - sem estoque suficiente', NEW.id;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
        RAISE WARNING 'Erro ao criar entrega automática para orçamento %: %', NEW.id, v_error_message;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Garantir que a trigger está ativa
DROP TRIGGER IF EXISTS trigger_auto_create_delivery_on_quote_approval ON quotes;
CREATE TRIGGER trigger_auto_create_delivery_on_quote_approval
  AFTER UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_delivery_on_quote_approval();
