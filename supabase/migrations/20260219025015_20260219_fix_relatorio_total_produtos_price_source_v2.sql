/*
  # Fix relatorio_total_produtos - Add price_source field (v2)

  ## Summary
  Drops and recreates the relatorio_total_produtos function to include a price_source field
  that indicates whether the displayed sales_price comes from final_sale_price or sale_price.
  
  ## Changes
  - Drops old function signature first
  - Added `price_source` text column: 'final_sale_price' | 'sale_price' | 'sem_preco'
  - price_source = 'final_sale_price' when prod.final_sale_price > 0
  - price_source = 'sale_price' when prod.sale_price > 0 (but final_sale_price is null/0)
  - price_source = 'sem_preco' when neither is configured
*/

DROP FUNCTION IF EXISTS relatorio_total_produtos(date, date, uuid);

CREATE OR REPLACE FUNCTION relatorio_total_produtos(
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL,
  p_product_id uuid DEFAULT NULL
)
RETURNS TABLE (
  production_date date,
  product_id uuid,
  product_name text,
  product_code text,
  total_quantity decimal,
  unit text,
  production_count bigint,
  total_material_cost decimal,
  avg_cost_per_unit decimal,
  product_unit_cost decimal,
  sales_price decimal,
  price_source text,
  final_cost_per_unit decimal,
  margin_per_unit decimal,
  margin_percentage decimal,
  total_sales_value decimal
)
LANGUAGE plpgsql
AS $$
BEGIN
RETURN QUERY
SELECT
  p.production_date::date,
  prod.id as product_id,
  prod.name as product_name,
  COALESCE(prod.code, '') as product_code,
  SUM(p.quantity)::decimal as total_quantity,
  prod.unit,
  COUNT(DISTINCT p.id)::bigint as production_count,
  COALESCE(SUM(
    CASE 
      WHEN p.custos_no_momento IS NOT NULL 
      THEN (p.custos_no_momento->>'total_cost')::decimal 
      ELSE 0 
    END
  ), 0)::decimal as total_material_cost,
  CASE
    WHEN SUM(p.quantity) > 0 THEN
    COALESCE(SUM(
      CASE 
        WHEN p.custos_no_momento IS NOT NULL 
        THEN (p.custos_no_momento->>'total_cost')::decimal 
        ELSE 0 
      END
    ), 0) / SUM(p.quantity)
    ELSE 0
  END::decimal as avg_cost_per_unit,
  COALESCE(prod.custo_unitario_materiais, 0)::decimal as product_unit_cost,
  COALESCE(prod.final_sale_price, prod.sale_price, 0)::decimal as sales_price,
  CASE
    WHEN COALESCE(prod.final_sale_price, 0) > 0 THEN 'final_sale_price'
    WHEN COALESCE(prod.sale_price, 0) > 0 THEN 'sale_price'
    ELSE 'sem_preco'
  END as price_source,
  CASE
    WHEN SUM(p.quantity) > 0 AND SUM(
      CASE 
        WHEN p.custos_no_momento IS NOT NULL 
        THEN (p.custos_no_momento->>'total_cost')::decimal 
        ELSE 0 
      END
    ) > 0 THEN
    SUM(
      CASE 
        WHEN p.custos_no_momento IS NOT NULL 
        THEN (p.custos_no_momento->>'total_cost')::decimal 
        ELSE 0 
      END
    ) / SUM(p.quantity)
    ELSE COALESCE(prod.custo_unitario_materiais, 0)
  END::decimal as final_cost_per_unit,
  CASE
    WHEN SUM(p.quantity) > 0 AND SUM(
      CASE 
        WHEN p.custos_no_momento IS NOT NULL 
        THEN (p.custos_no_momento->>'total_cost')::decimal 
        ELSE 0 
      END
    ) > 0 THEN
    COALESCE(prod.final_sale_price, prod.sale_price, 0) - (
      SUM(
        CASE 
          WHEN p.custos_no_momento IS NOT NULL 
          THEN (p.custos_no_momento->>'total_cost')::decimal 
          ELSE 0 
        END
      ) / SUM(p.quantity)
    )
    ELSE 
    COALESCE(prod.final_sale_price, prod.sale_price, 0) - COALESCE(prod.custo_unitario_materiais, 0)
  END::decimal as margin_per_unit,
  CASE
    WHEN COALESCE(prod.final_sale_price, prod.sale_price, 0) > 0 THEN
    CASE
      WHEN SUM(p.quantity) > 0 AND SUM(
        CASE 
          WHEN p.custos_no_momento IS NOT NULL 
          THEN (p.custos_no_momento->>'total_cost')::decimal 
          ELSE 0 
        END
      ) > 0 THEN
      (
        (
          COALESCE(prod.final_sale_price, prod.sale_price, 0) - (
            SUM(
              CASE 
                WHEN p.custos_no_momento IS NOT NULL 
                THEN (p.custos_no_momento->>'total_cost')::decimal 
                ELSE 0 
              END
            ) / SUM(p.quantity)
          )
        ) / COALESCE(prod.final_sale_price, prod.sale_price, 0) * 100
      )
      ELSE
      (
        (
          COALESCE(prod.final_sale_price, prod.sale_price, 0) - COALESCE(prod.custo_unitario_materiais, 0)
        ) / COALESCE(prod.final_sale_price, prod.sale_price, 0) * 100
      )
    END
    ELSE 0
  END::decimal as margin_percentage,
  (COALESCE(prod.final_sale_price, prod.sale_price, 0) * SUM(p.quantity))::decimal as total_sales_value
FROM production p
INNER JOIN products prod ON prod.id = p.product_id
WHERE p.production_date >= p_data_inicio
AND p.production_date <= p_data_fim
AND (p.notes IS NULL OR NOT p.notes ILIKE '%ajuste de estoque%')
AND (p_product_id IS NULL OR p.product_id = p_product_id)
GROUP BY
  p.production_date,
  prod.id,
  prod.name,
  prod.code,
  prod.unit,
  prod.custo_unitario_materiais,
  prod.final_sale_price,
  prod.sale_price
ORDER BY
  p.production_date DESC,
  prod.name;
END;
$$;
