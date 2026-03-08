/*
  # Reprocessar Consumo de Insumos Básicos (Receitas)
  
  1. Objetivo
    - Garantir que TODAS as produções descontam insumos básicos (areia, cimento, pedrisco, aditivo)
    - Reprocessar produções antigas que não geraram movimentações de insumos
    - Foco exclusivo em recipe_items (insumos básicos)
  
  2. Alterações
    - Recriar função process_material_consumption para processar receitas corretamente
    - Reprocessar produções existentes que não geraram movimentações de insumos
    - Garantir que o trigger está ativo
  
  3. Segurança
    - Evita duplicação verificando se já existe movimentação para aquele material/produção
    - Mantém histórico de movimentações existentes (especialmente ferragens)
*/

-- 1. RECRIAR A FUNÇÃO DE PROCESSAMENTO DE CONSUMO DE MATERIAIS (INSUMOS BÁSICOS)
CREATE OR REPLACE FUNCTION process_material_consumption()
RETURNS TRIGGER AS $$
DECLARE
  v_recipe_id uuid;
  v_recipe_item RECORD;
  v_consumed_quantity numeric;
  v_product_name text;
  v_existing_movement_id uuid;
BEGIN
  -- Busca a receita e nome do produto
  SELECT recipe_id, name INTO v_recipe_id, v_product_name
  FROM products
  WHERE id = NEW.product_id;

  -- Processa INSUMOS BÁSICOS (receitas - areia, cimento, pedrisco, aditivo, etc.)
  IF v_recipe_id IS NOT NULL THEN
    FOR v_recipe_item IN 
      SELECT material_id, quantity
      FROM recipe_items
      WHERE recipe_id = v_recipe_id
    LOOP
      -- Calcula quantidade consumida
      v_consumed_quantity := v_recipe_item.quantity * NEW.quantity;
      
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

-- 2. GARANTIR QUE O TRIGGER ESTÁ ATIVO
DROP TRIGGER IF EXISTS trigger_process_material_consumption ON production;

CREATE TRIGGER trigger_process_material_consumption
  AFTER INSERT ON production
  FOR EACH ROW
  EXECUTE FUNCTION process_material_consumption();

-- 3. REPROCESSAR PRODUÇÕES EXISTENTES (últimos 30 dias) - APENAS INSUMOS BÁSICOS
DO $$
DECLARE
  v_production RECORD;
  v_recipe_item RECORD;
  v_consumed_quantity numeric;
  v_existing_movement_id uuid;
  v_processed_count integer := 0;
BEGIN
  -- Para cada produção dos últimos 30 dias que tem receita
  FOR v_production IN
    SELECT p.id, p.product_id, p.quantity, p.production_date, pr.recipe_id, pr.name as product_name
    FROM production p
    JOIN products pr ON pr.id = p.product_id
    WHERE p.production_date >= CURRENT_DATE - INTERVAL '30 days'
      AND pr.recipe_id IS NOT NULL
    ORDER BY p.production_date DESC
  LOOP
    -- Processa cada insumo da receita
    FOR v_recipe_item IN
      SELECT material_id, quantity
      FROM recipe_items
      WHERE recipe_id = v_production.recipe_id
    LOOP
      v_consumed_quantity := v_recipe_item.quantity * v_production.quantity;
      
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

  RAISE NOTICE 'Reprocessamento concluído: % movimentações de insumos criadas', v_processed_count;
END $$;
