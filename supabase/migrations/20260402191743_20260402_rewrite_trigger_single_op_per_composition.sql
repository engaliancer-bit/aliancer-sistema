/*
  # Reescrever trigger de criacao automatica de OPs — OP unica por composicao

  ## Problema anterior
  O trigger `auto_create_production_orders_on_quote_approval` criava uma OP
  separada para cada produto filho dentro de uma composicao, resultando em
  multiplas OPs vazias (sem itens) para o mesmo orcamento.

  ## Solucao
  - Para itens de composicao no orcamento: criar UMA UNICA OP por composicao,
    com `composition_id` preenchido e `product_id` nulo.
  - Os itens filhos da composicao sao adicionados via "Sincronizar" na interface.
  - Para itens de produto simples: comportamento mantido (1 OP por produto).
  - Verificacao de duplicatas ajustada:
    - Produto simples: verifica por quote_id + product_id
    - Composicao: verifica por quote_id + composition_id

  ## Limpeza de OPs redundantes
  - Ao criar uma OP de composicao consolidada, o trigger cancela (status='cancelled')
    e remove quaisquer OPs antigas geradas para os produtos filhos dessa mesma
    composicao no mesmo orcamento (OPs sem itens produzidos).
*/

CREATE OR REPLACE FUNCTION auto_create_production_orders_on_quote_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_quote_item RECORD;
  v_composition_item RECORD;
  v_composition_name text;
  v_quantity_required numeric;
  v_quantity_to_produce numeric;
  v_inventory_stock numeric;
  v_new_order_id uuid;
  v_order_number integer;
  v_orders_created integer := 0;
BEGIN
  -- Apenas processar quando o status muda para 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN

    RAISE NOTICE '=== AUTO-CRIAR OPs PARA ORCAMENTO #% ===', NEW.id;

    FOR v_quote_item IN
      SELECT
        qi.id,
        qi.item_type,
        qi.product_id,
        qi.composition_id,
        qi.quantity,
        qi.proposed_price,
        p.name  AS product_name,
        p.code  AS product_code,
        c.name  AS composition_name
      FROM quote_items qi
      LEFT JOIN products p ON p.id = qi.product_id
      LEFT JOIN compositions c ON c.id = qi.composition_id
      WHERE qi.quote_id = NEW.id
        AND qi.item_type IN ('product', 'composition')
    LOOP

      -- ============================================================
      -- CASO 1: ITEM E UM PRODUTO SIMPLES
      -- ============================================================
      IF v_quote_item.item_type = 'product' AND v_quote_item.product_id IS NOT NULL THEN

        RAISE NOTICE '→ PRODUTO: % (qtd: %)', v_quote_item.product_name, v_quote_item.quantity;

        SELECT COALESCE(quantity, 0)
        INTO v_inventory_stock
        FROM inventory
        WHERE product_id = v_quote_item.product_id;

        v_quantity_to_produce := v_quote_item.quantity - COALESCE(v_inventory_stock, 0);

        IF v_quantity_to_produce > 0 THEN
          -- Verificar se ja existe OP para este produto neste orcamento
          IF NOT EXISTS (
            SELECT 1 FROM production_orders po
            WHERE po.quote_id = NEW.id
              AND po.product_id = v_quote_item.product_id
              AND po.status NOT IN ('cancelled')
          ) THEN
            SELECT COALESCE(MAX(order_number), 0) + 1 INTO v_order_number FROM production_orders;

            INSERT INTO production_orders (
              order_number, quote_id, customer_id, product_id,
              total_quantity, produced_quantity, remaining_quantity,
              status, notes, deadline
            )
            SELECT
              v_order_number, NEW.id, NEW.customer_id, v_quote_item.product_id,
              v_quantity_to_produce, 0, v_quantity_to_produce,
              'open',
              'Ordem automatica - Orcamento aprovado',
              NEW.delivery_deadline;

            v_orders_created := v_orders_created + 1;
            RAISE NOTICE '  ✓ OP criada (#%)', v_order_number;
          ELSE
            RAISE NOTICE '  ℹ OP ja existe para este produto';
          END IF;
        ELSE
          RAISE NOTICE '  ✓ Estoque suficiente — nenhuma OP criada';
        END IF;

      -- ============================================================
      -- CASO 2: ITEM E UMA COMPOSICAO — CRIAR UMA UNICA OP
      -- ============================================================
      ELSIF v_quote_item.item_type = 'composition' AND v_quote_item.composition_id IS NOT NULL THEN

        v_composition_name := COALESCE(v_quote_item.composition_name, 'Composicao');
        RAISE NOTICE '→ COMPOSICAO: % (qtd: %)', v_composition_name, v_quote_item.quantity;

        -- Verificar se ja existe uma OP consolidada para esta composicao neste orcamento
        IF NOT EXISTS (
          SELECT 1 FROM production_orders po
          WHERE po.quote_id = NEW.id
            AND po.composition_id = v_quote_item.composition_id
            AND po.status NOT IN ('cancelled')
        ) THEN
          SELECT COALESCE(MAX(order_number), 0) + 1 INTO v_order_number FROM production_orders;

          -- Calcular total de pecas da composicao (soma de todos os produtos filhos × qtd do item)
          SELECT COALESCE(SUM(ci.quantity), 0) * v_quote_item.quantity
          INTO v_quantity_required
          FROM composition_items ci
          WHERE ci.composition_id = v_quote_item.composition_id
            AND ci.item_type = 'product'
            AND ci.product_id IS NOT NULL;

          IF v_quantity_required IS NULL OR v_quantity_required = 0 THEN
            v_quantity_required := v_quote_item.quantity;
          END IF;

          INSERT INTO production_orders (
            order_number, quote_id, customer_id,
            product_id, composition_id, composition_name,
            total_quantity, produced_quantity, remaining_quantity,
            status, notes, deadline
          )
          VALUES (
            v_order_number, NEW.id, NEW.customer_id,
            NULL, v_quote_item.composition_id, v_composition_name,
            v_quantity_required, 0, v_quantity_required,
            'open',
            'Composicao: ' || v_composition_name || ' — Sincronize para carregar os itens',
            NEW.delivery_deadline
          )
          RETURNING id INTO v_new_order_id;

          v_orders_created := v_orders_created + 1;
          RAISE NOTICE '  ✓ OP de composicao criada (#%) id=%', v_order_number, v_new_order_id;

          -- Limpar OPs antigas (por produto) geradas anteriormente para os mesmos produtos
          -- desta composicao no mesmo orcamento (sem producao registrada)
          FOR v_composition_item IN
            SELECT ci.product_id
            FROM composition_items ci
            WHERE ci.composition_id = v_quote_item.composition_id
              AND ci.item_type = 'product'
              AND ci.product_id IS NOT NULL
          LOOP
            DELETE FROM production_orders po
            WHERE po.quote_id = NEW.id
              AND po.product_id = v_composition_item.product_id
              AND po.composition_id IS NULL
              AND po.produced_quantity = 0
              AND po.status IN ('open')
              AND NOT EXISTS (
                SELECT 1 FROM production_order_items poi
                WHERE poi.production_order_id = po.id
                  AND COALESCE(poi.produced_quantity, 0) > 0
              );

            IF FOUND THEN
              RAISE NOTICE '  🗑 OP redundante removida para produto_id=%', v_composition_item.product_id;
            END IF;
          END LOOP;

        ELSE
          RAISE NOTICE '  ℹ OP de composicao ja existe';
        END IF;

      END IF;

    END LOOP;

    RAISE NOTICE '=== % OP(s) criada(s) para orcamento #% ===', v_orders_created, NEW.id;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
