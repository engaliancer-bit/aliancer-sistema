import React, { useState, useEffect, useRef } from 'react';
import { Building2, Plus, X, Edit2, Trash2, Save, ChevronDown, ChevronRight, Calendar, MapPin, DollarSign, TrendingUp, TrendingDown, Package, AlertCircle, FileText, RefreshCw, CreditCard, CheckCircle, Clock, Banknote, Link } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useHorizontalKeyboardScroll } from '../hooks/useHorizontalKeyboardScroll';
import ConstructionWorkStatement from './ConstructionWorkStatement';

interface Customer {
  id: string;
  name: string;
  person_type: string;
}

interface Work {
  id: string;
  customer_id: string;
  work_name: string;
  work_area: number;
  area_type: 'rural' | 'urbana';
  construction_type: 'residencial' | 'comercial' | 'industrial' | 'rural';
  occupancy_type: 'unifamiliar' | 'multifamiliar';
  address: string;
  city: string;
  state: string;
  zip_code: string;
  contract_type: 'pacote_fechado' | 'administracao';
  total_contract_value: number;
  administration_percentage: number;
  status: 'em_andamento' | 'pausada' | 'concluida' | 'cancelada';
  start_date: string;
  estimated_end_date: string;
  actual_end_date: string;
  notes: string;
  created_at: string;
  updated_at: string;
  customers?: Customer;
}

interface WorkItem {
  id: string;
  work_id: string;
  quote_id: string | null;
  quote_item_id: string | null;
  item_type: 'product' | 'material' | 'composition' | 'service';
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  added_date: string;
  notes: string;
  product_id?: string;
  material_id?: string;
  composition_id?: string;
  unit?: string;
  source_type?: 'quote' | 'expense' | 'manual';
  cash_flow_id?: string | null;
  quotes?: {
    created_at: string;
    updated_at: string;
    total_value: number;
  } | null;
  cash_flow?: {
    date: string;
    description: string;
  } | null;
}

interface WorkPaymentRecord {
  id: string;
  origin_id: string;
  total_amount: number;
  paid_amount: number;
  balance: number;
  payment_date: string;
  payment_amount: number;
  payment_method: string;
  notes: string;
  receipt_number: string;
  origin_description: string;
  created_at: string;
  source?: 'revenue' | 'cashflow';
}

interface Product {
  id: string;
  name: string;
  unit: string;
  sale_price: number;
}

interface Material {
  id: string;
  name: string;
  unit: string;
  resale_price: number;
}

interface Composition {
  id: string;
  name: string;
  unit: string;
  total_cost: number;
}

interface WorkPayments {
  total_paid: number;
  balance: number;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_credito: 'Cartao de Credito',
  cartao_debito: 'Cartao de Debito',
  transferencia: 'Transferencia',
  boleto: 'Boleto',
  cheque: 'Cheque',
};

export default function ConstructionProjects() {
  const [works, setWorks] = useState<Work[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingWork, setEditingWork] = useState<Work | null>(null);
  const [expandedWorks, setExpandedWorks] = useState<Set<string>>(new Set());
  const [workItems, setWorkItems] = useState<{ [key: string]: WorkItem[] }>({});
  const [workPayments, setWorkPayments] = useState<{ [key: string]: WorkPayments }>({});
  const [workPaymentRecords, setWorkPaymentRecords] = useState<{ [key: string]: WorkPaymentRecord[] }>({});
  const [showItemModal, setShowItemModal] = useState(false);
  const [selectedWorkId, setSelectedWorkId] = useState<string>('');
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [selectedWorkForStatement, setSelectedWorkForStatement] = useState<Work | null>(null);
  const [refreshingPayments, setRefreshingPayments] = useState<{ [key: string]: boolean }>({});
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<WorkPaymentRecord | null>(null);
  const [paymentWorkId, setPaymentWorkId] = useState<string>('');
  const [showLinkQuoteModal, setShowLinkQuoteModal] = useState(false);
  const [linkQuoteWorkId, setLinkQuoteWorkId] = useState<string>('');
  const [availableQuotes, setAvailableQuotes] = useState<any[]>([]);
  const [selectedLinkQuoteId, setSelectedLinkQuoteId] = useState<string>('');
  const [linkingQuote, setLinkingQuote] = useState(false);
  const [syncingExpenses, setSyncingExpenses] = useState<{ [key: string]: boolean }>({});
  const tableRef = useRef<HTMLDivElement>(null);

  useHorizontalKeyboardScroll(tableRef);

  const [formData, setFormData] = useState({
    customer_id: '',
    work_name: '',
    work_area: 0,
    area_type: 'urbana' as 'rural' | 'urbana',
    construction_type: 'residencial' as 'residencial' | 'comercial' | 'industrial' | 'rural',
    occupancy_type: 'unifamiliar' as 'unifamiliar' | 'multifamiliar',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    contract_type: 'pacote_fechado' as 'pacote_fechado' | 'administracao',
    total_contract_value: 0,
    administration_percentage: 0,
    status: 'em_andamento' as 'em_andamento' | 'pausada' | 'concluida' | 'cancelada',
    start_date: '',
    estimated_end_date: '',
    actual_end_date: '',
    notes: ''
  });

  const [newItem, setNewItem] = useState({
    item_type: 'product' as 'product' | 'material' | 'composition' | 'service',
    item_id: '',
    item_name: '',
    quantity: 1,
    unit_price: 0,
    unit: '',
    notes: ''
  });

  const [paymentForm, setPaymentForm] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    payment_amount: 0,
    payment_method: 'pix',
    notes: '',
    receipt_number: '',
    origin_description: ''
  });

  useEffect(() => {
    loadWorks();
    loadCustomers();
    loadProducts();
    loadMaterials();
    loadCompositions();
  }, []);

  const loadWorks = async () => {
    const { data, error } = await supabase
      .from('construction_works')
      .select(`
        *,
        customers (
          id,
          name,
          person_type
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading works:', error);
      return;
    }

    setWorks(data || []);
  };

  const loadCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, person_type')
      .order('name');

    if (!error) {
      setCustomers(data || []);
    }
  };

  const loadProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, unit, sale_price')
      .order('name');

    if (!error) {
      setProducts(data || []);
    }
  };

  const loadMaterials = async () => {
    const { data, error } = await supabase
      .from('materials')
      .select('id, name, unit, resale_price')
      .order('name');

    if (!error) {
      setMaterials(data || []);
    }
  };

  const loadCompositions = async () => {
    const { data, error } = await supabase
      .from('compositions')
      .select('id, name, unit, total_cost')
      .order('name');

    if (!error) {
      setCompositions(data || []);
    }
  };

  const VALID_WORK_ITEM_TYPES = ['product', 'material', 'composition', 'service'] as const;

  const loadWorkItems = async (workId: string, forceReload = false) => {
    if (workItems[workId] && !forceReload) {
      return;
    }

    const { data, error } = await supabase
      .from('construction_work_items')
      .select(`
        *,
        quotes (created_at, updated_at, total_value),
        cash_flow (date, description)
      `)
      .eq('work_id', workId)
      .order('added_date', { ascending: false });

    if (error) {
      console.error('Error loading work items:', error);
      return;
    }

    const validItems = (data || []).filter(item =>
      VALID_WORK_ITEM_TYPES.includes(item.item_type as typeof VALID_WORK_ITEM_TYPES[number])
    );

    setWorkItems(prev => ({
      ...prev,
      [workId]: validItems
    }));
  };

  const loadWorkPaymentRecords = async (workId: string) => {
    const [{ data: revenueData, error: revenueError }, { data: cfData, error: cfError }] = await Promise.all([
      supabase
        .from('customer_revenue')
        .select('id, origin_id, total_amount, paid_amount, balance, payment_date, payment_amount, payment_method, notes, receipt_number, origin_description, created_at')
        .eq('origin_type', 'construction_work')
        .eq('origin_id', workId)
        .order('payment_date', { ascending: false }),
      supabase
        .from('cash_flow')
        .select('id, date, amount, notes, reference, created_at, description')
        .eq('construction_work_id', workId)
        .eq('type', 'income')
        .is('customer_revenue_id', null)
        .order('date', { ascending: false }),
    ]);

    if (revenueError) console.error('Error loading revenue records:', revenueError);
    if (cfError) console.error('Error loading cashflow income records:', cfError);

    const fromRevenue: WorkPaymentRecord[] = (revenueData || []).map(r => ({ ...r, source: 'revenue' as const }));
    const fromCashFlow: WorkPaymentRecord[] = (cfData || []).map(cf => ({
      id: cf.id,
      origin_id: workId,
      total_amount: 0,
      paid_amount: 0,
      balance: 0,
      payment_date: cf.date,
      payment_amount: Number(cf.amount),
      payment_method: '',
      notes: cf.notes || '',
      receipt_number: cf.reference || '',
      origin_description: cf.description || '',
      created_at: cf.created_at,
      source: 'cashflow' as const,
    }));

    const all = [...fromRevenue, ...fromCashFlow].sort(
      (a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
    );

    setWorkPaymentRecords(prev => ({
      ...prev,
      [workId]: all,
    }));
  };

  const toggleWorkExpansion = async (workId: string) => {
    const newExpanded = new Set(expandedWorks);
    if (newExpanded.has(workId)) {
      newExpanded.delete(workId);
    } else {
      newExpanded.add(workId);
      await Promise.all([loadWorkItems(workId), loadWorkPayments(workId), loadWorkPaymentRecords(workId)]);
    }
    setExpandedWorks(newExpanded);
  };

  const loadWorkPayments = async (workId: string) => {
    const work = works.find(w => w.id === workId);
    if (!work) return;

    const [{ data: revenues }, { data: cashFlowEntries }] = await Promise.all([
      supabase
        .from('customer_revenue')
        .select('payment_amount')
        .eq('origin_type', 'construction_work')
        .eq('origin_id', workId)
        .eq('estornado', false),
      supabase
        .from('cash_flow')
        .select('amount, customer_revenue_id')
        .eq('construction_work_id', workId)
        .eq('type', 'income')
        .is('customer_revenue_id', null),
    ]);

    const fromRevenues = (revenues || []).reduce((sum, p) => sum + Number(p.payment_amount), 0);
    const fromCashFlow = (cashFlowEntries || []).reduce((sum, e) => sum + Number(e.amount), 0);
    const totalPaid = fromRevenues + fromCashFlow;
    const balance = Number(work.total_contract_value || 0) - totalPaid;

    setWorkPayments(prev => ({
      ...prev,
      [workId]: { total_paid: totalPaid, balance }
    }));
  };

  const handleRefreshPayments = async (workId: string) => {
    setRefreshingPayments(prev => ({ ...prev, [workId]: true }));
    await Promise.all([loadWorkPayments(workId), loadWorkPaymentRecords(workId)]);
    setRefreshingPayments(prev => ({ ...prev, [workId]: false }));
  };

  const handleOpenPaymentModal = (workId: string, payment?: WorkPaymentRecord) => {
    setPaymentWorkId(workId);
    if (payment) {
      setEditingPayment(payment);
      setPaymentForm({
        payment_date: payment.payment_date,
        payment_amount: payment.payment_amount,
        payment_method: payment.payment_method,
        notes: payment.notes || '',
        receipt_number: payment.receipt_number || '',
        origin_description: payment.origin_description || ''
      });
    } else {
      setEditingPayment(null);
      setPaymentForm({
        payment_date: new Date().toISOString().split('T')[0],
        payment_amount: 0,
        payment_method: 'pix',
        notes: '',
        receipt_number: '',
        origin_description: ''
      });
    }
    setShowPaymentModal(true);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const work = works.find(w => w.id === paymentWorkId);
    if (!work) return;

    if (!paymentForm.payment_amount || paymentForm.payment_amount <= 0) {
      alert('Informe um valor de pagamento valido');
      return;
    }

    if (editingPayment) {
      const { error } = await supabase
        .from('customer_revenue')
        .update({
          payment_date: paymentForm.payment_date,
          payment_amount: paymentForm.payment_amount,
          payment_method: paymentForm.payment_method,
          notes: paymentForm.notes || null,
          receipt_number: paymentForm.receipt_number || null,
          origin_description: paymentForm.origin_description || null,
        })
        .eq('id', editingPayment.id);

      if (error) {
        console.error('Error updating payment:', error);
        alert('Erro ao atualizar pagamento');
        return;
      }
      alert('Pagamento atualizado com sucesso!');
    } else {
      const records = workPaymentRecords[paymentWorkId] || [];
      const existingTotalPaid = records.reduce((sum, r) => sum + Number(r.payment_amount), 0);
      const newTotalPaid = existingTotalPaid + Number(paymentForm.payment_amount);
      const contractValue = Number(work.total_contract_value || 0);
      const newBalance = contractValue - newTotalPaid;

      const { error } = await supabase
        .from('customer_revenue')
        .insert([{
          customer_id: work.customer_id,
          origin_type: 'construction_work',
          origin_id: paymentWorkId,
          origin_description: paymentForm.origin_description || work.work_name,
          total_amount: contractValue,
          paid_amount: newTotalPaid,
          balance: newBalance,
          payment_date: paymentForm.payment_date,
          payment_amount: paymentForm.payment_amount,
          payment_method: paymentForm.payment_method,
          notes: paymentForm.notes || null,
          receipt_number: paymentForm.receipt_number || null,
        }]);

      if (error) {
        console.error('Error registering payment:', error);
        alert('Erro ao registrar pagamento');
        return;
      }
      alert('Pagamento registrado com sucesso!');
    }

    setShowPaymentModal(false);
    setEditingPayment(null);
    setPaymentWorkId('');
    delete workPaymentRecords[paymentWorkId];
    await Promise.all([loadWorkPayments(paymentWorkId), loadWorkPaymentRecords(paymentWorkId)]);
  };

  const handleDeletePayment = async (paymentId: string, workId: string) => {
    if (!confirm('Tem certeza que deseja excluir este pagamento? Esta acao nao pode ser desfeita.')) return;

    const { error } = await supabase
      .from('customer_revenue')
      .delete()
      .eq('id', paymentId);

    if (error) {
      console.error('Error deleting payment:', error);
      alert('Erro ao excluir pagamento');
      return;
    }

    alert('Pagamento excluido com sucesso!');
    delete workPaymentRecords[workId];
    await Promise.all([loadWorkPayments(workId), loadWorkPaymentRecords(workId)]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customer_id || !formData.work_name) {
      alert('Preencha os campos obrigatorios');
      return;
    }

    if (formData.contract_type === 'pacote_fechado' && !formData.total_contract_value) {
      alert('Informe o valor total do pacote fechado');
      return;
    }

    if (formData.contract_type === 'administracao' && !formData.administration_percentage) {
      alert('Informe o percentual de administracao');
      return;
    }

    const workData: any = {
      ...formData,
      total_contract_value: formData.contract_type === 'pacote_fechado' ? formData.total_contract_value : null,
      administration_percentage: formData.contract_type === 'administracao' ? formData.administration_percentage : null,
      start_date: formData.start_date || null,
      estimated_end_date: formData.estimated_end_date || null,
      actual_end_date: formData.actual_end_date || null
    };

    if (editingWork) {
      const { error } = await supabase
        .from('construction_works')
        .update(workData)
        .eq('id', editingWork.id);

      if (error) {
        console.error('Error updating work:', error);
        alert('Erro ao atualizar obra');
        return;
      }

      alert('Obra atualizada com sucesso!');
    } else {
      const { error } = await supabase
        .from('construction_works')
        .insert([workData]);

      if (error) {
        console.error('Error creating work:', error);
        alert('Erro ao criar obra');
        return;
      }

      alert('Obra criada com sucesso!');
    }

    resetForm();
    loadWorks();
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedWorkId || !newItem.item_name || newItem.quantity <= 0) {
      alert('Preencha todos os campos obrigatorios');
      return;
    }

    const totalPrice = newItem.quantity * newItem.unit_price;

    const itemData: any = {
      work_id: selectedWorkId,
      item_type: newItem.item_type,
      item_name: newItem.item_name,
      quantity: newItem.quantity,
      unit_price: newItem.unit_price,
      total_price: totalPrice,
      unit: newItem.unit,
      notes: newItem.notes,
      source_type: 'manual',
    };

    if (newItem.item_type === 'product' && newItem.item_id) {
      itemData.product_id = newItem.item_id;
    } else if (newItem.item_type === 'material' && newItem.item_id) {
      itemData.material_id = newItem.item_id;
    } else if (newItem.item_type === 'composition' && newItem.item_id) {
      itemData.composition_id = newItem.item_id;
    }

    const { error } = await supabase
      .from('construction_work_items')
      .insert([itemData]);

    if (error) {
      console.error('Error adding item:', error);
      alert('Erro ao adicionar item');
      return;
    }

    setNewItem({
      item_type: 'product',
      item_id: '',
      item_name: '',
      quantity: 1,
      unit_price: 0,
      unit: '',
      notes: ''
    });
    setShowItemModal(false);
    setSelectedWorkId('');

    delete workItems[selectedWorkId];
    await loadWorkItems(selectedWorkId);
    alert('Item adicionado com sucesso!');
  };

  const handleEdit = (work: Work) => {
    setEditingWork(work);
    setFormData({
      customer_id: work.customer_id,
      work_name: work.work_name,
      work_area: work.work_area || 0,
      area_type: work.area_type || 'urbana',
      construction_type: work.construction_type || 'residencial',
      occupancy_type: work.occupancy_type || 'unifamiliar',
      address: work.address || '',
      city: work.city || '',
      state: work.state || '',
      zip_code: work.zip_code || '',
      contract_type: work.contract_type,
      total_contract_value: work.total_contract_value || 0,
      administration_percentage: work.administration_percentage || 0,
      status: work.status,
      start_date: work.start_date || '',
      estimated_end_date: work.estimated_end_date || '',
      actual_end_date: work.actual_end_date || '',
      notes: work.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta obra?')) {
      return;
    }

    const { error } = await supabase
      .from('construction_works')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting work:', error);
      alert('Erro ao excluir obra');
      return;
    }

    alert('Obra excluida com sucesso!');
    loadWorks();
  };

  const handleDeleteItem = async (itemId: string, workId: string) => {
    if (!confirm('Tem certeza que deseja excluir este item?')) {
      return;
    }

    const { error } = await supabase
      .from('construction_work_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      console.error('Error deleting item:', error);
      alert('Erro ao excluir item');
      return;
    }

    delete workItems[workId];
    await loadWorkItems(workId);
    alert('Item excluido com sucesso!');
  };

  const handleOpenLinkQuoteModal = async (workId: string, customerId: string) => {
    setLinkQuoteWorkId(workId);
    setSelectedLinkQuoteId('');

    const { data, error } = await supabase
      .from('quotes')
      .select(`
        id,
        created_at,
        total_value,
        quote_type,
        quote_items (id)
      `)
      .eq('customer_id', customerId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading quotes:', error);
      alert('Erro ao buscar orçamentos aprovados');
      return;
    }

    const alreadyLinked = await supabase
      .from('construction_work_items')
      .select('quote_id')
      .eq('work_id', workId)
      .not('quote_id', 'is', null);

    const linkedQuoteIds = new Set((alreadyLinked.data || []).map(r => r.quote_id));
    const unlinked = (data || []).filter(q => !linkedQuoteIds.has(q.id));
    setAvailableQuotes(unlinked);
    setShowLinkQuoteModal(true);
  };

  const handleLinkQuoteToWork = async () => {
    if (!selectedLinkQuoteId || !linkQuoteWorkId) return;
    setLinkingQuote(true);
    try {
      const { data: quoteItems, error: itemsError } = await supabase
        .from('quote_items')
        .select(`
          *,
          products (id, name, unit),
          materials (id, name, unit),
          compositions (id, name)
        `)
        .eq('quote_id', selectedLinkQuoteId);

      if (itemsError) throw itemsError;

      const VALID_WORK_ITEM_TYPES = ['product', 'material', 'composition', 'service'];
      const itemsToInsert = (quoteItems || [])
        .filter(item => VALID_WORK_ITEM_TYPES.includes(item.item_type))
        .map(item => {
          let itemName = 'Item sem nome';
          let itemUnit = '';
          let productId = null;
          let materialId = null;
          let compositionId = null;

          const product = Array.isArray(item.products) ? item.products[0] : item.products;
          const material = Array.isArray(item.materials) ? item.materials[0] : item.materials;
          const composition = Array.isArray(item.compositions) ? item.compositions[0] : item.compositions;

          if (item.item_type === 'product' && product) {
            itemName = product.name || 'Produto sem nome';
            itemUnit = product.unit || '';
            productId = item.product_id;
          } else if (item.item_type === 'material' && material) {
            itemName = material.name || 'Material sem nome';
            itemUnit = material.unit || '';
            materialId = item.material_id;
          } else if (item.item_type === 'composition' && composition) {
            itemName = composition.name || 'Composição';
            itemUnit = 'un';
            compositionId = item.composition_id;
          } else if (item.item_type === 'service') {
            itemName = item.item_name || item.notes || 'Serviço';
            itemUnit = 'un';
            compositionId = item.composition_id;
          }

          return {
            work_id: linkQuoteWorkId,
            quote_id: selectedLinkQuoteId,
            quote_item_id: item.id,
            item_type: item.item_type,
            item_name: itemName,
            quantity: Number(item.quantity),
            unit_price: Number(item.proposed_price),
            total_price: Number(item.quantity) * Number(item.proposed_price),
            unit: itemUnit || null,
            product_id: productId,
            material_id: materialId,
            composition_id: compositionId,
            notes: item.notes || null,
            source_type: 'quote',
          };
        });

      if (itemsToInsert.length === 0) {
        alert('Este orçamento não possui itens válidos para vincular à obra.');
        setLinkingQuote(false);
        return;
      }

      const { error: insertError } = await supabase
        .from('construction_work_items')
        .insert(itemsToInsert);

      if (insertError) throw insertError;

      alert(`${itemsToInsert.length} item(s) vinculado(s) à obra com sucesso!`);
      setShowLinkQuoteModal(false);
      delete workItems[linkQuoteWorkId];
      await loadWorkItems(linkQuoteWorkId);
    } catch (err: any) {
      console.error('Erro ao vincular orçamento:', err);
      alert('Erro ao vincular orçamento: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setLinkingQuote(false);
    }
  };

  const handleSyncExpensesToWorkItems = async (workId: string) => {
    setSyncingExpenses(prev => ({ ...prev, [workId]: true }));
    try {
      const { data: expenses, error: expError } = await supabase
        .from('cash_flow')
        .select('id, date, description, amount, notes')
        .eq('construction_work_id', workId)
        .eq('type', 'expense')
        .gte('date', '2026-01-01');

      if (expError) throw expError;
      if (!expenses || expenses.length === 0) {
        alert('Nenhuma despesa vinculada a esta obra encontrada desde 01/01/2026.');
        return;
      }

      const { data: existingItems, error: existError } = await supabase
        .from('construction_work_items')
        .select('cash_flow_id')
        .eq('work_id', workId)
        .not('cash_flow_id', 'is', null);

      if (existError) throw existError;

      const alreadySyncedIds = new Set((existingItems || []).map(i => i.cash_flow_id));
      const toInsert = expenses.filter(e => !alreadySyncedIds.has(e.id));

      if (toInsert.length === 0) {
        alert('Todas as despesas desta obra já estão sincronizadas nos Itens da Obra.');
        return;
      }

      const itemsToInsert = toInsert.map(expense => ({
        work_id: workId,
        item_type: 'service',
        item_name: expense.description || 'Despesa sem descrição',
        quantity: 1,
        unit_price: Number(expense.amount),
        total_price: Number(expense.amount),
        unit: 'un',
        notes: expense.notes || null,
        cash_flow_id: expense.id,
        source_type: 'expense',
        added_date: expense.date,
      }));

      const { error: insertError } = await supabase
        .from('construction_work_items')
        .insert(itemsToInsert);

      if (insertError) throw insertError;

      delete workItems[workId];
      await loadWorkItems(workId, true);
      alert(`${toInsert.length} despesa(s) sincronizada(s) com sucesso nos Itens da Obra!`);
    } catch (err: any) {
      console.error('Erro ao sincronizar despesas:', err);
      alert('Erro ao sincronizar despesas: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setSyncingExpenses(prev => ({ ...prev, [workId]: false }));
    }
  };

  const resetForm = () => {
    setFormData({
      customer_id: '',
      work_name: '',
      work_area: 0,
      area_type: 'urbana',
      construction_type: 'residencial',
      occupancy_type: 'unifamiliar',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      contract_type: 'pacote_fechado',
      total_contract_value: 0,
      administration_percentage: 0,
      status: 'em_andamento',
      start_date: '',
      estimated_end_date: '',
      actual_end_date: '',
      notes: ''
    });
    setEditingWork(null);
    setShowModal(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'em_andamento': return 'bg-blue-100 text-blue-800';
      case 'pausada': return 'bg-yellow-100 text-yellow-800';
      case 'concluida': return 'bg-green-100 text-green-800';
      case 'cancelada': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'em_andamento': return 'Em Andamento';
      case 'pausada': return 'Pausada';
      case 'concluida': return 'Concluida';
      case 'cancelada': return 'Cancelada';
      default: return status;
    }
  };

  const calculateWorkTotals = (workId: string) => {
    const items = workItems[workId] || [];
    const totalValue = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
    const totalItems = items.length;
    return { totalValue, totalItems };
  };

  const getItemTypeLabel = (type: string) => {
    switch (type) {
      case 'product': return 'Produto';
      case 'material': return 'Insumo';
      case 'composition': return 'Composicao';
      case 'service': return 'Servico';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            Obras
          </h2>
          <p className="text-gray-600 mt-1">Gerencie as obras da construtora</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          Nova Obra
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Total de Obras</p>
              <p className="text-2xl font-bold text-gray-900">{works.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Em Andamento</p>
              <p className="text-2xl font-bold text-gray-900">
                {works.filter(w => w.status === 'em_andamento').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-yellow-600" />
            <div>
              <p className="text-sm text-gray-600">Pausadas</p>
              <p className="text-2xl font-bold text-gray-900">
                {works.filter(w => w.status === 'pausada').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-gray-600" />
            <div>
              <p className="text-sm text-gray-600">Concluidas</p>
              <p className="text-2xl font-bold text-gray-900">
                {works.filter(w => w.status === 'concluida').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div ref={tableRef} className="bg-white rounded-lg shadow overflow-hidden overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Detalhes</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acoes</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome da Obra</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contrato</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Inicio</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {works.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Building2 className="h-12 w-12 text-gray-400" />
                    <p className="text-lg">Nenhuma obra cadastrada</p>
                  </div>
                </td>
              </tr>
            )}
            {works.map((work) => {
              const { totalValue, totalItems } = calculateWorkTotals(work.id);
              return (
                <React.Fragment key={work.id}>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => toggleWorkExpansion(work.id)}
                        className="p-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                      >
                        {expandedWorks.has(work.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedWorkId(work.id);
                            setShowItemModal(true);
                          }}
                          className="p-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                          title="Adicionar item"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedWorkForStatement(work);
                            setShowStatementModal(true);
                          }}
                          className="p-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors"
                          title="Ver Extrato"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(work)}
                          className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(work.id)}
                          className="p-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="font-medium">{work.work_name}</div>
                      {work.work_area && (
                        <div className="text-xs text-gray-500">{work.work_area} m²</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {work.customers?.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <div>{work.construction_type}</div>
                      <div className="text-xs text-gray-500">{work.area_type}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {work.contract_type === 'pacote_fechado' ? (
                        <div>
                          <div className="font-medium">Pacote Fechado</div>
                          <div className="text-xs">R$ {work.total_contract_value?.toFixed(2)}</div>
                        </div>
                      ) : (
                        <div>
                          <div className="font-medium">Administracao</div>
                          <div className="text-xs">{work.administration_percentage}%</div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(work.status)}`}>
                        {getStatusLabel(work.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {work.start_date ? new Date(work.start_date).toLocaleDateString() : '-'}
                    </td>
                  </tr>

                  {expandedWorks.has(work.id) && (
                    <tr>
                      <td colSpan={8} className="px-6 py-4 bg-gray-50">
                        <div className="space-y-6">

                          {/* Info Cards Row */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-lg border">
                              <div className="flex items-center gap-2 mb-2">
                                <MapPin className="h-5 w-5 text-gray-600" />
                                <h4 className="font-semibold text-gray-700">Localizacao</h4>
                              </div>
                              <p className="text-sm text-gray-600">{work.address || 'Nao informado'}</p>
                              <p className="text-sm text-gray-600">{work.city} - {work.state}</p>
                              {work.zip_code && <p className="text-sm text-gray-600">CEP: {work.zip_code}</p>}
                            </div>
                            <div className="bg-white p-4 rounded-lg border">
                              <div className="flex items-center gap-2 mb-2">
                                <Calendar className="h-5 w-5 text-gray-600" />
                                <h4 className="font-semibold text-gray-700">Prazos</h4>
                              </div>
                              <p className="text-sm text-gray-600">
                                Previsao: {work.estimated_end_date ? new Date(work.estimated_end_date).toLocaleDateString() : 'Nao definido'}
                              </p>
                              {work.actual_end_date && (
                                <p className="text-sm text-gray-600">
                                  Conclusao: {new Date(work.actual_end_date).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                            <div className="bg-white p-4 rounded-lg border">
                              <div className="flex items-center gap-2 mb-2">
                                <Package className="h-5 w-5 text-gray-600" />
                                <h4 className="font-semibold text-gray-700">Itens da Obra</h4>
                              </div>
                              <p className="text-sm text-gray-600">
                                Total de Itens: {totalItems}
                              </p>
                              <p className="text-sm font-medium text-blue-600">
                                Total: R$ {totalValue.toFixed(2)}
                              </p>
                            </div>
                          </div>

                          {/* Financial Summary — Pacote Fechado only */}
                          {work.contract_type === 'pacote_fechado' && workPayments[work.id] && (
                            <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border-2 border-green-200">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <DollarSign className="h-6 w-6 text-green-600" />
                                  <h4 className="font-bold text-gray-800 text-lg">Situacao Financeira</h4>
                                </div>
                                <button
                                  onClick={() => handleRefreshPayments(work.id)}
                                  disabled={refreshingPayments[work.id]}
                                  className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-white rounded transition-colors"
                                  title="Atualizar pagamentos"
                                >
                                  <RefreshCw className={`h-3.5 w-3.5 ${refreshingPayments[work.id] ? 'animate-spin' : ''}`} />
                                  Atualizar
                                </button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white p-3 rounded-lg border border-blue-200">
                                  <p className="text-xs text-gray-600 mb-1">Valor do Contrato</p>
                                  <p className="text-xl font-bold text-blue-600">
                                    R$ {(work.total_contract_value || 0).toFixed(2)}
                                  </p>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-green-200">
                                  <p className="text-xs text-gray-600 mb-1">Total Recebido</p>
                                  <p className="text-xl font-bold text-green-600">
                                    R$ {workPayments[work.id].total_paid.toFixed(2)}
                                  </p>
                                </div>
                                <div className={`bg-white p-3 rounded-lg border-2 ${workPayments[work.id].balance > 0 ? 'border-orange-300' : 'border-green-300'}`}>
                                  <p className="text-xs text-gray-600 mb-1">Saldo Devedor</p>
                                  <p className={`text-xl font-bold ${workPayments[work.id].balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                    R$ {workPayments[work.id].balance.toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* ── PAGAMENTOS RECEBIDOS ── */}
                          <div className="bg-white rounded-lg border-2 border-green-200 overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3 bg-green-50 border-b border-green-200">
                              <div className="flex items-center gap-2">
                                <CreditCard className="h-5 w-5 text-green-700" />
                                <h4 className="font-semibold text-green-800">Pagamentos Recebidos</h4>
                                {workPaymentRecords[work.id] && workPaymentRecords[work.id].length > 0 && (
                                  <span className="bg-green-700 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                    {workPaymentRecords[work.id].length}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => handleOpenPaymentModal(work.id)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                              >
                                <Plus className="h-4 w-4" />
                                Registrar Pagamento
                              </button>
                            </div>

                            {!workPaymentRecords[work.id] ? (
                              <div className="px-4 py-6 text-center">
                                <Clock className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                <p className="text-sm text-gray-500">Carregando pagamentos...</p>
                              </div>
                            ) : workPaymentRecords[work.id].length === 0 ? (
                              <div className="px-4 py-6 text-center">
                                <Banknote className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                <p className="text-sm text-gray-500 italic">Nenhum pagamento registrado para esta obra</p>
                              </div>
                            ) : (
                              <div className="divide-y divide-gray-100">
                                {workPaymentRecords[work.id].map((payment) => (
                                  <div key={payment.id} className="flex items-center justify-between px-4 py-3 hover:bg-green-50 transition-colors">
                                    <div className="flex items-center gap-3 flex-1">
                                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                        <CheckCircle className="h-5 w-5 text-green-600" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-semibold text-green-700 text-lg">
                                            R$ {Number(payment.payment_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                          </span>
                                          {payment.payment_method && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                                              {PAYMENT_METHOD_LABELS[payment.payment_method] || payment.payment_method}
                                            </span>
                                          )}
                                          {payment.source === 'cashflow' && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                                              Receitas/Despesas
                                            </span>
                                          )}
                                          {payment.receipt_number && (
                                            <span className="text-xs text-gray-400">#{payment.receipt_number}</span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                                          <span className="font-medium text-gray-600">
                                            {new Date(payment.payment_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                          </span>
                                          {payment.origin_description && (
                                            <span className="truncate max-w-xs">{payment.origin_description}</span>
                                          )}
                                          {payment.notes && (
                                            <span className="italic truncate max-w-xs text-gray-400">{payment.notes}</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                                      {payment.source !== 'cashflow' && (
                                        <>
                                          <button
                                            onClick={() => handleOpenPaymentModal(work.id, payment)}
                                            className="p-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                                            title="Editar pagamento"
                                          >
                                            <Edit2 className="h-3.5 w-3.5" />
                                          </button>
                                          <button
                                            onClick={() => handleDeletePayment(payment.id, work.id)}
                                            className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                                            title="Excluir pagamento"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                ))}

                                {/* Totals footer */}
                                <div className="px-4 py-3 bg-green-50 flex items-center justify-between text-sm">
                                  <span className="text-gray-600 font-medium">
                                    {workPaymentRecords[work.id].length} pagamento{workPaymentRecords[work.id].length !== 1 ? 's' : ''}
                                  </span>
                                  <span className="font-bold text-green-700">
                                    Total: R$ {workPaymentRecords[work.id].reduce((s, p) => s + Number(p.payment_amount), 0).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* ── ITENS DA OBRA (custos) ── */}
                          <div className="bg-white rounded-lg border-2 border-blue-200 overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border-b border-blue-200">
                              <div className="flex items-center gap-2">
                                <Package className="h-5 w-5 text-blue-700" />
                                <h4 className="font-semibold text-blue-800">Itens da Obra</h4>
                                {workItems[work.id] && workItems[work.id].length > 0 && (
                                  <span className="bg-blue-700 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                    {workItems[work.id].length}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleSyncExpensesToWorkItems(work.id)}
                                  disabled={syncingExpenses[work.id]}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-60"
                                  title="Sincronizar despesas vinculadas a esta obra como itens"
                                >
                                  <RefreshCw className={`h-4 w-4 ${syncingExpenses[work.id] ? 'animate-spin' : ''}`} />
                                  {syncingExpenses[work.id] ? 'Sincronizando...' : 'Sincronizar Despesas'}
                                </button>
                                <button
                                  onClick={() => handleOpenLinkQuoteModal(work.id, work.customer_id)}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                                  title="Vincular orçamento aprovado a esta obra"
                                >
                                  <Link className="h-4 w-4" />
                                  Vincular Orçamento
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedWorkId(work.id);
                                    setShowItemModal(true);
                                  }}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                  <Plus className="h-4 w-4" />
                                  Adicionar Item
                                </button>
                              </div>
                            </div>

                            {!workItems[work.id] ? (
                              <div className="px-4 py-6 text-center">
                                <Clock className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                <p className="text-sm text-gray-500">Carregando itens...</p>
                              </div>
                            ) : workItems[work.id].length === 0 ? (
                              <div className="px-4 py-6 text-center">
                                <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                <p className="text-sm text-gray-500 italic">Nenhum item adicionado a esta obra</p>
                              </div>
                            ) : (
                              <div className="divide-y divide-gray-100">
                                {workItems[work.id].map((item) => {
                                  const srcType = item.source_type || (item.quote_id ? 'quote' : 'manual');
                                  let sourceBadge = null;
                                  if (srcType === 'quote' && item.quotes) {
                                    const approvalDate = new Date(item.quotes.updated_at).toLocaleDateString('pt-BR');
                                    const quoteRef = item.quote_id ? item.quote_id.slice(0, 8).toUpperCase() : '';
                                    sourceBadge = (
                                      <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                        <FileText className="h-3 w-3" />
                                        ORC-{quoteRef} &bull; Aprov. {approvalDate}
                                      </span>
                                    );
                                  } else if (srcType === 'expense') {
                                    const expDate = item.cash_flow
                                      ? new Date(item.cash_flow.date).toLocaleDateString('pt-BR')
                                      : item.added_date ? new Date(item.added_date).toLocaleDateString('pt-BR') : '';
                                    sourceBadge = (
                                      <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                                        <TrendingDown className="h-3 w-3" />
                                        Despesa &bull; {expDate}
                                      </span>
                                    );
                                  } else {
                                    sourceBadge = (
                                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">
                                        Manual
                                      </span>
                                    );
                                  }
                                  return (
                                    <div key={item.id} className="flex items-center justify-between px-4 py-3 hover:bg-blue-50 transition-colors">
                                      <div className="flex-1">
                                        <div className="font-medium text-gray-900">{item.item_name}</div>
                                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
                                          <span className="px-2 py-0.5 bg-gray-100 rounded-full">{getItemTypeLabel(item.item_type)}</span>
                                          {sourceBadge}
                                          <span>Qtd: {item.quantity}{item.unit ? ` ${item.unit}` : ''}</span>
                                          <span>Unit: R$ {item.unit_price.toFixed(2)}</span>
                                          {item.notes && <span className="italic text-gray-400">{item.notes}</span>}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                                        <span className="font-semibold text-blue-700 text-base">
                                          R$ {item.total_price.toFixed(2)}
                                        </span>
                                        <button
                                          onClick={() => handleDeleteItem(item.id, work.id)}
                                          className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                                          title="Excluir item"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}

                                {/* Totals footer */}
                                <div className="px-4 py-3 bg-blue-50 flex items-center justify-between text-sm">
                                  <span className="text-gray-600 font-medium">
                                    {workItems[work.id].length} item{workItems[work.id].length !== 1 ? 's' : ''}
                                  </span>
                                  <span className="font-bold text-blue-700">
                                    Total: R$ {workItems[work.id].reduce((s, i) => s + (i.total_price || 0), 0).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          {work.notes && (
                            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                              <h4 className="font-semibold text-gray-700 mb-2">Observacoes:</h4>
                              <p className="text-sm text-gray-600">{work.notes}</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal: Nova/Editar Obra */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {editingWork ? 'Editar Obra' : 'Nova Obra'}
              </h3>
              <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cliente *</label>
                  <select
                    value={formData.customer_id}
                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  >
                    <option value="">Selecione um cliente...</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>{customer.name}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome da Obra *</label>
                  <input
                    type="text"
                    value={formData.work_name}
                    onChange={(e) => setFormData({ ...formData, work_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Area (m²)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.work_area}
                    onChange={(e) => setFormData({ ...formData, work_area: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Area</label>
                  <select
                    value={formData.area_type}
                    onChange={(e) => setFormData({ ...formData, area_type: e.target.value as 'rural' | 'urbana' })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="urbana">Urbana</option>
                    <option value="rural">Rural</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Construcao</label>
                  <select
                    value={formData.construction_type}
                    onChange={(e) => setFormData({ ...formData, construction_type: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="residencial">Residencial</option>
                    <option value="comercial">Comercial</option>
                    <option value="industrial">Industrial</option>
                    <option value="rural">Construcao Rural</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ocupacao</label>
                  <select
                    value={formData.occupancy_type}
                    onChange={(e) => setFormData({ ...formData, occupancy_type: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="unifamiliar">Unifamiliar</option>
                    <option value="multifamiliar">Multifamiliar</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Endereco</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cidade</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    maxLength={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">CEP</label>
                  <input
                    type="text"
                    value={formData.zip_code}
                    onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Contrato *</label>
                  <select
                    value={formData.contract_type}
                    onChange={(e) => setFormData({ ...formData, contract_type: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  >
                    <option value="pacote_fechado">Pacote Fechado</option>
                    <option value="administracao">Por Administracao</option>
                  </select>
                </div>

                {formData.contract_type === 'pacote_fechado' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Valor Total do Pacote *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.total_contract_value}
                      onChange={(e) => setFormData({ ...formData, total_contract_value: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg"
                      required
                    />
                  </div>
                )}

                {formData.contract_type === 'administracao' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Percentual de Administracao (%) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.administration_percentage}
                      onChange={(e) => setFormData({ ...formData, administration_percentage: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="em_andamento">Em Andamento</option>
                    <option value="pausada">Pausada</option>
                    <option value="concluida">Concluida</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data de Inicio</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Previsao de Termino</label>
                  <input
                    type="date"
                    value={formData.estimated_end_date}
                    onChange={(e) => setFormData({ ...formData, estimated_end_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                {formData.status === 'concluida' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Data de Conclusao</label>
                    <input
                      type="date"
                      value={formData.actual_end_date}
                      onChange={(e) => setFormData({ ...formData, actual_end_date: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Observacoes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={resetForm} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  <Save className="h-5 w-5" />
                  {editingWork ? 'Atualizar' : 'Criar'} Obra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Adicionar Item */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Adicionar Item a Obra</h3>
              <button
                onClick={() => {
                  setShowItemModal(false);
                  setSelectedWorkId('');
                  setNewItem({ item_type: 'product', item_id: '', item_name: '', quantity: 1, unit_price: 0, unit: '', notes: '' });
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Item *</label>
                <select
                  value={newItem.item_type}
                  onChange={(e) => setNewItem({ ...newItem, item_type: e.target.value as any, item_id: '', item_name: '', unit_price: 0, unit: '' })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="product">Produto</option>
                  <option value="material">Insumo</option>
                  <option value="composition">Composicao</option>
                  <option value="service">Servico</option>
                </select>
              </div>

              {newItem.item_type === 'service' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Servico *</label>
                  <input
                    type="text"
                    value={newItem.item_name}
                    onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selecione o {newItem.item_type === 'product' ? 'Produto' : newItem.item_type === 'material' ? 'Insumo' : 'Composicao'} *
                  </label>
                  <select
                    value={newItem.item_id}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      let selectedItem: any = null;
                      let price = 0;
                      let unit = '';
                      if (newItem.item_type === 'product') {
                        selectedItem = products.find(p => p.id === selectedId);
                        price = selectedItem?.sale_price || 0;
                        unit = selectedItem?.unit || '';
                      } else if (newItem.item_type === 'material') {
                        selectedItem = materials.find(m => m.id === selectedId);
                        price = selectedItem?.resale_price || 0;
                        unit = selectedItem?.unit || '';
                      } else if (newItem.item_type === 'composition') {
                        selectedItem = compositions.find(c => c.id === selectedId);
                        price = selectedItem?.total_cost || 0;
                        unit = selectedItem?.unit || '';
                      }
                      setNewItem({ ...newItem, item_id: selectedId, item_name: selectedItem?.name || '', unit_price: price, unit });
                    }}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  >
                    <option value="">Selecione...</option>
                    {newItem.item_type === 'product' && products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} - {p.unit} - R$ {p.sale_price.toFixed(2)}</option>
                    ))}
                    {newItem.item_type === 'material' && materials.map(m => (
                      <option key={m.id} value={m.id}>{m.name} - {m.unit} - R$ {m.resale_price.toFixed(2)}</option>
                    ))}
                    {newItem.item_type === 'composition' && compositions.map(c => (
                      <option key={c.id} value={c.id}>{c.name} - {c.unit} - R$ {c.total_cost.toFixed(2)}</option>
                    ))}
                  </select>
                </div>
              )}

              {newItem.item_type === 'service' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Unidade *</label>
                  <input
                    type="text"
                    value={newItem.unit}
                    onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Ex: un, m², m³, h"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quantidade *</label>
                <input
                  type="number"
                  step="0.001"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                  min="0.001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Preco Unitario</label>
                <input
                  type="number"
                  step="0.01"
                  value={newItem.unit_price}
                  onChange={(e) => setNewItem({ ...newItem, unit_price: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Observacoes</label>
                <textarea
                  value={newItem.notes}
                  onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Total:</span> R$ {(newItem.quantity * newItem.unit_price).toFixed(2)}
                </p>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                <Save className="h-5 w-5" />
                Adicionar Item
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Registrar/Editar Pagamento */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-6 w-6 text-green-600" />
                <h3 className="text-xl font-bold text-gray-900">
                  {editingPayment ? 'Editar Pagamento' : 'Registrar Pagamento Recebido'}
                </h3>
              </div>
              <button
                onClick={() => { setShowPaymentModal(false); setEditingPayment(null); setPaymentWorkId(''); }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data do Pagamento *</label>
                <input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Valor Recebido (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={paymentForm.payment_amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Forma de Pagamento *</label>
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Descricao / Referencia</label>
                <input
                  type="text"
                  value={paymentForm.origin_description}
                  onChange={(e) => setPaymentForm({ ...paymentForm, origin_description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Ex: Parcela 1/3, Sinal, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Numero do Recibo</label>
                <input
                  type="text"
                  value={paymentForm.receipt_number}
                  onChange={(e) => setPaymentForm({ ...paymentForm, receipt_number: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Opcional"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Observacoes</label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Opcional"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowPaymentModal(false); setEditingPayment(null); setPaymentWorkId(''); }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  <Save className="h-5 w-5" />
                  {editingPayment ? 'Salvar Alteracoes' : 'Registrar Pagamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Vincular Orçamento Aprovado à Obra */}
      {showLinkQuoteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="flex items-center justify-between p-5 border-b">
              <div className="flex items-center gap-2">
                <Link className="h-5 w-5 text-green-600" />
                <h3 className="text-lg font-bold text-gray-800">Vincular Orçamento à Obra</h3>
              </div>
              <button
                onClick={() => setShowLinkQuoteModal(false)}
                className="p-1 rounded hover:bg-gray-100 text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {availableQuotes.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">Nenhum orçamento aprovado disponível</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Todos os orçamentos aprovados deste cliente já foram vinculados a esta obra.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600">
                    Selecione um orçamento aprovado para vincular seus itens a esta obra.
                    Orçamentos já vinculados a esta obra não aparecem na lista.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Orçamento Aprovado
                    </label>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {availableQuotes.map(q => {
                        const isObraFechada = q.quote_type === 'complete_construction';
                        return (
                          <label
                            key={q.id}
                            className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                              isObraFechada
                                ? 'opacity-60 cursor-not-allowed border-gray-200 bg-gray-50'
                                : selectedLinkQuoteId === q.id
                                  ? 'border-green-500 bg-green-50'
                                  : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
                            }`}
                          >
                            <input
                              type="radio"
                              name="linkQuote"
                              value={q.id}
                              disabled={isObraFechada}
                              checked={selectedLinkQuoteId === q.id}
                              onChange={() => !isObraFechada && setSelectedLinkQuoteId(q.id)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-gray-800">
                                  {new Date(q.created_at).toLocaleDateString('pt-BR')}
                                </span>
                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                  isObraFechada
                                    ? 'bg-orange-100 text-orange-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {isObraFechada ? 'Obra Fechada' : 'Orç. Materiais'}
                                </span>
                              </div>
                              <div className="text-sm text-gray-600 mt-0.5">
                                R$ {Number(q.total_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} — {(q.quote_items?.length || 0)} item(s)
                              </div>
                              {isObraFechada && (
                                <div className="text-xs text-orange-600 mt-0.5">
                                  Orçamentos de Obra Fechada não podem ser vinculados aos Itens da Obra
                                </div>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  {selectedLinkQuoteId && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-sm text-amber-800">
                        Os itens do orçamento selecionado serão adicionados aos Itens da Obra.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 px-5 pb-5">
              <button
                type="button"
                onClick={() => setShowLinkQuoteModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                Cancelar
              </button>
              {availableQuotes.length > 0 && (
                <button
                  type="button"
                  onClick={handleLinkQuoteToWork}
                  disabled={!selectedLinkQuoteId || linkingQuote}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {linkingQuote ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Link className="h-4 w-4" />
                  )}
                  {linkingQuote ? 'Vinculando...' : 'Vincular à Obra'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Statement Modal */}
      {showStatementModal && selectedWorkForStatement && (
        <ConstructionWorkStatement
          work={selectedWorkForStatement}
          onClose={() => { setShowStatementModal(false); setSelectedWorkForStatement(null); }}
        />
      )}
    </div>
  );
}
