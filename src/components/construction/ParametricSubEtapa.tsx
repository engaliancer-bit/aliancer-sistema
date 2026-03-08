import { useState, useEffect, useCallback } from 'react';
import { Trash2, Edit2, X, Check, Hammer, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  BudgetElement, BudgetFoundationParam, BudgetGlobalParam,
  ELEMENT_DEFS, RecipeItemWithMaterial, fmtBRL,
} from './types';
import { calcElementMaterials, LineItemDraft } from './calcElementMaterials';

interface MaterialRow {
  id?: string;
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  is_auto_calculated: boolean;
  material_id: string | null;
  product_id: string | null;
}

interface Props {
  subEtapaName: string;
  elements: BudgetElement[];
  budgetId: string;
  wbsStepId: string;
  subEtapaIndex: number;
  foundationParams: BudgetFoundationParam[];
  globalParams: BudgetGlobalParam[];
  onElementsChange: () => void;
  onDeleteSubEtapa: () => void;
  onRenameSubEtapa: (newName: string) => void;
  onTotalChange: (name: string, total: number) => void;
}

const ALL_ELEMENT_TYPES = ELEMENT_DEFS.map(d => ({ value: d.value, label: d.label, category: d.category }));

export default function ParametricSubEtapa({
  subEtapaName,
  elements,
  budgetId,
  wbsStepId,
  subEtapaIndex,
  foundationParams,
  globalParams,
  onElementsChange,
  onDeleteSubEtapa,
  onRenameSubEtapa,
  onTotalChange,
}: Props) {
  const mainElement = elements[0] || null;

  const [selectedFoundationParamId, setSelectedFoundationParamId] = useState(
    mainElement?.foundation_param_id || ''
  );
  const [selectedElementType, setSelectedElementType] = useState(
    mainElement?.element_type || 'sapata'
  );
  const [quantity, setQuantity] = useState(
    Number(mainElement?.params['quantidade'] || 1)
  );
  const [materialRows, setMaterialRows] = useState<MaterialRow[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(subEtapaName);

  const subTotal = materialRows.reduce((s, r) => s + (r.total_price || 0), 0);

  const matchingFoundationParams = foundationParams.filter(
    fp => fp.param_type === selectedElementType
  );
  const selectedFP = matchingFoundationParams.find(fp => fp.id === selectedFoundationParamId) || null;

  const loadMaterialsFromElement = useCallback(async (el: BudgetElement) => {
    setLoadingMaterials(true);
    const { data } = await supabase
      .from('budget_element_line_items')
      .select('*')
      .eq('element_id', el.id)
      .order('sort_order');
    if (data && data.length > 0) {
      setMaterialRows(data.map((row: any) => ({
        id: row.id,
        description: row.description,
        unit: row.unit,
        quantity: row.quantity,
        unit_price: row.unit_price,
        total_price: row.total_price,
        is_auto_calculated: row.is_auto_calculated,
        material_id: row.material_id,
        product_id: row.product_id,
      })));
    } else {
      setMaterialRows([]);
    }
    setLoadingMaterials(false);
  }, []);

  useEffect(() => {
    if (mainElement) {
      loadMaterialsFromElement(mainElement);
    }
  }, [mainElement, loadMaterialsFromElement]);

  useEffect(() => {
    onTotalChange(subEtapaName, subTotal);
  }, [subTotal, subEtapaName, onTotalChange]);

  const getUnitParams = useCallback((): Record<string, number> => {
    if (selectedFP) {
      const dims = selectedFP.dimensions as Record<string, number>;
      return { ...dims, quantidade: 1 };
    }
    const def = ELEMENT_DEFS.find(d => d.value === selectedElementType);
    const defaults: Record<string, number> = { quantidade: 1 };
    def?.params.forEach(p => { if (p.default !== undefined) defaults[p.key] = p.default; });
    return defaults;
  }, [selectedFP, selectedElementType]);

  const buildRecipeItemsMap = useCallback(async (): Promise<Record<string, RecipeItemWithMaterial[]>> => {
    const globalRecipeIds = globalParams
      .filter(p => p.recipe_id)
      .map(p => p.recipe_id as string);

    const perModelRecipeId = selectedFP?.recipe_id;
    const allIds = [...new Set([...globalRecipeIds, ...(perModelRecipeId ? [perModelRecipeId] : [])])];

    if (allIds.length === 0) return {};

    const { data } = await supabase
      .from('recipe_items')
      .select('id, recipe_id, material_id, quantity, materials(id, name, unit, resale_price, unit_cost, package_size)')
      .in('recipe_id', allIds);

    const map: Record<string, RecipeItemWithMaterial[]> = {};
    (data || []).forEach((item: any) => {
      if (!map[item.recipe_id]) map[item.recipe_id] = [];
      map[item.recipe_id].push(item as RecipeItemWithMaterial);
    });
    return map;
  }, [globalParams, selectedFP]);

  const calculateAndSave = useCallback(async () => {
    setSaving(true);
    try {
      const recipeItemsMap = await buildRecipeItemsMap();
      const unitParams = getUnitParams();
      const drafts: LineItemDraft[] = calcElementMaterials(
        selectedElementType,
        unitParams,
        globalParams,
        selectedFP,
        recipeItemsMap,
      );

      const rows: MaterialRow[] = await Promise.all(
        drafts.map(async d => {
          let unit_price = d.unit_price ?? 0;
          if (unit_price === 0 && d.material_id) {
            const { data } = await supabase
              .from('materials')
              .select('resale_price, unit_cost')
              .eq('id', d.material_id)
              .maybeSingle();
            unit_price = data?.resale_price ?? data?.unit_cost ?? 0;
          } else if (unit_price === 0 && d.product_id) {
            const { data } = await supabase
              .from('products')
              .select('sale_price, final_sale_price')
              .eq('id', d.product_id)
              .maybeSingle();
            unit_price = data?.final_sale_price ?? data?.sale_price ?? 0;
          }
          const totalQty = d.quantity * quantity;
          return {
            description: d.description,
            unit: d.unit,
            quantity: totalQty,
            unit_price,
            total_price: totalQty * unit_price,
            is_auto_calculated: true,
            material_id: d.material_id,
            product_id: d.product_id,
          };
        })
      );

      let elementId: string;

      if (mainElement) {
        await supabase.from('budget_elements').update({
          element_type: selectedElementType,
          params: { ...getUnitParams(), quantidade: quantity },
          foundation_param_id: selectedFoundationParamId || null,
        }).eq('id', mainElement.id);

        await supabase.from('budget_element_line_items')
          .delete()
          .eq('element_id', mainElement.id);

        elementId = mainElement.id;
      } else {
        const { data: newEl, error } = await supabase.from('budget_elements').insert({
          budget_id: budgetId,
          wbs_step_id: wbsStepId,
          sub_etapa: subEtapaName,
          element_type: selectedElementType,
          label: subEtapaName,
          params: { ...getUnitParams(), quantidade: quantity },
          foundation_param_id: selectedFoundationParamId || null,
          source: 'manual',
          measurement_status: 'confirmado',
        }).select('id').single();

        if (error || !newEl) { setSaving(false); return; }
        elementId = newEl.id;
      }

      if (rows.length > 0) {
        await supabase.from('budget_element_line_items').insert(
          rows.map((r, idx) => ({
            budget_id: budgetId,
            wbs_step_id: wbsStepId,
            element_id: elementId,
            description: r.description,
            unit: r.unit,
            quantity: r.quantity,
            unit_price: r.unit_price,
            is_auto_calculated: true,
            material_id: r.material_id,
            product_id: r.product_id,
            sort_order: idx,
          }))
        );
      }

      setMaterialRows(rows);
      onTotalChange(subEtapaName, rows.reduce((s, r) => s + r.total_price, 0));
      onElementsChange();
    } finally {
      setSaving(false);
    }
  }, [
    selectedElementType, selectedFP, selectedFoundationParamId, quantity,
    globalParams, getUnitParams, buildRecipeItemsMap, mainElement, budgetId,
    wbsStepId, subEtapaName, onElementsChange, onTotalChange,
  ]);

  const updateRowQuantity = async (idx: number, newQty: number) => {
    const row = materialRows[idx];
    if (!row?.id) return;
    const newTotal = newQty * row.unit_price;
    await supabase.from('budget_element_line_items').update({ quantity: newQty }).eq('id', row.id);
    const updated = materialRows.map((r, i) =>
      i === idx ? { ...r, quantity: newQty, total_price: newTotal } : r
    );
    setMaterialRows(updated);
    onTotalChange(subEtapaName, updated.reduce((s, r) => s + r.total_price, 0));
  };

  const updateRowUnitPrice = async (idx: number, newPrice: number) => {
    const row = materialRows[idx];
    if (!row?.id) return;
    const newTotal = row.quantity * newPrice;
    await supabase.from('budget_element_line_items').update({ unit_price: newPrice }).eq('id', row.id);
    const updated = materialRows.map((r, i) =>
      i === idx ? { ...r, unit_price: newPrice, total_price: newTotal } : r
    );
    setMaterialRows(updated);
    onTotalChange(subEtapaName, updated.reduce((s, r) => s + r.total_price, 0));
  };

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== subEtapaName) onRenameSubEtapa(trimmed);
    setIsRenaming(false);
  };

  const prefix = `${subEtapaIndex}.`;
  const noGlobalParams = globalParams.length === 0;

  const elementsByCategory = ALL_ELEMENT_TYPES.reduce<Record<string, { value: string; label: string }[]>>((acc, el) => {
    if (!acc[el.category]) acc[el.category] = [];
    acc[el.category].push(el);
    return acc;
  }, {});

  const CATEGORY_LABELS: Record<string, string> = {
    servicos_preliminares: 'Servicos Preliminares',
    fundacao: 'Fundacoes',
    estrutura: 'Estrutura',
    vedacao: 'Alvenaria/Vedacao',
    cobertura: 'Cobertura',
    instalacao: 'Instalacoes',
    revestimento: 'Revestimentos',
    acabamento: 'Acabamentos',
    esquadria: 'Esquadrias',
    pavimentacao: 'Pavimentacao',
    terraplagem: 'Terraplenagem',
    drenagem: 'Drenagem',
    loucas_metais: 'Loucas e Metais',
    outros: 'Outros',
  };

  return (
    <div className="border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 border-b border-gray-200">
        <span className="text-xs font-bold text-gray-500 flex-shrink-0">{prefix}</span>
        {isRenaming ? (
          <div className="flex items-center gap-1.5 flex-1">
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setIsRenaming(false); }}
              onBlur={commitRename}
              className="flex-1 px-2 py-0.5 text-sm font-semibold border border-amber-300 rounded focus:ring-1 focus:ring-amber-400 bg-white"
            />
            <button onClick={commitRename} className="p-1 text-green-500 hover:bg-green-50 rounded">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setIsRenaming(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <>
            <Hammer className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
            <span className="text-sm font-semibold text-gray-700 flex-1">{subEtapaName}</span>
            <button onClick={() => { setIsRenaming(true); setRenameValue(subEtapaName); }}
              className="p-1 text-gray-300 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors">
              <Edit2 className="w-3 h-3" />
            </button>
            <button onClick={onDeleteSubEtapa}
              className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
              <Trash2 className="w-3 h-3" />
            </button>
          </>
        )}
      </div>

      <div className="px-4 py-3 bg-amber-50/40 space-y-3 border-b border-amber-100">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de Elemento</label>
            <select
              value={selectedElementType}
              onChange={e => { setSelectedElementType(e.target.value); setSelectedFoundationParamId(''); }}
              className="w-full px-2.5 py-1.5 text-sm border border-amber-200 rounded-lg bg-white focus:ring-2 focus:ring-amber-300"
            >
              {Object.entries(elementsByCategory).map(([cat, items]) => (
                <optgroup key={cat} label={CATEGORY_LABELS[cat] || cat}>
                  {items.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Modelo Pre-cadastrado
              {matchingFoundationParams.length === 0 && (
                <span className="ml-1 text-gray-400 font-normal">(nenhum cadastrado)</span>
              )}
            </label>
            <select
              value={selectedFoundationParamId}
              onChange={e => setSelectedFoundationParamId(e.target.value)}
              disabled={matchingFoundationParams.length === 0}
              className="w-full px-2.5 py-1.5 text-sm border border-amber-200 rounded-lg bg-white focus:ring-2 focus:ring-amber-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">-- Sem modelo especifico --</option>
              {matchingFoundationParams.map(fp => (
                <option key={fp.id} value={fp.id}>{fp.code} — {fp.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Quantidade de Unidades
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex-1 px-2.5 py-1.5 text-sm border border-amber-200 rounded-lg bg-white focus:ring-2 focus:ring-amber-300"
              />
              <button
                onClick={calculateAndSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-xs rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {saving
                  ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  : <RefreshCw className="w-3.5 h-3.5" />
                }
                {materialRows.length > 0 ? 'Recalcular' : 'Calcular'}
              </button>
            </div>
          </div>
        </div>

        {noGlobalParams && (
          <div className="flex items-center gap-2 p-2.5 bg-amber-100 border border-amber-200 rounded-lg text-xs text-amber-700">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            Configure os tracos de concreto na aba <strong className="mx-1">Parametros</strong> para calcular automaticamente os materiais.
          </div>
        )}

        {selectedFP && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 space-y-1">
            <div>
              <span className="font-semibold">Modelo:</span> {selectedFP.label}
            </div>
            {Array.isArray(selectedFP.dimensions.reinforcement_bars) && selectedFP.dimensions.reinforcement_bars.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedFP.dimensions.reinforcement_bars.map((bar, i) => (
                  <span key={i} className="bg-white border border-amber-200 px-1.5 py-0.5 rounded text-xs">
                    {bar.material_name} — {bar.meters_used}m / {bar.package_size}m = {(bar.meters_used / bar.package_size).toFixed(3)} emb.
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {loadingMaterials ? (
        <div className="flex items-center justify-center py-4 gap-2 text-gray-400 text-xs">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Carregando...
        </div>
      ) : materialRows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-amber-50/50 border-b border-amber-100">
                <th className="text-right px-3 py-1.5 text-xs font-semibold text-gray-500 w-20">Quant.</th>
                <th className="text-center px-2 py-1.5 text-xs font-semibold text-gray-500 w-16">Unid.</th>
                <th className="text-left px-3 py-1.5 text-xs font-semibold text-gray-500">Descricao</th>
                <th className="text-right px-3 py-1.5 text-xs font-semibold text-gray-500 w-28">Valor Unit.</th>
                <th className="text-right px-3 py-1.5 text-xs font-semibold text-gray-500 w-28">Valor Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {materialRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-amber-50/20 transition-colors">
                  <td className="px-3 py-1.5 text-right">
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      defaultValue={row.quantity}
                      onBlur={e => row.id && updateRowQuantity(idx, parseFloat(e.target.value) || 0)}
                      className="w-full text-right font-medium text-gray-800 border border-transparent hover:border-orange-200 focus:border-orange-300 rounded px-2 py-0.5 focus:ring-1 focus:ring-orange-300 bg-transparent focus:bg-white"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center text-gray-500">{row.unit}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                      {row.is_auto_calculated && (
                        <span className="flex-shrink-0 text-[9px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded font-medium">AUTO</span>
                      )}
                      <span className="text-gray-800">{row.description}</span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={row.unit_price}
                      onBlur={e => row.id && updateRowUnitPrice(idx, parseFloat(e.target.value) || 0)}
                      className="w-full text-right text-gray-700 border border-transparent hover:border-orange-200 focus:border-orange-300 rounded px-2 py-0.5 focus:ring-1 focus:ring-orange-300 bg-transparent focus:bg-white"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right font-semibold text-gray-900">
                    {row.total_price > 0
                      ? fmtBRL(row.total_price)
                      : <span className="text-gray-300">—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-amber-200 bg-amber-50">
                <td colSpan={4} className="px-3 py-1.5 text-xs font-bold text-amber-800 text-right uppercase tracking-wide">
                  Subtotal {subEtapaName}
                </td>
                <td className="px-3 py-1.5 text-right font-bold text-amber-700 text-sm">
                  {fmtBRL(subTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="px-4 py-5 text-center">
          <p className="text-xs text-gray-400 mb-2">
            Selecione o modelo e informe a quantidade, depois clique em <strong>Calcular</strong> para gerar o quantitativo de materiais.
          </p>
        </div>
      )}
    </div>
  );
}
