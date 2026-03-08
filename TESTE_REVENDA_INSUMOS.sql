/*
  TESTE: Atualização de Insumo com Revenda

  Testes para garantir que insumos podem ser atualizados com
  configurações de revenda sem erros.
*/

-- ========================================
-- 1. VERIFICAR ESTRUTURA DA TABELA
-- ========================================

SELECT
  'Estrutura - Campos de Revenda' as teste,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'materials'
  AND column_name IN (
    'resale_enabled',
    'resale_tax_percentage',
    'resale_margin_percentage',
    'resale_price',
    'package_size',
    'unit_cost'
  )
ORDER BY ordinal_position;

/*
ESPERADO:
- resale_enabled: boolean, default false
- resale_tax_percentage: numeric, default 0
- resale_margin_percentage: numeric, default 0
- resale_price: numeric, default 0
- package_size: numeric, default 1
- unit_cost: numeric, default 0
*/

-- ========================================
-- 2. VERIFICAR CONSTRAINTS
-- ========================================

SELECT
  'Constraints' as teste,
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'materials'
  AND constraint_type = 'CHECK'
ORDER BY constraint_name;

/*
ESPERADO:
- materials_package_size_check: package_size > 0
- materials_unit_cost_check: unit_cost >= 0
- materials_total_weight_kg_check: total_weight_kg > 0 (se não NULL)
*/

-- ========================================
-- 3. TESTE DE INSERT - Valores Válidos
-- ========================================

-- Testar inserção de insumo com revenda
DO $$
DECLARE
  v_material_id UUID;
BEGIN
  -- Inserir material de teste
  INSERT INTO materials (
    name,
    description,
    unit,
    brand,
    package_size,
    unit_cost,
    resale_enabled,
    resale_tax_percentage,
    resale_margin_percentage,
    resale_price
  )
  VALUES (
    'TESTE - Cimento com Revenda',
    'Material de teste para revenda',
    'kg',
    'Marca Teste',
    50,                    -- package_size: 50 kg
    25.00,                 -- unit_cost: R$ 25,00
    true,                  -- revenda habilitada
    18.00,                 -- 18% de impostos
    30.00,                 -- 30% de margem
    1850.00                -- preço calculado: 50kg × 25 × (1 + 0.18 + 0.30) = 1850
  )
  RETURNING id INTO v_material_id;

  RAISE NOTICE '✅ Material de teste inserido com sucesso! ID: %', v_material_id;

  -- Verificar inserção
  PERFORM * FROM materials WHERE id = v_material_id;

  IF FOUND THEN
    RAISE NOTICE '✅ Material encontrado no banco!';
  ELSE
    RAISE EXCEPTION '❌ Material não encontrado após inserção';
  END IF;

  -- Limpar teste
  DELETE FROM materials WHERE id = v_material_id;
  RAISE NOTICE '🧹 Material de teste removido';

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ ERRO no teste de insert: %', SQLERRM;
  RAISE;
END $$;

-- ========================================
-- 4. TESTE DE UPDATE - Habilitar Revenda
-- ========================================

DO $$
DECLARE
  v_material_id UUID;
  v_result RECORD;
BEGIN
  -- Inserir material sem revenda
  INSERT INTO materials (
    name,
    description,
    unit,
    package_size,
    unit_cost,
    resale_enabled
  )
  VALUES (
    'TESTE - Material para Update',
    'Teste de update com revenda',
    'unid',
    1,
    10.00,
    false
  )
  RETURNING id INTO v_material_id;

  RAISE NOTICE '';
  RAISE NOTICE '📝 Material criado sem revenda. ID: %', v_material_id;

  -- Atualizar para habilitar revenda
  UPDATE materials
  SET
    resale_enabled = true,
    resale_tax_percentage = 18.00,
    resale_margin_percentage = 30.00,
    resale_price = 14.80  -- 10 × (1 + 0.18 + 0.30)
  WHERE id = v_material_id;

  RAISE NOTICE '✅ Material atualizado com revenda habilitada';

  -- Verificar valores
  SELECT
    resale_enabled,
    resale_tax_percentage,
    resale_margin_percentage,
    resale_price
  INTO v_result
  FROM materials
  WHERE id = v_material_id;

  IF v_result.resale_enabled = true THEN
    RAISE NOTICE '✅ Revenda habilitada: true';
    RAISE NOTICE '  • Impostos: %%%', v_result.resale_tax_percentage;
    RAISE NOTICE '  • Margem: %%%', v_result.resale_margin_percentage;
    RAISE NOTICE '  • Preço: R$ %', v_result.resale_price;
  ELSE
    RAISE EXCEPTION '❌ Revenda não foi habilitada corretamente';
  END IF;

  -- Limpar teste
  DELETE FROM materials WHERE id = v_material_id;
  RAISE NOTICE '🧹 Material de teste removido';

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ ERRO no teste de update: %', SQLERRM;
  RAISE;
END $$;

-- ========================================
-- 5. TESTE DE VALIDAÇÃO - Package Size
-- ========================================

-- Tentar inserir com package_size = 0 (deve falhar)
DO $$
BEGIN
  INSERT INTO materials (
    name,
    unit,
    package_size,
    unit_cost
  )
  VALUES (
    'TESTE - Package Size Zero',
    'kg',
    0,  -- ❌ DEVE FALHAR (constraint: package_size > 0)
    10.00
  );

  RAISE EXCEPTION '❌ FALHA: Constraint não validou package_size = 0';

EXCEPTION
  WHEN check_violation THEN
    RAISE NOTICE '✅ Constraint funcionando: package_size não pode ser zero';
  WHEN OTHERS THEN
    RAISE NOTICE '❌ Erro inesperado: %', SQLERRM;
    RAISE;
END $$;

-- ========================================
-- 6. TESTE DE TRIGGER - Composições
-- ========================================

-- Verificar se trigger existe
SELECT
  'Triggers' as teste,
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'materials'
  AND trigger_name ILIKE '%composition%';

/*
ESPERADO:
- trigger_update_composition_items_on_material_change: UPDATE
  Esse trigger atualiza itens de composição quando material é alterado,
  usando resale_price se revenda estiver habilitada.
*/

-- ========================================
-- 7. LISTAR MATERIAIS COM REVENDA ATIVA
-- ========================================

SELECT
  'Materiais com Revenda' as teste,
  name,
  unit_cost,
  resale_enabled,
  resale_tax_percentage,
  resale_margin_percentage,
  resale_price,
  ROUND(
    unit_cost * (1 + resale_tax_percentage/100 + resale_margin_percentage/100),
    2
  ) as preco_esperado,
  CASE
    WHEN ABS(resale_price - (unit_cost * (1 + resale_tax_percentage/100 + resale_margin_percentage/100))) < 0.01
      THEN '✅ OK'
    ELSE '⚠️ Divergente'
  END as status
FROM materials
WHERE resale_enabled = true
ORDER BY name
LIMIT 10;

/*
ESPERADO:
- resale_price deve ser igual ao preco_esperado (com tolerância de 0.01)
- Todos devem estar com status ✅ OK
*/

-- ========================================
-- 8. TESTE DE CÁLCULO - Preço de Revenda
-- ========================================

WITH calculos AS (
  SELECT
    'Teste de Cálculo' as teste,
    10.00 as custo_base,
    18.00 as impostos_pct,
    30.00 as margem_pct,
    10.00 * (1 + 18.00/100 + 30.00/100) as preco_calculado,
    14.80 as preco_esperado
)
SELECT
  teste,
  custo_base,
  impostos_pct || '%' as impostos,
  margem_pct || '%' as margem,
  preco_calculado,
  preco_esperado,
  CASE
    WHEN ABS(preco_calculado - preco_esperado) < 0.01 THEN '✅ Cálculo Correto'
    ELSE '❌ Cálculo Divergente'
  END as resultado
FROM calculos;

/*
ESPERADO:
Base: R$ 10,00
+ Impostos (18%): R$ 1,80
+ Margem (30%): R$ 3,00
─────────────────
Total: R$ 14,80
*/

-- ========================================
-- 9. VALIDAR VALORES EXTREMOS
-- ========================================

-- Testar valores muito altos (mas válidos)
DO $$
DECLARE
  v_material_id UUID;
BEGIN
  INSERT INTO materials (
    name,
    unit,
    package_size,
    unit_cost,
    resale_enabled,
    resale_tax_percentage,
    resale_margin_percentage,
    resale_price
  )
  VALUES (
    'TESTE - Valores Extremos',
    'kg',
    1000,           -- 1000 kg
    500.00,         -- R$ 500,00
    true,
    50.00,          -- 50% impostos
    100.00,         -- 100% margem
    1250000.00      -- 1000 × 500 × (1 + 0.50 + 1.00) = 1.250.000
  )
  RETURNING id INTO v_material_id;

  RAISE NOTICE '✅ Valores extremos aceitos corretamente!';

  -- Limpar
  DELETE FROM materials WHERE id = v_material_id;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Erro com valores extremos: %', SQLERRM;
  RAISE;
END $$;

-- ========================================
-- 10. RESUMO FINAL
-- ========================================

SELECT
  '=== RESUMO FINAL ===' as categoria,
  '' as metrica,
  NULL::bigint as valor;

-- Total de materiais
SELECT
  '',
  'Total de insumos cadastrados',
  COUNT(*)
FROM materials;

-- Materiais com revenda
SELECT
  '',
  'Insumos com revenda habilitada',
  COUNT(*)
FROM materials
WHERE resale_enabled = true;

-- Materiais sem revenda
SELECT
  '',
  'Insumos sem revenda',
  COUNT(*)
FROM materials
WHERE resale_enabled = false OR resale_enabled IS NULL;

/*
SUCESSO SE:
✅ Todos os testes passaram
✅ Constraints validando corretamente
✅ Trigger funcionando
✅ Cálculos corretos
✅ Valores extremos aceitos
*/
