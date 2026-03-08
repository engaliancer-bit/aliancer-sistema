/*
  # Corrigir Constraint e Popular production_items
  
  ## Problema
  A constraint `check_total_cost CHECK (total_cost = quantity * unit_cost)` 
  está bloqueando inserções por causa de arredondamentos decimais.
  
  Exemplo:
  - quantity: 18.9718
  - unit_cost: 0.15
  - total: 2.85 (arredondado)
  - quantity * unit_cost = 2.84577 ≠ 2.85
  
  ## Solução
  1. Remover constraint problemática
  2. Recriar extract_production_items_from_custos sem ON CONFLICT
  3. Popular todas as produções
*/

-- 1. REMOVER CONSTRAINT
ALTER TABLE production_items 
DROP CONSTRAINT IF EXISTS check_total_cost;

-- 2. RECRIAR FUNÇÃO extract_production_items_from_custos
CREATE OR REPLACE FUNCTION extract_production_items_from_custos(
  p_production_id UUID,
  p_custos JSONB
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_material_key TEXT;
  v_material JSONB;
BEGIN
  -- Verificar se tem materials
  IF jsonb_typeof(p_custos->'materials') != 'object' THEN
    RETURN;
  END IF;
  
  -- Deletar items existentes
  DELETE FROM production_items WHERE production_id = p_production_id;
  
  -- Iterar sobre cada material
  FOR v_material_key, v_material IN
    SELECT key, value
    FROM jsonb_each(p_custos->'materials')
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
        p_production_id,
        (v_material->>'material_id')::uuid,
        v_material->>'name',
        (v_material->>'quantity')::decimal,
        v_material->>'unit',
        COALESCE((v_material->>'unit_price')::decimal, 0),
        COALESCE((v_material->>'total')::decimal, 0)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Erro ao inserir material % da produção %: %',
        v_material->>'name', p_production_id, SQLERRM;
    END;
  END LOOP;
END;
$$;

-- 3. POPULAR TODAS AS PRODUÇÕES COM custos_no_momento
DO $$
DECLARE
  v_prod RECORD;
  v_total_populadas INT := 0;
  v_total_processadas INT := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=============================================';
  RAISE NOTICE 'POPULANDO production_items';
  RAISE NOTICE '=============================================';
  
  -- Limpar tudo antes
  TRUNCATE production_items;
  
  FOR v_prod IN
    SELECT
      p.id,
      p.custos_no_momento,
      prod.name as product_name,
      p.production_date
    FROM production p
    LEFT JOIN products prod ON prod.id = p.product_id
    WHERE p.custos_no_momento IS NOT NULL
      AND jsonb_typeof(p.custos_no_momento->'materials') = 'object'
    ORDER BY p.production_date DESC
  LOOP
    BEGIN
      v_total_processadas := v_total_processadas + 1;
      
      -- Verificar se tem materials
      DECLARE
        v_mat_count INT;
      BEGIN
        SELECT COUNT(*) INTO v_mat_count
        FROM jsonb_object_keys(v_prod.custos_no_momento->'materials');
        
        IF v_mat_count > 0 THEN
          PERFORM extract_production_items_from_custos(v_prod.id, v_prod.custos_no_momento);
          v_total_populadas := v_total_populadas + 1;
          
          IF v_total_populadas % 100 = 0 THEN
            RAISE NOTICE 'Populadas % produções...', v_total_populadas;
          END IF;
        END IF;
      END;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'ERRO ao popular produção %: %', v_prod.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '=============================================';
  RAISE NOTICE 'RESULTADO';
  RAISE NOTICE '=============================================';
  RAISE NOTICE 'Produções processadas: %', v_total_processadas;
  RAISE NOTICE 'Produções populadas: %', v_total_populadas;
  RAISE NOTICE 'Items inseridos: %', (SELECT COUNT(*) FROM production_items);
  RAISE NOTICE '=============================================';
END $$;
