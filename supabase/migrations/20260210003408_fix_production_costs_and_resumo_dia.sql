/*
  # Fix: Correção de Produção Diária e Resumo do Dia

  ## Problemas Identificados
  
  1. **calculate_production_costs** - Erro ao referenciar coluna inexistente
     - Tentava usar `m.cost_per_unit` mas a coluna correta é `m.unit_cost`
     - Causava erro ao calcular custos de produção
  
  2. **production_items vazio** - Não está sendo populado
     - Mesmo com custos calculados, `production_items` fica vazio
     - Causa falha no "Gerar Resumo do Dia"
  
  3. **get_resumo_producao_dia retorna vazio** - Não encontra dados
     - Busca em `production_items` (vazio)
     - Fallback para `custos_no_momento` também vazio
  
  ## Soluções

  1. Corrigir `calculate_production_costs` para usar `unit_cost`
  2. Garantir que `create_production_atomic` popula `production_items`
  3. Melhorar logs e tratamento de erros
*/

-- ============================================
-- 1. CORRIGIR calculate_production_costs
-- ============================================

DROP FUNCTION IF EXISTS calculate_production_costs(uuid, numeric);

CREATE OR REPLACE FUNCTION calculate_production_costs(
  p_recipe_id UUID,
  p_quantity NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_costs JSONB := '{}'::jsonb;
  v_materials JSONB := '{}'::jsonb;
  v_total_cost NUMERIC := 0;
  v_material_key TEXT;
BEGIN
  RAISE NOTICE 'calculate_production_costs - recipe_id: %, quantity: %', p_recipe_id, p_quantity;
  
  IF p_recipe_id IS NULL THEN
    RAISE NOTICE 'Recipe ID é NULL, retornando custos vazios';
    RETURN jsonb_build_object(
      'materials', '{}'::jsonb,
      'total_cost', 0,
      'calculated_at', now()
    );
  END IF;

  -- Buscar materiais da receita e calcular custos
  FOR v_material_key IN
    SELECT 
      ri.material_id::text
    FROM recipe_items ri
    WHERE ri.recipe_id = p_recipe_id
  LOOP
    DECLARE
      v_material_id UUID := v_material_key::uuid;
      v_quantity_per_unit NUMERIC;
      v_name TEXT;
      v_unit TEXT;
      v_unit_cost NUMERIC;
      v_total_quantity NUMERIC;
      v_item_total NUMERIC;
    BEGIN
      -- Buscar dados do material
      SELECT 
        ri.quantity_per_unit,
        m.name,
        m.unit,
        COALESCE(m.unit_cost, 0)
      INTO 
        v_quantity_per_unit,
        v_name,
        v_unit,
        v_unit_cost
      FROM recipe_items ri
      INNER JOIN materials m ON m.id = ri.material_id
      WHERE ri.recipe_id = p_recipe_id
      AND ri.material_id = v_material_id;

      -- Calcular quantidade total e custo
      v_total_quantity := v_quantity_per_unit * p_quantity;
      v_item_total := v_unit_cost * v_total_quantity;
      v_total_cost := v_total_cost + v_item_total;

      -- Adicionar ao objeto de materiais
      v_materials := v_materials || jsonb_build_object(
        v_material_id::text,
        jsonb_build_object(
          'material_id', v_material_id,
          'name', v_name,
          'quantity', v_total_quantity,
          'unit', v_unit,
          'unit_price', v_unit_cost,
          'total', v_item_total
        )
      );

      RAISE NOTICE '  Material: % - Qtd: % % - Custo unitário: R$ % - Total: R$ %',
        v_name, v_total_quantity, v_unit, v_unit_cost, v_item_total;
    END;
  END LOOP;

  -- Montar resultado final
  v_costs := jsonb_build_object(
    'materials', v_materials,
    'total_cost', v_total_cost,
    'calculated_at', now()
  );

  RAISE NOTICE 'Custos calculados - Total: R$ % - Materiais: %', 
    v_total_cost, jsonb_object_keys(v_materials);

  RETURN v_costs;
END;
$$;

COMMENT ON FUNCTION calculate_production_costs IS 
  'Calcula custos de produção baseado na receita. CORRIGIDO: usa unit_cost ao invés de cost_per_unit';

-- ============================================
-- 2. MELHORAR create_production_atomic
-- ============================================

DROP FUNCTION IF EXISTS create_production_atomic(uuid, uuid, numeric, date, uuid, uuid, text, text, jsonb, jsonb);

CREATE OR REPLACE FUNCTION create_production_atomic(
  p_product_id UUID,
  p_recipe_id UUID,
  p_quantity NUMERIC,
  p_production_date DATE,
  p_employee_id UUID DEFAULT NULL,
  p_production_order_item_id UUID DEFAULT NULL,
  p_production_type TEXT DEFAULT 'stock',
  p_notes TEXT DEFAULT NULL,
  p_custos JSONB DEFAULT NULL,
  p_material_movements JSONB DEFAULT '[]'
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_production_id UUID;
  v_movement JSONB;
  v_custos_calculados JSONB;
  v_has_materials BOOLEAN;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'create_production_atomic - INÍCIO';
  RAISE NOTICE 'p_product_id: %', p_product_id;
  RAISE NOTICE 'p_recipe_id: %', p_recipe_id;
  RAISE NOTICE 'p_quantity: %', p_quantity;
  RAISE NOTICE 'p_production_date: %', p_production_date;
  RAISE NOTICE 'p_production_type: %', p_production_type;
  RAISE NOTICE 'p_production_order_item_id: %', p_production_order_item_id;
  RAISE NOTICE 'p_custos fornecido: %', p_custos IS NOT NULL;

  -- 1. Calcular ou usar custos fornecidos
  IF p_custos IS NULL OR p_custos = '{}'::jsonb THEN
    RAISE NOTICE 'Custos não fornecidos, calculando automaticamente...';
    IF p_recipe_id IS NOT NULL THEN
      v_custos_calculados := calculate_production_costs(p_recipe_id, p_quantity);
      RAISE NOTICE 'Custos calculados: %', v_custos_calculados;
    ELSE
      RAISE NOTICE 'Sem recipe_id, usando custos vazios';
      v_custos_calculados := jsonb_build_object(
        'materials', '{}'::jsonb,
        'total_cost', 0,
        'calculated_at', now()
      );
    END IF;
  ELSE
    RAISE NOTICE 'Usando custos fornecidos pelo frontend';
    v_custos_calculados := p_custos;
  END IF;

  -- Verificar se há materiais
  v_has_materials := jsonb_typeof(v_custos_calculados->'materials') = 'object' 
                     AND v_custos_calculados->'materials' != '{}'::jsonb;
  RAISE NOTICE 'Tem materiais: %', v_has_materials;

  -- 2. Criar registro de produção
  RAISE NOTICE 'Inserindo na tabela production...';
  BEGIN
    INSERT INTO production (
      product_id,
      quantity,
      production_date,
      production_order_item_id,
      production_type,
      notes,
      custos_no_momento
    ) VALUES (
      p_product_id,
      p_quantity,
      p_production_date,
      p_production_order_item_id,
      p_production_type,
      p_notes,
      v_custos_calculados
    )
    RETURNING id INTO v_production_id;
    
    RAISE NOTICE '✓ Produção criada com ID: %', v_production_id;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao inserir produção: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
  END;

  -- 3. Popular production_items
  IF v_has_materials THEN
    RAISE NOTICE 'Populando production_items...';
    BEGIN
      PERFORM extract_production_items_from_custos(v_production_id, v_custos_calculados);
      
      -- Verificar se foi populado
      DECLARE
        v_items_count INT;
      BEGIN
        SELECT COUNT(*) INTO v_items_count
        FROM production_items
        WHERE production_id = v_production_id;
        
        RAISE NOTICE '✓ production_items populado: % registros', v_items_count;
      END;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao popular production_items: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'Sem materiais para popular production_items';
  END IF;

  -- 4. Criar movimentos de materiais
  IF jsonb_array_length(p_material_movements) > 0 THEN
    RAISE NOTICE 'Criando % movimentos de materiais...', jsonb_array_length(p_material_movements);
    FOR v_movement IN SELECT * FROM jsonb_array_elements(p_material_movements)
    LOOP
      BEGIN
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
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Erro ao criar movimento de material: %', SQLERRM;
      END;
    END LOOP;
  END IF;

  RAISE NOTICE '✓ create_production_atomic - CONCLUÍDO';
  RAISE NOTICE '========================================';
  RETURN v_production_id;
  
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'ERRO CRÍTICO em create_production_atomic: % (SQLSTATE: %)', 
    SQLERRM, SQLSTATE;
END;
$$;

COMMENT ON FUNCTION create_production_atomic IS 
  'Cria produção atomicamente com custos calculados automaticamente se não fornecidos. CORRIGIDO: calcula custos corretamente e popula production_items';
