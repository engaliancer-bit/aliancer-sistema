import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { BarChart2, CheckCircle, Clock, AlertCircle, Download, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { Budget, WBSStep, BudgetItem, BudgetElement, CalculationLog, fmtBRL, fmtQty, ELEMENT_CATEGORIES, MEASUREMENT_STATUS_CONFIG } from './types';

interface Props {
  budget: Budget;
  wbsSteps: WBSStep[];
}

export default function BudgetReportPanel({ budget, wbsSteps }: Props) {
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [elements, setElements] = useState<BudgetElement[]>([]);
  const [logs, setLogs] = useState<CalculationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState(false);
  const [expandedWbs, setExpandedWbs] = useState<Record<string, boolean>>({});

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [itemsRes, elemRes, logRes] = await Promise.all([
      supabase.from('budget_items')
        .select('id,budget_id,wbs_step_id,item_type,description,unit,quantity,unit_price,total_price,bdi_value,final_price,notes')
        .eq('budget_id', budget.id)
        .limit(2000)
        .order('sort_order'),
      supabase.from('budget_elements')
        .select('id,budget_id,wbs_step_id,element_type,label,room,quantity,unit,measurement_status,params,notes')
        .eq('budget_id', budget.id)
        .limit(5000)
        .order('created_at'),
      supabase.from('budget_calculation_logs')
        .select('id,budget_id,log_type,source_type,source_id,old_value,new_value,reason,created_at')
        .eq('budget_id', budget.id)
        .limit(100)
        .order('created_at', { ascending: false }),
    ]);
    setItems(itemsRes.data || []);
    setElements(elemRes.data || []);
    setLogs(logRes.data || []);
    setLoading(false);
    const allOpen: Record<string, boolean> = {};
    (itemsRes.data || []).forEach(i => { if (i.wbs_step_id) allOpen[i.wbs_step_id] = true; });
    setExpandedWbs(allOpen);
  }, [budget.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const itemsByWbs = useMemo(() => {
    const map: Record<string, BudgetItem[]> = {};
    wbsSteps.forEach(s => { map[s.id] = []; });
    items.forEach(i => {
      const key = i.wbs_step_id || '__none__';
      if (!map[key]) map[key] = [];
      map[key].push(i);
    });
    return map;
  }, [items, wbsSteps]);

  const elementsByStatus = useMemo(() => {
    const res = { confirmado: 0, sugerido: 0, pendente: 0, ignorado: 0, total: elements.length };
    elements.forEach(e => { res[e.measurement_status]++; });
    return res;
  }, [elements]);

  const wbsTotals = useMemo(() => {
    return wbsSteps.map(s => {
      const stepItems = itemsByWbs[s.id] || [];
      return {
        step: s,
        count: stepItems.length,
        base: stepItems.reduce((a, i) => a + i.total_price, 0),
        bdi: stepItems.reduce((a, i) => a + i.bdi_value, 0),
        total: stepItems.reduce((a, i) => a + i.final_price, 0),
      };
    }).filter(r => r.count > 0);
  }, [wbsSteps, itemsByWbs]);

  const exportCSV = () => {
    const rows: string[][] = [
      ['Etapa', 'Descricao', 'Tipo', 'Unidade', 'Quantidade', 'Preco Unit.', 'Base', 'BDI', 'Total Final'],
    ];
    wbsSteps.forEach(s => {
      (itemsByWbs[s.id] || []).forEach(i => {
        rows.push([
          `${s.code} - ${s.name}`,
          i.description,
          i.item_type,
          i.unit,
          String(i.quantity),
          String(i.unit_price),
          String(i.total_price),
          String(i.bdi_value),
          String(i.final_price),
        ]);
      });
    });
    (itemsByWbs['__none__'] || []).forEach(i => {
      rows.push(['Sem Etapa', i.description, i.item_type, i.unit, String(i.quantity), String(i.unit_price), String(i.total_price), String(i.bdi_value), String(i.final_price)]);
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orcamento_${budget.title.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-gray-400">
      <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mr-2" />
      Gerando relatorio...
    </div>
  );

  const confirmedPct = elementsByStatus.total > 0
    ? Math.round((elementsByStatus.confirmado / elementsByStatus.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Materiais / Produtos</p>
          <p className="text-xl font-bold text-gray-800">{fmtBRL(budget.total_materials)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Mao de Obra</p>
          <p className="text-xl font-bold text-gray-800">{fmtBRL(budget.total_labor)}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs text-amber-600 mb-1">BDI ({budget.bdi_percent}%)</p>
          <p className="text-xl font-bold text-amber-700">{fmtBRL(budget.total_bdi)}</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-xs text-orange-600 mb-1">Total Geral</p>
          <p className="text-xl font-bold text-orange-700">{fmtBRL(budget.grand_total)}</p>
        </div>
      </div>

      {/* Elements status */}
      {elements.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-orange-500" />
            Status dos Elementos Parametricos ({elements.length} total)
          </h3>
          <div className="flex h-2 rounded-full overflow-hidden mb-3 gap-0.5">
            {elementsByStatus.confirmado > 0 && (
              <div className="bg-green-500 transition-all" style={{ width: `${(elementsByStatus.confirmado / elementsByStatus.total) * 100}%` }} />
            )}
            {elementsByStatus.sugerido > 0 && (
              <div className="bg-blue-400 transition-all" style={{ width: `${(elementsByStatus.sugerido / elementsByStatus.total) * 100}%` }} />
            )}
            {elementsByStatus.pendente > 0 && (
              <div className="bg-gray-300 transition-all" style={{ width: `${(elementsByStatus.pendente / elementsByStatus.total) * 100}%` }} />
            )}
            {elementsByStatus.ignorado > 0 && (
              <div className="bg-red-300 transition-all" style={{ width: `${(elementsByStatus.ignorado / elementsByStatus.total) * 100}%` }} />
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {(['confirmado', 'sugerido', 'pendente', 'ignorado'] as const).map(s => {
              const cfg = MEASUREMENT_STATUS_CONFIG[s];
              const count = elementsByStatus[s];
              const Icon = s === 'confirmado' ? CheckCircle : s === 'pendente' ? Clock : s === 'ignorado' ? AlertCircle : BarChart2;
              return (
                <div key={s} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${cfg.color.replace('text-', 'text-').replace('bg-', 'bg-')}`}>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">{count}</p>
                    <p className="text-xs opacity-80">{cfg.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {confirmedPct < 100 && (
            <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {100 - confirmedPct}% dos elementos ainda nao foram confirmados. Revise antes de aprovar o orcamento.
            </p>
          )}
        </div>
      )}

      {/* WBS breakdown */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <FileText className="w-4 h-4 text-orange-500" />
            Breakdown por Etapa WBS
          </h3>
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors">
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </button>
        </div>

        {wbsTotals.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            Nenhum item adicionado ainda. Adicione itens na aba "Itens do Orcamento".
          </div>
        ) : (
          <div>
            {wbsTotals.map(({ step, count, base, bdi, total }) => {
              const isOpen = expandedWbs[step.id];
              const stepItems = itemsByWbs[step.id] || [];
              const pct = budget.grand_total > 0 ? (total / budget.grand_total) * 100 : 0;
              return (
                <div key={step.id} className="border-b border-gray-100 last:border-0">
                  <button onClick={() => setExpandedWbs(p => ({ ...p, [step.id]: !p[step.id] }))}
                    className="w-full px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-xs text-gray-400">{step.code}</span>
                        <span className="font-medium text-gray-700 text-sm truncate">{step.name}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">{count} item{count !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-gray-800 text-sm">{fmtBRL(total)}</p>
                      <p className="text-xs text-gray-400">{pct.toFixed(1)}% do total</p>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-3">
                      <div className="overflow-x-auto rounded-lg border border-gray-100">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-gray-50 text-gray-500">
                              <th className="text-left px-3 py-2">Descricao</th>
                              <th className="text-right px-3 py-2 w-24">Qtd</th>
                              <th className="text-right px-3 py-2 w-28">P. Unit.</th>
                              <th className="text-right px-3 py-2 w-28">Base</th>
                              <th className="text-right px-3 py-2 w-24">BDI</th>
                              <th className="text-right px-3 py-2 w-28">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {stepItems.map(item => (
                              <tr key={item.id} className="hover:bg-gray-50/50">
                                <td className="px-3 py-2 text-gray-700">{item.description}</td>
                                <td className="px-3 py-2 text-right text-gray-500">{item.quantity} {item.unit}</td>
                                <td className="px-3 py-2 text-right text-gray-500">{fmtBRL(item.unit_price)}</td>
                                <td className="px-3 py-2 text-right text-gray-600">{fmtBRL(item.total_price)}</td>
                                <td className="px-3 py-2 text-right text-amber-600">+{fmtBRL(item.bdi_value)}</td>
                                <td className="px-3 py-2 text-right font-semibold text-gray-800">{fmtBRL(item.final_price)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-orange-50 font-semibold">
                              <td colSpan={3} className="px-3 py-2 text-orange-700">Subtotal {step.code}</td>
                              <td className="px-3 py-2 text-right text-gray-700">{fmtBRL(base)}</td>
                              <td className="px-3 py-2 text-right text-amber-600">+{fmtBRL(bdi)}</td>
                              <td className="px-3 py-2 text-right text-orange-700">{fmtBRL(total)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {/* Footer total */}
            <div className="px-5 py-4 bg-gradient-to-r from-orange-50 to-amber-50 border-t border-orange-200 flex items-center justify-between">
              <span className="font-semibold text-gray-700">Total Geral</span>
              <div className="flex gap-8 text-sm">
                <div className="text-right">
                  <p className="text-xs text-gray-400">Base</p>
                  <p className="font-semibold text-gray-700">{fmtBRL(wbsTotals.reduce((s, r) => s + r.base, 0))}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-amber-500">BDI</p>
                  <p className="font-semibold text-amber-600">+{fmtBRL(wbsTotals.reduce((s, r) => s + r.bdi, 0))}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-orange-500">Total c/ BDI</p>
                  <p className="text-xl font-bold text-orange-600">{fmtBRL(budget.grand_total)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Elements detail */}
      {elements.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Quantitativos Parametricos</h3>
            <p className="text-xs text-gray-400 mt-0.5">Elementos registrados com calculo automatico de quantidades</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs">
                  <th className="text-left px-4 py-2">Elemento</th>
                  <th className="text-left px-3 py-2">Categoria</th>
                  <th className="text-left px-3 py-2">Etapa WBS</th>
                  <th className="text-right px-3 py-2">Quantidade</th>
                  <th className="text-center px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Formula / Memoria</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {elements.map(el => {
                  const cat = ELEMENT_CATEGORIES[el.element_type.includes('_') ? el.element_type.split('_')[0] : el.element_type] || ELEMENT_CATEGORIES.outros;
                  const wbs = wbsSteps.find(s => s.id === el.wbs_step_id);
                  const stCfg = MEASUREMENT_STATUS_CONFIG[el.measurement_status];
                  return (
                    <tr key={el.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{el.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{el.element_type}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cat.bg} ${cat.color}`}>{cat.label}</span>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500">
                        {wbs ? `${wbs.code} - ${wbs.name}` : '—'}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-gray-800">
                        {el.calculated_quantity > 0 ? fmtQty(el.calculated_quantity, el.calculated_unit) : '—'}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stCfg.color}`}>{stCfg.label}</span>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500 max-w-xs truncate">
                        {el.calc_summary || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Calculation memory / audit log */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <button onClick={() => setExpandedLog(p => !p)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left">
          <div className="flex items-center gap-2">
            {expandedLog ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
            <h3 className="text-sm font-semibold text-gray-700">Memoria de Calculo ({logs.length} registros)</h3>
          </div>
          <span className="text-xs text-gray-400">Auditoria completa de todos os calculos realizados</span>
        </button>
        {expandedLog && (
          logs.length === 0 ? (
            <div className="px-5 pb-4 text-sm text-gray-400">Nenhum log de calculo registrado ainda.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <th className="text-left px-4 py-2">Data</th>
                    <th className="text-left px-3 py-2">Tipo</th>
                    <th className="text-left px-3 py-2">Formula</th>
                    <th className="text-right px-3 py-2">Resultado</th>
                    <th className="text-left px-3 py-2">Observacao</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-3 py-2">
                        <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">{log.calculation_type}</span>
                      </td>
                      <td className="px-3 py-2 text-gray-600 max-w-xs truncate">{log.formula || '—'}</td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-800">
                        {log.result_value != null ? `${log.result_value} ${log.result_unit || ''}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-500 max-w-xs truncate">{log.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
