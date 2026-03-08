import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Plus, ChevronDown, ChevronRight,
  RefreshCw, Layers, ArrowUp, ArrowDown, Settings,
  GitBranch, Trash2, X, Check,
} from 'lucide-react';
import {
  Budget, WBSStep, BudgetElement, BudgetFoundationParam,
  BudgetGlobalParam,
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

export default function BudgetElementsPanel({ budget, wbsSteps, onRefresh }: Props) {
  const [elements, setElements] = useState<BudgetElement[]>([]);
  const [foundationParams, setFoundationParams] = useState<BudgetFoundationParam[]>([]);
  const [globalParams, setGlobalParams] = useState<BudgetGlobalParam[]>([]);
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

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: elData, error: elErr }, { data: fpData, error: fpErr }, { data: gpData, error: gpErr }] = await Promise.all([
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
    ]);
    if (elErr) console.error('Erro ao carregar elementos:', elErr);
    if (fpErr) console.error('Erro ao carregar parametros fundacao:', fpErr);
    if (gpErr) console.error('Erro ao carregar parametros globais:', gpErr);
    setElements(elData || []);
    setFoundationParams(fpData || []);
    setGlobalParams(gpData || []);
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

  const wbsStepTotal = useCallback((wbsId: string) => {
    const subMap = groupedByWbs[wbsId] || {};
    return Object.keys(subMap).reduce((sum, sub) => {
      return sum + (subEtapaTotals[`${wbsId}::${sub}`] || 0);
    }, 0);
  }, [groupedByWbs, subEtapaTotals]);

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
    const msg = hasElements
      ? `Excluir a etapa "${wbsName}" e todos os seus elementos?`
      : `Excluir a etapa "${wbsName}"?`;
    if (!window.confirm(msg)) return;
    if (hasElements) {
      const allEls = Object.values(groupedByWbs[wbsId] || {}).flat();
      for (const el of allEls) {
        await supabase.from('budget_element_line_items').delete().eq('element_id', el.id);
        await supabase.from('budget_elements').delete().eq('id', el.id);
      }
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
                        {totalItems > 0 && (
                          <span className="text-xs text-blue-400 flex-shrink-0">
                            {totalItems} {totalItems === 1 ? 'item' : 'itens'}
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
                    {subEtapas.length === 0 ? (
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
                          <p className="text-sm text-gray-400 mb-3">Nenhuma sub-etapa adicionada</p>
                          <button
                            onClick={() => { setAddingSubEtapa(wbs.id); setNewSubEtapaName(''); }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 border border-orange-200 text-orange-600 rounded-lg text-sm hover:bg-orange-50 transition-colors"
                          >
                            <Plus className="w-4 h-4" /> Adicionar Sub-etapa
                          </button>
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
                            <button
                              onClick={() => { setAddingSubEtapa(wbs.id); setNewSubEtapaName(''); }}
                              className="flex items-center gap-1 text-xs text-gray-500 hover:text-orange-600 font-medium transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" /> Adicionar sub-etapa
                            </button>
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
