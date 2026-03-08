/*
  # Simplificar Sistema de Custo Unitário (Versão Final)
  
  ## Decisão de Arquitetura
  
  O frontend JÁ calcula o custo corretamente na "Memória de Cálculo" e salva em `material_cost`.
  Vamos usar esse valor como fonte de verdade.
  
  ## Solução
  
  1. Manter `custo_unitario_materiais` como coluna oficial para relatórios
  2. Copiar `material_cost` → `custo_unitario_materiais` em backfill
  3. Frontend salvará ambos ao calcular memória
  4. Função admin para recalcular quando necessário
*/

-- 1. REMOVER TRIGGERS COMPLEXOS
DROP TRIGGER IF EXISTS trigger_recipe_items_atualizar_custo ON recipe_items;
DROP TRIGGER IF EXISTS trigger_reinforcements_atualizar_custo ON product_reinforcements;
DROP TRIGGER IF EXISTS trigger_accessories_atualizar_custo ON product_accessories;
DROP FUNCTION IF EXISTS trigger_atualizar_custo_unitario_produto();

-- 2. FUNÇÃO SIMPLIFICADA - Retornar material_cost ou production_cost
CREATE OR REPLACE FUNCTION calcular_custo_unitario_materiais(p_product_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  v_custo NUMERIC;
BEGIN
  SELECT COALESCE(material_cost, production_cost, manual_unit_cost, 0)
  INTO v_custo
  FROM products
  WHERE id = p_product_id;
  
  RETURN v_custo;
END;
$$;

COMMENT ON FUNCTION calcular_custo_unitario_materiais IS
'Retorna custo unitário: material_cost > production_cost > manual_unit_cost > 0';

-- 3. FUNÇÃO ADMIN PARA RECALCULAR TODOS OS PRODUTOS
CREATE OR REPLACE FUNCTION admin_recalcular_custos_produtos()
RETURNS TABLE(
  product_id UUID,
  product_name TEXT,
  custo_anterior NUMERIC,
  custo_novo NUMERIC,
  diferenca NUMERIC,
  status TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_product RECORD;
  v_count_updated INTEGER := 0;
  v_count_unchanged INTEGER := 0;
BEGIN
  FOR v_product IN 
    SELECT 
      p.id, 
      p.name,
      p.custo_unitario_materiais as custo_atual,
      COALESCE(p.material_cost, p.production_cost, p.manual_unit_cost, 0) as custo_calculado
    FROM products p
    ORDER BY p.name
  LOOP
    IF COALESCE(v_product.custo_atual, -1) != v_product.custo_calculado THEN
      UPDATE products
      SET custo_unitario_materiais = v_product.custo_calculado
      WHERE id = v_product.id;
      
      v_count_updated := v_count_updated + 1;
      
      product_id := v_product.id;
      product_name := v_product.name;
      custo_anterior := v_product.custo_atual;
      custo_novo := v_product.custo_calculado;
      diferenca := v_product.custo_calculado - COALESCE(v_product.custo_atual, 0);
      status := CASE 
        WHEN v_product.custo_calculado > 0 THEN '✅ ATUALIZADO'
        ELSE '⚠️ ZERO'
      END;
      
      RETURN NEXT;
    ELSE
      v_count_unchanged := v_count_unchanged + 1;
    END IF;
  END LOOP;
  
  -- Resumo
  product_id := NULL;
  product_name := '=== RESUMO ===';
  custo_anterior := NULL;
  custo_novo := v_count_updated;
  diferenca := v_count_unchanged;
  status := format('%s atualizados, %s sem mudança', v_count_updated, v_count_unchanged);
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION admin_recalcular_custos_produtos IS
'Recalcula custo_unitario_materiais copiando de material_cost/production_cost.
USO: SELECT * FROM admin_recalcular_custos_produtos();';

-- 4. BACKFILL: Copiar material_cost para custo_unitario_materiais
DO $$
DECLARE
  v_total INTEGER;
  v_atualizado INTEGER;
  v_com_custo INTEGER;
  v_sem_custo INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM products;
  
  -- Atualizar onde custo_unitario_materiais está NULL ou diferente
  UPDATE products
  SET custo_unitario_materiais = COALESCE(material_cost, production_cost, manual_unit_cost, 0)
  WHERE custo_unitario_materiais IS NULL
     OR custo_unitario_materiais != COALESCE(material_cost, production_cost, manual_unit_cost, 0);
  
  GET DIAGNOSTICS v_atualizado = ROW_COUNT;
  
  -- Contar produtos com/sem custo
  SELECT 
    COUNT(*) FILTER (WHERE custo_unitario_materiais > 0),
    COUNT(*) FILTER (WHERE custo_unitario_materiais IS NULL OR custo_unitario_materiais = 0)
  INTO v_com_custo, v_sem_custo
  FROM products;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  BACKFILL DE CUSTOS CONCLUÍDO';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Estatísticas:';
  RAISE NOTICE '  • Total de produtos: %', v_total;
  RAISE NOTICE '  • Produtos atualizados: %', v_atualizado;
  RAISE NOTICE '  • ✅ Com custo > 0: %', v_com_custo;
  RAISE NOTICE '  • ⚠️ Sem custo (NULL ou 0): %', v_sem_custo;
  RAISE NOTICE '';
  
  IF v_sem_custo > 0 THEN
    RAISE NOTICE '💡 AÇÃO NECESSÁRIA:';
    RAISE NOTICE '  Produtos sem custo precisam ter a "Memória de Cálculo"';
    RAISE NOTICE '  calculada na tela de Produtos.';
    RAISE NOTICE '';
  END IF;
END $$;
