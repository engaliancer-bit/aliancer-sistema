/*
  # Corrigir Cálculo de Consumo de Materiais
  
  1. Problema Identificado
    - A função process_material_consumption estava calculando:
      quantidade_receita × quantidade_produzida
    - Mas faltava multiplicar pelo volume do produto (concrete_volume_m3)
    - Exemplo: 750 kg/m³ × 55 postes = 41.250 kg ❌
    - Correto: 750 kg/m³ × 0,02 m³ × 55 postes = 825 kg ✓
  
  2. Alterações
    - Corrigir função process_material_consumption incluindo concrete_volume_m3
    - Limpar movimentações incorretas de hoje (reprocessadas)
    - Reprocessar produções de hoje com cálculo correto
  
  3. Segurança
    - Remove apenas movimentações com notes contendo "Consumo reprocessado"
    - Mantém todas as outras movimentações intactas
*/

-- 1. CORRIGIR A FUNÇÃO DE PROCESSAMENTO
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

-- 2. LIMPAR MOVIMENTAÇÕES INCORRETAS DE HOJE (reprocessadas)
DELETE FROM material_movements
WHERE movement_date = CURRENT_DATE
  AND notes LIKE 'Consumo reprocessado%'
  AND movement_type = 'saida'
  AND production_id IS NOT NULL;

-- 3. REPROCESSAR PRODUÇÕES DE HOJE COM CÁLCULO CORRETO
DO $$
DECLARE
  v_production RECORD;
  v_recipe_item RECORD;
  v_consumed_quantity numeric;
  v_existing_movement_id uuid;
  v_processed_count integer := 0;
BEGIN
  -- Para cada produção de hoje que tem receita
  FOR v_production IN
    SELECT 
      p.id, 
      p.product_id, 
      p.quantity, 
      p.production_date, 
      pr.recipe_id, 
      pr.name as product_name,
      pr.concrete_volume_m3
    FROM production p
    JOIN products pr ON pr.id = p.product_id
    WHERE p.production_date = CURRENT_DATE
      AND pr.recipe_id IS NOT NULL
      AND pr.concrete_volume_m3 IS NOT NULL
      AND pr.concrete_volume_m3 > 0
    ORDER BY p.production_date DESC
  LOOP
    -- Processa cada insumo da receita
    FOR v_recipe_item IN
      SELECT material_id, quantity
      FROM recipe_items
      WHERE recipe_id = v_production.recipe_id
    LOOP
      -- CÁLCULO CORRETO: quantidade_por_m3 × volume_produto × quantidade_produzida
      v_consumed_quantity := v_recipe_item.quantity * v_production.concrete_volume_m3 * v_production.quantity;
      
      -- Verifica se já existe movimentação
      SELECT id INTO v_existing_movement_id
      FROM material_movements
      WHERE production_id = v_production.id
        AND material_id = v_recipe_item.material_id
        AND movement_type = 'saida'
      LIMIT 1;
      
      -- Se não existe, cria
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
          v_production.production_date,
          v_production.id,
          'Consumo reprocessado - ' || v_production.product_name || ': ' || v_production.quantity::text || ' unidades'
        );
        v_processed_count := v_processed_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Reprocessamento concluído: % movimentações de insumos criadas com cálculo correto', v_processed_count;
END $$;
