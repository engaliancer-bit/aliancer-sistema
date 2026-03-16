import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Save, Trash2, Search, ChevronDown, ChevronUp, Beaker, Layers, Zap, Package, Info, Edit2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { GLOBAL_PARAM_PRESETS } from './types';

interface MaterialOption {
  id: string;
  name: string;
  unit: string;
  resale_price: number | null;
  unit_cost: number | null;
  package_size: number | null;
}

interface RecipeOption {
  id: string;
  name: string;
  concrete_type: string | null;
  specific_weight: number | null;
}

interface GlobalParam {
  id: string;
  param_key: string;
  param_label: string;
  param_category: string;
  material_id: string | null;
  recipe_id: string | null;
  unit_price: number;
  value_text: string | null;
  notes: string | null;
  sort_order: number;
  materials?: { id: string; name: string; unit: string; resale_price: number | null; unit_cost: number | null };
  recipes?: { id: string; name: string; concrete_type: string | null; specific_weight: number | null };
}

interface ParamForm {
  id?: string;
  param_key: string;
  param_label: string;
  param_category: string;
  material_id: string;
  recipe_id: string;
  unit_price: string;
  value_text: string;
  notes: string;
  sort_order: number;
}

const RECIPE_TYPE_LABELS: Record<string, string> = {
  dry: 'Concreto Seco (TCS)',
  plastic: 'Concreto Plastico (TCP)',
  argamassa_assentamento: 'Argamassa Assentamento',
  argamassa_reboco: 'Argamassa Reboco',
  argamassa_emboco: 'Argamassa Emboco',
  argamassa_chapisco: 'Argamassa Chapisco',
  argamassa_contrapiso: 'Argamassa Contrapiso',
};

const CONCRETE_TYPES = ['dry', 'plastic'];
const MORTAR_TYPES = ['argamassa_assentamento', 'argamassa_reboco', 'argamassa_emboco', 'argamassa_chapisco', 'argamassa_contrapiso'];

function recipeMatchesCategory(recipe: RecipeOption, category: string): boolean {
  if (!recipe.concrete_type) return true;
  if (category === 'concreto') return CONCRETE_TYPES.includes(recipe.concrete_type);
  if (category === 'argamassa') return MORTAR_TYPES.includes(recipe.concrete_type);
  return true;
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof Beaker; color: string; bg: string; border: string }> = {
  concreto:       { label: 'Tracos de Concreto',   icon: Beaker,  color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  argamassa:      { label: 'Tracos de Argamassa',  icon: Layers,  color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  aco:            { label: 'Aco / Armadura',        icon: Zap,     color: 'text-gray-700',   bg: 'bg-gray-50',   border: 'border-gray-200' },
  insumos_gerais: { label: 'Insumos Recorrentes',   icon: Package, color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
};

const ALL_CATEGORIES = ['concreto', 'argamassa', 'aco', 'insumos_gerais'];

const emptyForm = (): ParamForm => ({
  param_key: '', param_label: '', param_category: 'insumos_gerais',
  material_id: '', recipe_id: '', unit_price: '', value_text: '', notes: '', sort_order: 0,
});

function calcUnitPrice(m: MaterialOption): number {
  const raw = m.resale_price ?? m.unit_cost ?? 0;
  const pkg = m.package_size ?? 1;
  return pkg > 1 ? raw / pkg : raw;
}

function fmtBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

export default function GlobalParamsPanel() {
  const [params, setParams] = useState<GlobalParam[]>([]);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [recipes, setRecipes] = useState<RecipeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(ALL_CATEGORIES));
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ParamForm>(emptyForm());
  const [matSearch, setMatSearch] = useState('');
  const [showMatDropdown, setShowMatDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('global_params')
      .select('*, materials(id,name,unit,resale_price,unit_cost), recipes(id,name,concrete_type,specific_weight)')
      .order('sort_order');
    setParams(data || []);
    setLoading(false);
  }, []);

  const loadMaterials = useCallback(async () => {
    const { data } = await supabase
      .from('materials')
      .select('id,name,unit,resale_price,unit_cost,package_size')
      .order('name')
      .limit(500);
    setMaterials(data || []);
  }, []);

  const loadRecipes = useCallback(async () => {
    const { data } = await supabase
      .from('recipes')
      .select('id,name,concrete_type,specific_weight')
      .order('name')
      .limit(200);
    setRecipes(data || []);
  }, []);

  useEffect(() => { load(); loadMaterials(); loadRecipes(); }, [load, loadMaterials, loadRecipes]);

  const grouped = useMemo(() => {
    const map: Record<string, GlobalParam[]> = {};
    params.forEach(p => {
      if (!map[p.param_category]) map[p.param_category] = [];
      map[p.param_category].push(p);
    });
    return map;
  }, [params]);

  const filteredMats = useMemo(() => {
    const q = matSearch.toLowerCase();
    return materials.filter(m => m.name.toLowerCase().includes(q)).slice(0, 30);
  }, [materials, matSearch]);

  const toggleCat = (cat: string) => setExpandedCats(prev => {
    const s = new Set(prev);
    s.has(cat) ? s.delete(cat) : s.add(cat);
    return s;
  });

  const openAdd = (category = 'insumos_gerais', preset?: typeof GLOBAL_PARAM_PRESETS[0]) => {
    const f = emptyForm();
    f.param_category = category;
    if (preset) { f.param_key = preset.key; f.param_label = preset.label; }
    f.sort_order = params.filter(p => p.param_category === category).length;
    setForm(f);
    setEditingId(null);
    setShowAddForm(true);
    setMatSearch('');
    setError(null);
  };

  const openEdit = (p: GlobalParam) => {
    setForm({
      id: p.id,
      param_key: p.param_key,
      param_label: p.param_label,
      param_category: p.param_category,
      material_id: p.material_id || '',
      recipe_id: p.recipe_id || '',
      unit_price: p.unit_price ? String(p.unit_price) : '',
      value_text: p.value_text || '',
      notes: p.notes || '',
      sort_order: p.sort_order,
    });
    setEditingId(p.id);
    setMatSearch(p.materials?.name || '');
    setShowAddForm(true);
    setError(null);
  };

  const selectMaterial = (m: MaterialOption) => {
    const price = calcUnitPrice(m);
    setForm(f => ({ ...f, material_id: m.id, unit_price: String(price) }));
    setMatSearch(m.name);
    setShowMatDropdown(false);
  };

  const clearMaterial = () => {
    setForm(f => ({ ...f, material_id: '', unit_price: '' }));
    setMatSearch('');
  };

  const save = async () => {
    if (!form.param_label.trim()) { setError('Descricao obrigatoria'); return; }
    setSaving(true); setError(null);
    try {
      const payload = {
        param_key: form.param_key || form.param_label.toLowerCase().replace(/\s+/g, '_'),
        param_label: form.param_label.trim(),
        param_category: form.param_category,
        material_id: form.material_id || null,
        recipe_id: form.recipe_id || null,
        unit_price: parseFloat(form.unit_price) || 0,
        value_text: form.value_text.trim() || null,
        notes: form.notes.trim() || null,
        sort_order: form.sort_order,
      };
      if (editingId) {
        const { error: err } = await supabase.from('global_params').update(payload).eq('id', editingId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('global_params').insert([payload]);
        if (err) throw err;
      }
      await load();
      setShowAddForm(false);
      setEditingId(null);
      setForm(emptyForm());
      setMatSearch('');
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const del = async (id: string, label: string) => {
    if (!window.confirm(`Remover parametro "${label}"?\nEle sera desvinculado de todos os orcamentos.`)) return;
    await supabase.from('global_params').delete().eq('id', id);
    await load();
  };

  const addPreset = (preset: typeof GLOBAL_PARAM_PRESETS[0]) => {
    const exists = params.find(p => p.param_key === preset.key);
    if (exists) { openEdit(exists); return; }
    openAdd(preset.category, preset);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Catalogo de Parametros</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Parametros do escritorio reutilizaveis em qualquer obra. Tracos padrao, tipos de aco e insumos recorrentes.
            Cada orcamento pode selecionar quais parametros deseja aplicar.
          </p>
        </div>
        <button
          onClick={() => openAdd()}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"
        >
          <Plus className="w-4 h-4" />
          Novo Parametro
        </button>
      </div>

      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
        <strong>Como usar:</strong> Crie aqui os parametros padrao do escritorio (tracos, tipos de aco, insumos).
        Ao abrir um orcamento, va em <strong>Parametros da Obra</strong> para selecionar quais desses parametros se aplicam a aquela obra.
        Voce pode criar quantos parametros novos precisar — para diferentes especificacoes de aco ou tracos alternativos.
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {ALL_CATEGORIES.map(cat => {
            const cfg = CATEGORY_CONFIG[cat];
            const Icon = cfg.icon;
            const presets = GLOBAL_PARAM_PRESETS.filter(p => p.category === cat);
            const existing = grouped[cat] || [];
            const isExpanded = expandedCats.has(cat);

            return (
              <div key={cat} className={`rounded-xl border ${cfg.border} overflow-hidden`}>
                <button
                  onClick={() => toggleCat(cat)}
                  className={`w-full flex items-center justify-between px-4 py-3 ${cfg.bg} hover:opacity-90`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                    <span className={`font-semibold text-sm ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-xs bg-white/70 text-gray-600 rounded-full px-2 py-0.5 font-medium">
                      {existing.length} {existing.length === 1 ? 'parametro' : 'parametros'}
                    </span>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>

                {isExpanded && (
                  <div className="divide-y divide-gray-100">
                    {cat !== 'insumos_gerais' && presets.length > 0 && (
                      <div className="px-4 py-3 bg-gray-50/50">
                        <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Presets rapidos:</p>
                        <div className="flex flex-wrap gap-2">
                          {presets.map(preset => {
                            const isSet = params.some(p => p.param_key === preset.key);
                            return (
                              <button
                                key={preset.key}
                                onClick={() => addPreset(preset)}
                                className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                                  isSet
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                                    : 'bg-white border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-700'
                                }`}
                              >
                                {isSet && '✓ '}
                                {preset.label.replace(/^(Traco Concreto - |Traco Argamassa - |Aco para )/, '')}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {existing.map(p => (
                      <div key={p.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-gray-900">{p.param_label}</span>
                            {p.recipes && (
                              <span className="text-xs bg-cyan-50 text-cyan-700 border border-cyan-200 rounded px-1.5 py-0.5 flex items-center gap-1">
                                <Beaker className="w-3 h-3" />
                                {p.recipes.name}
                                {p.recipes.specific_weight && (
                                  <span className="text-cyan-500 ml-1">· {p.recipes.specific_weight} kg/m³</span>
                                )}
                              </span>
                            )}
                            {!p.recipes && p.materials && (
                              <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5">
                                {p.materials.name}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            {!p.recipes && p.value_text && (
                              <span className="text-xs text-gray-500">
                                Traco: <span className="font-medium text-gray-700">{p.value_text}</span>
                              </span>
                            )}
                            {p.recipes?.concrete_type && (
                              <span className="text-xs text-gray-500">
                                Tipo: <span className="font-medium text-gray-700">{RECIPE_TYPE_LABELS[p.recipes.concrete_type] || p.recipes.concrete_type}</span>
                              </span>
                            )}
                            {p.unit_price > 0 && (
                              <span className="text-xs text-gray-500">
                                Preco: <span className="font-medium text-emerald-700">
                                  {fmtBRL(p.unit_price)}
                                  {p.materials && `/${p.materials.unit}`}
                                </span>
                              </span>
                            )}
                            {p.notes && <span className="text-xs text-gray-400 italic">{p.notes}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => openEdit(p)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => del(p.id, p.param_label)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            title="Remover"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {existing.length === 0 && (
                      <div className="px-4 py-4 text-center">
                        <p className="text-sm text-gray-400">Nenhum parametro nesta categoria.</p>
                        {cat === 'insumos_gerais' && (
                          <p className="text-xs text-gray-400 mt-1">
                            Adicione insumos recorrentes (cimento, areia, brita) para nao precisar informar o preco a cada obra.
                          </p>
                        )}
                      </div>
                    )}

                    <div className="px-4 py-2">
                      <button
                        onClick={() => openAdd(cat)}
                        className={`flex items-center gap-1 text-xs ${cfg.color} hover:opacity-70 font-medium`}
                      >
                        <Plus className="w-3 h-3" />
                        Adicionar em {cfg.label}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {Object.keys(grouped).filter(k => !ALL_CATEGORIES.includes(k)).map(cat => (
            <div key={cat} className="rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => toggleCat(cat)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100"
              >
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-gray-500" />
                  <span className="font-semibold text-sm text-gray-700 capitalize">{cat}</span>
                  <span className="text-xs bg-white/70 text-gray-600 rounded-full px-2 py-0.5">{grouped[cat].length}</span>
                </div>
                {expandedCats.has(cat) ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {expandedCats.has(cat) && (
                <div className="divide-y divide-gray-100">
                  {grouped[cat].map(p => (
                    <div key={p.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm text-gray-900">{p.param_label}</span>
                        {p.unit_price > 0 && (
                          <span className="ml-2 text-xs text-emerald-700">{fmtBRL(p.unit_price)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(p)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => del(p.id, p.param_label)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white rounded-t-2xl border-b px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">
                {editingId ? 'Editar Parametro' : 'Novo Parametro do Catalogo'}
              </h3>
              <button
                onClick={() => { setShowAddForm(false); setEditingId(null); setError(null); }}
                className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 text-lg leading-none"
              >×</button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Categoria</label>
                <select
                  value={form.param_category}
                  onChange={e => setForm(f => ({ ...f, param_category: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                >
                  <option value="concreto">Tracos de Concreto</option>
                  <option value="argamassa">Tracos de Argamassa</option>
                  <option value="aco">Aco / Armadura</option>
                  <option value="insumos_gerais">Insumos Recorrentes</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Nome / Descricao *</label>
                <input
                  type="text"
                  value={form.param_label}
                  onChange={e => setForm(f => ({ ...f, param_label: e.target.value }))}
                  placeholder="ex: Traco Concreto FCK 25 MPa, Aco CA-50 10mm"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                />
              </div>

              {(form.param_category === 'concreto' || form.param_category === 'argamassa') && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                    Traco Cadastrado
                  </label>
                  {(() => {
                    const filtered = recipes.filter(r => recipeMatchesCategory(r, form.param_category));
                    const selected = filtered.find(r => r.id === form.recipe_id);
                    return (
                      <>
                        <select
                          value={form.recipe_id}
                          onChange={e => setForm(f => ({ ...f, recipe_id: e.target.value }))}
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                        >
                          <option value="">-- Selecionar traco cadastrado --</option>
                          {filtered.map(r => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                              {r.concrete_type ? ` (${RECIPE_TYPE_LABELS[r.concrete_type] || r.concrete_type})` : ''}
                              {r.specific_weight ? ` · ${r.specific_weight} kg/m³` : ''}
                            </option>
                          ))}
                        </select>
                        {filtered.length === 0 && (
                          <p className="text-xs text-amber-600 mt-1">
                            Nenhum traco de {form.param_category === 'concreto' ? 'concreto' : 'argamassa'} cadastrado ainda.
                          </p>
                        )}
                        {selected && selected.specific_weight && (
                          <p className="text-xs text-emerald-600 mt-1">
                            Calculo automatico de consumo habilitado. Peso especifico: {selected.specific_weight} kg/m³.
                          </p>
                        )}
                      </>
                    );
                  })()}
                  <div className="mt-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Ou descreva manualmente (opcional):</label>
                    <input
                      type="text"
                      value={form.value_text}
                      onChange={e => setForm(f => ({ ...f, value_text: e.target.value }))}
                      placeholder={
                        GLOBAL_PARAM_PRESETS.find(p => p.key === form.param_key)?.placeholder ||
                        'ex: 1:2:3 (cim:areia:brita)'
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                    />
                  </div>
                </div>
              )}

              {form.param_category === 'aco' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                    Especificacao do Aco
                  </label>
                  <input
                    type="text"
                    value={form.value_text}
                    onChange={e => setForm(f => ({ ...f, value_text: e.target.value }))}
                    placeholder={
                      GLOBAL_PARAM_PRESETS.find(p => p.key === form.param_key)?.placeholder ||
                      'ex: CA-50 10mm + estribos CA-60 6.3mm'
                    }
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                  />
                </div>
              )}

              <div className="relative">
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                  Insumo Vinculado (opcional)
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={matSearch}
                    onChange={e => { setMatSearch(e.target.value); setShowMatDropdown(true); }}
                    onFocus={() => setShowMatDropdown(true)}
                    placeholder="Buscar insumo cadastrado..."
                    className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                  />
                  {form.material_id && (
                    <button
                      onClick={clearMaterial}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 text-lg leading-none"
                    >×</button>
                  )}
                </div>
                {showMatDropdown && filteredMats.length > 0 && !form.material_id && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredMats.map(m => {
                      const unitPrice = calcUnitPrice(m);
                      const hasPackage = (m.package_size ?? 1) > 1;
                      return (
                        <button
                          key={m.id}
                          onClick={() => selectMaterial(m)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 flex items-center justify-between"
                        >
                          <span>{m.name}</span>
                          <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                            {m.unit} · {fmtBRL(unitPrice)}/{m.unit}
                            {hasPackage && <span className="text-gray-300 ml-1">(emb: {fmtBRL(m.resale_price ?? m.unit_cost ?? 0)})</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                  Preco Unitario (R$)
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.unit_price}
                  onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
                  placeholder="0,00"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                />
                {form.material_id && (
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Preco unitario calculado a partir da embalagem. Voce pode ajustar.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Observacoes (opcional)</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Informacoes adicionais"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                />
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
              <button
                onClick={() => { setShowAddForm(false); setEditingId(null); setError(null); }}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
              >
                {saving
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Save className="w-4 h-4" />}
                {editingId ? 'Atualizar' : 'Salvar no Catalogo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
