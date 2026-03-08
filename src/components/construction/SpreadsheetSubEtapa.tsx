import { useState, useCallback, useRef } from 'react';
import { Plus, Trash2, Search, X, Edit2, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { BudgetElement, fmtBRL } from './types';

interface CatalogItem {
  id: string;
  name: string;
  unit: string;
  unit_price: number;
  type: 'material' | 'product';
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
    }))
  );

  const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [addingNew, setAddingNew] = useState(false);
  const [newRow, setNewRow] = useState({ description: '', unit: 'un', quantity: '1', unit_price: '' });
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [showCatalog, setShowCatalog] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(subEtapaName);
  const catalogRef = useRef<HTMLInputElement>(null);

  const subTotal = rows.reduce((s, r) => s + (r.total_price || 0), 0);

  const notifyTotal = useCallback((updatedRows: RowDraft[]) => {
    const t = updatedRows.reduce((s, r) => s + (r.total_price || 0), 0);
    onTotalChange(subEtapaName, t);
  }, [subEtapaName, onTotalChange]);

  const loadCatalog = useCallback(async () => {
    if (catalog.length > 0) return;
    const [{ data: mats }, { data: prods }] = await Promise.all([
      supabase.from('materials').select('id,name,unit,unit_cost').order('name'),
      supabase.from('products').select('id,name,unit,sale_price,final_sale_price').order('name'),
    ]);
    const items: CatalogItem[] = [
      ...(mats || []).map(m => ({ id: m.id, name: m.name, unit: m.unit, unit_price: m.unit_cost || 0, type: 'material' as const })),
      ...(prods || []).map(p => ({ id: p.id, name: p.name, unit: p.unit, unit_price: p.final_sale_price || p.sale_price || 0, type: 'product' as const })),
    ];
    setCatalog(items);
  }, [catalog.length]);

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
        params: { quantidade: updated.quantity, custo_unitario: updated.unit_price },
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
    setShowCatalog(false);
    setCatalogSearch('');
    const { data, error } = await supabase.from('budget_elements').insert({
      budget_id: budgetId,
      wbs_step_id: wbsStepId,
      sub_etapa: subEtapaName,
      element_type: 'outros',
      label: item.name,
      params: { quantidade: 1, custo_unitario: item.unit_price },
      calculated_unit: item.unit,
      source: 'manual',
    }).select('id').single();
    if (error || !data) return;
    const newRow: RowDraft = {
      id: data.id,
      element_id: data.id,
      description: item.name,
      unit: item.unit,
      quantity: 1,
      unit_price: item.unit_price,
      total_price: item.unit_price,
      material_id: item.type === 'material' ? item.id : null,
      product_id: item.type === 'product' ? item.id : null,
    };
    const newRows = [...rows, newRow];
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
    };
    const newRows = [...rows, row];
    setRows(newRows);
    notifyTotal(newRows);
    setNewRow({ description: '', unit: 'un', quantity: '1', unit_price: '' });
    setAddingNew(false);
    onElementsChange();
  };

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== subEtapaName) {
      onRenameSubEtapa(trimmed);
    }
    setIsRenaming(false);
  };

  const filteredCatalog = catalog.filter(c =>
    catalogSearch.length >= 2 && c.name.toLowerCase().includes(catalogSearch.toLowerCase())
  );

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
                  {editingCell?.rowId === row.id && editingCell.field === 'description' ? (
                    <input
                      autoFocus
                      type="text"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={() => commitEdit(row.id, 'description')}
                      onKeyDown={e => { if (e.key === 'Enter') commitEdit(row.id, 'description'); if (e.key === 'Escape') setEditingCell(null); }}
                      className="w-full text-sm border border-orange-300 rounded px-2 py-0.5 focus:ring-1 focus:ring-orange-400 bg-white"
                    />
                  ) : (
                    <button
                      onClick={() => startEdit(row.id, 'description', row.description)}
                      className="w-full text-left text-gray-800 hover:bg-orange-100 rounded px-2 py-0.5 transition-colors truncate"
                    >
                      {row.description || <span className="text-gray-400 italic">sem descricao</span>}
                    </button>
                  )}
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
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-gray-600">Adicionar item</span>
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                ref={catalogRef}
                type="text"
                placeholder="Buscar insumo ou produto do catalogo..."
                value={catalogSearch}
                onChange={e => { setCatalogSearch(e.target.value); if (!showCatalog) { loadCatalog(); setShowCatalog(true); } }}
                onFocus={() => { loadCatalog(); setShowCatalog(true); }}
                className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-orange-400"
              />
            </div>
            <button onClick={() => { setAddingNew(false); setShowCatalog(false); setCatalogSearch(''); }}
              className="p-1 text-gray-400 hover:bg-gray-100 rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {showCatalog && catalogSearch.length >= 2 && filteredCatalog.length > 0 && (
            <div className="mb-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-sm">
              {filteredCatalog.slice(0, 20).map(c => (
                <button key={`${c.type}-${c.id}`}
                  onClick={() => addRowFromCatalog(c)}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-orange-50 transition-colors text-left border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs text-gray-800 truncate">{c.name}</span>
                    <span className={`flex-shrink-0 text-[10px] px-1 py-0.5 rounded ${c.type === 'material' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                      {c.type === 'material' ? 'Insumo' : 'Produto'}
                    </span>
                  </div>
                  <div className="flex-shrink-0 ml-2 text-right">
                    <span className="text-xs text-gray-400">{c.unit}</span>
                    {c.unit_price > 0 && <span className="block text-xs text-emerald-600 font-medium">{fmtBRL(c.unit_price)}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2 items-center">
            <input type="text" placeholder="Descricao do item" value={newRow.description}
              onChange={e => setNewRow(p => ({ ...p, description: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') addFreeRow(); }}
              className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-orange-400" />
            <select value={newRow.unit}
              onChange={e => setNewRow(p => ({ ...p, unit: e.target.value }))}
              className="w-16 px-1.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-orange-400">
              {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <input type="number" placeholder="Qtd" value={newRow.quantity}
              onChange={e => setNewRow(p => ({ ...p, quantity: e.target.value }))}
              className="w-20 px-2 py-1.5 text-xs border border-gray-200 rounded-lg text-right focus:ring-1 focus:ring-orange-400" />
            <input type="number" placeholder="R$ Unit." value={newRow.unit_price}
              onChange={e => setNewRow(p => ({ ...p, unit_price: e.target.value }))}
              className="w-24 px-2 py-1.5 text-xs border border-gray-200 rounded-lg text-right focus:ring-1 focus:ring-orange-400" />
            {newRow.description && newRow.quantity && (
              <span className="text-xs text-orange-600 font-medium w-24 text-right flex-shrink-0">
                {fmtBRL((parseFloat(newRow.quantity) || 0) * (parseFloat(newRow.unit_price) || 0))}
              </span>
            )}
            <button onClick={addFreeRow} disabled={!newRow.description.trim()}
              className="px-3 py-1.5 bg-orange-500 text-white text-xs rounded-lg hover:bg-orange-600 disabled:opacity-40 flex-shrink-0">
              Adicionar
            </button>
          </div>
        </div>
      )}

      {!addingNew && (
        <div className="px-4 py-2 bg-white border-t border-gray-50">
          <button
            onClick={() => { setAddingNew(true); loadCatalog(); setTimeout(() => catalogRef.current?.focus(), 50); }}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-orange-600 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar linha
          </button>
        </div>
      )}
    </div>
  );
}
