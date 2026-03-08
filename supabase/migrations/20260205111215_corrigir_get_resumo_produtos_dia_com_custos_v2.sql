/*
  # Adicionar custos ao resumo de produtos do dia
  
  1. Modificações
    - DROP e recriar `get_resumo_produtos_dia` com custos de produção
    - Adicionar campos: unit_price, total_revenue, total_cost, unit_cost, profit, profit_margin
    - Usar dados de `production_items` para custos reais
  
  2. Campos Retornados
    - product_id, product_name, product_code
    - total_quantity, unit, production_count
    - unit_price - Preço de venda unitário do produto
    - total_revenue - Receita total (unit_price × total_quantity)
    - total_cost - Custo total de produção (soma de production_items)
    - unit_cost - Custo unitário de produção (total_cost ÷ total_quantity)
    - profit - Lucro (total_revenue - total_cost)
    - profit_margin - Margem de lucro percentual
*/

-- Remover função existente
DROP FUNCTION IF EXISTS get_resumo_produtos_dia(DATE);

-- Recriar função com custos
CREATE OR REPLACE FUNCTION get_resumo_produtos_dia(
  p_data DATE
)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  product_code TEXT,
  total_quantity NUMERIC,
  unit TEXT,
  production_count BIGINT,
  unit_price NUMERIC,
  total_revenue NUMERIC,
  total_cost NUMERIC,
  unit_cost NUMERIC,
  profit NUMERIC,
  profit_margin NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.product_id,
    prod.name as product_name,
    prod.code as product_code,
    SUM(p.quantity) as total_quantity,
    prod.unit,
    COUNT(p.id)::bigint as production_count,
    -- Preço de venda (usar final_sale_price ou sale_price)
    COALESCE(prod.final_sale_price, prod.sale_price, 0) as unit_price,
    -- Receita total
    SUM(p.quantity) * COALESCE(prod.final_sale_price, prod.sale_price, 0) as total_revenue,
    -- Custo total de produção (soma de production_items)
    COALESCE(SUM(items_cost.total_cost), 0) as total_cost,
    -- Custo unitário de produção
    CASE 
      WHEN SUM(p.quantity) > 0 THEN 
        COALESCE(SUM(items_cost.total_cost), 0) / SUM(p.quantity)
      ELSE 0
    END as unit_cost,
    -- Lucro
    (SUM(p.quantity) * COALESCE(prod.final_sale_price, prod.sale_price, 0)) - COALESCE(SUM(items_cost.total_cost), 0) as profit,
    -- Margem de lucro percentual
    CASE 
      WHEN (SUM(p.quantity) * COALESCE(prod.final_sale_price, prod.sale_price, 0)) > 0 THEN
        (((SUM(p.quantity) * COALESCE(prod.final_sale_price, prod.sale_price, 0)) - COALESCE(SUM(items_cost.total_cost), 0)) / 
         (SUM(p.quantity) * COALESCE(prod.final_sale_price, prod.sale_price, 0))) * 100
      ELSE 0
    END as profit_margin
  FROM production p
  INNER JOIN products prod ON prod.id = p.product_id
  LEFT JOIN (
    SELECT 
      pi.production_id,
      SUM(pi.total_cost) as total_cost
    FROM production_items pi
    GROUP BY pi.production_id
  ) items_cost ON items_cost.production_id = p.id
  WHERE p.production_date = p_data
    AND (p.notes IS NULL OR NOT p.notes ILIKE '%ajuste de estoque%')
  GROUP BY p.product_id, prod.name, prod.code, prod.unit, prod.final_sale_price, prod.sale_price
  ORDER BY prod.name;
END;
$$;

COMMENT ON FUNCTION get_resumo_produtos_dia IS 
  'Retorna resumo completo de produtos produzidos em uma data, incluindo quantidades, custos de produção, receita, lucro e margem.';
