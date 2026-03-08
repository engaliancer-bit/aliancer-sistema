/*
  # Corrigir Trigger de Ordens Automáticas para Composições
  
  ## Problema Identificado
  A função `auto_create_production_orders_on_quote_approval` estava tentando acessar
  a coluna `qi.item_name` que NÃO EXISTE na tabela `quote_items`, causando falha
  silenciosa do trigger.
  
  ## Solução
  - Remover referência a `qi.item_name` do SELECT principal
  - Buscar nomes de produtos/composições usando JOINs apropriados
  - Sistema agora busca nomes corretamente de:
    - products.name (para produtos)
    - compositions.name (para composições)
  
  ## Impacto
  - ✅ Trigger agora funciona corretamente para PRODUTOS
  - ✅ Trigger agora funciona corretamente para COMPOSIÇÕES
  - ✅ Ordens são criadas automaticamente ao aprovar orçamento
  - ✅ Sistema abre composições e verifica produtos internos
  
  ## Teste
  1. Aprove um orçamento com composição
  2. Sistema deve criar ordens para produtos sem estoque
  3. Verifique em: Produção → Ordens de Produção
*/

-- Recriar função corrigida
CREATE OR REPLACE FUNCTION auto_create_production_orders_on_quote_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_quote_item RECORD;
  v_composition_item RECORD;
  v_product_record RECORD;
  v_inventory_stock numeric;
  v_quantity_to_produce numeric;
  v_quantity_required numeric;
  v_order_number text;
  v_next_number int;
  v_priority text;
  v_customer_name text;
  v_orders_created int := 0;
  v_composition_name text;
  v_item_display_name text;
BEGIN
  -- Só processar se o status mudou para 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    RAISE NOTICE '════════════════════════════════════════════════════════';
    RAISE NOTICE '🔄 CRIAÇÃO AUTOMÁTICA DE ORDENS DE PRODUÇÃO';
    RAISE NOTICE '════════════════════════════════════════════════════════';
    RAISE NOTICE 'Orçamento aprovado: %', NEW.id;
    
    -- Buscar nome do cliente para observações
    SELECT c.name INTO v_customer_name
    FROM customers c
    WHERE c.id = NEW.customer_id;
    
    RAISE NOTICE 'Cliente: %', COALESCE(v_customer_name, 'N/A');
    RAISE NOTICE '────────────────────────────────────────────────────────';
    
    -- Para cada item do orçamento
    FOR v_quote_item IN 
      SELECT 
        qi.id as quote_item_id,
        qi.item_type,
        qi.product_id,
        qi.composition_id,
        qi.quantity,
        -- Buscar nome do produto ou composição
        COALESCE(p.name, c.name, 'Item') as item_name
      FROM quote_items qi
      LEFT JOIN products p ON p.id = qi.product_id
      LEFT JOIN compositions c ON c.id = qi.composition_id
      WHERE qi.quote_id = NEW.id
    LOOP
      
      RAISE NOTICE '';
      RAISE NOTICE '📦 PROCESSANDO ITEM DO ORÇAMENTO';
      RAISE NOTICE '   Tipo: % | Nome: % | Qtd: %', 
        v_quote_item.item_type,
        v_quote_item.item_name,
        v_quote_item.quantity;
      
      -- ============================================================
      -- CASO 1: ITEM É UM PRODUTO DIRETO
      -- ============================================================
      IF v_quote_item.item_type = 'product' AND v_quote_item.product_id IS NOT NULL THEN
        
        RAISE NOTICE '   ├─ Tipo: PRODUTO DIRETO';
        
        -- Buscar dados do produto
        SELECT p.name, p.code 
        INTO v_product_record
        FROM products p 
        WHERE p.id = v_quote_item.product_id;
        
        -- Verificar estoque disponível (calcular do production)
        SELECT COALESCE(SUM(
          CASE 
            WHEN stage = 'finished' THEN quantity
            ELSE 0
          END
        ), 0)
        INTO v_inventory_stock
        FROM production
        WHERE product_id = v_quote_item.product_id;
        
        RAISE NOTICE '   ├─ Produto: % (%)', 
          v_product_record.name,
          COALESCE(v_product_record.code, 'sem código');
        RAISE NOTICE '   ├─ Necessário: % un.', v_quote_item.quantity;
        RAISE NOTICE '   ├─ Estoque: % un.', COALESCE(v_inventory_stock, 0);
        
        -- Calcular quantidade a produzir
        v_quantity_to_produce := v_quote_item.quantity - COALESCE(v_inventory_stock, 0);
        
        -- Se precisa produzir (estoque insuficiente)
        IF v_quantity_to_produce > 0 THEN
          
          RAISE NOTICE '   ├─ ⚠️  FALTA ESTOQUE: % un.', v_quantity_to_produce;
          
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
            
            RAISE NOTICE '   └─ ✅ CRIANDO ORDEM: %', v_order_number;
            RAISE NOTICE '      ├─ Produto: %', v_product_record.name;
            RAISE NOTICE '      ├─ Quantidade: % un.', v_quantity_to_produce;
            RAISE NOTICE '      └─ Prioridade: %', v_priority;
            
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
                'Ordem automática - Orçamento | Cliente: %s | Produto: %s (%s)',
                COALESCE(v_customer_name, 'N/A'),
                v_product_record.name,
                COALESCE(v_product_record.code, 'sem código')
              ),
              NEW.delivery_deadline
            );
            
            v_orders_created := v_orders_created + 1;
            
          ELSE
            RAISE NOTICE '   └─ ℹ️  Ordem já existe para este produto';
          END IF;
          
        ELSE
          RAISE NOTICE '   └─ ✅ ESTOQUE SUFICIENTE (não precisa produzir)';
        END IF;
        
      -- ============================================================
      -- CASO 2: ITEM É UMA COMPOSIÇÃO
      -- ============================================================
      ELSIF v_quote_item.item_type = 'composition' AND v_quote_item.composition_id IS NOT NULL THEN
        
        -- Buscar nome da composição
        SELECT c.name INTO v_composition_name
        FROM compositions c
        WHERE c.id = v_quote_item.composition_id;
        
        RAISE NOTICE '   ├─ Tipo: COMPOSIÇÃO';
        RAISE NOTICE '   ├─ Nome: %', COALESCE(v_composition_name, 'N/A');
        RAISE NOTICE '   ├─ 🔍 ABRINDO COMPOSIÇÃO PARA VERIFICAR PRODUTOS...';
        
        -- Para cada item PRODUTO dentro da composição
        FOR v_composition_item IN 
          SELECT 
            ci.product_id,
            ci.quantity as quantity_per_unit,
            p.name as product_name,
            p.code as product_code
          FROM composition_items ci
          LEFT JOIN products p ON p.id = ci.product_id
          WHERE ci.composition_id = v_quote_item.composition_id
            AND ci.item_type = 'product'
            AND ci.product_id IS NOT NULL
        LOOP
          
          -- Calcular quantidade total necessária
          -- (quantidade da composição × quantidade do item na composição)
          v_quantity_required := v_quote_item.quantity * v_composition_item.quantity_per_unit;
          
          RAISE NOTICE '   │';
          RAISE NOTICE '   ├─ 📦 PRODUTO NA COMPOSIÇÃO';
          RAISE NOTICE '   │  ├─ Nome: % (%)', 
            v_composition_item.product_name,
            COALESCE(v_composition_item.product_code, 'sem código');
          RAISE NOTICE '   │  ├─ Por unidade: % un.', v_composition_item.quantity_per_unit;
          RAISE NOTICE '   │  ├─ Qtd composição: %', v_quote_item.quantity;
          RAISE NOTICE '   │  ├─ Total necessário: % un. (% × %)', 
            v_quantity_required,
            v_quote_item.quantity,
            v_composition_item.quantity_per_unit;
          
          -- Verificar estoque disponível (calcular do production)
          SELECT COALESCE(SUM(
            CASE 
              WHEN stage = 'finished' THEN quantity
              ELSE 0
            END
          ), 0)
          INTO v_inventory_stock
          FROM production
          WHERE product_id = v_composition_item.product_id;
          
          RAISE NOTICE '   │  ├─ Estoque atual: % un.', COALESCE(v_inventory_stock, 0);
          
          -- Calcular quantidade a produzir
          v_quantity_to_produce := v_quantity_required - COALESCE(v_inventory_stock, 0);
          
          -- Se precisa produzir (estoque insuficiente)
          IF v_quantity_to_produce > 0 THEN
            
            RAISE NOTICE '   │  ├─ ⚠️  FALTA ESTOQUE: % un.', v_quantity_to_produce;
            
            -- Verificar se já existe ordem para este produto/orçamento
            IF NOT EXISTS (
              SELECT 1 
              FROM production_orders po
              WHERE po.quote_id = NEW.id
                AND po.product_id = v_composition_item.product_id
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
              
              RAISE NOTICE '   │  └─ ✅ CRIANDO ORDEM: %', v_order_number;
              RAISE NOTICE '   │     ├─ Produto: %', v_composition_item.product_name;
              RAISE NOTICE '   │     ├─ Quantidade: % un.', v_quantity_to_produce;
              RAISE NOTICE '   │     ├─ Prioridade: %', v_priority;
              RAISE NOTICE '   │     └─ Origem: Composição "%s"', v_composition_name;
              
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
                v_composition_item.product_id,
                v_quantity_to_produce,
                v_priority,
                'open',
                format(
                  'Ordem automática - Composição | Cliente: %s | Composição: %s | Produto: %s (%s)',
                  COALESCE(v_customer_name, 'N/A'),
                  COALESCE(v_composition_name, 'N/A'),
                  v_composition_item.product_name,
                  COALESCE(v_composition_item.product_code, 'sem código')
                ),
                NEW.delivery_deadline
              );
              
              v_orders_created := v_orders_created + 1;
              
            ELSE
              RAISE NOTICE '   │  └─ ℹ️  Ordem já existe para este produto';
            END IF;
            
          ELSE
            RAISE NOTICE '   │  └─ ✅ ESTOQUE SUFICIENTE (não precisa produzir)';
          END IF;
          
        END LOOP;
        
        RAISE NOTICE '   └─ ✅ Composição processada';
        
      -- ============================================================
      -- CASO 3: ITEM É MATERIAL (IGNORAR)
      -- ============================================================
      ELSE
        RAISE NOTICE '   └─ ℹ️  Item tipo "%s" (não gera ordem)', v_quote_item.item_type;
      END IF;
      
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '════════════════════════════════════════════════════════';
    RAISE NOTICE '📊 RESUMO FINAL';
    RAISE NOTICE '════════════════════════════════════════════════════════';
    RAISE NOTICE 'Total de ordens criadas: %', v_orders_created;
    
    IF v_orders_created > 0 THEN
      RAISE NOTICE '✅ Ordens de produção criadas com sucesso!';
    ELSE
      RAISE NOTICE 'ℹ️  Nenhuma ordem necessária (estoque suficiente)';
    END IF;
    RAISE NOTICE '════════════════════════════════════════════════════════';
    
  END IF;
  
  RETURN NEW;
  
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '❌ ERRO ao criar ordens automáticas: % | %', SQLERRM, SQLSTATE;
  -- Não bloquear a aprovação do orçamento mesmo se houver erro
  RETURN NEW;
END;
$$;

-- Atualizar comentário da função
COMMENT ON FUNCTION auto_create_production_orders_on_quote_approval() IS 
'Cria automaticamente ordens de produção quando um orçamento é aprovado. 
Processa PRODUTOS DIRETOS e COMPOSIÇÕES (abrindo para verificar produtos internos). 
Para cada produto sem estoque suficiente, cria ordem com prioridade baseada no prazo.
CORRIGIDO: Removido referência a coluna inexistente item_name.';
