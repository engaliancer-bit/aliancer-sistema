/*
  # Sistema Automático de Recálculo de Custos de Produtos

  ## Resumo
  Implementa sistema completo de recálculo automático de custos de produtos que atualiza:
  - Quando o traço/receita do produto é alterado
  - Quando o preço de compra de um insumo é atualizado
  
  ## Mudanças na Estrutura

  1. **Novos Campos em products**
     - `custo_total_materiais` (numeric) - Custo total de materiais do produto
     - `consumo_insumos` (jsonb) - Estrutura detalhada do consumo: [{material_id, quantity, unit, unit_cost, total_cost, material_name}]
  
  2. **Funções Criadas**
     - `calculate_product_material_cost(product_id)` - Calcula consumo e custo de materiais de um produto
     - `recalculate_product_costs_on_material_update()` - Trigger para recalcular quando preço de insumo muda
     - `recalculate_product_costs_on_product_update()` - Trigger para recalcular quando produto é atualizado

  3. **Triggers**
     - Recálculo automático ao salvar/atualizar produto
     - Recálculo automático ao atualizar preço de insumo (unit_cost)

  ## Segurança
  - Funções executam com privilégios de invoker
  - Validações de dados nullos e divisões por zero
*/

-- Adicionar novos campos à tabela products
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS custo_total_materiais numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consumo_insumos jsonb DEFAULT '[]'::jsonb;

-- Criar índice para otimizar buscas no JSONB
CREATE INDEX IF NOT EXISTS idx_products_consumo_insumos ON products USING gin(consumo_insumos);

-- =============================================================================
-- FUNÇÃO PRINCIPAL: Calcular Custo de Materiais do Produto
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_product_material_cost(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_product RECORD;
  v_recipe_id uuid;
  v_consumo jsonb := '[]'::jsonb;
  v_custo_total numeric := 0;
  v_item RECORD;
  v_material RECORD;
  v_quantidade numeric;
  v_custo_item numeric;
BEGIN
  -- Buscar dados do produto
  SELECT 
    id,
    recipe_id,
    concrete_volume_m3,
    peso_artefato,
    total_weight,
    product_type
  INTO v_product
  FROM products 
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RAISE NOTICE 'Produto % não encontrado', p_product_id;
    RETURN;
  END IF;

  v_recipe_id := v_product.recipe_id;

  -- Se o produto tem receita (traço), calcular consumo baseado na receita
  IF v_recipe_id IS NOT NULL THEN
    
    -- Calcular consumo de materiais da receita
    FOR v_item IN 
      SELECT 
        ri.material_id,
        ri.quantity_per_m3,
        m.name as material_name,
        m.unit,
        m.unit_cost,
        COALESCE(m.cost_per_meter, 0) as cost_per_meter,
        COALESCE(m.unit_length_meters, 0) as unit_length_meters
      FROM recipe_items ri
      JOIN materials m ON m.id = ri.material_id
      WHERE ri.recipe_id = v_recipe_id
    LOOP
      -- Calcular quantidade baseada no volume de concreto
      v_quantidade := 0;
      
      IF v_product.concrete_volume_m3 IS NOT NULL AND v_product.concrete_volume_m3 > 0 THEN
        v_quantidade := v_item.quantity_per_m3 * v_product.concrete_volume_m3;
      END IF;

      -- Calcular custo do item
      v_custo_item := 0;
      IF v_item.unit_cost IS NOT NULL AND v_item.unit_cost > 0 THEN
        v_custo_item := v_quantidade * v_item.unit_cost;
      ELSIF v_item.cost_per_meter IS NOT NULL AND v_item.cost_per_meter > 0 AND v_item.unit_length_meters > 0 THEN
        -- Para materiais com custo por metro (como ferros)
        v_custo_item := (v_quantidade / v_item.unit_length_meters) * v_item.cost_per_meter;
      END IF;

      -- Adicionar ao array de consumo
      v_consumo := v_consumo || jsonb_build_object(
        'material_id', v_item.material_id,
        'material_name', v_item.material_name,
        'quantity', ROUND(v_quantidade, 4),
        'unit', v_item.unit,
        'unit_cost', COALESCE(v_item.unit_cost, 0),
        'total_cost', ROUND(v_custo_item, 2)
      );

      v_custo_total := v_custo_total + v_custo_item;
    END LOOP;

    -- Adicionar consumo de armaduras (longitudinal)
    FOR v_item IN
      SELECT 
        pr.material_id,
        pr.quantity,
        m.name as material_name,
        m.unit,
        m.unit_cost,
        COALESCE(m.cost_per_meter, 0) as cost_per_meter,
        COALESCE(m.unit_length_meters, 0) as unit_length_meters
      FROM product_reinforcements pr
      JOIN materials m ON m.id = pr.material_id
      WHERE pr.product_id = p_product_id
        AND pr.reinforcement_type = 'longitudinal'
    LOOP
      v_quantidade := v_item.quantity;
      
      v_custo_item := 0;
      IF v_item.cost_per_meter IS NOT NULL AND v_item.cost_per_meter > 0 THEN
        v_custo_item := v_quantidade * v_item.cost_per_meter;
      ELSIF v_item.unit_cost IS NOT NULL AND v_item.unit_cost > 0 AND v_item.unit_length_meters > 0 THEN
        v_custo_item := (v_quantidade / v_item.unit_length_meters) * v_item.unit_cost;
      END IF;

      v_consumo := v_consumo || jsonb_build_object(
        'material_id', v_item.material_id,
        'material_name', v_item.material_name || ' (Armadura Long.)',
        'quantity', ROUND(v_quantidade, 4),
        'unit', v_item.unit,
        'unit_cost', COALESCE(v_item.unit_cost, 0),
        'total_cost', ROUND(v_custo_item, 2)
      );

      v_custo_total := v_custo_total + v_custo_item;
    END LOOP;

    -- Adicionar consumo de estribos
    FOR v_item IN
      SELECT 
        pr.material_id,
        pr.quantity,
        m.name as material_name,
        m.unit,
        m.unit_cost,
        COALESCE(m.cost_per_meter, 0) as cost_per_meter,
        COALESCE(m.unit_length_meters, 0) as unit_length_meters
      FROM product_reinforcements pr
      JOIN materials m ON m.id = pr.material_id
      WHERE pr.product_id = p_product_id
        AND pr.reinforcement_type = 'stirrup'
    LOOP
      v_quantidade := v_item.quantity;
      
      v_custo_item := 0;
      IF v_item.cost_per_meter IS NOT NULL AND v_item.cost_per_meter > 0 THEN
        v_custo_item := v_quantidade * v_item.cost_per_meter;
      ELSIF v_item.unit_cost IS NOT NULL AND v_item.unit_cost > 0 AND v_item.unit_length_meters > 0 THEN
        v_custo_item := (v_quantidade / v_item.unit_length_meters) * v_item.unit_cost;
      END IF;

      v_consumo := v_consumo || jsonb_build_object(
        'material_id', v_item.material_id,
        'material_name', v_item.material_name || ' (Estribo)',
        'quantity', ROUND(v_quantidade, 4),
        'unit', v_item.unit,
        'unit_cost', COALESCE(v_item.unit_cost, 0),
        'total_cost', ROUND(v_custo_item, 2)
      );

      v_custo_total := v_custo_total + v_custo_item;
    END LOOP;

    -- Adicionar acessórios
    FOR v_item IN
      SELECT 
        pa.material_id,
        pa.quantity,
        m.name as material_name,
        m.unit,
        m.unit_cost
      FROM product_accessories pa
      JOIN materials m ON m.id = pa.material_id
      WHERE pa.product_id = p_product_id
    LOOP
      v_quantidade := v_item.quantity;
      v_custo_item := v_quantidade * COALESCE(v_item.unit_cost, 0);

      v_consumo := v_consumo || jsonb_build_object(
        'material_id', v_item.material_id,
        'material_name', v_item.material_name || ' (Acessório)',
        'quantity', ROUND(v_quantidade, 4),
        'unit', v_item.unit,
        'unit_cost', COALESCE(v_item.unit_cost, 0),
        'total_cost', ROUND(v_custo_item, 2)
      );

      v_custo_total := v_custo_total + v_custo_item;
    END LOOP;

  END IF;

  -- Atualizar produto com os custos calculados
  UPDATE products 
  SET 
    custo_unitario_materiais = ROUND(v_custo_total, 2),
    custo_total_materiais = ROUND(v_custo_total, 2),
    consumo_insumos = v_consumo,
    material_cost = ROUND(v_custo_total, 2)
  WHERE id = p_product_id;

  RAISE NOTICE 'Custo calculado para produto %: R$ %', p_product_id, v_custo_total;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erro ao calcular custo do produto %: %', p_product_id, SQLERRM;
END;
$$;

-- =============================================================================
-- TRIGGER: Recalcular custos quando produto é atualizado
-- =============================================================================

CREATE OR REPLACE FUNCTION recalculate_product_costs_on_product_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- Recalcular se houve mudança em campos relevantes
  IF (TG_OP = 'INSERT') OR 
     (OLD.recipe_id IS DISTINCT FROM NEW.recipe_id) OR
     (OLD.concrete_volume_m3 IS DISTINCT FROM NEW.concrete_volume_m3) OR
     (OLD.peso_artefato IS DISTINCT FROM NEW.peso_artefato) OR
     (OLD.total_weight IS DISTINCT FROM NEW.total_weight) THEN
    
    -- Executar recálculo após o commit
    PERFORM calculate_product_material_cost(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_recalculate_product_costs ON products;

-- Criar novo trigger
CREATE TRIGGER trigger_recalculate_product_costs
  AFTER INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_product_costs_on_product_update();

-- =============================================================================
-- TRIGGER: Recalcular custos quando preço de insumo é atualizado
-- =============================================================================

CREATE OR REPLACE FUNCTION recalculate_product_costs_on_material_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_product_id uuid;
BEGIN
  -- Verificar se houve mudança no custo do material
  IF (TG_OP = 'UPDATE') AND 
     (OLD.unit_cost IS DISTINCT FROM NEW.unit_cost OR 
      OLD.cost_per_meter IS DISTINCT FROM NEW.cost_per_meter) THEN
    
    -- Encontrar todos os produtos que usam este material
    -- Via recipe_items
    FOR v_product_id IN
      SELECT DISTINCT p.id
      FROM products p
      JOIN recipe_items ri ON ri.recipe_id = p.recipe_id
      WHERE ri.material_id = NEW.id
    LOOP
      PERFORM calculate_product_material_cost(v_product_id);
    END LOOP;

    -- Via product_reinforcements
    FOR v_product_id IN
      SELECT DISTINCT product_id
      FROM product_reinforcements
      WHERE material_id = NEW.id
    LOOP
      PERFORM calculate_product_material_cost(v_product_id);
    END LOOP;

    -- Via product_accessories
    FOR v_product_id IN
      SELECT DISTINCT product_id
      FROM product_accessories
      WHERE material_id = NEW.id
    LOOP
      PERFORM calculate_product_material_cost(v_product_id);
    END LOOP;

    -- Via consumo_insumos (para produtos que já foram calculados)
    FOR v_product_id IN
      SELECT DISTINCT id
      FROM products
      WHERE consumo_insumos::text LIKE '%' || NEW.id::text || '%'
    LOOP
      PERFORM calculate_product_material_cost(v_product_id);
    END LOOP;

    RAISE NOTICE 'Custos recalculados para produtos que usam material %', NEW.name;
  END IF;

  RETURN NEW;
END;
$$;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_recalculate_products_on_material_update ON materials;

-- Criar novo trigger
CREATE TRIGGER trigger_recalculate_products_on_material_update
  AFTER UPDATE ON materials
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_product_costs_on_material_update();

-- =============================================================================
-- TRIGGER: Recalcular quando armaduras/acessórios são alterados
-- =============================================================================

CREATE OR REPLACE FUNCTION recalculate_on_reinforcement_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM calculate_product_material_cost(OLD.product_id);
    RETURN OLD;
  ELSE
    PERFORM calculate_product_material_cost(NEW.product_id);
    RETURN NEW;
  END IF;
END;
$$;

-- Triggers para product_reinforcements
DROP TRIGGER IF EXISTS trigger_recalc_on_reinforcement_change ON product_reinforcements;
CREATE TRIGGER trigger_recalc_on_reinforcement_change
  AFTER INSERT OR UPDATE OR DELETE ON product_reinforcements
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_on_reinforcement_change();

-- Triggers para product_accessories
DROP TRIGGER IF EXISTS trigger_recalc_on_accessory_change ON product_accessories;
CREATE TRIGGER trigger_recalc_on_accessory_change
  AFTER INSERT OR UPDATE OR DELETE ON product_accessories
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_on_reinforcement_change();

-- =============================================================================
-- Recalcular custos de todos os produtos existentes
-- =============================================================================

DO $$
DECLARE
  v_product_id uuid;
  v_count integer := 0;
BEGIN
  RAISE NOTICE 'Iniciando recálculo de custos para todos os produtos...';
  
  FOR v_product_id IN
    SELECT id FROM products WHERE recipe_id IS NOT NULL
  LOOP
    BEGIN
      PERFORM calculate_product_material_cost(v_product_id);
      v_count := v_count + 1;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Erro ao recalcular produto %: %', v_product_id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Recálculo concluído para % produtos', v_count;
END;
$$;
