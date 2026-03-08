/*
  # Correção: Prioridade de Preços no Relatório de Produtos

  ## 1. Mudanças
  - Ajustar RPC `relatorio_total_produtos` para usar final_sale_price como prioridade principal
  - Implementar ordem de prioridade correta: final_sale_price > sale_price > 0
  - Adicionar validação e fallback para preços não configurados

  ## 2. Campo Modificado
  - `sales_price`: Agora verifica `final_sale_price` primeiro antes de `sale_price`
  
  ## 3. Campos Afetados
  - `sales_price` (output)
  - `margin_per_unit` (calcula com base no novo sales_price)
  - `margin_percentage` (calcula com base no novo sales_price)

  ## 4. Benefício
  - Relatório reflete preço de venda real (com descontos/ajustes aplicados)
  - Margem calculada de forma consistente e realista
  - Evita calcular margem com base em preço desatualizado
*/

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
DECLARE
  v_sales_price DECIMAL;
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
    -- PRIORIDADE CORRIGIDA: final_sale_price > sale_price > 0
    COALESCE(prod.final_sale_price, prod.sale_price, 0)::decimal as sales_price,
    CASE
      WHEN SUM(pc.production_quantity) > 0
      THEN (COALESCE(SUM(pc.material_cost), 0) / SUM(pc.production_quantity))
      ELSE COALESCE(prod.custo_unitario_materiais, 0)
    END::decimal as final_cost_per_unit,
    CASE
      WHEN SUM(pc.production_quantity) > 0
      THEN (COALESCE(COALESCE(prod.final_sale_price, prod.sale_price, 0), 0) - (COALESCE(SUM(pc.material_cost), 0) / SUM(pc.production_quantity)))
      ELSE (COALESCE(COALESCE(prod.final_sale_price, prod.sale_price, 0), 0) - COALESCE(prod.custo_unitario_materiais, 0))
    END::decimal as margin_per_unit,
    CASE
      WHEN COALESCE(prod.final_sale_price, prod.sale_price, 0) > 0 THEN
        CASE
          WHEN SUM(pc.production_quantity) > 0
          THEN ((COALESCE(prod.final_sale_price, prod.sale_price, 0) - (COALESCE(SUM(pc.material_cost), 0) / SUM(pc.production_quantity))) / COALESCE(prod.final_sale_price, prod.sale_price, 0) * 100)
          ELSE ((COALESCE(prod.final_sale_price, prod.sale_price, 0) - COALESCE(prod.custo_unitario_materiais, 0)) / COALESCE(prod.final_sale_price, prod.sale_price, 0) * 100)
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
    prod.final_sale_price,
    prod.sale_price
  ORDER BY
    pc.production_date DESC,
    prod.name;
END;
$$;

COMMENT ON FUNCTION relatorio_total_produtos IS
  'Retorna resumo de produtos com preços corrigidos: final_sale_price > sale_price';
