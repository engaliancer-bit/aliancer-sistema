import { useState, useCallback, useMemo, useEffect } from 'react';
import { Plus, Trash2, Save, ShoppingCart, X, FileText, CreditCard, Calendar, AlertCircle } from 'lucide-react';
import VirtualizedMaterialSelector from './VirtualizedMaterialSelector';
import { supabase } from '../lib/supabase';

interface InvoiceItem {
  id: string;
  material_id?: string;
  product_name: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  item_category: string;
  cost_category_id: string;
}

interface Installment {
  number: number;
  dueDate: string;
  amount: number;
}

interface Supplier {
  id: string;
  name: string;
}

interface CostCategory {
  id: string;
  name: string;
  type: string;
}

interface InvoicePurchaseModalProps {
  suppliers: Supplier[];
  initialMaterial?: {
    id: string;
    name: string;
    unit: string;
    unit_cost: number;
    supplier_id?: string | null;
  };
  onSave: (data: InvoicePurchaseData) => Promise<void>;
  onClose: () => void;
}

export interface InvoicePurchaseData {
  invoiceNumber: string;
  purchaseDate: string;
  supplierId: string;
  notes: string;
  paymentType: 'vista' | 'prazo';
  firstDueDate: string;
  installments: Installment[];
  items: InvoiceItem[];
  totalAmount: number;
}

const ITEM_CATEGORY_OPTIONS = [
  { value: 'insumo', label: 'Insumo' },
  { value: 'servico', label: 'Servico' },
  { value: 'manutencao', label: 'Manutencao' },
  { value: 'investimento', label: 'Investimento' },
];

export default function InvoicePurchaseModal({
  suppliers,
  initialMaterial,
  onSave,
  onClose,
}: InvoicePurchaseModalProps) {
  const today = new Date().toISOString().split('T')[0];

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [supplierId, setSupplierId] = useState(initialMaterial?.supplier_id || '');
  const [notes, setNotes] = useState('');
  const [paymentType, setPaymentType] = useState<'vista' | 'prazo'>('vista');
  const [installmentsCount, setInstallmentsCount] = useState(1);
  const [firstDueDate, setFirstDueDate] = useState(today);
  const [installmentsList, setInstallmentsList] = useState<Installment[]>([]);
  const [saving, setSaving] = useState(false);
  const [costCategories, setCostCategories] = useState<CostCategory[]>([]);
  const [allMaterials, setAllMaterials] = useState<{ id: string; name: string; unit: string; unit_cost?: number; resale_enabled?: boolean }[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      const [catResult, matResult] = await Promise.all([
        supabase.from('cost_categories').select('id, name, type').eq('is_active', true).order('name'),
        supabase.from('materials').select('id, name, unit, unit_cost, resale_enabled').order('name'),
      ]);
      if (cancelled) return;
      if (catResult.data) setCostCategories(catResult.data);
      if (matResult.data) setAllMaterials(matResult.data);
      setMaterialsLoading(false);
    };

    loadData();
    return () => { cancelled = true; };
  }, []);

  const defaultCategoryId = useMemo(() => {
    const cat = costCategories.find(c => c.type === 'direct_production');
    return cat?.id || '';
  }, [costCategories]);

  const createInitialItem = useCallback((): InvoiceItem => {
    if (initialMaterial) {
      return {
        id: `item-${Date.now()}-${Math.random()}`,
        material_id: initialMaterial.id,
        product_name: initialMaterial.name,
        quantity: 0,
        unit: initialMaterial.unit,
        unit_cost: initialMaterial.unit_cost,
        item_category: 'insumo',
        cost_category_id: defaultCategoryId,
      };
    }
    return {
      id: `item-${Date.now()}-${Math.random()}`,
      product_name: '',
      quantity: 0,
      unit: 'kg',
      unit_cost: 0,
      item_category: 'insumo',
      cost_category_id: defaultCategoryId,
    };
  }, [initialMaterial, defaultCategoryId]);

  const [items, setItems] = useState<InvoiceItem[]>(() => [createInitialItem()]);

  useEffect(() => {
    if (defaultCategoryId && items.length === 1 && !items[0].cost_category_id) {
      setItems(prev => prev.map(item => ({
        ...item,
        cost_category_id: item.cost_category_id || defaultCategoryId,
      })));
    }
  }, [defaultCategoryId]);

  const addItem = useCallback(() => {
    setItems(prev => [...prev, {
      id: `item-${Date.now()}-${Math.random()}`,
      product_name: '',
      quantity: 0,
      unit: 'kg',
      unit_cost: 0,
      item_category: 'insumo',
      cost_category_id: defaultCategoryId,
    }]);
  }, [defaultCategoryId]);

  const removeItem = useCallback((id: string) => {
    setItems(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter(item => item.id !== id);
    });
  }, []);

  const updateItem = useCallback((id: string, field: keyof InvoiceItem, value: any) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  }, []);

  const handleMaterialSelect = useCallback((id: string, material: any) => {
    setItems(prev => prev.map(item =>
      item.id === id ? {
        ...item,
        material_id: material.id,
        product_name: material.name,
        unit: material.unit,
        unit_cost: material.unit_cost || item.unit_cost,
        item_category: 'insumo',
        cost_category_id: item.cost_category_id || defaultCategoryId,
      } : item
    ));
  }, [defaultCategoryId]);

  const handleMaterialClear = useCallback((id: string) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, material_id: undefined, product_name: '' } : item
    ));
  }, []);

  const itemSubtotals = useMemo(() => {
    return items.reduce((acc, item) => {
      acc[item.id] = item.quantity * item.unit_cost;
      return acc;
    }, {} as Record<string, number>);
  }, [items]);

  const totalGeral = useMemo(() => {
    return Object.values(itemSubtotals).reduce((sum, v) => sum + v, 0);
  }, [itemSubtotals]);

  const calculateInstallments = useCallback(() => {
    if (totalGeral <= 0 || !firstDueDate) return;

    const perInstallment = totalGeral / installmentsCount;
    const list: Installment[] = [];
    const baseDate = new Date(firstDueDate + 'T12:00:00');

    for (let i = 0; i < installmentsCount; i++) {
      const d = new Date(baseDate);
      d.setMonth(d.getMonth() + i);
      list.push({
        number: i + 1,
        dueDate: d.toISOString().split('T')[0],
        amount: Math.round(perInstallment * 100) / 100,
      });
    }

    const diff = Math.round((totalGeral - list.reduce((s, i) => s + i.amount, 0)) * 100) / 100;
    if (diff !== 0 && list.length > 0) {
      list[list.length - 1].amount = Math.round((list[list.length - 1].amount + diff) * 100) / 100;
    }

    setInstallmentsList(list);
  }, [totalGeral, installmentsCount, firstDueDate]);

  const updateInstallmentDate = useCallback((index: number, newDate: string) => {
    setInstallmentsList(prev => prev.map((inst, i) =>
      i === index ? { ...inst, dueDate: newDate } : inst
    ));
  }, []);

  const updateInstallmentAmount = useCallback((index: number, newAmount: string) => {
    setInstallmentsList(prev => prev.map((inst, i) =>
      i === index ? { ...inst, amount: parseFloat(newAmount) || 0 } : inst
    ));
  }, []);

  const validItems = useMemo(() => {
    return items.filter(item =>
      item.product_name.trim() !== '' && item.quantity > 0 && item.unit_cost > 0
    );
  }, [items]);

  const itemsWithoutCategory = useMemo(() => {
    return validItems.filter(item => !item.item_category);
  }, [validItems]);

  const handleSubmit = async () => {
    if (validItems.length === 0) {
      alert('Adicione pelo menos um item com produto, quantidade e custo preenchidos.');
      return;
    }

    if (paymentType === 'prazo' && installmentsList.length === 0) {
      alert('Clique em "Gerar Parcelas" para configurar o parcelamento antes de salvar.');
      return;
    }

    const finalInstallments: Installment[] = paymentType === 'vista'
      ? [{ number: 1, dueDate: firstDueDate, amount: totalGeral }]
      : installmentsList;

    try {
      setSaving(true);
      await onSave({
        invoiceNumber,
        purchaseDate,
        supplierId,
        notes,
        paymentType,
        firstDueDate,
        installments: finalInstallments,
        items: validItems,
        totalAmount: totalGeral,
      });
    } catch (error: any) {
      console.error('Erro ao salvar compra:', error);
      alert(`Erro ao salvar compra: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-[#0A7EC2] to-[#0968A8] rounded-t-xl">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-white" />
            <div>
              <h3 className="text-lg font-bold text-white">Registrar Compra por Nota Fiscal</h3>
              <p className="text-sm text-blue-100">
                Cadastre todos os itens da nota, classifique os custos e defina o pagamento unificado
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                N. da Nota Fiscal
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent text-sm"
                placeholder="Ex: 12345"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data da Compra *
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={e => setPurchaseDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fornecedor *
              </label>
              <select
                value={supplierId}
                onChange={e => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent text-sm"
              >
                <option value="">Selecione...</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observacoes
              </label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent text-sm"
                placeholder="Observacoes da nota"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
                  Itens da Nota
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  Classifique o tipo e categoria de custo de cada item para controle financeiro automatico
                </p>
              </div>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Adicionar Item
              </button>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full border-collapse" style={{ minWidth: '1050px' }}>
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase border-b" style={{ minWidth: '300px' }}>
                      Insumo *
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase border-b w-24">
                      Qtd *
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase border-b w-20">
                      Unid
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase border-b w-28">
                      Custo Unit. *
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase border-b w-32">
                      Tipo
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase border-b" style={{ minWidth: '180px' }}>
                      Categoria de Custo
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase border-b w-28">
                      Subtotal
                    </th>
                    <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase border-b w-12">
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const missingCategory = item.product_name.trim() !== '' && item.quantity > 0 && item.unit_cost > 0 && !item.item_category;
                    return (
                      <tr key={item.id} className={`hover:bg-gray-50 ${missingCategory ? 'bg-amber-50' : ''}`}>
                        <td className="px-3 py-2 border-b">
                          <VirtualizedMaterialSelector
                            value={item.product_name}
                            selectedMaterialId={item.material_id}
                            onSelect={(mat) => handleMaterialSelect(item.id, mat)}
                            onClear={() => handleMaterialClear(item.id)}
                            placeholder="Buscar insumo..."
                            preloadedMaterials={allMaterials}
                            preloadedLoading={materialsLoading}
                          />
                        </td>
                        <td className="px-3 py-2 border-b">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.quantity || ''}
                            onChange={e => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent text-sm text-right"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-3 py-2 border-b">
                          <select
                            value={item.unit}
                            onChange={e => updateItem(item.id, 'unit', e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent text-sm"
                          >
                            <option value="kg">kg</option>
                            <option value="m³">m3</option>
                            <option value="un">un</option>
                            <option value="L">L</option>
                            <option value="sc">sc</option>
                            <option value="t">t</option>
                            <option value="m">m</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 border-b">
                          <input
                            type="number"
                            step="0.0001"
                            min="0"
                            value={item.unit_cost || ''}
                            onChange={e => updateItem(item.id, 'unit_cost', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent text-sm text-right"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-3 py-2 border-b">
                          <select
                            value={item.item_category}
                            onChange={e => updateItem(item.id, 'item_category', e.target.value)}
                            className={`w-full px-2 py-1.5 border rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent text-sm ${
                              missingCategory ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
                            }`}
                          >
                            {ITEM_CATEGORY_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 border-b">
                          <select
                            value={item.cost_category_id}
                            onChange={e => updateItem(item.id, 'cost_category_id', e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent text-sm"
                          >
                            <option value="">Sem categoria</option>
                            {costCategories.map(cat => (
                              <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 border-b text-right">
                          <span className="font-semibold text-gray-900 text-sm">
                            {formatCurrency(itemSubtotals[item.id] || 0)}
                          </span>
                        </td>
                        <td className="px-3 py-2 border-b text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30"
                            disabled={items.length <= 1}
                            title="Remover item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[#0A7EC2]/5">
                    <td colSpan={6} className="px-3 py-3 text-right font-semibold text-gray-800 border-t text-sm">
                      Total da Nota:
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-[#0A7EC2] text-base border-t">
                      {formatCurrency(totalGeral)}
                    </td>
                    <td className="border-t" />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-gray-500">
                {validItems.length} de {items.length} {items.length === 1 ? 'item valido' : 'itens validos'}
              </p>
              {itemsWithoutCategory.length > 0 && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {itemsWithoutCategory.length} {itemsWithoutCategory.length === 1 ? 'item sem tipo' : 'itens sem tipo'} definido
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-gray-200 pt-3">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-gray-600" />
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Forma de Pagamento da Nota
              </h4>
            </div>

            <div className="flex items-start gap-4 flex-wrap">
              <div className="flex gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentType('vista');
                    setInstallmentsList([]);
                  }}
                  className={`px-4 py-2 border-2 rounded-lg transition-all text-left ${
                    paymentType === 'vista'
                      ? 'border-green-500 bg-green-50 text-green-800 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <div className="font-semibold text-sm">A Vista</div>
                  <div className="text-xs opacity-75">Pagamento unico</div>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentType('prazo')}
                  className={`px-4 py-2 border-2 rounded-lg transition-all text-left ${
                    paymentType === 'prazo'
                      ? 'border-[#0A7EC2] bg-blue-50 text-blue-800 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <div className="font-semibold text-sm">A Prazo</div>
                  <div className="text-xs opacity-75">Parcelado</div>
                </button>
              </div>

              {paymentType === 'vista' && (
                <div className="flex items-end gap-3 flex-wrap">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Data de Vencimento
                    </label>
                    <input
                      type="date"
                      value={firstDueDate}
                      onChange={e => setFirstDueDate(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
              )}

              {paymentType === 'prazo' && (
                <div className="flex items-end gap-3 flex-wrap flex-1">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Parcelas
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={installmentsCount}
                      onChange={e => {
                        setInstallmentsCount(parseInt(e.target.value) || 1);
                        setInstallmentsList([]);
                      }}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Venc. 1a Parcela
                    </label>
                    <input
                      type="date"
                      value={firstDueDate}
                      onChange={e => {
                        setFirstDueDate(e.target.value);
                        setInstallmentsList([]);
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={calculateInstallments}
                    disabled={totalGeral <= 0}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#0A7EC2] text-white text-sm rounded-lg hover:bg-[#0968A8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Calendar className="w-4 h-4" />
                    Gerar
                  </button>
                  {installmentsList.length > 0 && (
                    <button
                      type="button"
                      onClick={calculateInstallments}
                      className="text-xs text-[#0A7EC2] hover:text-[#0968A8] font-medium self-end pb-2"
                    >
                      Recalcular
                    </button>
                  )}
                </div>
              )}
            </div>

            {paymentType === 'prazo' && installmentsList.length > 0 && (
              <div className="mt-3 bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {installmentsList.map((inst, idx) => (
                    <div key={inst.number} className="flex flex-col gap-1 bg-white rounded-lg p-2 border border-gray-200">
                      <span className="text-xs font-semibold text-gray-500">
                        {inst.number}/{installmentsCount}
                      </span>
                      <input
                        type="date"
                        value={inst.dueDate}
                        onChange={e => updateInstallmentDate(idx, e.target.value)}
                        className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-[#0A7EC2] focus:border-transparent"
                      />
                      <div className="relative">
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={inst.amount}
                          onChange={e => updateInstallmentAmount(idx, e.target.value)}
                          className="w-full pl-6 pr-1 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-[#0A7EC2] focus:border-transparent text-right"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-gray-300 flex justify-between items-center">
                  <span className="text-xs font-semibold text-gray-700">Total das Parcelas:</span>
                  <span className={`text-sm font-bold ${
                    Math.abs(installmentsList.reduce((s, i) => s + i.amount, 0) - totalGeral) < 0.02
                      ? 'text-green-700' : 'text-red-600'
                  }`}>
                    {formatCurrency(installmentsList.reduce((s, i) => s + i.amount, 0))}
                  </span>
                </div>
                {Math.abs(installmentsList.reduce((s, i) => s + i.amount, 0) - totalGeral) >= 0.02 && (
                  <p className="text-xs text-red-600 mt-1">
                    A soma das parcelas difere do total da nota. Ajuste os valores.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-sm font-medium text-emerald-800 mb-2">
              Resumo da compra:
            </p>
            <ul className="text-sm text-emerald-700 space-y-1 ml-4 list-disc">
              <li>
                {validItems.length} {validItems.length === 1 ? 'item sera adicionado' : 'itens serao adicionados'} ao estoque
              </li>
              <li>
                1 registro de compra (NF) sera criado com todos os itens classificados
              </li>
              <li>
                {paymentType === 'vista'
                  ? '1 conta a pagar (a vista) sera gerada para o valor total da nota'
                  : `${installmentsList.length || installmentsCount} parcela(s) serao geradas para o valor total da nota`
                }
              </li>
            </ul>
            {paymentType === 'prazo' && (
              <p className="text-xs text-emerald-600 mt-2 italic">
                O boleto/parcela cobre todos os itens da nota -- sem parcelas separadas por item.
              </p>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Total: <span className="font-bold text-[#0A7EC2] text-base">{formatCurrency(totalGeral)}</span>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={validItems.length === 0 || saving}
              className="flex items-center gap-2 px-5 py-2 bg-[#0A7EC2] text-white rounded-lg hover:bg-[#0968A8] transition-colors font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : 'Registrar Compra'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
