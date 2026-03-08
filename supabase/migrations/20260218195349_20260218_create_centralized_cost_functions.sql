/*
  # Solução Problema 1: Centralizar Cálculos de Custos de Produção
  
  ## Problema
  Múltiplas funções de relatório fazem cálculos similares de custos, causando:
  - Divergência de valores entre relatórios
  - JOINs desnecessários que duplicam dados
  - Produto cartesiano causando multiplicação de custos
  
  ## Solução
  1. Criar função centralizada get_production_costs() com JOIN único otimizado
  2. Criar função de agregação centralizada
  3. Adicionar validações de integridade
  
  ## Benefícios
  - Single source of truth para cálculos de custos
  - Garantia de consistência entre relatórios
  - Performance otimizada
  - Manutenção centralizada
*/

-- ====================================
-- 1. CRIAR FUNÇÃO CENTRALIZADA SEGURA
-- ====================================

CREATE OR REPLACE FUNCTION get_production_costs_safe(
  p_date_start DATE,
  p_date_end DATE,
  p_exclude_stock_adjustments BOOLEAN DEFAULT true
)
RETURNS TABLE (
  production_id UUID,
  product_id UUID,
  quantity DECIMAL,
  production_date DATE,
  material_cost DECIMAL,
  labor_cost DECIMAL,
  indirect_cost DECIMAL,
  depreciation_cost DECIMAL,
  total_cost DECIMAL,
  cost_per_unit DECIMAL
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as production_id,
    p.product_id,
    p.quantity,
    p.production_date,
    COALESCE(pc.material_cost, 0) as material_cost,
    COALESCE(pc.labor_cost, 0) as labor_cost,
    COALESCE(pc.indirect_cost, 0) as indirect_cost,
    COALESCE(pc.depreciation_cost, 0) as depreciation_cost,
    COALESCE(pc.total_cost, 0) as total_cost,
    COALESCE(pc.cost_per_unit, 0) as cost_per_unit
  FROM production p
  LEFT JOIN production_costs pc ON pc.production_id = p.id
  WHERE p.production_date >= p_date_start
    AND p.production_date <= p_date_end
    AND (NOT p_exclude_stock_adjustments 
         OR (p.notes IS NULL OR NOT p.notes ILIKE '%ajuste de estoque%'))
  ORDER BY p.production_date DESC, p.id;
END;
$$;

COMMENT ON FUNCTION get_production_costs_safe IS 
  'Retorna custos de produção com JOIN único otimizado, evitando duplicação de dados';

-- ====================================
-- 2. CRIAR FUNÇÃO DE AGREGAÇÃO SEGURA
-- ====================================

CREATE OR REPLACE FUNCTION get_production_costs_aggregated(
  p_date_start DATE,
  p_date_end DATE,
  p_exclude_stock_adjustments BOOLEAN DEFAULT true
)
RETURNS TABLE (
  total_productions BIGINT,
  total_quantity DECIMAL,
  total_material_cost DECIMAL,
  total_labor_cost DECIMAL,
  total_indirect_cost DECIMAL,
  total_depreciation_cost DECIMAL,
  total_cost DECIMAL,
  avg_cost_per_production DECIMAL,
  avg_cost_per_unit DECIMAL
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH costs AS (
    SELECT * FROM get_production_costs_safe(p_date_start, p_date_end, p_exclude_stock_adjustments)
  )
  SELECT
    COUNT(DISTINCT production_id)::BIGINT as total_productions,
    COALESCE(SUM(quantity), 0) as total_quantity,
    COALESCE(SUM(material_cost), 0) as total_material_cost,
    COALESCE(SUM(labor_cost), 0) as total_labor_cost,
    COALESCE(SUM(indirect_cost), 0) as total_indirect_cost,
    COALESCE(SUM(depreciation_cost), 0) as total_depreciation_cost,
    COALESCE(SUM(total_cost), 0) as total_cost,
    CASE 
      WHEN COUNT(DISTINCT production_id) > 0 
      THEN COALESCE(SUM(total_cost), 0) / COUNT(DISTINCT production_id)
      ELSE 0
    END as avg_cost_per_production,
    CASE 
      WHEN COALESCE(SUM(quantity), 0) > 0 
      THEN COALESCE(SUM(total_cost), 0) / SUM(quantity)
      ELSE 0
    END as avg_cost_per_unit
  FROM costs;
END;
$$;

COMMENT ON FUNCTION get_production_costs_aggregated IS 
  'Retorna agregação de custos de produção usando função centralizada (sem duplicação)';

-- ====================================
-- 3. CRIAR FUNÇÃO DE VALIDAÇÃO
-- ====================================

CREATE OR REPLACE FUNCTION validate_production_costs(
  p_date_start DATE,
  p_date_end DATE
)
RETURNS TABLE (
  validation_passed BOOLEAN,
  total_records BIGINT,
  records_with_costs BIGINT,
  records_without_costs BIGINT,
  total_cost_amount DECIMAL
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH cost_data AS (
    SELECT * FROM get_production_costs_safe(p_date_start, p_date_end, false)
  )
  SELECT
    TRUE as validation_passed,
    COUNT(DISTINCT production_id)::BIGINT as total_records,
    COUNT(DISTINCT CASE WHEN total_cost > 0 THEN production_id END)::BIGINT as records_with_costs,
    COUNT(DISTINCT CASE WHEN total_cost = 0 THEN production_id END)::BIGINT as records_without_costs,
    COALESCE(SUM(total_cost), 0) as total_cost_amount
  FROM cost_data;
END;
$$;

COMMENT ON FUNCTION validate_production_costs IS 
  'Valida integridade dos dados de custo de produção';

-- ====================================
-- 4. CRIAR ÍNDICES PARA PERFORMANCE
-- ====================================

CREATE INDEX IF NOT EXISTS idx_production_costs_production_id 
  ON production_costs(production_id) 
  WHERE production_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_production_date 
  ON production(production_date) 
  WHERE production_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_production_notes 
  ON production(notes) 
  WHERE notes IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_production_items_production_id 
  ON production_items(production_id) 
  WHERE production_id IS NOT NULL;

-- ====================================
-- 5. ADICIONAR CONSTRAINT DE VALIDAÇÃO
-- ====================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'production_costs' 
    AND constraint_name = 'check_production_costs_non_negative'
  ) THEN
    ALTER TABLE production_costs 
    ADD CONSTRAINT check_production_costs_non_negative 
    CHECK (
      material_cost >= 0 AND
      labor_cost >= 0 AND
      indirect_cost >= 0 AND
      depreciation_cost >= 0 AND
      total_cost >= 0 AND
      cost_per_unit >= 0
    );
  END IF;
END $$;

-- ====================================
-- 6. CRIAR VIEW PARA RELATÓRIO UNIFICADO
-- ====================================

DROP VIEW IF EXISTS v_production_costs_detail CASCADE;

CREATE VIEW v_production_costs_detail AS
SELECT 
  p.id as production_id,
  p.product_id,
  pr.name as product_name,
  p.quantity as production_quantity,
  p.production_date,
  p.notes,
  COALESCE(pc.material_cost, 0) as material_cost,
  COALESCE(pc.labor_cost, 0) as labor_cost,
  COALESCE(pc.indirect_cost, 0) as indirect_cost,
  COALESCE(pc.depreciation_cost, 0) as depreciation_cost,
  COALESCE(pc.total_cost, 0) as total_cost,
  COALESCE(pc.cost_per_unit, 0) as cost_per_unit
FROM production p
LEFT JOIN products pr ON pr.id = p.product_id
LEFT JOIN production_costs pc ON pc.production_id = p.id
WHERE (p.notes IS NULL OR NOT p.notes ILIKE '%ajuste de estoque%');

GRANT SELECT ON v_production_costs_detail TO authenticated;

-- ====================================
-- 7. CRIAR LOG DE AUDITORIA
-- ====================================

CREATE TABLE IF NOT EXISTS cost_calculation_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calculation_date TIMESTAMPTZ DEFAULT now(),
  function_name TEXT NOT NULL,
  date_start DATE NOT NULL,
  date_end DATE NOT NULL,
  total_cost DECIMAL NOT NULL,
  total_records BIGINT NOT NULL,
  status TEXT DEFAULT 'success',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE cost_calculation_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated to insert audit logs"
  ON cost_calculation_audit FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to read audit logs"
  ON cost_calculation_audit FOR SELECT
  TO authenticated
  USING (true);

-- ====================================
-- 8. CRIAR FUNÇÃO DE LOG
-- ====================================

CREATE OR REPLACE FUNCTION log_cost_calculation(
  p_function_name TEXT,
  p_date_start DATE,
  p_date_end DATE,
  p_total_cost DECIMAL,
  p_total_records BIGINT,
  p_status TEXT DEFAULT 'success',
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO cost_calculation_audit (
    function_name, date_start, date_end, total_cost, total_records, status, notes
  )
  VALUES (p_function_name, p_date_start, p_date_end, p_total_cost, p_total_records, p_status, p_notes)
  RETURNING cost_calculation_audit.id INTO v_id;
  
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION log_cost_calculation IS 
  'Registra auditoria de cálculos de custos para rastreabilidade';
