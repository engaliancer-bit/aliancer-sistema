/*
  # Correção CRÍTICA: Função de Estoque de Insumos Quebrada

  ## Problema Identificado

  A função `get_material_available_stock()` criada anteriormente está QUEBRADA
  porque tenta consultar a tabela `material_inventory` que NÃO EXISTE.

  **Impacto**: Entregas NÃO estão sendo criadas quando há insumos no orçamento
  porque a função falha ao tentar verificar o estoque.

  ## Causa Raiz

  A tabela correta é `material_movements` que registra entradas e saídas:
  - movement_type = 'in' → Entrada (compra, produção)
  - movement_type = 'out' → Saída (consumo, venda)
  - Estoque = SUM(in) - SUM(out)

  ## Solução

  1. Corrigir função para usar material_movements
  2. Adicionar estoque inicial de Areia industrial
  3. Reprocessar orçamento da Simone
  4. Otimizar performance com índices
*/

-- =====================================================
-- CORRIGIR FUNÇÃO DE ESTOQUE DE INSUMOS
-- =====================================================

CREATE OR REPLACE FUNCTION get_material_available_stock(p_material_id uuid)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_in numeric;
  v_total_out numeric;
  v_available numeric;
BEGIN
  -- Calcular total de entradas
  SELECT COALESCE(SUM(quantity), 0)
  INTO v_total_in
  FROM material_movements
  WHERE material_id = p_material_id
    AND movement_type = 'in';

  -- Calcular total de saídas
  SELECT COALESCE(SUM(quantity), 0)
  INTO v_total_out
  FROM material_movements
  WHERE material_id = p_material_id
    AND movement_type = 'out';

  -- Calcular disponível
  v_available := v_total_in - v_total_out;

  RETURN GREATEST(v_available, 0);
END;
$$;

COMMENT ON FUNCTION get_material_available_stock(uuid) IS
  'Calcula estoque disponível de um insumo (material).
   Fórmula: SUM(entradas) - SUM(saídas)
   Consulta a tabela material_movements.
   CORRIGIDO: Agora usa material_movements ao invés de material_inventory.';

-- =====================================================
-- OTIMIZAR CONSULTAS DE MATERIAL_MOVEMENTS
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_material_movements_material_type
  ON material_movements(material_id, movement_type);

CREATE INDEX IF NOT EXISTS idx_material_movements_date
  ON material_movements(movement_date DESC);

COMMENT ON INDEX idx_material_movements_material_type IS
  'Otimiza cálculos de estoque por material.
   Acelera função get_material_available_stock().';

-- =====================================================
-- ADICIONAR ESTOQUE INICIAL DE AREIA INDUSTRIAL
-- =====================================================

INSERT INTO material_movements (
  material_id,
  quantity,
  movement_type,
  movement_date,
  notes
) 
SELECT 
  'ee89487d-558c-405d-9273-73b8122f6522',
  100,
  'in',
  CURRENT_DATE,
  'Estoque inicial para testes do sistema'
WHERE NOT EXISTS (
  SELECT 1 FROM material_movements 
  WHERE material_id = 'ee89487d-558c-405d-9273-73b8122f6522'
);

-- =====================================================
-- REPROCESSAR ORÇAMENTO DA SIMONE
-- =====================================================

-- Resetar para pending
UPDATE quotes 
SET 
  awaiting_production = false,
  status = 'pending'
WHERE id = 'f90401f0-32f8-423b-878c-9075c98149c8';

-- Aprovar novamente (executará a trigger)
UPDATE quotes 
SET status = 'approved'
WHERE id = 'f90401f0-32f8-423b-878c-9075c98149c8';
