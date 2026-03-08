/*
  QUERIES ÚTEIS - SISTEMA DE RECEBÍVEIS

  Este arquivo contém queries SQL úteis para análises,
  relatórios e operações comuns no sistema de recebíveis.

  Data: 2026-01-17
  Versão: 1.0
*/

-- ============================================================================
-- SEÇÃO 1: CONSULTAS DE VENDAS
-- ============================================================================

-- 1.1 Listar todas as vendas com origem
SELECT
  sale_number AS "Número Venda",
  CASE origem_tipo
    WHEN 'fabrica' THEN 'Fábrica'
    WHEN 'laje' THEN 'Laje'
    WHEN 'escritorio' THEN 'Escritório'
  END AS "Origem",
  customer_name_snapshot AS "Cliente",
  data_venda AS "Data",
  valor_total AS "Valor Total",
  status AS "Status"
FROM unified_sales
ORDER BY data_venda DESC;

-- 1.2 Vendas por unidade de negócio
SELECT
  unidade_negocio AS "Unidade",
  COUNT(*) AS "Total Vendas",
  SUM(valor_total) AS "Valor Total",
  AVG(valor_total) AS "Ticket Médio"
FROM unified_sales
WHERE status = 'ativa'
GROUP BY unidade_negocio
ORDER BY SUM(valor_total) DESC;

-- 1.3 Vendas do mês atual
SELECT
  sale_number,
  customer_name_snapshot,
  data_venda,
  valor_total,
  unidade_negocio
FROM unified_sales
WHERE data_venda >= DATE_TRUNC('month', CURRENT_DATE)
  AND data_venda < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
ORDER BY data_venda DESC;

-- 1.4 Top 10 clientes por valor
SELECT
  customer_name_snapshot AS "Cliente",
  COUNT(*) AS "Nº Vendas",
  SUM(valor_total) AS "Total Comprado",
  AVG(valor_total) AS "Ticket Médio"
FROM unified_sales
WHERE status = 'ativa'
GROUP BY customer_name_snapshot
ORDER BY SUM(valor_total) DESC
LIMIT 10;

-- ============================================================================
-- SEÇÃO 2: CONSULTAS DE RECEBÍVEIS
-- ============================================================================

-- 2.1 Dashboard de recebíveis por status
SELECT
  status AS "Status",
  COUNT(*) AS "Quantidade",
  SUM(valor_parcela) AS "Valor Total",
  AVG(valor_parcela) AS "Valor Médio"
FROM receivables
WHERE status != 'cancelado'
GROUP BY status
ORDER BY
  CASE status
    WHEN 'sem_definicao' THEN 1
    WHEN 'pendente' THEN 2
    WHEN 'em_compensacao' THEN 3
    WHEN 'pago' THEN 4
  END;

-- 2.2 Recebíveis vencidos (URGENTE)
SELECT
  r.id,
  v.sale_number AS "Venda",
  v.customer_name_snapshot AS "Cliente",
  r.parcela_numero AS "Parcela",
  r.valor_parcela AS "Valor",
  r.data_vencimento AS "Vencimento",
  (CURRENT_DATE - r.data_vencimento) AS "Dias Atraso",
  r.forma_pagamento AS "Forma",
  v.unidade_negocio AS "Unidade"
FROM receivables r
JOIN unified_sales v ON v.id = r.venda_id
WHERE r.status = 'pendente'
  AND r.data_vencimento < CURRENT_DATE
ORDER BY r.data_vencimento;

-- 2.3 Recebíveis que vencem nos próximos 7 dias
SELECT
  r.id,
  v.sale_number AS "Venda",
  v.customer_name_snapshot AS "Cliente",
  r.parcela_numero AS "Parcela",
  r.valor_parcela AS "Valor",
  r.data_vencimento AS "Vencimento",
  (r.data_vencimento - CURRENT_DATE) AS "Dias até Vencer",
  r.forma_pagamento AS "Forma"
FROM receivables r
JOIN unified_sales v ON v.id = r.venda_id
WHERE r.status = 'pendente'
  AND r.data_vencimento >= CURRENT_DATE
  AND r.data_vencimento <= CURRENT_DATE + INTERVAL '7 days'
ORDER BY r.data_vencimento;

-- 2.4 Total a receber por cliente
SELECT
  v.customer_name_snapshot AS "Cliente",
  COUNT(r.id) AS "Parcelas Pendentes",
  SUM(r.valor_parcela) AS "Total a Receber",
  MIN(r.data_vencimento) AS "Próximo Vencimento"
FROM receivables r
JOIN unified_sales v ON v.id = r.venda_id
WHERE r.status IN ('sem_definicao', 'pendente', 'em_compensacao')
GROUP BY v.customer_name_snapshot
ORDER BY SUM(r.valor_parcela) DESC;

-- 2.5 Evolução de recebimentos por mês
SELECT
  TO_CHAR(data_recebimento, 'YYYY-MM') AS "Mês",
  COUNT(*) AS "Parcelas Recebidas",
  SUM(valor_recebido) AS "Valor Total Recebido",
  AVG(valor_recebido) AS "Ticket Médio"
FROM receivables
WHERE status = 'pago'
  AND data_recebimento >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY TO_CHAR(data_recebimento, 'YYYY-MM')
ORDER BY "Mês" DESC;

-- 2.6 Taxa de conversão (pago vs pendente)
SELECT
  SUM(CASE WHEN status = 'pago' THEN valor_parcela ELSE 0 END) AS "Total Recebido",
  SUM(CASE WHEN status IN ('pendente', 'em_compensacao') THEN valor_parcela ELSE 0 END) AS "Total Pendente",
  SUM(CASE WHEN status = 'sem_definicao' THEN valor_parcela ELSE 0 END) AS "Sem Definição",
  ROUND(
    100.0 * SUM(CASE WHEN status = 'pago' THEN valor_parcela ELSE 0 END) /
    NULLIF(SUM(valor_parcela), 0),
    2
  ) AS "% Recebido"
FROM receivables
WHERE status != 'cancelado';

-- ============================================================================
-- SEÇÃO 3: ANÁLISE DE CHEQUES
-- ============================================================================

-- 3.1 Cheques a depositar hoje
SELECT
  cd.numero_cheque AS "Nº Cheque",
  cd.banco_nome AS "Banco",
  cd.titular AS "Titular",
  r.valor_parcela AS "Valor",
  cd.data_bom_para AS "Bom Para",
  v.customer_name_snapshot AS "Cliente",
  v.sale_number AS "Venda"
FROM cheque_details cd
JOIN receivables r ON r.id = cd.receivable_id
JOIN unified_sales v ON v.id = r.venda_id
WHERE cd.status_cheque = 'a_depositar'
  AND cd.data_bom_para <= CURRENT_DATE
ORDER BY cd.data_bom_para;

-- 3.2 Resumo de cheques por status
SELECT
  status_cheque AS "Status Cheque",
  COUNT(*) AS "Quantidade",
  SUM(r.valor_parcela) AS "Valor Total"
FROM cheque_details cd
JOIN receivables r ON r.id = cd.receivable_id
GROUP BY status_cheque
ORDER BY
  CASE status_cheque
    WHEN 'a_depositar' THEN 1
    WHEN 'depositado' THEN 2
    WHEN 'compensado' THEN 3
    WHEN 'devolvido' THEN 4
    WHEN 'cancelado' THEN 5
  END;

-- 3.3 Cheques devolvidos (ALERTA)
SELECT
  cd.numero_cheque AS "Nº Cheque",
  cd.banco_nome AS "Banco",
  cd.titular AS "Titular",
  r.valor_parcela AS "Valor",
  cd.motivo_devolucao AS "Motivo",
  v.customer_name_snapshot AS "Cliente",
  v.sale_number AS "Venda"
FROM cheque_details cd
JOIN receivables r ON r.id = cd.receivable_id
JOIN unified_sales v ON v.id = r.venda_id
WHERE cd.status_cheque = 'devolvido'
ORDER BY cd.updated_at DESC;

-- 3.4 Ciclo médio de compensação de cheques
SELECT
  AVG(cd.data_compensacao - cd.data_deposito) AS "Dias Médios Compensação",
  MIN(cd.data_compensacao - cd.data_deposito) AS "Menor Tempo",
  MAX(cd.data_compensacao - cd.data_deposito) AS "Maior Tempo"
FROM cheque_details cd
WHERE cd.status_cheque = 'compensado'
  AND cd.data_deposito IS NOT NULL
  AND cd.data_compensacao IS NOT NULL;

-- ============================================================================
-- SEÇÃO 4: ANÁLISE POR FORMA DE PAGAMENTO
-- ============================================================================

-- 4.1 Distribuição por forma de pagamento
SELECT
  COALESCE(forma_pagamento, 'Não Definida') AS "Forma de Pagamento",
  COUNT(*) AS "Quantidade",
  SUM(valor_parcela) AS "Valor Total",
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS "% Quantidade",
  ROUND(100.0 * SUM(valor_parcela) / SUM(SUM(valor_parcela)) OVER (), 2) AS "% Valor"
FROM receivables
WHERE status != 'cancelado'
GROUP BY forma_pagamento
ORDER BY SUM(valor_parcela) DESC;

-- 4.2 Prazo médio de recebimento por forma
SELECT
  forma_pagamento AS "Forma",
  COUNT(*) AS "Qtd",
  AVG(data_recebimento::date - data_vencimento) AS "Prazo Médio (dias)",
  MIN(data_recebimento::date - data_vencimento) AS "Menor Prazo",
  MAX(data_recebimento::date - data_vencimento) AS "Maior Prazo"
FROM receivables
WHERE status = 'pago'
  AND data_vencimento IS NOT NULL
  AND data_recebimento IS NOT NULL
GROUP BY forma_pagamento
ORDER BY AVG(data_recebimento::date - data_vencimento);

-- ============================================================================
-- SEÇÃO 5: ANÁLISE FINANCEIRA
-- ============================================================================

-- 5.1 Fluxo de caixa previsto vs realizado
SELECT
  TO_CHAR(COALESCE(r.data_vencimento, r.data_recebimento::date), 'YYYY-MM') AS "Mês",
  SUM(CASE WHEN r.status = 'pago' THEN r.valor_recebido ELSE 0 END) AS "Realizado",
  SUM(CASE WHEN r.status IN ('pendente', 'em_compensacao') THEN r.valor_parcela ELSE 0 END) AS "Previsto",
  SUM(CASE WHEN r.status = 'pago' THEN r.valor_recebido
           WHEN r.status IN ('pendente', 'em_compensacao') THEN r.valor_parcela
           ELSE 0 END) AS "Total"
FROM receivables r
WHERE r.status != 'cancelado'
  AND (r.data_vencimento >= CURRENT_DATE - INTERVAL '3 months'
       OR r.data_recebimento >= CURRENT_DATE - INTERVAL '3 months')
GROUP BY TO_CHAR(COALESCE(r.data_vencimento, r.data_recebimento::date), 'YYYY-MM')
ORDER BY "Mês";

-- 5.2 Inadimplência por unidade de negócio
SELECT
  v.unidade_negocio AS "Unidade",
  COUNT(r.id) AS "Parcelas Vencidas",
  SUM(r.valor_parcela) AS "Valor em Atraso",
  AVG(CURRENT_DATE - r.data_vencimento) AS "Atraso Médio (dias)"
FROM receivables r
JOIN unified_sales v ON v.id = r.venda_id
WHERE r.status = 'pendente'
  AND r.data_vencimento < CURRENT_DATE
GROUP BY v.unidade_negocio
ORDER BY SUM(r.valor_parcela) DESC;

-- 5.3 Contas a receber - aging (por faixa de atraso)
SELECT
  CASE
    WHEN r.data_vencimento >= CURRENT_DATE THEN '0 - No prazo'
    WHEN r.data_vencimento >= CURRENT_DATE - INTERVAL '30 days' THEN '1-30 dias'
    WHEN r.data_vencimento >= CURRENT_DATE - INTERVAL '60 days' THEN '31-60 dias'
    WHEN r.data_vencimento >= CURRENT_DATE - INTERVAL '90 days' THEN '61-90 dias'
    ELSE '90+ dias'
  END AS "Faixa Atraso",
  COUNT(*) AS "Parcelas",
  SUM(r.valor_parcela) AS "Valor Total"
FROM receivables r
WHERE r.status IN ('pendente', 'em_compensacao')
  AND r.data_vencimento IS NOT NULL
GROUP BY
  CASE
    WHEN r.data_vencimento >= CURRENT_DATE THEN '0 - No prazo'
    WHEN r.data_vencimento >= CURRENT_DATE - INTERVAL '30 days' THEN '1-30 dias'
    WHEN r.data_vencimento >= CURRENT_DATE - INTERVAL '60 days' THEN '31-60 dias'
    WHEN r.data_vencimento >= CURRENT_DATE - INTERVAL '90 days' THEN '61-90 dias'
    ELSE '90+ dias'
  END
ORDER BY
  CASE
    WHEN r.data_vencimento >= CURRENT_DATE THEN 1
    WHEN r.data_vencimento >= CURRENT_DATE - INTERVAL '30 days' THEN 2
    WHEN r.data_vencimento >= CURRENT_DATE - INTERVAL '60 days' THEN 3
    WHEN r.data_vencimento >= CURRENT_DATE - INTERVAL '90 days' THEN 4
    ELSE 5
  END;

-- 5.4 Previsão de recebimento por semana (próximos 30 dias)
SELECT
  DATE_TRUNC('week', r.data_vencimento) AS "Semana",
  COUNT(*) AS "Parcelas",
  SUM(r.valor_parcela) AS "Valor Previsto",
  STRING_AGG(DISTINCT v.customer_name_snapshot, ', ') AS "Clientes"
FROM receivables r
JOIN unified_sales v ON v.id = r.venda_id
WHERE r.status IN ('pendente', 'em_compensacao')
  AND r.data_vencimento >= CURRENT_DATE
  AND r.data_vencimento <= CURRENT_DATE + INTERVAL '30 days'
GROUP BY DATE_TRUNC('week', r.data_vencimento)
ORDER BY "Semana";

-- ============================================================================
-- SEÇÃO 6: AUDITORIA E CONTROLE
-- ============================================================================

-- 6.1 Histórico de replanejamentos
SELECT
  venda_id,
  parcela_numero,
  descricao,
  valor_parcela,
  status,
  observacoes,
  created_at,
  updated_at
FROM receivables
WHERE observacoes LIKE '%replanejamento%'
ORDER BY venda_id, created_at;

-- 6.2 Recebíveis cancelados (histórico)
SELECT
  r.id,
  v.sale_number AS "Venda",
  v.customer_name_snapshot AS "Cliente",
  r.parcela_numero AS "Parcela",
  r.valor_parcela AS "Valor",
  r.observacoes AS "Motivo",
  r.updated_at AS "Data Cancelamento"
FROM receivables r
JOIN unified_sales v ON v.id = r.venda_id
WHERE r.status = 'cancelado'
ORDER BY r.updated_at DESC;

-- 6.3 Movimentos de caixa vinculados a recebíveis
SELECT
  r.id AS "Recebível ID",
  v.sale_number AS "Venda",
  r.parcela_numero AS "Parcela",
  r.valor_parcela AS "Valor Parcela",
  r.valor_recebido AS "Valor Recebido",
  r.data_recebimento AS "Data Recebimento",
  r.cash_flow_id AS "Movimento Caixa ID",
  cf.description AS "Descrição Caixa"
FROM receivables r
JOIN unified_sales v ON v.id = r.venda_id
LEFT JOIN cash_flow cf ON cf.id = r.cash_flow_id
WHERE r.status = 'pago'
ORDER BY r.data_recebimento DESC;

-- 6.4 Vendas sem recebíveis (ERRO - não deveria existir)
SELECT
  s.id,
  s.sale_number,
  s.customer_name_snapshot,
  s.valor_total,
  s.created_at
FROM unified_sales s
LEFT JOIN receivables r ON r.venda_id = s.id
WHERE r.id IS NULL
  AND s.status = 'ativa';

-- 6.5 Orçamentos aprovados sem venda (ERRO - verificar)
SELECT
  'quotes' AS tabela,
  id,
  customer_id,
  total_value,
  approval_status,
  sale_created,
  approved_at
FROM quotes
WHERE approval_status = 'aprovado'
  AND sale_created = false
UNION ALL
SELECT
  'ribbed_slab_quotes' AS tabela,
  id,
  customer_id,
  0 as total_value,
  approval_status,
  sale_created,
  approved_at
FROM ribbed_slab_quotes
WHERE approval_status = 'aprovado'
  AND sale_created = false
UNION ALL
SELECT
  'engineering_projects' AS tabela,
  id,
  customer_id,
  total_value,
  approval_status,
  sale_created,
  approved_at
FROM engineering_projects
WHERE approval_status = 'aprovado'
  AND sale_created = false;

-- ============================================================================
-- SEÇÃO 7: OPERAÇÕES ADMINISTRATIVAS
-- ============================================================================

-- 7.1 Recalcular total da venda (caso necessário)
-- ATENÇÃO: Execute apenas se houver inconsistência
UPDATE unified_sales s
SET valor_total = (
  SELECT COALESCE(SUM(valor_parcela), 0)
  FROM receivables r
  WHERE r.venda_id = s.id
    AND r.status != 'cancelado'
)
WHERE s.id = '___INSERIR_ID_DA_VENDA___';

-- 7.2 Marcar cheque como devolvido
UPDATE cheque_details
SET
  status_cheque = 'devolvido',
  motivo_devolucao = '___INSERIR_MOTIVO___',
  updated_at = NOW()
WHERE id = '___INSERIR_ID_DO_CHEQUE___';

-- Voltar recebível para pendente
UPDATE receivables
SET
  status = 'pendente',
  observacoes = COALESCE(observacoes, '') || ' | Cheque devolvido em ' || NOW()::text,
  updated_at = NOW()
WHERE id = (
  SELECT receivable_id FROM cheque_details WHERE id = '___INSERIR_ID_DO_CHEQUE___'
);

-- 7.3 Cancelar venda completa (com todos os recebíveis)
BEGIN;

-- Cancelar todos os recebíveis não pagos
UPDATE receivables
SET
  status = 'cancelado',
  observacoes = COALESCE(observacoes, '') || ' | Venda cancelada em ' || NOW()::text,
  updated_at = NOW()
WHERE venda_id = '___INSERIR_ID_DA_VENDA___'
  AND status != 'pago';

-- Marcar venda como cancelada
UPDATE unified_sales
SET
  status = 'cancelada',
  observacoes = COALESCE(observacoes, '') || ' | Cancelada em ' || NOW()::text,
  updated_at = NOW()
WHERE id = '___INSERIR_ID_DA_VENDA___';

COMMIT;

-- 7.4 Limpar dados de teste (CUIDADO - apenas em desenvolvimento)
-- DELETE FROM cheque_details WHERE created_at >= '2026-01-17';
-- DELETE FROM receivables WHERE created_at >= '2026-01-17';
-- DELETE FROM sale_items_snapshot WHERE created_at >= '2026-01-17';
-- DELETE FROM unified_sales WHERE created_at >= '2026-01-17';

-- ============================================================================
-- SEÇÃO 8: VIEWS ÚTEIS PERSONALIZADAS
-- ============================================================================

-- 8.1 View: Recebíveis pendentes com detalhes completos
CREATE OR REPLACE VIEW v_receivables_pending_full AS
SELECT
  r.id,
  r.venda_id,
  v.sale_number,
  v.origem_tipo,
  v.unidade_negocio,
  v.customer_name_snapshot,
  c.email as customer_email,
  c.phone as customer_phone,
  r.parcela_numero,
  r.descricao,
  r.valor_parcela,
  r.data_vencimento,
  CASE
    WHEN r.data_vencimento < CURRENT_DATE THEN (CURRENT_DATE - r.data_vencimento)
    ELSE 0
  END as dias_atraso,
  r.forma_pagamento,
  r.status,
  r.observacoes
FROM receivables r
JOIN unified_sales v ON v.id = r.venda_id
LEFT JOIN customers c ON c.id = v.customer_id
WHERE r.status IN ('pendente', 'em_compensacao')
ORDER BY r.data_vencimento NULLS LAST;

-- 8.2 View: Resumo financeiro por cliente
CREATE OR REPLACE VIEW v_customer_financial_summary AS
SELECT
  c.id as customer_id,
  c.name as customer_name,
  COUNT(DISTINCT s.id) as total_vendas,
  SUM(s.valor_total) as valor_total_vendas,
  SUM(CASE WHEN r.status = 'pago' THEN r.valor_recebido ELSE 0 END) as total_recebido,
  SUM(CASE WHEN r.status IN ('pendente', 'em_compensacao') THEN r.valor_parcela ELSE 0 END) as total_pendente,
  SUM(CASE WHEN r.status = 'pendente' AND r.data_vencimento < CURRENT_DATE THEN r.valor_parcela ELSE 0 END) as total_vencido,
  MAX(r.data_recebimento) as ultimo_recebimento,
  MIN(CASE WHEN r.status IN ('pendente', 'em_compensacao') THEN r.data_vencimento END) as proximo_vencimento
FROM customers c
LEFT JOIN unified_sales s ON s.customer_id = c.id
LEFT JOIN receivables r ON r.venda_id = s.id AND r.status != 'cancelado'
GROUP BY c.id, c.name;

-- ============================================================================
-- FIM DO ARQUIVO
-- ============================================================================
