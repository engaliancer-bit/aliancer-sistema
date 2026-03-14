import { useState, useCallback } from 'react';
import { ShieldCheck, AlertTriangle, XCircle, CheckCircle2, RefreshCw, Wrench, Download, ChevronDown, ChevronRight, Info, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditIssue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'orphan' | 'inconsistency' | 'duplicate' | 'missing_cashflow';
  title: string;
  detail: string;
  revenue_id?: string;
  cashflow_id?: string;
  amount: number;
  customer_name?: string;
  work_name?: string;
  payment_date?: string;
  fix_sql?: string;
  fix_description?: string;
  auto_fixable: boolean;
}

interface AuditSummary {
  total_revenues: number;
  total_cashflows_linked: number;
  total_issues: number;
  total_at_risk: number;
  issues_by_category: Record<string, number>;
  ran_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const CATEGORY_LABELS: Record<string, string> = {
  orphan: 'Pagamento Orfao',
  inconsistency: 'Inconsistencia',
  duplicate: 'Duplicacao',
  missing_cashflow: 'Fluxo de Caixa Ausente',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-50 border-red-300 text-red-800',
  warning: 'bg-yellow-50 border-yellow-300 text-yellow-800',
  info: 'bg-blue-50 border-blue-300 text-blue-800',
};

const SEVERITY_ICON_COLORS: Record<string, string> = {
  critical: 'text-red-600',
  warning: 'text-yellow-600',
  info: 'text-blue-600',
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  warning: 'bg-yellow-100 text-yellow-800',
  info: 'bg-blue-100 text-blue-800',
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: 'Critico',
  warning: 'Atencao',
  info: 'Info',
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PaymentAudit() {
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState<string | null>(null);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [issues, setIssues] = useState<AuditIssue[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [fixedIds, setFixedIds] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const runAudit = useCallback(async () => {
    setLoading(true);
    setIssues([]);
    setSummary(null);
    setFixedIds(new Set());

    try {
      const foundIssues: AuditIssue[] = [];

      // ── 1. Fetch all customer_revenue rows ──────────────────────────────
      const { data: revenues, error: revErr } = await supabase
        .from('customer_revenue')
        .select(`
          id, customer_id, origin_type, origin_id, origin_description,
          total_amount, paid_amount, balance,
          payment_date, payment_amount, payment_method,
          notes, receipt_number, estornado, created_at,
          customers ( id, name )
        `)
        .order('payment_date', { ascending: false });

      if (revErr) throw revErr;

      // ── 2. Fetch all cash_flow rows with customer_revenue_id ────────────
      const { data: cashflows, error: cfErr } = await supabase
        .from('cash_flow')
        .select('id, amount, date, description, type, customer_revenue_id, construction_work_id, customer_id')
        .eq('type', 'income')
        .not('customer_revenue_id', 'is', null);

      if (cfErr) throw cfErr;

      // ── 3. Fetch construction_work income entries WITHOUT revenue link ──
      const { data: orphanCF, error: ocfErr } = await supabase
        .from('cash_flow')
        .select('id, amount, date, description, construction_work_id, customer_id')
        .eq('type', 'income')
        .is('customer_revenue_id', null)
        .not('construction_work_id', 'is', null);

      if (ocfErr) throw ocfErr;

      // ── 4. Fetch construction works for cross-check ─────────────────────
      const { data: works, error: wErr } = await supabase
        .from('construction_works')
        .select('id, customer_id, work_name, total_contract_value');

      if (wErr) throw wErr;

      const workMap = new Map((works || []).map(w => [w.id, w]));
      const cfByRevId = new Map((cashflows || []).map(cf => [cf.customer_revenue_id, cf]));

      // ────────────────────────────────────────────────────────────────────
      // CHECK A: Revenues WITHOUT a cash_flow entry (missing sync)
      // ────────────────────────────────────────────────────────────────────
      for (const rev of revenues || []) {
        if (rev.estornado) continue; // estornado legitimately has no CF

        const linkedCF = cfByRevId.get(rev.id);
        if (!linkedCF) {
          foundIssues.push({
            id: `missing-cf-${rev.id}`,
            severity: 'warning',
            category: 'missing_cashflow',
            title: 'Receita sem entrada no Fluxo de Caixa',
            detail: `O pagamento ID ${rev.id.slice(0, 8)}... nao possui entrada correspondente no fluxo de caixa. O trigger de sincronizacao pode ter falhado.`,
            revenue_id: rev.id,
            amount: Number(rev.payment_amount),
            customer_name: (rev.customers as any)?.name,
            payment_date: rev.payment_date,
            fix_description: 'Criar a entrada no fluxo de caixa manualmente para este pagamento.',
            auto_fixable: false,
          });
        }
      }

      // ────────────────────────────────────────────────────────────────────
      // CHECK B: Revenues with wrong customer on the CF entry
      // ────────────────────────────────────────────────────────────────────
      for (const rev of revenues || []) {
        if (rev.estornado) continue;
        const linkedCF = cfByRevId.get(rev.id);
        if (!linkedCF) continue;
        if (linkedCF.customer_id && linkedCF.customer_id !== rev.customer_id) {
          foundIssues.push({
            id: `customer-mismatch-${rev.id}`,
            severity: 'critical',
            category: 'inconsistency',
            title: 'Cliente divergente entre Receita e Fluxo de Caixa',
            detail: `customer_revenue.customer_id = ${rev.customer_id.slice(0, 8)}... mas cash_flow.customer_id = ${linkedCF.customer_id.slice(0, 8)}...`,
            revenue_id: rev.id,
            cashflow_id: linkedCF.id,
            amount: Number(rev.payment_amount),
            customer_name: (rev.customers as any)?.name,
            payment_date: rev.payment_date,
            fix_description: 'Atualizar cash_flow.customer_id para coincidir com customer_revenue.customer_id.',
            fix_sql: `UPDATE cash_flow SET customer_id = '${rev.customer_id}' WHERE id = '${linkedCF.id}';`,
            auto_fixable: true,
          });
        }
      }

      // ────────────────────────────────────────────────────────────────────
      // CHECK C: Revenues with amount mismatch in CF
      // ────────────────────────────────────────────────────────────────────
      for (const rev of revenues || []) {
        if (rev.estornado) continue;
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
            detail: `customer_revenue.payment_amount = ${fmt(revAmt)} mas cash_flow.amount = ${fmt(cfAmt)}. Diferenca: ${fmt(Math.abs(revAmt - cfAmt))}.`,
            revenue_id: rev.id,
            cashflow_id: linkedCF.id,
            amount: revAmt,
            customer_name: (rev.customers as any)?.name,
            payment_date: rev.payment_date,
            fix_description: `Corrigir cash_flow.amount para ${fmt(revAmt)}.`,
            fix_sql: `UPDATE cash_flow SET amount = ${revAmt} WHERE id = '${linkedCF.id}';`,
            auto_fixable: true,
          });
        }
      }

      // ────────────────────────────────────────────────────────────────────
      // CHECK D: Revenues for construction_work where customer_id
      //          doesn't match the work's customer_id
      // ────────────────────────────────────────────────────────────────────
      for (const rev of revenues || []) {
        if (rev.origin_type !== 'construction_work') continue;
        const work = workMap.get(rev.origin_id);
        if (!work) {
          // Work no longer exists
          foundIssues.push({
            id: `orphan-work-${rev.id}`,
            severity: 'critical',
            category: 'orphan',
            title: 'Pagamento vinculado a obra inexistente',
            detail: `O pagamento referencia origin_id = ${rev.origin_id.slice(0, 8)}... mas nenhuma obra com este ID foi encontrada.`,
            revenue_id: rev.id,
            amount: Number(rev.payment_amount),
            customer_name: (rev.customers as any)?.name,
            payment_date: rev.payment_date,
            work_name: 'OBRA NAO ENCONTRADA',
            fix_description: 'Verificar se a obra foi excluida. Se sim, vincular manualmente a obra correta ou excluir o pagamento.',
            auto_fixable: false,
          });
        } else if (work.customer_id !== rev.customer_id) {
          foundIssues.push({
            id: `work-customer-mismatch-${rev.id}`,
            severity: 'warning',
            category: 'inconsistency',
            title: 'Cliente do pagamento diferente do cliente da obra',
            detail: `A obra "${work.work_name}" pertence ao cliente ${work.customer_id.slice(0, 8)}... mas o pagamento esta vinculado ao cliente ${rev.customer_id.slice(0, 8)}...`,
            revenue_id: rev.id,
            amount: Number(rev.payment_amount),
            customer_name: (rev.customers as any)?.name,
            work_name: work.work_name,
            payment_date: rev.payment_date,
            fix_description: 'Corrigir customer_revenue.customer_id para coincidir com o cliente da obra.',
            fix_sql: `UPDATE customer_revenue SET customer_id = '${work.customer_id}' WHERE id = '${rev.id}';`,
            auto_fixable: true,
          });
        }
      }

      // ────────────────────────────────────────────────────────────────────
      // CHECK E: Duplicate cash_flow income entries for same work
      //          (those WITHOUT customer_revenue_id) — legacy orphan CF
      // ────────────────────────────────────────────────────────────────────
      const orphanCFMap = new Map<string, typeof orphanCF>();
      for (const cf of orphanCF || []) {
        if (!cf.construction_work_id) continue;
        const key = cf.construction_work_id;
        if (!orphanCFMap.has(key)) orphanCFMap.set(key, []);
        orphanCFMap.get(key)!.push(cf);
      }

      for (const [workId, entries] of orphanCFMap.entries()) {
        const work = workMap.get(workId);
        // Check if there's ALSO a customer_revenue entry for this work
        const hasRevenue = (revenues || []).some(
          r => r.origin_type === 'construction_work' && r.origin_id === workId && !r.estornado
        );

        if (hasRevenue && entries && entries.length > 0) {
          for (const cf of entries) {
            foundIssues.push({
              id: `duplicate-cf-${cf.id}`,
              severity: 'warning',
              category: 'duplicate',
              title: 'Entrada de caixa duplicada para esta obra',
              detail: `A obra "${work?.work_name || workId.slice(0, 8)}" possui uma entrada no fluxo de caixa (ID ${cf.id.slice(0, 8)}...) SEM vinculo a customer_revenue, mas ja existe um registro em customer_revenue para esta obra. Pode ser uma entrada legada ou duplicada.`,
              cashflow_id: cf.id,
              amount: Number(cf.amount),
              work_name: work?.work_name,
              payment_date: cf.date,
              fix_description: 'Verificar se esta entrada de caixa e um registro legado. Se for duplicata, pode ser excluida com seguranca.',
              fix_sql: `DELETE FROM cash_flow WHERE id = '${cf.id}';`,
              auto_fixable: true,
            });
          }
        }
      }

      // ────────────────────────────────────────────────────────────────────
      // CHECK F: Revenues without a valid customer (customer deleted?)
      // ────────────────────────────────────────────────────────────────────
      const { data: customerIds } = await supabase
        .from('customers')
        .select('id');

      const validCustomerIds = new Set((customerIds || []).map(c => c.id));

      for (const rev of revenues || []) {
        if (!validCustomerIds.has(rev.customer_id)) {
          foundIssues.push({
            id: `orphan-customer-${rev.id}`,
            severity: 'critical',
            category: 'orphan',
            title: 'Pagamento sem cliente valido',
            detail: `customer_revenue.customer_id = ${rev.customer_id.slice(0, 8)}... mas este cliente nao existe mais na tabela customers.`,
            revenue_id: rev.id,
            amount: Number(rev.payment_amount),
            payment_date: rev.payment_date,
            fix_description: 'Vincular manualmente a um cliente existente ou excluir o pagamento apos verificacao.',
            auto_fixable: false,
          });
        }
      }

      // ── Build summary ────────────────────────────────────────────────────
      const issuesByCategory: Record<string, number> = {};
      for (const issue of foundIssues) {
        issuesByCategory[issue.category] = (issuesByCategory[issue.category] || 0) + 1;
      }

      const totalAtRisk = foundIssues.reduce((sum, i) => sum + i.amount, 0);

      setSummary({
        total_revenues: (revenues || []).length,
        total_cashflows_linked: (cashflows || []).length,
        total_issues: foundIssues.length,
        total_at_risk: totalAtRisk,
        issues_by_category: issuesByCategory,
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
    if (!issue.auto_fixable || !issue.fix_sql) return;
    if (!confirm(`Aplicar correcao automatica?\n\n${issue.fix_description}\n\nSQL:\n${issue.fix_sql}`)) return;

    setFixing(issue.id);
    try {
      if (issue.category === 'inconsistency' && issue.cashflow_id && issue.revenue_id) {
        if (issue.fix_sql.includes('cash_flow SET customer_id')) {
          const rev = issues.find(i => i.id === issue.id);
          if (rev) {
            const customerId = issue.fix_sql.match(/'([^']+)'/)?.[1];
            if (customerId) {
              await supabase.from('cash_flow').update({ customer_id: customerId }).eq('id', issue.cashflow_id);
            }
          }
        } else if (issue.fix_sql.includes('cash_flow SET amount')) {
          await supabase.from('cash_flow').update({ amount: issue.amount }).eq('id', issue.cashflow_id);
        } else if (issue.fix_sql.includes('customer_revenue SET customer_id')) {
          const customerId = issue.fix_sql.match(/'([^']+)'/)?.[1];
          if (customerId && issue.revenue_id) {
            await supabase.from('customer_revenue').update({ customer_id: customerId }).eq('id', issue.revenue_id);
          }
        }
      } else if (issue.category === 'duplicate' && issue.cashflow_id) {
        await supabase.from('cash_flow').delete().eq('id', issue.cashflow_id);
      }

      setFixedIds(prev => new Set([...prev, issue.id]));
      alert('Correcao aplicada com sucesso!');
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

  const exportReport = () => {
    if (!summary) return;
    const lines: string[] = [
      '======================================================',
      '   AUDITORIA DE INTEGRIDADE DE PAGAMENTOS',
      `   Data: ${summary.ran_at}`,
      '======================================================',
      '',
      'RESUMO EXECUTIVO',
      '-----------------',
      `Total de Receitas Auditadas : ${summary.total_revenues}`,
      `Entradas de Caixa Vinculadas: ${summary.total_cashflows_linked}`,
      `Problemas Encontrados       : ${summary.total_issues}`,
      `Valor Total em Risco        : ${fmt(summary.total_at_risk)}`,
      '',
      'PROBLEMAS POR CATEGORIA',
      '-----------------------',
      ...Object.entries(summary.issues_by_category).map(
        ([k, v]) => `  ${CATEGORY_LABELS[k] || k}: ${v} ocorrencia(s)`
      ),
      '',
      'DETALHES DOS PROBLEMAS',
      '----------------------',
    ];

    for (const issue of issues) {
      if (fixedIds.has(issue.id)) continue;
      lines.push(`[${SEVERITY_LABEL[issue.severity]}] ${issue.title}`);
      lines.push(`  Categoria  : ${CATEGORY_LABELS[issue.category]}`);
      lines.push(`  Valor      : ${fmt(issue.amount)}`);
      if (issue.customer_name) lines.push(`  Cliente    : ${issue.customer_name}`);
      if (issue.work_name) lines.push(`  Obra       : ${issue.work_name}`);
      if (issue.payment_date) lines.push(`  Data       : ${new Date(issue.payment_date).toLocaleDateString('pt-BR')}`);
      lines.push(`  Descricao  : ${issue.detail}`);
      if (issue.fix_description) lines.push(`  Acao       : ${issue.fix_description}`);
      if (issue.fix_sql) lines.push(`  SQL        : ${issue.fix_sql}`);
      lines.push('');
    }

    lines.push('======================================================');
    lines.push('FIM DO RELATORIO');

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria_pagamentos_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredIssues = issues.filter(i => {
    if (fixedIds.has(i.id)) return false;
    if (activeFilter === 'all') return true;
    return i.category === activeFilter;
  });

  const openIssues = issues.filter(i => !fixedIds.has(i.id));
  const criticalCount = openIssues.filter(i => i.severity === 'critical').length;
  const warningCount = openIssues.filter(i => i.severity === 'warning').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="h-8 w-8 text-blue-600" />
            Auditoria de Integridade de Pagamentos
          </h2>
          <p className="text-gray-600 mt-1">
            Varredura completa para detectar inconsistencias, duplicacoes e pagamentos orfaos
          </p>
        </div>
        <div className="flex items-center gap-3">
          {summary && (
            <button
              onClick={exportReport}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              <Download className="h-4 w-4" />
              Exportar Relatorio
            </button>
          )}
          <button
            onClick={runAudit}
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Auditando...' : 'Executar Auditoria'}
          </button>
        </div>
      </div>

      {/* Pre-run placeholder */}
      {!summary && !loading && (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-16 text-center">
          <ShieldCheck className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-500 mb-2">Pronto para auditar</h3>
          <p className="text-sm text-gray-400 max-w-md mx-auto">
            Clique em "Executar Auditoria" para verificar a integridade de todos os pagamentos registrados
            no sistema — receitas de clientes, fluxo de caixa e obras.
          </p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <RefreshCw className="h-12 w-12 text-blue-500 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600 font-medium">Analisando registros financeiros...</p>
          <p className="text-sm text-gray-400 mt-1">Isso pode levar alguns segundos</p>
        </div>
      )}

      {/* Summary cards */}
      {summary && !loading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Receitas Auditadas</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{summary.total_revenues}</p>
              <p className="text-xs text-gray-400 mt-1">registros em customer_revenue</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Fluxo de Caixa</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{summary.total_cashflows_linked}</p>
              <p className="text-xs text-gray-400 mt-1">entradas vinculadas</p>
            </div>
            <div className={`rounded-xl border-2 p-5 ${openIssues.length === 0 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Problemas</p>
              <p className={`text-3xl font-bold mt-1 ${openIssues.length === 0 ? 'text-green-700' : 'text-orange-700'}`}>
                {openIssues.length}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {fixedIds.size > 0 ? `${fixedIds.size} ja corrigido(s)` : 'encontrados'}
              </p>
            </div>
            <div className={`rounded-xl border-2 p-5 ${summary.total_at_risk === 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Valor em Risco</p>
              <p className={`text-2xl font-bold mt-1 ${summary.total_at_risk === 0 ? 'text-green-700' : 'text-red-700'}`}>
                {fmt(summary.total_at_risk)}
              </p>
              <p className="text-xs text-gray-400 mt-1">soma dos pagamentos afetados</p>
            </div>
          </div>

          {/* Severity breakdown */}
          {openIssues.length > 0 && (
            <div className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 px-5 py-4">
              <span className="text-sm font-medium text-gray-600">Severidade:</span>
              {criticalCount > 0 && (
                <span className="flex items-center gap-1.5 text-sm font-semibold text-red-700">
                  <XCircle className="h-4 w-4" /> {criticalCount} critico{criticalCount !== 1 ? 's' : ''}
                </span>
              )}
              {warningCount > 0 && (
                <span className="flex items-center gap-1.5 text-sm font-semibold text-yellow-700">
                  <AlertTriangle className="h-4 w-4" /> {warningCount} atencao
                </span>
              )}
              {criticalCount === 0 && warningCount === 0 && (
                <span className="flex items-center gap-1.5 text-sm font-semibold text-green-700">
                  <CheckCircle2 className="h-4 w-4" /> Nenhum problema critico
                </span>
              )}
            </div>
          )}

          {/* All clear */}
          {openIssues.length === 0 && (
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-8 text-center">
              <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto mb-3" />
              <h3 className="text-xl font-bold text-green-800 mb-1">Todos os pagamentos estao integros!</h3>
              <p className="text-green-700 text-sm">
                Nenhuma inconsistencia, duplicacao ou pagamento orfao foi detectado em {summary.total_revenues} registros auditados.
              </p>
              <p className="text-green-600 text-xs mt-2">Auditoria executada em {summary.ran_at}</p>
            </div>
          )}

          {/* Filter tabs */}
          {openIssues.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { key: 'all', label: `Todos (${openIssues.length})` },
                ...Object.entries(summary.issues_by_category)
                  .filter(([, v]) => v > 0)
                  .map(([k, v]) => ({ key: k, label: `${CATEGORY_LABELS[k]} (${v})` }))
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

          {/* Issues list */}
          {filteredIssues.length > 0 && (
            <div className="space-y-3">
              {filteredIssues.map(issue => (
                <div
                  key={issue.id}
                  className={`rounded-xl border-2 overflow-hidden ${SEVERITY_COLORS[issue.severity]}`}
                >
                  {/* Issue header */}
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer"
                    onClick={() => toggleExpand(issue.id)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {issue.severity === 'critical' ? (
                        <XCircle className={`h-5 w-5 flex-shrink-0 ${SEVERITY_ICON_COLORS[issue.severity]}`} />
                      ) : issue.severity === 'warning' ? (
                        <AlertTriangle className={`h-5 w-5 flex-shrink-0 ${SEVERITY_ICON_COLORS[issue.severity]}`} />
                      ) : (
                        <Info className={`h-5 w-5 flex-shrink-0 ${SEVERITY_ICON_COLORS[issue.severity]}`} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{issue.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_BADGE[issue.severity]}`}>
                            {SEVERITY_LABEL[issue.severity]}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {CATEGORY_LABELS[issue.category]}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-0.5 text-xs opacity-80">
                          <span className="font-bold">{fmt(issue.amount)}</span>
                          {issue.customer_name && <span>{issue.customer_name}</span>}
                          {issue.work_name && <span>{issue.work_name}</span>}
                          {issue.payment_date && (
                            <span>{new Date(issue.payment_date).toLocaleDateString('pt-BR')}</span>
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
                          {fixing === issue.id ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <Wrench className="h-3 w-3" />
                          )}
                          Corrigir
                        </button>
                      )}
                      {expanded.has(issue.id) ? (
                        <ChevronDown className="h-4 w-4 opacity-60" />
                      ) : (
                        <ChevronRight className="h-4 w-4 opacity-60" />
                      )}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expanded.has(issue.id) && (
                    <div className="border-t border-current border-opacity-20 px-4 py-4 space-y-3 bg-white bg-opacity-60">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Descricao do Problema</p>
                        <p className="text-sm text-gray-700">{issue.detail}</p>
                      </div>

                      {(issue.revenue_id || issue.cashflow_id) && (
                        <div className="flex gap-6 text-xs text-gray-500">
                          {issue.revenue_id && (
                            <span><span className="font-medium">Revenue ID:</span> {issue.revenue_id}</span>
                          )}
                          {issue.cashflow_id && (
                            <span><span className="font-medium">CashFlow ID:</span> {issue.cashflow_id}</span>
                          )}
                        </div>
                      )}

                      {issue.fix_description && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Acao Recomendada</p>
                          <p className="text-sm text-gray-700">{issue.fix_description}</p>
                        </div>
                      )}

                      {issue.fix_sql && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">SQL de Correcao</p>
                          <pre className="bg-gray-900 text-green-400 text-xs p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all">
                            {issue.fix_sql}
                          </pre>
                        </div>
                      )}

                      {!issue.auto_fixable && (
                        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                          <span>Esta correc ao requer intervencao manual — nao pode ser aplicada automaticamente.</span>
                        </div>
                      )}

                      {issue.category === 'duplicate' && issue.cashflow_id && issue.auto_fixable && (
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

          {/* Checklist */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Checklist de Validacao Pos-Auditoria
            </h3>
            <div className="space-y-2 text-sm text-gray-700">
              {[
                'Todos os pagamentos em customer_revenue possuem entrada correspondente em cash_flow',
                'Os valores de payment_amount em customer_revenue coincidem com amount em cash_flow',
                'O campo customer_id e consistente entre as duas tabelas',
                'Nenhum pagamento esta vinculado a uma obra ou cliente inexistente',
                'Nao ha entradas duplicadas no fluxo de caixa para a mesma obra',
                'Pagamentos estornados (estornado=true) nao possuem entrada ativa no cash_flow',
                'O total recebido por obra bate com a soma dos payment_amount no customer_revenue',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle2 className={`h-4 w-4 flex-shrink-0 mt-0.5 ${openIssues.length === 0 ? 'text-green-500' : 'text-gray-300'}`} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Auditoria executada em {summary.ran_at} — {summary.total_revenues} receitas e {summary.total_cashflows_linked} entradas de caixa analisadas
          </p>
        </>
      )}
    </div>
  );
}
