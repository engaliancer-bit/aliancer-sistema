/*
  # Corrigir Rastreamento de Progresso das Ordens de Produção

  1. Problema Identificado
    - Campo `produced_quantity` nas ordens de produção não está sendo atualizado
    - Quando produções são vinculadas a ordens via `production_order_id`, a barra de progresso não avança
    - Exemplo: Ordem #26 do cliente Sidinei Strack tem 6 unidades produzidas vinculadas, mas `produced_quantity` está em 0

  2. Solução Implementada
    - Criar função que recalcula automaticamente `produced_quantity` e `remaining_quantity`
    - Criar trigger que executa essa função quando produções são vinculadas/desvinculadas
    - Atualizar dados existentes para corrigir ordens com progresso incorreto

  3. Tabelas Afetadas
    - `production_orders`: campos `produced_quantity`, `remaining_quantity`, `status` serão atualizados automaticamente
    - `production`: trigger monitora mudanças no campo `production_order_id`

  4. Comportamento
    - Quando uma produção é vinculada a uma ordem (production_order_id preenchido):
      - `produced_quantity` aumenta automaticamente
      - `remaining_quantity` diminui automaticamente
      - `status` muda para 'in_progress' se ainda não estiver
      - `status` muda para 'completed' quando remaining_quantity = 0
    - Quando uma produção é desvinculada de uma ordem:
      - `produced_quantity` diminui automaticamente
      - `remaining_quantity` aumenta automaticamente
*/

-- =====================================================
-- 1. FUNÇÃO PARA RECALCULAR QUANTIDADES DA ORDEM
-- =====================================================

CREATE OR REPLACE FUNCTION update_production_order_quantities()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id uuid;
  v_total_produced numeric;
  v_total_quantity numeric;
  v_remaining numeric;
BEGIN
  -- Identificar qual ordem foi afetada
  IF TG_OP = 'DELETE' THEN
    v_order_id := OLD.production_order_id;
  ELSE
    v_order_id := NEW.production_order_id;
  END IF;

  -- Se não há ordem vinculada, não fazer nada
  IF v_order_id IS NULL THEN
    -- Verificar se tinha uma ordem antes (caso de UPDATE que remove vinculação)
    IF TG_OP = 'UPDATE' AND OLD.production_order_id IS NOT NULL THEN
      v_order_id := OLD.production_order_id;
    ELSE
      RETURN COALESCE(NEW, OLD);
    END IF;
  END IF;

  -- Calcular total produzido para esta ordem
  SELECT COALESCE(SUM(quantity), 0)
  INTO v_total_produced
  FROM production
  WHERE production_order_id = v_order_id;

  -- Buscar quantidade total da ordem
  SELECT total_quantity
  INTO v_total_quantity
  FROM production_orders
  WHERE id = v_order_id;

  -- Calcular quantidade restante
  v_remaining := GREATEST(v_total_quantity - v_total_produced, 0);

  -- Atualizar a ordem de produção
  UPDATE production_orders
  SET 
    produced_quantity = v_total_produced,
    remaining_quantity = v_remaining,
    status = CASE
      WHEN v_remaining = 0 AND v_total_produced >= v_total_quantity THEN 'completed'
      WHEN v_total_produced > 0 THEN 'in_progress'
      ELSE status
    END,
    updated_at = now()
  WHERE id = v_order_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2. TRIGGER PARA ATUALIZAÇÃO AUTOMÁTICA
-- =====================================================

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_update_production_order_quantities ON production;

-- Criar novo trigger
CREATE TRIGGER trigger_update_production_order_quantities
  AFTER INSERT OR UPDATE OR DELETE ON production
  FOR EACH ROW
  EXECUTE FUNCTION update_production_order_quantities();

-- =====================================================
-- 3. ATUALIZAR TODAS AS ORDENS EXISTENTES
-- =====================================================

-- Recalcular quantidades para todas as ordens de produção
DO $$
DECLARE
  v_order RECORD;
  v_total_produced numeric;
  v_remaining numeric;
BEGIN
  FOR v_order IN 
    SELECT id, total_quantity
    FROM production_orders
  LOOP
    -- Calcular total produzido
    SELECT COALESCE(SUM(quantity), 0)
    INTO v_total_produced
    FROM production
    WHERE production_order_id = v_order.id;

    -- Calcular restante
    v_remaining := GREATEST(v_order.total_quantity - v_total_produced, 0);

    -- Atualizar ordem
    UPDATE production_orders
    SET 
      produced_quantity = v_total_produced,
      remaining_quantity = v_remaining,
      status = CASE
        WHEN v_remaining = 0 AND v_total_produced >= v_order.total_quantity THEN 'completed'
        WHEN v_total_produced > 0 THEN 'in_progress'
        ELSE status
      END,
      updated_at = now()
    WHERE id = v_order.id;

    RAISE NOTICE 'Ordem ID % atualizada: produzido=%, restante=%, status=%', 
      v_order.id, v_total_produced, v_remaining,
      CASE
        WHEN v_remaining = 0 AND v_total_produced >= v_order.total_quantity THEN 'completed'
        WHEN v_total_produced > 0 THEN 'in_progress'
        ELSE 'open'
      END;
  END LOOP;
END;
$$;

-- =====================================================
-- 4. COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================

COMMENT ON FUNCTION update_production_order_quantities() IS 
'Atualiza automaticamente os campos produced_quantity, remaining_quantity e status de uma ordem de produção baseado nas produções vinculadas. Acionado por trigger sempre que uma produção é inserida, atualizada ou deletada com production_order_id.';

COMMENT ON TRIGGER trigger_update_production_order_quantities ON production IS
'Garante que o progresso das ordens de produção seja sempre preciso, atualizando automaticamente quando produções são vinculadas ou desvinculadas.';