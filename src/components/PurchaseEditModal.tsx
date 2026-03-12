import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, Save, AlertTriangle, AlertCircle, Package, CreditCard, Calendar, User, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Supplier {
  id: string;
  name: string;
}

interface EditablePurchaseItem {
  id: string | null;
  material_id: string | null;
  product_description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  item_category: string;
  isNew?: boolean;
  toDelete?: boolean;
}

interface PayableAccount {
  id: string;
  installment_number: number;
  total_installments: number;
  amount: number;
  due_date: string;
  payment_status: 'pending' | 'paid' | 'overdue';
  description: string;
}

interface PurchaseData {
  id: string;
  invoice_number: string;
  invoice_date: string;
  supplier_id: string | null;
  total_amount: number;
  notes: string | null;
  payment_type: 'vista' | 'prazo';
  installments_count: number;
  purchase_date: string;
  total_cost: number;
  suppliers?: { name: string };
}

interface PurchaseEditModalProps {
  purchaseId: string;
  suppliers: Supplier[];
  onSave: () => void;
  onClose: () => void;
}

const ITEM_CATEGORY_OPTIONS = [
  { value: 'insumo', label: 'Insumo' },
  { value: 'servico', label: 'Servico' },
  { value: 'manutencao', label: 'Manutencao' },
  { value: 'investimento', label: 'Investimento' },
];

const UNIT_OPTIONS = ['kg', 'g', 't', 'l', 'ml', 'm', 'm²', 'm³', 'unid', 'cx', 'pct', 'sc', 'bd', 'pc'];

export default function PurchaseEditModal({ purchaseId, suppliers, onSave, onClose }: PurchaseEditModalProps) {
  const [purchase, setPurchase] = useState<PurchaseData | null>(null);
  const [items, setItems] = useState<EditablePurchaseItem[]>([]);
  const [payables, setPayables] = useState<PayableAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentType, setPaymentType] = useState<'vista' | 'prazo'>('vista');
  const [editablePayables, setEditablePayables] = useState<PayableAccount[]>([]);

  const hasPaidInstallments = payables.some(p => p.payment_status === 'paid');
  const pendingPayables = payables.filter(p => p.payment_status !== 'paid');

  const totalAmount = items
    .filter(i => !i.toDelete)
    .reduce((sum, item) => sum + item.total_price, 0);

  const loadPurchaseData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [purchaseRes, itemsRes, payablesRes] = await Promise.all([
        supabase
          .from('purchases')
          .select('*, suppliers(name)')
          .eq('id', purchaseId)
          .maybeSingle(),
        supabase
          .from('purchase_items')
          .select('*')
          .eq('purchase_id', purchaseId)
          .order('created_at'),
        supabase
          .from('payable_accounts')
          .select('*')
          .eq('purchase_id', purchaseId)
          .order('installment_number'),
      ]);

      if (purchaseRes.error) throw purchaseRes.error;
      if (itemsRes.error) throw itemsRes.error;
      if (payablesRes.error) throw payablesRes.error;

      const p = purchaseRes.data;
      if (!p) throw new Error('Compra não encontrada');

      setPurchase(p);
      setInvoiceNumber(p.invoice_number || '');
      setInvoiceDate(p.invoice_date || p.purchase_date || '');
      setSupplierId(p.supplier_id || '');
      setNotes(p.notes || '');
      setPaymentType(p.payment_type || 'vista');

      const editItems: EditablePurchaseItem[] = (itemsRes.data || []).map((item: any) => ({
        id: item.id,
        material_id: item.material_id || null,
        product_description: item.product_description,
        quantity: parseFloat(item.quantity) || 0,
        unit: item.unit || 'unid',
        unit_price: parseFloat(item.unit_price) || 0,
        total_price: parseFloat(item.total_price) || 0,
        item_category: item.item_category || 'insumo',
      }));
      setItems(editItems);

      const payableData: PayableAccount[] = (payablesRes.data || []).map((pa: any) => ({
        id: pa.id,
        installment_number: pa.installment_number,
        total_installments: pa.total_installments,
        amount: parseFloat(pa.amount) || 0,
        due_date: pa.due_date || '',
        payment_status: pa.payment_status,
        description: pa.description || '',
      }));
      setPayables(payableData);
      setEditablePayables(payableData.map(p => ({ ...p })));
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados da compra');
    } finally {
      setLoading(false);
    }
  }, [purchaseId]);

  useEffect(() => {
    loadPurchaseData();
  }, [loadPurchaseData]);

  function updateItemField(index: number, field: keyof EditablePurchaseItem, value: any) {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      if (field === 'quantity' || field === 'unit_price') {
        item.total_price = (
          (field === 'quantity' ? parseFloat(value) || 0 : item.quantity) *
          (field === 'unit_price' ? parseFloat(value) || 0 : item.unit_price)
        );
      }
      updated[index] = item;
      return updated;
    });
  }

  function markItemForDelete(index: number) {
    setItems(prev => {
      const updated = [...prev];
      if (updated[index].isNew) {
        updated.splice(index, 1);
      } else {
        updated[index] = { ...updated[index], toDelete: true };
      }
      return updated;
    });
  }

  function addNewItem() {
    setItems(prev => [
      ...prev,
      {
        id: null,
        material_id: null,
        product_description: '',
        quantity: 1,
        unit: 'unid',
        unit_price: 0,
        total_price: 0,
        item_category: 'insumo',
        isNew: true,
      },
    ]);
  }

  function updatePayableField(index: number, field: 'amount' | 'due_date', value: any) {
    setEditablePayables(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  async function handleSave() {
    const activeItems = items.filter(i => !i.toDelete);
    if (activeItems.length === 0) {
      setError('A compra precisa ter ao menos um item.');
      return;
    }
    for (const item of activeItems) {
      if (!item.product_description.trim()) {
        setError('Todos os itens precisam ter uma descrição.');
        return;
      }
      if (item.quantity <= 0 || item.unit_price <= 0) {
        setError('Quantidade e custo unitário devem ser maiores que zero.');
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      const { error: purchaseUpdateError } = await supabase
        .from('purchases')
        .update({
          invoice_number: invoiceNumber || null,
          invoice_date: invoiceDate || null,
          supplier_id: supplierId || null,
          total_amount: totalAmount,
          notes: notes || null,
          payment_type: paymentType,
        })
        .eq('id', purchaseId);

      if (purchaseUpdateError) throw purchaseUpdateError;

      const itemsToDelete = items.filter(i => i.toDelete && i.id);
      for (const item of itemsToDelete) {
        const { error: delItemError } = await supabase
          .from('purchase_items')
          .delete()
          .eq('id', item.id!);
        if (delItemError) throw delItemError;

        if (item.material_id) {
          const { data: movements } = await supabase
            .from('material_movements')
            .select('id, quantity')
            .eq('material_id', item.material_id)
            .eq('movement_type', 'entrada')
            .order('created_at', { ascending: false })
            .limit(1);

          if (movements && movements.length > 0) {
            await supabase
              .from('material_movements')
              .delete()
              .eq('id', movements[0].id);
          }
        }
      }

      const itemsToUpdate = items.filter(i => !i.isNew && !i.toDelete && i.id);
      for (const item of itemsToUpdate) {
        const { error: updItemError } = await supabase
          .from('purchase_items')
          .update({
            product_description: item.product_description,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unit_price,
            total_price: item.total_price,
            item_category: item.item_category,
          })
          .eq('id', item.id!);
        if (updItemError) throw updItemError;

        if (item.material_id) {
          const { data: movements } = await supabase
            .from('material_movements')
            .select('id')
            .eq('material_id', item.material_id)
            .eq('movement_type', 'entrada')
            .order('created_at', { ascending: false })
            .limit(1);

          if (movements && movements.length > 0) {
            await supabase
              .from('material_movements')
              .update({ quantity: item.quantity })
              .eq('id', movements[0].id);
          }
        }
      }

      const itemsToInsert = items.filter(i => i.isNew && !i.toDelete);
      for (const item of itemsToInsert) {
        const { data: newItem, error: insItemError } = await supabase
          .from('purchase_items')
          .insert({
            purchase_id: purchaseId,
            material_id: item.material_id || null,
            product_description: item.product_description,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unit_price,
            total_price: item.total_price,
            item_category: item.item_category,
            classification_status: 'pending',
          })
          .select()
          .single();
        if (insItemError) throw insItemError;

        if (item.material_id && newItem) {
          await supabase.from('material_movements').insert({
            material_id: item.material_id,
            movement_type: 'entrada',
            quantity: item.quantity,
            movement_date: invoiceDate || new Date().toISOString().split('T')[0],
            notes: `Compra editada - NF: ${invoiceNumber || 'S/N'}`,
          });
        }
      }

      for (let i = 0; i < editablePayables.length; i++) {
        const ep = editablePayables[i];
        const original = payables.find(p => p.id === ep.id);
        if (!original || original.payment_status === 'paid') continue;

        const { error: paError } = await supabase
          .from('payable_accounts')
          .update({
            amount: typeof ep.amount === 'string' ? parseFloat(ep.amount) || 0 : ep.amount,
            due_date: ep.due_date,
          })
          .eq('id', ep.id);
        if (paError) throw paError;
      }

      onSave();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar alterações');
    } finally {
      setSaving(false);
    }
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0A7EC2] rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Editar Compra</h2>
              {purchase && (
                <p className="text-sm text-gray-500">
                  NF: {purchase.invoice_number || 'S/N'} &bull; ID: {purchaseId.slice(0, 8)}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0A7EC2]"></div>
            <span className="ml-3 text-gray-600">Carregando dados...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {hasPaidInstallments && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Parcelas pagas nao podem ser editadas</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Esta compra possui parcelas ja pagas. Apenas parcelas pendentes podem ter valor e vencimento alterados.
                    O historico financeiro ja registrado sera preservado.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#0A7EC2]" />
                Dados da Nota Fiscal
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Numero da NF</label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                    placeholder="Ex: 001234"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Data da Compra</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="date"
                      value={invoiceDate}
                      onChange={e => setInvoiceDate(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fornecedor</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      value={supplierId}
                      onChange={e => setSupplierId(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent appearance-none"
                    >
                      <option value="">Selecione um fornecedor</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de Pagamento</label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      value={paymentType}
                      onChange={e => setPaymentType(e.target.value as 'vista' | 'prazo')}
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent appearance-none"
                    >
                      <option value="vista">A Vista</option>
                      <option value="prazo">A Prazo</option>
                    </select>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Observacoes</label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Observacoes sobre esta compra..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#0A7EC2]" />
                  Itens da Compra
                </h3>
                <button
                  onClick={addNewItem}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A7EC2] text-white rounded-lg text-xs font-medium hover:bg-[#0968A8] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Item
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase border-b border-gray-100">
                      <th className="px-4 py-2 text-left font-medium">Descricao</th>
                      <th className="px-4 py-2 text-center font-medium w-24">Qtde</th>
                      <th className="px-4 py-2 text-center font-medium w-20">Unidade</th>
                      <th className="px-4 py-2 text-right font-medium w-28">Custo Unit.</th>
                      <th className="px-4 py-2 text-right font-medium w-28">Total</th>
                      <th className="px-4 py-2 text-center font-medium w-28">Categoria</th>
                      <th className="px-4 py-2 text-center font-medium w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((item, index) => {
                      if (item.toDelete) return null;
                      return (
                        <tr key={item.id ?? `new-${index}`} className={item.isNew ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={item.product_description}
                              onChange={e => updateItemField(index, 'product_description', e.target.value)}
                              placeholder="Nome do produto..."
                              className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-[#0A7EC2] focus:border-[#0A7EC2]"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              value={item.quantity}
                              min="0"
                              step="0.01"
                              onChange={e => updateItemField(index, 'quantity', e.target.value)}
                              className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-center focus:ring-1 focus:ring-[#0A7EC2] focus:border-[#0A7EC2]"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <select
                              value={item.unit}
                              onChange={e => updateItemField(index, 'unit', e.target.value)}
                              className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-[#0A7EC2] focus:border-[#0A7EC2]"
                            >
                              {UNIT_OPTIONS.map(u => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              value={item.unit_price}
                              min="0"
                              step="0.01"
                              onChange={e => updateItemField(index, 'unit_price', e.target.value)}
                              className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-right focus:ring-1 focus:ring-[#0A7EC2] focus:border-[#0A7EC2]"
                            />
                          </td>
                          <td className="px-4 py-2 text-right">
                            <span className="text-sm font-medium text-gray-800">
                              {formatCurrency(item.total_price)}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <select
                              value={item.item_category}
                              onChange={e => updateItemField(index, 'item_category', e.target.value)}
                              className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-[#0A7EC2] focus:border-[#0A7EC2]"
                            >
                              {ITEM_CATEGORY_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button
                              onClick={() => markItemForDelete(index)}
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Remover item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-700 text-right">
                        Total Geral:
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-base font-bold text-[#0A7EC2]">
                          {formatCurrency(totalAmount)}
                        </span>
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {items.filter(i => !i.toDelete).length === 0 && (
                <div className="py-8 text-center text-gray-400 text-sm">
                  Nenhum item. Clique em "Adicionar Item" para incluir.
                </div>
              )}
            </div>

            {editablePayables.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#0A7EC2]" />
                    Contas a Pagar ({editablePayables.length} {editablePayables.length === 1 ? 'parcela' : 'parcelas'})
                  </h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {editablePayables.map((pa, index) => {
                    const isPaid = pa.payment_status === 'paid';
                    return (
                      <div
                        key={pa.id}
                        className={`px-4 py-3 flex items-center gap-4 ${isPaid ? 'bg-green-50' : ''}`}
                      >
                        <div className="flex-shrink-0 w-24">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            isPaid
                              ? 'bg-green-100 text-green-800'
                              : pa.payment_status === 'overdue'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {isPaid ? 'Pago' : pa.payment_status === 'overdue' ? 'Vencido' : 'Pendente'}
                          </span>
                        </div>
                        <div className="flex-1 text-xs text-gray-500 truncate">
                          {pa.total_installments > 1 ? `Parcela ${pa.installment_number}/${pa.total_installments}` : 'Pagamento unico'}
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500">Vencimento:</label>
                          <input
                            type="date"
                            value={pa.due_date}
                            disabled={isPaid}
                            onChange={e => updatePayableField(index, 'due_date', e.target.value)}
                            className={`px-2 py-1 border rounded text-xs ${
                              isPaid
                                ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'border-gray-300 focus:ring-1 focus:ring-[#0A7EC2] focus:border-[#0A7EC2]'
                            }`}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500">Valor:</label>
                          <input
                            type="number"
                            value={pa.amount}
                            disabled={isPaid}
                            min="0"
                            step="0.01"
                            onChange={e => updatePayableField(index, 'amount', parseFloat(e.target.value) || 0)}
                            className={`w-28 px-2 py-1 border rounded text-xs text-right ${
                              isPaid
                                ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'border-gray-300 focus:ring-1 focus:ring-[#0A7EC2] focus:border-[#0A7EC2]'
                            }`}
                          />
                          {isPaid && (
                            <span className="text-xs text-green-600 font-medium">
                              {formatCurrency(pa.amount)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex-shrink-0">
          <div className="text-sm text-gray-500">
            {!loading && (
              <>
                <span className="font-medium text-gray-700">
                  {items.filter(i => !i.toDelete).length} {items.filter(i => !i.toDelete).length === 1 ? 'item' : 'itens'}
                </span>
                {' &bull; '}
                <span className="font-semibold text-[#0A7EC2]">Total: {formatCurrency(totalAmount)}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="flex items-center gap-2 px-5 py-2 text-sm bg-[#0A7EC2] text-white rounded-lg hover:bg-[#0968A8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar Alteracoes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
