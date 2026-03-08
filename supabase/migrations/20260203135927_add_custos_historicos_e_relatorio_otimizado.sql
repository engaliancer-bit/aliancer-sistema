/*
  # Otimização de Relatórios e Persistência de Custos

  1. Custos Históricos
    - Adiciona campo `custos_no_momento` JSONB na tabela `production`
    - Armazena preços unitários dos insumos no momento da produção
    - Formato: { "material_id": { "name": "Nome", "price": 10.50, "quantity": 5 } }
  
  2. Função RPC para Relatório Otimizado
    - Calcula somas de insumos e valores via SQL
    - Elimina processamento no JavaScript
    - Performance muito superior para períodos longos
  
  3. Transação Atômica
    - Função RPC para criar produção e atualizar estoque atomicamente
    - Garante consistência de dados
    - Previne condições de corrida

  ## Estrutura do JSONB custos_no_momento

  ```json
  {
    "materials": {
      "uuid-material-1": {
        "material_id": "uuid-material-1",
        "name": "Cimento CP-II",
        "quantity": 50.5,
        "unit": "kg",
        "unit_price": 1.20,
        "total": 60.60
      },
      "uuid-material-2": {
        "material_id": "uuid-material-2",
        "name": "Areia",
        "quantity": 0.5,
        "unit": "m³",
        "unit_price": 80.00,
        "total": 40.00
      }
    },
    "total_cost": 100.60,
    "calculated_at": "2026-02-03T12:00:00Z"
  }
  ```
*/

-- 1. Adicionar campo custos_no_momento na tabela production
ALTER TABLE production
ADD COLUMN IF NOT EXISTS custos_no_momento JSONB DEFAULT '{}'::jsonb;

-- Criar índice GIN para buscas eficientes no JSONB
CREATE INDEX IF NOT EXISTS idx_production_custos_no_momento 
ON production USING gin (custos_no_momento);

-- 2. Função para calcular e armazenar custos históricos
CREATE OR REPLACE FUNCTION calculate_production_costs(p_recipe_id UUID, p_quantity DECIMAL)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_costs JSONB := '{"materials": {}, "total_cost": 0}'::jsonb;
  v_total DECIMAL := 0;
  r RECORD;
BEGIN
  -- Buscar todos os materiais da receita e seus preços atuais
  FOR r IN
    SELECT 
      ri.material_id,
      m.name,
      m.unit,
      COALESCE(m.cost_per_unit, 0) as unit_price,
      ri.quantity_per_unit * p_quantity as total_quantity,
      COALESCE(m.cost_per_unit, 0) * ri.quantity_per_unit * p_quantity as total_cost
    FROM recipe_items ri
    INNER JOIN materials m ON m.id = ri.material_id
    WHERE ri.recipe_id = p_recipe_id
  LOOP
    -- Adicionar cada material ao objeto JSONB
    v_costs := jsonb_set(
      v_costs,
      ARRAY['materials', r.material_id::text],
      jsonb_build_object(
        'material_id', r.material_id,
        'name', r.name,
        'quantity', r.total_quantity,
        'unit', r.unit,
        'unit_price', r.unit_price,
        'total', r.total_cost
      )
    );
    
    v_total := v_total + r.total_cost;
  END LOOP;
  
  -- Atualizar total e timestamp
  v_costs := jsonb_set(v_costs, '{total_cost}', to_jsonb(v_total));
  v_costs := jsonb_set(v_costs, '{calculated_at}', to_jsonb(now()));
  
  RETURN v_costs;
END;
$$;

-- 3. Função para criar produção com custos históricos atomicamente
CREATE OR REPLACE FUNCTION create_production_with_costs(
  p_product_id UUID,
  p_recipe_id UUID,
  p_quantity DECIMAL,
  p_employee_id UUID,
  p_production_order_item_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_production_id UUID;
  v_costs JSONB;
  r RECORD;
BEGIN
  -- Calcular custos no momento
  v_costs := calculate_production_costs(p_recipe_id, p_quantity);
  
  -- Criar registro de produção com custos históricos
  INSERT INTO production (
    product_id,
    recipe_id,
    quantity,
    employee_id,
    production_order_item_id,
    notes,
    custos_no_momento,
    production_date
  ) VALUES (
    p_product_id,
    p_recipe_id,
    p_quantity,
    p_employee_id,
    p_production_order_item_id,
    p_notes,
    v_costs,
    CURRENT_DATE
  )
  RETURNING id INTO v_production_id;
  
  -- Atualizar estoque de materiais (debitar) atomicamente
  FOR r IN
    SELECT 
      ri.material_id,
      ri.quantity_per_unit * p_quantity as total_quantity
    FROM recipe_items ri
    WHERE ri.recipe_id = p_recipe_id
  LOOP
    -- Criar movimento de material
    INSERT INTO material_movements (
      material_id,
      movement_type,
      quantity,
      reference_id,
      reference_type,
      movement_date,
      notes
    ) VALUES (
      r.material_id,
      'producao',
      -r.total_quantity,  -- Negativo para debitar
      v_production_id,
      'producao',
      CURRENT_DATE,
      'Consumo automático de produção'
    );
  END LOOP;
  
  RETURN v_production_id;
END;
$$;

-- 4. Função RPC para relatório de produção otimizado
CREATE OR REPLACE FUNCTION get_production_report(
  p_start_date DATE,
  p_end_date DATE,
  p_product_id UUID DEFAULT NULL
)
RETURNS TABLE (
  production_date DATE,
  product_id UUID,
  product_name TEXT,
  total_quantity DECIMAL,
  total_cost DECIMAL,
  material_costs JSONB,
  production_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.production_date,
    p.product_id,
    prod.name as product_name,
    SUM(p.quantity) as total_quantity,
    SUM((p.custos_no_momento->>'total_cost')::decimal) as total_cost,
    jsonb_agg(
      jsonb_build_object(
        'production_id', p.id,
        'quantity', p.quantity,
        'costs', p.custos_no_momento
      )
    ) as material_costs,
    COUNT(*)::bigint as production_count
  FROM production p
  INNER JOIN products prod ON prod.id = p.product_id
  WHERE p.production_date >= p_start_date
    AND p.production_date <= p_end_date
    AND (p_product_id IS NULL OR p.product_id = p_product_id)
  GROUP BY p.production_date, p.product_id, prod.name
  ORDER BY p.production_date DESC, prod.name;
END;
$$;

-- 5. Função RPC para relatório de custos por material
CREATE OR REPLACE FUNCTION get_material_costs_report(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  material_id UUID,
  material_name TEXT,
  total_quantity DECIMAL,
  total_cost DECIMAL,
  usage_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (value->>'material_id')::uuid as material_id,
    value->>'name' as material_name,
    SUM((value->>'quantity')::decimal) as total_quantity,
    SUM((value->>'total')::decimal) as total_cost,
    COUNT(*)::bigint as usage_count
  FROM production p,
  LATERAL jsonb_each(p.custos_no_momento->'materials') as materials(key, value)
  WHERE p.production_date >= p_start_date
    AND p.production_date <= p_end_date
    AND jsonb_typeof(p.custos_no_momento->'materials') = 'object'
  GROUP BY (value->>'material_id')::uuid, value->>'name'
  ORDER BY SUM((value->>'total')::decimal) DESC;
END;
$$;

-- 6. Função RPC para relatório resumido de produção
CREATE OR REPLACE FUNCTION get_production_summary(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  total_productions BIGINT,
  total_products DECIMAL,
  total_cost DECIMAL,
  avg_cost_per_unit DECIMAL,
  products_produced BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total_productions,
    COALESCE(SUM(p.quantity), 0) as total_products,
    COALESCE(SUM((p.custos_no_momento->>'total_cost')::decimal), 0) as total_cost,
    CASE 
      WHEN SUM(p.quantity) > 0 THEN 
        SUM((p.custos_no_momento->>'total_cost')::decimal) / SUM(p.quantity)
      ELSE 0
    END as avg_cost_per_unit,
    COUNT(DISTINCT p.product_id)::bigint as products_produced
  FROM production p
  WHERE p.production_date >= p_start_date
    AND p.production_date <= p_end_date;
END;
$$;

-- 7. Atualizar trigger existente para usar a nova função atômica
-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS on_production_created_update_stock ON production;
DROP FUNCTION IF EXISTS handle_production_stock_update();

-- 8. Índices para otimização de queries
CREATE INDEX IF NOT EXISTS idx_production_production_date 
ON production (production_date);

CREATE INDEX IF NOT EXISTS idx_production_product_date 
ON production (product_id, production_date);

CREATE INDEX IF NOT EXISTS idx_production_date_range 
ON production (production_date DESC);

-- Comentários nas funções
COMMENT ON FUNCTION calculate_production_costs IS 
'Calcula custos de produção baseado nos preços atuais dos materiais da receita';

COMMENT ON FUNCTION create_production_with_costs IS 
'Cria registro de produção com custos históricos e atualiza estoque atomicamente em uma transação';

COMMENT ON FUNCTION get_production_report IS 
'Retorna relatório de produção otimizado com custos agregados por data e produto';

COMMENT ON FUNCTION get_material_costs_report IS 
'Retorna relatório de custos por material baseado em custos históricos';

COMMENT ON FUNCTION get_production_summary IS 
'Retorna resumo geral de produção com totalizações';

COMMENT ON COLUMN production.custos_no_momento IS 
'Armazena custos históricos dos materiais no momento da produção em formato JSONB';
