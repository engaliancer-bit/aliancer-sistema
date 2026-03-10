import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, Search, Package, Layers, Wrench, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { Budget, WBSStep, BudgetItem, ItemType, fmtBRL } from './types';

interface Props {
  budget: Budget;
  wbsSteps: WBSStep[];
  onRefresh: () => void;
}

interface Material { id: string; name: string; unit: string; resale_price: number | null; unit_cost: number | null; }
interface Product  { id: string; name: string; unit: string; sale_price: number; final_sale_price: number | null; }
interface Comp     { id: string; name: string; description: string | null; total_cost: number | null; }

const ITEM_TYPE_CONFIG: Record<ItemType, { label: string; color: string; bg: string; icon: React.ComponentType<any> }> = {
  composicao: { label: 'Composicao', color: 'text-blue-700',   bg: 'bg-blue-100',   icon: Layers },
  material:   { label: 'Insumo',     color: 'text-amber-700',  bg: 'bg-amber-100',  icon: Package },
  produto:    { label: 'Produto',    color: 'text-green-700',  bg: 'bg-green-100',  icon: Package },
  servico:    { label: 'Servico',    color: 'text-slate-700',  bg: 'bg-slate-100',  icon: Wrench },
};

const emptyForm = {
  wbs_step_id: '',
  item_type: 'material' as ItemType,
  material_id: '',
  product_id: '',
  composition_id: '',
  description: '',
  unit: 'un',
  quantity: 1,
  unit_price: 0,
  notes: '',
};

export default function BudgetItemsPanel({ budget, wbsSteps, onRefresh }: Props) {
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [compositions, setCompositions] = useState<Comp[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [matSearch, setMatSearch] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [itemsRes, matsRes, prodsRes, compsRes] = await Promise.all([
      supabase.from('budget_items')
        .select('id,budget_id,wbs_step_id,item_type,material_id,product_id,composition_id,description,unit,quantity,unit_price,notes,sort_order,created_at')
        .eq('budget_id', budget.id)
        .limit(1000)
        .order('sort_order'),
      supabase.from('materials')
        .select('id,name,unit,resale_price,unit_cost')
        .order('name')
        .limit(500),
      supabase.from('products')
        .select('id,name,unit,sale_price,final_sale_price')
        .order('name')
        .limit(500),
      supabase.from('compositions')
        .select('id,name,description,total_cost')
        .order('name')
        .limit(500),
    ]);
    setItems(itemsRes.data || []);
    setMaterials(matsRes.data || []);
    setProducts(prodsRes.data || []);
    setCompositions(compsRes.data || []);
    setLoading(false);
  }, [budget.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const filteredMats = useMemo(() => {
    if (!matSearch) return materials.slice(0, 50);
    return materials.filter(m => m.name.toLowerCase().includes(matSearch.toLowerCase())).slice(0, 50);
  }, [materials, matSearch]);

  const filteredProds = useMemo(() => {
    if (!matSearch) return products.slice(0, 50);
    return products.filter(p => p.name.toLowerCase().includes(matSearch.toLowerCase())).slice(0, 50);
  }, [products, matSearch]);

  const handleTypeChange = (t: ItemType) => {
    setForm(f => ({ ...f, item_type: t, material_id: '', product_id: '', composition_id: '', description: '', unit: 'un', unit_price: 0 }));
    setMatSearch('');
  };

  const handleSelectMaterial = (m: Material) => {
    const price = m.resale_price ?? m.unit_cost ?? 0;
    setForm(f => ({ ...f, material_id: m.id, description: m.name, unit: m.unit, unit_price: price }));
    setMatSearch(m.name);
  };

  const handleSelectProduct = (p: Product) => {
    const price = p.final_sale_price ?? p.sale_price ?? 0;
    setForm(f => ({ ...f, product_id: p.id, description: p.name, unit: p.unit, unit_price: price }));
    setMatSearch(p.name);
  };

  const filteredComps = useMemo(() => {
    if (!matSearch) return compositions.slice(0, 50);
    return compositions.filter(c => c.name.toLowerCase().includes(matSearch.toLowerCase())).slice(0, 50);
  }, [compositions, matSearch]);

  const handleSelectComposition = (c: Comp) => {
    setForm(f => ({ ...f, composition_id: c.id, description: c.name, unit: 'un', unit_price: c.total_cost ?? 0 }));
    setMatSearch(c.name);
  };

  const bdiPreview = useMemo(() => {
    const base = form.quantity * form.unit_price;
    const bdi = base * (budget.bdi_percent / 100);
    return { base, bdi, total: base + bdi };
  }, [form.quantity, form.unit_price, budget.bdi_percent]);

  const save = async () => {
    if (!form.description || form.unit_price < 0) return;
    setSaving(true);
    const maxOrder = items.reduce((acc, i) => Math.max(acc, i.sort_order || 0), 0);
    await supabase.from('budget_items').insert({
      budget_id: budget.id,
      wbs_step_id: form.wbs_step_id || null,
      item_type: form.item_type,
      material_id: form.material_id || null,
      product_id: form.product_id || null,
      composition_id: form.composition_id || null,
      description: form.description,
      unit: form.unit,
      quantity: form.quantity,
      unit_price: form.unit_price,
      notes: form.notes || null,
      sort_order: maxOrder + 1,
    });
    setShowForm(false);
    setForm(emptyForm);
    setMatSearch('');
    await loadAll();
    onRefresh();
    setSaving(false);
  };

  const deleteItem = async (id: string) => {
    await supabase.from('budget_items').delete().eq('id', id);
    await loadAll();
    onRefresh();
  };

  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = items.filter(i => !q || i.description.toLowerCase().includes(q));
    const map: Record<string, BudgetItem[]> = { '__none__': [] };
    wbsSteps.forEach(s => { map[s.id] = []; });
    filtered.forEach(i => {
      const key = i.wbs_step_id || '__none__';
      if (!map[key]) map[key] = [];
      map[key].push(i);
    });
    return map;
  }, [items, wbsSteps, search]);

  const grandTotal = useMemo(() => items.reduce((s, i) => s + (i.final_price || 0), 0), [items]);

  const toggleExpand = (key: string) => setExpanded(p => ({ ...p, [key]: !p[key] }));

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-gray-400">
      <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mr-2" />
      Carregando itens...
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filtrar itens..."
            className="pl-9 pr-3 py-2 w-full border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none" />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {items.length} item{items.length !== 1 ? 's' : ''} &middot; <span className="font-semibold text-orange-600">{fmtBRL(grandTotal)}</span>
          </span>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors">
            <Plus className="w-4 h-4" /> Adicionar Item
          </button>
        </div>
      </div>

      {/* Add form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Adicionar Item ao Orcamento</h3>
              <p className="text-sm text-gray-500 mt-0.5">Insumos e Produtos buscados do catalogo existente</p>
            </div>
            <div className="p-6 space-y-5">
              {/* WBS */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Etapa WBS</label>
                <select value={form.wbs_step_id} onChange={e => setForm(f => ({ ...f, wbs_step_id: e.target.value }))}
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
                          form.item_type === t ? `border-orange-400 ${cfg.bg} ${cfg.color}` : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}>
                        <Icon className="w-4 h-4" />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Source picker */}
              {(form.item_type === 'material' || form.item_type === 'produto' || form.item_type === 'composicao') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {form.item_type === 'material' ? 'Insumo' : form.item_type === 'produto' ? 'Produto' : 'Composicao'}
                  </label>
                  <div className="flex gap-2 mb-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input value={matSearch} onChange={e => setMatSearch(e.target.value)}
                        placeholder={`Buscar ${form.item_type === 'material' ? 'insumo' : form.item_type === 'produto' ? 'produto' : 'composicao'}...`}
                        className="pl-8 pr-3 py-2 w-full border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 outline-none" />
                    </div>
                  </div>
                  <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-gray-100">
                    {form.item_type === 'material' && filteredMats.map(m => (
                      <button key={m.id} onClick={() => handleSelectMaterial(m)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-orange-50 transition-colors ${form.material_id === m.id ? 'bg-orange-50 text-orange-700 font-medium' : 'text-gray-700'}`}>
                        <span>{m.name}</span>
                        <span className="text-xs text-gray-400">{fmtBRL(m.resale_price ?? m.unit_cost ?? 0)}/{m.unit}</span>
                      </button>
                    ))}
                    {form.item_type === 'produto' && filteredProds.map(p => (
                      <button key={p.id} onClick={() => handleSelectProduct(p)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-orange-50 transition-colors ${form.product_id === p.id ? 'bg-orange-50 text-orange-700 font-medium' : 'text-gray-700'}`}>
                        <span>{p.name}</span>
                        <span className="text-xs text-gray-400">{fmtBRL(p.final_sale_price ?? p.sale_price ?? 0)}/{p.unit}</span>
                      </button>
                    ))}
                    {form.item_type === 'composicao' && filteredComps.map(c => (
                      <button key={c.id} onClick={() => handleSelectComposition(c)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-orange-50 transition-colors ${form.composition_id === c.id ? 'bg-orange-50 text-orange-700 font-medium' : 'text-gray-700'}`}>
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
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Descricao do item..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none" />
              </div>

              {/* Qty + Unit + Price */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantidade</label>
                  <input type="number" value={form.quantity} min={0} step={0.001}
                    onChange={e => setForm(f => ({ ...f, quantity: parseFloat(e.target.value) || 0 }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Unidade</label>
                  <input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Preco Unit. (R$)</label>
                  <input type="number" value={form.unit_price} min={0} step={0.01}
                    onChange={e => setForm(f => ({ ...f, unit_price: parseFloat(e.target.value) || 0 }))}
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
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none resize-none" />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => { setShowForm(false); setForm(emptyForm); setMatSearch(''); }}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={save} disabled={saving || !form.description}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors">
                {saving ? 'Salvando...' : 'Adicionar Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Items grouped by WBS */}
      {items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum item adicionado</p>
          <p className="text-sm mt-1">Use o botao acima para adicionar insumos, produtos, composicoes ou servicos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {wbsSteps.map(step => {
            const stepItems = grouped[step.id] || [];
            if (stepItems.length === 0) return null;
            const subtotal = stepItems.reduce((s, i) => s + (i.final_price || 0), 0);
            const isOpen = expanded[step.id] !== false;
            return (
              <div key={step.id} className="border border-gray-200 rounded-xl overflow-hidden">
                <button onClick={() => toggleExpand(step.id)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
                  <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <span className="font-mono text-xs text-gray-500 bg-white border border-gray-200 px-1.5 py-0.5 rounded">{step.code}</span>
                    <span className="font-medium text-gray-700 text-sm">{step.name}</span>
                    <span className="text-xs text-gray-400">({stepItems.length} item{stepItems.length !== 1 ? 's' : ''})</span>
                  </div>
                  <span className="font-semibold text-gray-700 text-sm">{fmtBRL(subtotal)}</span>
                </button>
                {isOpen && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50/50 border-b border-gray-100">
                          <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Descricao</th>
                          <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 w-24">Tipo</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 w-20">Qtd</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 w-28">P. Unit.</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 w-28">Base</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 w-28">BDI</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 w-28">Total</th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {stepItems.map(item => {
                          const cfg = ITEM_TYPE_CONFIG[item.item_type];
                          const Icon = cfg.icon;
                          return (
                            <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-4 py-3 text-gray-800">{item.description}</td>
                              <td className="px-3 py-3 text-center">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                                  <Icon className="w-3 h-3" />{cfg.label}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-right text-gray-600">{item.quantity} {item.unit}</td>
                              <td className="px-3 py-3 text-right text-gray-600">{fmtBRL(item.unit_price)}</td>
                              <td className="px-3 py-3 text-right text-gray-600">{fmtBRL(item.total_price)}</td>
                              <td className="px-3 py-3 text-right text-amber-600">+{fmtBRL(item.bdi_value)}</td>
                              <td className="px-3 py-3 text-right font-semibold text-gray-800">{fmtBRL(item.final_price)}</td>
                              <td className="px-3 py-3 text-center">
                                <button onClick={() => deleteItem(item.id)}
                                  className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 border-t border-gray-200">
                          <td colSpan={4} className="px-4 py-2 text-xs text-gray-500 font-medium">Subtotal {step.name}</td>
                          <td className="px-3 py-2 text-right text-xs font-medium text-gray-600">
                            {fmtBRL(stepItems.reduce((s, i) => s + i.total_price, 0))}
                          </td>
                          <td className="px-3 py-2 text-right text-xs font-medium text-amber-600">
                            +{fmtBRL(stepItems.reduce((s, i) => s + i.bdi_value, 0))}
                          </td>
                          <td className="px-3 py-2 text-right text-sm font-bold text-orange-600">{fmtBRL(subtotal)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            );
          })}

          {/* Sem etapa */}
          {(grouped['__none__'] || []).length > 0 && (() => {
            const noStepItems = grouped['__none__'];
            const subtotal = noStepItems.reduce((s, i) => s + (i.final_price || 0), 0);
            const isOpen = expanded['__none__'] !== false;
            return (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <button onClick={() => toggleExpand('__none__')}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
                  <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <span className="font-medium text-gray-500 text-sm">Sem Etapa WBS</span>
                    <span className="text-xs text-gray-400">({noStepItems.length} item{noStepItems.length !== 1 ? 's' : ''})</span>
                  </div>
                  <span className="font-semibold text-gray-700 text-sm">{fmtBRL(subtotal)}</span>
                </button>
                {isOpen && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-gray-100">
                        {noStepItems.map(item => {
                          const cfg = ITEM_TYPE_CONFIG[item.item_type];
                          const Icon = cfg.icon;
                          return (
                            <tr key={item.id} className="hover:bg-gray-50/50">
                              <td className="px-4 py-3 text-gray-800">{item.description}</td>
                              <td className="px-3 py-3 text-center">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                                  <Icon className="w-3 h-3" />{cfg.label}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-right text-gray-600">{item.quantity} {item.unit}</td>
                              <td className="px-3 py-3 text-right font-semibold text-gray-800">{fmtBRL(item.final_price)}</td>
                              <td className="px-3 py-3 text-center">
                                <button onClick={() => deleteItem(item.id)}
                                  className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Grand total */}
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-700">Total Geral do Orcamento</p>
              <p className="text-xs text-gray-400 mt-0.5">Base + BDI ({budget.bdi_percent}%)</p>
            </div>
            <p className="text-2xl font-bold text-orange-600">{fmtBRL(grandTotal)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
