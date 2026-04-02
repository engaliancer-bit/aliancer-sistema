/*
  # Limpeza de OPs redundantes de composicao existentes

  ## Problema
  OPs geradas pelo trigger antigo criaram uma OP separada por produto filho
  da composicao. Com o novo sistema de OP unica por composicao, essas OPs
  antigas ficaram redundantes e vazias.

  ## O que este script faz
  1. Identifica pares (quote_id, product_id) onde:
     - Existe uma OP com composition_id preenchido (OP consolidada nova)
     - Existe uma OP com o mesmo product_id mas sem composition_id (OP antiga por produto)
     - A OP antiga nao tem nenhum item com producao registrada
  2. Remove essas OPs antigas redundantes com seguranca.

  ## Seguranca
  - Nunca remove OPs com producao registrada (produced_quantity > 0)
  - Nunca remove OPs que nao tenham correspondente OP consolidada no mesmo orcamento
  - Remove primeiro os production_order_items sem producao das OPs a excluir
*/

DO $$
DECLARE
  v_op RECORD;
  v_deleted_items integer := 0;
  v_deleted_orders integer := 0;
BEGIN
  -- Identificar OPs redundantes: produto simples criado para produto
  -- que faz parte de uma composicao que ja tem OP consolidada no mesmo orcamento
  FOR v_op IN
    SELECT DISTINCT po.id, po.order_number, po.product_id, po.quote_id
    FROM production_orders po
    WHERE po.composition_id IS NULL
      AND po.product_id IS NOT NULL
      AND po.produced_quantity = 0
      AND po.status IN ('open', 'in_progress')
      AND EXISTS (
        -- Verificar se existe OP consolidada de composicao no mesmo orcamento
        -- que contenha este produto como filho
        SELECT 1
        FROM production_orders po_comp
        JOIN composition_items ci ON ci.composition_id = po_comp.composition_id
        WHERE po_comp.quote_id = po.quote_id
          AND po_comp.composition_id IS NOT NULL
          AND po_comp.status NOT IN ('cancelled')
          AND ci.product_id = po.product_id
          AND ci.item_type = 'product'
      )
      AND NOT EXISTS (
        -- Garantia: nao remover se houver qualquer item com producao
        SELECT 1
        FROM production_order_items poi
        WHERE poi.production_order_id = po.id
          AND COALESCE(poi.produced_quantity, 0) > 0
      )
  LOOP
    RAISE NOTICE 'Removendo OP redundante #% (id=%, produto=%)', 
      v_op.order_number, v_op.id, v_op.product_id;

    -- Remover itens sem producao da OP
    DELETE FROM production_order_items
    WHERE production_order_id = v_op.id
      AND COALESCE(produced_quantity, 0) = 0;

    GET DIAGNOSTICS v_deleted_items = ROW_COUNT;

    -- Remover a propria OP
    DELETE FROM production_orders WHERE id = v_op.id;

    v_deleted_orders := v_deleted_orders + 1;
  END LOOP;

  RAISE NOTICE 'Limpeza concluida: % OPs redundantes removidas', v_deleted_orders;
END $$;
