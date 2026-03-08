/*
  # Reprocessar Produções Sem Production Items

  ## Problema
  Produções após 04/02/2026 foram criadas com:
  - `custos_no_momento: {}`  (JSONB vazio)
  - Sem dados em `production_items`
  - Isso impede a geração de relatórios

  ## Solução
  1. Identificar produções sem production_items
  2. Recalcular custos usando `calculate_production_costs`
  3. Atualizar campo `custos_no_momento`
  4. Trigger automático popula `production_items`

  ## Observações
  - Apenas processa produções com produtos que tenham recipe_id
  - Produções sem recipe_id não podem ter custos calculados
  - Exclui ajustes de estoque
*/

-- FUNÇÃO PARA REPROCESSAR PRODUÇÕES SEM PRODUCTION_ITEMS
CREATE OR REPLACE FUNCTION reprocessar_producoes_sem_items()
RETURNS TABLE (
  production_id UUID,
  product_name TEXT,
  processed BOOLEAN,
  reason TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_production RECORD;
  v_custos JSONB;
  v_recipe_id UUID;
BEGIN
  -- Buscar produções sem production_items
  FOR v_production IN
    SELECT
      p.id,
      p.product_id,
      p.quantity,
      prod.name as product_name,
      prod.recipe_id
    FROM production p
    INNER JOIN products prod ON prod.id = p.product_id
    WHERE NOT EXISTS (
      SELECT 1 FROM production_items pi WHERE pi.production_id = p.id
    )
    AND (p.notes IS NULL OR NOT p.notes ILIKE '%ajuste de estoque%')
    AND p.production_date >= CURRENT_DATE - INTERVAL '60 days'
    ORDER BY p.production_date DESC, p.created_at DESC
  LOOP
    IF v_production.recipe_id IS NULL THEN
      production_id := v_production.id;
      product_name := v_production.product_name;
      processed := FALSE;
      reason := 'Produto sem receita definida';
      RETURN NEXT;
      CONTINUE;
    END IF;

    BEGIN
      v_custos := calculate_production_costs(
        v_production.recipe_id,
        v_production.quantity::decimal
      );

      IF v_custos IS NULL OR v_custos = '{}'::jsonb THEN
        production_id := v_production.id;
        product_name := v_production.product_name;
        processed := FALSE;
        reason := 'Falha ao calcular custos (custos vazios)';
        RETURN NEXT;
        CONTINUE;
      END IF;

      UPDATE production
      SET custos_no_momento = v_custos
      WHERE id = v_production.id;

      production_id := v_production.id;
      product_name := v_production.product_name;
      processed := TRUE;
      reason := 'Custos calculados e production_items populado';
      RETURN NEXT;

    EXCEPTION WHEN OTHERS THEN
      production_id := v_production.id;
      product_name := v_production.product_name;
      processed := FALSE;
      reason := 'Erro: ' || SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;

-- EXECUTAR REPROCESSAMENTO AUTOMÁTICO
DO $$
DECLARE
  v_result RECORD;
  v_processed_count INTEGER := 0;
  v_failed_count INTEGER := 0;
  v_total_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Iniciando reprocessamento de produções sem production_items...';

  FOR v_result IN
    SELECT * FROM reprocessar_producoes_sem_items()
  LOOP
    v_total_count := v_total_count + 1;

    IF v_result.processed THEN
      v_processed_count := v_processed_count + 1;
      RAISE NOTICE 'OK: % - %', v_result.product_name, v_result.reason;
    ELSE
      v_failed_count := v_failed_count + 1;
      RAISE NOTICE 'SKIP: % - %', v_result.product_name, v_result.reason;
    END IF;
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'RESUMO DO REPROCESSAMENTO';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total de produções: %', v_total_count;
  RAISE NOTICE 'Processadas com sucesso: %', v_processed_count;
  RAISE NOTICE 'Não processadas: %', v_failed_count;
  RAISE NOTICE '========================================';

  IF v_processed_count = 0 AND v_total_count > 0 THEN
    RAISE WARNING 'Nenhuma produção foi reprocessada com sucesso!';
  END IF;
END $$;

COMMENT ON FUNCTION reprocessar_producoes_sem_items IS
'Reprocessa produções antigas sem production_items, calculando custos e populando tabela';

CREATE INDEX IF NOT EXISTS idx_production_date_created
ON production (production_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_production_items_production_lookup
ON production_items (production_id);
