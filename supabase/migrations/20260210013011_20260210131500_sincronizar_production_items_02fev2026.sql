/*
  # Sincronizar production_items com custos_no_momento para 02/02/2026

  ## Problema
  Dois produtos de 02/02/2026 têm valores diferentes:
  - custos_no_momento (JSONB antigo)
  - production_items (tabela relacional)
  
  Produtos afetados:
  1. Pilar 18x25: JSONB = 1.113,40 vs Items = 704,65
  2. Pilar 25x35: JSONB = 660,46 vs Items = 375,09
  
  ## Solução
  Forçar recálculo de custos para essas produções e atualizar production_items.
  O campo custos_no_momento será atualizado com valores corretos.
  
  ## Observação
  production_items é a fonte de verdade (usa custos atualizados).
  custos_no_momento será sincronizado para manter consistência.
*/

DO $$
DECLARE
  v_production RECORD;
  v_custos JSONB;
BEGIN
  -- Buscar as duas produções problemáticas de 02/02/2026
  FOR v_production IN
    SELECT
      p.id,
      p.product_id,
      p.quantity,
      prod.name,
      prod.recipe_id
    FROM production p
    INNER JOIN products prod ON prod.id = p.product_id
    WHERE p.production_date = '2026-02-02'
      AND prod.recipe_id IS NOT NULL
      AND prod.name IN (
        'Pilar pré moldado de 18x25 - H=4.85',
        'Pilar pré moldado de 25 x 35 - H 6,20'
      )
  LOOP
    RAISE NOTICE 'Reprocessando: % (quantidade: %)', v_production.name, v_production.quantity;

    -- Deletar production_items antigos
    DELETE FROM production_items WHERE production_id = v_production.id;

    -- Recalcular custos
    v_custos := calculate_production_costs(
      v_production.recipe_id,
      v_production.quantity::decimal
    );

    -- Atualizar custos_no_momento (isso dispara trigger que popula production_items)
    UPDATE production
    SET custos_no_momento = v_custos
    WHERE id = v_production.id;

    RAISE NOTICE 'OK: % reprocessado com sucesso', v_production.name;
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Sincronização concluída para 02/02/2026';
  RAISE NOTICE '========================================';
END $$;

-- Verificar resultado
DO $$
DECLARE
  v_result RECORD;
BEGIN
  RAISE NOTICE 'Verificando sincronização...';
  
  FOR v_result IN
    SELECT 
      prod.name,
      p.quantity,
      (p.custos_no_momento->>'total_cost')::numeric as custo_jsonb,
      SUM(pi.total_cost) as custo_items,
      ABS((p.custos_no_momento->>'total_cost')::numeric - SUM(pi.total_cost)) as diferenca
    FROM production p
    JOIN products prod ON prod.id = p.product_id
    LEFT JOIN production_items pi ON pi.production_id = p.id
    WHERE p.production_date = '2026-02-02'
      AND prod.name IN (
        'Pilar pré moldado de 18x25 - H=4.85',
        'Pilar pré moldado de 25 x 35 - H 6,20'
      )
    GROUP BY p.id, prod.name, p.quantity, p.custos_no_momento
  LOOP
    IF v_result.diferenca < 0.10 THEN
      RAISE NOTICE 'OK: % - JSONB: % | Items: % | Dif: %', 
        v_result.name, 
        v_result.custo_jsonb::text, 
        v_result.custo_items::text,
        v_result.diferenca::text;
    ELSE
      RAISE WARNING 'ATENÇÃO: % - Diferença ainda existe: %', 
        v_result.name, 
        v_result.diferenca::text;
    END IF;
  END LOOP;
END $$;
