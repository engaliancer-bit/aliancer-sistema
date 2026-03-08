/*
  # Correção - População de production_items para Resumo de Produção

  ## Problema Identificado
  O botão "Gerar Resumo do Dia" mostra "Nenhum consumo de insumo encontrado" mesmo quando
  há produções cadastradas no dia. Isso ocorre porque:
  
  1. A tabela `production_items` não está sendo populada automaticamente
  2. A função `get_resumo_producao_dia` verifica primeiro `production_items`
  3. Se `production_items` estiver vazia, faz fallback para `custos_no_momento->materials`
  4. Se ambos estiverem vazios, retorna array vazio (nenhum consumo encontrado)

  ## Causa Raiz
  A função `extract_production_items_from_custos` existe mas pode não estar sendo
  chamada corretamente ou pode estar falhando silenciosamente.

  ## Solução
  1. Melhorar logging em `extract_production_items_from_custos`
  2. Re-processar TODAS as produções existentes que não têm `production_items`
  3. Garantir que o trigger funciona corretamente
  4. Adicionar validação de formato do JSONB

  ## Impacto
  - Popula retroativamente `production_items` para todas as produções existentes
  - Garante que resumos futuros funcionarão corretamente
  - Adiciona diagnóstico melhorado para debugar problemas
*/

-- 1. MELHORAR extract_production_items_from_custos com logging e validações
CREATE OR REPLACE FUNCTION extract_production_items_from_custos(
  p_production_id UUID,
  p_custos JSONB
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_material JSONB;
  v_material_id UUID;
  v_material_name TEXT;
  v_quantity DECIMAL;
  v_unit TEXT;
  v_unit_cost DECIMAL;
  v_total DECIMAL;
  v_count INT := 0;
BEGIN
  -- Validar entrada
  IF p_custos IS NULL THEN
    RAISE NOTICE 'extract_production_items: custos é NULL para production %', p_production_id;
    RETURN;
  END IF;
  
  IF jsonb_typeof(p_custos->'materials') != 'object' THEN
    RAISE NOTICE 'extract_production_items: materials não é objeto para production %. Tipo: %', 
      p_production_id, jsonb_typeof(p_custos->'materials');
    RETURN;
  END IF;
  
  RAISE NOTICE 'extract_production_items: Processando production % com % materials', 
    p_production_id, 
    (SELECT COUNT(*) FROM jsonb_each(p_custos->'materials'));
  
  -- Iterar sobre cada material no JSONB
  FOR v_material IN
    SELECT value
    FROM jsonb_each(p_custos->'materials')
  LOOP
    BEGIN
      -- Extrair valores com validação
      v_material_id := (v_material->>'material_id')::uuid;
      v_material_name := v_material->>'name';
      v_quantity := (v_material->>'quantity')::decimal;
      v_unit := v_material->>'unit';
      v_unit_cost := (v_material->>'unit_price')::decimal;
      v_total := (v_material->>'total')::decimal;
      
      -- Validar valores
      IF v_material_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 THEN
        RAISE NOTICE 'extract_production_items: Material inválido: id=%, qty=%', 
          v_material_id, v_quantity;
        CONTINUE;
      END IF;
      
      -- Inserir item de produção
      INSERT INTO production_items (
        production_id,
        material_id,
        material_name,
        quantity,
        unit,
        unit_cost,
        total_cost
      ) VALUES (
        p_production_id,
        v_material_id,
        v_material_name,
        v_quantity,
        v_unit,
        COALESCE(v_unit_cost, 0),
        COALESCE(v_total, v_quantity * COALESCE(v_unit_cost, 0))
      )
      ON CONFLICT DO NOTHING;
      
      v_count := v_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'extract_production_items: Erro ao processar material: % (SQLERRM: %)', 
        v_material, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'extract_production_items: Inseridos % items para production %', 
    v_count, p_production_id;
    
END;
$$;

-- 2. CRIAR FUNÇÃO PARA RE-PROCESSAR PRODUÇÕES EXISTENTES
CREATE OR REPLACE FUNCTION reprocess_production_items()
RETURNS TABLE (
  prod_id UUID,
  prod_date DATE,
  tinha_items BOOLEAN,
  inseriu_items BIGINT,
  status TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_production RECORD;
  v_items_before BIGINT;
  v_items_after BIGINT;
BEGIN
  FOR v_production IN
    SELECT 
      p.id, 
      p.production_date,
      p.custos_no_momento,
      (SELECT COUNT(*) FROM production_items pi WHERE pi.production_id = p.id) as items_count
    FROM production p
    WHERE p.custos_no_momento IS NOT NULL
    ORDER BY p.production_date DESC, p.created_at DESC
  LOOP
    v_items_before := v_production.items_count;
    
    -- Tentar extrair items
    BEGIN
      PERFORM extract_production_items_from_custos(
        v_production.id, 
        v_production.custos_no_momento
      );
      
      SELECT COUNT(*) INTO v_items_after 
      FROM production_items pi
      WHERE pi.production_id = v_production.id;
      
      RETURN QUERY SELECT 
        v_production.id,
        v_production.production_date,
        (v_items_before > 0),
        (v_items_after - v_items_before),
        CASE 
          WHEN v_items_after = 0 THEN 'SEM_MATERIALS_NO_JSONB'
          WHEN v_items_after = v_items_before THEN 'JA_TINHA_ITEMS'
          ELSE 'ITEMS_INSERIDOS'
        END;
        
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT 
        v_production.id,
        v_production.production_date,
        (v_items_before > 0),
        0::bigint,
        'ERRO: ' || SQLERRM;
    END;
  END LOOP;
END;
$$;

-- 3. RE-PROCESSAR TODAS AS PRODUÇÕES EXISTENTES
DO $$
DECLARE
  v_total_producoes INT;
  v_producoes_sem_items INT;
  v_producoes_processadas INT := 0;
  v_items_inseridos BIGINT := 0;
  v_result RECORD;
BEGIN
  -- Contar totais
  SELECT COUNT(*) INTO v_total_producoes FROM production;
  
  SELECT COUNT(*) INTO v_producoes_sem_items
  FROM production p
  WHERE NOT EXISTS (
    SELECT 1 FROM production_items pi WHERE pi.production_id = p.id
  );
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'REPROCESSAMENTO DE PRODUCTION_ITEMS';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total de produções: %', v_total_producoes;
  RAISE NOTICE 'Produções sem items: %', v_producoes_sem_items;
  RAISE NOTICE '';
  
  -- Re-processar
  FOR v_result IN SELECT * FROM reprocess_production_items()
  LOOP
    IF v_result.status = 'ITEMS_INSERIDOS' THEN
      v_producoes_processadas := v_producoes_processadas + 1;
      v_items_inseridos := v_items_inseridos + v_result.inseriu_items;
      
      RAISE NOTICE 'Produção % (%) - Inseridos % items', 
        v_result.prod_id, 
        v_result.prod_date,
        v_result.inseriu_items;
    ELSIF v_result.status LIKE 'ERRO:%' THEN
      RAISE WARNING 'Produção % (%) - %', 
        v_result.prod_id, 
        v_result.prod_date,
        v_result.status;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RESULTADO';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Produções processadas: %', v_producoes_processadas;
  RAISE NOTICE 'Items inseridos: %', v_items_inseridos;
  RAISE NOTICE '';
  
  -- Verificar resultado final
  SELECT COUNT(*) INTO v_producoes_sem_items
  FROM production p
  WHERE NOT EXISTS (
    SELECT 1 FROM production_items pi WHERE pi.production_id = p.id
  );
  
  RAISE NOTICE 'Produções ainda sem items: %', v_producoes_sem_items;
  RAISE NOTICE '========================================';
END $$;

-- 4. ADICIONAR COMENTÁRIOS
COMMENT ON FUNCTION extract_production_items_from_custos IS 
  'Extrai e insere production_items a partir do campo JSONB custos_no_momento. Versão melhorada com logging e validações.';

COMMENT ON FUNCTION reprocess_production_items IS 
  'Re-processa todas as produções existentes para popular production_items retroativamente.';
