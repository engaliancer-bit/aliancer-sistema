/*
  # Correção do Sistema Automático de Entregas

  ## Descrição
  Corrige o erro "record 'v_item' has no field 'item_id'" ao aprovar orçamentos.
  
  ## Problema
  A função `create_delivery_from_quote` estava tentando acessar um campo `item_id` genérico
  que não existe na tabela `quote_items`. A tabela tem campos específicos: `product_id`, 
  `material_id`, e `composition_id`.

  ## Solução
  - Atualiza a função para usar o campo correto baseado no `item_type`
  - Corrige a verificação de estoque para produtos
  - Atualiza a criação de itens de entrega
*/

-- Função corrigida para criar entrega automática de um orçamento
CREATE OR REPLACE FUNCTION create_delivery_from_quote(p_quote_id uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_quote_record RECORD;
  v_delivery_id uuid;
  v_item RECORD;
  v_has_stock boolean := true;
  v_product_id uuid;
BEGIN
  -- Buscar dados do orçamento
  SELECT * INTO v_quote_record
  FROM quotes
  WHERE id = p_quote_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado: %', p_quote_id;
  END IF;
  
  -- Verificar se todos os itens do tipo produto têm estoque
  FOR v_item IN 
    SELECT qi.*
    FROM quote_items qi
    WHERE qi.quote_id = p_quote_id
      AND qi.item_type = 'product'
      AND qi.product_id IS NOT NULL
  LOOP
    -- Verificar estoque do produto
    IF NOT check_product_stock(v_item.product_id, v_item.quantity) THEN
      v_has_stock := false;
      RAISE NOTICE 'Produto % não tem estoque suficiente. Necessário: %, Disponível: %', 
        v_item.product_id, v_item.quantity, 
        (SELECT COALESCE(quantity, 0) FROM inventory WHERE product_id = v_item.product_id);
      EXIT;
    END IF;
  END LOOP;
  
  -- Se não houver estoque completo, não criar entrega
  IF NOT v_has_stock THEN
    UPDATE quotes 
    SET awaiting_production = true
    WHERE id = p_quote_id;
    
    RAISE NOTICE 'Orçamento % marcado como aguardando produção', p_quote_id;
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
    CURRENT_DATE + INTERVAL '7 days', -- Prazo padrão de 7 dias
    'open',
    true
  )
  RETURNING id INTO v_delivery_id;
  
  -- Criar itens da entrega
  INSERT INTO delivery_items (
    delivery_id,
    item_type,
    item_id,
    item_name,
    quantity,
    unit_price
  )
  SELECT
    v_delivery_id,
    qi.item_type,
    COALESCE(qi.product_id, qi.material_id, qi.composition_id),
    COALESCE(
      (SELECT name FROM products WHERE id = qi.product_id),
      (SELECT name FROM materials WHERE id = qi.material_id),
      (SELECT name FROM compositions WHERE id = qi.composition_id)
    ),
    qi.quantity,
    qi.proposed_price
  FROM quote_items qi
  WHERE qi.quote_id = p_quote_id;
  
  -- Atualizar flag do orçamento
  UPDATE quotes 
  SET awaiting_production = false
  WHERE id = p_quote_id;
  
  RAISE NOTICE 'Entrega % criada automaticamente para orçamento %', v_delivery_id, p_quote_id;
  RETURN v_delivery_id;
END;
$$;

-- Atualizar trigger function para melhor tratamento de erros
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
    
    -- Verificar se já existe uma entrega para este orçamento
    IF NOT EXISTS (
      SELECT 1 FROM deliveries WHERE quote_id = NEW.id
    ) THEN
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
          -- Capturar erro e logar
          GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
          RAISE WARNING 'Erro ao criar entrega automática para orçamento %: %', NEW.id, v_error_message;
          -- Não impede a aprovação do orçamento
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
