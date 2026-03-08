/*
  # Correção Sistema de Entrega Automática com Cálculo Correto de Estoque

  ## Problema Identificado
  A função create_delivery_from_quote estava tentando usar a tabela `inventory` que não existe.
  O estoque real é calculado dinamicamente: Produção - Entregas Finalizadas.

  ## Solução
  1. Criar função para calcular estoque disponível corretamente
  2. Atualizar função de verificação de estoque
  3. Corrigir função de criação de entregas para usar cálculo dinâmico
  
  ## Cálculo de Estoque
  - Estoque Disponível = Total Produzido - Total Entregue (entregas fechadas)
  - Apenas produtos do tipo 'product' são verificados
*/

-- Função para calcular estoque disponível de um produto
CREATE OR REPLACE FUNCTION get_product_available_stock(p_product_id uuid)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  v_produced numeric;
  v_delivered numeric;
  v_available numeric;
BEGIN
  -- Calcular total produzido
  SELECT COALESCE(SUM(quantity), 0)
  INTO v_produced
  FROM production
  WHERE product_id = p_product_id;
  
  -- Calcular total entregue (apenas entregas fechadas)
  SELECT COALESCE(SUM(di.quantity), 0)
  INTO v_delivered
  FROM delivery_items di
  INNER JOIN deliveries d ON d.id = di.delivery_id
  WHERE di.product_id = p_product_id
    AND d.status = 'closed';
  
  -- Calcular disponível
  v_available := v_produced - v_delivered;
  
  RETURN GREATEST(v_available, 0);
END;
$$;

-- Função para verificar estoque disponível de um produto
CREATE OR REPLACE FUNCTION check_product_stock(
  p_product_id uuid,
  p_required_quantity numeric
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_available_stock numeric;
BEGIN
  v_available_stock := get_product_available_stock(p_product_id);
  
  RETURN v_available_stock >= p_required_quantity;
END;
$$;

-- Função principal para criar entrega a partir de orçamento
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
  
  RAISE NOTICE 'Estoque verificado com sucesso. Criando entrega...';
  
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
  
  RAISE NOTICE 'Entrega % criada automaticamente para orçamento % com sucesso completo', v_delivery_id, p_quote_id;
  RETURN v_delivery_id;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erro ao criar entrega para orçamento %: %', p_quote_id, SQLERRM;
    RETURN NULL;
END;
$$;

-- Garantir que a trigger function está atualizada
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

-- Criar uma view útil para visualizar estoque disponível
CREATE OR REPLACE VIEW product_stock_view AS
SELECT 
  p.id as product_id,
  p.name as product_name,
  p.code as product_code,
  COALESCE(prod.total_produced, 0) as total_produced,
  COALESCE(deliv.total_delivered, 0) as total_delivered,
  COALESCE(prod.total_produced, 0) - COALESCE(deliv.total_delivered, 0) as available_stock
FROM products p
LEFT JOIN (
  SELECT product_id, SUM(quantity) as total_produced
  FROM production
  GROUP BY product_id
) prod ON prod.product_id = p.id
LEFT JOIN (
  SELECT di.product_id, SUM(di.quantity) as total_delivered
  FROM delivery_items di
  INNER JOIN deliveries d ON d.id = di.delivery_id
  WHERE d.status = 'closed'
  GROUP BY di.product_id
) deliv ON deliv.product_id = p.id;
