import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  ChevronDown, ChevronRight, Package, Layers, RefreshCw,
  AlertCircle, BoxSelect, Wrench, HardHat, Info, ListChecks
} from 'lucide-react';
import { Budget, WBSStep, fmtBRL } from './types';

interface Props {
  budget: Budget;
}

interface CompositionSubItem {
  name: string;
  unit: string;
  totalQty: number;
  unitPrice: number;
  totalPrice: number;
  itemType: 'material' | 'produto' | 'mao_de_obra' | 'equipamento' | string;
}

interface StageQuantitativo {
  wbsStep: WBSStep;
  items: CompositionSubItem[];
  totalMaterials: number;
  totalLabor: number;
  grandTotal: number;
  compositionCount: number;
  directItemCount: number;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ComponentType<any> }> = {
  material:    { label: 'Insumo',      color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200',    icon: Package },
  produto:     { label: 'Produto',     color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: BoxSelect },
  mao_de_obra: { label: 'Mao de Obra', color: 'text-rose-700',    bg: 'bg-rose-50',    border: 'border-rose-200',    icon: HardHat },
  equipamento: { label: 'Equipamento', color: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200',  icon: Wrench },
  product:     { label: 'Produto',     color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: BoxSelect },
  service:     { label: 'Servico',     color: 'text-slate-700',   bg: 'bg-slate-50',   border: 'border-slate-200',   icon: Wrench },
  labor:       { label: 'Mao de Obra', color: 'text-rose-700',    bg: 'bg-rose-50',    border: 'border-rose-200',    icon: HardHat },
  equipment:   { label: 'Equipamento', color: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200',  icon: Wrench },
};

function getTypeConf(type: string) {
  return TYPE_CONFIG[type] ?? TYPE_CONFIG['material'];
}

export default function BudgetStagesPanel({ budget }: Props) {
  const [stages, setStages] = useState<StageQuantitativo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [expandAll, setExpandAll] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: wbsData }, { data: budgetItemsData }] = await Promise.all([
        supabase.from('budget_wbs_steps').select('*').eq('budget_id', budget.id).order('sort_order'),
        supabase.from('budget_items').select('*').eq('budget_id', budget.id),
      ]);

      if (!wbsData || wbsData.length === 0) {
        setStages([]);
        return;
      }

      const items = budgetItemsData || [];
      const compositionIds = items
        .filter(i => i.item_type === 'composicao' && i.composition_id)
        .map(i => i.composition_id as string);
      const industryCompIds = items
        .filter(i => i.item_type === 'composicao_industria' && i.composition_id)
        .map(i => i.composition_id as string);

      const [budgetCompItemsRes, industryCompItemsRes] = await Promise.all([
        compositionIds.length > 0
          ? supabase
              .from('budget_composition_items')
              .select('*, materials(id,name,unit,resale_price,unit_cost), products(id,name,unit,sale_price,final_sale_price)')
              .in('composition_id', compositionIds)
          : Promise.resolve({ data: [] }),
        industryCompIds.length > 0
          ? supabase
              .from('composition_items')
              .select('*, materials(id,name,unit,resale_price,unit_cost), products(id,name,unit,sale_price,final_sale_price)')
              .in('composition_id', industryCompIds)
          : Promise.resolve({ data: [] }),
      ]);

      const budgetCompItems: Record<string, any[]> = {};
      for (const ci of budgetCompItemsRes.data || []) {
        if (!budgetCompItems[ci.composition_id]) budgetCompItems[ci.composition_id] = [];
        budgetCompItems[ci.composition_id].push(ci);
      }

      const industryCompItems: Record<string, any[]> = {};
      for (const ci of industryCompItemsRes.data || []) {
        if (!industryCompItems[ci.composition_id]) industryCompItems[ci.composition_id] = [];
        industryCompItems[ci.composition_id].push(ci);
      }

      const result: StageQuantitativo[] = wbsData.map((wbs: WBSStep) => {
        const stageItems = items.filter(i => i.wbs_step_id === wbs.id);
        const aggregated: Record<string, CompositionSubItem> = {};
        let compositionCount = 0;
        let directItemCount = 0;

        for (const bi of stageItems) {
          const qty = bi.quantity || 1;

          if (bi.item_type === 'composicao' && bi.composition_id) {
            compositionCount++;
            const subItems = budgetCompItems[bi.composition_id] || [];
            for (const si of subItems) {
              const name = si.description
                || si.materials?.name
                || si.products?.name
                || 'Item sem nome';
              const unit = si.unit || 'un';
              const coeff = si.coefficient || 0;
              const unitPrice = si.unit_price || 0;
              const totalQty = coeff * qty;
              const totalPrice = totalQty * unitPrice;
              const type = si.item_type || 'material';
              const key = `${type}::${name}::${unit}`;

              if (aggregated[key]) {
                aggregated[key].totalQty += totalQty;
                aggregated[key].totalPrice += totalPrice;
              } else {
                aggregated[key] = { name, unit, totalQty, unitPrice, totalPrice, itemType: type };
              }
            }
          } else if (bi.item_type === 'composicao_industria' && bi.composition_id) {
            compositionCount++;
            const subItems = industryCompItems[bi.composition_id] || [];
            for (const si of subItems) {
              const name = si.item_name
                || si.materials?.name
                || si.products?.name
                || 'Item sem nome';
              const unit = si.unit || 'un';
              const coeff = si.quantity || 0;
              const unitPrice = si.unit_cost || 0;
              const totalQty = coeff * qty;
              const totalPrice = totalQty * unitPrice;
              const type = si.item_type || 'material';
              const key = `${type}::${name}::${unit}`;

              if (aggregated[key]) {
                aggregated[key].totalQty += totalQty;
                aggregated[key].totalPrice += totalPrice;
              } else {
                aggregated[key] = { name, unit, totalQty, unitPrice, totalPrice, itemType: type };
              }
            }
          } else if (bi.item_type === 'material' || bi.item_type === 'produto') {
            directItemCount++;
            const name = bi.description || 'Item sem nome';
            const unit = bi.unit || 'un';
            const unitPrice = bi.unit_price || 0;
            const totalQty = qty;
            const totalPrice = bi.total_price ?? totalQty * unitPrice;
            const type = bi.item_type === 'produto' ? 'produto' : 'material';
            const key = `${type}::${name}::${unit}`;

            if (aggregated[key]) {
              aggregated[key].totalQty += totalQty;
              aggregated[key].totalPrice += totalPrice;
            } else {
              aggregated[key] = { name, unit, totalQty, unitPrice, totalPrice, itemType: type };
            }
          }
        }

        const subItemsList = Object.values(aggregated).sort((a, b) => {
          const order = ['material', 'produto', 'product', 'mao_de_obra', 'labor', 'equipamento', 'equipment', 'service'];
          return order.indexOf(a.itemType) - order.indexOf(b.itemType);
        });

        const totalMaterials = subItemsList
          .filter(i => i.itemType === 'material')
          .reduce((s, i) => s + i.totalPrice, 0);
        const totalLabor = subItemsList
          .filter(i => i.itemType === 'mao_de_obra' || i.itemType === 'labor')
          .reduce((s, i) => s + i.totalPrice, 0);
        const grandTotal = subItemsList.reduce((s, i) => s + i.totalPrice, 0);

        return { wbsStep: wbs, items: subItemsList, totalMaterials, totalLabor, grandTotal, compositionCount, directItemCount };
      });

      setStages(result);
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar quantitativos');
    } finally {
      setLoading(false);
    }
  }, [budget.id]);

  useEffect(() => { load(); }, [load]);

  const toggleStage = (id: string) => {
    setExpandedStages(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleExpandAll = () => {
    if (expandAll) {
      setExpandedStages(new Set());
    } else {
      setExpandedStages(new Set(stages.map(s => s.wbsStep.id)));
    }
    setExpandAll(p => !p);
  };

  const grandTotal = stages.reduce((s, st) => s + st.grandTotal, 0);
  const totalMaterials = stages.reduce((s, st) => s + st.totalMaterials, 0);
  const totalLabor = stages.reduce((s, st) => s + st.totalLabor, 0);
  const totalItems = stages.reduce((s, st) => s + st.items.length, 0);

  const allTypes = Array.from(new Set(stages.flatMap(s => s.items.map(i => i.itemType))));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Calculando quantitativos de insumos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-orange-500" />
            Quantitativos de Insumos por Etapa
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Composicoes expandidas automaticamente a partir do Levantamento de Itens. Quantidades consolidadas por etapa.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExpandAll}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {expandAll ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            {expandAll ? 'Recolher Tudo' : 'Expandir Tudo'}
          </button>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {stages.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <Layers className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhuma etapa encontrada</p>
          <p className="text-gray-400 text-sm mt-1 max-w-sm mx-auto">
            Crie etapas (WBS) no Levantamento de Itens e adicione composicoes para visualizar os quantitativos aqui.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400">Etapas</p>
              <p className="text-xl font-bold text-gray-800">{stages.length}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400">Tipos de Insumos</p>
              <p className="text-xl font-bold text-gray-800">{totalItems}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-600">Total Materiais</p>
              <p className="text-sm font-bold text-blue-800">{fmtBRL(totalMaterials)}</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
              <p className="text-xs text-orange-600">Total Geral</p>
              <p className="text-sm font-bold text-orange-800">{fmtBRL(grandTotal)}</p>
            </div>
          </div>

          {allTypes.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setFilterType('all')}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${filterType === 'all' ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}
              >
                Todos
              </button>
              {allTypes.map(type => {
                const conf = getTypeConf(type);
                return (
                  <button
                    key={type}
                    onClick={() => setFilterType(filterType === type ? 'all' : type)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${filterType === type ? `${conf.bg} ${conf.color} border-current` : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}
                  >
                    {conf.label}
                  </button>
                );
              })}
            </div>
          )}

          <div className="space-y-3">
            {stages.map((stage, idx) => {
              const isExpanded = expandedStages.has(stage.wbsStep.id);
              const filteredItems = filterType === 'all'
                ? stage.items
                : stage.items.filter(i => i.itemType === filterType);
              const hasItems = stage.items.length > 0;

              return (
                <div key={stage.wbsStep.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div
                    className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors ${hasItems ? 'bg-gray-50 hover:bg-gray-100' : 'bg-gray-50/50'}`}
                    onClick={() => hasItems && toggleStage(stage.wbsStep.id)}
                  >
                    <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {idx + 1}
                    </div>
                    {hasItems
                      ? (isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />)
                      : <div className="w-4 flex-shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{stage.wbsStep.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {stage.compositionCount > 0 && `${stage.compositionCount} composicao${stage.compositionCount !== 1 ? 'oes' : ''}`}
                        {stage.compositionCount > 0 && stage.directItemCount > 0 && ' · '}
                        {stage.directItemCount > 0 && `${stage.directItemCount} item${stage.directItemCount !== 1 ? 's' : ''} direto${stage.directItemCount !== 1 ? 's' : ''}`}
                        {!hasItems && ' · Sem composicoes adicionadas'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {hasItems && (
                        <>
                          <span className="text-xs text-gray-500 hidden sm:inline">
                            {stage.items.length} tipo{stage.items.length !== 1 ? 's' : ''} de insumo
                          </span>
                          {stage.totalMaterials > 0 && (
                            <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full hidden sm:inline">
                              Mat: {fmtBRL(stage.totalMaterials)}
                            </span>
                          )}
                          <span className="text-sm font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                            {fmtBRL(stage.grandTotal)}
                          </span>
                        </>
                      )}
                      {!hasItems && (
                        <span className="text-xs text-gray-400 italic">Sem itens</span>
                      )}
                    </div>
                  </div>

                  {isExpanded && hasItems && (
                    <div className="border-t border-gray-100">
                      {filteredItems.length === 0 ? (
                        <div className="px-4 py-6 text-center text-xs text-gray-400">
                          Nenhum item do tipo selecionado nesta etapa.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Descricao</th>
                                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Quantidade</th>
                                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Preco Unit.</th>
                                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {filteredItems.map((item, iIdx) => {
                                const conf = getTypeConf(item.itemType);
                                const Icon = conf.icon;
                                return (
                                  <tr key={iIdx} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-2.5">
                                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${conf.bg} ${conf.color}`}>
                                        <Icon className="w-2.5 h-2.5" />
                                        {conf.label}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <span className="text-gray-800 font-medium">{item.name}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-right">
                                      <span className="font-semibold text-gray-700">
                                        {item.totalQty.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}
                                      </span>
                                      <span className="text-xs text-gray-400 ml-1">{item.unit}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-gray-500 text-xs hidden sm:table-cell">
                                      {item.unitPrice > 0 ? fmtBRL(item.unitPrice) : '-'}
                                    </td>
                                    <td className="px-4 py-2.5 text-right">
                                      {item.totalPrice > 0
                                        ? <span className="font-semibold text-gray-800">{fmtBRL(item.totalPrice)}</span>
                                        : <span className="text-gray-400 text-xs">-</span>
                                      }
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex flex-wrap justify-between items-center gap-2">
                        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                          {stage.totalMaterials > 0 && (
                            <span>Insumos: <strong className="text-blue-700">{fmtBRL(stage.totalMaterials)}</strong></span>
                          )}
                          {stage.totalLabor > 0 && (
                            <span>Mao de Obra: <strong className="text-rose-700">{fmtBRL(stage.totalLabor)}</strong></span>
                          )}
                        </div>
                        <div className="text-xs font-bold text-gray-700">
                          Subtotal: <span className="text-emerald-700">{fmtBRL(stage.grandTotal)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {grandTotal > 0 && (
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-4">
              <div className="flex flex-wrap justify-between items-center gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Resumo Geral</p>
                  <div className="flex flex-wrap gap-4 text-sm">
                    {totalMaterials > 0 && (
                      <div>
                        <span className="text-gray-400 text-xs">Insumos/Materiais</span>
                        <p className="font-semibold text-blue-700">{fmtBRL(totalMaterials)}</p>
                      </div>
                    )}
                    {totalLabor > 0 && (
                      <div>
                        <span className="text-gray-400 text-xs">Mao de Obra</span>
                        <p className="font-semibold text-rose-700">{fmtBRL(totalLabor)}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">{stages.length} etapa{stages.length !== 1 ? 's' : ''} · {totalItems} tipos de insumo</p>
                  <p className="text-2xl font-bold text-orange-600">{fmtBRL(grandTotal)}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              Os quantitativos sao calculados automaticamente a partir das composicoes adicionadas no Levantamento de Itens.
              Cada composicao tem seus insumos expandidos e multiplicados pela quantidade do item no orcamento.
              Itens iguais na mesma etapa sao consolidados.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
