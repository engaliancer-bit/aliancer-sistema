/*
  # Sistema de Atualização Automática de Custos de Composições

  ## Descrição
  Implementa sistema automático para atualizar custos de composições quando:
  - Custo de um material é alterado (unit_cost ou resale_price)
  - Preço de um produto é alterado (final_sale_price)
  - Um item da composição é modificado

  ## Mudanças

  1. Função para recalcular custos de itens de composição baseado em materiais
  2. Função para recalcular custos de itens de composição baseado em produtos
  3. Função para recalcular total de uma composição
  4. Triggers para executar recálculos automaticamente

  ## Lógica de Custo

  - **Materiais de Revenda** (resale_enabled = true): Usa `resale_price` (com impostos)
  - **Materiais de Produção** (resale_enabled = false): Usa `unit_cost` (sem impostos)
  - **Produtos**: Usa `final_sale_price`

  ## Segurança
  - Funções executam com privilégios do criador (SECURITY DEFINER)
  - Validações para evitar loops infinitos
*/

-- Função para recalcular o total de uma composição
CREATE OR REPLACE FUNCTION recalculate_composition_total(composition_id_param uuid)
RETURNS void AS $$
BEGIN
  UPDATE compositions
  SET total_cost = (
    SELECT COALESCE(SUM(total_cost), 0)
    FROM composition_items
    WHERE composition_id = composition_id_param
  )
  WHERE id = composition_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para atualizar custos de itens quando material é alterado
CREATE OR REPLACE FUNCTION update_composition_items_on_material_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualiza todos os itens que usam esse material
  UPDATE composition_items ci
  SET 
    unit_cost = CASE 
      WHEN NEW.resale_enabled THEN NEW.resale_price 
      ELSE NEW.unit_cost 
    END,
    total_cost = quantity * CASE 
      WHEN NEW.resale_enabled THEN NEW.resale_price 
      ELSE NEW.unit_cost 
    END
  WHERE ci.material_id = NEW.id;

  -- Recalcula o total de cada composição afetada
  PERFORM recalculate_composition_total(ci.composition_id)
  FROM composition_items ci
  WHERE ci.material_id = NEW.id
  GROUP BY ci.composition_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para atualizar custos de itens quando produto é alterado
CREATE OR REPLACE FUNCTION update_composition_items_on_product_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualiza todos os itens que usam esse produto
  UPDATE composition_items ci
  SET 
    unit_cost = NEW.final_sale_price,
    total_cost = quantity * NEW.final_sale_price
  WHERE ci.product_id = NEW.id;

  -- Recalcula o total de cada composição afetada
  PERFORM recalculate_composition_total(ci.composition_id)
  FROM composition_items ci
  WHERE ci.product_id = NEW.id
  GROUP BY ci.composition_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para recalcular composição quando item é inserido/atualizado/deletado
CREATE OR REPLACE FUNCTION update_composition_on_item_change()
RETURNS TRIGGER AS $$
DECLARE
  comp_id uuid;
BEGIN
  -- Determina qual composição precisa ser recalculada
  IF TG_OP = 'DELETE' THEN
    comp_id := OLD.composition_id;
  ELSE
    comp_id := NEW.composition_id;
  END IF;

  -- Recalcula o total da composição
  PERFORM recalculate_composition_total(comp_id);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop triggers existentes se houver
DROP TRIGGER IF EXISTS trigger_update_composition_items_material ON materials;
DROP TRIGGER IF EXISTS trigger_update_composition_items_product ON products;
DROP TRIGGER IF EXISTS trigger_update_composition_total ON composition_items;

-- Trigger para atualizar itens quando material muda
CREATE TRIGGER trigger_update_composition_items_material
  AFTER UPDATE OF unit_cost, resale_price, resale_enabled ON materials
  FOR EACH ROW
  WHEN (
    OLD.unit_cost IS DISTINCT FROM NEW.unit_cost OR 
    OLD.resale_price IS DISTINCT FROM NEW.resale_price OR
    OLD.resale_enabled IS DISTINCT FROM NEW.resale_enabled
  )
  EXECUTE FUNCTION update_composition_items_on_material_change();

-- Trigger para atualizar itens quando produto muda
CREATE TRIGGER trigger_update_composition_items_product
  AFTER UPDATE OF final_sale_price ON products
  FOR EACH ROW
  WHEN (OLD.final_sale_price IS DISTINCT FROM NEW.final_sale_price)
  EXECUTE FUNCTION update_composition_items_on_product_change();

-- Trigger para atualizar composição quando item muda
CREATE TRIGGER trigger_update_composition_total
  AFTER INSERT OR UPDATE OR DELETE ON composition_items
  FOR EACH ROW
  EXECUTE FUNCTION update_composition_on_item_change();

-- Comentários
COMMENT ON FUNCTION recalculate_composition_total IS 
'Recalcula o custo total de uma composição somando todos os seus itens';

COMMENT ON FUNCTION update_composition_items_on_material_change IS 
'Atualiza automaticamente os custos dos itens de composição quando um material tem seu custo alterado';

COMMENT ON FUNCTION update_composition_items_on_product_change IS 
'Atualiza automaticamente os custos dos itens de composição quando um produto tem seu preço alterado';

COMMENT ON FUNCTION update_composition_on_item_change IS 
'Atualiza automaticamente o custo total de uma composição quando seus itens são modificados';
