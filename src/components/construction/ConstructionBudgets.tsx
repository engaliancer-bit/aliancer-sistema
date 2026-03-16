import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Plus, Search, Edit2, Trash2, Eye, FileSpreadsheet,
  X, Save, AlertCircle, Home, Building, Factory, Wheat, Map,
  Clock, CheckCircle, TrendingUp, Copy, Loader2, SlidersHorizontal, Settings
} from 'lucide-react';
import { Budget, BudgetType, BUDGET_TYPE_CONFIG, STATUS_CONFIG, fmtBRL } from './types';
import BudgetDetail from './BudgetDetail';
import GlobalParamsPanel from './GlobalParamsPanel';
import BudgetCompositionsPanel from './BudgetCompositionsPanel';

type ModuleTab = 'orcamentos' | 'parametros' | 'composicoes';

const TYPE_ICONS: Record<BudgetType, React.ComponentType<any>> = {
  residencial: Home, comercial: Building, industrial: Factory,
  rural: Wheat, pavimentacao: Map,
};

export default function ConstructionBudgets() {
  const [moduleTab, setModuleTab] = useState<ModuleTab>('orcamentos');
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cloneSource, setCloneSource] = useState<Budget | null>(null);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneTitle, setCloneTitle] = useState('');
  const [cloneCustomerId, setCloneCustomerId] = useState('');
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);

  const [form, setForm] = useState({
    customer_id: '', title: '', description: '',
    type: 'residencial' as BudgetType,
    bdi_percent: 25, validity_days: 30, notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('budgets')
        .select('*, customers(id, name, phone)')
        .order('created_at', { ascending: false });
      setBudgets(data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCustomers = useCallback(async () => {
    const { data } = await supabase
      .from('customers').select('id, name, phone').order('name');
    setCustomers(data || []);
  }, []);

  useEffect(() => { load(); loadCustomers(); }, [load, loadCustomers]);

  const filtered = useMemo(() => budgets.filter(b => {
    if (filterType !== 'all' && b.type !== filterType) return false;
    if (filterStatus !== 'all' && b.status !== filterStatus) return false;
    const q = search.toLowerCase();
    return !q || b.title.toLowerCase().includes(q)
      || b.customers?.name?.toLowerCase().includes(q);
  }), [budgets, search, filterType, filterStatus]);

  const openForm = (budget?: Budget) => {
    setError(null);
    if (budget) {
      setEditingBudget(budget);
      setForm({
        customer_id: budget.customer_id || '',
        title: budget.title, description: budget.description || '',
        type: budget.type, bdi_percent: budget.bdi_percent,
        validity_days: budget.validity_days, notes: budget.notes || '',
      });
    } else {
      setEditingBudget(null);
      setForm({ customer_id: '', title: '', description: '', type: 'residencial', bdi_percent: 25, validity_days: 30, notes: '' });
    }
    setShowForm(true);
  };

  const save = async () => {
    if (!form.title.trim()) { setError('Titulo obrigatorio'); return; }
    setSaving(true); setError(null);
    try {
      const payload = {
        customer_id: form.customer_id || null,
        title: form.title.trim(),
        description: form.description.trim() || null,
        type: form.type,
        bdi_percent: form.bdi_percent,
        validity_days: form.validity_days,
        notes: form.notes.trim() || null,
      };
      if (editingBudget) {
        await supabase.from('budgets').update(payload).eq('id', editingBudget.id);
      } else {
        await supabase.from('budgets').insert([payload]);
      }
      await load(); setShowForm(false);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const del = async (b: Budget) => {
    if (!confirm(`Excluir "${b.title}"?`)) return;
    await supabase.from('budgets').delete().eq('id', b.id);
    await load();
  };

  const openCloneModal = (b: Budget) => {
    setCloneSource(b);
    setCloneTitle(`${b.title} (copia)`);
    setCloneCustomerId(b.customer_id || '');
    setCloneError(null);
    setShowCloneModal(true);
  };

  const cloneBudget = async () => {
    if (!cloneSource) return;
    if (!cloneTitle.trim()) { setCloneError('Titulo obrigatorio'); return; }
    setCloning(true); setCloneError(null);
    try {
      const { data: newBudget, error: budgetErr } = await supabase
        .from('budgets')
        .insert([{
          customer_id: cloneCustomerId || null,
          title: cloneTitle.trim(),
          description: cloneSource.description,
          type: cloneSource.type,
          status: 'rascunho',
          bdi_percent: cloneSource.bdi_percent,
          validity_days: cloneSource.validity_days,
          notes: cloneSource.notes,
        }])
        .select('id,customer_id,title,description,type,status,bdi_percent,validity_days,notes,created_at')
        .single();
      if (budgetErr) throw budgetErr;

      const [wbsRes, elemRes, gpRes, fpRes, caixRes] = await Promise.all([
        supabase.from('budget_wbs_steps').select('id,code,name,description,sort_order').eq('budget_id', cloneSource.id).limit(500).order('sort_order'),
        supabase.from('budget_elements').select('id,wbs_step_id,element_type,label,params,notes,room,sort_order').eq('budget_id', cloneSource.id).limit(5000),
        supabase.from('budget_global_params').select('id,param_key,param_label,param_category,material_id,recipe_id,unit_price,value_text,notes,sort_order').eq('budget_id', cloneSource.id).limit(500),
        supabase.from('budget_foundation_params').select('id,param_type,code,label,dimensions,notes,sort_order').eq('budget_id', cloneSource.id).limit(500).order('sort_order'),
        supabase.from('budget_caixaria_settings').select('board_length_m,board_width_rule,waste_percent,nail_kg_per_m2,wire_gravateamento_m_per_ml,nail_price_per_kg,board_price_per_unit,notes').eq('budget_id', cloneSource.id).maybeSingle(),
      ]);

      const wbsSteps = wbsRes.data || [];
      const elements = elemRes.data || [];
      const globalParams = gpRes.data || [];
      const foundationParams = fpRes.data || [];
      const caixariaSettings = caixRes.data;

      const wbsIdMap: Record<string, string> = {};
      if (wbsSteps.length > 0) {
        const newWbsSteps = wbsSteps.map(step => ({
          budget_id: newBudget.id,
          code: step.code,
          name: step.name,
          description: step.description,
          sort_order: step.sort_order,
        }));
        const { data: insWbs } = await supabase.from('budget_wbs_steps').insert(newWbsSteps).select('id');
        if (insWbs) {
          insWbs.forEach((newStep, idx) => {
            wbsIdMap[wbsSteps[idx].id] = newStep.id;
          });
        }
      }

      const elementIdMap: Record<string, string> = {};
      if (elements.length > 0) {
        const newElements = elements.map(el => ({
          budget_id: newBudget.id,
          wbs_step_id: el.wbs_step_id ? (wbsIdMap[el.wbs_step_id] || null) : null,
          element_type: el.element_type,
          label: el.label,
          params: el.params,
          notes: el.notes,
          room: el.room,
          source: 'manual',
          measurement_status: 'pendente',
        }));
        const { data: insEls } = await supabase.from('budget_elements').insert(newElements).select('id');
        if (insEls) {
          insEls.forEach((newEl, idx) => {
            elementIdMap[elements[idx].id] = newEl.id;
          });
        }
      }

      if (globalParams.length > 0) {
        const clonedParams = globalParams.map((p: any) => ({
          budget_id: newBudget.id,
          param_key: p.param_key,
          param_label: p.param_label,
          param_category: p.param_category,
          material_id: p.material_id,
          recipe_id: p.recipe_id,
          unit_price: p.unit_price,
          value_text: p.value_text,
          notes: p.notes,
          sort_order: p.sort_order,
        }));
        await supabase.from('budget_global_params').insert(clonedParams);
      }

      const foundationIdMap: Record<string, string> = {};
      if (foundationParams.length > 0) {
        const newFps = foundationParams.map(fp => ({
          budget_id: newBudget.id,
          param_type: fp.param_type,
          code: fp.code,
          label: fp.label,
          dimensions: fp.dimensions,
          notes: fp.notes,
          sort_order: fp.sort_order,
        }));
        const { data: insFps } = await supabase.from('budget_foundation_params').insert(newFps).select('id');
        if (insFps) {
          insFps.forEach((newFp, idx) => {
            foundationIdMap[foundationParams[idx].id] = newFp.id;
          });
        }
      }

      if (caixariaSettings) {
        await supabase.from('budget_caixaria_settings').insert([{
          budget_id: newBudget.id,
          board_length_m: caixariaSettings.board_length_m,
          board_width_rule: caixariaSettings.board_width_rule,
          waste_percent: caixariaSettings.waste_percent,
          nail_kg_per_m2: caixariaSettings.nail_kg_per_m2,
          wire_gravateamento_m_per_ml: caixariaSettings.wire_gravateamento_m_per_ml,
          nail_price_per_kg: caixariaSettings.nail_price_per_kg,
          board_price_per_unit: caixariaSettings.board_price_per_unit,
          notes: caixariaSettings.notes,
        }]);
      }

      setShowCloneModal(false);
      await load();
      const { data: fresh } = await supabase
        .from('budgets').select('*, customers(id, name, phone)').eq('id', newBudget.id).maybeSingle();
      if (fresh) setSelectedBudget(fresh);
    } catch (e: any) { setCloneError(e.message); }
    finally { setCloning(false); }
  };

  const stats = useMemo(() => ({
    total: budgets.length,
    aprovados: budgets.filter(b => b.status === 'aprovado').length,
    em_andamento: budgets.filter(b => b.status === 'em_andamento').length,
    valor_total: budgets.reduce((s, b) => s + b.grand_total, 0),
  }), [budgets]);

  if (selectedBudget) {
    return (
      <BudgetDetail
        budget={selectedBudget}
        onBack={() => { setSelectedBudget(null); load(); }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Module Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          {([
            { id: 'orcamentos', label: 'Orcamentos', icon: FileSpreadsheet },
            { id: 'parametros', label: 'Parametros', icon: SlidersHorizontal },
            { id: 'composicoes', label: 'Composicoes', icon: Settings },
          ] as { id: ModuleTab; label: string; icon: React.ComponentType<any> }[]).map(tab => (
            <button key={tab.id} onClick={() => setModuleTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                moduleTab === tab.id
                  ? 'border-orange-500 text-orange-600 bg-orange-50/40'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}>
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {moduleTab === 'parametros' && <GlobalParamsPanel />}
      {moduleTab === 'composicoes' && <BudgetCompositionsPanel />}

      {moduleTab === 'orcamentos' && <>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total de Orcamentos', value: stats.total, icon: FileSpreadsheet, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Em Andamento', value: stats.em_andamento, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Aprovados', value: stats.aprovados, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Valor Total', value: fmtBRL(stats.valor_total), icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 flex items-center gap-3`}>
            <s.icon className={`w-8 h-8 ${s.color} flex-shrink-0`} />
            <div>
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex flex-1 flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por titulo ou cliente..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent" />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400">
            <option value="all">Todos os Tipos</option>
            {Object.entries(BUDGET_TYPE_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400">
            <option value="all">Todos os Status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <button onClick={() => openForm()}
          className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all shadow-md text-sm font-medium">
          <Plus className="w-4 h-4" /> Novo Orcamento
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <FileSpreadsheet className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-1">Nenhum orcamento encontrado</h3>
          <p className="text-gray-400 text-sm mb-5">Crie o primeiro orcamento para comecar</p>
          <button onClick={() => openForm()}
            className="inline-flex items-center gap-2 px-5 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm">
            <Plus className="w-4 h-4" /> Criar Orcamento
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(budget => {
            const tc = BUDGET_TYPE_CONFIG[budget.type];
            const sc = STATUS_CONFIG[budget.status];
            const Icon = TYPE_ICONS[budget.type];
            const progress = budget.grand_total > 0
              ? Math.min(100, (budget.total_materials / budget.grand_total) * 100) : 0;

            return (
              <div key={budget.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden group">
                <div className={`h-1.5 bg-gradient-to-r ${tc.color}`} />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${tc.color} flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 text-sm leading-tight truncate">{budget.title}</h3>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {budget.customers?.name || 'Sem cliente'} · {tc.label}
                        </p>
                      </div>
                    </div>
                    <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${sc.color}`}>
                      {sc.label}
                    </span>
                  </div>

                  <div className="flex items-end justify-between mb-4">
                    <div>
                      <p className="text-xs text-gray-400">Valor Total</p>
                      <p className="text-xl font-bold text-gray-900">{fmtBRL(budget.grand_total)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">BDI</p>
                      <p className="text-sm font-semibold text-orange-600">{budget.bdi_percent}%</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                    <button onClick={() => setSelectedBudget(budget)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors text-xs font-medium">
                      <Eye className="w-3.5 h-3.5" /> Abrir
                    </button>
                    <button onClick={() => openCloneModal(budget)} title="Clonar orcamento"
                      className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                      <Copy className="w-4 h-4" />
                    </button>
                    <button onClick={() => openForm(budget)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => del(budget)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      </>}

      {/* Clone Modal */}
      {showCloneModal && cloneSource && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Clonar Orcamento</h2>
                <p className="text-xs text-gray-500 mt-0.5">Origem: {cloneSource.title}</p>
              </div>
              <button onClick={() => setShowCloneModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {cloneError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {cloneError}
                </div>
              )}

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 space-y-0.5">
                <p className="font-semibold">O que sera copiado:</p>
                <p>Etapas da obra (WBS), todos os elementos parametricos, parametros globais, modelos de fundacao e configuracoes de caixaria</p>
                <p className="text-emerald-600">O novo orcamento tera status "Rascunho"</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titulo do novo orcamento *</label>
                <input value={cloneTitle} onChange={e => setCloneTitle(e.target.value)}
                  placeholder="Nome do orcamento clonado"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-400 focus:border-transparent" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente (opcional)</label>
                <select value={cloneCustomerId} onChange={e => setCloneCustomerId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-400">
                  <option value="">Sem cliente</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={() => setShowCloneModal(false)}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100">
                Cancelar
              </button>
              <button onClick={cloneBudget} disabled={cloning}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg text-sm font-medium hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50">
                {cloning
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Copy className="w-4 h-4" />}
                {cloning ? 'Clonando...' : 'Clonar Orcamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-lg font-bold text-gray-900">
                {editingBudget ? 'Editar Orcamento' : 'Novo Orcamento de Obra'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4" /> {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Obra *</label>
                <div className="grid grid-cols-5 gap-2">
                  {(Object.entries(BUDGET_TYPE_CONFIG) as [BudgetType, typeof BUDGET_TYPE_CONFIG[BudgetType]][]).map(([k, v]) => {
                    const Icon = TYPE_ICONS[k];
                    const active = form.type === k;
                    return (
                      <button key={k} type="button"
                        onClick={() => setForm(p => ({ ...p, type: k }))}
                        className={`p-2.5 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${
                          active ? `border-orange-500 bg-orange-50` : 'border-gray-200 hover:border-gray-300'}`}>
                        <Icon className={`w-5 h-5 ${active ? 'text-orange-600' : 'text-gray-400'}`} />
                        <span className={`text-[10px] font-medium leading-tight text-center ${active ? 'text-orange-700' : 'text-gray-500'}`}>
                          {v.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titulo *</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Ex: Casa Residencial Joao Silva"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                <select value={form.customer_id} onChange={e => setForm(p => ({ ...p, customer_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400">
                  <option value="">Selecione (opcional)</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descricao</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  rows={2} placeholder="Descricao do projeto..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">BDI (%)</label>
                  <input type="number" value={form.bdi_percent} step="0.5" min="0" max="100"
                    onChange={e => setForm(p => ({ ...p, bdi_percent: +e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400" />
                  <p className="text-xs text-gray-400 mt-0.5">Beneficios e Despesas Indiretas</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Validade (dias)</label>
                  <input type="number" value={form.validity_days} min="1"
                    onChange={e => setForm(p => ({ ...p, validity_days: +e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observacoes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 resize-none" />
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100">
                Cancelar
              </button>
              <button onClick={save} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg text-sm font-medium hover:from-orange-600 hover:to-orange-700 disabled:opacity-50">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Save className="w-4 h-4" />}
                {editingBudget ? 'Salvar' : 'Criar Orcamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
