/*
  # Sistema Automático de Entregas

  ## Descrição
  Este sistema cria automaticamente entregas pendentes quando:
  1. Um orçamento é aprovado E há estoque suficiente
  2. Uma ordem de produção é concluída (para orçamentos que estavam aguardando produção)

  ## Novas Funções
  - `check_product_stock(product_id, quantity)` - Verifica se há estoque suficiente
  - `create_delivery_from_quote(quote_id)` - Cria entrega automática de um orçamento
  - `auto_create_delivery_on_quote_approval()` - Trigger function para orçamento aprovado
  - `auto_create_delivery_on_production_complete()` - Trigger function para produção concluída

  ## Alterações nas Tabelas
  - Adiciona campo `awaiting_production` em quotes para rastrear orçamentos aguardando produção
  - Adiciona campo `auto_created` em deliveries para identificar entregas criadas automaticamente

  ## Triggers
  - Trigger quando quote.status muda para 'approved'
  - Trigger quando production.status muda para 'completed'

  ## Regras de Negócio
  1. Ao aprovar orçamento:
     - Verifica estoque de cada item
     - Se todos os itens têm estoque: cria entrega automaticamente
     - Se falta estoque: marca orçamento como `awaiting_production`
  
  2. Ao concluir produção:
     - Busca orçamentos aguardando essa produção
     - Verifica novamente o estoque
     - Cria entregas para orçamentos que agora têm estoque completo
*/

-- Adicionar campos de controle
ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS awaiting_production boolean DEFAULT false;

ALTER TABLE deliveries 
ADD COLUMN IF NOT EXISTS auto_created boolean DEFAULT false;

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
  -- Buscar estoque disponível do produto
  SELECT COALESCE(quantity, 0)
  INTO v_available_stock
  FROM inventory
  WHERE product_id = p_product_id;
  
  -- Retornar true se há estoque suficiente
  RETURN v_available_stock >= p_required_quantity;
END;
$$;

-- Função para criar entrega automática de um orçamento
CREATE OR REPLACE FUNCTION create_delivery_from_quote(p_quote_id uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_quote_record RECORD;
  v_delivery_id uuid;
  v_item RECORD;
  v_has_stock boolean := true;
BEGIN
  -- Buscar dados do orçamento
  SELECT * INTO v_quote_record
  FROM quotes
  WHERE id = p_quote_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado: %', p_quote_id;
  END IF;
  
  -- Verificar se todos os itens têm estoque
  FOR v_item IN 
    SELECT qi.*
    FROM quote_items qi
    WHERE qi.quote_id = p_quote_id
      AND qi.item_type = 'product'
  LOOP
    IF NOT check_product_stock(v_item.item_id, v_item.quantity) THEN
      v_has_stock := false;
      EXIT;
    END IF;
  END LOOP;
  
  -- Se não houver estoque completo, não criar entrega
  IF NOT v_has_stock THEN
    UPDATE quotes 
    SET awaiting_production = true
    WHERE id = p_quote_id;
    
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
    qi.item_id,
    qi.item_name,
    qi.quantity,
    qi.unit_price
  FROM quote_items qi
  WHERE qi.quote_id = p_quote_id;
  
  -- Atualizar flag do orçamento
  UPDATE quotes 
  SET awaiting_production = false
  WHERE id = p_quote_id;
  
  RETURN v_delivery_id;
END;
$$;

-- Trigger function: Criar entrega quando orçamento for aprovado
CREATE OR REPLACE FUNCTION auto_create_delivery_on_quote_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_delivery_id uuid;
BEGIN
  -- Verificar se o status mudou para 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    -- Verificar se já existe uma entrega para este orçamento
    IF NOT EXISTS (
      SELECT 1 FROM deliveries WHERE quote_id = NEW.id
    ) THEN
      -- Tentar criar entrega automática
      v_delivery_id := create_delivery_from_quote(NEW.id);
      
      IF v_delivery_id IS NOT NULL THEN
        RAISE NOTICE 'Entrega criada automaticamente: %', v_delivery_id;
      ELSE
        RAISE NOTICE 'Orçamento % aguardando produção', NEW.id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para orçamento aprovado
DROP TRIGGER IF EXISTS trigger_auto_create_delivery_on_quote_approval ON quotes;
CREATE TRIGGER trigger_auto_create_delivery_on_quote_approval
  AFTER UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_delivery_on_quote_approval();

-- Trigger function: Criar entrega quando produção for concluída
CREATE OR REPLACE FUNCTION auto_create_delivery_on_production_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_quote_record RECORD;
  v_delivery_id uuid;
BEGIN
  -- Verificar se a produção foi concluída
  IF NEW.produced_quantity >= NEW.total_quantity AND 
     (OLD.produced_quantity IS NULL OR OLD.produced_quantity < OLD.total_quantity) THEN
    
    -- Buscar orçamentos aprovados que estão aguardando produção
    -- e que têm este produto
    FOR v_quote_record IN
      SELECT DISTINCT q.id
      FROM quotes q
      INNER JOIN quote_items qi ON qi.quote_id = q.id
      WHERE q.status = 'approved'
        AND q.awaiting_production = true
        AND qi.item_type = 'product'
        AND qi.item_id = NEW.product_id
        AND NOT EXISTS (
          SELECT 1 FROM deliveries d WHERE d.quote_id = q.id
        )
    LOOP
      -- Tentar criar entrega para este orçamento
      v_delivery_id := create_delivery_from_quote(v_quote_record.id);
      
      IF v_delivery_id IS NOT NULL THEN
        RAISE NOTICE 'Entrega criada após produção: % para orçamento %', 
                     v_delivery_id, v_quote_record.id;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para produção concluída
DROP TRIGGER IF EXISTS trigger_auto_create_delivery_on_production_complete ON production;
CREATE TRIGGER trigger_auto_create_delivery_on_production_complete
  AFTER UPDATE ON production
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_delivery_on_production_complete();

-- Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_quotes_awaiting_production 
  ON quotes(awaiting_production) 
  WHERE awaiting_production = true;

CREATE INDEX IF NOT EXISTS idx_deliveries_auto_created 
  ON deliveries(auto_created) 
  WHERE auto_created = true;

CREATE INDEX IF NOT EXISTS idx_deliveries_quote_id 
  ON deliveries(quote_id);
