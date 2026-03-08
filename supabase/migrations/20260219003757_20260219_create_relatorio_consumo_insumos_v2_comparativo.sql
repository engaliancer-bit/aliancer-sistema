/*
  # Nova RPC: Relatório Comparativo de Consumo - Teórico vs Real

  ## 1. Propósito
  - Comparar consumo teórico (receita) com consumo real (production_items)
  - Identificar variações e desperdícios
  - Suportar modo de visualização: 'teorico' | 'real' | 'ambos'

  ## 2. Campos Retornados
  - material_id, material_name, unit
  - total_quantity_theoretical: Quantidade conforme receita cadastrada
  - total_quantity_real: Quantidade registrada em production_items
  - variance_quantity: Diferença absoluta
  - variance_percentage: Percentual de desvio
  - avg_unit_cost: Custo médio do material
  - total_cost_theoretical: Custo teórico (quantidade_teórica * custo_médio)
  - total_cost_real: Custo real (quantidade_real * custo_médio)
  - usage_count: Número de produções que usaram este material

  ## 3. Modo de Funcionamento
  - Se p_comparison_mode = 'teorico': Mostra apenas consumo teórico (receita)
  - Se p_comparison_mode = 'real': Mostra apenas consumo real (production_items)
  - Se p_comparison_mode = 'ambos': Mostra ambas colunas com variação

  ## 4. Validação
  - Ignora ajustes de estoque (notes ILIKE '%ajuste de estoque%')
  - Ignora produções sem data válida
*/

DROP FUNCTION IF EXISTS relatorio_consumo_insumos_v2(date, date, text);

CREATE OR REPLACE FUNCTION relatorio_consumo_insumos_v2(
  p_data_inicio DATE,
  p_data_fim DATE,
  p_comparison_mode TEXT DEFAULT 'ambos'
)
RETURNS TABLE (
  material_id UUID,
  material_name TEXT,
  unit TEXT,
  total_quantity_theoretical DECIMAL,
  total_quantity_real DECIMAL,
  variance_quantity DECIMAL,
  variance_percentage DECIMAL,
  avg_unit_cost DECIMAL,
  total_cost_theoretical DECIMAL,
  total_cost_real DECIMAL,
  usage_count BIGINT,
  first_usage DATE,
  last_usage DATE
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  WITH theoretical_consumption AS (
    -- Consumo teórico baseado nas receitas
    SELECT
      ri.material_id,
      m.name as material_name,
      m.unit,
      SUM(ri.quantity_per_unit * p.quantity) as total_quantity,
      COUNT(DISTINCT p.id) as usage_count,
      MIN(p.production_date) as first_usage,
      MAX(p.production_date) as last_usage,
      AVG(COALESCE(m.unit_cost, 0)) as avg_cost,
      'theoretical' as source
    FROM production p
    INNER JOIN products prod ON prod.id = p.product_id
    LEFT JOIN recipes r ON r.product_id = prod.id
    LEFT JOIN recipe_items ri ON ri.recipe_id = r.id
    LEFT JOIN materials m ON m.id = ri.material_id
    WHERE p.production_date >= p_data_inicio
      AND p.production_date <= p_data_fim
      AND (p.notes IS NULL OR NOT p.notes ILIKE '%ajuste de estoque%')
      AND ri.material_id IS NOT NULL
    GROUP BY ri.material_id, m.name, m.unit
  ),
  real_consumption AS (
    -- Consumo real registrado em production_items
    SELECT
      pi.material_id,
      pi.material_name,
      m.unit,
      SUM(pi.quantity) as total_quantity,
      COUNT(DISTINCT pi.production_id) as usage_count,
      MIN(p.production_date) as first_usage,
      MAX(p.production_date) as last_usage,
      AVG(COALESCE(pi.unit_cost, 0)) as avg_cost,
      'real' as source
    FROM production_items pi
    INNER JOIN production p ON p.id = pi.production_id
    LEFT JOIN materials m ON m.id = pi.material_id
    WHERE p.production_date >= p_data_inicio
      AND p.production_date <= p_data_fim
      AND (p.notes IS NULL OR NOT p.notes ILIKE '%ajuste de estoque%')
    GROUP BY pi.material_id, pi.material_name, m.unit
  ),
  combined AS (
    -- Combinar dados teóricos e reais
    SELECT
      COALESCE(t.material_id, r.material_id) as material_id,
      COALESCE(t.material_name, r.material_name) as material_name,
      COALESCE(t.unit, r.unit) as unit,
      COALESCE(t.total_quantity, 0) as qty_theoretical,
      COALESCE(r.total_quantity, 0) as qty_real,
      COALESCE(r.total_quantity, 0) - COALESCE(t.total_quantity, 0) as qty_variance,
      CASE
        WHEN COALESCE(t.total_quantity, 0) > 0
        THEN ((COALESCE(r.total_quantity, 0) - COALESCE(t.total_quantity, 0)) / COALESCE(t.total_quantity, 0) * 100)
        ELSE CASE WHEN COALESCE(r.total_quantity, 0) > 0 THEN 100 ELSE 0 END
      END as variance_pct,
      COALESCE(t.avg_cost, r.avg_cost, 0) as unit_cost,
      COALESCE(t.usage_count, r.usage_count, 0) as usage_cnt,
      COALESCE(t.first_usage, r.first_usage) as first_use,
      COALESCE(t.last_usage, r.last_usage) as last_use
    FROM theoretical_consumption t
    FULL OUTER JOIN real_consumption r
      ON t.material_id = r.material_id
  )
  SELECT
    c.material_id,
    c.material_name,
    c.unit,
    CASE
      WHEN p_comparison_mode IN ('teorico', 'ambos') THEN c.qty_theoretical
      ELSE 0
    END::decimal as total_quantity_theoretical,
    CASE
      WHEN p_comparison_mode IN ('real', 'ambos') THEN c.qty_real
      ELSE 0
    END::decimal as total_quantity_real,
    CASE
      WHEN p_comparison_mode = 'ambos' THEN c.qty_variance
      ELSE 0
    END::decimal as variance_quantity,
    CASE
      WHEN p_comparison_mode = 'ambos' THEN c.variance_pct
      ELSE 0
    END::decimal as variance_percentage,
    c.unit_cost::decimal as avg_unit_cost,
    (CASE WHEN p_comparison_mode IN ('teorico', 'ambos') THEN c.qty_theoretical ELSE 0 END * c.unit_cost)::decimal as total_cost_theoretical,
    (CASE WHEN p_comparison_mode IN ('real', 'ambos') THEN c.qty_real ELSE 0 END * c.unit_cost)::decimal as total_cost_real,
    c.usage_cnt::bigint as usage_count,
    c.first_use as first_usage,
    c.last_use as last_usage
  FROM combined c
  WHERE c.material_id IS NOT NULL
    OR c.material_name IS NOT NULL
  ORDER BY
    CASE WHEN p_comparison_mode = 'ambos' THEN ABS(c.variance_pct) ELSE 0 END DESC,
    c.material_name;
END;
$$;

COMMENT ON FUNCTION relatorio_consumo_insumos_v2 IS
  'Relatório comparativo de consumo de insumos: teórico vs real com variação percentual';
