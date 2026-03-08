/*
  # Reprocessar production_items de produções existentes

  ## Problema
  Produções anteriores foram criadas com custos calculados (custos_no_momento)
  mas a tabela production_items ficou vazia, causando falha no "Gerar Resumo do Dia".

  ## Solução
  Reprocessar todas as produções que têm custos_no_momento mas não têm production_items.
*/

DO $$
DECLARE
  v_production RECORD;
  v_items_count INT;
  v_processed_count INT := 0;
BEGIN
  RAISE NOTICE 'Iniciando reprocessamento de production_items...';

  -- Buscar produções com custos mas sem items
  FOR v_production IN
    SELECT 
      p.id,
      p.production_date,
      p.product_id,
      p.custos_no_momento
    FROM production p
    WHERE p.custos_no_momento IS NOT NULL
    AND p.custos_no_momento != '{}'::jsonb
    AND jsonb_typeof(p.custos_no_momento->'materials') = 'object'
    AND NOT EXISTS (
      SELECT 1 FROM production_items pi WHERE pi.production_id = p.id
    )
    ORDER BY p.production_date DESC
    LIMIT 100  -- Limitar para não travar
  LOOP
    BEGIN
      -- Extrair items dos custos
      PERFORM extract_production_items_from_custos(
        v_production.id,
        v_production.custos_no_momento
      );

      -- Verificar quantos items foram criados
      SELECT COUNT(*) INTO v_items_count
      FROM production_items
      WHERE production_id = v_production.id;

      IF v_items_count > 0 THEN
        v_processed_count := v_processed_count + 1;
        RAISE NOTICE 'Produção % reprocessada: % items', 
          v_production.id, v_items_count;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao reprocessar produção %: %', 
        v_production.id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Reprocessamento concluído: % produções atualizadas', v_processed_count;
END;
$$;
