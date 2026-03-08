/*
  # Sistema de Entregas Parciais Automáticas

  ## Descrição
  
  Implementa funcionalidade para entregas parciais onde:
  - Usuário pode editar a quantidade carregada (loaded_quantity)
  - Ao confirmar um carregamento parcial (loaded_quantity < quantity)
  - Sistema fecha a entrega atual
  - Sistema cria AUTOMATICAMENTE uma nova entrega com o restante
  
  ## Exemplo Prático
  
  Orçamento aprovado: 1500 blocos
  └─ Entrega #1 criada automaticamente: 1500 blocos (quantity=1500, loaded=0)
  
  Carregamento 1:
  ├─ Caminhão carrega apenas 1200 blocos
  ├─ Usuario atualiza loaded_quantity = 1200
  ├─ Confirma o carregamento
  └─ Sistema:
      ├─ Fecha Entrega #1 com 1200 blocos entregues
      ├─ Cria Entrega #2 automaticamente com 300 blocos (quantity=300, loaded=0)
      └─ Mantém referência ao mesmo orçamento
  
  Carregamento 2 (futuramente):
  ├─ Carrega os 300 blocos restantes
  ├─ loaded_quantity = 300
  └─ Entrega #2 fechada completamente
  
  ## Mudanças Implementadas
  
  1. Função `confirm_partial_delivery(delivery_id)`
     - Valida se há itens não completamente carregados
     - Fecha a entrega atual
     - Cria nova entrega com itens pendentes
     - Mantém todas as referências (quote_id, customer_id, etc.)
  
  2. Campo `parent_delivery_id` em deliveries
     - Rastreia entregas que foram divididas
     - Permite ver histórico de entregas parciais
  
  3. View `delivery_summary_view`
     - Mostra resumo de carregamento
     - Indica se entrega pode ser fechada parcialmente
*/

-- =====================================================
-- 1. ADICIONAR CAMPO PARA RASTREAR ENTREGAS DIVIDIDAS
-- =====================================================

ALTER TABLE deliveries
ADD COLUMN IF NOT EXISTS parent_delivery_id uuid REFERENCES deliveries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deliveries_parent
  ON deliveries(parent_delivery_id)
  WHERE parent_delivery_id IS NOT NULL;

COMMENT ON COLUMN deliveries.parent_delivery_id IS
  'Referência à entrega original quando esta é uma entrega parcial gerada automaticamente.
   Usado para rastrear o histórico de entregas divididas.';

-- =====================================================
-- 2. FUNÇÃO PARA CONFIRMAR CARREGAMENTO PARCIAL
-- =====================================================

CREATE OR REPLACE FUNCTION confirm_partial_delivery(p_delivery_id uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_delivery_record RECORD;
  v_new_delivery_id uuid;
  v_item RECORD;
  v_pending_quantity decimal;
  v_has_pending_items boolean := false;
BEGIN
  -- Buscar dados da entrega
  SELECT * INTO v_delivery_record
  FROM deliveries
  WHERE id = p_delivery_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entrega não encontrada: %', p_delivery_id;
  END IF;

  -- Validar que a entrega está aberta
  IF v_delivery_record.status NOT IN ('open', 'in_progress') THEN
    RAISE EXCEPTION 'Entrega já foi fechada ou cancelada';
  END IF;

  RAISE NOTICE 'Processando confirmação de entrega parcial para delivery %', p_delivery_id;

  -- Verificar se há itens pendentes (loaded_quantity < quantity)
  SELECT EXISTS (
    SELECT 1 FROM delivery_items
    WHERE delivery_id = p_delivery_id
      AND loaded_quantity < quantity
  ) INTO v_has_pending_items;

  IF NOT v_has_pending_items THEN
    -- Se não há itens pendentes, apenas fechar a entrega normalmente
    UPDATE deliveries
    SET status = 'closed',
        updated_at = now()
    WHERE id = p_delivery_id;
    
    RAISE NOTICE 'Entrega % fechada completamente (sem itens pendentes)', p_delivery_id;
    RETURN NULL;
  END IF;

  RAISE NOTICE 'Itens pendentes detectados. Criando nova entrega para o restante...';

  -- Criar nova entrega para os itens pendentes
  INSERT INTO deliveries (
    quote_id,
    ribbed_slab_quote_id,
    customer_id,
    delivery_date,
    status,
    auto_created,
    parent_delivery_id,
    notes
  )
  SELECT
    quote_id,
    ribbed_slab_quote_id,
    customer_id,
    CURRENT_DATE + INTERVAL '7 days', -- Prazo de 7 dias para próxima entrega
    'open',
    true,
    p_delivery_id, -- Referência à entrega original
    format('Entrega parcial criada automaticamente. Restante da entrega %s', p_delivery_id)
  FROM deliveries
  WHERE id = p_delivery_id
  RETURNING id INTO v_new_delivery_id;

  RAISE NOTICE 'Nova entrega % criada', v_new_delivery_id;

  -- Copiar itens pendentes para a nova entrega
  FOR v_item IN
    SELECT
      di.*,
      (di.quantity - di.loaded_quantity) as pending_quantity
    FROM delivery_items di
    WHERE di.delivery_id = p_delivery_id
      AND di.loaded_quantity < di.quantity
  LOOP
    v_pending_quantity := v_item.quantity - v_item.loaded_quantity;
    
    RAISE NOTICE '  → Transferindo % x % para nova entrega',
      v_pending_quantity, v_item.product_id;

    -- Criar item na nova entrega com a quantidade pendente
    INSERT INTO delivery_items (
      delivery_id,
      product_id,
      material_id,
      item_id,
      quote_item_id,
      ribbed_slab_room_id,
      item_type,
      quantity,
      loaded_quantity,
      unit_price,
      is_additional,
      is_from_composition,
      parent_composition_id,
      parent_composition_name,
      notes
    ) VALUES (
      v_new_delivery_id,
      v_item.product_id,
      v_item.material_id,
      v_item.item_id,
      v_item.quote_item_id,
      v_item.ribbed_slab_room_id,
      v_item.item_type,
      v_pending_quantity, -- Apenas a quantidade pendente
      0, -- loaded_quantity inicia zerado
      v_item.unit_price,
      v_item.is_additional,
      v_item.is_from_composition,
      v_item.parent_composition_id,
      v_item.parent_composition_name,
      format('Restante da entrega anterior (original: %s, carregado: %s)',
        v_item.quantity, v_item.loaded_quantity)
    );

    -- Atualizar item original para refletir apenas o que foi carregado
    UPDATE delivery_items
    SET quantity = loaded_quantity,
        notes = COALESCE(notes || E'\n', '') || 
                format('Entrega parcial. Restante (%s) transferido para entrega %s',
                  v_pending_quantity, v_new_delivery_id)
    WHERE id = v_item.id;
  END LOOP;

  -- Fechar a entrega atual
  UPDATE deliveries
  SET status = 'closed',
      updated_at = now(),
      notes = COALESCE(notes || E'\n\n', '') ||
              format('ENTREGA PARCIAL. Restante transferido para entrega %s', v_new_delivery_id)
  WHERE id = p_delivery_id;

  RAISE NOTICE 'Entrega % fechada parcialmente. Nova entrega % criada com itens pendentes',
    p_delivery_id, v_new_delivery_id;

  RETURN v_new_delivery_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erro ao confirmar entrega parcial %: %', p_delivery_id, SQLERRM;
    RAISE;
END;
$$;

-- =====================================================
-- 3. VIEW RESUMO DE ENTREGAS
-- =====================================================

CREATE OR REPLACE VIEW delivery_summary_view AS
SELECT
  d.id as delivery_id,
  d.quote_id,
  d.customer_id,
  d.delivery_date,
  d.status,
  d.auto_created,
  d.parent_delivery_id,
  c.name as customer_name,
  
  -- Contagem de itens
  COUNT(di.id) as total_items,
  COUNT(di.id) FILTER (WHERE di.loaded_quantity >= di.quantity) as items_fully_loaded,
  COUNT(di.id) FILTER (WHERE di.loaded_quantity > 0 AND di.loaded_quantity < di.quantity) as items_partially_loaded,
  COUNT(di.id) FILTER (WHERE di.loaded_quantity = 0) as items_not_loaded,
  
  -- Totais
  COALESCE(SUM(di.quantity), 0) as total_quantity,
  COALESCE(SUM(di.loaded_quantity), 0) as total_loaded,
  COALESCE(SUM(di.quantity - di.loaded_quantity), 0) as total_pending,
  
  -- Percentual carregado
  CASE
    WHEN SUM(di.quantity) > 0 THEN
      ROUND((SUM(di.loaded_quantity) / SUM(di.quantity)) * 100, 2)
    ELSE 0
  END as percent_loaded,
  
  -- Status de carregamento
  CASE
    WHEN COUNT(di.id) = 0 THEN 'empty'
    WHEN COUNT(di.id) FILTER (WHERE di.loaded_quantity >= di.quantity) = COUNT(di.id) THEN 'fully_loaded'
    WHEN COUNT(di.id) FILTER (WHERE di.loaded_quantity > 0) > 0 THEN 'partially_loaded'
    ELSE 'not_loaded'
  END as loading_status,
  
  -- Pode ser fechada parcialmente?
  (
    d.status IN ('open', 'in_progress') AND
    COUNT(di.id) FILTER (WHERE di.loaded_quantity > 0) > 0
  ) as can_confirm_partial,
  
  d.created_at,
  d.updated_at

FROM deliveries d
LEFT JOIN customers c ON c.id = d.customer_id
LEFT JOIN delivery_items di ON di.delivery_id = d.id
GROUP BY
  d.id,
  d.quote_id,
  d.customer_id,
  d.delivery_date,
  d.status,
  d.auto_created,
  d.parent_delivery_id,
  c.name,
  d.created_at,
  d.updated_at;

-- =====================================================
-- 4. COMENTÁRIOS EXPLICATIVOS
-- =====================================================

COMMENT ON FUNCTION confirm_partial_delivery(uuid) IS
  'Confirma uma entrega parcial e cria automaticamente uma nova entrega com os itens pendentes.
   
   Fluxo:
   1. Valida se a entrega está aberta
   2. Verifica se há itens com loaded_quantity < quantity
   3. Se houver itens pendentes:
      - Fecha a entrega atual com os itens carregados
      - Cria nova entrega com os itens pendentes
      - Ajusta quantity dos itens originais para refletir apenas o carregado
   4. Se não houver itens pendentes:
      - Apenas fecha a entrega normalmente
   
   Exemplo:
   - Entrega original: 1500 blocos (quantity=1500)
   - Carregado: 1200 blocos (loaded_quantity=1200)
   - Ao confirmar:
     * Entrega atual fecha com 1200 blocos
     * Nova entrega criada com 300 blocos
   
   Retorna: ID da nova entrega criada, ou NULL se não houver itens pendentes';

COMMENT ON VIEW delivery_summary_view IS
  'Resumo de entregas mostrando status de carregamento e possibilidade de entrega parcial.
   
   Campos importantes:
   - loading_status: empty, not_loaded, partially_loaded, fully_loaded
   - can_confirm_partial: TRUE se pode confirmar carregamento parcial
   - percent_loaded: Percentual de itens carregados
   - total_pending: Quantidade total ainda não carregada';

-- =====================================================
-- 5. ATUALIZAR RLS PARA PARENT_DELIVERY_ID
-- =====================================================

-- Não precisa criar novas políticas, as existentes já cobrem o novo campo