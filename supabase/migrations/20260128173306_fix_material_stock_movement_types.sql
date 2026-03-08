/*
  # Correção URGENTE: Tipos de Movimento Incorretos

  ## Problema CRÍTICO Identificado

  A função `get_material_available_stock()` está usando os valores ERRADOS
  para movement_type:

  ❌ ERRADO (o que a função estava usando):
  - movement_type = 'in'
  - movement_type = 'out'

  ✅ CORRETO (o que o sistema realmente usa):
  - movement_type = 'entrada'
  - movement_type = 'saida'

  **Resultado**: A função SEMPRE retornava 0 porque nunca encontrava
  movimentações com os valores 'in'/'out'.

  ## Solução

  Corrigir a função para usar 'entrada' e 'saida'.
*/

-- =====================================================
-- CORRIGIR FUNÇÃO COM TIPOS DE MOVIMENTO CORRETOS
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
    AND movement_type = 'entrada';  -- ✅ CORRIGIDO

  -- Calcular total de saídas
  SELECT COALESCE(SUM(quantity), 0)
  INTO v_total_out
  FROM material_movements
  WHERE material_id = p_material_id
    AND movement_type = 'saida';  -- ✅ CORRIGIDO

  -- Calcular disponível
  v_available := v_total_in - v_total_out;

  RETURN GREATEST(v_available, 0);
END;
$$;

COMMENT ON FUNCTION get_material_available_stock(uuid) IS
  'Calcula estoque disponível de um insumo (material).
   Fórmula: SUM(entradas) - SUM(saídas)
   Consulta a tabela material_movements.
   CORRIGIDO: Usa movement_type correto (entrada/saida ao invés de in/out).';

-- =====================================================
-- TESTAR A FUNÇÃO CORRIGIDA
-- =====================================================

DO $$
DECLARE
  v_material_id uuid := 'ee89487d-558c-405d-9273-73b8122f6522';
  v_available numeric;
BEGIN
  -- Testar função
  v_available := get_material_available_stock(v_material_id);

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE 'Teste da função get_material_available_stock()';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE 'Material: Areia industrial';
  RAISE NOTICE 'Estoque disponível: %t', v_available;

  IF v_available > 0 THEN
    RAISE NOTICE '✅ SUCESSO: Função retornou estoque correto!';
  ELSE
    RAISE WARNING '⚠️  Estoque ainda é zero. Verificar movimentações.';
  END IF;

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

-- =====================================================
-- REPROCESSAR ORÇAMENTO DA SIMONE NOVAMENTE
-- =====================================================

DO $$
DECLARE
  v_quote_id uuid := 'f90401f0-32f8-423b-878c-9075c98149c8';
  v_delivery_id uuid;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE 'Reprocessando orçamento da Simone Dill (TENTATIVA 2)';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';

  -- Resetar para pending
  UPDATE quotes 
  SET 
    awaiting_production = false,
    status = 'pending'
  WHERE id = v_quote_id;

  RAISE NOTICE '→ Orçamento resetado para PENDING';

  -- Aprovar novamente
  UPDATE quotes 
  SET status = 'approved'
  WHERE id = v_quote_id;

  RAISE NOTICE '→ Orçamento APROVADO - trigger executada';

  -- Verificar se entrega foi criada
  SELECT id INTO v_delivery_id
  FROM deliveries
  WHERE quote_id = v_quote_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_delivery_id IS NOT NULL THEN
    RAISE NOTICE '✅ SUCESSO: Entrega % criada!', v_delivery_id;
  ELSE
    RAISE WARNING '⚠️  Nenhuma entrega criada. Tentar criar manualmente...';

    -- Tentar criar manualmente
    v_delivery_id := create_delivery_from_quote(v_quote_id);

    IF v_delivery_id IS NOT NULL THEN
      RAISE NOTICE '✅ Entrega % criada manualmente!', v_delivery_id;
    ELSE
      RAISE WARNING '❌ Falha ao criar entrega. Verificar logs detalhados.';
    END IF;
  END IF;

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;
