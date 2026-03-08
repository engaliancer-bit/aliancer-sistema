/*
  # Corrigir Função - Usar Campos Corretos
  
  Usar:
  - materials.weight_per_unit (não unit_weight)
  - product_reinforcements.total_length_meters
  - Cálculo simplificado e robusto
*/

-- RECRIAR FUNÇÃO COM CAMPOS CORRETOS
CREATE OR REPLACE FUNCTION calcular_custo_unitario_materiais(p_product_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  v_recipe_id UUID;
  v_custo_traco NUMERIC := 0;
  v_custo_armaduras NUMERIC := 0;
  v_custo_acessorios NUMERIC := 0;
  v_custo_total NUMERIC := 0;
  v_peso_artefato NUMERIC := 0;
BEGIN
  -- Buscar recipe_id e peso_artefato do produto
  SELECT recipe_id, COALESCE(peso_artefato, 0)
  INTO v_recipe_id, v_peso_artefato
  FROM products
  WHERE id = p_product_id;

  -- Se não tem recipe, retornar NULL
  IF v_recipe_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 1. CALCULAR CUSTO DO TRAÇO (recipe_items)
  -- recipe_items.quantity está em kg
  -- materials.unit_cost está em R$/kg
  -- Dividir por 1000 para converter de kg para toneladas se necessário
  -- Mas como unit_cost já é por kg, usar direto
  SELECT COALESCE(SUM(
    COALESCE(ri.quantity, 0) * COALESCE(m.unit_cost, 0) / 1000.0
  ), 0)
  INTO v_custo_traco
  FROM recipe_items ri
  INNER JOIN materials m ON m.id = ri.material_id
  WHERE ri.recipe_id = v_recipe_id;

  -- Ajustar custo do traço pelo peso_artefato se configurado
  IF v_peso_artefato > 0 THEN
    DECLARE
      v_densidade NUMERIC := 2400; -- kg/m³
      v_volume_m3 NUMERIC := 0;
    BEGIN
      -- Buscar densidade específica do traço
      SELECT COALESCE(specific_weight, 2400)
      INTO v_densidade
      FROM recipes
      WHERE id = v_recipe_id;

      -- Volume = peso / densidade
      v_volume_m3 := v_peso_artefato / v_densidade;
      
      -- Ajustar custo proporcionalmente
      v_custo_traco := v_volume_m3 * v_custo_traco;
    END;
  END IF;

  -- 2. CALCULAR CUSTO DAS ARMADURAS (product_reinforcements)
  -- total_length_meters * weight_per_unit (kg/m) * unit_cost (R$/kg)
  SELECT COALESCE(SUM(
    COALESCE(pr.total_length_meters, 0) * 
    COALESCE(m.weight_per_unit, 0) * 
    COALESCE(m.unit_cost, 0)
  ), 0)
  INTO v_custo_armaduras
  FROM product_reinforcements pr
  INNER JOIN materials m ON m.id = pr.material_id
  WHERE pr.product_id = p_product_id;

  -- 3. CALCULAR CUSTO DOS ACESSÓRIOS (product_accessories)
  -- Usar campos disponíveis (verificar com COALESCE)
  BEGIN
    SELECT COALESCE(SUM(
      CASE
        -- Se tiver campo quantity
        WHEN EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'product_accessories' 
            AND column_name = 'quantity'
        ) THEN COALESCE(pa.quantity, 0) * COALESCE(m.unit_cost, 0)
        -- Senão, usar peso ou custo direto
        ELSE COALESCE(m.unit_cost, 0)
      END
    ), 0)
    INTO v_custo_acessorios
    FROM product_accessories pa
    INNER JOIN materials m ON m.id = pa.material_id
    WHERE pa.product_id = p_product_id;
  EXCEPTION WHEN OTHERS THEN
    v_custo_acessorios := 0;
  END;

  -- 4. CALCULAR CUSTO TOTAL
  v_custo_total := v_custo_traco + v_custo_armaduras + v_custo_acessorios;

  RETURN ROUND(v_custo_total, 4);
EXCEPTION WHEN OTHERS THEN
  -- Em caso de erro, retornar NULL e logar
  RAISE WARNING 'Erro ao calcular custo para produto %: %', p_product_id, SQLERRM;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION calcular_custo_unitario_materiais IS
'Calcula custo unitário de materiais de um produto.
Baseado em: recipe_items + product_reinforcements + product_accessories.
Retorna NULL se produto não tem recipe ou em caso de erro.';

-- Executar novo backfill com tratamento de erros
DO $$
DECLARE
  v_product RECORD;
  v_custo NUMERIC;
  v_count INTEGER := 0;
  v_success INTEGER := 0;
  v_null INTEGER := 0;
  v_failed INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔄 Recalculando custos unitários de materiais...';
  RAISE NOTICE '';
  
  FOR v_product IN 
    SELECT p.id, p.name, p.recipe_id
    FROM products p
    WHERE p.recipe_id IS NOT NULL
    ORDER BY p.name
  LOOP
    v_count := v_count + 1;
    
    BEGIN
      v_custo := calcular_custo_unitario_materiais(v_product.id);
      
      UPDATE products
      SET custo_unitario_materiais = v_custo,
          updated_at = NOW()
      WHERE id = v_product.id;
      
      IF v_custo IS NULL THEN
        v_null := v_null + 1;
        IF v_count <= 15 THEN
          RAISE NOTICE '  ⚠️ % - NULL', v_product.name;
        END IF;
      ELSIF v_custo = 0 THEN
        v_null := v_null + 1;
        IF v_count <= 15 THEN
          RAISE NOTICE '  ⚠️ % - R$ 0,00', v_product.name;
        END IF;
      ELSE
        v_success := v_success + 1;
        IF v_count <= 15 THEN
          RAISE NOTICE '  ✅ % - R$ %', v_product.name, v_custo;
        END IF;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      IF v_count <= 15 THEN
        RAISE NOTICE '  ❌ %: %', v_product.name, SQLERRM;
      END IF;
    END;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '📊 RESUMO DO BACKFILL:';
  RAISE NOTICE '  Total processados: %', v_count;
  RAISE NOTICE '  ✅ Com custo válido: %', v_success;
  RAISE NOTICE '  ⚠️ NULL ou zero: %', v_null;
  RAISE NOTICE '  ❌ Falhas: %', v_failed;
  RAISE NOTICE '';
END $$;
