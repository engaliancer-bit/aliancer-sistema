import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  ArrowLeft, Layers, Package, BarChart2, Settings, Edit2, Save, X,
  Brain, TrendingUp, SlidersHorizontal, CheckCircle2, Circle
} from 'lucide-react';
import { Budget, WBSStep, BUDGET_TYPE_CONFIG, STATUS_CONFIG, fmtBRL } from './types';
import BudgetElementsPanel from './BudgetElementsPanel';
import BudgetItemsPanel from './BudgetItemsPanel';
import BudgetReportPanel from './BudgetReportPanel';
import BudgetCompositionsPanel from './BudgetCompositionsPanel';
import QuantitativeSummaryPanel from './QuantitativeSummaryPanel';
import FloorPlanIAPanel from './FloorPlanIAPanel';
import BudgetGlobalParamsPanel from './BudgetGlobalParamsPanel';

type Tab = 'parametros' | 'elements' | 'compositions' | 'items' | 'quantitativos' | 'ia' | 'report';

interface Props {
  budget: Budget;
  onBack: () => void;
}

export default function BudgetDetail({ budget: initialBudget, onBack }: Props) {
  const [budget, setBudget] = useState(initialBudget);
  const [wbsSteps, setWbsSteps] = useState<WBSStep[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('parametros');
  const [editingStatus, setEditingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState(budget.status);
  const [paramCount, setParamCount] = useState(0);
  const [elementCount, setElementCount] = useState(0);
  const [itemCount, setItemCount] = useState(0);

  const loadWbs = useCallback(async () => {
    const { data } = await supabase
      .from('budget_wbs_steps').select('*')
      .eq('budget_id', budget.id).order('sort_order');
    setWbsSteps(data || []);
  }, [budget.id]);

  const loadCounts = useCallback(async () => {
    const [paramsRes, elementsRes, itemsRes] = await Promise.all([
      supabase.from('budget_global_params').select('id', { count: 'exact', head: true }).eq('budget_id', budget.id),
      supabase.from('budget_elements').select('id', { count: 'exact', head: true }).eq('budget_id', budget.id),
      supabase.from('budget_items').select('id', { count: 'exact', head: true }).eq('budget_id', budget.id),
    ]);
    setParamCount(paramsRes.count || 0);
    setElementCount(elementsRes.count || 0);
    setItemCount(itemsRes.count || 0);
  }, [budget.id]);

  const refreshBudget = useCallback(async () => {
    const { data } = await supabase
      .from('budgets').select('*, customers(id,name,phone)')
      .eq('id', budget.id).maybeSingle();
    if (data) setBudget(data);
    await loadWbs();
    await loadCounts();
  }, [budget.id, loadWbs, loadCounts]);

  useEffect(() => { loadWbs(); loadCounts(); }, [loadWbs, loadCounts]);

  const updateStatus = async () => {
    await supabase.from('budgets').update({ status: newStatus }).eq('id', budget.id);
    setBudget(p => ({ ...p, status: newStatus }));
    setEditingStatus(false);
  };

  const tc = BUDGET_TYPE_CONFIG[budget.type];
  const sc = STATUS_CONFIG[budget.status];

  const step1Done = paramCount >= 1;
  const step2Done = elementCount >= 1;
  const step3Done = itemCount >= 1;

  const tabs: { id: Tab; label: string; icon: React.ComponentType<any>; highlight?: boolean; step?: number }[] = [
    { id: 'parametros', label: 'Parametros', icon: SlidersHorizontal, step: 1 },
    { id: 'elements', label: 'Etapas', icon: Layers, step: 2 },
    { id: 'compositions', label: 'Composicoes', icon: Settings },
    { id: 'items', label: 'Itens', icon: Package, step: 3 },
    { id: 'quantitativos', label: 'Quantitativos', icon: TrendingUp },
    { id: 'ia', label: 'Analise IA', icon: Brain, highlight: true },
    { id: 'report', label: 'Relatorio', icon: BarChart2 },
  ];

  const stepDone = (step?: number) => {
    if (step === 1) return step1Done;
    if (step === 2) return step2Done;
    if (step === 3) return step3Done;
    return false;
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex flex-wrap items-start gap-4">
          <button onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900 truncate">{budget.title}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {budget.customers?.name || 'Sem cliente'} &middot; {tc.label}
              {budget.description && ` · ${budget.description}`}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {editingStatus ? (
              <div className="flex items-center gap-2">
                <select value={newStatus} onChange={e => setNewStatus(e.target.value as any)}
                  className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-orange-400">
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <button onClick={updateStatus} className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600">
                  <Save className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setEditingStatus(false)} className="p-1.5 border border-gray-300 rounded-lg hover:bg-gray-50">
                  <X className="w-3.5 h-3.5 text-gray-500" />
                </button>
              </div>
            ) : (
              <button onClick={() => setEditingStatus(true)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium cursor-pointer hover:opacity-80 ${sc.color}`}>
                {sc.label} <Edit2 className="w-3 h-3" />
              </button>
            )}
            <span className="text-lg font-bold text-gray-900">{fmtBRL(budget.grand_total)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-gray-100">
          <div className="text-center">
            <p className="text-xs text-gray-400">Materiais/Produtos</p>
            <p className="font-semibold text-gray-700">{fmtBRL(budget.total_materials)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">Mao de Obra</p>
            <p className="font-semibold text-gray-700">{fmtBRL(budget.total_labor)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">BDI ({budget.bdi_percent}%)</p>
            <p className="font-semibold text-amber-600">{fmtBRL(budget.total_bdi)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">Total Geral</p>
            <p className="font-bold text-orange-600">{fmtBRL(budget.grand_total)}</p>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">Progresso do Orcamento</p>
          <div className="flex items-center gap-0">
            {[
              { num: 1, label: 'Parametros', sublabel: `${paramCount} definidos`, done: step1Done, tab: 'parametros' as Tab },
              { num: 2, label: 'Levantamento', sublabel: `${elementCount} elementos`, done: step2Done, tab: 'elements' as Tab },
              { num: 3, label: 'Custos', sublabel: `${itemCount} itens`, done: step3Done, tab: 'items' as Tab },
            ].map((s, i) => (
              <div key={s.num} className="flex items-center flex-1">
                <button
                  onClick={() => setActiveTab(s.tab)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors w-full ${
                    activeTab === s.tab ? 'bg-orange-50 border border-orange-200' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                    s.done
                      ? 'bg-emerald-500 text-white'
                      : activeTab === s.tab
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                  }`}>
                    {s.done ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                  </div>
                  <div className="text-left min-w-0">
                    <p className={`text-xs font-semibold leading-tight ${s.done ? 'text-emerald-700' : activeTab === s.tab ? 'text-orange-700' : 'text-gray-600'}`}>
                      {s.label}
                    </p>
                    <p className={`text-[10px] leading-tight ${s.done ? 'text-emerald-500' : 'text-gray-400'}`}>{s.sublabel}</p>
                  </div>
                </button>
                {i < 2 && (
                  <div className={`h-0.5 w-4 flex-shrink-0 mx-1 rounded ${s.done ? 'bg-emerald-300' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors relative ${
                activeTab === tab.id
                  ? 'border-orange-500 text-orange-600 bg-orange-50/40'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}>
              <tab.icon className={`w-4 h-4 ${tab.highlight ? 'text-blue-500' : ''}`} />
              {tab.label}
              {tab.step && stepDone(tab.step) && activeTab !== tab.id && (
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              )}
              {tab.highlight && activeTab !== tab.id && (
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
              )}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'parametros' && (
            <BudgetGlobalParamsPanel
              budget={budget}
              onComplete={() => setActiveTab('elements')}
            />
          )}
          {activeTab === 'elements' && (
            <BudgetElementsPanel budget={budget} wbsSteps={wbsSteps} onRefresh={refreshBudget} />
          )}
          {activeTab === 'compositions' && (
            <BudgetCompositionsPanel />
          )}
          {activeTab === 'items' && (
            <BudgetItemsPanel budget={budget} wbsSteps={wbsSteps} onRefresh={refreshBudget} />
          )}
          {activeTab === 'quantitativos' && (
            <QuantitativeSummaryPanel budget={budget} wbsSteps={wbsSteps} />
          )}
          {activeTab === 'ia' && (
            <FloorPlanIAPanel budget={budget} wbsSteps={wbsSteps} onRefresh={refreshBudget} />
          )}
          {activeTab === 'report' && (
            <BudgetReportPanel budget={budget} wbsSteps={wbsSteps} />
          )}
        </div>
      </div>
    </div>
  );
}
