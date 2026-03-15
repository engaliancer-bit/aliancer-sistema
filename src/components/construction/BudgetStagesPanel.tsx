import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Plus, Trash2, Save, X, ChevronDown, ChevronRight, Search,
  Package, Wrench, HardHat, Layers, GripVertical, AlertCircle,
  Edit2, CheckCircle2, Circle, BoxSelect, DollarSign
} from 'lucide-react';
import { Budget, fmtBRL } from './types';

interface BudgetStage {
  id: string;
  budget_id: string;
  name: string;
  description: string;
  stage_order: number;
  estimated_days: number | null;
  notes: string;
  created_at: string;
  items?: BudgetStageItem[];
}

interface BudgetStageItem {
  id: string;
  budget_stage_id: string;
  item_type: 'material' | 'product' | 'equipment' | 'composition' | 'mao_de_obra';
  item_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  product_id: string | null;
  material_id: string | null;
  composition_id: string | null;
  notes: string;
}

interface CatalogItem {
  id: string;
  name: string;
  unit: string;
  price: number;
  type: 'product' | 'material' | 'composition';
}

interface Props {
  budget: Budget;
}

const ITEM_TYPE_CONFIG = {
  material: { label: 'Insumo', icon: Package, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  product: { label: 'Produto', icon: BoxSelect, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  composition: { label: 'Composicao', icon: Layers, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  equipment: { label: 'Equipamento', icon: Wrench, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  mao_de_obra: { label: 'Mao de Obra', icon: HardHat, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
};

export default function BudgetStagesPanel({ budget }: Props) {
  const [stages, setStages] = useState<BudgetStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [showStageForm, setShowStageForm] = useState(false);
  const [editingStage, setEditingStage] = useState<BudgetStage | null>(null);
  const [savingStage, setSavingStage] = useState(false);
  const [stageForm, setStageForm] = useState({ name: '', description: '', estimated_days: '', notes: '' });

  const [showItemForm, setShowItemForm] = useState<string | null>(null);
  const [itemSearch, setItemSearch] = useState('');
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [itemForm, setItemForm] = useState({ quantity: '1', unit: '', unit_price: '0', notes: '' });
  const [manualMode, setManualMode] = useState(false);
  const [manualForm, setManualForm] = useState({ item_type: 'material' as BudgetStageItem['item_type'], item_name: '', quantity: '1', unit: 'un', unit_price: '0', notes: '' });
  const [savingItem, setSavingItem] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: stagesData } = await supabase
        .from('budget_stages')
        .select('*')
        .eq('budget_id', budget.id)
        .order('stage_order');

      if (!stagesData) { setStages([]); return; }

      const stageIds = stagesData.map(s => s.id);
      const { data: itemsData } = stageIds.length > 0
        ? await supabase.from('budget_stage_items').select('*').in('budget_stage_id', stageIds)
        : { data: [] };

      const stagesWithItems = stagesData.map(s => ({
        ...s,
        items: (itemsData || []).filter(i => i.budget_stage_id === s.id),
      }));

      setStages(stagesWithItems);
    } finally {
      setLoading(false);
    }
  }, [budget.id]);

  useEffect(() => { load(); }, [load]);

  const searchCatalog = useCallback(async (query: string) => {
    if (query.length < 2) { setCatalogItems([]); return; }
    setLoadingCatalog(true);
    try {
      const q = query.toLowerCase();
      const [materialsRes, productsRes, compositionsRes] = await Promise.all([
        supabase.from('materials').select('id, name, unit, resale_price, unit_cost').ilike('name', `%${q}%`).limit(10),
        supabase.from('products').select('id, name, unit, final_sale_price, sale_price').ilike('name', `%${q}%`).limit(10),
        supabase.from('compositions').select('id, name, unit').ilike('name', `%${q}%`).limit(10),
      ]);

      const items: CatalogItem[] = [
        ...(materialsRes.data || []).map(m => ({
          id: m.id, name: m.name, unit: m.unit,
          price: m.resale_price ?? m.unit_cost ?? 0,
          type: 'material' as const,
        })),
        ...(productsRes.data || []).map(p => ({
          id: p.id, name: p.name, unit: p.unit,
          price: p.final_sale_price ?? p.sale_price ?? 0,
          type: 'product' as const,
        })),
        ...(compositionsRes.data || []).map(c => ({
          id: c.id, name: c.name, unit: c.unit,
          price: 0,
          type: 'composition' as const,
        })),
      ];
      setCatalogItems(items);
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchCatalog(itemSearch), 300);
    return () => clearTimeout(t);
  }, [itemSearch, searchCatalog]);

  const openStageForm = (stage?: BudgetStage) => {
    if (stage) {
      setEditingStage(stage);
      setStageForm({ name: stage.name, description: stage.description, estimated_days: stage.estimated_days?.toString() ?? '', notes: stage.notes });
    } else {
      setEditingStage(null);
      setStageForm({ name: '', description: '', estimated_days: '', notes: '' });
    }
    setShowStageForm(true);
  };

  const saveStage = async () => {
    if (!stageForm.name.trim()) { setError('Informe o nome da etapa'); return; }
    setError(null);
    setSavingStage(true);
    try {
      const payload = {
        budget_id: budget.id,
        name: stageForm.name.trim(),
        description: stageForm.description,
        estimated_days: stageForm.estimated_days ? parseInt(stageForm.estimated_days) : null,
        notes: stageForm.notes,
        stage_order: editingStage ? editingStage.stage_order : stages.length,
      };

      if (editingStage) {
        await supabase.from('budget_stages').update(payload).eq('id', editingStage.id);
      } else {
        await supabase.from('budget_stages').insert(payload);
      }
      setShowStageForm(false);
      await load();
    } finally {
      setSavingStage(false);
    }
  };

  const deleteStage = async (stageId: string) => {
    if (!confirm('Excluir esta etapa e todos os seus itens?')) return;
    await supabase.from('budget_stages').delete().eq('id', stageId);
    await load();
  };

  const openItemForm = (stageId: string) => {
    setShowItemForm(stageId);
    setItemSearch('');
    setCatalogItems([]);
    setSelectedItem(null);
    setItemForm({ quantity: '1', unit: '', unit_price: '0', notes: '' });
    setManualMode(false);
    setManualForm({ item_type: 'material', item_name: '', quantity: '1', unit: 'un', unit_price: '0', notes: '' });
    setExpandedStages(prev => new Set([...prev, stageId]));
  };

  const selectCatalogItem = (item: CatalogItem) => {
    setSelectedItem(item);
    setItemForm(f => ({ ...f, unit: item.unit, unit_price: item.price.toString() }));
    setCatalogItems([]);
    setItemSearch(item.name);
  };

  const saveItem = async (stageId: string) => {
    setSavingItem(true);
    setError(null);
    try {
      if (manualMode) {
        if (!manualForm.item_name.trim()) { setError('Informe o nome do item'); return; }
        await supabase.from('budget_stage_items').insert({
          budget_stage_id: stageId,
          item_type: manualForm.item_type,
          item_name: manualForm.item_name.trim(),
          quantity: parseFloat(manualForm.quantity) || 1,
          unit: manualForm.unit,
          unit_price: parseFloat(manualForm.unit_price) || 0,
          notes: manualForm.notes,
        });
      } else {
        if (!selectedItem) { setError('Selecione um item do catalogo ou use modo manual'); return; }
        await supabase.from('budget_stage_items').insert({
          budget_stage_id: stageId,
          item_type: selectedItem.type,
          item_name: selectedItem.name,
          quantity: parseFloat(itemForm.quantity) || 1,
          unit: itemForm.unit || selectedItem.unit,
          unit_price: parseFloat(itemForm.unit_price) || 0,
          [`${selectedItem.type}_id`]: selectedItem.id,
          notes: itemForm.notes,
        });
      }
      setShowItemForm(null);
      await load();
    } finally {
      setSavingItem(false);
    }
  };

  const deleteItem = async (itemId: string) => {
    await supabase.from('budget_stage_items').delete().eq('id', itemId);
    await load();
  };

  const toggleStage = (id: string) => {
    setExpandedStages(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const stageTotalCost = (stage: BudgetStage) =>
    (stage.items || []).reduce((sum, i) => sum + (i.total_price ?? i.quantity * i.unit_price), 0);

  const grandTotal = stages.reduce((sum, s) => sum + stageTotalCost(s), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-800">Etapas da Obra com Insumos</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Organize as fases da obra e vincule materiais, produtos e composicoes do catalogo da Industria.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {grandTotal > 0 && (
            <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded-full">
              Total etapas: {fmtBRL(grandTotal)}
            </span>
          )}
          <button onClick={() => openStageForm()}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors">
            <Plus className="w-4 h-4" /> Nova Etapa
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {showStageForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-blue-800">
            {editingStage ? 'Editar Etapa' : 'Nova Etapa'}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome da Etapa *</label>
              <input
                value={stageForm.name}
                onChange={e => setStageForm(f => ({ ...f, name: e.target.value }))}
                placeholder="ex: Fundacao, Estrutura, Alvenaria..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Prazo Estimado (dias)</label>
              <input
                type="number" min="0"
                value={stageForm.estimated_days}
                onChange={e => setStageForm(f => ({ ...f, estimated_days: e.target.value }))}
                placeholder="Opcional"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Descricao</label>
              <input
                value={stageForm.description}
                onChange={e => setStageForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Descricao opcional da etapa"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowStageForm(false)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <X className="w-4 h-4 inline mr-1" /> Cancelar
            </button>
            <button onClick={saveStage} disabled={savingStage}
              className="px-4 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors">
              {savingStage ? 'Salvando...' : <><Save className="w-4 h-4 inline mr-1" /> Salvar</>}
            </button>
          </div>
        </div>
      )}

      {stages.length === 0 ? (
        <div className="text-center py-14 border-2 border-dashed border-gray-200 rounded-xl">
          <Layers className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhuma etapa cadastrada</p>
          <p className="text-gray-400 text-sm mt-1">Crie etapas para organizar os insumos de cada fase da obra</p>
          <button onClick={() => openStageForm()}
            className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors">
            <Plus className="w-4 h-4 inline mr-1" /> Criar Primeira Etapa
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {stages.map((stage, idx) => {
            const isExpanded = expandedStages.has(stage.id);
            const total = stageTotalCost(stage);
            const isAddingItem = showItemForm === stage.id;

            return (
              <div key={stage.id} className="border border-gray-200 rounded-xl overflow-hidden">
                <div
                  className="flex items-center gap-3 px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleStage(stage.id)}
                >
                  <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {idx + 1}
                  </div>
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">{stage.name}</p>
                    {stage.description && <p className="text-xs text-gray-400 truncate">{stage.description}</p>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {stage.estimated_days && (
                      <span className="text-xs text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                        {stage.estimated_days}d
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      {(stage.items || []).length} iten{(stage.items || []).length !== 1 ? 's' : ''}
                    </span>
                    {total > 0 && (
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        {fmtBRL(total)}
                      </span>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); openStageForm(stage); }}
                      className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); deleteStage(stage.id); }}
                      className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 space-y-2 bg-white">
                    {(stage.items || []).length === 0 && !isAddingItem && (
                      <p className="text-xs text-gray-400 text-center py-3">
                        Nenhum item nesta etapa. Adicione insumos, produtos ou composicoes.
                      </p>
                    )}

                    {(stage.items || []).map(item => {
                      const typeConf = ITEM_TYPE_CONFIG[item.item_type] || ITEM_TYPE_CONFIG.material;
                      const ItemIcon = typeConf.icon;
                      return (
                        <div key={item.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${typeConf.bg} ${typeConf.border}`}>
                          <ItemIcon className={`w-4 h-4 flex-shrink-0 ${typeConf.color}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{item.item_name}</p>
                            <p className="text-xs text-gray-500">
                              {typeConf.label} &middot; {item.quantity} {item.unit}
                              {item.unit_price > 0 && ` &middot; ${fmtBRL(item.unit_price)}/un`}
                            </p>
                          </div>
                          {(item.total_price ?? item.quantity * item.unit_price) > 0 && (
                            <span className="text-sm font-semibold text-gray-700 flex-shrink-0">
                              {fmtBRL(item.total_price ?? item.quantity * item.unit_price)}
                            </span>
                          )}
                          <button onClick={() => deleteItem(item.id)}
                            className="p-1 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}

                    {isAddingItem && (
                      <div className="border border-orange-200 bg-orange-50 rounded-lg p-3 space-y-3 mt-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-orange-800">Adicionar Item</p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setManualMode(false)}
                              className={`text-xs px-2 py-1 rounded ${!manualMode ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
                            >
                              Buscar Catalogo
                            </button>
                            <button
                              onClick={() => setManualMode(true)}
                              className={`text-xs px-2 py-1 rounded ${manualMode ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
                            >
                              Manual
                            </button>
                          </div>
                        </div>

                        {!manualMode ? (
                          <div className="space-y-2">
                            <div className="relative">
                              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                              <input
                                value={itemSearch}
                                onChange={e => setItemSearch(e.target.value)}
                                placeholder="Buscar produto, insumo ou composicao..."
                                className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white"
                              />
                            </div>
                            {loadingCatalog && (
                              <p className="text-xs text-gray-400 text-center py-1">Buscando...</p>
                            )}
                            {catalogItems.length > 0 && (
                              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                                {catalogItems.map(ci => {
                                  const badge = ci.type === 'product' ? 'Produto' : ci.type === 'material' ? 'Insumo' : 'Composicao';
                                  const badgeColor = ci.type === 'product' ? 'text-emerald-700 bg-emerald-50' : ci.type === 'material' ? 'text-blue-700 bg-blue-50' : 'text-amber-700 bg-amber-50';
                                  return (
                                    <button key={ci.id} onClick={() => selectCatalogItem(ci)}
                                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0 transition-colors">
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${badgeColor}`}>{badge}</span>
                                      <span className="flex-1 text-sm text-gray-800 truncate">{ci.name}</span>
                                      <span className="text-xs text-gray-500 flex-shrink-0">{ci.unit}</span>
                                      {ci.price > 0 && <span className="text-xs text-gray-500 flex-shrink-0">{fmtBRL(ci.price)}</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                            {selectedItem && (
                              <div className="bg-white border border-gray-200 rounded-lg p-2 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                <span className="text-sm font-medium text-gray-700 flex-1 truncate">{selectedItem.name}</span>
                                <button onClick={() => { setSelectedItem(null); setItemSearch(''); }}
                                  className="p-0.5 text-gray-400 hover:text-red-500">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Qtd *</label>
                                <input type="number" min="0" step="0.001"
                                  value={itemForm.quantity}
                                  onChange={e => setItemForm(f => ({ ...f, quantity: e.target.value }))}
                                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Unidade</label>
                                <input
                                  value={itemForm.unit}
                                  onChange={e => setItemForm(f => ({ ...f, unit: e.target.value }))}
                                  placeholder={selectedItem?.unit || 'un'}
                                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1"><DollarSign className="w-3 h-3" />Preco/un</label>
                                <input type="number" min="0" step="0.01"
                                  value={itemForm.unit_price}
                                  onChange={e => setItemForm(f => ({ ...f, unit_price: e.target.value }))}
                                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white"
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Tipo</label>
                                <select value={manualForm.item_type}
                                  onChange={e => setManualForm(f => ({ ...f, item_type: e.target.value as any }))}
                                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white">
                                  {Object.entries(ITEM_TYPE_CONFIG).map(([k, v]) => (
                                    <option key={k} value={k}>{v.label}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Nome *</label>
                                <input value={manualForm.item_name}
                                  onChange={e => setManualForm(f => ({ ...f, item_name: e.target.value }))}
                                  placeholder="Nome do item"
                                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Qtd *</label>
                                <input type="number" min="0" step="0.001"
                                  value={manualForm.quantity}
                                  onChange={e => setManualForm(f => ({ ...f, quantity: e.target.value }))}
                                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Unidade</label>
                                <input value={manualForm.unit}
                                  onChange={e => setManualForm(f => ({ ...f, unit: e.target.value }))}
                                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1"><DollarSign className="w-3 h-3" />Preco/un</label>
                                <input type="number" min="0" step="0.01"
                                  value={manualForm.unit_price}
                                  onChange={e => setManualForm(f => ({ ...f, unit_price: e.target.value }))}
                                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {error && (
                          <p className="text-xs text-red-600 flex items-center gap-1">
                            <Circle className="w-3 h-3" /> {error}
                          </p>
                        )}

                        <div className="flex justify-end gap-2">
                          <button onClick={() => setShowItemForm(null)}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors bg-white">
                            Cancelar
                          </button>
                          <button onClick={() => saveItem(stage.id)} disabled={savingItem}
                            className="px-4 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors">
                            {savingItem ? 'Adicionando...' : 'Adicionar Item'}
                          </button>
                        </div>
                      </div>
                    )}

                    {!isAddingItem && (
                      <button onClick={() => openItemForm(stage.id)}
                        className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50/50 transition-colors mt-1">
                        <Plus className="w-3.5 h-3.5" /> Adicionar Insumo / Produto / Composicao
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {stages.length > 0 && grandTotal > 0 && (
        <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl">
          <div>
            <p className="text-xs text-gray-500">Total de {stages.length} etapa{stages.length !== 1 ? 's' : ''}</p>
            <p className="text-xs text-gray-400 mt-0.5">Somatorio de todos os itens cadastrados nas etapas</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-orange-600">{fmtBRL(grandTotal)}</p>
            <p className="text-xs text-gray-400">Valor total das etapas</p>
          </div>
        </div>
      )}
    </div>
  );
}
