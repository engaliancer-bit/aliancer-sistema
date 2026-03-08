/*
  # Corrigir Funcao relatorio_total_produtos

  1. Problema
    - A funcao atual usa `ri.quantity_per_unit` que NAO existe na tabela recipe_items
    - Isso causa erro no calculo dos custos de producao

  2. Solucao
    - Usar o campo `custos_no_momento` (JSONB) da tabela production
    - Este campo ja armazena os custos calculados no momento da producao
    - Isso garante rastreabilidade: o custo reflete o traco/precos do DIA da producao

  3. Beneficios
    - Custos historicos precisos (nao recalculados com precos atuais)
    - Rastreabilidade do custo no momento da producao
    - Elimina erro de coluna inexistente
    
  4. Nova coluna de retorno
    - total_sales_value: valor total de venda (preco x quantidade)
*/

-- Remover funcao existente para poder alterar retorno
DROP FUNCTION IF EXISTS relatorio_total_produtos(date, date, uuid);

-- Recriar a funcao corrigida
CREATE OR REPLACE FUNCTION public.relatorio_total_produtos(
  p_data_inicio date, 
  p_data_fim date, 
  p_product_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  production_date date, 
  product_id uuid, 
  product_name text, 
  product_code text, 
  total_quantity numeric, 
  unit text, 
  production_count bigint, 
  total_material_cost numeric, 
  avg_cost_per_unit numeric, 
  product_unit_cost numeric, 
  sales_price numeric, 
  final_cost_per_unit numeric, 
  margin_per_unit numeric, 
  margin_percentage numeric,
  total_sales_value numeric
)
LANGUAGE plpgsql
AS $function$
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
    -- CORRIGIDO: Usar custos_no_momento em vez de recalcular
    COALESCE(SUM(
      CASE 
        WHEN p.custos_no_momento IS NOT NULL 
        THEN (p.custos_no_momento->>'total_cost')::decimal 
        ELSE 0 
      END
    ), 0)::decimal as total_material_cost,
    -- Custo medio por unidade
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
    -- Custo unitario cadastrado no produto
    COALESCE(prod.custo_unitario_materiais, 0)::decimal as product_unit_cost,
    -- Preco de venda (prioridade: final_sale_price > sale_price)
    COALESCE(prod.final_sale_price, prod.sale_price, 0)::decimal as sales_price,
    -- Custo final por unidade (do historico ou cadastro)
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
    -- Margem por unidade
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
    -- Margem percentual
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
    -- NOVO: Valor total de venda (preco x quantidade)
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
$function$;
