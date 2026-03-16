import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Plus, Edit2, Trash2, ChevronDown, ChevronRight, X, Save,
  AlertCircle, Search, Settings, Package, Droplet, Hammer
} from 'lucide-react';
import { Composition, CompositionItem, fmtBRL } from './types';

interface Material { id: string; name: string; unit: string; resale_price: number | null; unit_cost: number | null; package_size: number | null; }
interface Product { id: string; name: string; unit: string; sale_price: number; final_sale_price: number | null; }

const ITEM_TYPE_CONFIG = {
  material:     { label: 'Insumo',      icon: Droplet, color: 'text-amber-700 bg-amber-100' },
  produto:      { label: 'Produto',     icon: Package, color: 'text-green-700 bg-green-100' },
  mao_de_obra:  { label: 'Mao de Obra', icon: Hammer,  color: 'text-blue-700 bg-blue-100' },
  equipamento:  { label: 'Equipamento', icon: Settings, color: 'text-gray-700 bg-gray-100' },
};

export default function BudgetCompositionsPanel() {
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [compItems, setCompItems] = useState<Record<string, CompositionItem[]>>({});
  const [materials, setMaterials] = useState<Material[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [showCompForm, setShowCompForm] = useState(false);
  const [editingComp, setEditingComp] = useState<Composition | null>(null);
  const [showItemForm, setShowItemForm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [compForm, setCompForm] = useState({ code: '', name: '', description: '', unit: 'm2', element_type: '' });
  const [itemForm, setItemForm] = useState({
    item_type: 'material' as 'material' | 'produto' | 'mao_de_obra' | 'equipamento',
    material_id: '', product_id: '', description: '', unit: 'un', coefficient: 1, unit_price: 0,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: comps }, { data: mats }, { data: prods }] = await Promise.all([
      supabase.from('budget_compositions').select('*').order('code'),
      supabase.from('materials').select('id,name,unit,resale_price,unit_cost,package_size').order('name'),
      supabase.from('products').select('id,name,unit,sale_price,final_sale_price').order('name'),
    ]);
    setCompositions(comps || []);
    setMaterials(mats || []);
    setProducts(prods || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadItems = useCallback(async (compId: string) => {
    const { data } = await supabase.from('budget_composition_items')
      .select('*, materials(id,name,unit,resale_price,unit_cost), products(id,name,unit,sale_price,final_sale_price)')
      .eq('composition_id', compId).order('created_at');
    setCompItems(prev => ({ ...prev, [compId]: data || [] }));
  }, []);

  const toggleExpand = async (id: string) => {
    const s = new Set(expanded);
    if (s.has(id)) { s.delete(id); } else { s.add(id); await loadItems(id); }
    setExpanded(s);
  };

  const filtered = useMemo(() => compositions.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
  }), [compositions, search]);

  const saveComp = async () => {
    if (!compForm.code.trim() || !compForm.name.trim()) { setError('Codigo e nome obrigatorios'); return; }
    setSaving(true); setError(null);
    try {
      const payload = { code: compForm.code.trim(), name: compForm.name.trim(), description: compForm.description || null, unit: compForm.unit, element_type: compForm.element_type || null };
      if (editingComp) {
        await supabase.from('budget_compositions').update(payload).eq('id', editingComp.id);
      } else {
        await supabase.from('budget_compositions').insert([payload]);
      }
      await load(); setShowCompForm(false);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const delComp = async (c: Composition) => {
    if (!confirm(`Excluir composicao "${c.name}"?`)) return;
    await supabase.from('budget_compositions').delete().eq('id', c.id);
    await load();
  };

  const calcMaterialUnitPrice = (m: Material): number => {
    const raw = m.resale_price ?? m.unit_cost ?? 0;
    const pkg = m.package_size ?? 1;
    return pkg > 1 ? raw / pkg : raw;
  };

  const handleMaterialSelect = (id: string) => {
    const m = materials.find(m => m.id === id);
    if (m) setItemForm(p => ({ ...p, material_id: id, description: m.name, unit: m.unit, unit_price: calcMaterialUnitPrice(m) }));
  };

  const handleProductSelect = (id: string) => {
    const p = products.find(p => p.id === id);
    if (p) setItemForm(prev => ({ ...prev, product_id: id, description: p.name, unit: p.unit, unit_price: p.final_sale_price || p.sale_price || 0 }));
  };

  const saveItem = async () => {
    if (!showItemForm) return;
    setSaving(true); setError(null);
    try {
      const payload: any = {
        composition_id: showItemForm, item_type: itemForm.item_type,
        unit: itemForm.unit, coefficient: itemForm.coefficient, unit_price: itemForm.unit_price,
        material_id: null, product_id: null, description: null,
      };
      if (itemForm.item_type === 'material' && itemForm.material_id) payload.material_id = itemForm.material_id;
      else if (itemForm.item_type === 'produto' && itemForm.product_id) payload.product_id = itemForm.product_id;
      else payload.description = itemForm.description;

      await supabase.from('budget_composition_items').insert([payload]);
      await loadItems(showItemForm);
      setShowItemForm(null);
      setItemForm({ item_type: 'material', material_id: '', product_id: '', description: '', unit: 'un', coefficient: 1, unit_price: 0 });
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const delItem = async (compId: string, itemId: string) => {
    if (!confirm('Excluir este item da composicao?')) return;
    await supabase.from('budget_composition_items').delete().eq('id', itemId);
    await loadItems(compId);
  };

  const compCost = (compId: string) => {
    const items = compItems[compId] || [];
    return items.reduce((s, i) => s + i.coefficient * i.unit_price, 0);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar composicao..."
            className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
        </div>
        <button onClick={() => { setEditingComp(null); setCompForm({ code: '', name: '', description: '', unit: 'm2', element_type: '' }); setShowCompForm(true); }}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 shadow-sm">
          <Plus className="w-4 h-4" /> Nova Composicao
        </button>
      </div>

      <p className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
        Composicoes definem o consumo de insumos e produtos por unidade de servico.
        Os precos sao buscados diretamente do cadastro de Insumos e Produtos da Industria.
      </p>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(comp => {
            const isOpen = expanded.has(comp.id);
            const items = compItems[comp.id] || [];
            const totalCost = compCost(comp.id);

            return (
              <div key={comp.id} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <button onClick={() => toggleExpand(comp.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded flex-shrink-0">{comp.code}</span>
                    <span className="font-medium text-gray-800 text-sm truncate">{comp.name}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">/{comp.unit}</span>
                  </button>
                  <div className="flex items-center gap-3">
                    {isOpen && totalCost > 0 && (
                      <span className="text-sm font-semibold text-green-600">{fmtBRL(totalCost)}/{comp.unit}</span>
                    )}
                    <button onClick={() => { setEditingComp(comp); setCompForm({ code: comp.code, name: comp.name, description: comp.description || '', unit: comp.unit, element_type: comp.element_type || '' }); setShowCompForm(true); }}
                      className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => delComp(comp)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100 bg-gray-50/50">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left text-gray-500 font-medium">Tipo</th>
                          <th className="px-4 py-2 text-left text-gray-500 font-medium">Descricao</th>
                          <th className="px-4 py-2 text-right text-gray-500 font-medium">Coef.</th>
                          <th className="px-4 py-2 text-right text-gray-500 font-medium">Un.</th>
                          <th className="px-4 py-2 text-right text-gray-500 font-medium">Preco Unit.</th>
                          <th className="px-4 py-2 text-right text-gray-500 font-medium">Parcial</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {items.map(item => {
                          const tc = ITEM_TYPE_CONFIG[item.item_type];
                          const TypeIcon = tc.icon;
                          const name = item.materials?.name || item.products?.name || item.description || '-';
                          return (
                            <tr key={item.id} className="hover:bg-white">
                              <td className="px-4 py-2">
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${tc.color}`}>
                                  <TypeIcon className="w-3 h-3" />{tc.label}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-gray-700">{name}</td>
                              <td className="px-4 py-2 text-right text-gray-600">{item.coefficient}</td>
                              <td className="px-4 py-2 text-right text-gray-500">{item.unit}</td>
                              <td className="px-4 py-2 text-right text-gray-600">{fmtBRL(item.unit_price)}</td>
                              <td className="px-4 py-2 text-right font-semibold text-gray-700">
                                {fmtBRL(item.coefficient * item.unit_price)}
                              </td>
                              <td className="px-3 py-2">
                                <button onClick={() => delItem(comp.id, item.id)} className="p-0.5 text-gray-300 hover:text-red-500">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {items.length === 0 && (
                          <tr><td colSpan={7} className="px-4 py-4 text-center text-gray-400">Nenhum item. Adicione abaixo.</td></tr>
                        )}
                      </tbody>
                      {items.length > 0 && (
                        <tfoot className="bg-gray-100">
                          <tr>
                            <td colSpan={5} className="px-4 py-2 text-right font-semibold text-gray-700">Custo Total/{comp.unit}</td>
                            <td className="px-4 py-2 text-right font-bold text-green-600">{fmtBRL(totalCost)}</td>
                            <td />
                          </tr>
                        </tfoot>
                      )}
                    </table>
                    <div className="px-4 py-3">
                      <button onClick={() => { setShowItemForm(comp.id); setItemForm({ item_type: 'material', material_id: '', product_id: '', description: '', unit: 'un', coefficient: 1, unit_price: 0 }); }}
                        className="flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-700 font-medium">
                        <Plus className="w-3.5 h-3.5" /> Adicionar Item
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Composicao */}
      {showCompForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-bold text-gray-900">{editingComp ? 'Editar Composicao' : 'Nova Composicao'}</h3>
              <button onClick={() => setShowCompForm(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {error && <div className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Codigo *</label>
                  <input value={compForm.code} onChange={e => setCompForm(p => ({ ...p, code: e.target.value }))}
                    placeholder="COMP-026" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Unidade</label>
                  <input value={compForm.unit} onChange={e => setCompForm(p => ({ ...p, unit: e.target.value }))}
                    placeholder="m2, m3, un..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Nome *</label>
                <input value={compForm.name} onChange={e => setCompForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Alvenaria Bloco Ceramico 9x19x19" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Descricao</label>
                <textarea value={compForm.description} onChange={e => setCompForm(p => ({ ...p, description: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none" />
              </div>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={() => setShowCompForm(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm">Cancelar</button>
              <button onClick={saveComp} disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Item */}
      {showItemForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-bold text-gray-900">Adicionar Item a Composicao</h3>
              <button onClick={() => setShowItemForm(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {error && <div className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>}
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Tipo</label>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.entries(ITEM_TYPE_CONFIG) as [string, typeof ITEM_TYPE_CONFIG['material']][]).map(([k, v]) => {
                    const Icon = v.icon;
                    return (
                      <button key={k} type="button"
                        onClick={() => setItemForm(p => ({ ...p, item_type: k as any, material_id: '', product_id: '', description: '' }))}
                        className={`p-2 rounded-lg border text-xs flex flex-col items-center gap-0.5 ${
                          itemForm.item_type === k ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-500'}`}>
                        <Icon className="w-4 h-4" />{v.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {itemForm.item_type === 'material' && (
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Insumo</label>
                  <select value={itemForm.material_id} onChange={e => handleMaterialSelect(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="">Selecione...</option>
                    {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit}) - {fmtBRL(calcMaterialUnitPrice(m))}/{m.unit}</option>)}
                  </select>
                </div>
              )}

              {itemForm.item_type === 'produto' && (
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Produto</label>
                  <select value={itemForm.product_id} onChange={e => handleProductSelect(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="">Selecione...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit}) - {fmtBRL(p.final_sale_price || p.sale_price)}</option>)}
                  </select>
                </div>
              )}

              {(itemForm.item_type === 'mao_de_obra' || itemForm.item_type === 'equipamento') && (
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Descricao</label>
                  <input value={itemForm.description} onChange={e => setItemForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Ex: Pedreiro, Oficial, Retroescavadeira..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Coeficiente</label>
                  <input type="number" value={itemForm.coefficient} step="0.001" min="0"
                    onChange={e => setItemForm(p => ({ ...p, coefficient: +e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Unidade</label>
                  <input value={itemForm.unit} onChange={e => setItemForm(p => ({ ...p, unit: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Preco Unit. (R$)</label>
                  <input type="number" value={itemForm.unit_price} step="0.01" min="0"
                    onChange={e => setItemForm(p => ({ ...p, unit_price: +e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center text-sm">
                <span className="text-gray-500">Custo parcial: </span>
                <span className="font-bold text-green-600">{fmtBRL(itemForm.coefficient * itemForm.unit_price)}</span>
              </div>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={() => setShowItemForm(null)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm">Cancelar</button>
              <button onClick={saveItem} disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
