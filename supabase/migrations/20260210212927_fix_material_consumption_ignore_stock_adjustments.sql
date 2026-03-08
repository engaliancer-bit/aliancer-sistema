/*
  # Corrigir Consumo de Insumos - Ignorar Ajustes de Estoque

  ## Problema
  Quando é feito um ajuste de estoque de produtos (entrada manual), o sistema cria
  uma movimentação de consumo de insumos como se fosse uma produção real.
  
  Isso distorce os dados de consumo de materiais, pois ajustes de estoque são
  correções administrativas e não produções reais que consomem insumos.

  ## Solução
  1. Adicionar tipo 'adjustment' (ajuste) ao campo production_type
  2. Modificar função process_material_consumption para ignorar ajustes
  3. Atualizar registros antigos que são ajustes (baseado nas notas)

  ## Mudanças
  - Adiciona constraint para permitir 'adjustment' em production_type
  - Modifica process_material_consumption() para retornar sem processar se for ajuste
  - Atualiza registros históricos de ajustes para o novo tipo
  - Remove movimentações indevidas criadas por ajustes
*/

-- 1. Remover constraint antigo
ALTER TABLE production DROP CONSTRAINT IF EXISTS production_type_check;

-- 2. Adicionar novo constraint permitindo 'adjustment'
ALTER TABLE production 
ADD CONSTRAINT production_type_check 
CHECK (production_type IN ('stock', 'order', 'adjustment'));

-- 3. Atualizar registros históricos que são ajustes de estoque
-- Identificados pela palavra "ajuste" nas notas
UPDATE production
SET production_type = 'adjustment'
WHERE production_type = 'stock'
AND (
  notes ILIKE '%ajuste de estoque%'
  OR notes ILIKE '%ajuste manual%'
  OR notes ILIKE '%ajuste (entrada)%'
);

-- 4. Modificar função para ignorar ajustes de estoque
CREATE OR REPLACE FUNCTION process_material_consumption()
RETURNS TRIGGER AS $$
DECLARE
  v_recipe_id uuid;
  v_concrete_volume numeric;
  v_recipe_item RECORD;
  v_consumed_quantity numeric;
  v_product_name text;
  v_existing_movement_id uuid;
BEGIN
  -- NOVO: Ignorar ajustes de estoque
  -- Ajustes não devem consumir insumos pois não são produções reais
  IF NEW.production_type = 'adjustment' THEN
    RETURN NEW;
  END IF;

  -- Busca a receita, volume e nome do produto
  SELECT recipe_id, concrete_volume_m3, name 
  INTO v_recipe_id, v_concrete_volume, v_product_name
  FROM products
  WHERE id = NEW.product_id;

  -- Processa INSUMOS BÁSICOS (receitas)
  IF v_recipe_id IS NOT NULL AND v_concrete_volume IS NOT NULL AND v_concrete_volume > 0 THEN
    FOR v_recipe_item IN 
      SELECT material_id, quantity
      FROM recipe_items
      WHERE recipe_id = v_recipe_id
    LOOP
      -- CÁLCULO CORRETO: quantidade_por_m3 × volume_produto × quantidade_produzida
      v_consumed_quantity := v_recipe_item.quantity * v_concrete_volume * NEW.quantity;

      -- Verifica se já existe movimentação para este material/produção
      SELECT id INTO v_existing_movement_id
      FROM material_movements
      WHERE production_id = NEW.id
        AND material_id = v_recipe_item.material_id
        AND movement_type = 'saida'
      LIMIT 1;

      -- Se não existe, cria a movimentação
      IF v_existing_movement_id IS NULL THEN
        INSERT INTO material_movements (
          material_id,
          quantity,
          movement_type,
          movement_date,
          production_id,
          notes
        ) VALUES (
          v_recipe_item.material_id,
          v_consumed_quantity,
          'saida',
          NEW.production_date,
          NEW.id,
          'Consumo automático - ' || v_product_name || ': ' || NEW.quantity::text || ' unidades'
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Deletar movimentações de insumos criadas por ajustes de estoque
-- Apenas para produções que agora são marcadas como 'adjustment'
DELETE FROM material_movements
WHERE production_id IN (
  SELECT id FROM production WHERE production_type = 'adjustment'
)
AND notes LIKE 'Consumo automático%';

-- Comentário explicativo
COMMENT ON COLUMN production.production_type IS 
'Tipo de produção: stock (estoque), order (ordem), adjustment (ajuste manual - não consome insumos)';
