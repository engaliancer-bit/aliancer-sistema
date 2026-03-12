import React, { useState, useCallback, useMemo, memo } from 'react';
import { Plus, Trash2, Save, X, AlertCircle, RefreshCw } from 'lucide-react';
import VirtualizedMaterialSelector from './VirtualizedMaterialSelector';

interface PurchaseItem {
  id: string;
  product_name: string;
  material_id?: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  supplier_id: string;
  cost_category_id: string;
  is_for_resale: boolean;
  is_asset: boolean;
  notes: string;
}

interface PurchaseItemRowProps {
  item: PurchaseItem;
  suppliers: Array<{ id: string; name: string }>;
  costCategories: Array<{ id: string; name: string; type: string }>;
  onQuantityChange: (id: string, value: number) => void;
  onUnitCostChange: (id: string, value: number) => void;
  onProductNameChange: (id: string, value: string) => void;
  onMaterialSelect: (id: string, material: any) => void;
  onMaterialClear: (id: string) => void;
  onUnitChange: (id: string, value: string) => void;
  onSupplierChange: (id: string, value: string) => void;
  onCategoryChange: (id: string, value: string) => void;
  onResaleChange: (id: string, value: boolean) => void;
  onAssetChange: (id: string, value: boolean) => void;
  onNotesChange: (id: string, value: string) => void;
  onRemove: (id: string) => void;
  subtotal: number;
  getCategoryTypeLabel: (type: string) => string;
  hasUnitMismatch: boolean;
  onConvertToTonnes: (id: string) => void;
}

const PurchaseItemRow = memo(({
  item,
  suppliers,
  costCategories,
  onQuantityChange,
  onUnitCostChange,
  onProductNameChange,
  onMaterialSelect,
  onMaterialClear,
  onUnitChange,
  onSupplierChange,
  onCategoryChange,
  onResaleChange,
  onAssetChange,
  onNotesChange,
  onRemove,
  subtotal,
  getCategoryTypeLabel,
  hasUnitMismatch,
  onConvertToTonnes,
}: PurchaseItemRowProps) => {
  return (
    <React.Fragment>
    <tr className={`hover:bg-gray-50 ${hasUnitMismatch ? 'bg-orange-50' : ''}`}>
      <td className="px-4 py-3 border-b">
        <VirtualizedMaterialSelector
          value={item.product_name}
          selectedMaterialId={item.material_id}
          onSelect={(material) => onMaterialSelect(item.id, material)}
          onClear={() => onMaterialClear(item.id)}
          placeholder="Buscar ou digitar insumo..."
        />
      </td>
      <td className="px-4 py-3 border-b">
        <input
          type="number"
          step="0.001"
          value={item.quantity || ''}
          onChange={(e) => onQuantityChange(item.id, parseFloat(e.target.value) || 0)}
          className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent text-sm text-right"
          placeholder="0.000"
        />
      </td>
      <td className="px-4 py-3 border-b">
        <select
          value={item.unit}
          onChange={(e) => onUnitChange(item.id, e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent text-sm"
        >
          <option value="kg">kg</option>
          <option value="m³">m³</option>
          <option value="un">un</option>
          <option value="L">L</option>
          <option value="sc">sc</option>
          <option value="t">t</option>
        </select>
      </td>
      <td className="px-4 py-3 border-b">
        <input
          type="number"
          step="0.01"
          value={item.unit_cost || ''}
          onChange={(e) => onUnitCostChange(item.id, parseFloat(e.target.value) || 0)}
          className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent text-sm text-right"
          placeholder="0.00"
        />
      </td>
      <td className="px-4 py-3 border-b text-right">
        <span className="font-semibold text-gray-900">
          R$ {subtotal.toFixed(2)}
        </span>
      </td>
      <td className="px-4 py-3 border-b">
        <select
          value={item.supplier_id}
          onChange={(e) => onSupplierChange(item.id, e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent text-sm"
        >
          <option value="">Selecione</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3 border-b">
        <select
          value={item.cost_category_id}
          onChange={(e) => onCategoryChange(item.id, e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent text-sm"
        >
          <option value="">Selecione</option>
          {costCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} - {getCategoryTypeLabel(c.type)}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3 border-b text-center">
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={item.is_for_resale}
              onChange={(e) => onResaleChange(item.id, e.target.checked)}
              className="w-4 h-4 text-[#0A7EC2] rounded focus:ring-[#0A7EC2]"
            />
            <span>Revenda</span>
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={item.is_asset}
              onChange={(e) => onAssetChange(item.id, e.target.checked)}
              className="w-4 h-4 text-[#0A7EC2] rounded focus:ring-[#0A7EC2]"
            />
            <span>Ativo</span>
          </label>
        </div>
      </td>
      <td className="px-4 py-3 border-b">
        <input
          type="text"
          value={item.notes}
          onChange={(e) => onNotesChange(item.id, e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent text-sm"
          placeholder="Observações"
        />
      </td>
      <td className="px-4 py-3 border-b text-center">
        <button
          onClick={() => onRemove(item.id)}
          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="Remover item"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
    {hasUnitMismatch && (
      <tr className="bg-orange-50">
        <td colSpan={10} className="px-4 pb-2 border-b">
          <div className="flex items-center justify-between gap-3 bg-orange-100 border border-orange-300 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2 text-orange-800 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-orange-600" />
              <span>
                <strong>Atencao:</strong> "{item.product_name}" e cadastrado em <strong>toneladas (t)</strong>.
                A quantidade {item.quantity.toLocaleString('pt-BR')} parece estar em kg.
                Deseja converter para <strong>{(item.quantity / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} t</strong>?
              </span>
            </div>
            <button
              type="button"
              onClick={() => onConvertToTonnes(item.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white text-xs rounded-lg hover:bg-orange-700 transition-colors flex-shrink-0 font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Converter para toneladas
            </button>
          </div>
        </td>
      </tr>
    )}
    </React.Fragment>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.item === nextProps.item &&
    prevProps.subtotal === nextProps.subtotal &&
    prevProps.suppliers === nextProps.suppliers &&
    prevProps.costCategories === nextProps.costCategories &&
    prevProps.hasUnitMismatch === nextProps.hasUnitMismatch
  );
});

PurchaseItemRow.displayName = 'PurchaseItemRow';

interface PurchaseFormOptimizedProps {
  suppliers: Array<{ id: string; name: string }>;
  costCategories: Array<{ id: string; name: string; type: string }>;
  purchaseDate: string;
  onPurchaseDateChange: (date: string) => void;
  onSave: (items: PurchaseItem[]) => Promise<void>;
  onCancel: () => void;
  getCategoryTypeLabel: (type: string) => string;
}

export default function PurchaseFormOptimized({
  suppliers,
  costCategories,
  purchaseDate,
  onPurchaseDateChange,
  onSave,
  onCancel,
  getCategoryTypeLabel,
}: PurchaseFormOptimizedProps) {
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [saving, setSaving] = useState(false);

  const addNewItem = useCallback(() => {
    const newItem: PurchaseItem = {
      id: `temp-${Date.now()}-${Math.random()}`,
      product_name: '',
      quantity: 0,
      unit: 'kg',
      unit_cost: 0,
      supplier_id: '',
      cost_category_id: '',
      is_for_resale: false,
      is_asset: false,
      notes: '',
    };
    setItems((prev) => [...prev, newItem]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateItem = useCallback((id: string, field: keyof PurchaseItem, value: any) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  }, []);

  const onQuantityChange = useCallback((id: string, value: number) => {
    updateItem(id, 'quantity', value);
  }, [updateItem]);

  const onUnitCostChange = useCallback((id: string, value: number) => {
    updateItem(id, 'unit_cost', value);
  }, [updateItem]);

  const onProductNameChange = useCallback((id: string, value: string) => {
    updateItem(id, 'product_name', value);
  }, [updateItem]);

  const onMaterialSelect = useCallback((id: string, material: any) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              material_id: material.id,
              product_name: material.name,
              unit: material.unit,
              unit_cost: material.cost_per_unit || item.unit_cost,
              is_for_resale: material.for_resale || item.is_for_resale,
            }
          : item
      )
    );
  }, []);

  const onMaterialClear = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              material_id: undefined,
              product_name: '',
            }
          : item
      )
    );
  }, []);

  const onUnitChange = useCallback((id: string, value: string) => {
    updateItem(id, 'unit', value);
  }, [updateItem]);

  const onSupplierChange = useCallback((id: string, value: string) => {
    updateItem(id, 'supplier_id', value);
  }, [updateItem]);

  const onCategoryChange = useCallback((id: string, value: string) => {
    updateItem(id, 'cost_category_id', value);
  }, [updateItem]);

  const onResaleChange = useCallback((id: string, value: boolean) => {
    updateItem(id, 'is_for_resale', value);
  }, [updateItem]);

  const onAssetChange = useCallback((id: string, value: boolean) => {
    updateItem(id, 'is_asset', value);
  }, [updateItem]);

  const onNotesChange = useCallback((id: string, value: string) => {
    updateItem(id, 'notes', value);
  }, [updateItem]);

  const onConvertToTonnes = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity: Math.round((item.quantity / 1000) * 1000) / 1000,
              unit: 't',
            }
          : item
      )
    );
  }, []);

  const itemMismatchMap = useMemo(() => {
    return items.reduce((acc, item) => {
      acc[item.id] =
        item.unit === 'kg' &&
        item.quantity > 999 &&
        item.material_id !== undefined;
      return acc;
    }, {} as Record<string, boolean>);
  }, [items]);

  const itemSubtotals = useMemo(() => {
    return items.reduce((acc, item) => {
      acc[item.id] = item.quantity * item.unit_cost;
      return acc;
    }, {} as Record<string, number>);
  }, [items]);

  const totalGeral = useMemo(() => {
    return Object.values(itemSubtotals).reduce((sum, value) => sum + value, 0);
  }, [itemSubtotals]);

  const handleSave = async () => {
    const validItems = items.filter(
      (item) =>
        item.product_name.trim() !== '' &&
        item.quantity > 0 &&
        item.unit_cost > 0 &&
        item.cost_category_id !== ''
    );

    if (validItems.length === 0) {
      alert('Adicione pelo menos um item válido com todos os campos obrigatórios preenchidos.');
      return;
    }

    try {
      setSaving(true);
      await onSave(validItems);
      setItems([]);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar os itens de compra');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h4 className="text-lg font-semibold text-gray-900">
          Cadastrar Múltiplos Itens de Compra
        </h4>
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data da Compra *
            </label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => onPurchaseDateChange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="mb-4">
        <button
          onClick={addNewItem}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Adicionar Item
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Clique em "Adicionar Item" para começar
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">
                  Produto *
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">
                  Qtd *
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">
                  Unid *
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">
                  Custo Unit. (R$) *
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase border-b">
                  Subtotal (R$)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">
                  Fornecedor
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">
                  Categoria *
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase border-b">
                  Tipo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">
                  Obs
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase border-b">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <PurchaseItemRow
                  key={item.id}
                  item={item}
                  suppliers={suppliers}
                  costCategories={costCategories}
                  onQuantityChange={onQuantityChange}
                  onUnitCostChange={onUnitCostChange}
                  onProductNameChange={onProductNameChange}
                  onMaterialSelect={onMaterialSelect}
                  onMaterialClear={onMaterialClear}
                  onUnitChange={onUnitChange}
                  onSupplierChange={onSupplierChange}
                  onCategoryChange={onCategoryChange}
                  onResaleChange={onResaleChange}
                  onAssetChange={onAssetChange}
                  onNotesChange={onNotesChange}
                  onRemove={removeItem}
                  subtotal={itemSubtotals[item.id] || 0}
                  getCategoryTypeLabel={getCategoryTypeLabel}
                  hasUnitMismatch={itemMismatchMap[item.id] || false}
                  onConvertToTonnes={onConvertToTonnes}
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50">
                <td colSpan={4} className="px-4 py-4 text-right font-semibold text-gray-900 border-t">
                  Total Geral:
                </td>
                <td className="px-4 py-4 text-right font-bold text-[#0A7EC2] text-lg border-t">
                  R$ {totalGeral.toFixed(2)}
                </td>
                <td colSpan={5} className="border-t"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
        <button
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          disabled={saving}
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={items.length === 0 || saving}
          className="flex items-center gap-2 px-6 py-2 bg-[#0A7EC2] text-white rounded-lg hover:bg-[#0968A8] transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : `Salvar ${items.length} ${items.length === 1 ? 'Item' : 'Itens'}`}
        </button>
      </div>
    </div>
  );
}
