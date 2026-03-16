import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, Beaker, Layers, Zap, Package, CheckCircle, Link2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Budget } from './types';
import BudgetFoundationParamsPanel from './BudgetFoundationParamsPanel';

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
  materials?: { id: string; name: string; unit: string };
  recipes?: { id: string; name: string; concrete_type: string | null; specific_weight: number | null };
}

interface LinkedParam extends GlobalParam {
  link_id: string;
  unit_price_override: number | null;
  notes_override: string | null;
}

interface Props {
  budget: Budget;
  onComplete?: () => void;
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

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof Beaker; color: string; bg: string; border: string }> = {
  concreto:       { label: 'Tracos de Concreto',   icon: Beaker,  color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  argamassa:      { label: 'Tracos de Argamassa',  icon: Layers,  color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  aco:            { label: 'Aco / Armadura',        icon: Zap,     color: 'text-gray-700',   bg: 'bg-gray-50',   border: 'border-gray-200' },
  insumos_gerais: { label: 'Insumos Recorrentes',   icon: Package, color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
};

const ALL_CATEGORIES = ['concreto', 'argamassa', 'aco', 'insumos_gerais'];

function fmtBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

export default function BudgetParamsPanel({ budget, onComplete }: Props) {
  const [linked, setLinked] = useState<LinkedParam[]>([]);
  const [catalog, setCatalog] = useState<GlobalParam[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSelector, setShowSelector] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(ALL_CATEGORIES));
  const [showFoundation, setShowFoundation] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [catalogRes, linksRes] = await Promise.all([
      supabase
        .from('global_params')
        .select('*, materials(id,name,unit), recipes(id,name,concrete_type,specific_weight)')
        .order('sort_order'),
      supabase
        .from('budget_param_links')
        .select('id, global_param_id, unit_price_override, notes_override')
        .eq('budget_id', budget.id),
    ]);

    const allParams: GlobalParam[] = catalogRes.data || [];
    const links = linksRes.data || [];

    const linkedParams: LinkedParam[] = links
      .map(link => {
        const gp = allParams.find(p => p.id === link.global_param_id);
        if (!gp) return null;
        return {
          ...gp,
          link_id: link.id,
          unit_price_override: link.unit_price_override,
          notes_override: link.notes_override,
        };
      })
      .filter(Boolean) as LinkedParam[];

    setLinked(linkedParams);
    setCatalog(allParams);
    setLoading(false);
  }, [budget.id]);

  useEffect(() => { load(); }, [load]);

  const linkedIds = useMemo(() => new Set(linked.map(l => l.id)), [linked]);

  const grouped = useMemo(() => {
    const map: Record<string, LinkedParam[]> = {};
    linked.forEach(p => {
      if (!map[p.param_category]) map[p.param_category] = [];
      map[p.param_category].push(p);
    });
    return map;
  }, [linked]);

  const catalogGrouped = useMemo(() => {
    const map: Record<string, GlobalParam[]> = {};
    catalog.forEach(p => {
      if (!map[p.param_category]) map[p.param_category] = [];
      map[p.param_category].push(p);
    });
    return map;
  }, [catalog]);

  const toggleCat = (cat: string) => setExpandedCats(prev => {
    const s = new Set(prev);
    s.has(cat) ? s.delete(cat) : s.add(cat);
    return s;
  });

  const linkParam = async (globalParamId: string) => {
    setSaving(true);
    const { error } = await supabase.from('budget_param_links').insert([{
      budget_id: budget.id,
      global_param_id: globalParamId,
    }]);
    if (!error) await load();
    setSaving(false);
  };

  const unlinkParam = async (linkId: string, label: string) => {
    if (!window.confirm(`Remover parametro "${label}" deste orcamento?`)) return;
    await supabase.from('budget_param_links').delete().eq('id', linkId);
    await load();
  };

  const linkedCount = linked.length;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Parametros da Obra</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Selecione quais parametros do catalogo do escritorio se aplicam a esta obra.
            Os parametros definem tracos, tipos de aco e insumos usados nos calculos automaticos.
          </p>
        </div>
        <button
          onClick={() => setShowSelector(true)}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"
        >
          <Link2 className="w-4 h-4" />
          Selecionar Parametros
        </button>
      </div>

      <div className="rounded-xl border-2 border-amber-300 overflow-hidden bg-amber-50/30">
        <button
          onClick={() => setShowFoundation(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3.5 bg-gradient-to-r from-amber-50 to-amber-100 hover:brightness-95 transition-all"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <span className="font-bold text-sm text-amber-900 block">Parametros Estruturais e de Fundacao</span>
              <span className="text-xs text-amber-700">Sapatas, baldrames, pilares, fundacoes e padroes de caixaria</span>
            </div>
          </div>
          {showFoundation ? <ChevronUp className="w-4 h-4 text-amber-600" /> : <ChevronDown className="w-4 h-4 text-amber-600" />}
        </button>
        {showFoundation && (
          <div className="p-4 bg-white">
            <BudgetFoundationParamsPanel budget={budget} globalParams={[]} />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : linked.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
          <Link2 className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <h3 className="text-base font-semibold text-gray-600 mb-1">Nenhum parametro vinculado</h3>
          <p className="text-sm text-gray-400 mb-4">
            Clique em "Selecionar Parametros" para vincular parametros do catalogo a esta obra.
          </p>
          <button
            onClick={() => setShowSelector(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600"
          >
            <Link2 className="w-4 h-4" />
            Selecionar Parametros
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {ALL_CATEGORIES.filter(cat => grouped[cat]?.length > 0).map(cat => {
            const cfg = CATEGORY_CONFIG[cat];
            const Icon = cfg.icon;
            const items = grouped[cat] || [];
            const isExpanded = expandedCats.has(cat);

            return (
              <div key={cat} className={`rounded-xl border ${cfg.border} overflow-hidden`}>
                <button
                  onClick={() => toggleCat(cat)}
                  className={`w-full flex items-center justify-between px-4 py-3 ${cfg.bg}`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                    <span className={`font-semibold text-sm ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-xs bg-white/70 text-gray-600 rounded-full px-2 py-0.5 font-medium">
                      {items.length} {items.length === 1 ? 'parametro' : 'parametros'}
                    </span>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>

                {isExpanded && (
                  <div className="divide-y divide-gray-100">
                    {items.map(p => {
                      const displayPrice = p.unit_price_override ?? p.unit_price;
                      return (
                        <div key={p.link_id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50">
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
                              {displayPrice > 0 && (
                                <span className="text-xs text-gray-500">
                                  Preco: <span className="font-medium text-emerald-700">
                                    {fmtBRL(displayPrice)}
                                    {p.materials && `/${p.materials.unit}`}
                                  </span>
                                </span>
                              )}
                              {(p.notes_override || p.notes) && (
                                <span className="text-xs text-gray-400 italic">{p.notes_override || p.notes}</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => unlinkParam(p.link_id, p.param_label)}
                            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg flex-shrink-0"
                            title="Remover deste orcamento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {Object.keys(grouped).filter(k => !ALL_CATEGORIES.includes(k)).map(cat => (
            <div key={cat} className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-500" />
                <span className="font-semibold text-sm text-gray-700 capitalize">{cat}</span>
              </div>
              <div className="divide-y divide-gray-100">
                {grouped[cat].map(p => (
                  <div key={p.link_id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                    <span className="font-medium text-sm text-gray-900">{p.param_label}</span>
                    <button
                      onClick={() => unlinkParam(p.link_id, p.param_label)}
                      className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {linkedCount >= 3 && onComplete && (
        <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">Parametros configurados!</p>
              <p className="text-xs text-emerald-600">Voce pode avancar para o levantamento dos elementos da obra.</p>
            </div>
          </div>
          <button
            onClick={onComplete}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
          >
            Ir para Levantamento
          </button>
        </div>
      )}

      {showSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Selecionar Parametros do Catalogo</h3>
                <p className="text-xs text-gray-500 mt-0.5">Clique para vincular parametros a este orcamento</p>
              </div>
              <button onClick={() => setShowSelector(false)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 text-lg leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {catalog.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-sm">Catalogo de parametros vazio.</p>
                  <p className="text-gray-400 text-xs mt-1">Vá em <strong>Parametros</strong> (aba do modulo) para criar parametros do escritorio.</p>
                </div>
              ) : (
                ALL_CATEGORIES.filter(cat => catalogGrouped[cat]?.length > 0).map(cat => {
                  const cfg = CATEGORY_CONFIG[cat];
                  const Icon = cfg.icon;
                  const items = catalogGrouped[cat] || [];

                  return (
                    <div key={cat} className={`rounded-xl border ${cfg.border} overflow-hidden`}>
                      <div className={`flex items-center gap-2 px-4 py-2.5 ${cfg.bg}`}>
                        <Icon className={`w-4 h-4 ${cfg.color}`} />
                        <span className={`font-semibold text-sm ${cfg.color}`}>{cfg.label}</span>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {items.map(p => {
                          const isLinked = linkedIds.has(p.id);
                          return (
                            <div key={p.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50">
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-sm text-gray-800">{p.param_label}</span>
                                {p.value_text && (
                                  <span className="ml-2 text-xs text-gray-400">{p.value_text}</span>
                                )}
                                {p.recipes?.name && (
                                  <span className="ml-2 text-xs text-cyan-600">{p.recipes.name}</span>
                                )}
                                {p.unit_price > 0 && (
                                  <span className="ml-2 text-xs text-emerald-600">{fmtBRL(p.unit_price)}</span>
                                )}
                              </div>
                              <button
                                onClick={() => !isLinked && linkParam(p.id)}
                                disabled={isLinked || saving}
                                className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border font-medium flex-shrink-0 ml-3 transition-colors ${
                                  isLinked
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700 cursor-default'
                                    : 'bg-white border-orange-300 text-orange-700 hover:bg-orange-50'
                                }`}
                              >
                                {isLinked ? <><CheckCircle className="w-3 h-3" /> Vinculado</> : <><Plus className="w-3 h-3" /> Vincular</>}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-5 border-t bg-gray-50 rounded-b-2xl flex justify-end">
              <button
                onClick={() => setShowSelector(false)}
                className="px-5 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
