/*
  # Atualizar Criação de Entregas para Sempre Reservar Estoque

  ## Nova Lógica de Negócio

  ### Mudança Crítica
  
  Anteriormente: A entrega só era criada se houvesse estoque disponível
  Agora: A entrega é SEMPRE criada ao aprovar um orçamento, independente do estoque
  
  ### Razão da Mudança
  
  1. **Reserva Imediata**: Ao aprovar um orçamento, os produtos devem ser reservados
     imediatamente, mesmo que ainda não tenham sido produzidos
  
  2. **Visibilidade**: A entrega existe e mostra o que precisa ser entregue,
     facilitando o planejamento de produção
  
  3. **Estoque Negativo Permitido**: O sistema permite estoque negativo temporariamente,
     indicando que há compromissos de entrega além da capacidade atual
  
  4. **Gatilho de Produção**: Quando o estoque fica negativo, isso indica que
     é necessário produzir mais unidades
  
  ### Fluxo Atualizado
  
  **Exemplo: 2000 blocos em estoque, orçamento de 800 blocos aprovado**
  
  1. Orçamento aprovado (status='pending' → 'approved')
  2. Sistema cria entrega automaticamente (SEMPRE)
  3. Entrega tem 800 blocos (quantity=800, loaded_quantity=0)
  4. Estoque é atualizado: 2000 - 800 = 1200 ✅
  5. Entrega fica com status='open' aguardando carregamento
  
  **Exemplo: 100 blocos em estoque, orçamento de 800 blocos aprovado**
  
  1. Orçamento aprovado (status='pending' → 'approved')
  2. Sistema cria entrega automaticamente (SEMPRE, mesmo sem estoque!)
  3. Entrega tem 800 blocos (quantity=800, loaded_quantity=0)
  4. Estoque é atualizado: 100 - 800 = -700 ⚠️ NEGATIVO!
  5. Orçamento marcado como awaiting_production=true
  6. Sistema indica que precisa produzir 700 blocos
  7. Quando produção for completada, estoque volta positivo
  
  ### Benefícios
  
  - ✅ Compromissos de venda sempre visíveis
  - ✅ Estoque reservado imediatamente
  - ✅ Planejamento de produção baseado em demanda real
  - ✅ Evita dupla venda mesmo sem estoque físico
  - ✅ Transparência total sobre o que está comprometido

  ## Mudanças Implementadas
  
  1. Função `create_delivery_from_quote()`:
     - Remove verificação de estoque que impedia criação
     - Sempre cria a entrega
     - Marca awaiting_production se necessário, mas NÃO impede criação
     - Adiciona campo notes com informações sobre estoque insuficiente
*/

-- =====================================================
-- ATUALIZAR FUNÇÃO DE CRIAÇÃO DE ENTREGAS
-- =====================================================

CREATE OR REPLACE FUNCTION create_delivery_from_quote(p_quote_id uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_quote_record RECORD;
  v_delivery_id uuid;
  v_quote_item RECORD;
  v_composition_item RECORD;
  v_composition_name text;
  v_has_sufficient_stock boolean := true;
  v_product_stock numeric;
  v_required_quantity numeric;
  v_stock_notes text := '';
  v_products_needing_production text[] := ARRAY[]::text[];
BEGIN
  -- Buscar dados do orçamento
  SELECT * INTO v_quote_record
  FROM quotes
  WHERE id = p_quote_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado: %', p_quote_id;
  END IF;

  RAISE NOTICE 'Processando orçamento % para cliente %', p_quote_id, v_quote_record.customer_id;

  -- Verificar estoque de todos os produtos (para informação, não para bloqueio)
  FOR v_quote_item IN
    SELECT qi.*
    FROM quote_items qi
    WHERE qi.quote_id = p_quote_id
  LOOP
    -- Se é um produto direto
    IF v_quote_item.item_type = 'product' AND v_quote_item.product_id IS NOT NULL THEN
      v_product_stock := get_product_available_stock(v_quote_item.product_id);

      IF v_product_stock < v_quote_item.quantity THEN
        v_has_sufficient_stock := false;
        
        SELECT name INTO v_composition_name FROM products WHERE id = v_quote_item.product_id;
        v_products_needing_production := array_append(
          v_products_needing_production,
          format('%s (necessário: %s, disponível: %s, produzir: %s)',
            v_composition_name,
            v_quote_item.quantity,
            GREATEST(v_product_stock, 0),
            v_quote_item.quantity - GREATEST(v_product_stock, 0)
          )
        );
        
        RAISE NOTICE 'Produto % sem estoque suficiente (necessário: %, disponível: %)',
          v_composition_name, v_quote_item.quantity, v_product_stock;
      END IF;

    -- Se é uma composição, verificar estoque de cada produto dentro dela
    ELSIF v_quote_item.item_type = 'composition' AND v_quote_item.composition_id IS NOT NULL THEN
      FOR v_composition_item IN
        SELECT ci.product_id, ci.quantity as comp_qty, p.name as product_name
        FROM composition_items ci
        JOIN products p ON p.id = ci.product_id
        WHERE ci.composition_id = v_quote_item.composition_id
          AND ci.item_type = 'product'
          AND ci.product_id IS NOT NULL
      LOOP
        v_required_quantity := v_composition_item.comp_qty * v_quote_item.quantity;
        v_product_stock := get_product_available_stock(v_composition_item.product_id);

        IF v_product_stock < v_required_quantity THEN
          v_has_sufficient_stock := false;
          
          v_products_needing_production := array_append(
            v_products_needing_production,
            format('%s (necessário: %s, disponível: %s, produzir: %s)',
              v_composition_item.product_name,
              v_required_quantity,
              GREATEST(v_product_stock, 0),
              v_required_quantity - GREATEST(v_product_stock, 0)
            )
          );
          
          RAISE NOTICE 'Produto % da composição sem estoque suficiente (necessário: %, disponível: %)',
            v_composition_item.product_name, v_required_quantity, v_product_stock;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  -- Preparar notas sobre estoque
  IF NOT v_has_sufficient_stock THEN
    v_stock_notes := 'ATENÇÃO: Produtos precisam ser produzidos antes da entrega:' || E'\n\n' ||
                     array_to_string(v_products_needing_production, E'\n');
    RAISE NOTICE 'Entrega será criada mas requer produção adicional';
  END IF;

  -- SEMPRE criar a entrega, independente do estoque!
  RAISE NOTICE 'Criando entrega para reservar produtos (estoque suficiente: %)...', v_has_sufficient_stock;

  INSERT INTO deliveries (
    quote_id,
    customer_id,
    delivery_date,
    status,
    auto_created,
    notes
  ) VALUES (
    p_quote_id,
    v_quote_record.customer_id,
    COALESCE(v_quote_record.delivery_deadline, CURRENT_DATE + INTERVAL '7 days'),
    'open',
    true,
    CASE 
      WHEN v_stock_notes != '' THEN v_stock_notes
      ELSE 'Entrega criada automaticamente. Todos os produtos disponíveis em estoque.'
    END
  )
  RETURNING id INTO v_delivery_id;

  RAISE NOTICE 'Entrega % criada com sucesso', v_delivery_id;

  -- Criar itens da entrega
  FOR v_quote_item IN
    SELECT qi.*
    FROM quote_items qi
    WHERE qi.quote_id = p_quote_id
  LOOP
    -- Se é um produto direto, adicionar diretamente
    IF v_quote_item.item_type = 'product' AND v_quote_item.product_id IS NOT NULL THEN
      INSERT INTO delivery_items (
        delivery_id,
        product_id,
        quote_item_id,
        item_type,
        quantity,
        unit_price,
        is_from_composition
      ) VALUES (
        v_delivery_id,
        v_quote_item.product_id,
        v_quote_item.id,
        'product',
        v_quote_item.quantity,
        v_quote_item.proposed_price,
        false
      );

      RAISE NOTICE 'Adicionado produto direto: % x %', v_quote_item.product_id, v_quote_item.quantity;

    -- Se é uma composição, expandir para produtos individuais
    ELSIF v_quote_item.item_type = 'composition' AND v_quote_item.composition_id IS NOT NULL THEN
      -- Buscar nome da composição
      SELECT name INTO v_composition_name
      FROM compositions
      WHERE id = v_quote_item.composition_id;

      RAISE NOTICE 'Expandindo composição: % x %', v_composition_name, v_quote_item.quantity;

      -- Para cada produto na composição
      FOR v_composition_item IN
        SELECT
          ci.product_id,
          ci.quantity as comp_qty,
          p.name as product_name,
          p.code as product_code
        FROM composition_items ci
        JOIN products p ON p.id = ci.product_id
        WHERE ci.composition_id = v_quote_item.composition_id
          AND ci.item_type = 'product'
          AND ci.product_id IS NOT NULL
      LOOP
        -- Calcular quantidade multiplicada
        v_required_quantity := v_composition_item.comp_qty * v_quote_item.quantity;

        INSERT INTO delivery_items (
          delivery_id,
          product_id,
          quote_item_id,
          item_type,
          quantity,
          unit_price,
          is_from_composition,
          parent_composition_id,
          parent_composition_name
        ) VALUES (
          v_delivery_id,
          v_composition_item.product_id,
          v_quote_item.id,
          'product',
          v_required_quantity,
          v_quote_item.proposed_price / NULLIF((
            SELECT SUM(ci2.quantity)
            FROM composition_items ci2
            WHERE ci2.composition_id = v_quote_item.composition_id
              AND ci2.item_type = 'product'
          ), 0),
          true,
          v_quote_item.composition_id,
          v_composition_name
        );

        RAISE NOTICE '  → Produto expandido: % x % (de composição %)',
          v_composition_item.product_name, v_required_quantity, v_composition_name;
      END LOOP;

    -- Para outros tipos de item (material, serviço, etc.)
    ELSE
      INSERT INTO delivery_items (
        delivery_id,
        item_id,
        quote_item_id,
        item_type,
        quantity,
        unit_price,
        is_from_composition
      ) VALUES (
        v_delivery_id,
        v_quote_item.item_id,
        v_quote_item.id,
        v_quote_item.item_type,
        v_quote_item.quantity,
        v_quote_item.proposed_price,
        false
      );
    END IF;
  END LOOP;

  -- Verificar quantos itens foram inseridos
  DECLARE
    v_items_count integer;
  BEGIN
    SELECT COUNT(*) INTO v_items_count
    FROM delivery_items
    WHERE delivery_id = v_delivery_id;

    RAISE NOTICE 'Total de % itens adicionados à entrega %', v_items_count, v_delivery_id;

    IF v_items_count = 0 THEN
      RAISE WARNING 'Nenhum item foi adicionado à entrega %!', v_delivery_id;
    END IF;
  END;

  -- Atualizar flag do orçamento baseado no estoque
  UPDATE quotes
  SET awaiting_production = NOT v_has_sufficient_stock
  WHERE id = p_quote_id;

  IF v_has_sufficient_stock THEN
    RAISE NOTICE 'Entrega % criada - Produtos disponíveis em estoque', v_delivery_id;
  ELSE
    RAISE NOTICE 'Entrega % criada - AGUARDANDO PRODUÇÃO de itens faltantes', v_delivery_id;
  END IF;

  RETURN v_delivery_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erro ao criar entrega para orçamento %: %', p_quote_id, SQLERRM;
    RETURN NULL;
END;
$$;

-- =====================================================
-- COMENTÁRIO EXPLICATIVO
-- =====================================================

COMMENT ON FUNCTION create_delivery_from_quote(uuid) IS
  'Cria entrega automaticamente ao aprovar um orçamento.
   
   Nova lógica de reserva imediata:
   - SEMPRE cria a entrega, independente do estoque disponível
   - A entrega reserva os produtos imediatamente (quantity)
   - Se não houver estoque, marca awaiting_production=true
   - Estoque pode ficar negativo temporariamente
   - Produtos em composições são expandidos em produtos individuais
   - Notas da entrega indicam se há necessidade de produção adicional';