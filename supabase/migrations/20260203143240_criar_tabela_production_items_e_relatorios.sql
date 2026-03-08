/*
  # Criar Tabela de Itens de Produção e Relatórios Otimizados

  1. Nova Tabela
    - `production_items` - Armazena consumo calculado por insumo em cada produção
    - Campos: production_id, material_id, quantity, unit, unit_cost, total_cost
    - Permite agregações rápidas via SQL
  
  2. Funções RPC para Relatórios
    - `relatorio_consumo_insumos` - Agregação de consumo por material
    - `relatorio_total_produtos` - Agregação de produtos produzidos
    - `relatorio_producao_completo` - Relatório consolidado
  
  3. Modificação da Função Atômica
    - Atualizar `create_production_atomic` para inserir `production_items`
    - Manter compatibilidade com `custos_no_momento` (JSONB)
  
  4. Índices para Performance
    - Índices em production_items para queries rápidas
    - Índices compostos para relatórios por período

  ## Estrutura da Tabela production_items

  Cada linha representa um material consumido em uma produção:
  
  | production_id | material_id | quantity | unit | unit_cost | total_cost |
  |---------------|-------------|----------|------|-----------|------------|
  | uuid-prod-1   | uuid-mat-1  | 50.5     | kg   | 1.20      | 60.60      |
  | uuid-prod-1   | uuid-mat-2  | 0.5      | m³   | 80.00     | 40.00      |
  | uuid-prod-2   | uuid-mat-1  | 25.0     | kg   | 1.20      | 30.00      |

  ## Benefícios

  - Relatórios instantâneos via agregação SQL
  - Sem loops JavaScript no frontend
  - Escalável para milhões de registros
  - Dados normalizados e estruturados
*/

-- 1. CRIAR TABELA production_items
CREATE TABLE IF NOT EXISTS production_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id UUID NOT NULL REFERENCES production(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id),
  material_name TEXT NOT NULL,
  quantity DECIMAL(10,3) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL,
  unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT check_total_cost CHECK (total_cost = quantity * unit_cost)
);

-- 2. CRIAR ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_production_items_production_id 
ON production_items (production_id);

CREATE INDEX IF NOT EXISTS idx_production_items_material_id 
ON production_items (material_id);

CREATE INDEX IF NOT EXISTS idx_production_items_production_material 
ON production_items (production_id, material_id);

-- Índice composto para relatórios por período
CREATE INDEX IF NOT EXISTS idx_production_items_date_material 
ON production_items (material_id, created_at);

-- 3. HABILITAR RLS
ALTER TABLE production_items ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (acesso público temporário - ajustar conforme necessário)
CREATE POLICY "Permitir leitura de production_items"
  ON production_items FOR SELECT
  USING (true);

CREATE POLICY "Permitir inserção de production_items"
  ON production_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Permitir atualização de production_items"
  ON production_items FOR UPDATE
  USING (true);

CREATE POLICY "Permitir exclusão de production_items"
  ON production_items FOR DELETE
  USING (true);

-- 4. FUNÇÃO RPC: RELATÓRIO DE CONSUMO DE INSUMOS
CREATE OR REPLACE FUNCTION relatorio_consumo_insumos(
  p_data_inicio DATE,
  p_data_fim DATE,
  p_material_id UUID DEFAULT NULL
)
RETURNS TABLE (
  material_id UUID,
  material_name TEXT,
  total_quantity DECIMAL,
  unit TEXT,
  avg_unit_cost DECIMAL,
  total_cost DECIMAL,
  usage_count BIGINT,
  first_usage DATE,
  last_usage DATE
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pi.material_id,
    pi.material_name,
    SUM(pi.quantity) as total_quantity,
    MAX(pi.unit) as unit,
    AVG(pi.unit_cost) as avg_unit_cost,
    SUM(pi.total_cost) as total_cost,
    COUNT(DISTINCT pi.production_id)::bigint as usage_count,
    MIN(p.production_date) as first_usage,
    MAX(p.production_date) as last_usage
  FROM production_items pi
  INNER JOIN production p ON p.id = pi.production_id
  WHERE p.production_date >= p_data_inicio
    AND p.production_date <= p_data_fim
    AND (p_material_id IS NULL OR pi.material_id = p_material_id)
    AND (p.notes IS NULL OR NOT p.notes ILIKE '%ajuste de estoque%')
  GROUP BY pi.material_id, pi.material_name
  ORDER BY SUM(pi.total_cost) DESC;
END;
$$;

-- 5. FUNÇÃO RPC: RELATÓRIO TOTAL DE PRODUTOS
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
  avg_cost_per_unit DECIMAL
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
    COALESCE(SUM(items_cost.total_cost), 0) as total_material_cost,
    CASE 
      WHEN SUM(p.quantity) > 0 THEN 
        COALESCE(SUM(items_cost.total_cost), 0) / SUM(p.quantity)
      ELSE 0
    END as avg_cost_per_unit
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
  GROUP BY p.production_date, p.product_id, prod.name, prod.code, prod.unit
  ORDER BY p.production_date DESC, prod.name;
END;
$$;

-- 6. FUNÇÃO RPC: RELATÓRIO DE PRODUÇÃO COMPLETO (CONSOLIDADO)
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
    COUNT(DISTINCT pi.material_id)::bigint as unique_materials,
    CASE 
      WHEN COUNT(DISTINCT p.id) > 0 THEN 
        COALESCE(SUM(items_cost.total_cost), 0) / COUNT(DISTINCT p.id)
      ELSE 0
    END as avg_cost_per_production,
    (p_data_fim - p_data_inicio)::integer as date_range_days
  FROM production p
  LEFT JOIN production_items pi ON pi.production_id = p.id
  LEFT JOIN (
    SELECT 
      production_id,
      SUM(total_cost) as total_cost
    FROM production_items
    GROUP BY production_id
  ) items_cost ON items_cost.production_id = p.id
  WHERE p.production_date >= p_data_inicio
    AND p.production_date <= p_data_fim
    AND (p.notes IS NULL OR NOT p.notes ILIKE '%ajuste de estoque%');
END;
$$;

-- 7. FUNÇÃO AUXILIAR: EXTRAIR ITENS DO JSONB custos_no_momento
CREATE OR REPLACE FUNCTION extract_production_items_from_custos(
  p_production_id UUID,
  p_custos JSONB
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_material JSONB;
  v_material_id UUID;
BEGIN
  -- Iterar sobre cada material no JSONB
  FOR v_material IN
    SELECT value
    FROM jsonb_each(p_custos->'materials')
  LOOP
    v_material_id := (v_material->>'material_id')::uuid;
    
    -- Inserir item de produção
    INSERT INTO production_items (
      production_id,
      material_id,
      material_name,
      quantity,
      unit,
      unit_cost,
      total_cost
    ) VALUES (
      p_production_id,
      v_material_id,
      v_material->>'name',
      (v_material->>'quantity')::decimal,
      v_material->>'unit',
      (v_material->>'unit_price')::decimal,
      (v_material->>'total')::decimal
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- 8. ATUALIZAR FUNÇÃO create_production_atomic PARA INSERIR production_items
CREATE OR REPLACE FUNCTION create_production_atomic(
  p_product_id UUID,
  p_recipe_id UUID,
  p_quantity DECIMAL,
  p_production_date DATE,
  p_employee_id UUID DEFAULT NULL,
  p_production_order_item_id UUID DEFAULT NULL,
  p_production_type TEXT DEFAULT 'stock',
  p_notes TEXT DEFAULT NULL,
  p_custos JSONB DEFAULT NULL,
  p_material_movements JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_production_id UUID;
  v_movement JSONB;
  v_material JSONB;
BEGIN
  -- 1. Se custos não foram fornecidos, calcular automaticamente
  IF p_custos IS NULL OR p_custos = '{}'::jsonb THEN
    p_custos := calculate_production_costs(p_recipe_id, p_quantity);
  END IF;
  
  -- 2. Criar registro de produção com custos históricos
  INSERT INTO production (
    product_id,
    recipe_id,
    quantity,
    production_date,
    employee_id,
    production_order_item_id,
    production_type,
    notes,
    custos_no_momento
  ) VALUES (
    p_product_id,
    p_recipe_id,
    p_quantity,
    p_production_date,
    p_employee_id,
    p_production_order_item_id,
    p_production_type,
    p_notes,
    p_custos
  )
  RETURNING id INTO v_production_id;
  
  -- 3. Inserir production_items a partir do JSONB custos_no_momento
  IF p_custos IS NOT NULL AND jsonb_typeof(p_custos->'materials') = 'object' THEN
    PERFORM extract_production_items_from_custos(v_production_id, p_custos);
  END IF;
  
  -- 4. Criar movimentos de materiais se fornecidos
  IF jsonb_array_length(p_material_movements) > 0 THEN
    FOR v_movement IN SELECT * FROM jsonb_array_elements(p_material_movements)
    LOOP
      INSERT INTO material_movements (
        material_id,
        movement_type,
        quantity,
        movement_date,
        reference_id,
        reference_type,
        notes
      ) VALUES (
        (v_movement->>'material_id')::uuid,
        COALESCE(v_movement->>'movement_type', 'saida'),
        (v_movement->>'quantity')::decimal,
        p_production_date,
        v_production_id,
        'production',
        v_movement->>'notes'
      );
    END LOOP;
  END IF;
  
  RETURN v_production_id;
END;
$$;

-- 9. TRIGGER: Sincronizar production_items ao atualizar custos_no_momento
CREATE OR REPLACE FUNCTION sync_production_items_from_custos()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Remover itens antigos
  DELETE FROM production_items WHERE production_id = NEW.id;
  
  -- Inserir novos itens
  IF NEW.custos_no_momento IS NOT NULL AND jsonb_typeof(NEW.custos_no_momento->'materials') = 'object' THEN
    PERFORM extract_production_items_from_custos(NEW.id, NEW.custos_no_momento);
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_sync_production_items
  AFTER INSERT OR UPDATE OF custos_no_momento ON production
  FOR EACH ROW
  WHEN (NEW.custos_no_momento IS NOT NULL)
  EXECUTE FUNCTION sync_production_items_from_custos();

-- Comentários
COMMENT ON TABLE production_items IS 
'Armazena consumo detalhado de materiais por produção para relatórios agregados rápidos';

COMMENT ON FUNCTION relatorio_consumo_insumos IS 
'Retorna relatório agregado de consumo de insumos por período com custos históricos';

COMMENT ON FUNCTION relatorio_total_produtos IS 
'Retorna relatório agregado de produtos produzidos por período com custos calculados';

COMMENT ON FUNCTION relatorio_producao_completo IS 
'Retorna resumo consolidado de produção com estatísticas gerais';

COMMENT ON FUNCTION extract_production_items_from_custos IS 
'Extrai e insere production_items a partir do campo JSONB custos_no_momento';

-- 10. MIGRAR DADOS EXISTENTES (se houver produções com custos_no_momento)
DO $$
DECLARE
  v_production RECORD;
BEGIN
  FOR v_production IN
    SELECT id, custos_no_momento
    FROM production
    WHERE custos_no_momento IS NOT NULL
      AND jsonb_typeof(custos_no_momento->'materials') = 'object'
      AND NOT EXISTS (
        SELECT 1 FROM production_items WHERE production_id = production.id
      )
  LOOP
    PERFORM extract_production_items_from_custos(v_production.id, v_production.custos_no_momento);
  END LOOP;
END $$;
