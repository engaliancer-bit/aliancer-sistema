import { useState, useCallback } from 'react';
import {
  ShieldCheck, AlertTriangle, XCircle, CheckCircle2, RefreshCw,
  Wrench, Download, ChevronDown, ChevronRight, Info, Trash2,
  FileCode2, Database, TrendingUp, Users,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

type IssueSeverity = 'critical' | 'warning' | 'info';
type IssueCategory =
  | 'orphan'
  | 'inconsistency'
  | 'duplicate'
  | 'missing_cashflow'
  | 'installment_mismatch';

interface AuditIssue {
  id: string;
  severity: IssueSeverity;
  category: IssueCategory;
  title: string;
  detail: string;
  revenue_id?: string;
  cashflow_id?: string;
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
  fixed_count: number;
  issues_by_category: Record<string, number>;
  issues_by_severity: Record<string, number>;
  ran_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (d?: string | null) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';

const CATEGORY_LABELS: Record<IssueCategory, string> = {
  orphan: 'Pagamento Orfao',
  inconsistency: 'Inconsistencia',
  duplicate: 'Duplicacao',
  missing_cashflow: 'Fluxo de Caixa Ausente',
  installment_mismatch: 'Parcela Divergente',
};

const ORIGIN_LABELS: Record<string, string> = {
  quote: 'Orcamento',
  ribbed_slab_quote: 'Orcamento Laje',
  construction_work: 'Obra',
};

const SEVERITY_BORDER: Record<IssueSeverity, string> = {
  critical: 'border-red-300 bg-red-50',
  warning: 'border-yellow-300 bg-yellow-50',
  info: 'border-blue-300 bg-blue-50',
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

// SQL audit queries for export
const SQL_AUDIT_QUERIES = `-- ================================================================
--  AUDITORIA DE INTEGRIDADE DE PAGAMENTOS - ALIANCER
--  Todas as queries sao SOMENTE LEITURA (SELECT)
-- ================================================================

-- [A] Receitas sem entrada correspondente no fluxo de caixa
-- (exclui registros estornados, pois estes nao devem ter CF)
SELECT
  cr.id            AS revenue_id,
  cr.customer_id,
  c.name           AS customer_name,
  cr.origin_type,
  cr.origin_id,
  cr.origin_description,
  cr.payment_date,
  cr.payment_amount,
  cr.payment_method,
  cr.estornado
FROM customer_revenue cr
LEFT JOIN customers c ON c.id = cr.customer_id
LEFT JOIN cash_flow cf ON cf.customer_revenue_id = cr.id
WHERE cf.id IS NULL
  AND COALESCE(cr.estornado, false) = false
  AND cr.payment_amount > 0
ORDER BY cr.payment_date DESC;

-- [B] Divergencia de cliente entre customer_revenue e cash_flow
SELECT
  cr.id            AS revenue_id,
  cf.id            AS cashflow_id,
  cr.customer_id   AS revenue_customer_id,
  cr.payment_date,
  cr.payment_amount,
  cf.customer_id   AS cashflow_customer_id,
  c1.name          AS revenue_customer,
  c2.name          AS cashflow_customer
FROM customer_revenue cr
JOIN cash_flow cf ON cf.customer_revenue_id = cr.id
LEFT JOIN customers c1 ON c1.id = cr.customer_id
LEFT JOIN customers c2 ON c2.id = cf.customer_id
WHERE cf.customer_id IS NOT NULL
  AND cf.customer_id <> cr.customer_id
ORDER BY cr.payment_date DESC;

-- [C] Divergencia de valor entre customer_revenue e cash_flow
SELECT
  cr.id            AS revenue_id,
  cf.id            AS cashflow_id,
  cr.payment_date,
  cr.payment_amount AS revenue_amount,
  cf.amount        AS cashflow_amount,
  ABS(cr.payment_amount - cf.amount) AS diferenca,
  c.name           AS customer_name
FROM customer_revenue cr
JOIN cash_flow cf ON cf.customer_revenue_id = cr.id
LEFT JOIN customers c ON c.id = cr.customer_id
WHERE ABS(cr.payment_amount - cf.amount) > 0.01
ORDER BY ABS(cr.payment_amount - cf.amount) DESC;

-- [D] Pagamentos de obra vinculados a obra inexistente
SELECT
  cr.id            AS revenue_id,
  cr.customer_id,
  c.name           AS customer_name,
  cr.origin_id     AS work_id,
  cr.payment_date,
  cr.payment_amount
FROM customer_revenue cr
LEFT JOIN customers c ON c.id = cr.customer_id
LEFT JOIN construction_works cw ON cw.id = cr.origin_id
WHERE cr.origin_type = 'construction_work'
  AND cw.id IS NULL
ORDER BY cr.payment_date DESC;

-- [D2] Pagamentos de obra onde o cliente nao bate com a obra
SELECT
  cr.id            AS revenue_id,
  cr.customer_id   AS payment_customer_id,
  cust.name        AS payment_customer,
  cw.customer_id   AS work_customer_id,
  c2.name          AS work_customer,
  cw.work_name,
  cr.payment_date,
  cr.payment_amount
FROM customer_revenue cr
JOIN construction_works cw ON cw.id = cr.origin_id
JOIN customers cust ON cust.id = cr.customer_id
JOIN customers c2 ON c2.id = cw.customer_id
WHERE cr.origin_type = 'construction_work'
  AND cw.customer_id <> cr.customer_id
ORDER BY cr.payment_date DESC;

-- [E] Entradas de caixa legadas/duplicadas para obras
--     (cash_flow.construction_work_id SET, mas sem customer_revenue_id)
--     que coexistem com registros em customer_revenue para a mesma obra
WITH revenue_work_ids AS (
  SELECT DISTINCT origin_id
  FROM customer_revenue
  WHERE origin_type = 'construction_work'
    AND COALESCE(estornado, false) = false
)
SELECT
  cf.id            AS cashflow_id,
  cf.construction_work_id AS work_id,
  cw.work_name,
  cf.date,
  cf.amount,
  cf.description,
  cf.category
FROM cash_flow cf
JOIN construction_works cw ON cw.id = cf.construction_work_id
WHERE cf.type = 'income'
  AND cf.customer_revenue_id IS NULL
  AND cf.construction_work_id IN (SELECT origin_id FROM revenue_work_ids)
ORDER BY cf.date DESC;

-- [F] Receitas com customer_id inexistente na tabela customers
SELECT
  cr.id            AS revenue_id,
  cr.customer_id,
  cr.origin_type,
  cr.origin_description,
  cr.payment_date,
  cr.payment_amount
FROM customer_revenue cr
LEFT JOIN customers c ON c.id = cr.customer_id
WHERE c.id IS NULL
ORDER BY cr.payment_date DESC;

-- [G] Parcelas (quote_installments) com valores divergentes do quote
SELECT
  qi.id            AS installment_id,
  qi.quote_id,
  qi.installment_number,
  qi.installment_amount,
  qi.paid_amount,
  qi.payment_status,
  q.total_value    AS quote_total,
  q.payment_status AS quote_payment_status,
  q.paid_amount    AS quote_paid_amount,
  c.name           AS customer_name
FROM quote_installments qi
JOIN quotes q ON q.id = qi.quote_id
JOIN customers c ON c.id = q.customer_id
WHERE qi.payment_status = 'paid'
  AND NOT EXISTS (
    SELECT 1 FROM customer_revenue cr
    WHERE cr.origin_type = 'quote'
      AND cr.origin_id = qi.quote_id
  )
ORDER BY qi.updated_at DESC;

-- [H] Resumo executivo por severidade e categoria
WITH issues AS (
  -- A: missing CF
  SELECT 'A_missing_cashflow' AS check_id,
         'missing_cashflow'   AS category,
         'warning'            AS severity,
         COUNT(*)             AS count,
         SUM(cr.payment_amount) AS valor_total
  FROM customer_revenue cr
  LEFT JOIN cash_flow cf ON cf.customer_revenue_id = cr.id
  WHERE cf.id IS NULL
    AND COALESCE(cr.estornado, false) = false
    AND cr.payment_amount > 0
  UNION ALL
  -- B: customer mismatch
  SELECT 'B_customer_mismatch', 'inconsistency', 'critical',
         COUNT(*), SUM(cr.payment_amount)
  FROM customer_revenue cr
  JOIN cash_flow cf ON cf.customer_revenue_id = cr.id
  WHERE cf.customer_id IS NOT NULL
    AND cf.customer_id <> cr.customer_id
  UNION ALL
  -- C: amount mismatch
  SELECT 'C_amount_mismatch', 'inconsistency', 'critical',
         COUNT(*), SUM(ABS(cr.payment_amount - cf.amount))
  FROM customer_revenue cr
  JOIN cash_flow cf ON cf.customer_revenue_id = cr.id
  WHERE ABS(cr.payment_amount - cf.amount) > 0.01
  UNION ALL
  -- F: orphan customer
  SELECT 'F_orphan_customer', 'orphan', 'critical',
         COUNT(*), SUM(cr.payment_amount)
  FROM customer_revenue cr
  LEFT JOIN customers c ON c.id = cr.customer_id
  WHERE c.id IS NULL
)
SELECT check_id, category, severity, count, valor_total
FROM issues
WHERE count > 0
ORDER BY
  CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
  count DESC;
`;

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

  const runAudit = useCallback(async () => {
    setLoading(true);
    setIssues([]);
    setSummary(null);
    setFixedIds(new Set());
    setActiveFilter('all');

    try {
      const foundIssues: AuditIssue[] = [];

      // ── Parallel data fetching ──────────────────────────────────────────
      const [
        { data: revenues, error: revErr },
        { data: cashflows, error: cfErr },
        { data: orphanCF, error: ocfErr },
        { data: works, error: wErr },
        { data: customers, error: custErr },
        { data: quotes, error: qErr },
        { data: installments, error: instErr },
      ] = await Promise.all([
        supabase
          .from('customer_revenue')
          .select(
            'id, customer_id, origin_type, origin_id, origin_description, ' +
            'total_amount, paid_amount, balance, payment_date, payment_amount, ' +
            'payment_method, notes, receipt_number, estornado, created_at, ' +
            'customers ( id, name )'
          )
          .order('payment_date', { ascending: false }),

        supabase
          .from('cash_flow')
          .select('id, amount, date, description, type, customer_revenue_id, customer_id')
          .eq('type', 'income')
          .not('customer_revenue_id', 'is', null),

        supabase
          .from('cash_flow')
          .select('id, amount, date, description, construction_work_id, customer_id')
          .eq('type', 'income')
          .is('customer_revenue_id', null)
          .not('construction_work_id', 'is', null),

        supabase
          .from('construction_works')
          .select('id, customer_id, work_name, total_contract_value, status'),

        supabase
          .from('customers')
          .select('id, name'),

        supabase
          .from('quotes')
          .select('id, customer_id, total_value, payment_status, paid_amount, status')
          .eq('status', 'approved'),

        supabase
          .from('quote_installments')
          .select('id, quote_id, installment_number, installment_amount, paid_amount, payment_status, due_date'),
      ]);

      if (revErr) throw revErr;
      if (cfErr) throw cfErr;
      if (ocfErr) throw ocfErr;
      if (wErr) throw wErr;
      if (custErr) throw custErr;
      if (qErr) throw qErr;
      if (instErr) throw instErr;

      const workMap = new Map((works || []).map(w => [w.id, w]));
      const cfByRevId = new Map((cashflows || []).map(cf => [cf.customer_revenue_id, cf]));
      const validCustomerIds = new Set((customers || []).map(c => c.id));
      const quoteMap = new Map((quotes || []).map(q => [q.id, q]));

      // ──────────────────────────────────────────────────────────────────────
      // CHECK A: Revenues WITHOUT a cash_flow entry (trigger failure / skip)
      // ──────────────────────────────────────────────────────────────────────
      for (const rev of revenues || []) {
        if ((rev as any).estornado) continue;
        if (!rev.payment_amount || rev.payment_amount === 0) continue;

        const linkedCF = cfByRevId.get(rev.id);
        if (!linkedCF) {
          const originLabel = ORIGIN_LABELS[rev.origin_type] || rev.origin_type;
          foundIssues.push({
            id: `missing-cf-${rev.id}`,
            severity: 'warning',
            category: 'missing_cashflow',
            title: 'Receita sem entrada no Fluxo de Caixa',
            detail:
              `O pagamento de ${originLabel} (ID …${rev.id.slice(-8)}) nao possui entrada ` +
              `correspondente no fluxo de caixa. O trigger de sincronizacao pode ter falhado.`,
            revenue_id: rev.id,
            amount: Number(rev.payment_amount),
            customer_name: (rev.customers as any)?.name,
            payment_date: rev.payment_date,
            fix_description:
              'A entrada no cash_flow deveria ter sido criada automaticamente pelo trigger. ' +
              'Verifique se o trigger "trigger_sync_customer_revenue_insert" esta ativo no banco.',
            sql_hint:
              `-- Criar manualmente a entrada de caixa ausente\n` +
              `INSERT INTO cash_flow (date, type, category, description, amount, customer_revenue_id)\n` +
              `VALUES ('${rev.payment_date}', 'income', 'receita_cliente',\n` +
              `  '${(rev.origin_description || 'Recebimento').replace(/'/g, "''")}',\n` +
              `  ${rev.payment_amount}, '${rev.id}');`,
            auto_fixable: false,
          });
        }
      }

      // ──────────────────────────────────────────────────────────────────────
      // CHECK B: customer_id mismatch between customer_revenue and cash_flow
      // ──────────────────────────────────────────────────────────────────────
      for (const rev of revenues || []) {
        if ((rev as any).estornado) continue;
        const linkedCF = cfByRevId.get(rev.id);
        if (!linkedCF) continue;
        if (linkedCF.customer_id && linkedCF.customer_id !== rev.customer_id) {
          const cfCustomerName = (customers || []).find(c => c.id === linkedCF.customer_id)?.name;
          foundIssues.push({
            id: `customer-mismatch-${rev.id}`,
            severity: 'critical',
            category: 'inconsistency',
            title: 'Cliente divergente entre Receita e Fluxo de Caixa',
            detail:
              `customer_revenue aponta para cliente "${(rev.customers as any)?.name ?? 'desconhecido'}" ` +
              `mas cash_flow aponta para "${cfCustomerName ?? 'desconhecido'}". ` +
              `Os registros estao vinculados (customer_revenue_id), mas com clientes diferentes.`,
            revenue_id: rev.id,
            cashflow_id: linkedCF.id,
            amount: Number(rev.payment_amount),
            customer_name: (rev.customers as any)?.name,
            payment_date: rev.payment_date,
            fix_description: 'Atualizar cash_flow.customer_id para o mesmo cliente registrado na receita.',
            sql_hint: `UPDATE cash_flow SET customer_id = '${rev.customer_id}' WHERE id = '${linkedCF.id}';`,
            fix_action: async () => {
              await supabase.from('cash_flow').update({ customer_id: rev.customer_id }).eq('id', linkedCF.id);
            },
            auto_fixable: true,
          });
        }
      }

      // ──────────────────────────────────────────────────────────────────────
      // CHECK C: Amount mismatch between customer_revenue and cash_flow
      // ──────────────────────────────────────────────────────────────────────
      for (const rev of revenues || []) {
        if ((rev as any).estornado) continue;
        const linkedCF = cfByRevId.get(rev.id);
        if (!linkedCF) continue;
        const revAmt = Number(rev.payment_amount);
        const cfAmt = Number(linkedCF.amount);
        if (Math.abs(revAmt - cfAmt) > 0.01) {
          foundIssues.push({
            id: `amount-mismatch-${rev.id}`,
            severity: 'critical',
            category: 'inconsistency',
            title: 'Valor divergente entre Receita e Fluxo de Caixa',
            detail:
              `customer_revenue.payment_amount = ${fmt(revAmt)} ` +
              `mas cash_flow.amount = ${fmt(cfAmt)}. ` +
              `Diferenca: ${fmt(Math.abs(revAmt - cfAmt))}. ` +
              `Os dois devem estar sempre sincronizados.`,
            revenue_id: rev.id,
            cashflow_id: linkedCF.id,
            amount: revAmt,
            customer_name: (rev.customers as any)?.name,
            payment_date: rev.payment_date,
            fix_description: `Corrigir cash_flow.amount para ${fmt(revAmt)} (valor da receita e a fonte da verdade).`,
            sql_hint: `UPDATE cash_flow SET amount = ${revAmt} WHERE id = '${linkedCF.id}';`,
            fix_action: async () => {
              await supabase.from('cash_flow').update({ amount: revAmt }).eq('id', linkedCF.id);
            },
            auto_fixable: true,
          });
        }
      }

      // ──────────────────────────────────────────────────────────────────────
      // CHECK D: Works with wrong or missing customer linkage
      // ──────────────────────────────────────────────────────────────────────
      for (const rev of revenues || []) {
        if (rev.origin_type !== 'construction_work') continue;

        const work = workMap.get(rev.origin_id);
        if (!work) {
          foundIssues.push({
            id: `orphan-work-${rev.id}`,
            severity: 'critical',
            category: 'orphan',
            title: 'Pagamento vinculado a obra inexistente',
            detail:
              `O pagamento referencia origin_id = ${rev.origin_id} ` +
              `mas nenhuma obra com este ID existe na tabela construction_works. ` +
              `A obra pode ter sido excluida.`,
            revenue_id: rev.id,
            amount: Number(rev.payment_amount),
            customer_name: (rev.customers as any)?.name,
            payment_date: rev.payment_date,
            work_name: 'OBRA NAO ENCONTRADA',
            fix_description:
              'Verifique se a obra foi excluida. Se sim, considere atualizar origin_id para a obra correta ' +
              'ou excluir este pagamento apos verificacao manual.',
            sql_hint:
              `-- Verificar se existem obras para este cliente:\n` +
              `SELECT id, work_name FROM construction_works\n` +
              `WHERE customer_id = '${rev.customer_id}';\n\n` +
              `-- Depois vincular ao ID correto:\n` +
              `UPDATE customer_revenue SET origin_id = '<ID_DA_OBRA_CORRETA>'\n` +
              `WHERE id = '${rev.id}';`,
            auto_fixable: false,
          });
        } else if (work.customer_id !== rev.customer_id) {
          const workCustomerName = (customers || []).find(c => c.id === work.customer_id)?.name;
          foundIssues.push({
            id: `work-customer-mismatch-${rev.id}`,
            severity: 'warning',
            category: 'inconsistency',
            title: 'Cliente do pagamento diferente do cliente da obra',
            detail:
              `A obra "${work.work_name}" pertence ao cliente "${workCustomerName ?? work.customer_id.slice(-8)}" ` +
              `mas o pagamento esta vinculado ao cliente "${(rev.customers as any)?.name ?? rev.customer_id.slice(-8)}". ` +
              `Isso pode indicar um pagamento cadastrado no cliente errado.`,
            revenue_id: rev.id,
            amount: Number(rev.payment_amount),
            customer_name: (rev.customers as any)?.name,
            work_name: work.work_name,
            payment_date: rev.payment_date,
            fix_description:
              `Corrigir customer_revenue.customer_id para o cliente da obra: "${workCustomerName}".`,
            sql_hint:
              `UPDATE customer_revenue SET customer_id = '${work.customer_id}'\n` +
              `WHERE id = '${rev.id}';\n\n` +
              `-- Tambem atualize o cash_flow vinculado:\n` +
              `UPDATE cash_flow SET customer_id = '${work.customer_id}'\n` +
              `WHERE customer_revenue_id = '${rev.id}';`,
            fix_action: async () => {
              await supabase.from('customer_revenue').update({ customer_id: work.customer_id }).eq('id', rev.id);
              const linkedCF = cfByRevId.get(rev.id);
              if (linkedCF) {
                await supabase.from('cash_flow').update({ customer_id: work.customer_id }).eq('id', linkedCF.id);
              }
            },
            auto_fixable: true,
          });
        }
      }

      // ──────────────────────────────────────────────────────────────────────
      // CHECK E: Legacy/duplicate cash_flow entries for works
      //          (has construction_work_id, no customer_revenue_id)
      //          that coexist with proper customer_revenue records
      // ──────────────────────────────────────────────────────────────────────
      const worksWithRevenue = new Set(
        (revenues || [])
          .filter(r => r.origin_type === 'construction_work' && !(r as any).estornado)
          .map(r => r.origin_id)
      );

      for (const cf of orphanCF || []) {
        if (!cf.construction_work_id) continue;
        if (!worksWithRevenue.has(cf.construction_work_id)) continue;

        const work = workMap.get(cf.construction_work_id);
        foundIssues.push({
          id: `duplicate-cf-${cf.id}`,
          severity: 'warning',
          category: 'duplicate',
          title: 'Entrada de caixa legada/duplicada para obra',
          detail:
            `A obra "${work?.work_name ?? cf.construction_work_id.slice(-8)}" ` +
            `possui uma entrada no cash_flow (ID …${cf.id.slice(-8)}) SEM vinculo a customer_revenue, ` +
            `mas ja existem registros em customer_revenue para esta obra. ` +
            `Este pode ser um registro legado criado antes da implementacao do sistema de receitas.`,
          cashflow_id: cf.id,
          amount: Number(cf.amount),
          work_name: work?.work_name,
          payment_date: cf.date,
          fix_description:
            'Se confirmado como entrada legada/duplicada, esta entrada pode ser removida do fluxo de caixa. ' +
            'Verifique primeiro se o valor corresponde a algum pagamento ja registrado em customer_revenue.',
          sql_hint: `DELETE FROM cash_flow WHERE id = '${cf.id}';\n-- Confirme antes verificando: SELECT * FROM cash_flow WHERE id = '${cf.id}';`,
          fix_action: async () => {
            await supabase.from('cash_flow').delete().eq('id', cf.id);
          },
          auto_fixable: true,
        });
      }

      // ──────────────────────────────────────────────────────────────────────
      // CHECK F: Revenues with non-existent customer_id
      // ──────────────────────────────────────────────────────────────────────
      for (const rev of revenues || []) {
        if (!validCustomerIds.has(rev.customer_id)) {
          foundIssues.push({
            id: `orphan-customer-${rev.id}`,
            severity: 'critical',
            category: 'orphan',
            title: 'Pagamento sem cliente valido',
            detail:
              `customer_revenue.customer_id = ${rev.customer_id} ` +
              `nao corresponde a nenhum cliente na tabela customers. ` +
              `O cliente pode ter sido excluido apos o registro do pagamento.`,
            revenue_id: rev.id,
            amount: Number(rev.payment_amount),
            payment_date: rev.payment_date,
            fix_description:
              'Vincule manualmente este pagamento a um cliente existente ou exclua o registro ' +
              'apos verificar que o valor ja foi registrado corretamente em outro lugar.',
            sql_hint:
              `-- Listar todos os clientes disponiveis:\n` +
              `SELECT id, name FROM customers ORDER BY name;\n\n` +
              `-- Depois vincular ao cliente correto:\n` +
              `UPDATE customer_revenue SET customer_id = '<ID_DO_CLIENTE>'\n` +
              `WHERE id = '${rev.id}';`,
            auto_fixable: false,
          });
        }
      }

      // ──────────────────────────────────────────────────────────────────────
      // CHECK G: Quote installments paid but no revenue record found
      // ──────────────────────────────────────────────────────────────────────
      const revenueQuoteIds = new Set(
        (revenues || [])
          .filter(r => r.origin_type === 'quote')
          .map(r => r.origin_id)
      );

      for (const inst of installments || []) {
        if (inst.payment_status !== 'paid') continue;
        if (revenueQuoteIds.has(inst.quote_id)) continue;

        const quote = quoteMap.get(inst.quote_id);
        if (!quote) continue;
        const customerName = (customers || []).find(c => c.id === quote.customer_id)?.name;

        foundIssues.push({
          id: `installment-no-revenue-${inst.id}`,
          severity: 'warning',
          category: 'installment_mismatch',
          title: 'Parcela paga sem registro em Receitas de Clientes',
          detail:
            `A parcela #${inst.installment_number} do orcamento ${inst.quote_id.slice(-8)} ` +
            `esta marcada como "paga" (${fmt(Number(inst.paid_amount))}) ` +
            `mas nao existe nenhum registro correspondente em customer_revenue para este orcamento.`,
          amount: Number(inst.paid_amount),
          customer_name: customerName,
          payment_date: inst.due_date,
          fix_description:
            'Registre manualmente o pagamento em Receitas de Clientes vinculando ao orcamento, ' +
            'ou verifique se a parcela foi marcada como paga por engano.',
          sql_hint:
            `-- Verificar o orcamento:\n` +
            `SELECT id, total_value, payment_status, paid_amount\n` +
            `FROM quotes WHERE id = '${inst.quote_id}';\n\n` +
            `-- Verificar parcelas:\n` +
            `SELECT * FROM quote_installments WHERE quote_id = '${inst.quote_id}';`,
          auto_fixable: false,
        });
      }

      // ── Build summary ─────────────────────────────────────────────────────
      const issuesByCategory: Record<string, number> = {};
      const issuesBySeverity: Record<string, number> = {};
      for (const issue of foundIssues) {
        issuesByCategory[issue.category] = (issuesByCategory[issue.category] || 0) + 1;
        issuesBySeverity[issue.severity] = (issuesBySeverity[issue.severity] || 0) + 1;
      }

      const totalAtRisk = foundIssues.reduce((sum, i) => sum + i.amount, 0);

      setSummary({
        total_revenues: (revenues || []).length,
        total_cashflows_linked: (cashflows || []).length,
        total_works: (works || []).length,
        total_customers: (customers || []).length,
        total_issues: foundIssues.length,
        total_at_risk: totalAtRisk,
        fixed_count: 0,
        issues_by_category: issuesByCategory,
        issues_by_severity: issuesBySeverity,
        ran_at: new Date().toLocaleString('pt-BR'),
      });

      setIssues(foundIssues);
    } catch (err) {
      console.error('Audit error:', err);
      alert('Erro ao executar auditoria. Verifique o console.');
    } finally {
      setLoading(false);
    }
  }, []);

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

  const exportTxt = () => {
    if (!summary) return;
    const openIss = issues.filter(i => !fixedIds.has(i.id));
    const lines: string[] = [
      '================================================================',
      '   RELATORIO DE AUDITORIA DE INTEGRIDADE DE PAGAMENTOS',
      `   Data: ${summary.ran_at}`,
      '================================================================',
      '',
      'RESUMO EXECUTIVO',
      '----------------',
      `Receitas em customer_revenue : ${summary.total_revenues}`,
      `Entradas de caixa vinculadas : ${summary.total_cashflows_linked}`,
      `Obras cadastradas            : ${summary.total_works}`,
      `Clientes cadastrados         : ${summary.total_customers}`,
      `Problemas detectados         : ${summary.total_issues}`,
      `Problemas corrigidos         : ${fixedIds.size}`,
      `Problemas pendentes          : ${openIss.length}`,
      `Valor total em risco         : ${fmt(summary.total_at_risk)}`,
      '',
      'PROBLEMAS POR CATEGORIA',
      '-----------------------',
      ...Object.entries(summary.issues_by_category).map(
        ([k, v]) => `  ${CATEGORY_LABELS[k as IssueCategory] ?? k}: ${v}`
      ),
      '',
      'PROBLEMAS POR SEVERIDADE',
      '------------------------',
      ...Object.entries(summary.issues_by_severity).map(
        ([k, v]) => `  ${SEVERITY_LABEL[k as IssueSeverity] ?? k}: ${v}`
      ),
      '',
      'DETALHES DOS PROBLEMAS PENDENTES',
      '---------------------------------',
    ];

    for (const issue of openIss) {
      lines.push(`[${SEVERITY_LABEL[issue.severity]}] ${issue.title}`);
      lines.push(`  Categoria  : ${CATEGORY_LABELS[issue.category]}`);
      lines.push(`  Valor      : ${fmt(issue.amount)}`);
      if (issue.customer_name) lines.push(`  Cliente    : ${issue.customer_name}`);
      if (issue.work_name) lines.push(`  Obra       : ${issue.work_name}`);
      if (issue.payment_date) lines.push(`  Data       : ${fmtDate(issue.payment_date)}`);
      lines.push(`  Descricao  : ${issue.detail}`);
      if (issue.fix_description) lines.push(`  Acao       : ${issue.fix_description}`);
      if (issue.sql_hint) lines.push(`  SQL:\n${issue.sql_hint.split('\n').map(l => '    ' + l).join('\n')}`);
      lines.push('');
    }

    lines.push('================================================================');
    lines.push('QUERIES SQL DE AUDITORIA (SOMENTE LEITURA)');
    lines.push('================================================================');
    lines.push('');
    lines.push(SQL_AUDIT_QUERIES);
    lines.push('================================================================');
    lines.push('FIM DO RELATORIO');

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria_pagamentos_${new Date().toISOString().split('T')[0]}.txt`;
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

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ShieldCheck className="h-7 w-7 text-blue-600" />
              Auditoria de Integridade de Pagamentos
            </h2>
            <p className="text-gray-500 mt-1 text-sm max-w-xl">
              Varredura completa de <code className="bg-gray-100 px-1 rounded text-xs">customer_revenue</code>,{' '}
              <code className="bg-gray-100 px-1 rounded text-xs">cash_flow</code> e{' '}
              <code className="bg-gray-100 px-1 rounded text-xs">construction_works</code> para detectar
              inconsistencias, duplicacoes e pagamentos orfaos.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowSqlPanel(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm text-gray-600"
            >
              <FileCode2 className="h-4 w-4" />
              SQL
            </button>
            {summary && (
              <>
                <button
                  onClick={exportTxt}
                  className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm text-gray-600"
                >
                  <Download className="h-4 w-4" />
                  Relatorio .txt
                </button>
              </>
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

        {/* SQL panel */}
        {showSqlPanel && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Queries SQL de Auditoria (somente leitura)
              </p>
              <button
                onClick={exportSql}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                <Download className="h-3 w-3" /> Baixar .sql
              </button>
            </div>
            <pre className="bg-gray-900 text-green-300 text-xs p-4 rounded-lg overflow-auto max-h-72 whitespace-pre">
              {SQL_AUDIT_QUERIES}
            </pre>
          </div>
        )}
      </div>

      {/* ── Pre-run ────────────────────────────────────────────────────────── */}
      {!summary && !loading && (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-16 text-center">
          <ShieldCheck className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-500 mb-2">Pronto para auditar</h3>
          <p className="text-sm text-gray-400 max-w-md mx-auto">
            Clique em "Executar Auditoria" para verificar a integridade de todos os registros financeiros
            — receitas, fluxo de caixa, obras e parcelas de orcamento.
          </p>
        </div>
      )}

      {/* ── Loading ────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <RefreshCw className="h-12 w-12 text-blue-500 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600 font-medium">Analisando registros financeiros...</p>
          <p className="text-sm text-gray-400 mt-1">
            Executando {7} verificacoes em paralelo — isso pode levar alguns segundos
          </p>
        </div>
      )}

      {summary && !loading && (
        <>
          {/* ── Scope cards ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Database, label: 'Receitas', value: summary.total_revenues, sub: 'registros em customer_revenue', color: 'text-blue-600' },
              { icon: TrendingUp, label: 'Fluxo de Caixa', value: summary.total_cashflows_linked, sub: 'entradas vinculadas', color: 'text-green-600' },
              { icon: Users, label: 'Clientes', value: summary.total_customers, sub: 'cadastrados', color: 'text-gray-600' },
              { icon: Database, label: 'Obras', value: summary.total_works, sub: 'cadastradas', color: 'text-gray-600' },
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

          {/* ── Status cards ─────────────────────────────────────────────────── */}
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
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Criticos</p>
              <div className="flex items-baseline gap-2">
                <p className={`text-4xl font-bold ${criticalCount === 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {criticalCount}
                </p>
                {warningCount > 0 && (
                  <p className="text-sm text-yellow-600">+ {warningCount} atencao</p>
                )}
              </div>
            </div>
            <div className={`rounded-xl border-2 p-5 ${summary.total_at_risk === 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Valor em Risco</p>
              <p className={`text-2xl font-bold mt-1 ${summary.total_at_risk === 0 ? 'text-green-700' : 'text-red-700'}`}>
                {fmt(summary.total_at_risk)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">soma dos registros com problemas</p>
            </div>
          </div>

          {/* ── All clear ────────────────────────────────────────────────────── */}
          {openIssues.length === 0 && (
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-10 text-center">
              <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto mb-3" />
              <h3 className="text-xl font-bold text-green-800 mb-1">
                Todos os registros financeiros estao integros!
              </h3>
              <p className="text-green-700 text-sm max-w-md mx-auto">
                Nenhuma inconsistencia, duplicacao ou pagamento orfao foi detectado em{' '}
                {summary.total_revenues} receitas auditadas.
              </p>
              <p className="text-green-500 text-xs mt-3">Auditoria executada em {summary.ran_at}</p>
            </div>
          )}

          {/* ── Auto-fix banner ──────────────────────────────────────────────── */}
          {autoFixableCount > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 flex items-center gap-3">
              <Wrench className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <p className="text-sm text-blue-800">
                <strong>{autoFixableCount} problema(s)</strong> podem ser corrigidos automaticamente.
                Clique em "Corrigir\" ao lado de cada item para aplicar a correcao.
              </p>
            </div>
          )}

          {/* ── Filter tabs ──────────────────────────────────────────────────── */}
          {openIssues.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { key: 'all', label: `Todos (${openIssues.length})` },
                ...Object.entries(summary.issues_by_category)
                  .filter(([, v]) => v > 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => ({ key: k, label: `${CATEGORY_LABELS[k as IssueCategory] ?? k} (${v})` })),
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveFilter(key)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    activeFilter === key
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* ── Issues list ──────────────────────────────────────────────────── */}
          {filteredIssues.length > 0 && (
            <div className="space-y-3">
              {filteredIssues.map(issue => (
                <div
                  key={issue.id}
                  className={`rounded-xl border-2 overflow-hidden ${SEVERITY_BORDER[issue.severity]}`}
                >
                  {/* Issue header */}
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
                    onClick={() => toggleExpand(issue.id)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {issue.severity === 'critical' ? (
                        <XCircle className={`h-5 w-5 flex-shrink-0 ${SEVERITY_ICON_CLS[issue.severity]}`} />
                      ) : issue.severity === 'warning' ? (
                        <AlertTriangle className={`h-5 w-5 flex-shrink-0 ${SEVERITY_ICON_CLS[issue.severity]}`} />
                      ) : (
                        <Info className={`h-5 w-5 flex-shrink-0 ${SEVERITY_ICON_CLS[issue.severity]}`} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-gray-900">{issue.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_BADGE[issue.severity]}`}>
                            {SEVERITY_LABEL[issue.severity]}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white bg-opacity-70 text-gray-600 border border-gray-200">
                            {CATEGORY_LABELS[issue.category]}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-0.5 text-xs text-gray-600">
                          <span className="font-bold">{fmt(issue.amount)}</span>
                          {issue.customer_name && <span>{issue.customer_name}</span>}
                          {issue.work_name && (
                            <span className="italic">{issue.work_name}</span>
                          )}
                          {issue.payment_date && (
                            <span>{fmtDate(issue.payment_date)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      {issue.auto_fixable && (
                        <button
                          onClick={(e) => { e.stopPropagation(); applyFix(issue); }}
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

                  {/* Expanded detail */}
                  {expanded.has(issue.id) && (
                    <div className="border-t border-gray-200 px-4 py-4 space-y-4 bg-white bg-opacity-70">
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Descricao do Problema</p>
                        <p className="text-sm text-gray-700">{issue.detail}</p>
                      </div>

                      {(issue.revenue_id || issue.cashflow_id) && (
                        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                          {issue.revenue_id && (
                            <div>
                              <span className="font-semibold text-gray-400">Revenue ID</span>
                              <p className="font-mono">{issue.revenue_id}</p>
                            </div>
                          )}
                          {issue.cashflow_id && (
                            <div>
                              <span className="font-semibold text-gray-400">CashFlow ID</span>
                              <p className="font-mono">{issue.cashflow_id}</p>
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
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">SQL</p>
                          <pre className="bg-gray-900 text-green-400 text-xs p-3 rounded-lg overflow-x-auto whitespace-pre">
                            {issue.sql_hint}
                          </pre>
                        </div>
                      )}

                      {!issue.auto_fixable && (
                        <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                          <span>Esta correcao requer intervencao manual — nao pode ser aplicada automaticamente pelo sistema.</span>
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

          {/* ── Post-audit checklist ─────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Checklist de Validacao Pos-Auditoria
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
              {[
                ['Todos os pagamentos em customer_revenue possuem entrada correspondente em cash_flow', openIssues.filter(i => i.category === 'missing_cashflow').length === 0],
                ['Os valores de payment_amount coincidem com amount no cash_flow', openIssues.filter(i => i.id.startsWith('amount-mismatch')).length === 0],
                ['O customer_id e consistente entre as duas tabelas', openIssues.filter(i => i.id.startsWith('customer-mismatch')).length === 0],
                ['Nenhum pagamento esta vinculado a uma obra inexistente', openIssues.filter(i => i.id.startsWith('orphan-work')).length === 0],
                ['O cliente do pagamento coincide com o cliente da obra', openIssues.filter(i => i.id.startsWith('work-customer-mismatch')).length === 0],
                ['Nao ha entradas duplicadas/legadas no fluxo de caixa', openIssues.filter(i => i.category === 'duplicate').length === 0],
                ['Nenhum pagamento esta vinculado a um cliente inexistente', openIssues.filter(i => i.id.startsWith('orphan-customer')).length === 0],
                ['Parcelas pagas tem receitas correspondentes registradas', openIssues.filter(i => i.category === 'installment_mismatch').length === 0],
              ].map(([label, ok], i) => (
                <div key={i} className="flex items-start gap-2">
                  {ok
                    ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-500" />
                    : <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-400" />}
                  <span className={ok as boolean ? 'text-gray-600' : 'text-red-700 font-medium'}>{label as string}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Auditoria executada em {summary.ran_at} &mdash;{' '}
            {summary.total_revenues} receitas &bull;{' '}
            {summary.total_cashflows_linked} entradas de caixa &bull;{' '}
            {summary.total_works} obras &bull;{' '}
            {summary.total_customers} clientes analisados
          </p>
        </>
      )}
    </div>
  );
}
