import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Plus, ChevronDown, ChevronRight,
  RefreshCw, Layers, ArrowUp, ArrowDown, Settings,
  GitBranch, Trash2, X, Check, Package, Search, Wrench, Info,
} from 'lucide-react';
import {
  Budget, WBSStep, BudgetElement, BudgetFoundationParam,
  BudgetGlobalParam, BudgetItem, ItemType,
  fmtBRL,
  FOUNDATION_TYPES,
} from './types';
import SpreadsheetSubEtapa from './SpreadsheetSubEtapa';
import ParametricSubEtapa from './ParametricSubEtapa';

interface Props {
  budget: Budget;
  wbsSteps: WBSStep[];
  onRefresh: () => void;
}

const DEFAULT_SUB_ETAPA = 'Geral';

interface Material { id: string; name: string; unit: string; resale_price: number | null; unit_cost: number | null; }
interface Product  { id: string; name: string; unit: string; sale_price: number; final_sale_price: number | null; }
interface Comp     { id: string; name: string; description: string | null; total_cost: number | null; }

const ITEM_TYPE_CONFIG: Record<ItemType, { label: string; color: string; bg: string; icon: React.ComponentType<any> }> = {
  composicao: { label: 'Composicao', color: 'text-blue-700',   bg: 'bg-blue-100',   icon: Layers },
  material:   { label: 'Insumo',     color: 'text-amber-700',  bg: 'bg-amber-100',  icon: Package },
  produto:    { label: 'Produto',    color: 'text-green-700',  bg: 'bg-green-100',  icon: Package },
  servico:    { label: 'Servico',    color: 'text-slate-700',  bg: 'bg-slate-100',  icon: Wrench },
};

interface CompositionSubItem {
  id: string;
  description: string;
  unit: string;
  coefficient: number;
  unit_price: number;
  item_type: string;
}

const emptyItemForm = (wbsId: string) => ({
  wbs_step_id: wbsId,
  item_type: 'material' as ItemType,
  material_id: '',
  product_id: '',
  composition_id: '',
  description: '',
  unit: 'un',
  quantity: 1,
  unit_price: 0,
  notes: '',
});

export default function BudgetElementsPanel({ budget, wbsSteps, onRefresh }: Props) {
  const [elements, setElements] = useState<BudgetElement[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [foundationParams, setFoundationParams] = useState<BudgetFoundationParam[]>([]);
  const [globalParams, setGlobalParams] = useState<BudgetGlobalParam[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [compositions, setCompositions] = useState<Comp[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedWbs, setExpandedWbs] = useState<Set<string>>(new Set());
  const [subEtapaTotals, setSubEtapaTotals] = useState<Record<string, number>>({});
  const [addingSubEtapa, setAddingSubEtapa] = useState<string | null>(null);
  const [newSubEtapaName, setNewSubEtapaName] = useState('');
  const [selectedFoundationType, setSelectedFoundationType] = useState(FOUNDATION_TYPES[0].value);
  const [addingWbs, setAddingWbs] = useState(false);
  const [newWbsName, setNewWbsName] = useState('');
  const [savingWbs, setSavingWbs] = useState(false);
  const [renamingWbs, setRenamingWbs] = useState<string | null>(null);
  const [renameWbsValue, setRenameWbsValue] = useState('');

  const [showItemModal, setShowItemModal] = useState(false);
  const [itemForm, setItemForm] = useState(emptyItemForm(''));
  const [savingItem, setSavingItem] = useState(false);
  const [matSearch, setMatSearch] = useState('');
  const [expandedItems, setExpandedItems] = useState<Record<string, CompositionSubItem[] | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: elData, error: elErr }, { data: fpData, error: fpErr }, { data: gpData, error: gpErr },
           { data: itemsData }, { data: matsData }, { data: prodsData }, { data: compsData }] = await Promise.all([
      supabase.from('budget_elements')
        .select('id,budget_id,wbs_step_id,element_type,label,room,calculated_quantity,calculated_unit,measurement_status,sub_etapa,params,notes,created_at,foundation_param_id')
        .eq('budget_id', budget.id)
        .limit(10000)
        .order('created_at'),
      supabase.from('budget_foundation_params')
        .select('id,budget_id,param_type,code,label,dimensions,recipe_id,notes,sort_order,recipes(id,name,concrete_type,specific_weight)')
        .eq('budget_id', budget.id)
        .limit(500)
        .order('sort_order'),
      supabase.from('budget_global_params')
        .select('id,budget_id,param_key,param_label,param_category,material_id,recipe_id,unit_price,value_text,notes,sort_order,materials(id,name,unit,unit_cost,resale_price),recipes(id,name,concrete_type,specific_weight)')
        .eq('budget_id', budget.id)
        .limit(500)
        .order('sort_order'),
      supabase.from('budget_items')
        .select('id,budget_id,wbs_step_id,item_type,material_id,product_id,composition_id,description,unit,quantity,unit_price,total_price,bdi_value,final_price,notes,sort_order,created_at')
        .eq('budget_id', budget.id)
        .limit(1000)
        .order('sort_order'),
      supabase.from('materials').select('id,name,unit,resale_price,unit_cost').order('name').limit(500),
      supabase.from('products').select('id,name,unit,sale_price,final_sale_price').order('name').limit(500),
      supabase.from('compositions').select('id,name,description,total_cost').order('name').limit(500),
    ]);
    if (elErr) console.error('Erro ao carregar elementos:', elErr);
    if (fpErr) console.error('Erro ao carregar parametros fundacao:', fpErr);
    if (gpErr) console.error('Erro ao carregar parametros globais:', gpErr);
    setElements(elData || []);
    setFoundationParams(fpData || []);
    setGlobalParams(gpData || []);
    setBudgetItems(itemsData || []);
    setMaterials(matsData || []);
    setProducts(prodsData || []);
    setCompositions(compsData || []);
    if (elData && elData.length > 0) {
      const ids = new Set((elData as BudgetElement[]).map(e => e.wbs_step_id).filter(Boolean) as string[]);
      if (ids.size > 0) setExpandedWbs(prev => new Set([...prev, ...ids]));
    }
    setLoading(false);
  }, [budget.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (wbsSteps.length > 0) {
      setExpandedWbs(new Set(wbsSteps.map(w => w.id)));
    }
  }, [wbsSteps]);

  const groupedByWbs = useMemo(() => {
    const map: Record<string, Record<string, BudgetElement[]>> = {};
    wbsSteps.forEach(w => { map[w.id] = {}; });
    elements.forEach(el => {
      const wbsId = el.wbs_step_id || '__none__';
      if (!map[wbsId]) map[wbsId] = {};
      const subKey = el.sub_etapa || DEFAULT_SUB_ETAPA;
      if (!map[wbsId][subKey]) map[wbsId][subKey] = [];
      map[wbsId][subKey].push(el);
    });
    return map;
  }, [elements, wbsSteps]);

  const itemsByWbs = useMemo(() => {
    const map: Record<string, BudgetItem[]> = {};
    budgetItems.forEach(item => {
      const key = item.wbs_step_id || '__none__';
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [budgetItems]);

  const wbsStepTotal = useCallback((wbsId: string) => {
    const subMap = groupedByWbs[wbsId] || {};
    const elemTotal = Object.keys(subMap).reduce((sum, sub) => {
      return sum + (subEtapaTotals[`${wbsId}::${sub}`] || 0);
    }, 0);
    const itemTotal = (itemsByWbs[wbsId] || []).reduce((s, i) => s + (i.final_price || 0), 0);
    return elemTotal + itemTotal;
  }, [groupedByWbs, subEtapaTotals, itemsByWbs]);

  const handleSubEtapaTotal = useCallback((wbsId: string, subName: string, total: number) => {
    setSubEtapaTotals(prev => ({ ...prev, [`${wbsId}::${subName}`]: total }));
  }, []);

  const toggleWbs = (id: string) => setExpandedWbs(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s;
  });

  const moveWbs = async (wbsId: string, direction: 'up' | 'down') => {
    const sorted = [...wbsSteps].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex(w => w.id === wbsId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx]; const b = sorted[swapIdx];
    await Promise.all([
      supabase.from('budget_wbs_steps').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('budget_wbs_steps').update({ sort_order: a.sort_order }).eq('id', b.id),
    ]);
    onRefresh();
  };

  const toggleParametric = async (wbs: WBSStep) => {
    await supabase.from('budget_wbs_steps').update({ is_parametric: !wbs.is_parametric }).eq('id', wbs.id);
    onRefresh();
  };

  const addSubEtapa = async (wbsId: string) => {
    const wbs = wbsSteps.find(w => w.id === wbsId);
    const isParam = wbs?.is_parametric || false;

    let name: string;
    let elementType: string;

    if (isParam) {
      const ft = FOUNDATION_TYPES.find(f => f.value === selectedFoundationType) || FOUNDATION_TYPES[0];
      name = ft.label;
      elementType = ft.elementType;
    } else {
      name = newSubEtapaName.trim();
      if (!name) {
        alert('Digite um nome para a sub-etapa.');
        return;
      }
      elementType = 'canteiro_obras';
    }

    const existingSubs = groupedByWbs[wbsId] || {};
    const normalised = name.toLowerCase();
    const duplicate = Object.keys(existingSubs).some(k => k.toLowerCase() === normalised);
    if (duplicate && !isParam) {
      alert(`Ja existe uma sub-etapa "${name}" nesta etapa.`);
      return;
    }
    if (duplicate && isParam) {
      const count = Object.keys(existingSubs).filter(k => k.toLowerCase().startsWith(normalised)).length;
      name = `${name} (${count + 1})`;
    }

    const nameToInsert = name;
    const elementTypeToInsert = elementType;

    setAddingSubEtapa(null);
    setNewSubEtapaName('');
    setSelectedFoundationType(FOUNDATION_TYPES[0].value);
    setExpandedWbs(prev => new Set([...prev, wbsId]));

    const { error } = await supabase.from('budget_elements').insert({
      budget_id: budget.id,
      wbs_step_id: wbsId,
      sub_etapa: nameToInsert,
      element_type: elementTypeToInsert,
      label: nameToInsert,
      params: { quantidade: 1, custo_unitario: 0 },
      source: 'manual',
    });
    if (error) {
      console.error('Erro ao criar sub-etapa:', error);
      alert(`Erro ao criar sub-etapa: ${error.message}`);
      return;
    }
    await load();
    setExpandedWbs(prev => new Set([...prev, wbsId]));
    onRefresh();
  };

  const deleteSubEtapa = async (wbsId: string, subName: string) => {
    if (!window.confirm(`Excluir a sub-etapa "${subName}" e todos os seus itens?`)) return;
    const els = (groupedByWbs[wbsId]?.[subName]) || [];
    for (const el of els) {
      await supabase.from('budget_element_line_items').delete().eq('element_id', el.id);
      await supabase.from('budget_elements').delete().eq('id', el.id);
    }
    await load();
    onRefresh();
  };

  const renameSubEtapa = async (wbsId: string, oldName: string, newName: string) => {
    const els = (groupedByWbs[wbsId]?.[oldName]) || [];
    for (const el of els) {
      await supabase.from('budget_elements').update({ sub_etapa: newName }).eq('id', el.id);
    }
    setSubEtapaTotals(prev => {
      const updated = { ...prev };
      updated[`${wbsId}::${newName}`] = updated[`${wbsId}::${oldName}`] || 0;
      delete updated[`${wbsId}::${oldName}`];
      return updated;
    });
    await load();
    onRefresh();
  };

  const addWbsStep = async () => {
    const name = newWbsName.trim();
    if (!name) return;
    setSavingWbs(true);
    const maxOrder = wbsSteps.reduce((acc, w) => Math.max(acc, w.sort_order || 0), 0);
    const code = `${wbsSteps.length + 1}.0`;
    const { data, error } = await supabase.from('budget_wbs_steps').insert({
      budget_id: budget.id,
      code,
      name,
      sort_order: maxOrder + 1,
    }).select('id').single();
    if (error) {
      alert(`Erro ao criar etapa: ${error.message}`);
      setSavingWbs(false);
      return;
    }
    setNewWbsName('');
    setAddingWbs(false);
    if (data) setExpandedWbs(prev => new Set([...prev, data.id]));
    setSavingWbs(false);
    onRefresh();
  };

  const deleteWbsStep = async (wbsId: string, wbsName: string) => {
    const hasElements = Object.keys(groupedByWbs[wbsId] || {}).length > 0;
    const hasItems = (itemsByWbs[wbsId] || []).length > 0;
    const msg = (hasElements || hasItems)
      ? `Excluir a etapa "${wbsName}" e todos os seus elementos e itens?`
      : `Excluir a etapa "${wbsName}"?`;
    if (!window.confirm(msg)) return;
    if (hasElements) {
      const allEls = Object.values(groupedByWbs[wbsId] || {}).flat();
      for (const el of allEls) {
        await supabase.from('budget_element_line_items').delete().eq('element_id', el.id);
        await supabase.from('budget_elements').delete().eq('id', el.id);
      }
    }
    if (hasItems) {
      await supabase.from('budget_items').delete().eq('wbs_step_id', wbsId);
    }
    await supabase.from('budget_wbs_steps').delete().eq('id', wbsId);
    await load();
    onRefresh();
  };

  const commitRenameWbs = async (wbsId: string) => {
    const name = renameWbsValue.trim();
    setRenamingWbs(null);
    if (!name) return;
    await supabase.from('budget_wbs_steps').update({ name }).eq('id', wbsId);
    onRefresh();
  };

  const openItemModal = (wbsId: string) => {
    setItemForm(emptyItemForm(wbsId));
    setMatSearch('');
    setShowItemModal(true);
  };

  const filteredMats = useMemo(() => {
    if (!matSearch) return materials.slice(0, 50);
    return materials.filter(m => m.name.toLowerCase().includes(matSearch.toLowerCase())).slice(0, 50);
  }, [materials, matSearch]);

  const filteredProds = useMemo(() => {
    if (!matSearch) return products.slice(0, 50);
    return products.filter(p => p.name.toLowerCase().includes(matSearch.toLowerCase())).slice(0, 50);
  }, [products, matSearch]);

  const filteredComps = useMemo(() => {
    if (!matSearch) return compositions.slice(0, 50);
    return compositions.filter(c => c.name.toLowerCase().includes(matSearch.toLowerCase())).slice(0, 50);
  }, [compositions, matSearch]);

  const handleTypeChange = (t: ItemType) => {
    setItemForm(f => ({ ...f, item_type: t, material_id: '', product_id: '', composition_id: '', description: '', unit: 'un', unit_price: 0 }));
    setMatSearch('');
  };

  const handleSelectMaterial = (m: Material) => {
    const price = m.resale_price ?? m.unit_cost ?? 0;
    setItemForm(f => ({ ...f, material_id: m.id, description: m.name, unit: m.unit, unit_price: price }));
    setMatSearch(m.name);
  };

  const handleSelectProduct = (p: Product) => {
    const price = p.final_sale_price ?? p.sale_price ?? 0;
    setItemForm(f => ({ ...f, product_id: p.id, description: p.name, unit: p.unit, unit_price: price }));
    setMatSearch(p.name);
  };

  const handleSelectComposition = (c: Comp) => {
    setItemForm(f => ({ ...f, composition_id: c.id, description: c.name, unit: 'un', unit_price: c.total_cost ?? 0 }));
    setMatSearch(c.name);
  };

  const bdiPreview = useMemo(() => {
    const base = itemForm.quantity * itemForm.unit_price;
    const bdi = base * (budget.bdi_percent / 100);
    return { base, bdi, total: base + bdi };
  }, [itemForm.quantity, itemForm.unit_price, budget.bdi_percent]);

  const saveItem = async () => {
    if (!itemForm.description || itemForm.unit_price < 0) return;
    setSavingItem(true);
    const maxOrder = budgetItems.reduce((acc, i) => Math.max(acc, i.sort_order || 0), 0);
    const totalPrice = itemForm.quantity * itemForm.unit_price;
    const bdiValue = totalPrice * (budget.bdi_percent / 100);
    const finalPrice = totalPrice + bdiValue;
    await supabase.from('budget_items').insert({
      budget_id: budget.id,
      wbs_step_id: itemForm.wbs_step_id || null,
      item_type: itemForm.item_type,
      material_id: itemForm.material_id || null,
      product_id: itemForm.product_id || null,
      composition_id: itemForm.composition_id || null,
      description: itemForm.description,
      unit: itemForm.unit,
      quantity: itemForm.quantity,
      unit_price: itemForm.unit_price,
      total_price: totalPrice,
      bdi_value: bdiValue,
      final_price: finalPrice,
      notes: itemForm.notes || null,
      sort_order: maxOrder + 1,
    });
    setShowItemModal(false);
    setMatSearch('');
    await load();
    onRefresh();
    setSavingItem(false);
  };

  const deleteItem = async (id: string) => {
    await supabase.from('budget_items').delete().eq('id', id);
    await load();
    onRefresh();
  };

  const loadCompositionSubItems = useCallback(async (compositionId: string): Promise<CompositionSubItem[]> => {
    const { data } = await supabase
      .from('budget_composition_items')
      .select('id, item_type, coefficient, unit_price, unit, description, materials(name), products(name)')
      .eq('composition_id', compositionId);
    return (data || []).map((i: any) => ({
      id: i.id,
      description: i.description || i.materials?.name || i.products?.name || '—',
      unit: i.unit,
      coefficient: i.coefficient,
      unit_price: i.unit_price,
      item_type: i.item_type,
    }));
  }, []);

  const toggleItemExpand = async (itemId: string, compositionId: string | null) => {
    if (!compositionId) return;
    const current = expandedItems[itemId];
    if (current !== undefined) {
      if (current === null) {
        const subs = await loadCompositionSubItems(compositionId);
        setExpandedItems(prev => ({ ...prev, [itemId]: subs }));
      } else {
        setExpandedItems(prev => ({ ...prev, [itemId]: null }));
      }
    } else {
      const subs = await loadCompositionSubItems(compositionId);
      setExpandedItems(prev => ({ ...prev, [itemId]: subs }));
    }
  };

  const grandTotal = wbsSteps.reduce((sum, w) => sum + wbsStepTotal(w.id), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {grandTotal > 0 && (
            <span className="text-sm font-bold text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100">
              Total Geral: {fmtBRL(grandTotal)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setAddingWbs(true); setNewWbsName(''); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" /> Nova Etapa
          </button>
          <button onClick={load} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {addingWbs && (
        <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-xl">
          <GitBranch className="w-4 h-4 text-orange-500 flex-shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Nome da etapa (ex: Fundacao, Estrutura, Cobertura...)"
            value={newWbsName}
            onChange={e => setNewWbsName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') addWbsStep();
              if (e.key === 'Escape') { setAddingWbs(false); setNewWbsName(''); }
            }}
            className="flex-1 px-3 py-1.5 text-sm border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-400 bg-white"
          />
          <button
            onClick={addWbsStep}
            disabled={!newWbsName.trim() || savingWbs}
            className="px-3 py-1.5 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 disabled:opacity-40 transition-colors"
          >
            {savingWbs ? 'Salvando...' : 'Adicionar'}
          </button>
          <button
            onClick={() => { setAddingWbs(false); setNewWbsName(''); }}
            className="p-1.5 border border-gray-300 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Adicionar Item ao Orcamento</h3>
              <p className="text-sm text-gray-500 mt-0.5">Insumos e Produtos buscados do catalogo existente</p>
            </div>
            <div className="p-6 space-y-5">
              {/* WBS display */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Etapa WBS</label>
                <select value={itemForm.wbs_step_id} onChange={e => setItemForm(f => ({ ...f, wbs_step_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none">
                  <option value="">-- Sem etapa --</option>
                  {wbsSteps.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
                </select>
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de Item</label>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(ITEM_TYPE_CONFIG) as ItemType[]).map(t => {
                    const cfg = ITEM_TYPE_CONFIG[t];
                    const Icon = cfg.icon;
                    return (
                      <button key={t} onClick={() => handleTypeChange(t)}
                        className={`flex flex-col items-center gap-1 p-3 border-2 rounded-xl text-xs font-medium transition-all ${
                          itemForm.item_type === t ? `border-orange-400 ${cfg.bg} ${cfg.color}` : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}>
                        <Icon className="w-4 h-4" />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Source picker */}
              {(itemForm.item_type === 'material' || itemForm.item_type === 'produto' || itemForm.item_type === 'composicao') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {itemForm.item_type === 'material' ? 'Insumo' : itemForm.item_type === 'produto' ? 'Produto' : 'Composicao'}
                  </label>
                  <div className="flex gap-2 mb-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input value={matSearch} onChange={e => setMatSearch(e.target.value)}
                        placeholder={`Buscar ${itemForm.item_type === 'material' ? 'insumo' : itemForm.item_type === 'produto' ? 'produto' : 'composicao'}...`}
                        className="pl-8 pr-3 py-2 w-full border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 outline-none" />
                    </div>
                  </div>
                  <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-gray-100">
                    {itemForm.item_type === 'material' && filteredMats.map(m => (
                      <button key={m.id} onClick={() => handleSelectMaterial(m)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-orange-50 transition-colors ${itemForm.material_id === m.id ? 'bg-orange-50 text-orange-700 font-medium' : 'text-gray-700'}`}>
                        <span>{m.name}</span>
                        <span className="text-xs text-gray-400">{fmtBRL(m.resale_price ?? m.unit_cost ?? 0)}/{m.unit}</span>
                      </button>
                    ))}
                    {itemForm.item_type === 'produto' && filteredProds.map(p => (
                      <button key={p.id} onClick={() => handleSelectProduct(p)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-orange-50 transition-colors ${itemForm.product_id === p.id ? 'bg-orange-50 text-orange-700 font-medium' : 'text-gray-700'}`}>
                        <span>{p.name}</span>
                        <span className="text-xs text-gray-400">{fmtBRL(p.final_sale_price ?? p.sale_price ?? 0)}/{p.unit}</span>
                      </button>
                    ))}
                    {itemForm.item_type === 'composicao' && filteredComps.map(c => (
                      <button key={c.id} onClick={() => handleSelectComposition(c)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-orange-50 transition-colors ${itemForm.composition_id === c.id ? 'bg-orange-50 text-orange-700 font-medium' : 'text-gray-700'}`}>
                        <span>{c.name}</span>
                        <span className="text-xs text-gray-400">{fmtBRL(c.total_cost ?? 0)}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Preco obtido direto do catalogo de Insumos e Produtos da Industria
                  </p>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Descricao</label>
                <input value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Descricao do item..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none" />
              </div>

              {/* Qty + Unit + Price */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantidade</label>
                  <input type="number" value={itemForm.quantity} min={0} step={0.001}
                    onChange={e => setItemForm(f => ({ ...f, quantity: parseFloat(e.target.value) || 0 }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Unidade</label>
                  <input value={itemForm.unit} onChange={e => setItemForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Preco Unit. (R$)</label>
                  <input type="number" value={itemForm.unit_price} min={0} step={0.01}
                    onChange={e => setItemForm(f => ({ ...f, unit_price: parseFloat(e.target.value) || 0 }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none" />
                </div>
              </div>

              {/* BDI preview */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-amber-700 mb-2">Preview com BDI ({budget.bdi_percent}%)</p>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Base</p>
                    <p className="font-semibold text-gray-800">{fmtBRL(bdiPreview.base)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">BDI</p>
                    <p className="font-semibold text-amber-600">+ {fmtBRL(bdiPreview.bdi)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total Final</p>
                    <p className="font-bold text-orange-600">{fmtBRL(bdiPreview.total)}</p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Observacoes</label>
                <textarea value={itemForm.notes} onChange={e => setItemForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none resize-none" />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => { setShowItemModal(false); setMatSearch(''); }}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={saveItem} disabled={savingItem || !itemForm.description}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors">
                {savingItem ? 'Salvando...' : 'Adicionar Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {wbsSteps.map((wbs, wbsIdx) => {
            const subMap = groupedByWbs[wbs.id] || {};
            const subEtapas = Object.keys(subMap);
            const isOpen = expandedWbs.has(wbs.id);
            const totalItems = Object.values(subMap).reduce((s, arr) => s + arr.length, 0);
            const wbsItems = itemsByWbs[wbs.id] || [];
            const stepTotal = wbsStepTotal(wbs.id);

            return (
              <div key={wbs.id} className="border border-blue-200 rounded-xl overflow-hidden">
                <div className="flex items-center px-3 py-2.5 gap-2 bg-blue-50">
                  <button
                    onClick={() => toggleWbs(wbs.id)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left rounded-lg px-1 py-0.5 hover:bg-blue-100 transition-colors"
                  >
                    {isOpen
                      ? <ChevronDown className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    }
                    <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded flex-shrink-0">
                      {wbsIdx + 1}.
                    </span>
                    {renamingWbs === wbs.id ? (
                      <div className="flex items-center gap-1.5 flex-1" onClick={e => e.stopPropagation()}>
                        <input
                          autoFocus
                          value={renameWbsValue}
                          onChange={e => setRenameWbsValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') commitRenameWbs(wbs.id);
                            if (e.key === 'Escape') setRenamingWbs(null);
                          }}
                          onBlur={() => commitRenameWbs(wbs.id)}
                          className="flex-1 px-2 py-0.5 text-sm font-semibold border border-orange-300 rounded focus:ring-1 focus:ring-orange-400 bg-white"
                        />
                        <button onClick={() => commitRenameWbs(wbs.id)} className="p-1 text-green-500 hover:bg-green-50 rounded">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setRenamingWbs(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="font-semibold text-sm text-blue-900 truncate">{wbs.name}</span>
                        {(totalItems + wbsItems.length) > 0 && (
                          <span className="text-xs text-blue-400 flex-shrink-0">
                            {totalItems + wbsItems.length} {(totalItems + wbsItems.length) === 1 ? 'item' : 'itens'}
                          </span>
                        )}
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {stepTotal > 0 && (
                      <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200">
                        {fmtBRL(stepTotal)}
                      </span>
                    )}

                    <button
                      onClick={() => toggleParametric(wbs)}
                      title={wbs.is_parametric ? 'Parametrizado (clique para tornar simples)' : 'Nao Parametrizado (clique para tornar parametrico)'}
                      className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border font-medium transition-colors ${
                        wbs.is_parametric
                          ? 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200'
                          : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      {wbs.is_parametric
                        ? <><Layers className="w-3 h-3" /> Param.</>
                        : <><Settings className="w-3 h-3" /> Simples</>
                      }
                    </button>

                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveWbs(wbs.id, 'up')} className="p-0.5 text-gray-300 hover:text-gray-500 hover:bg-gray-100 rounded transition-colors">
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button onClick={() => moveWbs(wbs.id, 'down')} className="p-0.5 text-gray-300 hover:text-gray-500 hover:bg-gray-100 rounded transition-colors">
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      onClick={e => { e.stopPropagation(); setRenamingWbs(wbs.id); setRenameWbsValue(wbs.name); }}
                      title="Renomear etapa"
                      className="p-1 text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={e => { e.stopPropagation(); deleteWbsStep(wbs.id, wbs.name); }}
                      title="Excluir etapa"
                      className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100">
                    {subEtapas.length === 0 && wbsItems.length === 0 ? (
                      addingSubEtapa === wbs.id ? (
                        <div className="px-4 py-3 flex items-center gap-2 bg-gray-50">
                          <GitBranch className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          {wbs.is_parametric ? (
                            <select
                              autoFocus
                              value={selectedFoundationType}
                              onChange={e => setSelectedFoundationType(e.target.value as any)}
                              className="flex-1 px-3 py-1.5 text-sm border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-400 bg-white"
                            >
                              {FOUNDATION_TYPES.map(ft => (
                                <option key={ft.value} value={ft.value}>{ft.label}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              autoFocus
                              type="text"
                              placeholder="Nome da sub-etapa (ex: Almoxarifado, Limpeza de terreno...)"
                              value={newSubEtapaName}
                              onChange={e => setNewSubEtapaName(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') addSubEtapa(wbs.id);
                                if (e.key === 'Escape') { setAddingSubEtapa(null); setNewSubEtapaName(''); }
                              }}
                              className="flex-1 px-3 py-1.5 text-sm border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-400 bg-white"
                            />
                          )}
                          <button
                            onClick={() => addSubEtapa(wbs.id)}
                            disabled={!wbs.is_parametric && !newSubEtapaName.trim()}
                            className="px-3 py-1.5 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 disabled:opacity-40 transition-colors"
                          >
                            Adicionar
                          </button>
                          <button
                            onClick={() => { setAddingSubEtapa(null); setNewSubEtapaName(''); }}
                            className="px-3 py-1.5 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="px-4 py-6 text-center">
                          <GitBranch className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                          <p className="text-sm text-gray-400 mb-3">Nenhum item adicionado</p>
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => { setAddingSubEtapa(wbs.id); setNewSubEtapaName(''); }}
                              className="inline-flex items-center gap-1.5 px-4 py-2 border border-orange-200 text-orange-600 rounded-lg text-sm hover:bg-orange-50 transition-colors"
                            >
                              <Plus className="w-4 h-4" /> Adicionar Sub-etapa
                            </button>
                            <button
                              onClick={() => openItemModal(wbs.id)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 border border-blue-200 text-blue-600 rounded-lg text-sm hover:bg-blue-50 transition-colors"
                            >
                              <Package className="w-4 h-4" /> Adicionar Item
                            </button>
                          </div>
                        </div>
                      )
                    ) : (
                      <>
                        {subEtapas.map((subName, subIdx) => {
                          const subElements = subMap[subName] || [];
                          const subIndex = `${wbsIdx + 1}.${subIdx + 1}`;

                          if (wbs.is_parametric) {
                            return (
                              <ParametricSubEtapa
                                key={`${wbs.id}::${subName}`}
                                subEtapaName={subName}
                                elements={subElements}
                                budgetId={budget.id}
                                wbsStepId={wbs.id}
                                subEtapaIndex={subIndex as any}
                                foundationParams={foundationParams}
                                globalParams={globalParams}
                                onElementsChange={load}
                                onDeleteSubEtapa={() => deleteSubEtapa(wbs.id, subName)}
                                onRenameSubEtapa={n => renameSubEtapa(wbs.id, subName, n)}
                                onTotalChange={(_, t) => handleSubEtapaTotal(wbs.id, subName, t)}
                              />
                            );
                          }

                          return (
                            <SpreadsheetSubEtapa
                              key={`${wbs.id}::${subName}`}
                              subEtapaName={subName}
                              elements={subElements}
                              budgetId={budget.id}
                              wbsStepId={wbs.id}
                              subEtapaIndex={subIndex as any}
                              onElementsChange={load}
                              onDeleteSubEtapa={() => deleteSubEtapa(wbs.id, subName)}
                              onRenameSubEtapa={n => renameSubEtapa(wbs.id, subName, n)}
                              onTotalChange={(_, t) => handleSubEtapaTotal(wbs.id, subName, t)}
                            />
                          );
                        })}

                        {/* Budget Items section for this WBS step */}
                        {wbsItems.length > 0 && (
                          <div className="border-t border-gray-100">
                            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Package className="w-3.5 h-3.5 text-slate-500" />
                                <span className="text-xs font-semibold text-slate-600">Itens do Catalogo</span>
                                <span className="text-xs text-slate-400">({wbsItems.length} {wbsItems.length === 1 ? 'item' : 'itens'})</span>
                              </div>
                              <span className="text-xs font-bold text-slate-600">
                                {fmtBRL(wbsItems.reduce((s, i) => s + (i.final_price || 0), 0))}
                              </span>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-slate-50/60 border-b border-slate-100">
                                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Descricao</th>
                                    <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 w-24">Tipo</th>
                                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 w-20">Qtd</th>
                                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 w-28">P. Unit.</th>
                                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 w-24">Base</th>
                                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 w-24">BDI</th>
                                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 w-28">Total</th>
                                    <th className="w-10" />
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {wbsItems.map(item => {
                                    const cfg = ITEM_TYPE_CONFIG[item.item_type];
                                    const Icon = cfg.icon;
                                    const subItems = expandedItems[item.id];
                                    const isExpanded = subItems !== undefined && subItems !== null;
                                    return (
                                      <>
                                        <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                                          <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-1.5">
                                              {item.composition_id && (
                                                <button
                                                  onClick={() => toggleItemExpand(item.id, item.composition_id ?? null)}
                                                  title={isExpanded ? 'Ocultar composicao' : 'Ver itens da composicao'}
                                                  className={`flex-shrink-0 p-1 rounded-md transition-colors ${
                                                    isExpanded
                                                      ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                                                      : 'text-blue-400 hover:text-blue-600 hover:bg-blue-50'
                                                  }`}
                                                >
                                                  {isExpanded
                                                    ? <ChevronDown className="w-3.5 h-3.5" />
                                                    : <ChevronRight className="w-3.5 h-3.5" />
                                                  }
                                                </button>
                                              )}
                                              <span className="text-gray-800">{item.description}</span>
                                            </div>
                                          </td>
                                          <td className="px-3 py-2.5 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                                              <Icon className="w-3 h-3" />{cfg.label}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2.5 text-right text-gray-600 text-xs">{item.quantity} {item.unit}</td>
                                          <td className="px-3 py-2.5 text-right text-gray-600 text-xs">{fmtBRL(item.unit_price)}</td>
                                          <td className="px-3 py-2.5 text-right text-gray-600 text-xs">{fmtBRL(item.total_price)}</td>
                                          <td className="px-3 py-2.5 text-right text-amber-600 text-xs">+{fmtBRL(item.bdi_value)}</td>
                                          <td className="px-3 py-2.5 text-right font-semibold text-gray-800 text-xs">{fmtBRL(item.final_price)}</td>
                                          <td className="px-3 py-2.5 text-center">
                                            <button
                                              onClick={() => deleteItem(item.id)}
                                              className="p-1 text-gray-300 hover:text-red-500 transition-colors rounded opacity-0 group-hover:opacity-100"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </td>
                                        </tr>
                                        {isExpanded && subItems && subItems.length > 0 && (
                                          <tr key={`${item.id}-sub`}>
                                            <td colSpan={8} className="px-0 py-0">
                                              <div className="mx-4 mb-2 border border-blue-100 rounded-lg bg-blue-50/40 overflow-hidden">
                                                <div className="px-3 py-1.5 bg-blue-50 border-b border-blue-100 flex items-center gap-1.5">
                                                  <Layers className="w-3 h-3 text-blue-500" />
                                                  <span className="text-xs font-semibold text-blue-700">Itens da composicao (referencia)</span>
                                                </div>
                                                <table className="w-full text-xs">
                                                  <thead>
                                                    <tr className="bg-blue-50/60">
                                                      <th className="text-right px-3 py-1 text-gray-500 font-medium w-16">Qtd/un</th>
                                                      <th className="text-center px-2 py-1 text-gray-500 font-medium w-12">Unid.</th>
                                                      <th className="text-left px-3 py-1 text-gray-500 font-medium">Descricao</th>
                                                      <th className="text-right px-3 py-1 text-gray-500 font-medium w-24">V. Unit.</th>
                                                      <th className="text-right px-3 py-1 text-gray-500 font-medium w-24">Subtotal</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody className="divide-y divide-blue-100/60">
                                                    {subItems.map(sub => (
                                                      <tr key={sub.id} className="hover:bg-blue-50/60">
                                                        <td className="px-3 py-1 text-right text-gray-700">{sub.coefficient.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</td>
                                                        <td className="px-2 py-1 text-center text-gray-500">{sub.unit}</td>
                                                        <td className="px-3 py-1 text-gray-700">{sub.description}</td>
                                                        <td className="px-3 py-1 text-right text-gray-600">{fmtBRL(sub.unit_price)}</td>
                                                        <td className="px-3 py-1 text-right text-gray-700 font-medium">{fmtBRL(sub.coefficient * sub.unit_price)}</td>
                                                      </tr>
                                                    ))}
                                                  </tbody>
                                                </table>
                                              </div>
                                            </td>
                                          </tr>
                                        )}
                                      </>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {addingSubEtapa === wbs.id ? (
                          <div className="px-4 py-3 flex items-center gap-2 border-t border-gray-100 bg-gray-50">
                            <GitBranch className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            {wbs.is_parametric ? (
                              <select
                                autoFocus
                                value={selectedFoundationType}
                                onChange={e => setSelectedFoundationType(e.target.value as any)}
                                className="flex-1 px-3 py-1.5 text-sm border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-400 bg-white"
                              >
                                {FOUNDATION_TYPES.map(ft => (
                                  <option key={ft.value} value={ft.value}>{ft.label}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                autoFocus
                                type="text"
                                placeholder="Nome da sub-etapa (ex: Almoxarifado, Limpeza de terreno...)"
                                value={newSubEtapaName}
                                onChange={e => setNewSubEtapaName(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') addSubEtapa(wbs.id);
                                  if (e.key === 'Escape') { setAddingSubEtapa(null); setNewSubEtapaName(''); }
                                }}
                                className="flex-1 px-3 py-1.5 text-sm border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-400 bg-white"
                              />
                            )}
                            <button
                              onClick={() => addSubEtapa(wbs.id)}
                              disabled={!wbs.is_parametric && !newSubEtapaName.trim()}
                              className="px-3 py-1.5 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 disabled:opacity-40 transition-colors"
                            >
                              Adicionar
                            </button>
                            <button
                              onClick={() => { setAddingSubEtapa(null); setNewSubEtapaName(''); }}
                              className="px-3 py-1.5 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => { setAddingSubEtapa(wbs.id); setNewSubEtapaName(''); }}
                                className="flex items-center gap-1 text-xs text-gray-500 hover:text-orange-600 font-medium transition-colors"
                              >
                                <Plus className="w-3.5 h-3.5" /> Adicionar sub-etapa
                              </button>
                              <span className="text-gray-300 text-xs">|</span>
                              <button
                                onClick={() => openItemModal(wbs.id)}
                                className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 font-medium transition-colors"
                              >
                                <Package className="w-3.5 h-3.5" /> Adicionar item
                              </button>
                            </div>
                            {stepTotal > 0 && (
                              <span className="text-sm font-bold text-blue-700">
                                Total {wbs.name}: {fmtBRL(stepTotal)}
                              </span>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {wbsSteps.length === 0 && (
            <div className="text-center py-14 border-2 border-dashed border-gray-200 rounded-xl">
              <GitBranch className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium mb-1">Nenhuma etapa cadastrada</p>
              <p className="text-gray-400 text-sm mb-4">
                Crie etapas (ex: Fundacao, Estrutura, Cobertura) para depois adicionar sub-etapas.
              </p>
              <button
                onClick={() => { setAddingWbs(true); setNewWbsName(''); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
              >
                <Plus className="w-4 h-4" /> Criar Primeira Etapa
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
