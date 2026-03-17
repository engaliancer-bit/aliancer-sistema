import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, Trash2, Search, X, Edit2, Check, ChevronDown, ChevronRight, Package, Droplet, Layers, Pencil } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { BudgetElement, fmtBRL } from './types';

type SourceType = 'insumo' | 'produto' | 'composicao' | 'composicao_industria' | 'livre';

interface CatalogItem {
  id: string;
  name: string;
  unit: string;
  unit_price: number;
  type: SourceType;
}

interface CompositionSubItem {
  id: string;
  description: string;
  unit: string;
  coefficient: number;
  unit_price: number;
  item_type: string;
}

interface RowDraft {
  id: string;
  element_id: string | null;
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  material_id: string | null;
  product_id: string | null;
  composition_id: string | null;
  subItems?: CompositionSubItem[];
  subExpanded?: boolean;
}

interface Props {
  subEtapaName: string;
  elements: BudgetElement[];
  budgetId: string;
  wbsStepId: string;
  subEtapaIndex: number;
  onElementsChange: () => void;
  onDeleteSubEtapa: () => void;
  onRenameSubEtapa: (newName: string) => void;
  onTotalChange: (name: string, total: number) => void;
}

const UNIT_OPTIONS = ['un', 'm', 'm2', 'm3', 'kg', 'sc', 'cx', 'vb', 'pt', 'gl', 'h', 'mês'];

const SOURCE_CONFIG: Record<SourceType, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  insumo:               { label: 'Insumo',             color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200 text-amber-700',   icon: Droplet },
  produto:              { label: 'Produto',             color: 'text-green-700', bg: 'bg-green-50 border-green-200 text-green-700',   icon: Package },
  composicao:           { label: 'Comp. de Obra',       color: 'text-blue-700',  bg: 'bg-blue-50 border-blue-200 text-blue-700',      icon: Layers },
  composicao_industria: { label: 'Composicao',          color: 'text-teal-700',  bg: 'bg-teal-50 border-teal-200 text-teal-700',      icon: Layers },
  livre:                { label: 'Livre',               color: 'text-gray-600',  bg: 'bg-gray-50 border-gray-200 text-gray-600',      icon: Pencil },
};

export default function SpreadsheetSubEtapa({
  subEtapaName,
  elements,
  budgetId,
  wbsStepId,
  subEtapaIndex,
  onElementsChange,
  onDeleteSubEtapa,
  onRenameSubEtapa,
  onTotalChange,
}: Props) {
  const [rows, setRows] = useState<RowDraft[]>(() =>
    elements.map(el => ({
      id: el.id,
      element_id: el.id,
      description: el.label,
      unit: el.calculated_unit || 'un',
      quantity: Number(el.params['quantidade'] || el.calculated_quantity || 1),
      unit_price: Number(el.params['custo_unitario'] || 0),
      total_price: Number(el.params['quantidade'] || el.calculated_quantity || 1) * Number(el.params['custo_unitario'] || 0),
      material_id: null,
      product_id: null,
      composition_id: el.params['composition_id'] || null,
      subExpanded: false,
    }))
  );

  const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [addingNew, setAddingNew] = useState(false);
  const [source, setSource] = useState<SourceType>('insumo');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CatalogItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [newRow, setNewRow] = useState({ description: '', unit: 'un', quantity: '1', unit_price: '' });
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(subEtapaName);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const subTotal = rows.reduce((s, r) => s + (r.total_price || 0), 0);

  const notifyTotal = useCallback((updatedRows: RowDraft[]) => {
    const t = updatedRows.reduce((s, r) => s + (r.total_price || 0), 0);
    onTotalChange(subEtapaName, t);
  }, [subEtapaName, onTotalChange]);

  const runSearch = useCallback(async (q: string, src: SourceType) => {
    if (q.length < 2) { setSearchResults([]); setShowResults(false); return; }
    setSearching(true);
    setShowResults(true);
    try {
      if (src === 'insumo') {
        const { data } = await supabase
          .from('materials')
          .select('id,name,unit,unit_cost,resale_price')
          .ilike('name', `%${q}%`)
          .limit(15);
        setSearchResults((data || []).map(m => ({
          id: m.id, name: m.name, unit: m.unit || 'un',
          unit_price: m.unit_cost || m.resale_price || 0,
          type: 'insumo' as const,
        })));
      } else if (src === 'produto') {
        const { data } = await supabase
          .from('products')
          .select('id,name,unit,sale_price,final_sale_price')
          .ilike('name', `%${q}%`)
          .limit(15);
        setSearchResults((data || []).map(p => ({
          id: p.id, name: p.name, unit: p.unit || 'un',
          unit_price: p.final_sale_price || p.sale_price || 0,
          type: 'produto' as const,
        })));
      } else if (src === 'composicao') {
        const { data } = await supabase
          .from('budget_compositions')
          .select('id,name,unit,code')
          .ilike('name', `%${q}%`)
          .limit(15);
        const ids = (data || []).map(c => c.id);
        let costs: Record<string, number> = {};
        if (ids.length > 0) {
          const { data: items } = await supabase
            .from('budget_composition_items')
            .select('composition_id,coefficient,unit_price')
            .in('composition_id', ids);
          (items || []).forEach(i => {
            costs[i.composition_id] = (costs[i.composition_id] || 0) + i.coefficient * i.unit_price;
          });
        }
        setSearchResults((data || []).map(c => ({
          id: c.id, name: c.name, unit: c.unit || 'un',
          unit_price: costs[c.id] || 0,
          type: 'composicao' as const,
        })));
      } else if (src === 'composicao_industria') {
        const { data } = await supabase
          .from('compositions')
          .select('id,name,total_cost')
          .ilike('name', `%${q}%`)
          .limit(15);
        setSearchResults((data || []).map(c => ({
          id: c.id, name: c.name, unit: 'un',
          unit_price: c.total_cost || 0,
          type: 'composicao_industria' as const,
        })));
      }
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (source === 'livre') { setSearchResults([]); setShowResults(false); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(searchQuery, source), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, source, runSearch]);

  const loadCompositionSubItems = useCallback(async (compositionId: string): Promise<CompositionSubItem[]> => {
    const { data } = await supabase
      .from('budget_composition_items')
      .select(`
        id, item_type, coefficient, unit_price, unit, description,
        materials(name), products(name)
      `)
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

  const startEdit = (rowId: string, field: string, current: string | number) => {
    setEditingCell({ rowId, field });
    setEditValue(String(current));
  };

  const commitEdit = async (rowId: string, field: string) => {
    setEditingCell(null);
    const row = rows.find(r => r.id === rowId);
    if (!row) return;

    let updated: RowDraft = { ...row };
    if (field === 'description') updated.description = editValue.trim() || row.description;
    else if (field === 'unit') updated.unit = editValue || row.unit;
    else if (field === 'quantity') {
      updated.quantity = parseFloat(editValue) || 0;
      updated.total_price = updated.quantity * updated.unit_price;
    } else if (field === 'unit_price') {
      updated.unit_price = parseFloat(editValue) || 0;
      updated.total_price = updated.quantity * updated.unit_price;
    }

    const newRows = rows.map(r => r.id === rowId ? updated : r);
    setRows(newRows);
    notifyTotal(newRows);

    setSaving(prev => new Set([...prev, rowId]));
    try {
      const payload: Record<string, unknown> = {
        label: updated.description,
        calculated_unit: updated.unit,
        params: { quantidade: updated.quantity, custo_unitario: updated.unit_price, composition_id: updated.composition_id },
      };
      await supabase.from('budget_elements').update(payload).eq('id', rowId);
    } finally {
      setSaving(prev => { const s = new Set(prev); s.delete(rowId); return s; });
    }
  };

  const deleteRow = async (rowId: string) => {
    await supabase.from('budget_elements').delete().eq('id', rowId);
    const newRows = rows.filter(r => r.id !== rowId);
    setRows(newRows);
    notifyTotal(newRows);
    onElementsChange();
  };

  const addRowFromCatalog = async (item: CatalogItem) => {
    setShowResults(false);
    setSearchQuery('');
    const compositionId = item.type === 'composicao' ? item.id : null;
    const { data, error } = await supabase.from('budget_elements').insert({
      budget_id: budgetId,
      wbs_step_id: wbsStepId,
      sub_etapa: subEtapaName,
      element_type: 'outros',
      label: item.name,
      params: { quantidade: 1, custo_unitario: item.unit_price, composition_id: compositionId },
      calculated_unit: item.unit,
      source: 'manual',
    }).select('id').single();
    if (error || !data) return;

    const newRowDraft: RowDraft = {
      id: data.id,
      element_id: data.id,
      description: item.name,
      unit: item.unit,
      quantity: 1,
      unit_price: item.unit_price,
      total_price: item.unit_price,
      material_id: item.type === 'insumo' ? item.id : null,
      product_id: item.type === 'produto' ? item.id : null,
      composition_id: compositionId,
      subExpanded: false,
    };

    if (compositionId) {
      newRowDraft.subItems = await loadCompositionSubItems(compositionId);
    }

    const newRows = [...rows, newRowDraft];
    setRows(newRows);
    notifyTotal(newRows);
    onElementsChange();
  };

  const addFreeRow = async () => {
    if (!newRow.description.trim()) return;
    const qty = parseFloat(newRow.quantity) || 1;
    const price = parseFloat(newRow.unit_price) || 0;
    const { data, error } = await supabase.from('budget_elements').insert({
      budget_id: budgetId,
      wbs_step_id: wbsStepId,
      sub_etapa: subEtapaName,
      element_type: 'outros',
      label: newRow.description.trim(),
      params: { quantidade: qty, custo_unitario: price },
      calculated_unit: newRow.unit,
      source: 'manual',
    }).select('id').single();
    if (error || !data) return;
    const row: RowDraft = {
      id: data.id,
      element_id: data.id,
      description: newRow.description.trim(),
      unit: newRow.unit,
      quantity: qty,
      unit_price: price,
      total_price: qty * price,
      material_id: null,
      product_id: null,
      composition_id: null,
    };
    const newRows = [...rows, row];
    setRows(newRows);
    notifyTotal(newRows);
    setNewRow({ description: '', unit: 'un', quantity: '1', unit_price: '' });
    setAddingNew(false);
    onElementsChange();
  };

  const toggleSubItems = async (rowId: string) => {
    const row = rows.find(r => r.id === rowId);
    if (!row || !row.composition_id) return;
    if (!row.subItems) {
      const subItems = await loadCompositionSubItems(row.composition_id);
      setRows(prev => prev.map(r => r.id === rowId ? { ...r, subItems, subExpanded: true } : r));
    } else {
      setRows(prev => prev.map(r => r.id === rowId ? { ...r, subExpanded: !r.subExpanded } : r));
    }
  };

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== subEtapaName) {
      onRenameSubEtapa(trimmed);
    }
    setIsRenaming(false);
  };

  const resetAddForm = () => {
    setAddingNew(false);
    setShowResults(false);
    setSearchQuery('');
    setSearchResults([]);
    setNewRow({ description: '', unit: 'un', quantity: '1', unit_price: '' });
  };

  const prefix = `${subEtapaIndex}.`;

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
              className="flex-1 px-2 py-0.5 text-sm font-semibold border border-orange-300 rounded focus:ring-1 focus:ring-orange-400 bg-white"
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
            <span className="text-sm font-semibold text-gray-700 flex-1">{subEtapaName}</span>
            <button onClick={() => { setIsRenaming(true); setRenameValue(subEtapaName); }}
              className="p-1 text-gray-300 hover:text-gray-500 hover:bg-gray-100 rounded transition-colors">
              <Edit2 className="w-3 h-3" />
            </button>
            <button onClick={onDeleteSubEtapa}
              className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
              <Trash2 className="w-3 h-3" />
            </button>
          </>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-right px-3 py-1.5 text-xs font-semibold text-gray-500 w-20">Quant.</th>
              <th className="text-center px-2 py-1.5 text-xs font-semibold text-gray-500 w-16">Unid.</th>
              <th className="text-left px-3 py-1.5 text-xs font-semibold text-gray-500">Descricao</th>
              <th className="text-right px-3 py-1.5 text-xs font-semibold text-gray-500 w-28">Valor Unit.</th>
              <th className="text-right px-3 py-1.5 text-xs font-semibold text-gray-500 w-28">Valor Total</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map(row => (
              <>
                <tr key={row.id} className={`hover:bg-orange-50/30 transition-colors group ${saving.has(row.id) ? 'opacity-60' : ''}`}>
                  <td className="px-3 py-1.5 text-right">
                    {editingCell?.rowId === row.id && editingCell.field === 'quantity' ? (
                      <input
                        autoFocus
                        type="number"
                        min="0"
                        step="0.01"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => commitEdit(row.id, 'quantity')}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(row.id, 'quantity'); if (e.key === 'Escape') setEditingCell(null); }}
                        className="w-full text-right text-sm border border-orange-300 rounded px-2 py-0.5 focus:ring-1 focus:ring-orange-400 bg-white"
                      />
                    ) : (
                      <button
                        onClick={() => startEdit(row.id, 'quantity', row.quantity)}
                        className="w-full text-right font-medium text-gray-800 hover:bg-orange-100 rounded px-2 py-0.5 transition-colors"
                      >
                        {row.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                      </button>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {editingCell?.rowId === row.id && editingCell.field === 'unit' ? (
                      <select
                        autoFocus
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => commitEdit(row.id, 'unit')}
                        className="w-full text-center text-sm border border-orange-300 rounded px-1 py-0.5 focus:ring-1 focus:ring-orange-400 bg-white"
                      >
                        {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    ) : (
                      <button
                        onClick={() => startEdit(row.id, 'unit', row.unit)}
                        className="w-full text-center text-gray-600 hover:bg-orange-100 rounded px-1 py-0.5 transition-colors"
                      >
                        {row.unit}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                      {row.composition_id && (
                        <button
                          onClick={() => toggleSubItems(row.id)}
                          title={row.subExpanded ? 'Ocultar composicao' : 'Ver itens da composicao'}
                          className={`flex-shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium border transition-colors ${
                            row.subExpanded
                              ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200'
                              : 'bg-blue-50 text-blue-500 border-blue-100 hover:bg-blue-100 hover:text-blue-700'
                          }`}
                        >
                          <Layers className="w-3 h-3" />
                          {row.subExpanded ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                        </button>
                      )}
                      {editingCell?.rowId === row.id && editingCell.field === 'description' ? (
                        <input
                          autoFocus
                          type="text"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => commitEdit(row.id, 'description')}
                          onKeyDown={e => { if (e.key === 'Enter') commitEdit(row.id, 'description'); if (e.key === 'Escape') setEditingCell(null); }}
                          className="flex-1 text-sm border border-orange-300 rounded px-2 py-0.5 focus:ring-1 focus:ring-orange-400 bg-white"
                        />
                      ) : (
                        <button
                          onClick={() => startEdit(row.id, 'description', row.description)}
                          className="flex-1 text-left text-gray-800 hover:bg-orange-100 rounded px-2 py-0.5 transition-colors truncate"
                        >
                          {row.description || <span className="text-gray-400 italic">sem descricao</span>}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {editingCell?.rowId === row.id && editingCell.field === 'unit_price' ? (
                      <input
                        autoFocus
                        type="number"
                        min="0"
                        step="0.01"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => commitEdit(row.id, 'unit_price')}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(row.id, 'unit_price'); if (e.key === 'Escape') setEditingCell(null); }}
                        className="w-full text-right text-sm border border-orange-300 rounded px-2 py-0.5 focus:ring-1 focus:ring-orange-400 bg-white"
                      />
                    ) : (
                      <button
                        onClick={() => startEdit(row.id, 'unit_price', row.unit_price)}
                        className="w-full text-right text-gray-700 hover:bg-orange-100 rounded px-2 py-0.5 transition-colors"
                      >
                        {row.unit_price > 0
                          ? fmtBRL(row.unit_price)
                          : <span className="text-gray-300">—</span>
                        }
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right font-semibold text-gray-900">
                    {row.total_price > 0
                      ? fmtBRL(row.total_price)
                      : <span className="text-gray-300">—</span>
                    }
                  </td>
                  <td className="px-2 py-1.5">
                    <button
                      onClick={() => deleteRow(row.id)}
                      className="p-1 text-gray-200 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
                {row.composition_id && row.subExpanded && row.subItems && (
                  <tr key={`${row.id}-sub`}>
                    <td colSpan={6} className="px-0 py-0">
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
                            {row.subItems.map(sub => (
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
            ))}
          </tbody>

          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50">
                <td colSpan={4} className="px-3 py-1.5 text-xs font-bold text-gray-600 text-right uppercase tracking-wide">
                  Subtotal {subEtapaName}
                </td>
                <td className="px-3 py-1.5 text-right font-bold text-orange-600 text-sm">
                  {fmtBRL(subTotal)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {addingNew && (
        <div className="px-4 py-3 bg-white border-t border-gray-100">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-semibold text-gray-600">Adicionar item</span>
            <button onClick={resetAddForm} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            {(['insumo', 'produto', 'composicao', 'composicao_industria', 'livre'] as SourceType[]).map(src => {
              const cfg = SOURCE_CONFIG[src];
              const Icon = cfg.icon;
              const active = source === src;
              return (
                <button
                  key={src}
                  onClick={() => { setSource(src); setSearchQuery(''); setSearchResults([]); setShowResults(false); }}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border font-medium transition-all ${
                    active
                      ? `${cfg.bg} border-current shadow-sm`
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {cfg.label}
                </button>
              );
            })}
          </div>

          {source !== 'livre' && (
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              {searching && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
              )}
              <input
                ref={searchRef}
                type="text"
                placeholder={`Buscar ${SOURCE_CONFIG[source].label.toLowerCase()}...`}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => { if (searchQuery.length >= 2) setShowResults(true); }}
                className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-orange-400 focus:border-orange-300"
              />
              {showResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-md z-20">
                  {searchResults.map(item => {
                    const cfg = SOURCE_CONFIG[item.type];
                    return (
                      <button
                        key={`${item.type}-${item.id}`}
                        onClick={() => addRowFromCatalog(item)}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-orange-50 transition-colors text-left border-b border-gray-50 last:border-0"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-gray-800 truncate">{item.name}</span>
                          <span className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border ${cfg.bg}`}>
                            {cfg.label}
                          </span>
                        </div>
                        <div className="flex-shrink-0 ml-2 text-right">
                          <span className="text-xs text-gray-400">{item.unit}</span>
                          {item.unit_price > 0 && (
                            <span className="block text-xs text-emerald-600 font-medium">{fmtBRL(item.unit_price)}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {showResults && !searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 border border-gray-200 rounded-lg bg-white shadow-md z-20 px-3 py-2">
                  <span className="text-xs text-gray-400">Nenhum resultado encontrado</span>
                </div>
              )}
            </div>
          )}

          {source === 'livre' && (
            <div className="flex gap-2 items-center">
              <input
                type="text"
                placeholder="Descricao do item (ex: Eletricista - pontos instalados)"
                value={newRow.description}
                onChange={e => setNewRow(p => ({ ...p, description: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') addFreeRow(); }}
                className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-orange-400"
              />
              <select
                value={newRow.unit}
                onChange={e => setNewRow(p => ({ ...p, unit: e.target.value }))}
                className="w-16 px-1.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-orange-400"
              >
                {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <input
                type="number"
                placeholder="Qtd"
                value={newRow.quantity}
                onChange={e => setNewRow(p => ({ ...p, quantity: e.target.value }))}
                className="w-20 px-2 py-1.5 text-xs border border-gray-200 rounded-lg text-right focus:ring-1 focus:ring-orange-400"
              />
              <input
                type="number"
                placeholder="R$ Unit."
                value={newRow.unit_price}
                onChange={e => setNewRow(p => ({ ...p, unit_price: e.target.value }))}
                className="w-24 px-2 py-1.5 text-xs border border-gray-200 rounded-lg text-right focus:ring-1 focus:ring-orange-400"
              />
              {newRow.description && newRow.quantity && (
                <span className="text-xs text-orange-600 font-medium w-24 text-right flex-shrink-0">
                  {fmtBRL((parseFloat(newRow.quantity) || 0) * (parseFloat(newRow.unit_price) || 0))}
                </span>
              )}
              <button
                onClick={addFreeRow}
                disabled={!newRow.description.trim()}
                className="px-3 py-1.5 bg-orange-500 text-white text-xs rounded-lg hover:bg-orange-600 disabled:opacity-40 flex-shrink-0"
              >
                Adicionar
              </button>
            </div>
          )}
        </div>
      )}

      {!addingNew && (
        <div className="px-4 py-2 bg-white border-t border-gray-50">
          <button
            onClick={() => { setAddingNew(true); setTimeout(() => searchRef.current?.focus(), 50); }}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-orange-600 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar linha
          </button>
        </div>
      )}
    </div>
  );
}
