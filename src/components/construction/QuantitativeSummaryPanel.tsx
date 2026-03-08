import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { BarChart2, RefreshCw, CheckCircle, Clock, TrendingUp, Download, Package, AlertTriangle, Beaker } from 'lucide-react';
import { Budget, WBSStep, ELEMENT_CATEGORIES, fmtQty } from './types';

interface Props {
  budget: Budget;
  wbsSteps: WBSStep[];
}

interface QuantRow {
  category: string;
  category_label: string;
  element_type: string;
  element_label: string;
  total_quantity: number;
  unit: string;
  confirmed_quantity: number;
  pending_quantity: number;
  element_count: number;
}

interface GroupedCategory {
  category: string;
  category_label: string;
  rows: QuantRow[];
  total_confirmed: number;
  total_pending: number;
}

interface ConsumptionRow {
  material_id: string;
  material_name: string;
  unit: string;
  total_consumption_kg: number;
  bags_50kg: number;
  contributing_types: Array<{
    element_type: string;
    element_label: string;
    volume_m3: number;
    consumption_kg: number;
  }> | null;
  missing_recipes: Array<{ element_type: string; param_key: string }> | null;
}

type ActiveTab = 'quantitativos' | 'insumos';

export default function QuantitativeSummaryPanel({ budget, wbsSteps }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('quantitativos');
  const [rows, setRows] = useState<QuantRow[]>([]);
  const [consumption, setConsumption] = useState<ConsumptionRow[]>([]);
  const [missingRecipes, setMissingRecipes] = useState<Array<{ element_type: string; param_key: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [loadingConsumption, setLoadingConsumption] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedMat, setExpandedMat] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.rpc('get_budget_quantitative_summary', {
      p_budget_id: budget.id,
    });
    setRows(data || []);
    const cats = new Set((data || []).map((r: QuantRow) => r.category));
    setExpanded(cats);
    setLoading(false);
  }, [budget.id]);

  const loadConsumption = useCallback(async () => {
    setLoadingConsumption(true);
    const { data, error } = await supabase.rpc('get_budget_material_consumption_summary', {
      p_budget_id: budget.id,
    });
    if (!error && data) {
      setConsumption(data);
      const missing = (data[0]?.missing_recipes as Array<{ element_type: string; param_key: string }>) || [];
      setMissingRecipes(missing);
    }
    setLoadingConsumption(false);
  }, [budget.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (activeTab === 'insumos') {
      loadConsumption();
    }
  }, [activeTab, loadConsumption]);

  const grouped: GroupedCategory[] = Object.values(
    rows.reduce<Record<string, GroupedCategory>>((acc, row) => {
      if (!acc[row.category]) {
        acc[row.category] = {
          category: row.category,
          category_label: row.category_label,
          rows: [],
          total_confirmed: 0,
          total_pending: 0,
        };
      }
      acc[row.category].rows.push(row);
      acc[row.category].total_confirmed += row.confirmed_quantity;
      acc[row.category].total_pending += row.pending_quantity;
      return acc;
    }, {})
  );

  const totalElements = rows.reduce((s, r) => s + r.element_count, 0);
  const totalConfirmed = rows.reduce((s, r) => s + (r.confirmed_quantity > 0 ? 1 : 0), 0);
  const confirmPct = rows.length > 0
    ? Math.round((rows.filter(r => r.confirmed_quantity >= r.total_quantity && r.total_quantity > 0).length / rows.length) * 100)
    : 0;

  const exportCSV = () => {
    const lines = [
      'Categoria;Elemento;Qtd Total;Unidade;Qtd Confirmada;Qtd Pendente;Qtd Elementos',
      ...rows.map(r =>
        `${r.category_label};${r.element_label};${r.total_quantity.toFixed(4)};${r.unit};${r.confirmed_quantity.toFixed(4)};${r.pending_quantity.toFixed(4)};${r.element_count}`
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quantitativos_${budget.title.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportConsumptionCSV = () => {
    const lines = [
      'Insumo;Unidade;Consumo Total (kg);Sacos 50kg;Fontes',
      ...consumption.map(c => {
        const fontes = (c.contributing_types || []).map(t => `${t.element_label}: ${t.consumption_kg.toFixed(1)}kg`).join(' | ');
        return `${c.material_name};${c.unit};${c.total_consumption_kg.toFixed(2)};${c.bags_50kg.toFixed(2)};${fontes}`;
      }),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consumo_insumos_${budget.title.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleCat = (cat: string) => setExpanded(prev => {
    const s = new Set(prev);
    s.has(cat) ? s.delete(cat) : s.add(cat);
    return s;
  });

  const toggleMat = (matId: string) => setExpandedMat(prev => {
    const s = new Set(prev);
    s.has(matId) ? s.delete(matId) : s.add(matId);
    return s;
  });

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('quantitativos')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'quantitativos'
              ? 'border-orange-500 text-orange-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4" />
            Quantitativos
          </span>
        </button>
        <button
          onClick={() => setActiveTab('insumos')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'insumos'
              ? 'border-orange-500 text-orange-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Beaker className="w-4 h-4" />
            Consumo de Insumos
          </span>
        </button>
      </div>

      {activeTab === 'quantitativos' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-gray-900">Resumo de Quantitativos</h3>
            <div className="flex gap-2">
              <button onClick={load} className="p-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-500">
                <RefreshCw className="w-4 h-4" />
              </button>
              <button onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                <Download className="w-4 h-4" /> Exportar CSV
              </button>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
              <BarChart2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Nenhum elemento cadastrado</p>
              <p className="text-gray-400 text-sm mt-1">
                Adicione elementos parametricos na aba <strong>Elementos</strong> para ver o resumo de quantitativos.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-400 mb-1">Total de Elementos</p>
                  <p className="text-2xl font-bold text-gray-900">{totalElements}</p>
                  <p className="text-xs text-gray-500 mt-1">{grouped.length} categorias</p>
                </div>
                <div className="bg-white border border-green-200 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                    <p className="text-xs text-gray-400">Confirmados</p>
                  </div>
                  <p className="text-2xl font-bold text-green-600">{totalConfirmed}</p>
                  <p className="text-xs text-gray-500 mt-1">tipos de elemento</p>
                </div>
                <div className="bg-white border border-amber-200 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                    <p className="text-xs text-gray-400">Progresso</p>
                  </div>
                  <p className="text-2xl font-bold text-amber-600">{confirmPct}%</p>
                  <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${confirmPct}%` }} />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {grouped.map(group => {
                  const catCfg = ELEMENT_CATEGORIES[group.category] || ELEMENT_CATEGORIES.outros;
                  const isOpen = expanded.has(group.category);
                  return (
                    <div key={group.category} className="border border-gray-200 rounded-xl overflow-hidden">
                      <button
                        onClick={() => toggleCat(group.category)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${catCfg.bg} ${catCfg.color}`}>
                            {group.category_label}
                          </span>
                          <span className="text-xs text-gray-400">{group.rows.length} tipo(s)</span>
                        </div>
                        <div className="flex items-center gap-4">
                          {group.total_confirmed > 0 && (
                            <span className="text-xs text-green-600 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> confirmado
                            </span>
                          )}
                          {group.total_pending > 0 && (
                            <span className="text-xs text-amber-600 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> pendente
                            </span>
                          )}
                        </div>
                      </button>

                      {isOpen && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-t border-gray-100">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Elemento</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Qtd Total</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Confirmado</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Pendente</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Itens</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {group.rows.map(row => {
                                const allConfirmed = row.confirmed_quantity >= row.total_quantity && row.total_quantity > 0;
                                const partial = row.confirmed_quantity > 0 && !allConfirmed;
                                return (
                                  <tr key={row.element_type} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 font-medium text-gray-800">{row.element_label}</td>
                                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                                      {fmtQty(row.total_quantity, row.unit)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-green-600">
                                      {row.confirmed_quantity > 0 ? fmtQty(row.confirmed_quantity, row.unit) : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-right text-amber-600">
                                      {row.pending_quantity > 0 ? fmtQty(row.pending_quantity, row.unit) : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-500">{row.element_count}</td>
                                    <td className="px-4 py-3 text-right">
                                      {allConfirmed ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-medium">
                                          <CheckCircle className="w-3 h-3" /> OK
                                        </span>
                                      ) : partial ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-medium">
                                          <Clock className="w-3 h-3" /> Parcial
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[10px] font-medium">
                                          <Clock className="w-3 h-3" /> Pendente
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot className="bg-gray-50 border-t border-gray-200">
                              <tr>
                                <td className="px-4 py-2 text-xs font-semibold text-gray-600">
                                  Total da categoria ({group.rows.length} tipo(s))
                                </td>
                                <td colSpan={4} />
                                <td className="px-4 py-2 text-right">
                                  <span className={`text-xs font-medium ${
                                    group.total_pending === 0 && group.total_confirmed > 0
                                      ? 'text-green-600' : 'text-amber-600'
                                  }`}>
                                    {group.total_pending === 0 && group.total_confirmed > 0 ? 'Completo' : 'Em andamento'}
                                  </span>
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'insumos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-gray-900">Consumo de Insumos</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Calculado a partir dos tracos vinculados nos Parametros Globais e dos volumes dos elementos.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={loadConsumption}
                disabled={loadingConsumption}
                className="p-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-500 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loadingConsumption ? 'animate-spin' : ''}`} />
              </button>
              {consumption.length > 0 && (
                <button
                  onClick={exportConsumptionCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  <Download className="w-4 h-4" /> Exportar CSV
                </button>
              )}
            </div>
          </div>

          {loadingConsumption ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : consumption.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
              <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Nenhum consumo calculado</p>
              <p className="text-gray-400 text-sm mt-1 max-w-sm mx-auto">
                Para calcular o consumo de insumos, certifique-se de:
              </p>
              <ol className="text-gray-400 text-sm mt-2 text-left inline-block space-y-1">
                <li>1. Cadastrar tracos com <strong>Peso Especifico</strong> na aba Tracoes</li>
                <li>2. Vincular cada traco nos <strong>Parametros Globais</strong> deste orcamento</li>
                <li>3. Ter elementos com volumes calculados (m³)</li>
              </ol>
            </div>
          ) : (
            <>
              {missingRecipes.length > 0 && (
                <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-amber-800">Tracos nao vinculados</p>
                    <p className="text-amber-700 text-xs mt-0.5">
                      Os seguintes tipos de elemento nao tem traco vinculado nos Parametros Globais e nao entram no calculo:
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {missingRecipes.map(m => (
                        <span key={m.element_type} className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                          {m.element_type.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                    <p className="text-amber-600 text-xs mt-1.5">
                      Configure os tracos na aba <strong>Parametros Globais</strong> para incluir estes elementos.
                    </p>
                  </div>
                </div>
              )}

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Insumo</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Consumo Total</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Sacos 50 kg</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Detalhe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {consumption.map(c => {
                      const isExpanded = expandedMat.has(c.material_id);
                      const hasBags = c.bags_50kg > 0;
                      const types = c.contributing_types || [];
                      return (
                        <>
                          <tr key={c.material_id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Package className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                <span className="font-medium text-gray-900">{c.material_name}</span>
                                <span className="text-xs text-gray-400">{c.unit}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-semibold text-gray-900">
                                {c.total_consumption_kg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {hasBags ? (
                                <span className="font-medium text-blue-700">
                                  {c.bags_50kg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} sc
                                </span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {types.length > 1 ? (
                                <button
                                  onClick={() => toggleMat(c.material_id)}
                                  className="text-xs text-orange-600 hover:text-orange-800 font-medium"
                                >
                                  {isExpanded ? 'Ocultar' : `Ver ${types.length} fontes`}
                                </button>
                              ) : types.length === 1 ? (
                                <span className="text-xs text-gray-400">{types[0].element_label}</span>
                              ) : null}
                            </td>
                          </tr>
                          {isExpanded && types.map((t, i) => (
                            <tr key={`${c.material_id}-${i}`} className="bg-orange-50/50">
                              <td className="px-4 py-2 pl-10">
                                <span className="text-xs text-gray-600 italic">{t.element_label}</span>
                              </td>
                              <td className="px-4 py-2 text-right text-xs text-gray-600">
                                {t.consumption_kg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg
                              </td>
                              <td className="px-4 py-2 text-right text-xs text-gray-400">
                                {(t.consumption_kg / 50).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} sc
                              </td>
                              <td className="px-4 py-2 text-right text-xs text-gray-400">
                                {t.volume_m3.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} m³
                              </td>
                            </tr>
                          ))}
                        </>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td className="px-4 py-3 text-xs font-semibold text-gray-600">
                        Total ({consumption.length} insumo(s))
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-semibold text-gray-900">
                        {consumption.reduce((s, c) => s + c.total_consumption_kg, 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
