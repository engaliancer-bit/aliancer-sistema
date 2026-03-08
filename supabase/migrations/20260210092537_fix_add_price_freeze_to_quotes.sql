/*
  # Sistema de Congelamento de Preços em Orçamentos (Corrigido)

  ## Resumo
  Adiciona funcionalidade para congelar preços de orçamentos específicos, criando um
  "snapshot" dos valores no momento do congelamento. Os preços dos produtos no sistema
  continuam atualizando normalmente, mas o orçamento usa valores congelados.

  ## Mudanças

  1. **Novos Campos em quotes**
     - `precos_congelados` (boolean) - Indica se os preços estão congelados
     - `snapshot_valores` (jsonb) - Armazena snapshot completo dos valores
     - `data_congelamento` (timestamptz) - Quando foi congelado

  2. **Estrutura do Snapshot**
     ```json
     {
       "items": [...],
       "totals": {...}
     }
     ```

  3. **Funções Criadas**
     - `freeze_quote_prices(quote_id)` - Congela preços do orçamento
     - `unfreeze_quote_prices(quote_id)` - Descongela e limpa snapshot
     - `get_quote_totals(quote_id)` - Retorna totais (congelados ou atuais)

  ## Segurança
  - Funções executam com privilégios de invoker
  - Validações de dados nullos
*/

-- =============================================================================
-- Adicionar campos à tabela quotes
-- =============================================================================

ALTER TABLE quotes 
  ADD COLUMN IF NOT EXISTS precos_congelados boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS snapshot_valores jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS data_congelamento timestamptz DEFAULT NULL;

-- Criar índice para otimizar buscas
CREATE INDEX IF NOT EXISTS idx_quotes_precos_congelados ON quotes(precos_congelados) WHERE precos_congelados = true;

-- =============================================================================
-- FUNÇÃO: Congelar Preços do Orçamento
-- =============================================================================

CREATE OR REPLACE FUNCTION freeze_quote_prices(p_quote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_snapshot jsonb := '{"items": [], "totals": {}}'::jsonb;
  v_items jsonb := '[]'::jsonb;
  v_item RECORD;
  v_total_cost numeric := 0;
  v_total_price numeric := 0;
  v_total_margin numeric := 0;
  v_margin_percentage numeric := 0;
  v_discount numeric := 0;
  v_final_value numeric := 0;
  v_item_snapshot jsonb;
BEGIN
  -- Verificar se o orçamento existe
  IF NOT EXISTS (SELECT 1 FROM quotes WHERE id = p_quote_id) THEN
    RAISE EXCEPTION 'Orçamento % não encontrado', p_quote_id;
  END IF;

  -- Buscar desconto do orçamento
  SELECT COALESCE(discount_value, 0) INTO v_discount
  FROM quotes
  WHERE id = p_quote_id;

  -- Buscar todos os itens do orçamento e calcular valores
  FOR v_item IN
    SELECT 
      qi.id as item_id,
      qi.item_type,
      qi.product_id,
      qi.material_id,
      qi.composition_id,
      qi.quantity,
      qi.proposed_price,
      COALESCE(
        CASE 
          WHEN qi.item_type = 'product' THEN p.name
          WHEN qi.item_type = 'material' THEN m.name
          WHEN qi.item_type = 'composition' THEN c.name
        END, 
        'Item Desconhecido'
      ) as item_name,
      COALESCE(
        CASE 
          WHEN qi.item_type = 'product' THEN p.custo_unitario_materiais
          WHEN qi.item_type = 'material' THEN m.unit_cost
          WHEN qi.item_type = 'composition' THEN c.total_cost
        END, 
        0
      ) as unit_cost,
      COALESCE(
        CASE 
          WHEN qi.item_type = 'product' THEN p.unit
          WHEN qi.item_type = 'material' THEN m.unit
          WHEN qi.item_type = 'composition' THEN 'un'
        END, 
        'un'
      ) as unit
    FROM quote_items qi
    LEFT JOIN products p ON p.id = qi.product_id
    LEFT JOIN materials m ON m.id = qi.material_id
    LEFT JOIN compositions c ON c.id = qi.composition_id
    WHERE qi.quote_id = p_quote_id
  LOOP
    -- Calcular totais do item
    DECLARE
      v_item_total_cost numeric := v_item.quantity * v_item.unit_cost;
      v_item_total_price numeric := v_item.quantity * v_item.proposed_price;
    BEGIN
      -- Criar snapshot do item
      v_item_snapshot := jsonb_build_object(
        'item_id', v_item.item_id,
        'item_type', v_item.item_type,
        'product_id', v_item.product_id,
        'material_id', v_item.material_id,
        'composition_id', v_item.composition_id,
        'item_name', v_item.item_name,
        'quantity', v_item.quantity,
        'unit', v_item.unit,
        'unit_cost', ROUND(v_item.unit_cost, 2),
        'unit_price', ROUND(v_item.proposed_price, 2),
        'total_cost', ROUND(v_item_total_cost, 2),
        'total_price', ROUND(v_item_total_price, 2),
        'margin', ROUND(v_item_total_price - v_item_total_cost, 2)
      );

      -- Adicionar ao array de itens
      v_items := v_items || v_item_snapshot;

      -- Acumular totais
      v_total_cost := v_total_cost + v_item_total_cost;
      v_total_price := v_total_price + v_item_total_price;
    END;
  END LOOP;

  -- Calcular totais finais
  v_total_margin := v_total_price - v_total_cost;
  v_final_value := v_total_price - v_discount;
  
  IF v_total_price > 0 THEN
    v_margin_percentage := (v_total_margin / v_total_price) * 100;
  END IF;

  -- Montar snapshot completo
  v_snapshot := jsonb_build_object(
    'items', v_items,
    'totals', jsonb_build_object(
      'total_cost', ROUND(v_total_cost, 2),
      'total_price', ROUND(v_total_price, 2),
      'total_margin', ROUND(v_total_margin, 2),
      'margin_percentage', ROUND(v_margin_percentage, 2),
      'discount_value', ROUND(v_discount, 2),
      'final_value', ROUND(v_final_value, 2)
    ),
    'frozen_at', now()
  );

  -- Atualizar orçamento com snapshot
  UPDATE quotes
  SET 
    precos_congelados = true,
    snapshot_valores = v_snapshot,
    data_congelamento = now()
  WHERE id = p_quote_id;

  RAISE NOTICE 'Preços congelados para orçamento %. Total: R$ %', p_quote_id, v_final_value;

  RETURN v_snapshot;
END;
$$;

-- =============================================================================
-- FUNÇÃO: Descongelar Preços do Orçamento
-- =============================================================================

CREATE OR REPLACE FUNCTION unfreeze_quote_prices(p_quote_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- Verificar se o orçamento existe
  IF NOT EXISTS (SELECT 1 FROM quotes WHERE id = p_quote_id) THEN
    RAISE EXCEPTION 'Orçamento % não encontrado', p_quote_id;
  END IF;

  -- Limpar snapshot e descongelar
  UPDATE quotes
  SET 
    precos_congelados = false,
    snapshot_valores = NULL,
    data_congelamento = NULL
  WHERE id = p_quote_id;

  RAISE NOTICE 'Preços descongelados para orçamento %', p_quote_id;
END;
$$;

-- =============================================================================
-- FUNÇÃO: Obter Totais do Orçamento (Congelados ou Atuais)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_quote_totals(p_quote_id uuid)
RETURNS TABLE (
  total_cost numeric,
  total_price numeric,
  total_margin numeric,
  margin_percentage numeric,
  discount_value numeric,
  final_value numeric,
  is_frozen boolean,
  frozen_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_quote RECORD;
  v_total_cost numeric := 0;
  v_total_price numeric := 0;
  v_discount numeric := 0;
BEGIN
  -- Buscar orçamento
  SELECT 
    q.precos_congelados,
    q.snapshot_valores,
    q.data_congelamento,
    COALESCE(q.discount_value, 0) as discount
  INTO v_quote
  FROM quotes q
  WHERE q.id = p_quote_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento % não encontrado', p_quote_id;
  END IF;

  -- Se preços estão congelados, retornar do snapshot
  IF v_quote.precos_congelados AND v_quote.snapshot_valores IS NOT NULL THEN
    RETURN QUERY
    SELECT
      (v_quote.snapshot_valores->'totals'->>'total_cost')::numeric as total_cost,
      (v_quote.snapshot_valores->'totals'->>'total_price')::numeric as total_price,
      (v_quote.snapshot_valores->'totals'->>'total_margin')::numeric as total_margin,
      (v_quote.snapshot_valores->'totals'->>'margin_percentage')::numeric as margin_percentage,
      (v_quote.snapshot_valores->'totals'->>'discount_value')::numeric as discount_value,
      (v_quote.snapshot_valores->'totals'->>'final_value')::numeric as final_value,
      true as is_frozen,
      v_quote.data_congelamento as frozen_at;
  ELSE
    -- Calcular valores atuais
    SELECT 
      COALESCE(SUM(
        qi.quantity * 
        COALESCE(
          CASE 
            WHEN qi.item_type = 'product' THEN p.custo_unitario_materiais
            WHEN qi.item_type = 'material' THEN m.unit_cost
            WHEN qi.item_type = 'composition' THEN c.total_cost
          END, 
          0
        )
      ), 0),
      COALESCE(SUM(qi.quantity * qi.proposed_price), 0)
    INTO v_total_cost, v_total_price
    FROM quote_items qi
    LEFT JOIN products p ON p.id = qi.product_id
    LEFT JOIN materials m ON m.id = qi.material_id
    LEFT JOIN compositions c ON c.id = qi.composition_id
    WHERE qi.quote_id = p_quote_id;

    v_discount := v_quote.discount;

    RETURN QUERY
    SELECT
      ROUND(v_total_cost, 2) as total_cost,
      ROUND(v_total_price, 2) as total_price,
      ROUND(v_total_price - v_total_cost, 2) as total_margin,
      CASE 
        WHEN v_total_price > 0 THEN ROUND(((v_total_price - v_total_cost) / v_total_price * 100)::numeric, 2)
        ELSE 0::numeric
      END as margin_percentage,
      ROUND(v_discount, 2) as discount_value,
      ROUND(v_total_price - v_discount, 2) as final_value,
      false as is_frozen,
      NULL::timestamptz as frozen_at;
  END IF;
END;
$$;

-- Comentários explicativos
COMMENT ON FUNCTION freeze_quote_prices(uuid) IS 'Congela os preços do orçamento, criando um snapshot dos valores atuais';
COMMENT ON FUNCTION unfreeze_quote_prices(uuid) IS 'Descongela os preços do orçamento, voltando a calcular em tempo real';
COMMENT ON FUNCTION get_quote_totals(uuid) IS 'Retorna totais do orçamento (usa snapshot se congelado, senão calcula)';
