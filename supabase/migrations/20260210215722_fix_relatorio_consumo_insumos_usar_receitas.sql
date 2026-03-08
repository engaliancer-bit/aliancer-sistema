/*
  # Corrigir Relatório de Consumo de Insumos

  ## Problema Identificado

  A função `relatorio_consumo_insumos` busca dados da tabela `production_items`,
  mas essa tabela pode não estar populada para todas as produções.

  Resultado: O relatório de consumo de insumos retorna vazio, impedindo o
  "Gerar Resumo do Dia" de mostrar o consumo de materiais.

  ## Causa Raiz

  1. Mudança para custos padronizados (custo_unitario_materiais, consumo_insumos)
  2. Função `relatorio_consumo_insumos` não foi atualizada
  3. Continua buscando de `production_items` que pode estar vazio

  ## Solução

  Reescrever `relatorio_consumo_insumos` para:
  1. Buscar produção com suas receitas
  2. Calcular consumo de materiais a partir de recipe_items
  3. Usar custos atuais dos materiais
  4. Agregar por material considerando todas as produções do período

  ## Vantagens

  - Funciona independente de production_items estar populado
  - Usa dados diretos das receitas (fonte confiável)
  - Mantém compatibilidade com código existente
  - Calcula consumo real com base nas quantidades produzidas
*/

-- ============================================
-- RECRIAR relatorio_consumo_insumos
-- ============================================

DROP FUNCTION IF EXISTS relatorio_consumo_insumos(date, date, uuid);

CREATE OR REPLACE FUNCTION relatorio_consumo_insumos(
  p_data_inicio DATE,
  p_data_fim DATE,
  p_material_id UUID DEFAULT NULL
)
RETURNS TABLE (
  material_id UUID,
  material_name TEXT,
  total_quantity DECIMAL,
  unit TEXT,
  avg_unit_cost DECIMAL,
  total_cost DECIMAL,
  usage_count BIGINT,
  first_usage DATE,
  last_usage DATE
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  WITH production_with_materials AS (
    -- Para cada produção, buscar os materiais da receita
    SELECT
      p.id as production_id,
      p.production_date,
      p.quantity as production_quantity,
      ri.material_id,
      m.name as material_name,
      m.unit,
      ri.quantity_per_unit,
      COALESCE(m.unit_cost, 0) as unit_cost,
      -- Calcular quantidade total consumida = qtd produzida × qtd por unidade
      (p.quantity * ri.quantity_per_unit) as total_material_quantity,
      -- Calcular custo total = quantidade × custo unitário
      (p.quantity * ri.quantity_per_unit * COALESCE(m.unit_cost, 0)) as total_material_cost
    FROM production p
    INNER JOIN products prod ON prod.id = p.product_id
    LEFT JOIN recipes r ON r.product_id = prod.id
    LEFT JOIN recipe_items ri ON ri.recipe_id = r.id
    LEFT JOIN materials m ON m.id = ri.material_id
    WHERE p.production_date >= p_data_inicio
      AND p.production_date <= p_data_fim
      AND (p.notes IS NULL OR NOT p.notes ILIKE '%ajuste de estoque%')
      AND ri.material_id IS NOT NULL  -- Só incluir produções que têm receita com materiais
      AND (p_material_id IS NULL OR ri.material_id = p_material_id)
  )
  SELECT
    pwm.material_id,
    pwm.material_name,
    SUM(pwm.total_material_quantity)::decimal as total_quantity,
    MAX(pwm.unit) as unit,
    AVG(pwm.unit_cost)::decimal as avg_unit_cost,
    SUM(pwm.total_material_cost)::decimal as total_cost,
    COUNT(DISTINCT pwm.production_id)::bigint as usage_count,
    MIN(pwm.production_date)::date as first_usage,
    MAX(pwm.production_date)::date as last_usage
  FROM production_with_materials pwm
  GROUP BY pwm.material_id, pwm.material_name
  HAVING SUM(pwm.total_material_quantity) > 0
  ORDER BY SUM(pwm.total_material_cost) DESC;
END;
$$;

COMMENT ON FUNCTION relatorio_consumo_insumos IS
  'Retorna consumo de insumos por período calculado a partir das receitas dos produtos (CORRIGIDO: não depende de production_items)';

-- ============================================
-- ATUALIZAR relatorio_total_produtos
-- ============================================

DROP FUNCTION IF EXISTS relatorio_total_produtos(date, date, uuid);

CREATE OR REPLACE FUNCTION relatorio_total_produtos(
  p_data_inicio DATE,
  p_data_fim DATE,
  p_product_id UUID DEFAULT NULL
)
RETURNS TABLE (
  production_date DATE,
  product_id UUID,
  product_name TEXT,
  product_code TEXT,
  total_quantity DECIMAL,
  unit TEXT,
  production_count BIGINT,
  total_material_cost DECIMAL,
  avg_cost_per_unit DECIMAL,
  product_unit_cost DECIMAL,
  sales_price DECIMAL,
  final_cost_per_unit DECIMAL,
  margin_per_unit DECIMAL,
  margin_percentage DECIMAL
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  WITH production_costs AS (
    -- Calcular custo de materiais por produção a partir das receitas
    SELECT
      p.id as production_id,
      p.production_date,
      p.product_id,
      p.quantity as production_quantity,
      SUM(ri.quantity_per_unit * p.quantity * COALESCE(m.unit_cost, 0)) as material_cost
    FROM production p
    INNER JOIN products prod ON prod.id = p.product_id
    LEFT JOIN recipes r ON r.product_id = prod.id
    LEFT JOIN recipe_items ri ON ri.recipe_id = r.id
    LEFT JOIN materials m ON m.id = ri.material_id
    WHERE p.production_date >= p_data_inicio
      AND p.production_date <= p_data_fim
      AND (p.notes IS NULL OR NOT p.notes ILIKE '%ajuste de estoque%')
      AND (p_product_id IS NULL OR p.product_id = p_product_id)
    GROUP BY p.id, p.production_date, p.product_id, p.quantity
  )
  SELECT
    pc.production_date::date,
    prod.id as product_id,
    prod.name as product_name,
    COALESCE(prod.code, '') as product_code,
    SUM(pc.production_quantity)::decimal as total_quantity,
    prod.unit,
    COUNT(DISTINCT pc.production_id)::bigint as production_count,
    COALESCE(SUM(pc.material_cost), 0)::decimal as total_material_cost,
    CASE
      WHEN SUM(pc.production_quantity) > 0
      THEN (COALESCE(SUM(pc.material_cost), 0) / SUM(pc.production_quantity))
      ELSE 0
    END::decimal as avg_cost_per_unit,
    COALESCE(prod.custo_unitario_materiais, 0)::decimal as product_unit_cost,
    COALESCE(prod.sale_price, 0)::decimal as sales_price,
    CASE
      WHEN SUM(pc.production_quantity) > 0
      THEN (COALESCE(SUM(pc.material_cost), 0) / SUM(pc.production_quantity))
      ELSE COALESCE(prod.custo_unitario_materiais, 0)
    END::decimal as final_cost_per_unit,
    CASE
      WHEN SUM(pc.production_quantity) > 0
      THEN (COALESCE(prod.sale_price, 0) - (COALESCE(SUM(pc.material_cost), 0) / SUM(pc.production_quantity)))
      ELSE (COALESCE(prod.sale_price, 0) - COALESCE(prod.custo_unitario_materiais, 0))
    END::decimal as margin_per_unit,
    CASE
      WHEN prod.sale_price > 0 THEN
        CASE
          WHEN SUM(pc.production_quantity) > 0
          THEN ((prod.sale_price - (COALESCE(SUM(pc.material_cost), 0) / SUM(pc.production_quantity))) / prod.sale_price * 100)
          ELSE ((prod.sale_price - COALESCE(prod.custo_unitario_materiais, 0)) / prod.sale_price * 100)
        END
      ELSE 0
    END::decimal as margin_percentage
  FROM production_costs pc
  INNER JOIN products prod ON prod.id = pc.product_id
  GROUP BY
    pc.production_date,
    prod.id,
    prod.name,
    prod.code,
    prod.unit,
    prod.custo_unitario_materiais,
    prod.sale_price
  ORDER BY
    pc.production_date DESC,
    prod.name;
END;
$$;

COMMENT ON FUNCTION relatorio_total_produtos IS
  'Retorna resumo de produtos produzidos com custos calculados a partir das receitas (CORRIGIDO: não depende de production_items)';

-- ============================================
-- CRIAR FUNÇÃO AUXILIAR: OBTER CONSUMO DE INSUMOS POR PRODUTO
-- ============================================

CREATE OR REPLACE FUNCTION get_consumo_insumos_por_produto(
  p_product_id UUID,
  p_quantidade DECIMAL DEFAULT 1
)
RETURNS TABLE (
  material_id UUID,
  material_name TEXT,
  quantity DECIMAL,
  unit TEXT,
  unit_cost DECIMAL,
  total_cost DECIMAL
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id as material_id,
    m.name as material_name,
    (ri.quantity_per_unit * p_quantidade)::decimal as quantity,
    m.unit,
    COALESCE(m.unit_cost, 0)::decimal as unit_cost,
    (ri.quantity_per_unit * p_quantidade * COALESCE(m.unit_cost, 0))::decimal as total_cost
  FROM recipes r
  INNER JOIN recipe_items ri ON ri.recipe_id = r.id
  INNER JOIN materials m ON m.id = ri.material_id
  WHERE r.product_id = p_product_id
  ORDER BY m.name;
END;
$$;

COMMENT ON FUNCTION get_consumo_insumos_por_produto IS
  'Retorna lista de materiais consumidos para produzir uma quantidade específica de um produto';
