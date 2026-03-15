import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, Download, TrendingDown, Receipt, Users, FileText, Package, DollarSign, Eye, Save, X, TrendingUp, Calendar, CheckCircle, AlertCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import CustomerRevenue from './CustomerRevenue';

interface ExpenseEntry {
  id: string;
  date: string;
  source: 'manual' | 'xml' | 'payroll';
  category: string;
  description: string;
  amount: number;
  payment_method_id: string | null;
  cost_category_id: string | null;
  cost_category_name?: string | null;
  cost_category_type?: string | null;
  reference: string | null;
  notes: string | null;
  purchase_id?: string | null;
  due_date?: string | null;
  construction_work_id?: string | null;
  payment_methods?: {
    name: string;
  };
  construction_works?: {
    work_name: string;
    customer_id: string;
  };
}

interface PurchaseItem {
  id: string;
  purchase_id: string;
  material_id: string | null;
  product_code: string | null;
  product_description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  cost_category_id: string | null;
  classification_status: 'pending' | 'classified';
  is_for_resale: boolean;
  is_asset: boolean;
  notes: string | null;
  classified_at: string | null;
  item_category?: string | null;
  cost_categories?: {
    name: string;
    type: string;
  };
  purchases?: {
    invoice_number: string;
    invoice_date: string;
    suppliers?: {
      name: string;
    } | null;
  };
}

interface CashFlowProps {
  businessUnit?: string;
}

type ExpenseTab = 'all' | 'manual' | 'xml' | 'payroll' | string;

export default function CashFlow({ businessUnit = 'factory' }: CashFlowProps) {
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<ExpenseEntry[]>([]);
  const [activeTab, setActiveTab] = useState<ExpenseTab>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ExpenseEntry | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [costCategories, setCostCategories] = useState<any[]>([]);
  const [constructionWorks, setConstructionWorks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showXMLModal, setShowXMLModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<ExpenseEntry | null>(null);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [pendingXMLItems, setPendingXMLItems] = useState<PurchaseItem[]>([]);
  const [classifyingItemId, setClassifyingItemId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Estados para a aba Contas a Pagar
  const [payableSubTab, setPayableSubTab] = useState<'all' | 'pending' | 'overdue' | 'paid'>('all');
  const [payableStartDate, setPayableStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [payableEndDate, setPayableEndDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
  );

  const [filters, setFilters] = useState(() => {
    const today = new Date();
    return {
      startDate: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0],
      endDate: new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0],
    };
  });

  const [entryForm, setEntryForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: '',
    description: '',
    amount: '',
    payment_method_id: '',
    cost_category_id: '',
    construction_work_id: '',
    reference: '',
    notes: '',
    due_date: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [expenses, activeTab, filters]);

  async function loadData() {
    setLoading(true);
    await Promise.all([
      loadManualExpenses(),
      loadXMLExpenses(),
      loadPayrollExpenses(),
      loadPaymentMethods(),
      loadCostCategories(),
      loadConstructionWorks(),
      loadPendingXMLItems(),
    ]);
    setLoading(false);
  }

  async function loadManualExpenses() {
    const { data, error } = await supabase
      .from('cash_flow')
      .select('*, payment_methods(name), cost_categories(name, type), construction_works(work_name, customer_id)')
      .eq('business_unit', businessUnit)
      .eq('type', 'expense')
      .is('sale_id', null)
      .is('purchase_id', null)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error loading manual expenses:', error);
      return;
    }

    const manualExpenses: ExpenseEntry[] = (data || []).map(entry => ({
      id: entry.id,
      date: entry.date,
      source: 'manual',
      category: entry.category,
      description: entry.description,
      amount: entry.amount,
      payment_method_id: entry.payment_method_id,
      cost_category_id: entry.cost_category_id,
      cost_category_name: entry.cost_categories?.name || null,
      cost_category_type: entry.cost_categories?.type || null,
      construction_work_id: entry.construction_work_id || null,
      reference: entry.reference,
      notes: entry.notes,
      due_date: entry.due_date || null,
      payment_methods: entry.payment_methods,
      construction_works: entry.construction_works,
    }));

    setExpenses(prev => {
      const filtered = prev.filter(e => e.source !== 'manual');
      return [...filtered, ...manualExpenses];
    });
  }

  async function loadXMLExpenses() {
    // Carregar despesas classificadas de importações XML
    const { data, error } = await supabase
      .from('cash_flow')
      .select('*, payment_methods(name), cost_categories(name, type)')
      .eq('business_unit', businessUnit)
      .eq('type', 'expense')
      .not('purchase_id', 'is', null)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error loading XML expenses:', error);
      return;
    }

    const xmlExpenses: ExpenseEntry[] = (data || []).map(entry => ({
      id: entry.id,
      date: entry.date,
      source: 'xml',
      category: entry.category,
      description: entry.description,
      amount: entry.amount,
      payment_method_id: entry.payment_method_id,
      cost_category_id: entry.cost_category_id,
      cost_category_name: entry.cost_categories?.name || null,
      cost_category_type: entry.cost_categories?.type || null,
      reference: entry.reference,
      notes: entry.notes,
      purchase_id: entry.purchase_id,
      due_date: entry.due_date || null,
      payment_methods: entry.payment_methods,
    }));

    setExpenses(prev => {
      const filtered = prev.filter(e => e.source !== 'xml');
      return [...filtered, ...xmlExpenses];
    });
  }

  async function loadPayrollExpenses() {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('id, name, base_salary, employment_type')
      .eq('business_unit', businessUnit)
      .eq('active', true);

    if (empError) {
      console.error('Error loading employees:', empError);
      return;
    }

    const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    const { data: extraPayments, error: extraError } = await supabase
      .from('monthly_extra_payments')
      .select(`
        id,
        employee_id,
        month,
        payment_type,
        amount,
        employees(name, business_unit)
      `)
      .eq('month', currentMonth);

    if (extraError) {
      console.error('Error loading extra payments:', extraError);
    }

    const payrollExpenses: ExpenseEntry[] = [];

    (employees || []).forEach(employee => {
      const salaryDate = new Date(new Date().getFullYear(), new Date().getMonth(), 5).toISOString().split('T')[0];

      payrollExpenses.push({
        id: `salary-${employee.id}-${currentMonth}`,
        date: salaryDate,
        source: 'payroll',
        category: 'Salários e Encargos',
        description: `Salário - ${employee.name} (${employee.employment_type === 'clt' ? 'CLT' : 'Temporário'})`,
        amount: employee.base_salary,
        payment_method_id: null,
        cost_category_id: null,
        cost_category_name: 'Despesas com Pessoal',
        cost_category_type: 'personnel',
        reference: currentMonth,
        notes: `Salário base - ${employee.employment_type.toUpperCase()}`,
      });
    });

    (extraPayments || []).forEach(payment => {
      const employee = Array.isArray(payment.employees) ? payment.employees[0] : payment.employees;
      if (employee?.business_unit === businessUnit) {
        const paymentDate = new Date(new Date().getFullYear(), new Date().getMonth(), 10).toISOString().split('T')[0];

        payrollExpenses.push({
          id: payment.id,
          date: paymentDate,
          source: 'payroll',
          category: payment.payment_type === 'ferias' ? 'Férias' : payment.payment_type === 'decimo_terceiro' ? '13º Salário' : 'Outros Pagamentos',
          description: `${payment.payment_type === 'ferias' ? 'Férias' : payment.payment_type === 'decimo_terceiro' ? '13º Salário' : 'Pagamento Extra'} - ${employee?.name || 'Funcionário'}`,
          amount: payment.amount,
          payment_method_id: null,
          cost_category_id: null,
          cost_category_name: 'Despesas com Pessoal',
          cost_category_type: 'personnel',
          reference: payment.month,
          notes: `Pagamento: ${payment.payment_type}`,
        });
      }
    });

    setExpenses(prev => {
      const filtered = prev.filter(e => e.source !== 'payroll');
      return [...filtered, ...payrollExpenses];
    });
  }

  async function loadPaymentMethods() {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('active', true)
      .order('name');

    if (error) {
      console.error('Error loading payment methods:', error);
      return;
    }

    setPaymentMethods(data || []);
  }

  async function loadCostCategories() {
    const { data, error } = await supabase
      .from('cost_categories')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error loading cost categories:', error);
      return;
    }

    setCostCategories(data || []);
  }

  async function loadConstructionWorks() {
    const { data, error } = await supabase
      .from('construction_works')
      .select('id, work_name, customer_id, status, customers(name)')
      .in('status', ['em_andamento', 'pausada'])
      .order('work_name');

    if (error) {
      console.error('Error loading construction works:', error);
      return;
    }

    setConstructionWorks(data || []);
  }

  async function loadPendingXMLItems() {
    // Carregar itens de compras XML que precisam de classificação
    // (manutencao, servico, investimento que ainda não tem cash_flow)
    const { data, error } = await supabase
      .from('purchase_items')
      .select(`
        *,
        purchases!inner(
          invoice_number,
          invoice_date,
          suppliers(name)
        )
      `)
      .in('item_category', ['manutencao', 'servico', 'investimento'])
      .order('purchases.invoice_date', { ascending: false });

    if (error) {
      console.error('Error loading pending XML items:', error);
      return;
    }

    if (!data || data.length === 0) {
      setPendingXMLItems([]);
      return;
    }

    // Otimização: Buscar todos os cash_flow de uma vez ao invés de um por um
    const purchaseIds = [...new Set(data.map(item => item.purchase_id))];

    const { data: existingCashFlows } = await supabase
      .from('cash_flow')
      .select('purchase_id, reference')
      .in('purchase_id', purchaseIds);

    // Criar um Set para busca rápida
    const cashFlowKeys = new Set(
      (existingCashFlows || []).map(cf => `${cf.purchase_id}|${cf.reference || ''}`)
    );

    // Filtrar itens que não têm cash_flow
    const itemsWithoutCashFlow = data.filter(item => {
      const key = `${item.purchase_id}|${item.product_code || ''}`;
      return !cashFlowKeys.has(key);
    });

    setPendingXMLItems(itemsWithoutCashFlow);
  }

  function applyFilters() {
    let filtered = expenses;

    if (activeTab === 'all') {
      // Mostra todas as despesas, incluindo contas a pagar

      if (filters.startDate) {
        filtered = filtered.filter(e => {
          const dateToCompare = e.due_date || e.date;
          return dateToCompare >= filters.startDate;
        });
      }

      if (filters.endDate) {
        filtered = filtered.filter(e => {
          const dateToCompare = e.due_date || e.date;
          return dateToCompare <= filters.endDate;
        });
      }
    } else if (activeTab === 'manual') {
      filtered = filtered.filter(e => e.source === 'manual');

      if (filters.startDate) {
        filtered = filtered.filter(e => {
          const dateToCompare = e.due_date || e.date;
          return dateToCompare >= filters.startDate;
        });
      }

      if (filters.endDate) {
        filtered = filtered.filter(e => {
          const dateToCompare = e.due_date || e.date;
          return dateToCompare <= filters.endDate;
        });
      }
    } else if (activeTab === 'xml') {
      filtered = filtered.filter(e => e.source === 'xml');

      if (filters.startDate) {
        filtered = filtered.filter(e => {
          const dateToCompare = e.due_date || e.date;
          return dateToCompare >= filters.startDate;
        });
      }

      if (filters.endDate) {
        filtered = filtered.filter(e => {
          const dateToCompare = e.due_date || e.date;
          return dateToCompare <= filters.endDate;
        });
      }
    } else if (activeTab === 'payroll') {
      filtered = filtered.filter(e => e.source === 'payroll');

      if (filters.startDate) {
        filtered = filtered.filter(e => e.date >= filters.startDate);
      }

      if (filters.endDate) {
        filtered = filtered.filter(e => e.date <= filters.endDate);
      }
    } else if (activeTab !== 'revenue' && activeTab !== 'payable') {
      filtered = filtered.filter(e => e.cost_category_type === activeTab);

      if (filters.startDate) {
        filtered = filtered.filter(e => {
          const dateToCompare = e.due_date || e.date;
          return dateToCompare >= filters.startDate;
        });
      }

      if (filters.endDate) {
        filtered = filtered.filter(e => {
          const dateToCompare = e.due_date || e.date;
          return dateToCompare <= filters.endDate;
        });
      }
    }

    filtered.sort((a, b) => {
      const dateA = new Date(a.due_date || a.date).getTime();
      const dateB = new Date(b.due_date || b.date).getTime();
      return dateB - dateA;
    });

    setFilteredExpenses(filtered);
  }

  async function handleSaveEntry() {
    if (saving) return;

    if (!entryForm.category || !entryForm.description || !entryForm.amount) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }

    if (!entryForm.date && !entryForm.due_date) {
      alert('Informe a data de pagamento ou a data de vencimento');
      return;
    }

    setSaving(true);

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const paymentDate = entryForm.date || entryForm.due_date;
      const dueDate = entryForm.due_date || null;

      let finalDate = paymentDate;
      let finalDueDate = dueDate;

      // Se informou vencimento e data de pagamento <= hoje, está paga (data real de pagamento)
      if (dueDate && new Date(paymentDate) <= today) {
        finalDate = paymentDate;
        finalDueDate = null; // Remove vencimento pois já foi paga
      }
      // Se informou vencimento e não informou data de pagamento (ou data > hoje), é conta a pagar
      else if (dueDate && new Date(paymentDate) > today) {
        finalDate = dueDate;
        finalDueDate = dueDate;
      }
      // Se não informou vencimento, é despesa normal
      else if (!dueDate) {
        finalDate = paymentDate;
        finalDueDate = null;
      }

      const entryData = {
        date: finalDate,
        type: 'expense',
        category: entryForm.category,
        description: entryForm.description,
        amount: parseFloat(entryForm.amount),
        payment_method_id: entryForm.payment_method_id || null,
        cost_category_id: entryForm.cost_category_id || null,
        construction_work_id: entryForm.construction_work_id || null,
        reference: entryForm.reference || null,
        notes: entryForm.notes || null,
        business_unit: businessUnit,
        due_date: finalDueDate,
      };

      if (editingEntry && editingEntry.source === 'manual') {
        const { error } = await supabase
          .from('cash_flow')
          .update(entryData)
          .eq('id', editingEntry.id);

        if (error) throw error;

        if (entryData.construction_work_id) {
          const { error: wiUpsertError } = await supabase
            .from('construction_work_items')
            .upsert({
              work_id: entryData.construction_work_id,
              cash_flow_id: editingEntry.id,
              item_type: 'service',
              item_name: entryData.description,
              quantity: 1,
              unit_price: entryData.amount,
              total_price: entryData.amount,
              unit: 'un',
              notes: entryData.notes || null,
              source_type: 'expense',
              added_date: entryData.date,
            }, { onConflict: 'cash_flow_id', ignoreDuplicates: false });
          if (wiUpsertError) throw wiUpsertError;
        }
      } else {
        const { data: inserted, error } = await supabase
          .from('cash_flow')
          .insert(entryData)
          .select('id')
          .single();

        if (error) throw error;

        if (entryData.construction_work_id && inserted?.id) {
          const { error: wiError } = await supabase
            .from('construction_work_items')
            .insert({
              work_id: entryData.construction_work_id,
              cash_flow_id: inserted.id,
              item_type: 'service',
              item_name: entryData.description,
              quantity: 1,
              unit_price: entryData.amount,
              total_price: entryData.amount,
              unit: 'un',
              notes: entryData.notes || null,
              source_type: 'expense',
              added_date: entryData.date,
            });
          if (wiError) throw wiError;
        }
      }

      resetForm();
      await loadManualExpenses();
      alert('Despesa salva com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar despesa:', error);
      alert('Erro ao salvar despesa');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEntry(entry: ExpenseEntry) {
    if (entry.source === 'payroll') {
      alert('Despesas de folha de pagamento não podem ser excluídas.');
      return;
    }

    const confirmMessage = entry.source === 'xml'
      ? 'Deseja realmente excluir esta despesa XML? Todos os itens desta importação serão excluídos. Esta ação não pode ser desfeita.'
      : 'Deseja realmente excluir esta despesa?';

    if (!confirm(confirmMessage)) return;

    try {
      // Se for despesa XML, deletar todos os registros relacionados à compra
      if (entry.source === 'xml' && entry.purchase_id) {
        // Deletar todos os cash_flow da mesma compra
        const { error: cashFlowError } = await supabase
          .from('cash_flow')
          .delete()
          .eq('purchase_id', entry.purchase_id);

        if (cashFlowError) {
          console.error('Erro ao deletar cash_flow:', cashFlowError);
        }

        // Deletar a compra (isso cascata para purchase_items, assets, etc)
        const { error: purchaseError } = await supabase
          .from('purchases')
          .delete()
          .eq('id', entry.purchase_id);

        if (purchaseError) throw purchaseError;

        loadXMLExpenses();
      } else {
        const { error } = await supabase.from('cash_flow').delete().eq('id', entry.id);
        if (error) throw error;

        loadManualExpenses();
      }

      alert('Despesa excluída com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir despesa:', error);
      alert('Erro ao excluir despesa');
    }
  }

  async function handleEditXMLDueDate(entry: ExpenseEntry) {
    if (entry.source !== 'xml' || !entry.purchase_id) {
      alert('Esta ação é válida apenas para compras XML');
      return;
    }

    const currentDueDate = entry.due_date || entry.date;
    const newDueDate = prompt('Informe a data de vencimento (AAAA-MM-DD):', currentDueDate);

    if (!newDueDate) return;

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(newDueDate)) {
      alert('Data inválida! Use o formato AAAA-MM-DD (ex: 2024-01-15)');
      return;
    }

    try {
      // Atualizar vencimento em todos os cash_flow desta compra
      const { error: cashFlowError } = await supabase
        .from('cash_flow')
        .update({ due_date: newDueDate })
        .eq('purchase_id', entry.purchase_id);

      if (cashFlowError) throw cashFlowError;

      // Atualizar também na tabela purchases
      const { error } = await supabase
        .from('purchases')
        .update({ due_date: newDueDate })
        .eq('id', entry.purchase_id);

      if (error) throw error;

      alert('Vencimento atualizado com sucesso!');
      loadXMLExpenses();
    } catch (error) {
      console.error('Erro ao atualizar vencimento:', error);
      alert('Erro ao atualizar vencimento');
    }
  }

  async function handleConfirmXMLPayment(entry: ExpenseEntry) {
    if (entry.source !== 'xml' || !entry.purchase_id) {
      alert('Esta ação é válida apenas para compras XML');
      return;
    }

    const paymentDate = prompt('Informe a data do pagamento (AAAA-MM-DD):', new Date().toISOString().split('T')[0]);

    if (!paymentDate) return;

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(paymentDate)) {
      alert('Data inválida! Use o formato AAAA-MM-DD (ex: 2024-01-15)');
      return;
    }

    if (!confirm(`Confirmar pagamento desta compra na data ${new Date(paymentDate).toLocaleDateString('pt-BR')}?`)) {
      return;
    }

    try {
      // Remove o vencimento em todos os cash_flow desta compra (marca como pago)
      const { error: cashFlowError } = await supabase
        .from('cash_flow')
        .update({ due_date: null })
        .eq('purchase_id', entry.purchase_id);

      if (cashFlowError) throw cashFlowError;

      // Remove o vencimento na tabela purchases
      const { error } = await supabase
        .from('purchases')
        .update({ due_date: null })
        .eq('id', entry.purchase_id);

      if (error) throw error;

      alert('Pagamento confirmado com sucesso!');
      loadXMLExpenses();
    } catch (error) {
      console.error('Erro ao confirmar pagamento:', error);
      alert('Erro ao confirmar pagamento');
    }
  }

  function handleEditEntry(entry: ExpenseEntry) {
    if (entry.source !== 'manual') {
      alert('Apenas despesas cadastradas manualmente podem ser editadas.');
      return;
    }

    setEditingEntry(entry);
    setEntryForm({
      date: entry.date,
      category: entry.category,
      description: entry.description,
      amount: entry.amount.toString(),
      payment_method_id: entry.payment_method_id || '',
      cost_category_id: entry.cost_category_id || '',
      construction_work_id: entry.construction_work_id || '',
      reference: entry.reference || '',
      notes: entry.notes || '',
      due_date: entry.due_date || '',
    });
    setShowForm(true);
  }

  async function handleConfirmPayment(entry: ExpenseEntry) {
    if (entry.source !== 'manual') {
      alert('Apenas despesas cadastradas manualmente podem ter pagamento confirmado.');
      return;
    }

    if (!entry.due_date) {
      alert('Esta despesa não possui data de vencimento cadastrada.');
      return;
    }

    const paymentDate = prompt('Informe a data do pagamento (AAAA-MM-DD):', new Date().toISOString().split('T')[0]);

    if (!paymentDate) return;

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(paymentDate)) {
      alert('Data inválida! Use o formato AAAA-MM-DD (ex: 2024-01-15)');
      return;
    }

    if (!confirm(`Confirmar pagamento desta despesa na data ${new Date(paymentDate).toLocaleDateString('pt-BR')}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('cash_flow')
        .update({
          date: paymentDate,
          due_date: null  // Remove vencimento ao confirmar pagamento
        })
        .eq('id', entry.id);

      if (error) throw error;

      alert('Pagamento confirmado com sucesso!');
      loadManualExpenses();
    } catch (error) {
      console.error('Erro ao confirmar pagamento:', error);
      alert('Erro ao confirmar pagamento');
    }
  }

  function resetForm() {
    setEditingEntry(null);
    setEntryForm({
      date: new Date().toISOString().split('T')[0],
      category: '',
      description: '',
      amount: '',
      payment_method_id: '',
      cost_category_id: '',
      construction_work_id: '',
      reference: '',
      notes: '',
      due_date: '',
    });
    setShowForm(false);
  }

  async function loadPurchaseItems(purchaseId: string) {
    setLoadingItems(true);
    try {
      const { data, error } = await supabase
        .from('purchase_items')
        .select(`
          *,
          cost_categories(name, type)
        `)
        .eq('purchase_id', purchaseId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setPurchaseItems(data || []);
    } catch (error) {
      console.error('Erro ao carregar itens da compra:', error);
      alert('Erro ao carregar itens da nota fiscal');
    } finally {
      setLoadingItems(false);
    }
  }

  async function handleClassifyItem(itemId: string, classification: {
    cost_category_id: string | null;
    is_for_resale: boolean;
    is_asset: boolean;
    notes: string | null;
  }) {
    try {
      const { error } = await supabase
        .from('purchase_items')
        .update({
          cost_category_id: classification.cost_category_id || null,
          is_for_resale: classification.is_for_resale,
          is_asset: classification.is_asset,
          notes: classification.notes || null,
          classification_status: 'classified',
          classified_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (error) throw error;

      if (selectedPurchase && selectedPurchase.purchase_id) {
        await loadPurchaseItems(selectedPurchase.purchase_id);
      }

      alert('Item classificado com sucesso!');
    } catch (error) {
      console.error('Erro ao classificar item:', error);
      alert('Erro ao classificar item');
    }
  }

  async function handleClassifyPendingItem(item: PurchaseItem, costCategoryId: string) {
    if (!costCategoryId) {
      alert('Por favor, selecione uma categoria de custo');
      return;
    }

    setClassifyingItemId(item.id);

    try {
      // Buscar a categoria selecionada
      const category = costCategories.find(c => c.id === costCategoryId);
      if (!category) {
        throw new Error('Categoria não encontrada');
      }

      // Determinar descrição baseada na categoria do item
      let categoryLabel = '';
      if (item.item_category === 'manutencao') {
        categoryLabel = 'Manutenção';
      } else if (item.item_category === 'servico') {
        categoryLabel = 'Serviço';
      } else if (item.item_category === 'investimento') {
        categoryLabel = 'Investimento/Patrimônio';
      }

      // Criar registro em cash_flow
      const { error: cashFlowError } = await supabase
        .from('cash_flow')
        .insert({
          date: item.purchases?.invoice_date || new Date().toISOString().split('T')[0],
          type: 'expense',
          category: categoryLabel,
          description: `${item.product_description} - NF ${item.purchases?.invoice_number || ''}`,
          amount: item.total_price,
          purchase_id: item.purchase_id,
          cost_category_id: costCategoryId,
          reference: item.product_code || '',
          notes: `Quantidade: ${item.quantity} ${item.unit}`,
          business_unit: businessUnit,
        });

      if (cashFlowError) throw cashFlowError;

      // Se for investimento, também criar ativo
      if (item.item_category === 'investimento') {
        const { error: assetError } = await supabase
          .from('assets')
          .insert({
            name: item.product_description,
            description: `Código: ${item.product_code} - Quantidade: ${item.quantity} ${item.unit}`,
            purchase_item_id: item.id,
            acquisition_date: item.purchases?.invoice_date || new Date().toISOString().split('T')[0],
            acquisition_value: item.total_price,
            current_value: item.total_price,
            status: 'ativo',
            notes: `NF ${item.purchases?.invoice_number || ''}`,
          });

        if (assetError) {
          console.error('Erro ao criar ativo:', assetError);
        }
      }

      alert('Item classificado e despesa registrada com sucesso!');

      // Recarregar dados
      await loadPendingXMLItems();
      await loadXMLExpenses();

    } catch (error) {
      console.error('Erro ao classificar item:', error);
      alert('Erro ao classificar item');
    } finally {
      setClassifyingItemId(null);
    }
  }

  function openXMLModal(entry: ExpenseEntry) {
    setSelectedPurchase(entry);
    setShowXMLModal(true);
    if (entry.purchase_id) {
      loadPurchaseItems(entry.purchase_id);
    }
  }

  function closeXMLModal() {
    setShowXMLModal(false);
    setSelectedPurchase(null);
    setPurchaseItems([]);
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const [totalRevenue, setTotalRevenue] = useState(0);

  useEffect(() => {
    async function loadTotalRevenue() {
      if (!filters.startDate || !filters.endDate) {
        setTotalRevenue(0);
        return;
      }

      const { data: revenues } = await supabase
        .from('customer_revenue')
        .select('payment_amount')
        .gte('payment_date', filters.startDate)
        .lte('payment_date', filters.endDate);

      const total = revenues?.reduce((sum, r) => sum + Number(r.payment_amount), 0) || 0;
      setTotalRevenue(total);
    }

    loadTotalRevenue();
  }, [filters.startDate, filters.endDate]);

  const balance = totalRevenue - totalExpenses;

  const expensesByCategory = filteredExpenses.reduce((acc, expense) => {
    const category = expense.cost_category_name || expense.category || 'Outras';
    acc[category] = (acc[category] || 0) + expense.amount;
    return acc;
  }, {} as Record<string, number>);

  const businessUnitNames: Record<string, string> = {
    factory: 'Indústria de Artefatos',
    engineering: 'Escritório de Engenharia',
    construction: 'Construtora',
  };

  const uniqueCostTypes = Array.from(new Set(
    expenses
      .filter(e => e.cost_category_type)
      .map(e => e.cost_category_type)
  ));

  const tabs = [
    { id: 'revenue', label: 'Receitas de Clientes', icon: TrendingUp },
    { id: 'payable', label: 'Contas a Pagar', icon: Calendar },
    { id: 'pending-xml', label: `Itens XML Pendentes (${pendingXMLItems.length})`, icon: AlertCircle },
    { id: 'all', label: 'Todas as Despesas', icon: TrendingDown },
    { id: 'manual', label: 'Cadastradas Manualmente', icon: FileText },
    { id: 'xml', label: 'Notas Fiscais (XML)', icon: Receipt },
    { id: 'payroll', label: 'Folha de Pagamento', icon: Users },
    ...uniqueCostTypes.map(type => ({
      id: type!,
      label: getCategoryTypeLabel(type!),
      icon: Package
    }))
  ];

  function getCategoryTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      direct_production: 'Custos de Produção',
      direct_resale: 'Produtos para Revenda',
      personnel: 'Pessoal',
      administrative: 'Administrativo',
      utilities: 'Utilidades',
      maintenance: 'Manutenção',
      equipment: 'Equipamentos',
      taxes: 'Impostos',
      ppe: 'EPIs',
      prolabore: 'Pró-Labore',
    };
    return labels[type] || type;
  }

  function getSourceBadge(source: string) {
    const badges = {
      manual: { label: 'Manual', color: 'bg-blue-100 text-blue-800' },
      xml: { label: 'XML', color: 'bg-purple-100 text-purple-800' },
      payroll: { label: 'Folha', color: 'bg-green-100 text-green-800' },
    };
    const badge = badges[source as keyof typeof badges] || { label: source, color: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.label}
      </span>
    );
  }

  function exportToPDF() {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório de Despesas Consolidado', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Unidade: ${businessUnitNames[businessUnit]}`, pageWidth / 2, 28, { align: 'center' });
    doc.text(`Período: ${new Date(filters.startDate).toLocaleDateString('pt-BR')} a ${new Date(filters.endDate).toLocaleDateString('pt-BR')}`, pageWidth / 2, 34, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo por Categoria', 14, 44);

    let yPos = 52;
    Object.entries(expensesByCategory).forEach(([category, amount]) => {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${category}: ${formatCurrency(amount)}`, 14, yPos);
      yPos += 7;
    });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(200, 0, 0);
    doc.text(`Total de Despesas: ${formatCurrency(totalExpenses)}`, 14, yPos + 5);
    doc.setTextColor(0, 0, 0);

    const tableData = filteredExpenses.map(entry => [
      new Date(entry.date).toLocaleDateString('pt-BR'),
      entry.source === 'manual' ? 'Manual' : entry.source === 'xml' ? 'XML' : 'Folha',
      entry.category,
      entry.description,
      formatCurrency(entry.amount)
    ]);

    autoTable(doc, {
      startY: yPos + 15,
      head: [['Data', 'Origem', 'Categoria', 'Descrição', 'Valor']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [66, 66, 66],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 22 },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'left', cellWidth: 35 },
        3: { halign: 'left', cellWidth: 65 },
        4: { halign: 'right', cellWidth: 28 }
      },
      styles: {
        fontSize: 8,
        cellPadding: 2
      },
    });

    const fileName = `despesas_consolidadas_${businessUnit}_${filters.startDate}_${filters.endDate}.pdf`;
    doc.save(fileName);
  }

  if (activeTab === 'revenue') {
    return <CustomerRevenue onBack={() => setActiveTab('all')} />;
  }

  if (activeTab === 'pending-xml') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => setActiveTab('all')}
            className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
          >
            ← Voltar para Despesas
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Itens XML Pendentes de Classificação</h3>
              <p className="text-sm text-gray-600 mt-1">
                Classifique os itens de manutenção, serviços e investimentos para que apareçam nas despesas
              </p>
            </div>
            <div className="bg-orange-100 text-orange-800 px-4 py-2 rounded-lg font-semibold">
              {pendingXMLItems.length} {pendingXMLItems.length === 1 ? 'item' : 'itens'} pendente{pendingXMLItems.length !== 1 ? 's' : ''}
            </div>
          </div>

          {pendingXMLItems.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900">Todos os itens XML foram classificados!</p>
              <p className="text-sm text-gray-600 mt-2">Não há itens pendentes de classificação no momento.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">NF</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fornecedor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qtd.</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria de Custo</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {pendingXMLItems.map((item) => {
                    const itemCategoryLabels = {
                      manutencao: { label: 'Manutenção', color: 'bg-yellow-100 text-yellow-800' },
                      servico: { label: 'Serviço', color: 'bg-blue-100 text-blue-800' },
                      investimento: { label: 'Investimento', color: 'bg-green-100 text-green-800' },
                    };

                    const categoryInfo = itemCategoryLabels[item.item_category as keyof typeof itemCategoryLabels] ||
                      { label: item.item_category || 'N/A', color: 'bg-gray-100 text-gray-800' };

                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 text-sm text-gray-900 font-medium">
                          {item.purchases?.invoice_number || '-'}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">
                          {item.purchases?.invoice_date ? new Date(item.purchases.invoice_date).toLocaleDateString('pt-BR') : '-'}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">
                          {item.purchases?.suppliers?.name || 'Sem fornecedor'}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${categoryInfo.color}`}>
                            {categoryInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900 max-w-xs truncate" title={item.product_description}>
                          {item.product_description}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="px-4 py-4 text-sm text-right text-gray-900 font-medium">
                          {formatCurrency(item.total_price)}
                        </td>
                        <td className="px-4 py-4">
                          <select
                            id={`category-${item.id}`}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            defaultValue=""
                            disabled={classifyingItemId === item.id}
                          >
                            <option value="">Selecione...</option>
                            {costCategories.map(cat => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button
                            onClick={() => {
                              const selectElement = document.getElementById(`category-${item.id}`) as HTMLSelectElement;
                              const categoryId = selectElement?.value;
                              if (categoryId) {
                                handleClassifyPendingItem(item, categoryId);
                              } else {
                                alert('Por favor, selecione uma categoria de custo');
                              }
                            }}
                            disabled={classifyingItemId === item.id}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                          >
                            {classifyingItemId === item.id ? 'Classificando...' : 'Classificar'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (activeTab === 'payable') {
    // Buscar todas as despesas com vencimento
    const allPayableExpenses = expenses.filter(e => e.due_date);

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Categorizar despesas primeiro
    const categorizedExpenses = allPayableExpenses.map(e => {
      const dueDate = new Date(e.due_date!);
      const paymentDate = new Date(e.date);

      // Se date !== due_date, significa que foi pago (data de pagamento foi confirmada)
      const isPaid = e.date !== e.due_date;

      // Se não está pago e vencimento já passou, está vencido
      const isOverdue = !isPaid && dueDate < now;

      return {
        ...e,
        isPaid,
        isOverdue,
        status: isPaid ? 'paid' : isOverdue ? 'overdue' : 'pending',
        displayDate: isPaid ? paymentDate : dueDate
      };
    });

    // Filtrar por período baseado na data correta (pagamento se pago, vencimento se pendente/vencido)
    const filteredByPeriod = categorizedExpenses.filter(e => {
      const dateToFilter = e.displayDate;
      const start = new Date(payableStartDate);
      const end = new Date(payableEndDate);
      end.setHours(23, 59, 59, 999);
      return dateToFilter >= start && dateToFilter <= end;
    });

    // Filtrar por sub-aba
    const displayedExpenses = filteredByPeriod.filter(e => {
      if (payableSubTab === 'all') return true;
      if (payableSubTab === 'pending') return e.status === 'pending';
      if (payableSubTab === 'overdue') return e.status === 'overdue';
      if (payableSubTab === 'paid') return e.status === 'paid';
      return true;
    });

    const pendingCount = filteredByPeriod.filter(e => e.status === 'pending').length;
    const overdueCount = filteredByPeriod.filter(e => e.status === 'overdue').length;
    const paidCount = filteredByPeriod.filter(e => e.status === 'paid').length;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => setActiveTab('all')}
            className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
          >
            ← Voltar para Despesas
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Contas a Pagar</h3>

          {/* Filtro de Período */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Inicial
                </label>
                <input
                  type="date"
                  value={payableStartDate}
                  onChange={(e) => setPayableStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Final
                </label>
                <input
                  type="date"
                  value={payableEndDate}
                  onChange={(e) => setPayableEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={() => {
                  const today = new Date();
                  setPayableStartDate(new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]);
                  setPayableEndDate(new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Mês Atual
              </button>
            </div>
          </div>

          {/* Abas de Status */}
          <div className="flex gap-2 mb-6 border-b border-gray-200">
            <button
              onClick={() => setPayableSubTab('all')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                payableSubTab === 'all'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Todas ({filteredByPeriod.length})
            </button>
            <button
              onClick={() => setPayableSubTab('pending')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                payableSubTab === 'pending'
                  ? 'border-orange-600 text-orange-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Pendentes ({pendingCount})
            </button>
            <button
              onClick={() => setPayableSubTab('overdue')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                payableSubTab === 'overdue'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Vencidas ({overdueCount})
            </button>
            <button
              onClick={() => setPayableSubTab('paid')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                payableSubTab === 'paid'
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Pagas ({paidCount})
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Ações
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Vencimento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Origem
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Categoria
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Descrição
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Referência
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {displayedExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      Nenhuma conta encontrada
                    </td>
                  </tr>
                ) : (
                  displayedExpenses
                    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
                    .map((entry) => {
                      return (
                        <tr key={entry.id} className={`hover:bg-gray-50 ${
                          entry.isOverdue ? 'bg-red-50' : entry.isPaid ? 'bg-green-50' : ''
                        }`}>
                          <td className="px-6 py-4 text-center">
                            <div className="flex justify-center gap-2">
                              {!entry.isPaid && entry.source === 'manual' ? (
                                <>
                                  <button
                                    onClick={() => handleConfirmPayment(entry)}
                                    className="text-green-600 hover:text-green-800"
                                    title="Confirmar Pagamento"
                                  >
                                    <CheckCircle className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => handleEditEntry(entry)}
                                    className="text-blue-600 hover:text-blue-800"
                                    title="Editar"
                                  >
                                    <Edit2 className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteEntry(entry)}
                                    className="text-red-600 hover:text-red-800"
                                    title="Excluir"
                                  >
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                </>
                              ) : !entry.isPaid && entry.source === 'xml' ? (
                                <>
                                  <button
                                    onClick={() => handleConfirmXMLPayment(entry)}
                                    className="text-green-600 hover:text-green-800"
                                    title="Confirmar Pagamento"
                                  >
                                    <CheckCircle className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => handleEditXMLDueDate(entry)}
                                    className="text-blue-600 hover:text-blue-800"
                                    title="Editar Vencimento"
                                  >
                                    <Edit2 className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => openXMLModal(entry)}
                                    className="text-purple-600 hover:text-purple-800"
                                    title="Ver Itens XML"
                                  >
                                    <Eye className="w-5 h-5" />
                                  </button>
                                </>
                              ) : entry.isPaid ? (
                                <span className="text-xs text-green-600 font-medium">PAGO</span>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className="flex flex-col gap-1">
                              <span className={
                                entry.isPaid ? 'text-green-600 font-semibold' :
                                entry.isOverdue ? 'text-red-600 font-semibold' :
                                'text-orange-600 font-semibold'
                              }>
                                {new Date(entry.due_date!).toLocaleDateString('pt-BR')}
                              </span>
                              {entry.isPaid && (
                                <span className="text-xs text-gray-500">
                                  Pago em: {new Date(entry.date).toLocaleDateString('pt-BR')}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {entry.isPaid ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Pago
                              </span>
                            ) : entry.isOverdue ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                Vencido
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                Pendente
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {getSourceBadge(entry.source)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {entry.cost_category_name || entry.category}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {entry.description}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {entry.reference || '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-right font-semibold text-red-600">
                            {formatCurrency(entry.amount)}
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
              {displayedExpenses.length > 0 && (
                <tfoot className="bg-gray-50 font-semibold">
                  <tr>
                    <td></td>
                    <td colSpan={6} className="px-6 py-4 text-sm text-gray-900 text-right">
                      Total:
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-red-600">
                      {formatCurrency(displayedExpenses.reduce((sum, e) => sum + e.amount, 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestão de Despesas</h2>
          <p className="text-gray-600">Controle consolidado de todos os custos empresariais</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[#0A7EC2] text-white rounded-lg hover:bg-[#0968A8] shadow-sm hover:shadow-md transition-all"
        >
          <Plus className="w-5 h-5" />
          Nova Despesa Manual
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700">Receitas</p>
                <p className="text-2xl font-bold text-green-900 mt-1">{formatCurrency(totalRevenue)}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-green-500 opacity-50" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-700">Despesas</p>
                <p className="text-2xl font-bold text-red-900 mt-1">{formatCurrency(totalExpenses)}</p>
              </div>
              <TrendingDown className="w-10 h-10 text-red-500 opacity-50" />
            </div>
          </div>

          <div className={`bg-gradient-to-br ${balance >= 0 ? 'from-blue-50 to-blue-100 border-blue-200' : 'from-orange-50 to-orange-100 border-orange-200'} rounded-lg p-4 border`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${balance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>Saldo</p>
                <p className={`text-2xl font-bold ${balance >= 0 ? 'text-blue-900' : 'text-orange-900'} mt-1`}>{formatCurrency(balance)}</p>
              </div>
              <DollarSign className={`w-10 h-10 ${balance >= 0 ? 'text-blue-500' : 'text-orange-500'} opacity-50`} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Inicial
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({...filters, startDate: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Final
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({...filters, endDate: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 overflow-x-auto">
          <nav className="flex space-x-1 p-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              const paidExpenses = expenses.filter(e => !e.due_date || e.date !== e.due_date);
              const pendingExpenses = expenses.filter(e => e.due_date && e.date === e.due_date);

              const count = tab.id === 'revenue'
                ? 0
                : tab.id === 'payable'
                ? pendingExpenses.length
                : tab.id === 'all'
                ? paidExpenses.length
                : tab.id === 'manual'
                ? paidExpenses.filter(e => e.source === 'manual').length
                : tab.id === 'xml'
                ? paidExpenses.filter(e => e.source === 'xml').length
                : tab.id === 'payroll'
                ? paidExpenses.filter(e => e.source === 'payroll').length
                : paidExpenses.filter(e => e.cost_category_type === tab.id).length;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-[#0A7EC2] text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-600">
              {filteredExpenses.length} despesa{filteredExpenses.length !== 1 ? 's' : ''} encontrada{filteredExpenses.length !== 1 ? 's' : ''}
            </p>
            <button
              onClick={exportToPDF}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#0A7EC2] to-[#0968A8] text-white font-medium rounded-lg hover:from-[#0968A8] hover:to-[#075a8a] transition-all shadow-md hover:shadow-lg"
            >
              <Download className="w-4 h-4" />
              Exportar PDF
            </button>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">
            {editingEntry ? 'Editar Despesa' : 'Nova Despesa Manual'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data do Pagamento
              </label>
              <input
                type="date"
                value={entryForm.date}
                onChange={(e) => setEntryForm({...entryForm, date: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Deixe vazio se ainda não foi pago</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data de Vencimento
              </label>
              <input
                type="date"
                value={entryForm.due_date}
                onChange={(e) => setEntryForm({...entryForm, due_date: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Quando a conta vence</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categoria *
              </label>
              <select
                value={entryForm.category}
                onChange={(e) => setEntryForm({...entryForm, category: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
              >
                <option value="">Selecione uma categoria</option>
                <option value="Compra de Materiais">Compra de Materiais</option>
                <option value="Salários e Encargos">Salários e Encargos</option>
                <option value="Despesas Administrativas">Despesas Administrativas</option>
                <option value="Impostos e Taxas">Impostos e Taxas</option>
                <option value="Manutenção">Manutenção</option>
                <option value="Utilidades">Utilidades (Água, Luz, etc.)</option>
                <option value="Combustível">Combustível</option>
                <option value="Transporte">Transporte</option>
                <option value="Aluguel">Aluguel</option>
                <option value="Outras Despesas">Outras Despesas</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valor (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                value={entryForm.amount}
                onChange={(e) => setEntryForm({...entryForm, amount: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categoria de Custo
              </label>
              <select
                value={entryForm.cost_category_id}
                onChange={(e) => setEntryForm({...entryForm, cost_category_id: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
              >
                <option value="">Não especificado</option>
                {costCategories.map(category => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Obra
              </label>
              <select
                value={entryForm.construction_work_id}
                onChange={(e) => setEntryForm({...entryForm, construction_work_id: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
              >
                <option value="">Não vinculado a obra</option>
                {constructionWorks.map(work => (
                  <option key={work.id} value={work.id}>
                    {work.work_name} {work.customers?.name ? `(${work.customers.name})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Vincule a despesa a uma obra específica</p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descrição *
              </label>
              <input
                type="text"
                value={entryForm.description}
                onChange={(e) => setEntryForm({...entryForm, description: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                placeholder="Descrição detalhada da despesa"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Forma de Pagamento
              </label>
              <select
                value={entryForm.payment_method_id}
                onChange={(e) => setEntryForm({...entryForm, payment_method_id: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
              >
                <option value="">Não especificado</option>
                {paymentMethods.map(method => (
                  <option key={method.id} value={method.id}>{method.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Referência/Documento
              </label>
              <input
                type="text"
                value={entryForm.reference}
                onChange={(e) => setEntryForm({...entryForm, reference: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                placeholder="Número de nota, boleto, etc."
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observações
              </label>
              <textarea
                value={entryForm.notes}
                onChange={(e) => setEntryForm({...entryForm, notes: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                rows={2}
                placeholder="Informações adicionais"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={resetForm}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveEntry}
              disabled={saving}
              className={`px-6 py-2 text-white rounded-lg transition-colors font-semibold flex items-center gap-2 ${
                saving
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-[#0A7EC2] hover:bg-[#0968A8]'
              }`}
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Salvando...
                </>
              ) : (
                editingEntry ? 'Atualizar' : 'Salvar'
              )}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Ações
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Origem
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Categoria
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Obra
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Descrição
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Referência
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Valor
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#0A7EC2]"></div>
                    <p className="mt-2 text-gray-600">Carregando despesas...</p>
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    Nenhuma despesa encontrada para o período selecionado
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-center">
                      {entry.source === 'manual' ? (
                        <div className="flex justify-center gap-2">
                          {entry.due_date && entry.date === entry.due_date ? (
                            <button
                              onClick={() => handleConfirmPayment(entry)}
                              className="text-green-600 hover:text-green-800"
                              title="Confirmar Pagamento"
                            >
                              <CheckCircle className="w-5 h-5" />
                            </button>
                          ) : null}
                          <button
                            onClick={() => handleEditEntry(entry)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Editar"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteEntry(entry)}
                            className="text-red-600 hover:text-red-800"
                            title="Excluir"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      ) : entry.source === 'xml' && entry.purchase_id ? (
                        <button
                          onClick={() => openXMLModal(entry)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium"
                          title="Ver itens e classificar"
                        >
                          <Eye className="w-4 h-4" />
                          Ver Itens XML
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">Automático</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex flex-col gap-1">
                        <span className={entry.due_date && entry.date === entry.due_date ? 'text-orange-600 font-semibold' : 'text-gray-900'}>
                          {new Date(entry.date).toLocaleDateString('pt-BR')}
                        </span>
                        {entry.due_date && entry.date === entry.due_date && (
                          <span className="text-xs text-orange-600 font-medium">
                            Vencimento (Pendente)
                          </span>
                        )}
                        {entry.due_date && entry.date !== entry.due_date && (
                          <span className="text-xs text-green-600">
                            Venc: {new Date(entry.due_date).toLocaleDateString('pt-BR')} (Pago)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {getSourceBadge(entry.source)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {entry.cost_category_name || entry.category}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {entry.construction_works ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                          {entry.construction_works.work_name}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {entry.description}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {entry.reference || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-red-600">
                      {formatCurrency(entry.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td></td>
                <td colSpan={6} className="px-6 py-4 text-sm text-gray-900 text-right">
                  Total de Despesas:
                </td>
                <td className="px-6 py-4 text-sm text-right text-red-600">
                  {formatCurrency(totalExpenses)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {showXMLModal && selectedPurchase && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Receipt className="w-6 h-6 text-purple-600" />
                  Itens da Nota Fiscal XML
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedPurchase.description} - Total: {formatCurrency(selectedPurchase.amount)}
                </p>
              </div>
              <button
                onClick={closeXMLModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {loadingItems ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  <p className="mt-2 text-gray-600">Carregando itens...</p>
                </div>
              ) : purchaseItems.length === 0 ? (
                <div className="text-center py-12">
                  <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Nenhum item encontrado nesta nota fiscal</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {purchaseItems.map((item, index) => (
                    <ItemClassificationCard
                      key={item.id}
                      item={item}
                      index={index}
                      costCategories={costCategories}
                      onSave={handleClassifyItem}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                <span className="font-semibold">{purchaseItems.length}</span> item{purchaseItems.length !== 1 ? 's' : ''} na nota fiscal
                {' - '}
                <span className="font-semibold text-green-600">
                  {purchaseItems.filter(i => i.classification_status === 'classified').length} classificado{purchaseItems.filter(i => i.classification_status === 'classified').length !== 1 ? 's' : ''}
                </span>
              </div>
              <button
                onClick={closeXMLModal}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemClassificationCard({
  item,
  index,
  costCategories,
  onSave,
}: {
  item: PurchaseItem;
  index: number;
  costCategories: any[];
  onSave: (itemId: string, classification: any) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    cost_category_id: item.cost_category_id || '',
    is_for_resale: item.is_for_resale,
    is_asset: item.is_asset,
    notes: item.notes || '',
  });

  function handleSave() {
    onSave(item.id, form);
    setIsEditing(false);
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  const isConsumption = !form.is_for_resale && !form.is_asset;

  return (
    <div className={`border-2 rounded-lg overflow-hidden ${
      item.classification_status === 'classified'
        ? 'border-green-200 bg-green-50'
        : 'border-gray-200 bg-white'
    }`}>
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-white font-bold text-sm">
                {index + 1}
              </span>
              <div>
                <h4 className="font-semibold text-gray-900">{item.product_description}</h4>
                {item.product_code && (
                  <p className="text-sm text-gray-600">Código: {item.product_code}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4 text-sm mt-3">
              <div>
                <span className="text-gray-600">Quantidade:</span>
                <p className="font-semibold text-gray-900">{item.quantity.toFixed(3)} {item.unit}</p>
              </div>
              <div>
                <span className="text-gray-600">Valor Unitário:</span>
                <p className="font-semibold text-gray-900">{formatCurrency(item.unit_price)}</p>
              </div>
              <div>
                <span className="text-gray-600">Valor Total:</span>
                <p className="font-semibold text-green-700">{formatCurrency(item.total_price)}</p>
              </div>
              <div>
                <span className="text-gray-600">Status:</span>
                <p className="font-semibold">
                  {item.classification_status === 'classified' ? (
                    <span className="text-green-700">Classificado</span>
                  ) : (
                    <span className="text-orange-700">Pendente</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categoria de Custo
              </label>
              <select
                value={form.cost_category_id}
                onChange={(e) => setForm({ ...form, cost_category_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Não especificado</option>
                {costCategories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name} ({category.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Classificação
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name={`classification-${item.id}`}
                    checked={isConsumption}
                    onChange={() => setForm({ ...form, is_for_resale: false, is_asset: false })}
                    className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Consumo</p>
                    <p className="text-sm text-gray-600">Material para uso/consumo na produção</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name={`classification-${item.id}`}
                    checked={form.is_for_resale}
                    onChange={() => setForm({ ...form, is_for_resale: true, is_asset: false })}
                    className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Insumo para Revenda</p>
                    <p className="text-sm text-gray-600">Material que será revendido ao cliente</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name={`classification-${item.id}`}
                    checked={form.is_asset}
                    onChange={() => setForm({ ...form, is_for_resale: false, is_asset: true })}
                    className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Patrimônio/Ativo</p>
                    <p className="text-sm text-gray-600">Investimento ou bem patrimonial</p>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observações
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                rows={2}
                placeholder="Informações adicionais sobre a classificação..."
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setForm({
                    cost_category_id: item.cost_category_id || '',
                    is_for_resale: item.is_for_resale,
                    is_asset: item.is_asset,
                    notes: item.notes || '',
                  });
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                <Save className="w-4 h-4" />
                Salvar Classificação
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {item.classification_status === 'classified' ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Categoria:</p>
                    <p className="font-medium text-gray-900">
                      {item.cost_categories?.name || 'Não especificada'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Tipo:</p>
                    <p className="font-medium text-gray-900">
                      {item.is_asset ? 'Patrimônio/Ativo' : item.is_for_resale ? 'Insumo para Revenda' : 'Consumo'}
                    </p>
                  </div>
                </div>
                {item.notes && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Observações:</p>
                    <p className="text-sm text-gray-900">{item.notes}</p>
                  </div>
                )}
                {item.classified_at && (
                  <p className="text-xs text-gray-500">
                    Classificado em: {new Date(item.classified_at).toLocaleString('pt-BR')}
                  </p>
                )}
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-600 mb-3">Este item ainda não foi classificado</p>
              </div>
            )}
            <div className="flex justify-end">
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors font-medium"
              >
                <Edit2 className="w-4 h-4" />
                {item.classification_status === 'classified' ? 'Reclassificar' : 'Classificar Item'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
