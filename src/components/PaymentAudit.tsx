import { useState, useCallback } from 'react';
import {
  ShieldCheck, AlertTriangle, XCircle, CheckCircle2, RefreshCw,
  Wrench, Download, ChevronDown, ChevronRight, Info, Trash2,
  FileCode2, Database, TrendingUp, Users, Calendar, Filter,
  Tag, CreditCard, Copy,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

type IssueSeverity = 'critical' | 'warning' | 'info';
type IssueCategory =
  | 'orphan'
  | 'inconsistency'
  | 'duplicate'
  | 'missing_cashflow'
  | 'installment_mismatch'
  | 'bad_category';

interface AuditIssue {
  id: string;
  severity: IssueSeverity;
  category: IssueCategory;
  title: string;
  detail: string;
  revenue_id?: string;
  cashflow_id?: string;
  work_item_id?: string;
  amount: number;
  customer_name?: string;
  work_name?: string;
  payment_date?: string;
  fix_description?: string;
  fix_action?: () => Promise<void>;
  auto_fixable: boolean;
  sql_hint?: string;
}

interface AuditSummary {
  total_revenues: number;
  total_cashflows_linked: number;
  total_works: number;
  total_customers: number;
  total_issues: number;
  total_at_risk: number;
  issues_by_category: Record<string, number>;
  issues_by_severity: Record<string, number>;
  ran_at: string;
  period_label: string;
}

interface DateRange {
  from: string;
  to: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<IssueCategory, string> = {
  orphan: 'Pagamento Orfao',
  inconsistency: 'Inconsistencia',
  duplicate: 'Duplicacao',
  missing_cashflow: 'FC Ausente',
  installment_mismatch: 'Parcela Divergente',
  bad_category: 'Categorizacao Errada',
};

const CATEGORY_DESCRIPTIONS: Record<IssueCategory, string> = {
  orphan: 'Pagamentos sem cliente ou obra valida',
  inconsistency: 'Cliente, valor ou obra inconsistentes entre tabelas',
  duplicate: 'Mesma receita registrada mais de uma vez',
  missing_cashflow: 'Receitas sem entrada correspondente no fluxo de caixa',
  installment_mismatch: 'Parcelas pagas sem receita ou com valores divergentes',
  bad_category: 'Itens de obra aparecendo como pagamento ou vice-versa',
};

const ORIGIN_LABELS: Record<string, string> = {
  quote: 'Orcamento',
  ribbed_slab_quote: 'Orcamento Laje',
  construction_work: 'Obra',
};

const SEVERITY_BORDER: Record<IssueSeverity, string> = {
  critical: 'border-red-300 bg-red-50',
  warning: 'border-yellow-300 bg-yellow-50',
  info: 'border-blue-200 bg-blue-50',
};

const SEVERITY_BADGE: Record<IssueSeverity, string> = {
  critical: 'bg-red-100 text-red-800',
  warning: 'bg-yellow-100 text-yellow-800',
  info: 'bg-blue-100 text-blue-800',
};

const SEVERITY_LABEL: Record<IssueSeverity, string> = {
  critical: 'Critico',
  warning: 'Atencao',
  info: 'Info',
};

const SEVERITY_ICON_CLS: Record<IssueSeverity, string> = {
  critical: 'text-red-600',
  warning: 'text-yellow-600',
  info: 'text-blue-600',
};

// Known income categories for cash_flow — entries NOT in this set are suspicious
const KNOWN_INCOME_CATEGORIES = new Set([
  'receita_cliente',
  'Serviços de Engenharia',
  'Servicos de Engenharia',
  'Venda de Produtos',
  'Venda Construtora',
  'Servicos de Muck',
  'Outras Receitas',
  'income',
  'receita',
  'pagamento',
  'Pagamento',
]);

// Categories that indicate an item was wrongly booked as income
const COST_LIKE_INCOME_CATEGORIES = [
  'Item da Obra',
  'item_obra',
  'custo',
  'cost',
  'despesa',
  'expense',
  'material',
  'produto',
  'service',
  'servico',
];

// ─── Phase-2 SQL Queries (structured, one per dimension) ──────────────────────

interface SqlQuery {
  id: string;
  label: string;
  description: string;
  color: string;
  sql: string;
}

const PHASE2_QUERIES: SqlQuery[] = [
  {
    id: 'q1',
    label: 'Q1 — Pagamentos Orfaos',
    description: 'Identifica receitas sem cliente valido, sem origem ou vinculadas a obras inexistentes, agrupando por tipo de problema e valor em risco.',
    color: 'text-red-600',
    sql: `-- ================================================================
-- QUERY 1: PAGAMENTOS ORFAOS
-- Identifica pagamentos sem vinculo correto, agrupados por status
-- ================================================================
WITH pagamentos_orfaos AS (
  SELECT
    cr.id,
    cr.customer_id,
    cr.origin_type,
    cr.origin_id,
    cr.payment_amount,
    cr.payment_date,
    CASE
      WHEN cr.customer_id IS NULL
        THEN 'SEM_CLIENTE'
      WHEN cr.origin_id IS NULL
        THEN 'SEM_ORIGEM'
      WHEN cr.origin_type = 'construction_work'
        AND NOT EXISTS (
          SELECT 1 FROM construction_works cw
          WHERE cw.id = cr.origin_id
        ) THEN 'OBRA_NAO_EXISTE'
      WHEN cr.origin_type = 'quote'
        AND NOT EXISTS (
          SELECT 1 FROM quotes q
          WHERE q.id = cr.origin_id
        ) THEN 'ORCAMENTO_NAO_EXISTE'
      ELSE 'OK'
    END AS status_vinculo
  FROM customer_revenue cr
  WHERE COALESCE(cr.estornado, false) = false
)
SELECT
  status_vinculo,
  COUNT(*)               AS total_orfaos,
  SUM(payment_amount)    AS valor_em_risco,
  ARRAY_AGG(id)          AS ids_afetados
FROM pagamentos_orfaos
WHERE status_vinculo <> 'OK'
GROUP BY status_vinculo
ORDER BY valor_em_risco DESC NULLS LAST;

-- Detalhe individual de cada orfao:
SELECT
  po.id,
  po.status_vinculo,
  c.name             AS customer_name,
  po.origin_type,
  po.origin_id,
  po.payment_amount,
  po.payment_date
FROM (
  SELECT cr.*,
    CASE
      WHEN cr.customer_id IS NULL THEN 'SEM_CLIENTE'
      WHEN cr.origin_id IS NULL THEN 'SEM_ORIGEM'
      WHEN cr.origin_type = 'construction_work'
           AND NOT EXISTS (SELECT 1 FROM construction_works WHERE id = cr.origin_id)
        THEN 'OBRA_NAO_EXISTE'
      WHEN cr.origin_type = 'quote'
           AND NOT EXISTS (SELECT 1 FROM quotes WHERE id = cr.origin_id)
        THEN 'ORCAMENTO_NAO_EXISTE'
      ELSE 'OK'
    END AS status_vinculo
  FROM customer_revenue cr
  WHERE COALESCE(cr.estornado, false) = false
) po
LEFT JOIN customers c ON c.id = po.customer_id
WHERE po.status_vinculo <> 'OK'
ORDER BY po.payment_date DESC;`,
  },
  {
    id: 'q2',
    label: 'Q2 — Inconsistencias de Vinculo',
    description: 'Detecta divergencias de customer_id entre customer_revenue e construction_works, e entre customer_revenue e cash_flow vinculado.',
    color: 'text-orange-600',
    sql: `-- ================================================================
-- QUERY 2: INCONSISTENCIAS DE VINCULO
-- Divergencias de customer_id entre tabelas relacionadas
-- ================================================================

-- [2A] customer_revenue aponta para obra de outro cliente
SELECT
  cr.id              AS revenue_id,
  cr.customer_id     AS revenue_customer_id,
  cust.name          AS revenue_customer,
  cw.customer_id     AS work_customer_id,
  c2.name            AS work_customer,
  cw.work_name,
  cr.payment_date,
  cr.payment_amount,
  'CLIENTE_OBRA_DIVERGE' AS tipo_inconsistencia
FROM customer_revenue cr
JOIN construction_works cw ON cw.id = cr.origin_id
JOIN customers cust ON cust.id = cr.customer_id
JOIN customers c2   ON c2.id = cw.customer_id
WHERE cr.origin_type = 'construction_work'
  AND cr.customer_id IS DISTINCT FROM cw.customer_id
  AND COALESCE(cr.estornado, false) = false
ORDER BY cr.payment_date DESC;

-- [2B] customer_id divergente entre customer_revenue e cash_flow vinculado
SELECT
  cr.id              AS revenue_id,
  cf.id              AS cashflow_id,
  cr.customer_id     AS revenue_customer_id,
  c1.name            AS revenue_customer,
  cf.customer_id     AS cashflow_customer_id,
  c2.name            AS cashflow_customer,
  cr.payment_date,
  cr.payment_amount,
  'CLIENTE_CF_DIVERGE' AS tipo_inconsistencia
FROM customer_revenue cr
JOIN cash_flow cf ON cf.customer_revenue_id = cr.id
LEFT JOIN customers c1 ON c1.id = cr.customer_id
LEFT JOIN customers c2 ON c2.id = cf.customer_id
WHERE cf.customer_id IS NOT NULL
  AND cf.customer_id IS DISTINCT FROM cr.customer_id
  AND COALESCE(cr.estornado, false) = false
ORDER BY cr.payment_date DESC;

-- Resumo agregado das duas inconsistencias:
WITH inconsistencias AS (
  SELECT 'CLIENTE_OBRA_DIVERGE' AS tipo, cr.payment_amount
  FROM customer_revenue cr
  JOIN construction_works cw ON cw.id = cr.origin_id
  WHERE cr.origin_type = 'construction_work'
    AND cr.customer_id IS DISTINCT FROM cw.customer_id
    AND COALESCE(cr.estornado, false) = false
  UNION ALL
  SELECT 'CLIENTE_CF_DIVERGE', cr.payment_amount
  FROM customer_revenue cr
  JOIN cash_flow cf ON cf.customer_revenue_id = cr.id
  WHERE cf.customer_id IS NOT NULL
    AND cf.customer_id IS DISTINCT FROM cr.customer_id
    AND COALESCE(cr.estornado, false) = false
)
SELECT tipo, COUNT(*) AS total_registros, SUM(payment_amount) AS valor_total_afetado
FROM inconsistencias
GROUP BY tipo
ORDER BY valor_total_afetado DESC NULLS LAST;`,
  },
  {
    id: 'q3',
    label: 'Q3 — Duplicacoes',
    description: 'Encontra receitas duplicadas no customer_revenue, entradas de caixa legadas coexistindo com registros modernos, e duplicatas exatas no cash_flow.',
    color: 'text-yellow-600',
    sql: `-- ================================================================
-- QUERY 3: DUPLICACOES
-- Receitas e entradas de caixa registradas mais de uma vez
-- ================================================================

-- [3A] Receitas duplicadas: mesmo (customer_id, origin_type, origin_id)
SELECT
  cr.customer_id,
  c.name             AS customer_name,
  cr.origin_type,
  cr.origin_id,
  COUNT(*)           AS total_duplicatas,
  SUM(cr.payment_amount) AS soma_pago,
  MIN(cr.payment_date)   AS primeira_data,
  MAX(cr.payment_date)   AS ultima_data,
  ARRAY_AGG(cr.id ORDER BY cr.created_at DESC) AS ids_duplicados
FROM customer_revenue cr
LEFT JOIN customers c ON c.id = cr.customer_id
WHERE COALESCE(cr.estornado, false) = false
GROUP BY cr.customer_id, c.name, cr.origin_type, cr.origin_id
HAVING COUNT(*) > 1
ORDER BY soma_pago DESC;

-- [3B] Entradas de caixa legadas (sem customer_revenue_id) para obras
--     que JA possuem customer_revenue moderno
WITH revenue_work_ids AS (
  SELECT DISTINCT origin_id
  FROM customer_revenue
  WHERE origin_type = 'construction_work'
    AND COALESCE(estornado, false) = false
)
SELECT
  cf.id              AS cashflow_id,
  cf.construction_work_id,
  cw.work_name,
  cf.date,
  cf.amount,
  cf.description,
  cf.category,
  'CF_LEGADO_DUPLICADO' AS tipo_duplicacao
FROM cash_flow cf
JOIN construction_works cw ON cw.id = cf.construction_work_id
WHERE cf.type = 'income'
  AND cf.customer_revenue_id IS NULL
  AND cf.construction_work_id IN (SELECT origin_id FROM revenue_work_ids)
ORDER BY cf.date DESC;

-- [3C] Duplicatas exatas no cash_flow: mesmo cliente + data + valor + categoria
SELECT
  customer_id,
  date,
  amount,
  category,
  COUNT(*)       AS num_duplicatas,
  ARRAY_AGG(id) AS ids
FROM cash_flow
WHERE type = 'income'
GROUP BY customer_id, date, amount, category
HAVING COUNT(*) > 1
ORDER BY num_duplicatas DESC, amount DESC;

-- Resumo consolidado:
SELECT
  'RECEITA_DUPLICADA'    AS tipo,
  COUNT(*)               AS grupos_afetados,
  SUM(soma_pago)         AS valor_duplicado
FROM (
  SELECT SUM(payment_amount) AS soma_pago
  FROM customer_revenue
  WHERE COALESCE(estornado, false) = false
  GROUP BY customer_id, origin_type, origin_id
  HAVING COUNT(*) > 1
) dup_rev
UNION ALL
SELECT
  'CF_LEGADO_DUPLICADO',
  COUNT(*),
  SUM(amount)
FROM cash_flow cf
WHERE type = 'income'
  AND customer_revenue_id IS NULL
  AND construction_work_id IN (
    SELECT DISTINCT origin_id FROM customer_revenue
    WHERE origin_type = 'construction_work'
      AND COALESCE(estornado, false) = false
  )
UNION ALL
SELECT
  'CF_EXATO_DUPLICADO',
  COUNT(*),
  SUM(amount * (cnt - 1))
FROM (
  SELECT amount, COUNT(*) AS cnt
  FROM cash_flow
  WHERE type = 'income'
  GROUP BY customer_id, date, amount, category
  HAVING COUNT(*) > 1
) d;`,
  },
  {
    id: 'q4',
    label: 'Q4 — Categorizacoes Incorretas',
    description: 'Localiza entradas de receita com categorias que indicam custo/despesa, e itens de obra com valor zerado ou negativo.',
    color: 'text-blue-600',
    sql: `-- ================================================================
-- QUERY 4: CATEGORIZACOES INCORRETAS
-- Entradas com tipo/categoria incoerente
-- ================================================================

-- [4A] cash_flow do tipo income com categoria que parece despesa/custo
SELECT
  cf.id,
  cf.date,
  cf.category,
  cf.description,
  cf.amount,
  cf.customer_id,
  c.name             AS customer_name,
  cf.construction_work_id,
  cf.business_unit,
  'CATEGORIA_CUSTO_COMO_RECEITA' AS tipo_problema
FROM cash_flow cf
LEFT JOIN customers c ON c.id = cf.customer_id
WHERE cf.type = 'income'
  AND lower(cf.category) = ANY(ARRAY[
    'item da obra', 'item_obra', 'custo', 'cost',
    'despesa', 'expense', 'material', 'produto', 'servico'
  ])
ORDER BY cf.date DESC;

-- [4B] cash_flow income com categoria desconhecida (nao esta na lista padrao)
SELECT
  cf.id,
  cf.date,
  cf.category,
  cf.description,
  cf.amount,
  cf.business_unit,
  'CATEGORIA_DESCONHECIDA' AS tipo_problema
FROM cash_flow cf
WHERE cf.type = 'income'
  AND cf.category NOT IN (
    'receita_cliente',
    'Servicos de Engenharia', 'Serviços de Engenharia',
    'Venda de Produtos', 'Venda Construtora',
    'Servicos de Muck', 'Outras Receitas',
    'income', 'receita', 'pagamento', 'Pagamento',
    'item da obra', 'item_obra', 'custo', 'cost',
    'despesa', 'expense', 'material', 'produto', 'servico'
  )
ORDER BY cf.date DESC;

-- [4C] Itens de obra com preco zero ou negativo
SELECT
  cwi.id,
  cwi.work_id,
  cw.work_name,
  cwi.item_type,
  cwi.item_name,
  cwi.quantity,
  cwi.unit_price,
  cwi.total_price,
  'ITEM_OBRA_VALOR_INVALIDO' AS tipo_problema
FROM construction_work_items cwi
JOIN construction_works cw ON cw.id = cwi.work_id
WHERE cwi.total_price = 0
   OR cwi.unit_price < 0
ORDER BY cwi.total_price ASC;

-- Resumo por categoria suspeita:
SELECT
  lower(category)    AS categoria,
  COUNT(*)           AS total_entradas,
  SUM(amount)        AS valor_total,
  'CATEGORIA_CUSTO_COMO_RECEITA' AS tipo_problema
FROM cash_flow
WHERE type = 'income'
  AND lower(category) = ANY(ARRAY[
    'item da obra','item_obra','custo','cost',
    'despesa','expense','material','produto','servico'
  ])
GROUP BY lower(category)
ORDER BY valor_total DESC;`,
  },
  {
    id: 'q5',
    label: 'Q5 — Valores Inconsistentes',
    description: 'Verifica divergencias de valor entre customer_revenue e cash_flow, saldos mal calculados, parcelas cujo total nao fecha com o orcamento, e parcelas pagas sem receita registrada.',
    color: 'text-green-600',
    sql: `-- ================================================================
-- QUERY 5: VALORES INCONSISTENTES
-- Divergencias numericas entre tabelas relacionadas
-- ================================================================

-- [5A] Valor divergente entre customer_revenue e cash_flow vinculado
SELECT
  cr.id              AS revenue_id,
  cf.id              AS cashflow_id,
  c.name             AS customer_name,
  cr.payment_date,
  cr.payment_amount  AS valor_revenue,
  cf.amount          AS valor_cf,
  ABS(cr.payment_amount - cf.amount) AS diferenca,
  'VALOR_DIVERGE_CF'  AS tipo_problema
FROM customer_revenue cr
JOIN cash_flow cf ON cf.customer_revenue_id = cr.id
LEFT JOIN customers c ON c.id = cr.customer_id
WHERE ABS(cr.payment_amount - cf.amount) > 0.01
  AND COALESCE(cr.estornado, false) = false
ORDER BY diferenca DESC;

-- [5B] customer_revenue.balance != total_amount - paid_amount
SELECT
  cr.id,
  c.name             AS customer_name,
  cr.origin_type,
  cr.origin_description,
  cr.total_amount,
  cr.paid_amount,
  cr.balance         AS balance_atual,
  (cr.total_amount - cr.paid_amount) AS balance_esperado,
  ABS(cr.balance - (cr.total_amount - cr.paid_amount)) AS diferenca,
  'SALDO_INCONSISTENTE' AS tipo_problema
FROM customer_revenue cr
LEFT JOIN customers c ON c.id = cr.customer_id
WHERE ABS(cr.balance - (cr.total_amount - cr.paid_amount)) > 0.01
  AND cr.total_amount > 0
ORDER BY diferenca DESC;

-- [5C] Soma das parcelas difere do total do orcamento
SELECT
  q.id               AS quote_id,
  c.name             AS customer_name,
  q.total_value      AS valor_orcamento,
  COUNT(qi.id)       AS num_parcelas,
  SUM(qi.installment_amount) AS soma_parcelas,
  ABS(q.total_value - SUM(qi.installment_amount)) AS diferenca,
  'PARCELAS_NAO_BATEM' AS tipo_problema
FROM quotes q
JOIN customers c ON c.id = q.customer_id
JOIN quote_installments qi ON qi.quote_id = q.id
WHERE q.has_installment_schedule = true
  AND q.status = 'approved'
GROUP BY q.id, c.name, q.total_value
HAVING ABS(q.total_value - SUM(qi.installment_amount)) > 0.01
ORDER BY diferenca DESC;

-- [5D] Parcelas pagas sem customer_revenue correspondente
SELECT
  qi.id              AS installment_id,
  qi.quote_id,
  qi.installment_number,
  qi.installment_amount,
  qi.paid_amount,
  qi.payment_status,
  qi.due_date,
  c.name             AS customer_name,
  'PARCELA_PAGA_SEM_RECEITA' AS tipo_problema
FROM quote_installments qi
JOIN quotes q ON q.id = qi.quote_id
JOIN customers c ON c.id = q.customer_id
WHERE qi.payment_status = 'paid'
  AND NOT EXISTS (
    SELECT 1 FROM customer_revenue cr
    WHERE cr.origin_type = 'quote'
      AND cr.origin_id = qi.quote_id
  )
ORDER BY qi.due_date DESC;

-- Resumo executivo das 4 sub-dimensoes de valor:
WITH
  v_cf AS (
    SELECT COUNT(*) AS n, COALESCE(SUM(ABS(cr.payment_amount - cf.amount)),0) AS soma_div
    FROM customer_revenue cr
    JOIN cash_flow cf ON cf.customer_revenue_id = cr.id
    WHERE ABS(cr.payment_amount - cf.amount) > 0.01
      AND COALESCE(cr.estornado, false) = false
  ),
  v_saldo AS (
    SELECT COUNT(*) AS n, COALESCE(SUM(ABS(cr.balance - (cr.total_amount - cr.paid_amount))),0) AS soma_div
    FROM customer_revenue cr
    WHERE ABS(cr.balance - (cr.total_amount - cr.paid_amount)) > 0.01
      AND cr.total_amount > 0
  ),
  v_parc AS (
    SELECT COUNT(*) AS n, COALESCE(SUM(ABS(q.total_value - t.soma)),0) AS soma_div
    FROM quotes q
    JOIN (
      SELECT quote_id, SUM(installment_amount) AS soma
      FROM quote_installments GROUP BY quote_id
    ) t ON t.quote_id = q.id
    WHERE q.has_installment_schedule = true
      AND ABS(q.total_value - t.soma) > 0.01
  ),
  v_paid AS (
    SELECT COUNT(*) AS n, COALESCE(SUM(qi.paid_amount),0) AS soma_div
    FROM quote_installments qi
    JOIN quotes q ON q.id = qi.quote_id
    WHERE qi.payment_status = 'paid'
      AND NOT EXISTS (
        SELECT 1 FROM customer_revenue cr
        WHERE cr.origin_type = 'quote' AND cr.origin_id = qi.quote_id
      )
  )
SELECT 'VALOR_DIVERGE_CF'        AS tipo_problema, n, soma_div AS soma_divergencias FROM v_cf    UNION ALL
SELECT 'SALDO_INCONSISTENTE',                       n, soma_div FROM v_saldo UNION ALL
SELECT 'PARCELAS_NAO_BATEM',                        n, soma_div FROM v_parc  UNION ALL
SELECT 'PARCELA_PAGA_SEM_RECEITA',                  n, soma_div FROM v_paid
ORDER BY soma_divergencias DESC;`,
  },
];

// Bonus executive summary query
const SQL_EXECUTIVE_SUMMARY = `-- ================================================================
-- RESUMO EXECUTIVO — TODAS AS DIMENSOES EM UMA QUERY
-- ================================================================
WITH
  orfaos AS (
    SELECT COUNT(*) AS n, COALESCE(SUM(payment_amount), 0) AS valor
    FROM customer_revenue cr
    WHERE (
      cr.customer_id IS NULL
      OR cr.origin_id IS NULL
      OR (cr.origin_type = 'construction_work'
          AND NOT EXISTS (SELECT 1 FROM construction_works WHERE id = cr.origin_id))
      OR (cr.origin_type = 'quote'
          AND NOT EXISTS (SELECT 1 FROM quotes WHERE id = cr.origin_id))
    )
    AND COALESCE(cr.estornado, false) = false
  ),
  inconsistencias AS (
    SELECT COUNT(*) AS n, COALESCE(SUM(cr.payment_amount), 0) AS valor
    FROM customer_revenue cr
    JOIN construction_works cw ON cw.id = cr.origin_id
    WHERE cr.origin_type = 'construction_work'
      AND cr.customer_id IS DISTINCT FROM cw.customer_id
      AND COALESCE(cr.estornado, false) = false
  ),
  duplicatas AS (
    SELECT COUNT(*) AS n, COALESCE(SUM(soma_pago), 0) AS valor
    FROM (
      SELECT SUM(payment_amount) AS soma_pago
      FROM customer_revenue
      WHERE COALESCE(estornado, false) = false
      GROUP BY customer_id, origin_type, origin_id
      HAVING COUNT(*) > 1
    ) d
  ),
  cats_erradas AS (
    SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS valor
    FROM cash_flow
    WHERE type = 'income'
      AND lower(category) = ANY(ARRAY[
        'item da obra','item_obra','custo','cost',
        'despesa','expense','material','produto','servico'
      ])
  ),
  sem_cf AS (
    SELECT COUNT(*) AS n, COALESCE(SUM(cr.payment_amount), 0) AS valor
    FROM customer_revenue cr
    LEFT JOIN cash_flow cf ON cf.customer_revenue_id = cr.id
    WHERE cf.id IS NULL
      AND COALESCE(cr.estornado, false) = false
      AND cr.payment_amount > 0
  ),
  valor_diverge AS (
    SELECT COUNT(*) AS n, COALESCE(SUM(ABS(cr.payment_amount - cf.amount)), 0) AS valor
    FROM customer_revenue cr
    JOIN cash_flow cf ON cf.customer_revenue_id = cr.id
    WHERE ABS(cr.payment_amount - cf.amount) > 0.01
      AND COALESCE(cr.estornado, false) = false
  )
SELECT dimensao, n AS total_registros, valor AS valor_afetado
FROM (
  SELECT 'Q1 - Pagamentos Orfaos'        AS dimensao, n, valor FROM orfaos        UNION ALL
  SELECT 'Q2 - Inconsistencias Vinculo',              n, valor FROM inconsistencias UNION ALL
  SELECT 'Q3 - Duplicacoes',                          n, valor FROM duplicatas     UNION ALL
  SELECT 'Q4 - Categorizacoes Incorretas',            n, valor FROM cats_erradas   UNION ALL
  SELECT 'Q5 - FC Ausente',                           n, valor FROM sem_cf         UNION ALL
  SELECT 'Q5 - Valores Divergentes',                  n, valor FROM valor_diverge
) t
ORDER BY valor_afetado DESC;`;

// Legacy flat export (all queries combined)
const SQL_AUDIT_QUERIES = PHASE2_QUERIES.map(q => q.sql).join('\n\n') + '\n\n' + SQL_EXECUTIVE_SUMMARY;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (d?: string | null) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';

const today = () => new Date().toISOString().split('T')[0];
const firstDayOfYear = () => `${new Date().getFullYear()}-01-01`;

// ─── Sub-components ───────────────────────────────────────────────────────────

function SeverityIcon({ severity }: { severity: IssueSeverity }) {
  if (severity === 'critical') return <XCircle className={`h-5 w-5 flex-shrink-0 ${SEVERITY_ICON_CLS[severity]}`} />;
  if (severity === 'warning') return <AlertTriangle className={`h-5 w-5 flex-shrink-0 ${SEVERITY_ICON_CLS[severity]}`} />;
  return <Info className={`h-5 w-5 flex-shrink-0 ${SEVERITY_ICON_CLS[severity]}`} />;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PaymentAudit() {
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState<string | null>(null);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [issues, setIssues] = useState<AuditIssue[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [fixedIds, setFixedIds] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [showSqlPanel, setShowSqlPanel] = useState(false);
  const [activeQueryTab, setActiveQueryTab] = useState<string>('q1');
  const [dateRange, setDateRange] = useState<DateRange>({ from: firstDayOfYear(), to: today() });
  const [allPeriod, setAllPeriod] = useState(false);

  const runAudit = useCallback(async () => {
    setLoading(true);
    setIssues([]);
    setSummary(null);
    setFixedIds(new Set());
    setActiveFilter('all');

    try {
      const found: AuditIssue[] = [];

      // Build date filter for customer_revenue queries
      const revQuery = supabase
        .from('customer_revenue')
        .select(
          'id, customer_id, origin_type, origin_id, origin_description, ' +
          'total_amount, paid_amount, balance, payment_date, payment_amount, ' +
          'payment_method, notes, receipt_number, estornado, created_at, ' +
          'customers ( id, name )'
        )
        .order('payment_date', { ascending: false });

      if (!allPeriod) {
        revQuery.gte('payment_date', dateRange.from).lte('payment_date', dateRange.to);
      }

      // ── Parallel fetch ──────────────────────────────────────────────────
      const [
        { data: revenues, error: revErr },
        { data: cashflowsLinked, error: cfErr },
        { data: cashflowOrphan, error: ocfErr },
        { data: cashflowIncome, error: ciErr },
        { data: works, error: wErr },
        { data: customers, error: custErr },
        { data: quotesApproved, error: qErr },
        { data: installments, error: instErr },
        { data: workItems, error: wiErr },
      ] = await Promise.all([
        revQuery,

        supabase
          .from('cash_flow')
          .select('id, amount, date, description, type, customer_revenue_id, customer_id, category')
          .eq('type', 'income')
          .not('customer_revenue_id', 'is', null),

        supabase
          .from('cash_flow')
          .select('id, amount, date, description, construction_work_id, customer_id, category')
          .eq('type', 'income')
          .is('customer_revenue_id', null)
          .not('construction_work_id', 'is', null),

        supabase
          .from('cash_flow')
          .select('id, amount, date, description, category, business_unit, customer_id, customer_revenue_id, sale_id')
          .eq('type', 'income'),

        supabase
          .from('construction_works')
          .select('id, customer_id, work_name, total_contract_value, status'),

        supabase
          .from('customers')
          .select('id, name'),

        supabase
          .from('quotes')
          .select('id, customer_id, total_value, payment_status, paid_amount, status, has_installment_schedule')
          .eq('status', 'approved'),

        supabase
          .from('quote_installments')
          .select('id, quote_id, installment_number, installment_amount, paid_amount, payment_status, due_date'),

        supabase
          .from('construction_work_items')
          .select('id, work_id, item_type, item_name, unit_price, total_price')
          .or('total_price.eq.0,unit_price.lt.0'),
      ]);

      for (const [err, name] of [
        [revErr, 'customer_revenue'],
        [cfErr, 'cash_flow (linked)'],
        [ocfErr, 'cash_flow (orphan)'],
        [ciErr, 'cash_flow (income)'],
        [wErr, 'construction_works'],
        [custErr, 'customers'],
        [qErr, 'quotes'],
        [instErr, 'quote_installments'],
        [wiErr, 'construction_work_items'],
      ] as [unknown, string][]) {
        if (err) throw new Error(`Error loading ${name}: ${(err as any).message}`);
      }

      const workMap = new Map((works || []).map(w => [w.id, w]));
      const cfByRevId = new Map((cashflowsLinked || []).map(cf => [cf.customer_revenue_id, cf]));
      const validCustomerIds = new Set((customers || []).map(c => c.id));
      const quoteMap = new Map((quotesApproved || []).map(q => [q.id, q]));

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // DIMENSAO 1 — PAGAMENTOS ORFAOS
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      // [1A] customer_revenue sem customer valido
      for (const rev of revenues || []) {
        if (!validCustomerIds.has(rev.customer_id)) {
          found.push({
            id: `orphan-customer-${rev.id}`,
            severity: 'critical',
            category: 'orphan',
            title: 'Pagamento sem cliente valido',
            detail:
              `customer_revenue.customer_id = "${rev.customer_id}" nao existe na tabela customers. ` +
              `O cliente pode ter sido excluido apos o cadastro deste pagamento.`,
            revenue_id: rev.id,
            amount: Number(rev.payment_amount),
            payment_date: rev.payment_date,
            fix_description:
              'Vincule manualmente a um cliente existente ou exclua o registro apos confirmar que o valor esta registrado corretamente em outro lugar.',
            sql_hint:
              `SELECT id, name FROM customers ORDER BY name;\n\n` +
              `UPDATE customer_revenue SET customer_id = '<ID_CLIENTE>'\n` +
              `WHERE id = '${rev.id}';`,
            auto_fixable: false,
          });
        }
      }

      // [1B] Receitas de obra vinculadas a obra inexistente
      for (const rev of revenues || []) {
        if (rev.origin_type !== 'construction_work') continue;
        const work = workMap.get(rev.origin_id);
        if (!work) {
          found.push({
            id: `orphan-work-${rev.id}`,
            severity: 'critical',
            category: 'orphan',
            title: 'Pagamento vinculado a obra inexistente',
            detail:
              `origin_id = "${rev.origin_id}" nao existe em construction_works. ` +
              `A obra pode ter sido excluida ou o ID foi cadastrado errado.`,
            revenue_id: rev.id,
            amount: Number(rev.payment_amount),
            customer_name: (rev.customers as any)?.name,
            payment_date: rev.payment_date,
            work_name: 'OBRA NAO ENCONTRADA',
            fix_description:
              'Localize a obra correta para este cliente e atualize o origin_id, ' +
              'ou exclua o pagamento apos verificacao.',
            sql_hint:
              `SELECT id, work_name FROM construction_works\n` +
              `WHERE customer_id = '${rev.customer_id}';\n\n` +
              `UPDATE customer_revenue SET origin_id = '<ID_OBRA_CORRETA>'\n` +
              `WHERE id = '${rev.id}';`,
            auto_fixable: false,
          });
        }
      }

      // [1C] cash_flow income sem customer, sem customer_revenue_id, sem sale_id
      // (entradas manuais potencialmente orfas)
      const orphanIncomeEntries = (cashflowIncome || []).filter(
        cf => !cf.customer_id && !cf.customer_revenue_id && !cf.sale_id
      );
      for (const cf of orphanIncomeEntries) {
        found.push({
          id: `orphan-cf-nolink-${cf.id}`,
          severity: 'info',
          category: 'orphan',
          title: 'Entrada de caixa sem vinculo a cliente ou receita',
          detail:
            `Entrada de caixa ID …${cf.id.slice(-8)} (${cf.description || cf.category}, ${fmt(Number(cf.amount))}) ` +
            `nao possui customer_id, customer_revenue_id nem sale_id. ` +
            `Pode ser um lancamento manual sem rastreabilidade.`,
          cashflow_id: cf.id,
          amount: Number(cf.amount),
          payment_date: cf.date,
          fix_description:
            'Verifique se este lancamento manual e legitimo. Se for um pagamento de cliente, vincule ao customer_revenue correto.',
          sql_hint:
            `SELECT id, date, category, description, amount, business_unit\n` +
            `FROM cash_flow WHERE id = '${cf.id}';`,
          auto_fixable: false,
        });
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // DIMENSAO 2 — INCONSISTENCIAS DE VINCULO
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      // [2A] cliente do pagamento != cliente da obra
      for (const rev of revenues || []) {
        if (rev.origin_type !== 'construction_work') continue;
        const work = workMap.get(rev.origin_id);
        if (!work) continue;
        if (work.customer_id !== rev.customer_id) {
          const workCustomerName = (customers || []).find(c => c.id === work.customer_id)?.name;
          found.push({
            id: `work-customer-mismatch-${rev.id}`,
            severity: 'warning',
            category: 'inconsistency',
            title: 'Cliente do pagamento difere do cliente da obra',
            detail:
              `Obra "${work.work_name}" pertence a "${workCustomerName ?? work.customer_id.slice(-8)}", ` +
              `mas o pagamento esta vinculado a "${(rev.customers as any)?.name ?? rev.customer_id.slice(-8)}".`,
            revenue_id: rev.id,
            amount: Number(rev.payment_amount),
            customer_name: (rev.customers as any)?.name,
            work_name: work.work_name,
            payment_date: rev.payment_date,
            fix_description: `Corrigir customer_revenue.customer_id para "${workCustomerName}" (cliente da obra).`,
            sql_hint:
              `UPDATE customer_revenue SET customer_id = '${work.customer_id}'\nWHERE id = '${rev.id}';\n\n` +
              `UPDATE cash_flow SET customer_id = '${work.customer_id}'\nWHERE customer_revenue_id = '${rev.id}';`,
            fix_action: async () => {
              await supabase.from('customer_revenue').update({ customer_id: work.customer_id }).eq('id', rev.id);
              const linkedCF = cfByRevId.get(rev.id);
              if (linkedCF) await supabase.from('cash_flow').update({ customer_id: work.customer_id }).eq('id', linkedCF.id);
            },
            auto_fixable: true,
          });
        }
      }

      // [2B] customer_id divergente entre customer_revenue e cash_flow vinculado
      for (const rev of revenues || []) {
        if ((rev as any).estornado) continue;
        const linkedCF = cfByRevId.get(rev.id);
        if (!linkedCF) continue;
        if (linkedCF.customer_id && linkedCF.customer_id !== rev.customer_id) {
          const cfCustName = (customers || []).find(c => c.id === linkedCF.customer_id)?.name;
          found.push({
            id: `cf-customer-mismatch-${rev.id}`,
            severity: 'critical',
            category: 'inconsistency',
            title: 'Cliente divergente: Receita vs Fluxo de Caixa',
            detail:
              `customer_revenue aponta para "${(rev.customers as any)?.name ?? '?'}" ` +
              `mas o cash_flow vinculado aponta para "${cfCustName ?? '?'}". ` +
              `Os dois registros estao vinculados por customer_revenue_id mas com clientes diferentes.`,
            revenue_id: rev.id,
            cashflow_id: linkedCF.id,
            amount: Number(rev.payment_amount),
            customer_name: (rev.customers as any)?.name,
            payment_date: rev.payment_date,
            fix_description: 'Atualizar cash_flow.customer_id para coincidir com customer_revenue.',
            sql_hint: `UPDATE cash_flow SET customer_id = '${rev.customer_id}'\nWHERE id = '${linkedCF.id}';`,
            fix_action: async () => {
              await supabase.from('cash_flow').update({ customer_id: rev.customer_id }).eq('id', linkedCF.id);
            },
            auto_fixable: true,
          });
        }
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // DIMENSAO 3 — DUPLICACOES
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      // [3A] Entradas de caixa legadas (construction_work_id, sem customer_revenue_id)
      // coexistindo com customer_revenue moderno para a mesma obra
      const worksWithRevenue = new Set(
        (revenues || [])
          .filter(r => r.origin_type === 'construction_work' && !(r as any).estornado)
          .map(r => r.origin_id)
      );
      for (const cf of cashflowOrphan || []) {
        if (!cf.construction_work_id) continue;
        if (!worksWithRevenue.has(cf.construction_work_id)) continue;
        const work = workMap.get(cf.construction_work_id);
        found.push({
          id: `duplicate-cf-legacy-${cf.id}`,
          severity: 'warning',
          category: 'duplicate',
          title: 'Entrada de caixa legada duplica receita da obra',
          detail:
            `Obra "${work?.work_name ?? cf.construction_work_id.slice(-8)}" ` +
            `tem entrada de caixa ID …${cf.id.slice(-8)} sem vinculo a customer_revenue, ` +
            `mas ja existe customer_revenue para esta obra. ` +
            `Provavelmente e um registro criado antes da migracao para o sistema de receitas.`,
          cashflow_id: cf.id,
          amount: Number(cf.amount),
          work_name: work?.work_name,
          payment_date: cf.date,
          fix_description:
            'Confirme se este valor ja esta representado em customer_revenue. Se sim, exclua esta entrada legada.',
          sql_hint:
            `SELECT * FROM customer_revenue WHERE origin_id = '${cf.construction_work_id}';\n\n` +
            `-- Se confirmado como duplicata:\nDELETE FROM cash_flow WHERE id = '${cf.id}';`,
          fix_action: async () => {
            await supabase.from('cash_flow').delete().eq('id', cf.id);
          },
          auto_fixable: true,
        });
      }

      // [3B] Detectar duplicatas exatas em customer_revenue (mesmo origin, nao estornado)
      const revByOrigin = new Map<string, typeof revenues>();
      for (const rev of revenues || []) {
        if ((rev as any).estornado) continue;
        const key = `${rev.customer_id}|${rev.origin_type}|${rev.origin_id}`;
        if (!revByOrigin.has(key)) revByOrigin.set(key, []);
        revByOrigin.get(key)!.push(rev);
      }
      for (const [, group] of revByOrigin.entries()) {
        if (!group || group.length < 2) continue;
        for (const rev of group.slice(1)) {
          const originLabel = ORIGIN_LABELS[rev.origin_type] || rev.origin_type;
          found.push({
            id: `duplicate-revenue-${rev.id}`,
            severity: 'critical',
            category: 'duplicate',
            title: `Receita duplicada: mesmo ${originLabel} registrado mais de uma vez`,
            detail:
              `Existem ${group.length} registros em customer_revenue com o mesmo (customer_id, origin_type, origin_id). ` +
              `IDs: ${group.map(r => '…' + r.id.slice(-8)).join(', ')}. ` +
              `A unique constraint deveria impedir isso — pode indicar dados corrompidos.`,
            revenue_id: rev.id,
            amount: Number(rev.payment_amount),
            customer_name: (rev.customers as any)?.name,
            payment_date: rev.payment_date,
            fix_description:
              'Mantenha apenas o registro mais recente (ou o correto) e exclua os demais. ' +
              'Verifique se cada entrada tem um cash_flow vinculado antes de excluir.',
            sql_hint:
              `SELECT id, payment_date, payment_amount, created_at\n` +
              `FROM customer_revenue\n` +
              `WHERE customer_id = '${rev.customer_id}'\n` +
              `  AND origin_type = '${rev.origin_type}'\n` +
              `  AND origin_id = '${rev.origin_id}'\n` +
              `ORDER BY created_at DESC;`,
            auto_fixable: false,
          });
        }
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // DIMENSAO 4 — CATEGORIZACOES INCORRETAS
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      // [4A] cash_flow income com categoria que parece despesa/custo
      for (const cf of cashflowIncome || []) {
        const cat = (cf.category || '').toLowerCase();
        const isSuspicious = COST_LIKE_INCOME_CATEGORIES.some(c => cat.includes(c.toLowerCase()));
        if (!isSuspicious) continue;
        found.push({
          id: `bad-category-cf-${cf.id}`,
          severity: 'warning',
          category: 'bad_category',
          title: 'Receita com categoria de custo/item',
          detail:
            `A entrada de caixa ID …${cf.id.slice(-8)} esta como "income" (receita) ` +
            `mas tem categoria "${cf.category}", que parece ser um custo ou item de obra.`,
          cashflow_id: cf.id,
          amount: Number(cf.amount),
          payment_date: cf.date,
          fix_description:
            'Verifique se esta entrada deveria ser do tipo "expense" ou se a categoria esta errada. ' +
            'Corrija o tipo ou a categoria conforme o lancamento real.',
          sql_hint:
            `UPDATE cash_flow SET category = 'receita_cliente'\nWHERE id = '${cf.id}';\n\n` +
            `-- OU, se for na verdade uma despesa:\n` +
            `UPDATE cash_flow SET type = 'expense', category = 'Outras Despesas'\nWHERE id = '${cf.id}';`,
          auto_fixable: false,
        });
      }

      // [4B] construction_work_items com preco zero (item sem valor)
      for (const wi of workItems || []) {
        if (Number(wi.total_price) === 0 || Number(wi.unit_price) < 0) {
          const work = workMap.get(wi.work_id);
          found.push({
            id: `bad-category-wi-zero-${wi.id}`,
            severity: 'info',
            category: 'bad_category',
            title: 'Item de obra com valor zerado ou negativo',
            detail:
              `Item "${wi.item_name}" (tipo: ${wi.item_type}) da obra "${work?.work_name ?? wi.work_id.slice(-8)}" ` +
              `tem preco_unitario = ${fmt(Number(wi.unit_price))} e total = ${fmt(Number(wi.total_price))}. ` +
              `Itens sem valor nao contribuem para o custo da obra e podem ser cadastros errados.`,
            work_item_id: wi.id,
            amount: Number(wi.total_price),
            work_name: work?.work_name,
            fix_description:
              'Corrija o preco unitario e a quantidade do item, ou exclua-o se for um cadastro equivocado.',
            sql_hint:
              `UPDATE construction_work_items\n` +
              `SET unit_price = <VALOR_CORRETO>,\n` +
              `    total_price = quantity * <VALOR_CORRETO>\n` +
              `WHERE id = '${wi.id}';`,
            auto_fixable: false,
          });
        }
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // DIMENSAO 5 — VALORES INCONSISTENTES
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      // [5A] Valor divergente entre customer_revenue e cash_flow
      for (const rev of revenues || []) {
        if ((rev as any).estornado) continue;
        const linkedCF = cfByRevId.get(rev.id);
        if (!linkedCF) continue;
        const revAmt = Number(rev.payment_amount);
        const cfAmt = Number(linkedCF.amount);
        if (Math.abs(revAmt - cfAmt) > 0.01) {
          found.push({
            id: `amount-mismatch-${rev.id}`,
            severity: 'critical',
            category: 'inconsistency',
            title: 'Valor divergente: Receita vs Fluxo de Caixa',
            detail:
              `customer_revenue.payment_amount = ${fmt(revAmt)} ` +
              `vs cash_flow.amount = ${fmt(cfAmt)}. ` +
              `Diferenca de ${fmt(Math.abs(revAmt - cfAmt))}. ` +
              `Os dois devem ser sempre identicos — o cash_flow e gerado automaticamente a partir da receita.`,
            revenue_id: rev.id,
            cashflow_id: linkedCF.id,
            amount: revAmt,
            customer_name: (rev.customers as any)?.name,
            payment_date: rev.payment_date,
            fix_description: `Corrigir cash_flow.amount para ${fmt(revAmt)} (customer_revenue e a fonte da verdade).`,
            sql_hint: `UPDATE cash_flow SET amount = ${revAmt}\nWHERE id = '${linkedCF.id}';`,
            fix_action: async () => {
              await supabase.from('cash_flow').update({ amount: revAmt }).eq('id', linkedCF.id);
            },
            auto_fixable: true,
          });
        }
      }

      // [5B] customer_revenue.balance != total_amount - paid_amount
      for (const rev of revenues || []) {
        const total = Number(rev.total_amount);
        const paid = Number(rev.paid_amount);
        const balance = Number(rev.balance);
        const expectedBalance = total - paid;
        if (Math.abs(balance - expectedBalance) > 0.01 && total > 0) {
          found.push({
            id: `balance-mismatch-${rev.id}`,
            severity: 'warning',
            category: 'inconsistency',
            title: 'Saldo incorreto na receita',
            detail:
              `customer_revenue.balance = ${fmt(balance)} mas deveria ser ` +
              `total_amount (${fmt(total)}) - paid_amount (${fmt(paid)}) = ${fmt(expectedBalance)}. ` +
              `Diferenca de ${fmt(Math.abs(balance - expectedBalance))}.`,
            revenue_id: rev.id,
            amount: Number(rev.payment_amount),
            customer_name: (rev.customers as any)?.name,
            payment_date: rev.payment_date,
            fix_description: `Recalcular balance = ${fmt(expectedBalance)}.`,
            sql_hint: `UPDATE customer_revenue\nSET balance = ${expectedBalance.toFixed(2)}\nWHERE id = '${rev.id}';`,
            fix_action: async () => {
              await supabase.from('customer_revenue').update({ balance: expectedBalance }).eq('id', rev.id);
            },
            auto_fixable: true,
          });
        }
      }

      // [5C] Soma das parcelas != total do orcamento
      const instByQuote = new Map<string, typeof installments>();
      for (const inst of installments || []) {
        if (!instByQuote.has(inst.quote_id)) instByQuote.set(inst.quote_id, []);
        instByQuote.get(inst.quote_id)!.push(inst);
      }

      for (const [qId, insts] of instByQuote.entries()) {
        const quote = quoteMap.get(qId);
        if (!quote || !quote.has_installment_schedule) continue;
        const somaParc = (insts || []).reduce((s, i) => s + Number(i.installment_amount), 0);
        const quoteTotal = Number(quote.total_value);
        if (Math.abs(somaParc - quoteTotal) > 0.01) {
          const custName = (customers || []).find(c => c.id === quote.customer_id)?.name;
          found.push({
            id: `installment-sum-${qId}`,
            severity: 'warning',
            category: 'installment_mismatch',
            title: 'Soma das parcelas difere do total do orcamento',
            detail:
              `Orcamento …${qId.slice(-8)} (cliente: ${custName ?? '?'}): ` +
              `total = ${fmt(quoteTotal)}, soma das ${insts?.length ?? 0} parcelas = ${fmt(somaParc)}. ` +
              `Diferenca de ${fmt(Math.abs(somaParc - quoteTotal))}.`,
            amount: quoteTotal,
            customer_name: custName,
            fix_description:
              'Revise as parcelas deste orcamento — o total das parcelas deve ser igual ao valor total do orcamento.',
            sql_hint:
              `SELECT installment_number, installment_amount, payment_status\n` +
              `FROM quote_installments WHERE quote_id = '${qId}'\n` +
              `ORDER BY installment_number;\n\n` +
              `-- Total do orcamento:\nSELECT total_value FROM quotes WHERE id = '${qId}';`,
            auto_fixable: false,
          });
        }
      }

      // [5D] Parcelas pagas sem customer_revenue correspondente
      const revenueQuoteIds = new Set(
        (revenues || []).filter(r => r.origin_type === 'quote').map(r => r.origin_id)
      );
      for (const inst of installments || []) {
        if (inst.payment_status !== 'paid') continue;
        if (revenueQuoteIds.has(inst.quote_id)) continue;
        const quote = quoteMap.get(inst.quote_id);
        if (!quote) continue;
        const custName = (customers || []).find(c => c.id === quote.customer_id)?.name;
        found.push({
          id: `installment-no-revenue-${inst.id}`,
          severity: 'warning',
          category: 'installment_mismatch',
          title: 'Parcela paga sem receita registrada',
          detail:
            `Parcela #${inst.installment_number} do orcamento …${inst.quote_id.slice(-8)} ` +
            `(${custName ?? '?'}) esta marcada como paga (${fmt(Number(inst.paid_amount))}) ` +
            `mas nenhuma entrada em customer_revenue existe para este orcamento.`,
          amount: Number(inst.paid_amount),
          customer_name: custName,
          payment_date: inst.due_date,
          fix_description:
            'Registre o pagamento em Receitas de Clientes vinculando ao orcamento, ' +
            'ou verifique se a parcela foi marcada como paga por engano.',
          sql_hint:
            `SELECT id, total_value, payment_status FROM quotes WHERE id = '${inst.quote_id}';\n` +
            `SELECT * FROM quote_installments WHERE quote_id = '${inst.quote_id}';`,
          auto_fixable: false,
        });
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // DIMENSAO 6 — RECEITAS SEM FC
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      for (const rev of revenues || []) {
        if ((rev as any).estornado) continue;
        if (!rev.payment_amount || Number(rev.payment_amount) === 0) continue;
        const linkedCF = cfByRevId.get(rev.id);
        if (!linkedCF) {
          const originLabel = ORIGIN_LABELS[rev.origin_type] || rev.origin_type;
          found.push({
            id: `missing-cf-${rev.id}`,
            severity: 'warning',
            category: 'missing_cashflow',
            title: 'Receita sem entrada no Fluxo de Caixa',
            detail:
              `Pagamento de ${originLabel} (ID …${rev.id.slice(-8)}) nao possui entrada correspondente no cash_flow. ` +
              `O trigger de sincronizacao pode ter falhado ou o registro foi inserido manualmente.`,
            revenue_id: rev.id,
            amount: Number(rev.payment_amount),
            customer_name: (rev.customers as any)?.name,
            payment_date: rev.payment_date,
            fix_description:
              'Verifique se o trigger "trigger_sync_customer_revenue_insert" esta ativo. ' +
              'Use o SQL abaixo para criar a entrada manualmente se necessario.',
            sql_hint:
              `INSERT INTO cash_flow\n` +
              `  (date, type, category, description, amount, customer_revenue_id, customer_id)\n` +
              `VALUES\n` +
              `  ('${rev.payment_date}', 'income', 'receita_cliente',\n` +
              `   '${(rev.origin_description || 'Recebimento').replace(/'/g, "''")}',\n` +
              `   ${rev.payment_amount}, '${rev.id}', '${rev.customer_id}');`,
            auto_fixable: false,
          });
        }
      }

      // ── Summary ──────────────────────────────────────────────────────────
      const byCategory: Record<string, number> = {};
      const bySeverity: Record<string, number> = {};
      for (const issue of found) {
        byCategory[issue.category] = (byCategory[issue.category] || 0) + 1;
        bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
      }

      setSummary({
        total_revenues: (revenues || []).length,
        total_cashflows_linked: (cashflowsLinked || []).length,
        total_works: (works || []).length,
        total_customers: (customers || []).length,
        total_issues: found.length,
        total_at_risk: found.reduce((s, i) => s + i.amount, 0),
        issues_by_category: byCategory,
        issues_by_severity: bySeverity,
        ran_at: new Date().toLocaleString('pt-BR'),
        period_label: allPeriod
          ? 'Todo o periodo'
          : `${fmtDate(dateRange.from)} — ${fmtDate(dateRange.to)}`,
      });
      setIssues(found);
    } catch (err) {
      console.error('Audit error:', err);
      alert(`Erro ao executar auditoria: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [dateRange, allPeriod]);

  const applyFix = async (issue: AuditIssue) => {
    if (!issue.auto_fixable || !issue.fix_action) return;
    if (!confirm(`Aplicar correcao automatica?\n\n${issue.fix_description}`)) return;
    setFixing(issue.id);
    try {
      await issue.fix_action();
      setFixedIds(prev => new Set([...prev, issue.id]));
    } catch (err) {
      console.error('Fix error:', err);
      alert('Erro ao aplicar correcao. Verifique o console.');
    } finally {
      setFixing(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const exportTxt = () => {
    if (!summary) return;
    const openIss = issues.filter(i => !fixedIds.has(i.id));
    const lines = [
      '================================================================',
      '  RELATORIO DE AUDITORIA DE INTEGRIDADE DE PAGAMENTOS - ALIANCER',
      `  Data: ${summary.ran_at}`,
      `  Periodo: ${summary.period_label}`,
      '================================================================',
      '',
      'RESUMO EXECUTIVO',
      `  Receitas auditadas   : ${summary.total_revenues}`,
      `  FC vinculados        : ${summary.total_cashflows_linked}`,
      `  Obras                : ${summary.total_works}`,
      `  Clientes             : ${summary.total_customers}`,
      `  Problemas detectados : ${summary.total_issues}`,
      `  Corrigidos           : ${fixedIds.size}`,
      `  Pendentes            : ${openIss.length}`,
      `  Valor em risco       : ${fmt(summary.total_at_risk)}`,
      '',
      'POR CATEGORIA',
      ...Object.entries(summary.issues_by_category).map(
        ([k, v]) => `  ${CATEGORY_LABELS[k as IssueCategory] ?? k}: ${v}`
      ),
      '',
      'POR SEVERIDADE',
      ...Object.entries(summary.issues_by_severity).map(
        ([k, v]) => `  ${SEVERITY_LABEL[k as IssueSeverity] ?? k}: ${v}`
      ),
      '',
      'PROBLEMAS PENDENTES',
      '-------------------',
    ];
    for (const issue of openIss) {
      lines.push(`[${SEVERITY_LABEL[issue.severity]}] ${issue.title}`);
      lines.push(`  Categoria : ${CATEGORY_LABELS[issue.category]}`);
      lines.push(`  Valor     : ${fmt(issue.amount)}`);
      if (issue.customer_name) lines.push(`  Cliente   : ${issue.customer_name}`);
      if (issue.work_name) lines.push(`  Obra      : ${issue.work_name}`);
      if (issue.payment_date) lines.push(`  Data      : ${fmtDate(issue.payment_date)}`);
      lines.push(`  Detalhe   : ${issue.detail}`);
      if (issue.fix_description) lines.push(`  Acao      : ${issue.fix_description}`);
      if (issue.sql_hint) lines.push(`  SQL:\n${issue.sql_hint.split('\n').map(l => '    ' + l).join('\n')}`);
      lines.push('');
    }
    lines.push('================================================================');
    lines.push('QUERIES SQL DE AUDITORIA COMPLETA (SOMENTE LEITURA)');
    lines.push('================================================================');
    lines.push('');
    lines.push(SQL_AUDIT_QUERIES);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportSql = () => {
    const blob = new Blob([SQL_AUDIT_QUERIES], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_queries_${new Date().toISOString().split('T')[0]}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openIssues = issues.filter(i => !fixedIds.has(i.id));
  const filteredIssues = openIssues.filter(i =>
    activeFilter === 'all' || i.category === activeFilter
  );
  const criticalCount = openIssues.filter(i => i.severity === 'critical').length;
  const warningCount = openIssues.filter(i => i.severity === 'warning').length;
  const autoFixableCount = openIssues.filter(i => i.auto_fixable).length;

  // Checklist items: [label, passing]
  const checklist: [string, boolean][] = [
    ['Todos os pagamentos possuem cliente valido', openIssues.filter(i => i.id.startsWith('orphan-customer')).length === 0],
    ['Pagamentos de obra vinculados a obras existentes', openIssues.filter(i => i.id.startsWith('orphan-work')).length === 0],
    ['Cliente do pagamento coincide com cliente da obra', openIssues.filter(i => i.id.startsWith('work-customer-mismatch')).length === 0],
    ['customer_id consistente entre receita e cash_flow', openIssues.filter(i => i.id.startsWith('cf-customer-mismatch')).length === 0],
    ['Sem entradas de caixa duplicadas/legadas para obras', openIssues.filter(i => i.id.startsWith('duplicate-cf')).length === 0],
    ['Sem receitas duplicadas no customer_revenue', openIssues.filter(i => i.id.startsWith('duplicate-revenue')).length === 0],
    ['Categorizacoes de receitas corretas no cash_flow', openIssues.filter(i => i.category === 'bad_category').length === 0],
    ['Valores identicos entre receita e cash_flow', openIssues.filter(i => i.id.startsWith('amount-mismatch')).length === 0],
    ['Saldos calculados corretamente', openIssues.filter(i => i.id.startsWith('balance-mismatch')).length === 0],
    ['Soma de parcelas = total do orcamento', openIssues.filter(i => i.id.startsWith('installment-sum')).length === 0],
    ['Parcelas pagas tem receitas registradas', openIssues.filter(i => i.id.startsWith('installment-no-revenue')).length === 0],
    ['Todas as receitas tem entrada no fluxo de caixa', openIssues.filter(i => i.category === 'missing_cashflow').length === 0],
  ];

  return (
    <div className="space-y-6">

      {/* ── Header card ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ShieldCheck className="h-7 w-7 text-blue-600" />
              Auditoria de Integridade de Pagamentos
            </h2>
            <p className="text-gray-500 mt-1 text-sm max-w-2xl">
              Verifica 6 dimensoes:{' '}
              <span className="font-medium text-gray-700">Pagamentos Orfaos</span>,{' '}
              <span className="font-medium text-gray-700">Inconsistencias de Vinculo</span>,{' '}
              <span className="font-medium text-gray-700">Duplicacoes</span>,{' '}
              <span className="font-medium text-gray-700">Categorizacoes Incorretas</span>,{' '}
              <span className="font-medium text-gray-700">Valores Inconsistentes</span>{' e '}
              <span className="font-medium text-gray-700">FC Ausente</span>.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            <button
              onClick={() => setShowSqlPanel(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm text-gray-600"
            >
              <FileCode2 className="h-4 w-4" />
              SQL
            </button>
            {summary && (
              <button
                onClick={exportTxt}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm text-gray-600"
              >
                <Download className="h-4 w-4" />
                Exportar
              </button>
            )}
            <button
              onClick={runAudit}
              disabled={loading}
              className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60 text-sm font-medium"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Auditando...' : 'Executar Auditoria'}
            </button>
          </div>
        </div>

        {/* ── Period filter ── */}
        <div className="mt-5 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">Periodo:</span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allPeriod}
              onChange={e => setAllPeriod(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Todo o periodo</span>
          </label>
          {!allPeriod && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <input
                type="date"
                value={dateRange.from}
                onChange={e => setDateRange(p => ({ ...p, from: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-400 text-sm">ate</span>
              <input
                type="date"
                value={dateRange.to}
                onChange={e => setDateRange(p => ({ ...p, to: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          {summary && (
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
              {summary.period_label}
            </span>
          )}
        </div>

        {/* ── SQL panel (Phase 2 tabbed) ── */}
        {showSqlPanel && (
          <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Queries SQL — Fase 2 (somente leitura)
              </p>
              <button
                onClick={exportSql}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                <Download className="h-3 w-3" /> Exportar .sql
              </button>
            </div>

            {/* Query tabs */}
            <div className="flex flex-wrap gap-1.5">
              {PHASE2_QUERIES.map(q => (
                <button
                  key={q.id}
                  onClick={() => setActiveQueryTab(q.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeQueryTab === q.id
                      ? 'bg-gray-900 text-green-300 shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {q.label}
                </button>
              ))}
              <button
                onClick={() => setActiveQueryTab('exec')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeQueryTab === 'exec'
                    ? 'bg-gray-900 text-green-300 shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Resumo Executivo
              </button>
            </div>

            {/* Active query description + copy button */}
            {(() => {
              const active = activeQueryTab === 'exec'
                ? { id: 'exec', label: 'Resumo Executivo', description: 'Todas as 5 dimensoes em uma unica query consolidada, ordenadas por valor afetado.', color: 'text-gray-600', sql: SQL_EXECUTIVE_SUMMARY }
                : PHASE2_QUERIES.find(q => q.id === activeQueryTab)!;
              return (
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs text-gray-500 leading-relaxed max-w-2xl">
                      {active.description}
                    </p>
                    <button
                      onClick={() => copyToClipboard(active.sql)}
                      className="flex-shrink-0 flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <Copy className="h-3 w-3" /> Copiar
                    </button>
                  </div>
                  <pre className="bg-gray-900 text-green-300 text-xs p-4 rounded-lg overflow-auto max-h-96 whitespace-pre leading-relaxed">
                    {active.sql}
                  </pre>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ── Pre-run ────────────────────────────────────────────────────────── */}
      {!summary && !loading && (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-16 text-center">
          <ShieldCheck className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-500 mb-2">Pronto para auditar</h3>
          <p className="text-sm text-gray-400 max-w-lg mx-auto mb-1">
            Selecione o periodo e clique em "Executar Auditoria" para verificar as 6 dimensoes de integridade.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <span key={k} className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
                {v}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Loading ────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <RefreshCw className="h-12 w-12 text-blue-500 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600 font-medium">Executando auditoria completa...</p>
          <p className="text-sm text-gray-400 mt-1">9 consultas em paralelo — aguarde alguns segundos</p>
        </div>
      )}

      {summary && !loading && (
        <>
          {/* ── Scope cards ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Database, label: 'Receitas', value: summary.total_revenues, sub: 'no periodo auditado', color: 'text-blue-600' },
              { icon: TrendingUp, label: 'FC Vinculados', value: summary.total_cashflows_linked, sub: 'entradas com revenue_id', color: 'text-green-600' },
              { icon: Users, label: 'Clientes', value: summary.total_customers, sub: 'cadastrados', color: 'text-gray-500' },
              { icon: Database, label: 'Obras', value: summary.total_works, sub: 'cadastradas', color: 'text-gray-500' },
            ].map(({ icon: Icon, label, value, sub, color }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`h-4 w-4 ${color}`} />
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
                </div>
                <p className="text-3xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          {/* ── Status cards ───────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`rounded-xl border-2 p-5 ${openIssues.length === 0 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Problemas Pendentes</p>
              <p className={`text-4xl font-bold ${openIssues.length === 0 ? 'text-green-700' : 'text-orange-700'}`}>
                {openIssues.length}
              </p>
              {fixedIds.size > 0 && (
                <p className="text-xs text-green-600 mt-1">{fixedIds.size} corrigido(s) nesta sessao</p>
              )}
            </div>
            <div className={`rounded-xl border-2 p-5 ${criticalCount === 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Por Severidade</p>
              <div className="flex items-baseline gap-3">
                <span className={`text-3xl font-bold ${criticalCount > 0 ? 'text-red-700' : 'text-green-700'}`}>
                  {criticalCount}
                </span>
                <span className="text-sm text-gray-500">criticos</span>
                {warningCount > 0 && (
                  <>
                    <span className="text-2xl font-bold text-yellow-600">{warningCount}</span>
                    <span className="text-sm text-gray-500">atencao</span>
                  </>
                )}
              </div>
            </div>
            <div className={`rounded-xl border-2 p-5 ${summary.total_at_risk === 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Valor em Risco</p>
              <p className={`text-2xl font-bold ${summary.total_at_risk === 0 ? 'text-green-700' : 'text-red-700'}`}>
                {fmt(summary.total_at_risk)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">soma dos registros com problemas</p>
            </div>
          </div>

          {/* ── Category breakdown ─────────────────────────────────────────── */}
          {Object.keys(summary.issues_by_category).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Distribuicao por Dimensao
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {Object.entries(CATEGORY_LABELS).map(([k, label]) => {
                  const count = summary.issues_by_category[k] || 0;
                  const desc = CATEGORY_DESCRIPTIONS[k as IssueCategory];
                  return (
                    <button
                      key={k}
                      onClick={() => setActiveFilter(count > 0 ? k : 'all')}
                      title={desc}
                      className={`text-left p-3 rounded-lg border transition-all ${
                        count > 0
                          ? activeFilter === k
                            ? 'border-blue-400 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer'
                          : 'border-gray-100 bg-gray-50 cursor-default'
                      }`}
                    >
                      <p className={`text-2xl font-bold ${count > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                        {count}
                      </p>
                      <p className={`text-xs mt-0.5 font-medium ${count > 0 ? 'text-gray-600' : 'text-gray-300'}`}>
                        {label}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── All clear ──────────────────────────────────────────────────── */}
          {openIssues.length === 0 && (
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-10 text-center">
              <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto mb-3" />
              <h3 className="text-xl font-bold text-green-800 mb-1">
                Todos os registros estao integros!
              </h3>
              <p className="text-green-700 text-sm max-w-md mx-auto">
                Nenhuma das 6 dimensoes de auditoria detectou problemas em {summary.total_revenues} receitas.
              </p>
              <p className="text-green-500 text-xs mt-3">
                {summary.ran_at} — {summary.period_label}
              </p>
            </div>
          )}

          {/* ── Auto-fix banner ─────────────────────────────────────────────── */}
          {autoFixableCount > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 flex items-center gap-3">
              <Wrench className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <p className="text-sm text-blue-800">
                <strong>{autoFixableCount} problema(s)</strong> podem ser corrigidos automaticamente.
                Clique em "Corrigir\" ao lado de cada item para aplicar a correcao.
              </p>
            </div>
          )}

          {/* ── Filter tabs ─────────────────────────────────────────────────── */}
          {openIssues.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Todos ({openIssues.length})
              </button>
              {Object.entries(summary.issues_by_category)
                .filter(([, v]) => v > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <button
                    key={k}
                    onClick={() => setActiveFilter(k)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      activeFilter === k
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {CATEGORY_LABELS[k as IssueCategory] ?? k} ({v})
                  </button>
                ))}
            </div>
          )}

          {/* ── Issues list ─────────────────────────────────────────────────── */}
          {filteredIssues.length > 0 && (
            <div className="space-y-2">
              {filteredIssues.map(issue => (
                <div
                  key={issue.id}
                  className={`rounded-xl border-2 overflow-hidden ${SEVERITY_BORDER[issue.severity]}`}
                >
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
                    onClick={() => toggleExpand(issue.id)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <SeverityIcon severity={issue.severity} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-gray-900">{issue.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_BADGE[issue.severity]}`}>
                            {SEVERITY_LABEL[issue.severity]}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white bg-opacity-60 text-gray-600 border border-gray-200">
                            <Tag className="h-2.5 w-2.5 inline mr-1" />
                            {CATEGORY_LABELS[issue.category]}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-600 flex-wrap">
                          <span className="font-bold"><CreditCard className="h-3 w-3 inline mr-0.5" />{fmt(issue.amount)}</span>
                          {issue.customer_name && <span>{issue.customer_name}</span>}
                          {issue.work_name && <span className="italic">{issue.work_name}</span>}
                          {issue.payment_date && <span>{fmtDate(issue.payment_date)}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      {issue.auto_fixable && (
                        <button
                          onClick={e => { e.stopPropagation(); applyFix(issue); }}
                          disabled={fixing === issue.id}
                          className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
                        >
                          {fixing === issue.id
                            ? <RefreshCw className="h-3 w-3 animate-spin" />
                            : <Wrench className="h-3 w-3" />}
                          Corrigir
                        </button>
                      )}
                      {expanded.has(issue.id)
                        ? <ChevronDown className="h-4 w-4 text-gray-400" />
                        : <ChevronRight className="h-4 w-4 text-gray-400" />}
                    </div>
                  </div>

                  {expanded.has(issue.id) && (
                    <div className="border-t border-gray-200 px-4 py-4 space-y-4 bg-white bg-opacity-70">
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Descricao</p>
                        <p className="text-sm text-gray-700">{issue.detail}</p>
                      </div>

                      {(issue.revenue_id || issue.cashflow_id || issue.work_item_id) && (
                        <div className="flex flex-wrap gap-4 text-xs">
                          {issue.revenue_id && (
                            <div>
                              <p className="text-gray-400 font-semibold">Revenue ID</p>
                              <p className="font-mono text-gray-600">{issue.revenue_id}</p>
                            </div>
                          )}
                          {issue.cashflow_id && (
                            <div>
                              <p className="text-gray-400 font-semibold">CashFlow ID</p>
                              <p className="font-mono text-gray-600">{issue.cashflow_id}</p>
                            </div>
                          )}
                          {issue.work_item_id && (
                            <div>
                              <p className="text-gray-400 font-semibold">WorkItem ID</p>
                              <p className="font-mono text-gray-600">{issue.work_item_id}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {issue.fix_description && (
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Acao Recomendada</p>
                          <p className="text-sm text-gray-700">{issue.fix_description}</p>
                        </div>
                      )}

                      {issue.sql_hint && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">SQL</p>
                            <button
                              onClick={() => copyToClipboard(issue.sql_hint!)}
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <Copy className="h-3 w-3" /> Copiar
                            </button>
                          </div>
                          <pre className="bg-gray-900 text-green-400 text-xs p-3 rounded-lg overflow-x-auto whitespace-pre">
                            {issue.sql_hint}
                          </pre>
                        </div>
                      )}

                      {!issue.auto_fixable && (
                        <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                          <span>Intervencao manual necessaria — nao pode ser aplicada automaticamente.</span>
                        </div>
                      )}

                      {issue.category === 'duplicate' && issue.auto_fixable && (
                        <button
                          onClick={() => applyFix(issue)}
                          disabled={fixing === issue.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remover Entrada Duplicada
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Checklist ──────────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Checklist de Validacao — 6 Dimensoes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              {checklist.map(([label, ok], i) => (
                <div key={i} className="flex items-start gap-2">
                  {ok
                    ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-500" />
                    : <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-400" />}
                  <span className={ok ? 'text-gray-600' : 'text-red-700 font-medium'}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center">
            {summary.ran_at} &mdash; {summary.period_label} &bull;{' '}
            {summary.total_revenues} receitas &bull;{' '}
            {summary.total_cashflows_linked} FC &bull;{' '}
            {summary.total_works} obras &bull;{' '}
            {summary.total_customers} clientes
          </p>
        </>
      )}
    </div>
  );
}
