-- =====================================================
-- QUERIES DE TESTE: PROGRESSO DAS ORDENS DE PRODUÇÃO
-- =====================================================
-- Use estas queries para testar se o progresso das ordens
-- está sendo calculado corretamente após a correção

-- =====================================================
-- 1. VERIFICAR ORDEM ESPECÍFICA (Sidinei Strack - Ordem #26)
-- =====================================================

SELECT
  po.order_number as "Nº Ordem",
  c.name as "Cliente",
  p.name as "Produto",
  po.total_quantity as "Total",
  po.produced_quantity as "Produzido",
  po.remaining_quantity as "Restante",
  po.status as "Status",
  ROUND((po.produced_quantity::numeric / NULLIF(po.total_quantity, 0)::numeric * 100), 0) || '%' as "Progresso",
  -- Verificação
  (SELECT COUNT(*) FROM production WHERE production_order_id = po.id) as "Nº Produções",
  (SELECT SUM(quantity) FROM production WHERE production_order_id = po.id) as "Soma Real"
FROM production_orders po
LEFT JOIN customers c ON c.id = po.customer_id
JOIN products p ON p.id = po.product_id
WHERE po.order_number = 26;

-- Resultado esperado:
-- Nº Ordem: 26
-- Cliente: Sidinei André Strack
-- Produto: Pilar pré moldado de 18x25 - H=4,50
-- Total: 6
-- Produzido: 6
-- Restante: 0
-- Status: completed
-- Progresso: 100%


-- =====================================================
-- 2. PRODUÇÕES VINCULADAS À ORDEM #26
-- =====================================================

SELECT
  pr.production_date as "Data Produção",
  pr.quantity as "Quantidade",
  pr.production_type as "Tipo",
  p.name as "Produto",
  to_char(pr.created_at, 'DD/MM/YYYY HH24:MI') as "Registrado em"
FROM production pr
JOIN products p ON p.id = pr.product_id
WHERE pr.production_order_id = (
  SELECT id FROM production_orders WHERE order_number = 26
)
ORDER BY pr.production_date DESC;

-- Resultado esperado: 3 produções de 2 unidades cada


-- =====================================================
-- 3. TODAS AS ORDENS DE SIDINEI STRACK
-- =====================================================

SELECT
  po.order_number as "Ordem",
  p.name as "Produto",
  po.total_quantity as "Total",
  po.produced_quantity as "Produzido",
  po.remaining_quantity as "Restante",
  po.status as "Status",
  ROUND((po.produced_quantity::numeric / NULLIF(po.total_quantity, 0)::numeric * 100), 0) || '%' as "Progresso"
FROM production_orders po
LEFT JOIN customers c ON c.id = po.customer_id
JOIN products p ON p.id = po.product_id
WHERE c.name ILIKE '%sidinei%'
ORDER BY po.order_number;


-- =====================================================
-- 4. VISÃO GERAL: ORDENS COM PRODUÇÃO
-- =====================================================

SELECT
  po.order_number as "Ordem",
  c.name as "Cliente",
  SUBSTRING(p.name, 1, 35) as "Produto",
  po.total_quantity as "Total",
  po.produced_quantity as "Prod",
  po.remaining_quantity as "Rest",
  po.status as "Status",
  ROUND((po.produced_quantity::numeric / NULLIF(po.total_quantity, 0)::numeric * 100), 0) as "%"
FROM production_orders po
LEFT JOIN customers c ON c.id = po.customer_id
JOIN products p ON p.id = po.product_id
WHERE po.produced_quantity > 0
ORDER BY po.order_number DESC;


-- =====================================================
-- 5. ORDENS POR STATUS
-- =====================================================

-- Ordens Abertas (sem produção iniciada)
SELECT
  'ABERTAS' as "Status",
  COUNT(*) as "Quantidade",
  SUM(po.total_quantity) as "Total de Unidades"
FROM production_orders po
WHERE po.status = 'open'

UNION ALL

-- Ordens Em Progresso
SELECT
  'EM PROGRESSO',
  COUNT(*),
  SUM(po.total_quantity)
FROM production_orders po
WHERE po.status = 'in_progress'

UNION ALL

-- Ordens Completas
SELECT
  'CONCLUÍDAS',
  COUNT(*),
  SUM(po.total_quantity)
FROM production_orders po
WHERE po.status = 'completed'

UNION ALL

-- Ordens Canceladas
SELECT
  'CANCELADAS',
  COUNT(*),
  SUM(po.total_quantity)
FROM production_orders po
WHERE po.status = 'cancelled';


-- =====================================================
-- 6. AUDITORIA: VERIFICAR SE VALORES ESTÃO CORRETOS
-- =====================================================

SELECT
  po.order_number as "Ordem",
  c.name as "Cliente",
  po.produced_quantity as "Produzido (Sistema)",
  COALESCE((
    SELECT SUM(quantity)
    FROM production
    WHERE production_order_id = po.id
  ), 0) as "Produzido (Real)",
  po.remaining_quantity as "Restante (Sistema)",
  (po.total_quantity - COALESCE((
    SELECT SUM(quantity)
    FROM production
    WHERE production_order_id = po.id
  ), 0)) as "Restante (Real)",
  CASE
    WHEN po.produced_quantity = COALESCE((
      SELECT SUM(quantity)
      FROM production
      WHERE production_order_id = po.id
    ), 0) THEN '✅ OK'
    ELSE '❌ DIVERGÊNCIA'
  END as "Validação"
FROM production_orders po
LEFT JOIN customers c ON c.id = po.customer_id
WHERE po.produced_quantity > 0
   OR EXISTS (SELECT 1 FROM production WHERE production_order_id = po.id)
ORDER BY po.order_number;


-- =====================================================
-- 7. TESTE DO TRIGGER: SIMULAR NOVA PRODUÇÃO
-- =====================================================

-- ATENÇÃO: Este é um exemplo. Ajuste os IDs conforme necessário!

-- Passo 1: Ver estado ANTES de vincular produção
SELECT
  po.order_number,
  po.produced_quantity as "Produzido",
  po.remaining_quantity as "Restante",
  po.status
FROM production_orders po
WHERE po.order_number = 23;  -- Altere para ordem que deseja testar

/*
-- Passo 2: Vincular uma produção (DESCOMENTE E AJUSTE IDs)
INSERT INTO production (
  product_id,
  quantity,
  production_type,
  production_order_id,
  production_date
) VALUES (
  'COPIE-ID-DO-PRODUTO-AQUI',
  2,
  'order',
  'COPIE-ID-DA-ORDEM-AQUI',
  CURRENT_DATE
) RETURNING id, quantity;
*/

-- Passo 3: Ver estado DEPOIS (valores devem ter atualizado automaticamente!)
SELECT
  po.order_number,
  po.produced_quantity as "Produzido (deve ter aumentado)",
  po.remaining_quantity as "Restante (deve ter diminuído)",
  po.status as "Status (pode ter mudado)"
FROM production_orders po
WHERE po.order_number = 23;  -- Use o mesmo número do Passo 1


-- =====================================================
-- 8. ORDENS EM ANDAMENTO (PRODUÇÃO PARCIAL)
-- =====================================================

SELECT
  po.order_number as "Ordem",
  c.name as "Cliente",
  p.name as "Produto",
  po.produced_quantity || ' de ' || po.total_quantity as "Progresso",
  po.remaining_quantity as "Faltam",
  ROUND((po.produced_quantity::numeric / po.total_quantity::numeric * 100), 0) || '%' as "Percentual"
FROM production_orders po
LEFT JOIN customers c ON c.id = po.customer_id
JOIN products p ON p.id = po.product_id
WHERE po.status = 'in_progress'
ORDER BY (po.produced_quantity::numeric / po.total_quantity::numeric) DESC;


-- =====================================================
-- 9. ORDENS COMPLETAS RECENTEMENTE
-- =====================================================

SELECT
  po.order_number as "Ordem",
  c.name as "Cliente",
  p.name as "Produto",
  po.total_quantity as "Quantidade",
  po.completed_at::date as "Concluída em",
  AGE(po.completed_at, po.created_at) as "Tempo Total"
FROM production_orders po
LEFT JOIN customers c ON c.id = po.customer_id
JOIN products p ON p.id = po.product_id
WHERE po.status = 'completed'
  AND po.completed_at IS NOT NULL
ORDER BY po.completed_at DESC
LIMIT 10;


-- =====================================================
-- 10. HISTÓRICO DE PRODUÇÕES DE UMA ORDEM
-- =====================================================

-- Substitua o número da ordem
WITH ordem_selecionada AS (
  SELECT id FROM production_orders WHERE order_number = 26
)
SELECT
  pr.production_date as "Data",
  p.name as "Produto",
  pr.quantity as "Qtd",
  pr.notes as "Observações",
  to_char(pr.created_at, 'DD/MM/YYYY HH24:MI') as "Registrado",
  -- Progresso acumulado até aquela data
  (
    SELECT SUM(quantity)
    FROM production pr2
    WHERE pr2.production_order_id = (SELECT id FROM ordem_selecionada)
      AND pr2.production_date <= pr.production_date
      AND pr2.created_at <= pr.created_at
  ) as "Acumulado"
FROM production pr
JOIN products p ON p.id = pr.product_id
WHERE pr.production_order_id = (SELECT id FROM ordem_selecionada)
ORDER BY pr.production_date, pr.created_at;


-- =====================================================
-- 11. RESUMO EXECUTIVO
-- =====================================================

SELECT
  'Total de Ordens' as "Métrica",
  COUNT(*)::text as "Valor"
FROM production_orders

UNION ALL

SELECT
  'Ordens Abertas',
  COUNT(*)::text
FROM production_orders
WHERE status = 'open'

UNION ALL

SELECT
  'Ordens Em Progresso',
  COUNT(*)::text
FROM production_orders
WHERE status = 'in_progress'

UNION ALL

SELECT
  'Ordens Completas',
  COUNT(*)::text
FROM production_orders
WHERE status = 'completed'

UNION ALL

SELECT
  'Total Produzido (todas as ordens)',
  SUM(produced_quantity)::text || ' unidades'
FROM production_orders

UNION ALL

SELECT
  'Total Restante (todas as ordens)',
  SUM(remaining_quantity)::text || ' unidades'
FROM production_orders

UNION ALL

SELECT
  'Progresso Médio (todas as ordens)',
  ROUND(
    AVG(
      (produced_quantity::numeric / NULLIF(total_quantity, 0)::numeric * 100)
    ), 1
  )::text || '%'
FROM production_orders
WHERE total_quantity > 0;


-- =====================================================
-- 12. BUSCAR ORDEM POR CLIENTE
-- =====================================================

-- Substitua o nome do cliente
SELECT
  po.order_number as "Ordem",
  c.name as "Cliente",
  p.name as "Produto",
  po.total_quantity as "Total",
  po.produced_quantity as "Produzido",
  po.remaining_quantity as "Restante",
  po.status as "Status",
  ROUND((po.produced_quantity::numeric / NULLIF(po.total_quantity, 0)::numeric * 100), 0) || '%' as "Progresso",
  po.created_at::date as "Criada em"
FROM production_orders po
LEFT JOIN customers c ON c.id = po.customer_id
JOIN products p ON p.id = po.product_id
WHERE c.name ILIKE '%DIGITE-PARTE-DO-NOME%'
ORDER BY po.order_number DESC;
