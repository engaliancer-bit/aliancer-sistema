/*
  # Sistema Automático de Ordens de Produção
  
  ## Descrição
  Cria automaticamente ordens de produção quando um orçamento é aprovado
  no módulo de Indústria de Artefatos.
  
  ## Como Funciona
  1. Quando um orçamento tem status mudado para "approved"
  2. Sistema verifica TODOS os produtos do orçamento
  3. Para cada produto SEM estoque suficiente:
     - Cria ordem de produção automaticamente
     - Vincula à quote para rastreamento
     - Define prioridade baseada no prazo de entrega
  
  ## Regras de Negócio
  - Só cria ordem se: estoque atual < quantidade necessária
  - Quantidade da ordem = quantidade necessária - estoque disponível
  - Prioridade "high" se prazo < 15 dias, senão "normal"
  - Observações incluem: orçamento, cliente, produto
  
  ## Vantagens
  - ✅ Processo 100% automático no módulo de Indústria
  - ✅ Não depende de vínculo manual na Construtora
  - ✅ Evita esquecer de produzir produtos
  - ✅ Priorização inteligente baseada em prazo
*/

-- Função para criar ordens de produção automaticamente quando orçamento for aprovado
CREATE OR REPLACE FUNCTION auto_create_production_orders_on_quote_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_quote_item RECORD;
  v_product_record RECORD;
  v_inventory_stock numeric;
  v_quantity_to_produce numeric;
  v_order_number text;
  v_next_number int;
  v_priority text;
  v_customer_name text;
  v_orders_created int := 0;
BEGIN
  -- Só processar se o status mudou para 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    RAISE NOTICE '=== CRIAÇÃO AUTOMÁTICA DE ORDENS ===';
    RAISE NOTICE 'Orçamento aprovado: %', NEW.id;
    
    -- Buscar nome do cliente para observações
    SELECT c.name INTO v_customer_name
    FROM customers c
    WHERE c.id = NEW.customer_id;
    
    -- Para cada item do orçamento que é PRODUTO
    FOR v_quote_item IN 
      SELECT 
        qi.id as quote_item_id,
        qi.product_id,
        qi.quantity,
        p.name as product_name,
        p.code as product_code
      FROM quote_items qi
      JOIN products p ON p.id = qi.product_id
      WHERE qi.quote_id = NEW.id
        AND qi.item_type = 'product'
        AND qi.product_id IS NOT NULL
    LOOP
      
      RAISE NOTICE 'Verificando produto: % (Qtd necessária: %)', 
        v_quote_item.product_name, 
        v_quote_item.quantity;
      
      -- Verificar estoque disponível
      SELECT COALESCE(quantity, 0) 
      INTO v_inventory_stock
      FROM inventory
      WHERE product_id = v_quote_item.product_id;
      
      RAISE NOTICE 'Estoque disponível: %', COALESCE(v_inventory_stock, 0);
      
      -- Calcular quantidade a produzir
      v_quantity_to_produce := v_quote_item.quantity - COALESCE(v_inventory_stock, 0);
      
      -- Se precisa produzir (estoque insuficiente)
      IF v_quantity_to_produce > 0 THEN
        
        RAISE NOTICE 'NECESSÁRIO PRODUZIR: % unidades', v_quantity_to_produce;
        
        -- Verificar se já existe ordem para este item do orçamento
        IF NOT EXISTS (
          SELECT 1 
          FROM production_orders po
          WHERE po.quote_id = NEW.id
            AND po.product_id = v_quote_item.product_id
            AND po.status != 'cancelled'
        ) THEN
          
          -- Gerar próximo número de ordem
          SELECT COALESCE(
            MAX(CAST(SUBSTRING(order_number FROM '[0-9]+') AS INTEGER)), 0
          ) + 1
          INTO v_next_number
          FROM production_orders
          WHERE order_number ~ '^OP-[0-9]+$';
          
          v_order_number := 'OP-' || v_next_number;
          
          -- Definir prioridade baseada no prazo de entrega
          IF NEW.delivery_deadline IS NOT NULL AND 
             NEW.delivery_deadline::date <= (CURRENT_DATE + INTERVAL '15 days')::date THEN
            v_priority := 'high';
          ELSE
            v_priority := 'normal';
          END IF;
          
          RAISE NOTICE 'CRIANDO ORDEM: % | Produto: % | Quantidade: % | Prioridade: %',
            v_order_number,
            v_quote_item.product_name,
            v_quantity_to_produce,
            v_priority;
          
          -- Criar ordem de produção
          INSERT INTO production_orders (
            order_number,
            quote_id,
            product_id,
            quantity,
            priority,
            status,
            notes,
            deadline
          ) VALUES (
            v_order_number,
            NEW.id,
            v_quote_item.product_id,
            v_quantity_to_produce,
            v_priority,
            'open',
            format(
              'Ordem automática - Orçamento aprovado | Cliente: %s | Produto: %s (%s)',
              COALESCE(v_customer_name, 'N/A'),
              v_quote_item.product_name,
              COALESCE(v_quote_item.product_code, 'sem código')
            ),
            NEW.delivery_deadline
          );
          
          v_orders_created := v_orders_created + 1;
          
          RAISE NOTICE 'ORDEM CRIADA COM SUCESSO: %', v_order_number;
          
        ELSE
          RAISE NOTICE 'Ordem já existe para este produto neste orçamento';
        END IF;
        
      ELSE
        RAISE NOTICE 'Estoque suficiente, ordem não necessária';
      END IF;
      
    END LOOP;
    
    RAISE NOTICE '=== RESUMO ===';
    RAISE NOTICE 'Total de ordens criadas: %', v_orders_created;
    
    IF v_orders_created > 0 THEN
      RAISE NOTICE '✅ Ordens de produção criadas automaticamente!';
    ELSE
      RAISE NOTICE 'ℹ️ Nenhuma ordem necessária (estoque suficiente)';
    END IF;
    
  END IF;
  
  RETURN NEW;
  
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Erro ao criar ordens automáticas: % | %', SQLERRM, SQLSTATE;
  -- Não bloquear a aprovação do orçamento mesmo se houver erro
  RETURN NEW;
END;
$$;

-- Criar trigger para criação automática de ordens
DROP TRIGGER IF EXISTS trigger_auto_create_production_orders ON quotes;
CREATE TRIGGER trigger_auto_create_production_orders
  AFTER UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_production_orders_on_quote_approval();

-- Adicionar campo quote_id em production_orders se não existir
ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_production_orders_quote_id 
  ON production_orders(quote_id) 
  WHERE quote_id IS NOT NULL;

-- Comentários de documentação
COMMENT ON FUNCTION auto_create_production_orders_on_quote_approval() IS 
'Cria automaticamente ordens de produção quando um orçamento é aprovado no módulo de Indústria de Artefatos. Para cada produto sem estoque suficiente, uma ordem é criada com prioridade baseada no prazo de entrega.';

COMMENT ON TRIGGER trigger_auto_create_production_orders ON quotes IS 
'Trigger que dispara a criação automática de ordens de produção quando um orçamento é aprovado';

COMMENT ON COLUMN production_orders.quote_id IS 
'Referência ao orçamento que originou esta ordem de produção (para ordens automáticas)';
