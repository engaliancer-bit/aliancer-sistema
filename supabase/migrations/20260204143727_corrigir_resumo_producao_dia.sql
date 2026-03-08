/*
  # Corrigir Botão "Gerar Resumo do Dia"

  ## Problema
  O botão "Gerar Resumo do Dia" não está funcionando corretamente porque:
  1. A função get_material_costs_report busca de custos_no_momento->materials que está vazio
  2. A tabela production_items existe mas não está sendo populada
  
  ## Solução
  1. Criar nova RPC get_resumo_producao_dia que:
     - Busca de production_items (fonte principal)
     - Fallback para custos_no_momento se production_items estiver vazio
     - Retorna agregação por material com totais
  
  2. Inclui diagnóstico para identificar problemas
  
  ## Retorno
  - material_id: UUID do material
  - material_name: Nome do material
  - total_quantity: Quantidade total consumida
  - unit: Unidade de medida
  - avg_unit_cost: Custo médio unitário
  - total_cost: Custo total
  - usage_count: Número de produções que usaram
  - source: 'production_items' ou 'custos_no_momento'
*/

-- Criar função para obter resumo de produção do dia
CREATE OR REPLACE FUNCTION get_resumo_producao_dia(
  p_data DATE
)
RETURNS TABLE (
  material_id UUID,
  material_name TEXT,
  total_quantity NUMERIC,
  unit TEXT,
  avg_unit_cost NUMERIC,
  total_cost NUMERIC,
  usage_count BIGINT,
  source TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_items_count INT;
  v_productions_count INT;
BEGIN
  -- Verificar se há production_items para essa data
  SELECT COUNT(*) INTO v_items_count
  FROM production_items pi
  INNER JOIN production p ON p.id = pi.production_id
  WHERE p.production_date = p_data;
  
  -- Verificar quantas produções existem nessa data
  SELECT COUNT(*) INTO v_productions_count
  FROM production p
  WHERE p.production_date = p_data;
  
  RAISE NOTICE 'Resumo do dia %: % produções, % items', p_data, v_productions_count, v_items_count;
  
  -- Se production_items tem dados, usar como fonte principal
  IF v_items_count > 0 THEN
    RAISE NOTICE 'Usando production_items como fonte';
    
    RETURN QUERY
    SELECT
      pi.material_id,
      pi.material_name,
      SUM(pi.quantity) as total_quantity,
      MAX(pi.unit) as unit,
      AVG(pi.unit_cost) as avg_unit_cost,
      SUM(pi.total_cost) as total_cost,
      COUNT(DISTINCT pi.production_id)::bigint as usage_count,
      'production_items'::text as source
    FROM production_items pi
    INNER JOIN production p ON p.id = pi.production_id
    WHERE p.production_date = p_data
      AND (p.notes IS NULL OR NOT p.notes ILIKE '%ajuste de estoque%')
    GROUP BY pi.material_id, pi.material_name
    ORDER BY SUM(pi.total_cost) DESC;
  
  -- Caso contrário, tentar buscar de custos_no_momento (fallback)
  ELSE
    RAISE NOTICE 'Usando custos_no_momento como fallback';
    
    RETURN QUERY
    SELECT
      (value->>'material_id')::uuid as material_id,
      value->>'name' as material_name,
      SUM((value->>'quantity')::numeric) as total_quantity,
      value->>'unit' as unit,
      AVG((value->>'unit_price')::numeric) as avg_unit_cost,
      SUM((value->>'total')::numeric) as total_cost,
      COUNT(*)::bigint as usage_count,
      'custos_no_momento'::text as source
    FROM production p,
    LATERAL jsonb_each(p.custos_no_momento->'materials') as materials(key, value)
    WHERE p.production_date = p_data
      AND jsonb_typeof(p.custos_no_momento->'materials') = 'object'
      AND (p.notes IS NULL OR NOT p.notes ILIKE '%ajuste de estoque%')
    GROUP BY (value->>'material_id')::uuid, value->>'name', value->>'unit'
    ORDER BY SUM((value->>'total')::numeric) DESC;
  END IF;
  
  RETURN;
END;
$$;

-- Criar função para obter resumo de produtos produzidos no dia
CREATE OR REPLACE FUNCTION get_resumo_produtos_dia(
  p_data DATE
)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  product_code TEXT,
  total_quantity NUMERIC,
  unit TEXT,
  production_count BIGINT
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
    COUNT(p.id)::bigint as production_count
  FROM production p
  INNER JOIN products prod ON prod.id = p.product_id
  WHERE p.production_date = p_data
    AND (p.notes IS NULL OR NOT p.notes ILIKE '%ajuste de estoque%')
  GROUP BY p.product_id, prod.name, prod.code, prod.unit
  ORDER BY prod.name;
END;
$$;

-- Adicionar comentários
COMMENT ON FUNCTION get_resumo_producao_dia IS 
  'Retorna resumo de consumo de insumos para uma data específica. Usa production_items como fonte principal, com fallback para custos_no_momento.';

COMMENT ON FUNCTION get_resumo_produtos_dia IS 
  'Retorna resumo de produtos produzidos para uma data específica, agregando por produto.';
