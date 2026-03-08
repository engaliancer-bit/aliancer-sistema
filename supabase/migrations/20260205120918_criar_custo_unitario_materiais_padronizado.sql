/*
  # Criar Sistema Padronizado de Custo Unitário de Materiais

  ## Problema
  Custos intermitentes no relatório: alguns produtos mostram custo correto, 
  outros mostram valores muito baixos (0.79, 0.95) ou zero.
  
  ## Solução
  1. Coluna dedicada `custo_unitario_materiais` em products
  2. Função para calcular custo unitário baseado em:
     - Recipe (traço) com items
     - Product reinforcements (armaduras)
     - Product accessories (acessórios)
  3. Backfill para recalcular todos os produtos existentes
  4. Trigger para atualizar automaticamente
  
  ## Estrutura
  - custo_unitario_materiais: valor exato do "CUSTO TOTAL DE MATERIAIS" por unidade
  - Calculado a partir de: recipe_items + reinforcements + accessories
  - NULL = não calculado ainda (não usar 0)
*/

-- 1. ADICIONAR COLUNA custo_unitario_materiais
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS custo_unitario_materiais NUMERIC(10, 4) DEFAULT NULL;

COMMENT ON COLUMN products.custo_unitario_materiais IS
'Custo unitário de materiais calculado automaticamente.
Baseado em: recipe_items + product_reinforcements + product_accessories.
NULL = não calculado. Este é o custo OFICIAL usado nos relatórios.';

-- 2. CRIAR FUNÇÃO PARA CALCULAR CUSTO UNITÁRIO DE MATERIAIS
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
  -- Buscar recipe_id do produto
  SELECT recipe_id, COALESCE(peso_artefato, 0)
  INTO v_recipe_id, v_peso_artefato
  FROM products
  WHERE id = p_product_id;

  -- Se não tem recipe, retornar NULL
  IF v_recipe_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 1. CALCULAR CUSTO DO TRAÇO (recipe_items)
  -- Soma: (quantidade_material / 1000) * unit_cost
  SELECT COALESCE(SUM(
    (ri.quantity / 1000.0) * COALESCE(m.unit_cost, 0)
  ), 0)
  INTO v_custo_traco
  FROM recipe_items ri
  INNER JOIN materials m ON m.id = ri.material_id
  WHERE ri.recipe_id = v_recipe_id;

  -- 2. CALCULAR CUSTO DAS ARMADURAS (product_reinforcements)
  -- Para cada armadura, calcular consumo baseado em:
  -- - Tipo de armadura (longitudinal, estribo, etc)
  -- - Quantidade de ferros, diâmetro, comprimento
  -- - Peso específico do ferro (unit_weight do material)
  
  SELECT COALESCE(SUM(
    CASE
      -- Armadura longitudinal: quantidade * comprimento * peso_unitario
      WHEN pr.reinforcement_type = 'longitudinal' THEN
        COALESCE(pr.quantity, 0) * 
        COALESCE(pr.length_per_unit, 0) * 
        COALESCE(m.unit_weight, 0) * 
        COALESCE(m.unit_cost, 0)
      
      -- Estribos: quantidade * espaçamento * peso_unitario
      WHEN pr.reinforcement_type = 'estribo' THEN
        COALESCE(pr.quantity, 0) * 
        COALESCE(pr.spacing, 0) * 
        COALESCE(m.unit_weight, 0) * 
        COALESCE(m.unit_cost, 0)
      
      -- Outros tipos
      ELSE
        COALESCE(pr.quantity, 0) * 
        COALESCE(pr.length_per_unit, 0) * 
        COALESCE(m.unit_weight, 0) * 
        COALESCE(m.unit_cost, 0)
    END
  ), 0)
  INTO v_custo_armaduras
  FROM product_reinforcements pr
  INNER JOIN materials m ON m.id = pr.material_id
  WHERE pr.product_id = p_product_id;

  -- 3. CALCULAR CUSTO DOS ACESSÓRIOS (product_accessories)
  -- Soma: quantity * unit_cost
  SELECT COALESCE(SUM(
    COALESCE(pa.quantity, 0) * COALESCE(m.unit_cost, 0)
  ), 0)
  INTO v_custo_acessorios
  FROM product_accessories pa
  INNER JOIN materials m ON m.id = pa.material_id
  WHERE pa.product_id = p_product_id;

  -- 4. CALCULAR CUSTO TOTAL
  v_custo_total := v_custo_traco + v_custo_armaduras + v_custo_acessorios;

  -- 5. AJUSTAR POR PESO DO ARTEFATO se configurado
  -- Se peso_artefato > 0, usar para calcular traço proporcional
  IF v_peso_artefato > 0 THEN
    -- Buscar densidade do traço
    DECLARE
      v_densidade NUMERIC := 0;
    BEGIN
      SELECT COALESCE(specific_weight, 2400)
      INTO v_densidade
      FROM recipes
      WHERE id = v_recipe_id;

      -- Recalcular custo do traço baseado no peso
      v_custo_traco := (v_peso_artefato / v_densidade) * v_custo_traco;
      v_custo_total := v_custo_traco + v_custo_armaduras + v_custo_acessorios;
    END;
  END IF;

  RETURN ROUND(v_custo_total, 4);
END;
$$;

COMMENT ON FUNCTION calcular_custo_unitario_materiais IS
'Calcula custo unitário de materiais de um produto baseado em:
1. Recipe items (traço)
2. Product reinforcements (armaduras)
3. Product accessories (acessórios)
4. Ajuste por peso_artefato se configurado
Retorna NULL se produto não tem recipe.';

-- 3. CRIAR FUNÇÃO PARA BACKFILL (RECALCULAR TODOS)
CREATE OR REPLACE FUNCTION backfill_custo_unitario_materiais()
RETURNS TABLE(
  product_id UUID,
  product_name TEXT,
  custo_calculado NUMERIC,
  status TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_product RECORD;
  v_custo NUMERIC;
  v_count_success INTEGER := 0;
  v_count_failed INTEGER := 0;
BEGIN
  -- Percorrer todos os produtos com recipe
  FOR v_product IN 
    SELECT p.id, p.name, p.recipe_id
    FROM products p
    WHERE p.recipe_id IS NOT NULL
    ORDER BY p.name
  LOOP
    BEGIN
      -- Calcular custo
      v_custo := calcular_custo_unitario_materiais(v_product.id);
      
      -- Atualizar produto
      UPDATE products
      SET custo_unitario_materiais = v_custo,
          updated_at = NOW()
      WHERE id = v_product.id;
      
      v_count_success := v_count_success + 1;
      
      -- Retornar resultado
      product_id := v_product.id;
      product_name := v_product.name;
      custo_calculado := v_custo;
      status := CASE 
        WHEN v_custo IS NULL THEN '⚠️ NULL (sem recipe_items?)'
        WHEN v_custo = 0 THEN '⚠️ ZERO (sem materiais?)'
        ELSE '✅ OK'
      END;
      
      RETURN NEXT;
      
    EXCEPTION WHEN OTHERS THEN
      v_count_failed := v_count_failed + 1;
      
      product_id := v_product.id;
      product_name := v_product.name;
      custo_calculado := NULL;
      status := '❌ ERRO: ' || SQLERRM;
      
      RETURN NEXT;
    END;
  END LOOP;
  
  -- Linha de resumo
  product_id := NULL;
  product_name := '--- RESUMO ---';
  custo_calculado := v_count_success;
  status := format('✅ Sucesso: %s | ❌ Falhas: %s', v_count_success, v_count_failed);
  RETURN NEXT;
  
  RETURN;
END;
$$;

COMMENT ON FUNCTION backfill_custo_unitario_materiais IS
'Recalcula custo_unitario_materiais para TODOS os produtos.
Retorna tabela com resultado de cada produto.
Use: SELECT * FROM backfill_custo_unitario_materiais();';

-- 4. CRIAR TRIGGER PARA ATUALIZAR AUTOMATICAMENTE
-- Quando recipe_items, product_reinforcements ou product_accessories mudam
CREATE OR REPLACE FUNCTION trigger_atualizar_custo_unitario_produto()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_product_id UUID;
  v_custo NUMERIC;
BEGIN
  -- Identificar product_id baseado na tabela
  IF TG_TABLE_NAME = 'recipe_items' THEN
    -- Buscar produtos que usam essa receita
    FOR v_product_id IN
      SELECT id FROM products WHERE recipe_id = COALESCE(NEW.recipe_id, OLD.recipe_id)
    LOOP
      v_custo := calcular_custo_unitario_materiais(v_product_id);
      UPDATE products SET custo_unitario_materiais = v_custo WHERE id = v_product_id;
    END LOOP;
    
  ELSIF TG_TABLE_NAME = 'product_reinforcements' THEN
    v_product_id := COALESCE(NEW.product_id, OLD.product_id);
    v_custo := calcular_custo_unitario_materiais(v_product_id);
    UPDATE products SET custo_unitario_materiais = v_custo WHERE id = v_product_id;
    
  ELSIF TG_TABLE_NAME = 'product_accessories' THEN
    v_product_id := COALESCE(NEW.product_id, OLD.product_id);
    v_custo := calcular_custo_unitario_materiais(v_product_id);
    UPDATE products SET custo_unitario_materiais = v_custo WHERE id = v_product_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Aplicar triggers
DROP TRIGGER IF EXISTS trigger_recipe_items_atualizar_custo ON recipe_items;
CREATE TRIGGER trigger_recipe_items_atualizar_custo
AFTER INSERT OR UPDATE OR DELETE ON recipe_items
FOR EACH ROW
EXECUTE FUNCTION trigger_atualizar_custo_unitario_produto();

DROP TRIGGER IF EXISTS trigger_reinforcements_atualizar_custo ON product_reinforcements;
CREATE TRIGGER trigger_reinforcements_atualizar_custo
AFTER INSERT OR UPDATE OR DELETE ON product_reinforcements
FOR EACH ROW
EXECUTE FUNCTION trigger_atualizar_custo_unitario_produto();

DROP TRIGGER IF EXISTS trigger_accessories_atualizar_custo ON product_accessories;
CREATE TRIGGER trigger_accessories_atualizar_custo
AFTER INSERT OR UPDATE OR DELETE ON product_accessories
FOR EACH ROW
EXECUTE FUNCTION trigger_atualizar_custo_unitario_produto();

-- 5. CRIAR ÍNDICE PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_products_custo_unitario_materiais
ON products (custo_unitario_materiais)
WHERE custo_unitario_materiais IS NOT NULL;

-- 6. EXECUTAR BACKFILL INICIAL
-- Recalcular todos os produtos existentes
DO $$
DECLARE
  v_result RECORD;
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE '🔄 Iniciando backfill de custos unitários...';
  
  FOR v_result IN SELECT * FROM backfill_custo_unitario_materiais()
  LOOP
    v_count := v_count + 1;
    
    -- Logar apenas primeiros 10 e últimos 5
    IF v_count <= 10 OR v_result.product_name = '--- RESUMO ---' THEN
      RAISE NOTICE '  % - % = R$ %: %',
        v_count,
        v_result.product_name,
        COALESCE(v_result.custo_calculado, 0),
        v_result.status;
    END IF;
  END LOOP;
  
  RAISE NOTICE '✅ Backfill concluído!';
END $$;
