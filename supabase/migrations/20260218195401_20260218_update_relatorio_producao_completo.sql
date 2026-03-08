/*
  # Atualizar relatorio_producao_completo para Usar Função Centralizada
  
  ## Objetivo
  Atualizar a função relatorio_producao_completo para usar get_production_costs_aggregated()
  garantindo consistência com outras funções de relatório.
  
  ## Mudanças
  - DROP da função antiga (que tinha bug de multiplicação)
  - CREATE nova versão usando função centralizada
  - Mantém mesma interface de saída para compatibilidade
  
  ## Validação
  - Valores retornados serão idênticos a get_resumo_producao_dia
  - Sem multiplicação de custos
  - Performance melhorada com índices
*/

DROP FUNCTION IF EXISTS relatorio_producao_completo(DATE, DATE) CASCADE;

CREATE FUNCTION relatorio_producao_completo(
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
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH agg AS (
    SELECT * FROM get_production_costs_aggregated(p_data_inicio, p_data_fim, true)
  ),
  unique_materials_count AS (
    SELECT COUNT(DISTINCT material_id)::BIGINT as cnt
    FROM production_items pi
    INNER JOIN production p ON p.id = pi.production_id
    WHERE p.production_date >= p_data_inicio
      AND p.production_date <= p_data_fim
      AND (p.notes IS NULL OR NOT p.notes ILIKE '%ajuste de estoque%')
  ),
  unique_products_count AS (
    SELECT COUNT(DISTINCT product_id)::BIGINT as cnt
    FROM production
    WHERE production_date >= p_data_inicio
      AND production_date <= p_data_fim
      AND (notes IS NULL OR NOT notes ILIKE '%ajuste de estoque%')
  )
  SELECT
    agg.total_productions,
    agg.total_quantity as total_products_quantity,
    agg.total_material_cost,
    unique_products_count.cnt as total_products,
    unique_materials_count.cnt as unique_materials,
    agg.avg_cost_per_production,
    (p_data_fim - p_data_inicio)::INTEGER as date_range_days
  FROM agg
  CROSS JOIN unique_materials_count
  CROSS JOIN unique_products_count;
END;
$$;

COMMENT ON FUNCTION relatorio_producao_completo IS 
  'Retorna resumo consolidado de produção - ATUALIZADO para usar função centralizada get_production_costs_aggregated()';

-- Log a atualização
SELECT log_cost_calculation(
  'relatorio_producao_completo',
  CURRENT_DATE,
  CURRENT_DATE,
  0,
  0,
  'migration_applied',
  'Migrado para usar get_production_costs_aggregated() - evita multiplicação de custos'
);
