/*
  # Corrigir Multiplicação de Custos em relatorio_producao_completo

  ## Problema
  A função `relatorio_producao_completo` estava retornando custos multiplicados incorretamente.
  
  **Exemplo:** Produção com 5 materiais e custo R$ 758,26:
  - Valor correto: R$ 758,26
  - Valor retornado: R$ 3.791,30 (758,26 × 5 materiais)
  
  **Causa:** LEFT JOIN duplo com production_items causava produto cartesiano:
  1. Primeiro JOIN trazia TODAS as linhas de production_items (5 linhas)
  2. Segundo JOIN trazia o custo total agregado (1 valor)
  3. SUM() somava o valor agregado 5 vezes = multiplicação indevida
  
  ## Solução
  Remover o primeiro LEFT JOIN desnecessário com production_items.
  Manter apenas o JOIN com a subquery agregada.
  
  ## Impacto
  - Relatório de Produção: custos agora corretos
  - Resumo geral: valores financeiros corretos
  - Métricas: avg_cost_per_production correto
*/

-- Recriar função sem o JOIN desnecessário
CREATE OR REPLACE FUNCTION relatorio_producao_completo(
  p_data_inicio DATE,
  p_data_fim DATE
)
RETURNS TABLE (
  total_productions BIGINT,
  total_products_quantity DECIMAL,
  total_material_cost DECIMAL,
  total_products BIGINT,
  unique_materials BIGINT,
  avg_cost_per_production DECIMAL,
  date_range_days INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT p.id)::bigint as total_productions,
    COALESCE(SUM(p.quantity), 0) as total_products_quantity,
    COALESCE(SUM(items_cost.total_cost), 0) as total_material_cost,
    COUNT(DISTINCT p.product_id)::bigint as total_products,
    -- Contar materiais únicos de forma correta
    (
      SELECT COUNT(DISTINCT pi.material_id)::bigint
      FROM production_items pi
      INNER JOIN production prod ON prod.id = pi.production_id
      WHERE prod.production_date >= p_data_inicio
        AND prod.production_date <= p_data_fim
        AND (prod.notes IS NULL OR NOT prod.notes ILIKE '%ajuste de estoque%')
    ) as unique_materials,
    CASE 
      WHEN COUNT(DISTINCT p.id) > 0 THEN 
        COALESCE(SUM(items_cost.total_cost), 0) / COUNT(DISTINCT p.id)
      ELSE 0
    END as avg_cost_per_production,
    (p_data_fim - p_data_inicio)::integer as date_range_days
  FROM production p
  -- APENAS um LEFT JOIN com a subquery agregada
  LEFT JOIN (
    SELECT 
      production_id,
      SUM(total_cost) as total_cost
    FROM production_items
    GROUP BY production_id
  ) items_cost ON items_cost.production_id = p.id
  WHERE p.production_date >= p_data_inicio
    AND p.production_date <= p_data_fim
    AND (p.notes IS NULL OR NOT p.notes ILIKE '%ajuste de estoque%')
  -- NÃO há GROUP BY aqui, então não duplica linhas
  ;
END;
$$;

COMMENT ON FUNCTION relatorio_producao_completo IS 
  'Retorna resumo consolidado de produção com estatísticas gerais (CORRIGIDO: sem multiplicação de custos)';
