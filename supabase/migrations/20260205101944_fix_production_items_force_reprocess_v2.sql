/*
  # Forçar Reprocessamento de Production Items

  ## Problema
  Produções existem mas get_resumo_producao_dia retorna vazio.
  
  ## Diagnóstico
  1. Verificar se production tem custos_no_momento
  2. Verificar se production_items está vazia
  3. Forçar reprocessamento de TUDO
  
  ## Solução
  1. Limpar production_items existentes
  2. Re-processar TODAS as produções
  3. Adicionar logging extremo
  4. Garantir que trigger está ativo
*/

-- EXECUTAR TUDO EM UM ÚNICO BLOCO
DO $$
DECLARE
  v_total_productions INT;
  v_with_custos INT;
  v_with_materials INT;
  v_items_count INT;
  v_prod RECORD;
  v_items_inseridos INT := 0;
  v_producoes_processadas INT := 0;
  v_erros INT := 0;
  v_material_key TEXT;
  v_material_value JSONB;
  v_mat_count INT;
  v_distinct_prods INT;
  v_prods_with_materials INT;
BEGIN
  -- 1. DIAGNÓSTICO ANTES
  SELECT COUNT(*) INTO v_total_productions FROM production;
  
  SELECT COUNT(*) INTO v_with_custos 
  FROM production WHERE custos_no_momento IS NOT NULL;
  
  SELECT COUNT(*) INTO v_with_materials
  FROM production 
  WHERE jsonb_typeof(custos_no_momento->'materials') = 'object';
  
  SELECT COUNT(DISTINCT production_id) INTO v_items_count 
  FROM production_items;
  
  RAISE NOTICE '=========================================';
  RAISE NOTICE 'DIAGNÓSTICO ANTES DO REPROCESSAMENTO';
  RAISE NOTICE '=========================================';
  RAISE NOTICE 'Total de produções: %', v_total_productions;
  RAISE NOTICE 'Com custos_no_momento: %', v_with_custos;
  RAISE NOTICE 'Com materials no JSON: %', v_with_materials;
  RAISE NOTICE 'Produções em production_items: %', v_items_count;
  RAISE NOTICE 'Diferença (sem items): %', v_with_materials - v_items_count;
  RAISE NOTICE '=========================================';
  
  -- 2. LIMPAR production_items
  TRUNCATE production_items;
  RAISE NOTICE 'production_items limpa. Reprocessando...';
  RAISE NOTICE '';
  
  -- 3. RE-PROCESSAR TODAS AS PRODUÇÕES
  RAISE NOTICE '=========================================';
  RAISE NOTICE 'INICIANDO REPROCESSAMENTO';
  RAISE NOTICE '=========================================';
  
  FOR v_prod IN
    SELECT 
      p.id,
      p.production_date,
      p.custos_no_momento,
      prod.name as product_name
    FROM production p
    LEFT JOIN products prod ON prod.id = p.product_id
    WHERE p.custos_no_momento IS NOT NULL
    ORDER BY p.production_date DESC, p.created_at DESC
  LOOP
    BEGIN
      -- Verificar se tem materials
      IF jsonb_typeof(v_prod.custos_no_momento->'materials') != 'object' THEN
        RAISE NOTICE 'Produção % (%) - custos_no_momento sem materials válido', 
          v_prod.id, v_prod.product_name;
        CONTINUE;
      END IF;
      
      -- Contar materials no JSON
      SELECT COUNT(*) INTO v_mat_count
      FROM jsonb_object_keys(v_prod.custos_no_momento->'materials');
      
      IF v_mat_count = 0 THEN
        RAISE NOTICE 'Produção % (%) - materials vazio', 
          v_prod.id, v_prod.product_name;
        CONTINUE;
      END IF;
      
      -- Inserir cada material
      FOR v_material_key, v_material_value IN
        SELECT key, value
        FROM jsonb_each(v_prod.custos_no_momento->'materials')
      LOOP
        BEGIN
          INSERT INTO production_items (
            production_id,
            material_id,
            material_name,
            quantity,
            unit,
            unit_cost,
            total_cost
          ) VALUES (
            v_prod.id,
            (v_material_value->>'material_id')::uuid,
            v_material_value->>'name',
            (v_material_value->>'quantity')::decimal,
            v_material_value->>'unit',
            COALESCE((v_material_value->>'unit_price')::decimal, 0),
            COALESCE((v_material_value->>'total')::decimal, 0)
          );
          
          v_items_inseridos := v_items_inseridos + 1;
          
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'Erro ao inserir material % da produção %: %',
            v_material_value->>'name', v_prod.id, SQLERRM;
        END;
      END LOOP;
      
      v_producoes_processadas := v_producoes_processadas + 1;
      
      IF v_producoes_processadas % 100 = 0 THEN
        RAISE NOTICE 'Processadas % produções...', v_producoes_processadas;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_erros := v_erros + 1;
      RAISE NOTICE 'ERRO ao processar produção %: %', v_prod.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '=========================================';
  RAISE NOTICE 'REPROCESSAMENTO CONCLUÍDO';
  RAISE NOTICE '=========================================';
  RAISE NOTICE 'Produções processadas: %', v_producoes_processadas;
  RAISE NOTICE 'Items inseridos: %', v_items_inseridos;
  RAISE NOTICE 'Erros: %', v_erros;
  RAISE NOTICE '=========================================';
  
  -- 4. VERIFICAR RESULTADO
  SELECT COUNT(*) INTO v_items_count FROM production_items;
  SELECT COUNT(DISTINCT production_id) INTO v_distinct_prods FROM production_items;
  
  SELECT COUNT(*) INTO v_prods_with_materials
  FROM production 
  WHERE jsonb_typeof(custos_no_momento->'materials') = 'object';
  
  RAISE NOTICE '';
  RAISE NOTICE '=========================================';
  RAISE NOTICE 'RESULTADO FINAL';
  RAISE NOTICE '=========================================';
  RAISE NOTICE 'Production_items total: %', v_items_count;
  RAISE NOTICE 'Produções distintas: %', v_distinct_prods;
  RAISE NOTICE 'Produções esperadas: %', v_prods_with_materials;
  RAISE NOTICE 'Cobertura: %%%', 
    CASE WHEN v_prods_with_materials > 0 
      THEN ROUND((v_distinct_prods::decimal / v_prods_with_materials * 100), 2)
      ELSE 0 
    END;
  RAISE NOTICE '=========================================';
END $$;

-- GARANTIR QUE TRIGGER ESTÁ ATIVO
DROP TRIGGER IF EXISTS trigger_sync_production_items ON production;

CREATE TRIGGER trigger_sync_production_items
  AFTER INSERT OR UPDATE OF custos_no_momento ON production
  FOR EACH ROW
  WHEN (NEW.custos_no_momento IS NOT NULL)
  EXECUTE FUNCTION sync_production_items_from_custos();
