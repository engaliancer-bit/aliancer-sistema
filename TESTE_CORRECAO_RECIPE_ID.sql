-- ===================================================================
-- TESTE DA CORREÇÃO recipe_id NA TABELA production
-- ===================================================================

-- 1. VERIFICAR ESTRUTURA DA TABELA
-- Confirmar que recipe_id NÃO existe na tabela production
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'production'
ORDER BY ordinal_position;

-- Resultado esperado: NÃO deve aparecer coluna 'recipe_id'

-- ===================================================================

-- 2. VERIFICAR FUNÇÃO CORRIGIDA
-- Confirmar que a função não tenta inserir recipe_id
SELECT
  proname as function_name,
  pg_get_function_arguments(oid) as parameters,
  CASE
    WHEN pg_get_functiondef(oid) LIKE '%INSERT INTO production%recipe_id%'
    THEN '❌ ERRO: Ainda tem recipe_id no INSERT'
    ELSE '✅ OK: Função corrigida (sem recipe_id no INSERT)'
  END as status
FROM pg_proc
WHERE proname = 'create_production_atomic';

-- Resultado esperado: status = '✅ OK: Função corrigida'

-- ===================================================================

-- 3. TESTE SIMULADO (não executa, apenas visualiza)
-- Mostrar como seria a chamada da função

/*
-- CHAMADA DA FUNÇÃO (exemplo)
SELECT create_production_atomic(
  p_product_id := 'uuid-do-produto',
  p_recipe_id := 'uuid-do-recipe',     -- usado para calcular custos
  p_quantity := 10,
  p_production_date := CURRENT_DATE,
  p_production_type := 'stock',
  p_notes := 'Teste de produção',
  p_custos := '{"total_cost": 100}'::jsonb,
  p_material_movements := '[]'::jsonb
);

-- O recipe_id é usado internamente para calcular custos,
-- mas NÃO é inserido na tabela production
*/

-- ===================================================================

-- 4. VERIFICAR ÚLTIMAS PRODUÇÕES
-- Ver produções recentes e seus custos armazenados
SELECT
  p.id,
  p.product_id,
  prod.name as produto,
  p.quantity,
  p.production_date,
  p.production_type,
  -- Extrair info do recipe do JSONB custos_no_momento
  p.custos_no_momento->'recipe'->>'id' as recipe_id_from_custos,
  p.custos_no_momento->'recipe'->>'name' as recipe_name,
  p.custos_no_momento->>'total_material_cost' as custo_materiais,
  p.custos_no_momento->>'total_cost' as custo_total,
  p.created_at
FROM production p
LEFT JOIN products prod ON prod.id = p.product_id
ORDER BY p.created_at DESC
LIMIT 5;

-- Resultado esperado:
-- - NÃO deve ter coluna recipe_id direta
-- - Deve ter recipe_id_from_custos extraído do JSONB
-- - Deve ter recipe_name extraído do JSONB

-- ===================================================================

-- 5. VERIFICAR INTEGRIDADE DOS CUSTOS
-- Garantir que custos_no_momento está sendo populado
SELECT
  COUNT(*) as total_producoes,
  COUNT(CASE WHEN custos_no_momento IS NULL THEN 1 END) as sem_custos,
  COUNT(CASE WHEN custos_no_momento = '{}'::jsonb THEN 1 END) as custos_vazios,
  COUNT(CASE WHEN custos_no_momento->>'total_cost' IS NOT NULL THEN 1 END) as com_custo_total,
  COUNT(CASE WHEN custos_no_momento->'recipe' IS NOT NULL THEN 1 END) as com_info_recipe
FROM production
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';

-- Resultado esperado:
-- - sem_custos deve ser 0 (ou próximo de 0)
-- - com_custo_total deve ser próximo de total_producoes
-- - com_info_recipe deve ser > 0 para produções que usam recipe

-- ===================================================================

-- 6. VERIFICAR SE OUTRAS FUNÇÕES FORAM CORRIGIDAS
SELECT
  proname as function_name,
  CASE
    WHEN pg_get_functiondef(oid) LIKE '%INSERT INTO production%recipe_id%'
    THEN '❌ Tem recipe_id no INSERT'
    WHEN pg_get_functiondef(oid) LIKE '%INSERT INTO production%'
    THEN '✅ INSERT sem recipe_id'
    ELSE 'N/A'
  END as status
FROM pg_proc
WHERE proname IN (
  'create_production_atomic',
  'create_production_with_costs'
)
ORDER BY proname;

-- Resultado esperado: Ambas as funções com status '✅ INSERT sem recipe_id'

-- ===================================================================

-- 7. VERIFICAR LOGS DA FUNÇÃO
-- Habilitar visualização de NOTICE logs
SET client_min_messages = 'notice';

-- Agora ao chamar a função, você verá logs como:
/*
NOTICE:  create_production_atomic - Início
NOTICE:    p_product_id: uuid-xxx
NOTICE:    p_recipe_id: uuid-yyy
NOTICE:    p_quantity: 10
NOTICE:  Inserindo na tabela production...
NOTICE:  Produção criada com ID: uuid-zzz
NOTICE:  create_production_atomic - Concluído com sucesso
*/

-- ===================================================================

-- 8. TESTE DE CONSISTÊNCIA
-- Verificar se todas as produções têm product_id válido
SELECT
  COUNT(*) as total_producoes,
  COUNT(CASE WHEN product_id IS NULL THEN 1 END) as sem_produto,
  COUNT(CASE WHEN quantity <= 0 THEN 1 END) as quantidade_invalida,
  COUNT(CASE WHEN production_date IS NULL THEN 1 END) as sem_data
FROM production
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';

-- Resultado esperado: Todos os contadores de erros devem ser 0

-- ===================================================================

-- 9. EXEMPLO DE QUERY PARA BUSCAR RECIPE USADO
-- Como recuperar informações do recipe de uma produção específica
SELECT
  p.id,
  prod.name as produto,
  p.quantity,
  p.production_date,
  -- Extrair dados do recipe do JSONB
  p.custos_no_momento->'recipe' as recipe_info,
  jsonb_pretty(p.custos_no_momento->'recipe') as recipe_formatado,
  -- Materiais usados
  jsonb_pretty(p.custos_no_momento->'materials') as materiais_usados
FROM production p
LEFT JOIN products prod ON prod.id = p.product_id
WHERE p.created_at >= CURRENT_DATE - INTERVAL '1 day'
LIMIT 1;

-- ===================================================================

-- 10. VERIFICAÇÃO FINAL
-- Resumo do status da correção
SELECT
  'production table' as verificacao,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'production' AND column_name = 'recipe_id'
    )
    THEN '❌ ERRO: Coluna recipe_id ainda existe'
    ELSE '✅ OK: Coluna recipe_id não existe (correto)'
  END as status

UNION ALL

SELECT
  'create_production_atomic' as verificacao,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_proc
      WHERE proname = 'create_production_atomic'
      AND pg_get_functiondef(oid) LIKE '%INSERT INTO production%recipe_id%'
    )
    THEN '❌ ERRO: Função ainda insere recipe_id'
    ELSE '✅ OK: Função não insere recipe_id (correto)'
  END as status

UNION ALL

SELECT
  'custos_no_momento populated' as verificacao,
  CASE
    WHEN (
      SELECT COUNT(*) FROM production
      WHERE custos_no_momento IS NOT NULL
      AND custos_no_momento != '{}'::jsonb
      AND created_at >= CURRENT_DATE - INTERVAL '7 days'
    ) > 0
    THEN '✅ OK: Custos sendo armazenados'
    ELSE '⚠️ AVISO: Nenhum custo armazenado nos últimos 7 dias'
  END as status;

-- Resultado esperado: Todas as linhas com status '✅ OK'

-- ===================================================================
-- FIM DOS TESTES
-- ===================================================================

/*
RESUMO DA CORREÇÃO:

ANTES:
- Função tentava: INSERT INTO production (product_id, recipe_id, ...)
- Erro: column "recipe_id" does not exist

DEPOIS:
- Função faz: INSERT INTO production (product_id, quantity, ..., custos_no_momento)
- recipe_id usado para calcular custos
- Informações do recipe armazenadas em custos_no_momento (JSONB)
- ✅ Funcionando corretamente

PARA ACESSAR RECIPE DE UMA PRODUÇÃO:
- production.custos_no_momento->'recipe'->>'id'
- production.custos_no_momento->'recipe'->>'name'
*/
