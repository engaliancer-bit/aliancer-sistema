/*
  # Adicionar Custo Teórico do Produto e Margem no Relatório

  1. Melhorias na Função relatorio_total_produtos
    - Buscar production_cost do produto se custos estiverem zerados
    - Adicionar preço de venda (sale_price/final_sale_price) do produto
    - Calcular margem real (venda - custo)
    - Calcular % de margem

  2. Nova Estrutura de Retorno
    - Adiciona: product_cost, sales_price, margin, margin_percentage
    - Se custo real estiver zerado, usa custo teórico do produto
    - Para vigotas: quantidade x custo de produção

  3. Compatibilidade
    - DROP da função antiga
    - Recria com novas colunas
*/

-- 1. REMOVER FUNÇÃO ANTIGA
DROP FUNCTION IF EXISTS relatorio_total_produtos(DATE, DATE, UUID);

-- 2. RECRIAR FUNÇÃO relatorio_total_produtos COM CUSTO TEÓRICO E MARGEM
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
  product_unit_cost DECIMAL,     -- Novo: custo unitário do produto (teórico)
  sales_price DECIMAL,            -- Novo: preço de venda
  final_cost_per_unit DECIMAL,   -- Novo: custo final (real ou teórico)
  margin_per_unit DECIMAL,        -- Novo: margem por unidade
  margin_percentage DECIMAL       -- Novo: % de margem
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.production_date,
    p.product_id,
    prod.name as product_name,
    prod.code as product_code,
    SUM(p.quantity) as total_quantity,
    prod.unit,
    COUNT(p.id)::bigint as production_count,

    -- Custo real dos materiais (production_items)
    COALESCE(SUM(items_cost.total_cost), 0) as total_material_cost,

    -- Custo médio por unidade (real)
    CASE
      WHEN SUM(p.quantity) > 0 THEN
        COALESCE(SUM(items_cost.total_cost), 0) / SUM(p.quantity)
      ELSE 0
    END as avg_cost_per_unit,

    -- NOVO: Custo unitário do produto (teórico configurado)
    COALESCE(prod.production_cost, prod.material_cost, prod.manual_unit_cost, 0) as product_unit_cost,

    -- NOVO: Preço de venda do produto
    COALESCE(prod.final_sale_price, prod.sale_price, 0) as sales_price,

    -- NOVO: Custo final por unidade (usa real se > 0, senão usa teórico)
    CASE
      WHEN SUM(p.quantity) > 0 AND COALESCE(SUM(items_cost.total_cost), 0) > 0 THEN
        -- Usa custo real se disponível
        COALESCE(SUM(items_cost.total_cost), 0) / SUM(p.quantity)
      ELSE
        -- Usa custo teórico do produto
        COALESCE(prod.production_cost, prod.material_cost, prod.manual_unit_cost, 0)
    END as final_cost_per_unit,

    -- NOVO: Margem por unidade (venda - custo final)
    CASE
      WHEN SUM(p.quantity) > 0 AND COALESCE(SUM(items_cost.total_cost), 0) > 0 THEN
        -- Margem usando custo real
        COALESCE(prod.final_sale_price, prod.sale_price, 0) - 
        (COALESCE(SUM(items_cost.total_cost), 0) / SUM(p.quantity))
      ELSE
        -- Margem usando custo teórico
        COALESCE(prod.final_sale_price, prod.sale_price, 0) - 
        COALESCE(prod.production_cost, prod.material_cost, prod.manual_unit_cost, 0)
    END as margin_per_unit,

    -- NOVO: % de margem
    CASE
      WHEN COALESCE(prod.final_sale_price, prod.sale_price, 0) > 0 THEN
        CASE
          WHEN SUM(p.quantity) > 0 AND COALESCE(SUM(items_cost.total_cost), 0) > 0 THEN
            -- % usando custo real
            ((COALESCE(prod.final_sale_price, prod.sale_price, 0) - 
              (COALESCE(SUM(items_cost.total_cost), 0) / SUM(p.quantity)))
              / COALESCE(prod.final_sale_price, prod.sale_price, 0)) * 100
          ELSE
            -- % usando custo teórico
            ((COALESCE(prod.final_sale_price, prod.sale_price, 0) - 
              COALESCE(prod.production_cost, prod.material_cost, prod.manual_unit_cost, 0))
              / COALESCE(prod.final_sale_price, prod.sale_price, 0)) * 100
        END
      ELSE 0
    END as margin_percentage

  FROM production p
  INNER JOIN products prod ON prod.id = p.product_id
  LEFT JOIN (
    SELECT
      pi.production_id,
      SUM(pi.total_cost) as total_cost
    FROM production_items pi
    GROUP BY pi.production_id
  ) items_cost ON items_cost.production_id = p.id
  WHERE p.production_date >= p_data_inicio
    AND p.production_date <= p_data_fim
    AND (p_product_id IS NULL OR p.product_id = p_product_id)
    AND (p.notes IS NULL OR NOT p.notes ILIKE '%ajuste de estoque%')
  GROUP BY 
    p.production_date, 
    p.product_id, 
    prod.name, 
    prod.code, 
    prod.unit, 
    prod.production_cost,
    prod.material_cost,
    prod.manual_unit_cost,
    prod.sale_price,
    prod.final_sale_price
  ORDER BY p.production_date DESC, prod.name;
END;
$$;

-- Comentário atualizado
COMMENT ON FUNCTION relatorio_total_produtos IS
'Retorna relatório agregado de produtos produzidos com custos reais, teóricos e margem de venda.
Se custos reais estiverem zerados, utiliza production_cost, material_cost ou manual_unit_cost do produto.
Calcula margem real comparando preço de venda (final_sale_price/sale_price) com custo final.';

-- 3. Criar VIEW auxiliar para facilitar consultas
DROP VIEW IF EXISTS v_producao_com_custos;

CREATE VIEW v_producao_com_custos AS
SELECT
  p.id as production_id,
  p.production_date,
  p.quantity,
  prod.id as product_id,
  prod.name as product_name,
  prod.code as product_code,
  prod.unit,
  prod.product_type,

  -- Custos
  COALESCE((
    SELECT SUM(pi.total_cost)
    FROM production_items pi
    WHERE pi.production_id = p.id
  ), 0) as total_material_cost,

  COALESCE(prod.production_cost, prod.material_cost, prod.manual_unit_cost, 0) as product_unit_cost,
  COALESCE(prod.final_sale_price, prod.sale_price, 0) as sales_price,

  -- Custo final (real ou teórico)
  CASE
    WHEN COALESCE((
      SELECT SUM(pi.total_cost)
      FROM production_items pi
      WHERE pi.production_id = p.id
    ), 0) > 0 THEN
      COALESCE((
        SELECT SUM(pi.total_cost)
        FROM production_items pi
        WHERE pi.production_id = p.id
      ), 0) / p.quantity
    ELSE
      COALESCE(prod.production_cost, prod.material_cost, prod.manual_unit_cost, 0)
  END as final_cost_per_unit,

  -- Margem
  CASE
    WHEN COALESCE((
      SELECT SUM(pi.total_cost)
      FROM production_items pi
      WHERE pi.production_id = p.id
    ), 0) > 0 THEN
      COALESCE(prod.final_sale_price, prod.sale_price, 0) - (
        COALESCE((
          SELECT SUM(pi.total_cost)
          FROM production_items pi
          WHERE pi.production_id = p.id
        ), 0) / p.quantity
      )
    ELSE
      COALESCE(prod.final_sale_price, prod.sale_price, 0) - 
      COALESCE(prod.production_cost, prod.material_cost, prod.manual_unit_cost, 0)
  END as margin_per_unit

FROM production p
INNER JOIN products prod ON prod.id = p.product_id
WHERE p.notes IS NULL OR NOT p.notes ILIKE '%ajuste de estoque%';

COMMENT ON VIEW v_producao_com_custos IS
'View auxiliar que combina produção com custos reais, teóricos e margens calculadas';

-- 4. Criar índices adicionais para performance
CREATE INDEX IF NOT EXISTS idx_products_production_cost
ON products (production_cost)
WHERE production_cost > 0;

CREATE INDEX IF NOT EXISTS idx_products_sale_prices
ON products (sale_price, final_sale_price)
WHERE sale_price > 0 OR final_sale_price > 0;

CREATE INDEX IF NOT EXISTS idx_products_product_type
ON products (product_type);
