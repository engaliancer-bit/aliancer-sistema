/*
  # Atualizar Todas as Funções de Relatório para Usar Funções Centralizadas
  
  ## Objetivo
  Atualizar relatorio_consumo_insumos e outras funções para usar as novas
  funções centralizadas, garantindo:
  - Consistência de valores
  - Eliminação de duplicação de JOINs
  - Melhor performance
  - Código mais manutenível
  
  ## Funções Atualizadas
  1. relatorio_consumo_insumos - já parcialmente corrigida, agora mais otimizada
  2. get_resumo_producao_dia - usará função centralizada
*/

-- ============================================================
-- 1. ATUALIZAR relatorio_consumo_insumos
-- ============================================================

DROP FUNCTION IF EXISTS relatorio_consumo_insumos(DATE, DATE, UUID);

CREATE FUNCTION relatorio_consumo_insumos(
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
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH production_data AS (
    SELECT * FROM get_production_costs_safe(p_data_inicio, p_data_fim, true)
  ),
  material_consumption AS (
    SELECT
      p.production_id,
      p.production_date,
      p.quantity as production_quantity,
      ri.material_id,
      m.name as material_name,
      m.unit,
      ri.quantity_per_unit,
      COALESCE(m.unit_cost, 0) as unit_cost,
      (p.quantity * ri.quantity_per_unit) as total_material_quantity,
      (p.quantity * ri.quantity_per_unit * COALESCE(m.unit_cost, 0)) as total_material_cost
    FROM production_data p
    INNER JOIN production prod ON prod.id = p.production_id
    INNER JOIN products prods ON prods.id = prod.product_id
    LEFT JOIN recipes r ON r.product_id = prods.id
    LEFT JOIN recipe_items ri ON ri.recipe_id = r.id
    LEFT JOIN materials m ON m.id = ri.material_id
    WHERE (p_material_id IS NULL OR ri.material_id = p_material_id)
      AND ri.material_id IS NOT NULL
  )
  SELECT
    material_id,
    material_name,
    SUM(total_material_quantity)::DECIMAL as total_quantity,
    unit,
    AVG(unit_cost)::DECIMAL as avg_unit_cost,
    SUM(total_material_cost)::DECIMAL as total_cost,
    COUNT(DISTINCT production_id)::BIGINT as usage_count,
    MIN(production_date)::DATE as first_usage,
    MAX(production_date)::DATE as last_usage
  FROM material_consumption
  GROUP BY material_id, material_name, unit
  ORDER BY total_material_quantity DESC;
END;
$$;

COMMENT ON FUNCTION relatorio_consumo_insumos IS 
  'Retorna consumo de insumos usando função centralizada - otimizado para performance';

-- ============================================================
-- 2. CRIAR FUNÇÃO get_resumo_producao_dia CENTRALIZADA
-- ============================================================

DROP FUNCTION IF EXISTS get_resumo_producao_dia(DATE);

CREATE FUNCTION get_resumo_producao_dia(p_data DATE)
RETURNS TABLE (
  production_date DATE,
  total_productions BIGINT,
  total_quantity DECIMAL,
  total_material_cost DECIMAL,
  total_labor_cost DECIMAL,
  total_indirect_cost DECIMAL,
  total_depreciation_cost DECIMAL,
  total_cost DECIMAL,
  avg_cost_per_unit DECIMAL
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p_data as production_date,
    COUNT(DISTINCT production_id)::BIGINT as total_productions,
    COALESCE(SUM(quantity), 0) as total_quantity,
    COALESCE(SUM(material_cost), 0) as total_material_cost,
    COALESCE(SUM(labor_cost), 0) as total_labor_cost,
    COALESCE(SUM(indirect_cost), 0) as total_indirect_cost,
    COALESCE(SUM(depreciation_cost), 0) as total_depreciation_cost,
    COALESCE(SUM(total_cost), 0) as total_cost,
    CASE 
      WHEN COALESCE(SUM(quantity), 0) > 0
      THEN COALESCE(SUM(total_cost), 0) / SUM(quantity)
      ELSE 0
    END as avg_cost_per_unit
  FROM get_production_costs_safe(p_data, p_data, true);
END;
$$;

COMMENT ON FUNCTION get_resumo_producao_dia IS 
  'Retorna resumo de produção do dia usando função centralizada - SEM DUPLICAÇÃO DE CUSTOS';

-- ============================================================
-- 3. CRIAR FUNÇÃO get_resumo_producao_periodo
-- ============================================================

DROP FUNCTION IF EXISTS get_resumo_producao_periodo(DATE, DATE);

CREATE FUNCTION get_resumo_producao_periodo(
  p_data_inicio DATE,
  p_data_fim DATE
)
RETURNS TABLE (
  date_start DATE,
  date_end DATE,
  total_productions BIGINT,
  total_quantity DECIMAL,
  total_material_cost DECIMAL,
  total_labor_cost DECIMAL,
  total_indirect_cost DECIMAL,
  total_depreciation_cost DECIMAL,
  total_cost DECIMAL,
  avg_cost_per_production DECIMAL,
  avg_cost_per_unit DECIMAL,
  days_range INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p_data_inicio as date_start,
    p_data_fim as date_end,
    agg.total_productions,
    agg.total_quantity,
    agg.total_material_cost,
    agg.total_labor_cost,
    agg.total_indirect_cost,
    agg.total_depreciation_cost,
    agg.total_cost,
    agg.avg_cost_per_production,
    agg.avg_cost_per_unit,
    (p_data_fim - p_data_inicio)::INTEGER as days_range
  FROM get_production_costs_aggregated(p_data_inicio, p_data_fim, true) agg;
END;
$$;

COMMENT ON FUNCTION get_resumo_producao_periodo IS 
  'Retorna resumo de produção de um período usando função centralizada';

-- ============================================================
-- 4. CRIAR VIEW v_production_summary_daily
-- ============================================================

DROP VIEW IF EXISTS v_production_summary_daily CASCADE;

CREATE VIEW v_production_summary_daily AS
SELECT 
  CAST(p.production_date AS DATE) as production_date,
  COUNT(DISTINCT p.id)::BIGINT as total_productions,
  SUM(p.quantity) as total_quantity,
  COALESCE(SUM(pc.material_cost), 0) as total_material_cost,
  COALESCE(SUM(pc.labor_cost), 0) as total_labor_cost,
  COALESCE(SUM(pc.indirect_cost), 0) as total_indirect_cost,
  COALESCE(SUM(pc.depreciation_cost), 0) as total_depreciation_cost,
  COALESCE(SUM(pc.total_cost), 0) as total_cost,
  CASE 
    WHEN SUM(p.quantity) > 0
    THEN COALESCE(SUM(pc.total_cost), 0) / SUM(p.quantity)
    ELSE 0
  END as avg_cost_per_unit
FROM production p
LEFT JOIN production_costs pc ON pc.production_id = p.id
WHERE (p.notes IS NULL OR NOT p.notes ILIKE '%ajuste de estoque%')
GROUP BY CAST(p.production_date AS DATE);

GRANT SELECT ON v_production_summary_daily TO authenticated;

-- ============================================================
-- 5. CRIAR VIEW v_production_summary_period
-- ============================================================

DROP VIEW IF EXISTS v_production_summary_period CASCADE;

CREATE VIEW v_production_summary_period AS
SELECT 
  COUNT(DISTINCT p.id)::BIGINT as total_productions,
  SUM(p.quantity) as total_quantity,
  COALESCE(SUM(pc.material_cost), 0) as total_material_cost,
  COALESCE(SUM(pc.labor_cost), 0) as total_labor_cost,
  COALESCE(SUM(pc.indirect_cost), 0) as total_indirect_cost,
  COALESCE(SUM(pc.depreciation_cost), 0) as total_depreciation_cost,
  COALESCE(SUM(pc.total_cost), 0) as total_cost,
  CASE 
    WHEN COUNT(DISTINCT p.id) > 0
    THEN COALESCE(SUM(pc.total_cost), 0) / COUNT(DISTINCT p.id)
    ELSE 0
  END as avg_cost_per_production,
  CASE 
    WHEN SUM(p.quantity) > 0
    THEN COALESCE(SUM(pc.total_cost), 0) / SUM(p.quantity)
    ELSE 0
  END as avg_cost_per_unit
FROM production p
LEFT JOIN production_costs pc ON pc.production_id = p.id
WHERE (p.notes IS NULL OR NOT p.notes ILIKE '%ajuste de estoque%');

GRANT SELECT ON v_production_summary_period TO authenticated;

-- ============================================================
-- 6. LOG DAS ATUALIZAÇÕES
-- ============================================================

SELECT log_cost_calculation(
  'relatorio_consumo_insumos',
  CURRENT_DATE,
  CURRENT_DATE,
  0,
  0,
  'migration_applied',
  'Migrado para usar get_production_costs_safe() - melhor performance e consistência'
);

SELECT log_cost_calculation(
  'get_resumo_producao_dia',
  CURRENT_DATE,
  CURRENT_DATE,
  0,
  0,
  'migration_applied',
  'Migrado para usar get_production_costs_safe() - elimina duplicação de custos'
);

SELECT log_cost_calculation(
  'get_resumo_producao_periodo',
  CURRENT_DATE,
  CURRENT_DATE,
  0,
  0,
  'migration_applied',
  'Migrado para usar get_production_costs_aggregated() - consistência garantida'
);
