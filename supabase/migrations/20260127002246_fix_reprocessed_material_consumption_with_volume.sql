/*
  # Corrigir Consumo Reprocessado de Insumos - Incluir Volume Correto
  
  1. Problema Identificado
    - Migration 20260126234505 reprocessou últimos 30 dias SEM multiplicar pelo volume
    - Exemplo: 750 kg/m³ × 55 postes = 41.250 kg ❌
    - Correto: 750 kg/m³ × 0,02 m³ × 55 postes = 825 kg ✓
    - Isso criou estoques negativos absurdos:
      * Areia: -1.025.614 kg
      * Pedrisco: -1.496.128 kg
      * Cimento: -433.110 kg
  
  2. Solução
    - Deletar TODAS as movimentações com "Consumo reprocessado" dos últimos 30 dias
    - Reprocessar corretamente incluindo o volume do produto (concrete_volume_m3)
    - Manter movimentações de "Consumo automático" (novas produções após correção)
  
  3. Fórmula Correta
    - Consumo = quantidade_por_m³ × volume_produto_m³ × quantidade_produzida
*/

-- 1. DELETAR TODAS AS MOVIMENTAÇÕES REPROCESSADAS INCORRETAMENTE
DELETE FROM material_movements
WHERE notes LIKE 'Consumo reprocessado%'
  AND movement_type = 'saida'
  AND production_id IS NOT NULL
  AND movement_date >= CURRENT_DATE - INTERVAL '30 days';

-- 2. REPROCESSAR ÚLTIMOS 30 DIAS COM CÁLCULO CORRETO
DO $$
DECLARE
  v_production RECORD;
  v_recipe_item RECORD;
  v_consumed_quantity numeric;
  v_existing_movement_id uuid;
  v_processed_count integer := 0;
  v_skipped_no_volume integer := 0;
BEGIN
  -- Para cada produção dos últimos 30 dias que tem receita E volume
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
    WHERE p.production_date >= CURRENT_DATE - INTERVAL '30 days'
      AND pr.recipe_id IS NOT NULL
    ORDER BY p.production_date DESC
  LOOP
    -- Verifica se o produto tem volume definido
    IF v_production.concrete_volume_m3 IS NULL OR v_production.concrete_volume_m3 <= 0 THEN
      v_skipped_no_volume := v_skipped_no_volume + 1;
      CONTINUE;
    END IF;

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

  RAISE NOTICE 'Reprocessamento concluído:';
  RAISE NOTICE '- % movimentações de insumos criadas com cálculo correto', v_processed_count;
  RAISE NOTICE '- % produções sem volume definido (ignoradas)', v_skipped_no_volume;
END $$;
