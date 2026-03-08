-- ============================================================================
-- CORREÇÃO DA RECEITA: Grade divisória de pocilga - 3,00m
-- ============================================================================
-- Data: 01/02/2026
-- Problema: Quantidade de ferro 16mm cadastrada como 2,024m ao invés de 24,24m
-- Impacto: Custo de produção está sendo calculado incorretamente
-- ============================================================================

-- PASSO 1: VERIFICAR RECEITA ATUAL
-- ============================================================================
SELECT
  'ANTES DA CORREÇÃO' as status,
  m.name as material,
  pa.quantity as quantidade_por_peca,
  m.unit as unidade,
  m.unit_cost as custo_unitario,
  ROUND((pa.quantity * m.unit_cost)::numeric, 2) as custo_por_peca,
  pa.accessory_type as tipo
FROM product_accessories pa
JOIN materials m ON pa.material_id = m.id
JOIN products p ON pa.product_id = p.id
WHERE p.name = 'Grade divisória de pocilga - 3,00m'
ORDER BY m.name;

-- Resultado esperado:
-- | material | quantidade_por_peca | unidade | custo_unitario | custo_por_peca | tipo |
-- |----------|--------------------:|---------|---------------:|---------------:|------|
-- | CA-50 3/8-10.0MM... | 1.60 | metros | 3.06 | 4.90 | (tipo) |
-- | CA-50 5/8-16.00MM... | 2.024 ← ERRADO | metros | 8.24 | 16.68 | (tipo) |
-- | Chapa metálica... | 2.00 | unid | 31.52 | 63.04 | (tipo) |


-- PASSO 2: ATUALIZAR QUANTIDADE DE FERRO 16MM
-- ============================================================================
-- ATENÇÃO: Certifique-se de que esta é a correção correta antes de executar!

UPDATE product_accessories
SET quantity = 24.24
WHERE product_id = (
  SELECT id FROM products WHERE name = 'Grade divisória de pocilga - 3,00m'
)
AND material_id = (
  SELECT id FROM materials WHERE name LIKE '%5/8-16.00MM%'
);

-- Mensagem de confirmação
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM product_accessories pa
      JOIN products p ON pa.product_id = p.id
      WHERE p.name = 'Grade divisória de pocilga - 3,00m'
        AND pa.quantity = 24.24
    )
    THEN '✅ RECEITA ATUALIZADA COM SUCESSO!'
    ELSE '❌ ERRO: Receita não foi atualizada. Verifique os dados.'
  END as resultado;


-- PASSO 3: VERIFICAR RECEITA APÓS CORREÇÃO
-- ============================================================================
SELECT
  'DEPOIS DA CORREÇÃO' as status,
  m.name as material,
  pa.quantity as quantidade_por_peca,
  m.unit as unidade,
  m.unit_cost as custo_unitario,
  ROUND((pa.quantity * m.unit_cost)::numeric, 2) as custo_por_peca,
  pa.accessory_type as tipo
FROM product_accessories pa
JOIN materials m ON pa.material_id = m.id
JOIN products p ON pa.product_id = p.id
WHERE p.name = 'Grade divisória de pocilga - 3,00m'
ORDER BY m.name;

-- Resultado esperado APÓS correção:
-- | material | quantidade_por_peca | unidade | custo_unitario | custo_por_peca | tipo |
-- |----------|--------------------:|---------|---------------:|---------------:|------|
-- | CA-50 3/8-10.0MM... | 1.60 | metros | 3.06 | 4.90 | (tipo) |
-- | CA-50 5/8-16.00MM... | 24.24 ← CORRETO | metros | 8.24 | 199.74 | (tipo) |
-- | Chapa metálica... | 2.00 | unid | 31.52 | 63.04 | (tipo) |


-- PASSO 4: COMPARAR CUSTO ANTES E DEPOIS
-- ============================================================================
WITH custo_atual AS (
  SELECT
    SUM(pa.quantity * m.unit_cost) as custo_total
  FROM product_accessories pa
  JOIN materials m ON pa.material_id = m.id
  JOIN products p ON pa.product_id = p.id
  WHERE p.name = 'Grade divisória de pocilga - 3,00m'
)
SELECT
  'R$ ' || ROUND(custo_total::numeric, 2) as custo_unitario_produto,
  'R$ ' || ROUND((custo_total * 19)::numeric, 2) as custo_19_pecas,
  '19 peças produzidas no dia 28/01/2026' as observacao
FROM custo_atual;

-- Resultado esperado:
-- ANTES: R$ 84.62 por peça → R$ 1.607,78 por 19 peças
-- DEPOIS: R$ 267.68 por peça → R$ 5.085,92 por 19 peças
-- DIFERENÇA: R$ 183.06 por peça → R$ 3.478,14 por 19 peças


-- PASSO 5: VERIFICAR IMPACTO NA PRODUÇÃO DO DIA 28/01
-- ============================================================================
-- Esta query mostra o consumo REAL que foi registrado vs o que DEVERIA ter sido
SELECT
  m.name as material,
  mm.quantity as consumo_registrado,
  (pa.quantity * 19) as consumo_esperado,
  ROUND((pa.quantity * 19 - mm.quantity)::numeric, 2) as diferenca,
  m.unit as unidade
FROM material_movements mm
JOIN materials m ON mm.material_id = m.id
JOIN production prod ON mm.production_id = prod.id
JOIN products p ON prod.product_id = p.id
LEFT JOIN product_accessories pa ON pa.product_id = p.id AND pa.material_id = m.id
WHERE p.name = 'Grade divisória de pocilga - 3,00m'
  AND prod.production_date = '2026-01-28'
ORDER BY m.name;

-- Resultado esperado (ANTES da correção da receita):
-- | material | consumo_registrado | consumo_esperado | diferenca | unidade |
-- |----------|-------------------:|-----------------:|----------:|---------|
-- | CA-50 3/8-10.0MM... | 30.40 | 30.40 | 0.00 | metros |
-- | CA-50 5/8-16.00MM... | 38.456 | 38.456 | 0.00 | metros |
-- | Chapa... | 38 | 38 | 0 | unid |

-- Resultado esperado (DEPOIS da correção da receita):
-- | material | consumo_registrado | consumo_esperado | diferenca | unidade |
-- |----------|-------------------:|-----------------:|----------:|---------|
-- | CA-50 3/8-10.0MM... | 30.40 | 30.40 | 0.00 | metros |
-- | CA-50 5/8-16.00MM... | 38.456 | 460.56 | -422.10 | metros | ← FALTA!
-- | Chapa... | 38 | 38 | 0 | unid |


-- PASSO 6: OPÇÃO - AJUSTAR MOVIMENTAÇÃO DE ESTOQUE RETROATIVA
-- ============================================================================
-- CUIDADO: Só execute isto se quiser corrigir o consumo da produção do dia 28/01
-- Esta query adiciona uma movimentação de saída para compensar a diferença

-- Primeiro, vamos verificar se já existe o ajuste
SELECT
  mm.id,
  mm.quantity,
  mm.movement_date,
  mm.notes
FROM material_movements mm
JOIN materials m ON mm.material_id = m.id
WHERE m.name LIKE '%5/8-16.00MM%'
  AND mm.movement_date = '2026-01-28'
  AND mm.notes ILIKE '%ajuste%retroativo%';

-- Se não existir, criar o ajuste:
-- ATENÇÃO: Só execute este INSERT se realmente quiser ajustar o estoque retroativamente!
/*
INSERT INTO material_movements (
  material_id,
  quantity,
  movement_type,
  movement_date,
  notes,
  production_id
)
SELECT
  m.id,
  422.10, -- Diferença entre o que deveria ter consumido (460.56) e o que foi (38.456)
  'saida',
  '2026-01-28',
  'Ajuste retroativo - Correção de receita do produto Grade divisória de pocilga (faltavam 422,10m de ferro 16mm)',
  prod.id
FROM materials m
CROSS JOIN production prod
JOIN products p ON prod.product_id = p.id
WHERE m.name LIKE '%5/8-16.00MM%'
  AND p.name = 'Grade divisória de pocilga - 3,00m'
  AND prod.production_date = '2026-01-28';
*/

-- Verificar se o ajuste foi criado
SELECT
  'Ajuste criado com sucesso!' as mensagem,
  mm.quantity as quantidade_ajustada,
  mm.notes as observacao
FROM material_movements mm
JOIN materials m ON mm.material_id = m.id
WHERE m.name LIKE '%5/8-16.00MM%'
  AND mm.movement_date = '2026-01-28'
  AND mm.notes ILIKE '%ajuste%retroativo%';


-- PASSO 7: VERIFICAR ESTOQUE ATUAL DE FERRO 16MM
-- ============================================================================
SELECT
  m.name as material,
  COALESCE(
    (SELECT SUM(
      CASE
        WHEN mm.movement_type = 'entrada' THEN mm.quantity
        WHEN mm.movement_type = 'saida' THEN -mm.quantity
        ELSE 0
      END
    )
    FROM material_movements mm
    WHERE mm.material_id = m.id),
    0
  ) as estoque_atual,
  m.unit as unidade,
  m.minimum_stock as estoque_minimo
FROM materials m
WHERE m.name LIKE '%5/8-16.00MM%';

-- Se o estoque ficar negativo após o ajuste, será necessário fazer uma compra


-- PASSO 8: RECALCULAR CUSTO DO PRODUTO
-- ============================================================================
-- Após corrigir a receita, recalcular o custo total do produto

WITH custos_materiais AS (
  SELECT
    p.id as product_id,
    p.name as produto,
    SUM(pa.quantity * m.unit_cost) as custo_materiais
  FROM products p
  JOIN product_accessories pa ON pa.product_id = p.id
  JOIN materials m ON pa.material_id = m.id
  WHERE p.name = 'Grade divisória de pocilga - 3,00m'
  GROUP BY p.id, p.name
)
SELECT
  cm.produto,
  'R$ ' || ROUND(cm.custo_materiais::numeric, 2) as custo_materiais,
  'R$ ' || ROUND(p.labor_cost::numeric, 2) as custo_mao_obra,
  'R$ ' || ROUND((cm.custo_materiais + COALESCE(p.labor_cost, 0))::numeric, 2) as custo_total_producao,
  'R$ ' || ROUND(p.sale_price::numeric, 2) as preco_venda,
  ROUND((
    (p.sale_price - (cm.custo_materiais + COALESCE(p.labor_cost, 0))) /
    NULLIF(p.sale_price, 0) * 100
  )::numeric, 1) || '%' as margem_lucro
FROM custos_materiais cm
JOIN products p ON p.id = cm.product_id;


-- PASSO 9: ATUALIZAR CUSTO NO PRODUTO (OPCIONAL)
-- ============================================================================
-- Atualizar o campo material_cost do produto com o novo custo calculado

UPDATE products
SET
  material_cost = (
    SELECT SUM(pa.quantity * m.unit_cost)
    FROM product_accessories pa
    JOIN materials m ON pa.material_id = m.id
    WHERE pa.product_id = products.id
  ),
  updated_at = NOW()
WHERE name = 'Grade divisória de pocilga - 3,00m';

-- Verificar se foi atualizado
SELECT
  name,
  'R$ ' || ROUND(material_cost::numeric, 2) as custo_materiais_atualizado,
  'R$ ' || ROUND(sale_price::numeric, 2) as preco_venda,
  updated_at as data_atualizacao
FROM products
WHERE name = 'Grade divisória de pocilga - 3,00m';


-- ============================================================================
-- RESUMO FINAL
-- ============================================================================
SELECT
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' as linha,
  'RESUMO DA CORREÇÃO' as titulo
UNION ALL
SELECT
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  ''
UNION ALL
SELECT
  '✅ Receita corrigida:',
  'Ferro 16mm: 2,024m → 24,24m por peça'
UNION ALL
SELECT
  '💰 Impacto no custo:',
  'R$ 16,68 → R$ 199,74 por peça (+R$ 183,06)'
UNION ALL
SELECT
  '📊 Custo total por 19 peças:',
  'R$ 1.607,78 → R$ 5.085,92 (+R$ 3.478,14)'
UNION ALL
SELECT
  '⚠️ Produção do dia 28/01:',
  'Consumo registrado: 38,456m (faltam 422,10m)'
UNION ALL
SELECT
  '🔄 Próximas produções:',
  'Usarão receita corrigida automaticamente'
UNION ALL
SELECT
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  '';


-- ============================================================================
-- QUERIES ÚTEIS PARA MONITORAMENTO
-- ============================================================================

-- Verificar todas as produções deste produto
SELECT
  production_date as data,
  quantity as pecas_produzidas,
  notes as observacoes,
  created_at as data_registro
FROM production
WHERE product_id = (SELECT id FROM products WHERE name = 'Grade divisória de pocilga - 3,00m')
ORDER BY production_date DESC;

-- Verificar consumo total histórico de ferro 16mm para este produto
SELECT
  DATE_TRUNC('month', mm.movement_date) as mes,
  COUNT(DISTINCT prod.id) as num_producoes,
  SUM(prod.quantity) as total_pecas,
  SUM(mm.quantity) as total_ferro_consumido,
  ROUND((SUM(mm.quantity) / NULLIF(SUM(prod.quantity), 0))::numeric, 2) as media_por_peca,
  m.unit as unidade
FROM material_movements mm
JOIN materials m ON mm.material_id = m.id
JOIN production prod ON mm.production_id = prod.id
JOIN products p ON prod.product_id = p.id
WHERE p.name = 'Grade divisória de pocilga - 3,00m'
  AND m.name LIKE '%5/8-16.00MM%'
  AND mm.movement_type = 'saida'
GROUP BY DATE_TRUNC('month', mm.movement_date), m.unit
ORDER BY mes DESC;
