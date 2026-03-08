/*
  # Atualizar Relatórios de Produção para Usar Custos Padronizados

  ## Resumo
  Atualiza as funções de relatório de produção para usar exclusivamente os campos padronizados:
  - products.custo_unitario_materiais
  - products.custo_total_materiais
  - products.consumo_insumos

  ## Mudanças

  1. **get_resumo_producao_dia**
     - Remove função antiga
     - Recria com custos padronizados

  2. **relatorio_producao_completo**
     - Remove função antiga
     - Recria com custos padronizados

  ## Segurança
  - Funções mantêm permissões originais
  - Validações de NULL preservadas
*/

-- =============================================================================
-- Remover funções antigas
-- =============================================================================

DROP FUNCTION IF EXISTS get_resumo_producao_dia(date);
DROP FUNCTION IF EXISTS relatorio_producao_completo(date, date);

-- =============================================================================
-- FUNÇÃO: get_resumo_producao_dia (Nova versão com custos padronizados)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_resumo_producao_dia(p_data date)
RETURNS TABLE (
  produto_id uuid,
  produto_nome text,
  quantidade_total numeric,
  custo_unitario numeric,
  custo_total numeric,
  preco_venda numeric,
  receita_total numeric,
  margem_lucro numeric,
  percentual_margem numeric
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as produto_id,
    p.name as produto_nome,
    COALESCE(SUM(pr.quantity), 0)::numeric as quantidade_total,
    COALESCE(p.custo_unitario_materiais, 0)::numeric as custo_unitario,
    COALESCE(SUM(pr.quantity) * p.custo_unitario_materiais, 0)::numeric as custo_total,
    COALESCE(p.sale_price, 0)::numeric as preco_venda,
    COALESCE(SUM(pr.quantity) * p.sale_price, 0)::numeric as receita_total,
    COALESCE(SUM(pr.quantity) * (p.sale_price - p.custo_unitario_materiais), 0)::numeric as margem_lucro,
    CASE 
      WHEN p.sale_price > 0 THEN
        ROUND(((p.sale_price - COALESCE(p.custo_unitario_materiais, 0)) / p.sale_price * 100)::numeric, 2)
      ELSE 
        0
    END as percentual_margem
  FROM production pr
  JOIN products p ON p.id = pr.product_id
  WHERE DATE(pr.production_date) = p_data
  GROUP BY p.id, p.name, p.custo_unitario_materiais, p.sale_price
  ORDER BY p.name;
END;
$$;

-- =============================================================================
-- FUNÇÃO: relatorio_producao_completo (Nova versão com custos padronizados)
-- =============================================================================

CREATE OR REPLACE FUNCTION relatorio_producao_completo(
  p_data_inicio date,
  p_data_fim date
)
RETURNS TABLE (
  data_producao date,
  produto_id uuid,
  produto_nome text,
  quantidade numeric,
  custo_unitario_material numeric,
  custo_total_material numeric,
  preco_venda numeric,
  receita numeric,
  margem_lucro numeric,
  percentual_margem numeric
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(pr.production_date) as data_producao,
    p.id as produto_id,
    p.name as produto_nome,
    SUM(pr.quantity)::numeric as quantidade,
    COALESCE(p.custo_unitario_materiais, 0)::numeric as custo_unitario_material,
    (SUM(pr.quantity) * COALESCE(p.custo_unitario_materiais, 0))::numeric as custo_total_material,
    COALESCE(p.sale_price, 0)::numeric as preco_venda,
    (SUM(pr.quantity) * COALESCE(p.sale_price, 0))::numeric as receita,
    (SUM(pr.quantity) * (COALESCE(p.sale_price, 0) - COALESCE(p.custo_unitario_materiais, 0)))::numeric as margem_lucro,
    CASE 
      WHEN p.sale_price > 0 THEN
        ROUND(((p.sale_price - COALESCE(p.custo_unitario_materiais, 0)) / p.sale_price * 100)::numeric, 2)
      ELSE 
        0
    END as percentual_margem
  FROM production pr
  JOIN products p ON p.id = pr.product_id
  WHERE DATE(pr.production_date) BETWEEN p_data_inicio AND p_data_fim
  GROUP BY 
    DATE(pr.production_date),
    p.id,
    p.name,
    p.custo_unitario_materiais,
    p.sale_price
  ORDER BY 
    data_producao DESC,
    p.name;
END;
$$;

-- =============================================================================
-- Criar função auxiliar para obter detalhes de consumo de materiais
-- =============================================================================

CREATE OR REPLACE FUNCTION get_product_material_consumption(p_product_id uuid)
RETURNS TABLE (
  material_id uuid,
  material_name text,
  quantity numeric,
  unit text,
  unit_cost numeric,
  total_cost numeric
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (item->>'material_id')::uuid as material_id,
    item->>'material_name' as material_name,
    (item->>'quantity')::numeric as quantity,
    item->>'unit' as unit,
    (item->>'unit_cost')::numeric as unit_cost,
    (item->>'total_cost')::numeric as total_cost
  FROM products p,
       jsonb_array_elements(p.consumo_insumos) as item
  WHERE p.id = p_product_id;
END;
$$;
