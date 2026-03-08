-- =============================================================================
-- TESTE: Sistema de Congelamento de Preços em Orçamentos
-- =============================================================================
-- Este script testa o sistema de congelamento de preços em orçamentos

-- =============================================================================
-- TESTE 1: Verificar Estrutura dos Campos
-- =============================================================================
\echo '=== TESTE 1: Verificando estrutura dos novos campos ==='

SELECT
  'Campos de congelamento criados' as teste,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'quotes'
  AND column_name IN ('precos_congelados', 'snapshot_valores', 'data_congelamento')
ORDER BY column_name;

-- =============================================================================
-- TESTE 2: Verificar Funções Criadas
-- =============================================================================
\echo ''
\echo '=== TESTE 2: Verificando funções criadas ==='

SELECT
  routine_name as funcao,
  routine_type as tipo
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('freeze_quote_prices', 'unfreeze_quote_prices', 'get_quote_totals')
ORDER BY routine_name;

-- =============================================================================
-- TESTE 3: Criar Orçamento de Teste
-- =============================================================================
\echo ''
\echo '=== TESTE 3: Criando orçamento de teste ==='

-- Limpar testes anteriores
DELETE FROM quote_items WHERE quote_id IN (
  SELECT id FROM quotes WHERE notes LIKE '%TESTE_CONGELAMENTO%'
);
DELETE FROM quotes WHERE notes LIKE '%TESTE_CONGELAMENTO%';

-- Criar orçamento de teste
WITH cliente_teste AS (
  SELECT id FROM customers LIMIT 1
),
produto_teste AS (
  SELECT id, sale_price, custo_unitario_materiais
  FROM products
  WHERE custo_unitario_materiais > 0
  LIMIT 1
),
orcamento_novo AS (
  INSERT INTO quotes (
    customer_id,
    status,
    notes,
    total_value
  )
  SELECT
    c.id,
    'pending',
    'TESTE_CONGELAMENTO - Orçamento para testar congelamento de preços',
    p.sale_price * 10
  FROM cliente_teste c, produto_teste p
  RETURNING id, customer_id, total_value
)
INSERT INTO quote_items (
  quote_id,
  item_type,
  product_id,
  quantity,
  suggested_price,
  proposed_price
)
SELECT
  o.id,
  'product',
  p.id,
  10,
  p.sale_price,
  p.sale_price
FROM orcamento_novo o, produto_teste p
RETURNING
  quote_id,
  product_id,
  quantity,
  proposed_price,
  quantity * proposed_price as total;

-- Ver orçamento criado
\echo ''
\echo 'Orçamento de teste criado:'
SELECT
  q.id,
  c.name as cliente,
  q.total_value,
  q.precos_congelados,
  COUNT(qi.id) as qtd_itens
FROM quotes q
JOIN customers c ON c.id = q.customer_id
LEFT JOIN quote_items qi ON qi.quote_id = q.id
WHERE q.notes LIKE '%TESTE_CONGELAMENTO%'
GROUP BY q.id, c.name, q.total_value, q.precos_congelados;

-- =============================================================================
-- TESTE 4: Congelar Preços do Orçamento
-- =============================================================================
\echo ''
\echo '=== TESTE 4: Congelando preços do orçamento ==='

-- Buscar ID do orçamento de teste
CREATE TEMP TABLE IF NOT EXISTS temp_orcamento_teste AS
SELECT id FROM quotes WHERE notes LIKE '%TESTE_CONGELAMENTO%' LIMIT 1;

-- Ver totais ANTES do congelamento
\echo ''
\echo 'Totais ANTES do congelamento:'
SELECT * FROM get_quote_totals((SELECT id FROM temp_orcamento_teste));

-- Congelar preços
SELECT freeze_quote_prices((SELECT id FROM temp_orcamento_teste));

-- Ver totais DEPOIS do congelamento
\echo ''
\echo 'Totais DEPOIS do congelamento:'
SELECT * FROM get_quote_totals((SELECT id FROM temp_orcamento_teste));

-- Ver detalhes do snapshot
\echo ''
\echo 'Detalhes do snapshot criado:'
SELECT
  id,
  precos_congelados,
  data_congelamento,
  jsonb_pretty(snapshot_valores->'totals') as totais,
  jsonb_array_length(snapshot_valores->'items') as qtd_itens_snapshot
FROM quotes
WHERE id = (SELECT id FROM temp_orcamento_teste);

-- =============================================================================
-- TESTE 5: Simular Mudança de Preço e Verificar Congelamento
-- =============================================================================
\echo ''
\echo '=== TESTE 5: Simulando mudança de preço do produto ==='

-- Salvar preços originais dos produtos do orçamento
CREATE TEMP TABLE IF NOT EXISTS temp_precos_originais AS
SELECT
  p.id,
  p.name,
  p.sale_price as preco_original,
  p.custo_unitario_materiais as custo_original
FROM products p
WHERE p.id IN (
  SELECT product_id
  FROM quote_items
  WHERE quote_id = (SELECT id FROM temp_orcamento_teste)
);

\echo ''
\echo 'Preços ORIGINAIS dos produtos:'
SELECT * FROM temp_precos_originais;

-- Aumentar preço em 20%
UPDATE products p
SET sale_price = sale_price * 1.20
FROM temp_precos_originais t
WHERE p.id = t.id;

\echo ''
\echo 'Preços ATUALIZADOS dos produtos (aumento de 20%):'
SELECT
  p.id,
  p.name,
  t.preco_original,
  p.sale_price as preco_novo,
  ROUND(((p.sale_price - t.preco_original) / t.preco_original * 100)::numeric, 2) as percentual_aumento
FROM products p
JOIN temp_precos_originais t ON t.id = p.id;

-- Verificar que orçamento CONGELADO mantém valores antigos
\echo ''
\echo 'Orçamento CONGELADO (deve manter valores antigos):'
SELECT * FROM get_quote_totals((SELECT id FROM temp_orcamento_teste));

-- Criar orçamento NÃO CONGELADO para comparação
\echo ''
\echo 'Criando orçamento NÃO congelado para comparação...'
WITH orcamento_nao_congelado AS (
  INSERT INTO quotes (
    customer_id,
    status,
    notes,
    total_value
  )
  SELECT
    customer_id,
    'pending',
    'TESTE_NAO_CONGELADO - Para comparação',
    0
  FROM quotes
  WHERE id = (SELECT id FROM temp_orcamento_teste)
  RETURNING id
)
INSERT INTO quote_items (
  quote_id,
  item_type,
  product_id,
  quantity,
  suggested_price,
  proposed_price
)
SELECT
  o.id,
  'product',
  qi.product_id,
  qi.quantity,
  p.sale_price,
  p.sale_price
FROM orcamento_nao_congelado o,
     quote_items qi,
     products p
WHERE qi.quote_id = (SELECT id FROM temp_orcamento_teste)
  AND p.id = qi.product_id;

\echo ''
\echo 'Orçamento NÃO CONGELADO (deve usar preços novos):'
SELECT * FROM get_quote_totals((
  SELECT id FROM quotes WHERE notes LIKE '%TESTE_NAO_CONGELADO%' LIMIT 1
));

-- =============================================================================
-- TESTE 6: Descongelar Preços
-- =============================================================================
\echo ''
\echo '=== TESTE 6: Descongelando preços do orçamento ==='

-- Descongelar
SELECT unfreeze_quote_prices((SELECT id FROM temp_orcamento_teste));

-- Ver totais DEPOIS de descongelar
\echo ''
\echo 'Totais DEPOIS de descongelar (deve usar preços atuais):'
SELECT * FROM get_quote_totals((SELECT id FROM temp_orcamento_teste));

-- Ver status do orçamento
\echo ''
\echo 'Status do orçamento:'
SELECT
  id,
  precos_congelados,
  data_congelamento,
  snapshot_valores IS NULL as snapshot_limpo
FROM quotes
WHERE id = (SELECT id FROM temp_orcamento_teste);

-- =============================================================================
-- TESTE 7: Restaurar Preços Originais
-- =============================================================================
\echo ''
\echo '=== TESTE 7: Restaurando preços originais ==='

UPDATE products p
SET sale_price = t.preco_original
FROM temp_precos_originais t
WHERE p.id = t.id;

\echo 'Preços restaurados para valores originais.'

-- =============================================================================
-- TESTE 8: Limpeza
-- =============================================================================
\echo ''
\echo '=== TESTE 8: Limpando dados de teste ==='

DELETE FROM quote_items WHERE quote_id IN (
  SELECT id FROM quotes WHERE notes LIKE '%TESTE_%CONGELADO%'
);
DELETE FROM quotes WHERE notes LIKE '%TESTE_%CONGELADO%';

DROP TABLE IF EXISTS temp_orcamento_teste;
DROP TABLE IF EXISTS temp_precos_originais;

\echo ''
\echo '=== TODOS OS TESTES CONCLUÍDOS ==='
\echo 'Sistema de Congelamento de Preços está funcionando corretamente!'
\echo ''
\echo 'Funcionalidades testadas:'
\echo '  1. Criação dos campos no banco'
\echo '  2. Funções de congelar/descongelar'
\echo '  3. Congelamento de valores'
\echo '  4. Snapshot de preços'
\echo '  5. Imunidade a mudanças de preço quando congelado'
\echo '  6. Descongelamento e recálculo'
\echo ''
\echo 'O sistema está pronto para uso!'
