import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { supabase } from '../lib/supabase';
// [DEBOUNCE] Advanced debounce with maxWait prevents search floods
import { useAdvancedDebounce } from '../hooks/useAdvancedDebounceThrottle';
// [MONITOR] Performance tracking for receitas/despesas operations
import { measureAsync, recordMetric } from '../lib/performanceMonitor';
// [CANCEL] Cancel in-flight queries when filters change
import { cancelRequestsByCategory, registerRequest, unregisterRequest, createRequestKey } from '../lib/requestCancellation';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Filter,
  FileText,
  X,
  Save,
  Search,
  Edit2,
  Trash2,
  Tag,
  Users,
  Lock,
  CheckCircle,
  Clock,
  Building2,
  User
} from 'lucide-react';
import ConfirmPaymentModal from './ConfirmPaymentModal';
import PaymentReceiptGenerator from './PaymentReceiptGenerator';
import FactoryReceivables from './FactoryReceivables';
import { format } from 'date-fns';

interface CashFlowEntry {
  id: string;
  date: string;
  type: 'income' | 'expense';
  description: string;
  amount: number;
  payment_method_id: string | null;
  cost_category_id: string | null;
  purchase_id: string | null;
  sale_id: string | null;
  payable_account_id: string | null;
  customer_revenue_id: string | null;
  customer_id: string | null;
  construction_work_id: string | null;
  notes: string | null;
  reference: string | null;
  payment_status?: string | null;
  payment_confirmed_date?: string | null;
  cost_categories?: { name: string; type: string } | null;
  payment_methods?: { name: string } | null;
  customers?: { name: string } | null;
  construction_works?: { work_name: string } | null;
}

interface Customer {
  id: string;
  name: string;
  cpf: string;
  person_type: string;
}

interface ConstructionWork {
  id: string;
  work_name: string;
  customer_id: string;
  status: string;
  customers?: { name: string } | null;
}

interface CostCategory {
  id: string;
  name: string;
  type: string;
}

interface PaymentMethod {
  id: string;
  name: string;
}

interface FactoryFinanceManagerProps {
  initialStartDate?: string;
  initialEndDate?: string;
}

const categoryOptionsIncome = [
  { value: 'venda_produtos', label: 'Venda de Produtos' },
  { value: 'receita_servico', label: 'Receita de Serviço' },
  { value: 'outras_receitas', label: 'Outras Receitas' },
];

const categoryOptionsExpense = [
  { value: 'insumos_producao', label: 'Insumos de Produção' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'transporte', label: 'Transporte/Frete' },
  { value: 'pessoal', label: 'Despesas com Pessoal' },
  { value: 'impostos', label: 'Impostos e Taxas' },
  { value: 'administrativo', label: 'Despesas Administrativas' },
  { value: 'outras_despesas', label: 'Outras Despesas' },
];

const paymentMethodOptions = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'boleto', label: 'Boleto' },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function getSourceLabel(entry: CashFlowEntry): { label: string; color: string } {
  if (entry.customer_revenue_id) return { label: 'Rec. Cliente', color: 'bg-teal-100 text-teal-800' };
  if (entry.sale_id) return { label: 'Venda', color: 'bg-blue-100 text-blue-800' };
  if (entry.purchase_id) return { label: 'XML/NF', color: 'bg-green-100 text-green-800' };
  if (entry.payable_account_id) return { label: 'Conta a Pagar', color: 'bg-orange-100 text-orange-800' };
  return { label: 'Manual', color: 'bg-gray-100 text-gray-700' };
}

function isSystemGenerated(entry: CashFlowEntry): boolean {
  return !!(entry.sale_id || entry.purchase_id || entry.payable_account_id || entry.customer_revenue_id);
}

interface CashFlowRowProps {
  entry: CashFlowEntry;
  onEdit: (e: CashFlowEntry) => void;
  onDelete: (id: string) => void;
  onConfirmPayment: (e: CashFlowEntry) => void;
}

// [MEMO] CashFlowRow wrapped in React.memo — each row re-renders only when its own data changes,
// not when search term, filters, or other rows change in the parent.
const CashFlowRow = memo(function CashFlowRow({ entry, onEdit, onDelete, onConfirmPayment }: CashFlowRowProps) {
  const source = getSourceLabel(entry);
  const systemGenerated = isSystemGenerated(entry);
  const isExpenseConfirmed = entry.type === 'expense' && entry.payment_status === 'confirmado';
  const isExpensePending = entry.type === 'expense' && entry.payment_status !== 'confirmado';
  const rowBgClass = isExpenseConfirmed ? 'bg-yellow-50' : isExpensePending ? 'bg-red-50' : '';

  return (
    <tr className={`${rowBgClass} hover:opacity-80`}>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {format(new Date(entry.date), 'dd/MM/yyyy')}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
          entry.type === 'income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {entry.type === 'income' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {entry.type === 'income' ? 'Receita' : 'Despesa'}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
        {entry.cost_categories?.name || '—'}
      </td>
      <td className="px-6 py-4 text-sm text-gray-900">
        <div>{entry.description}</div>
        {(entry.customers?.name || entry.construction_works?.work_name) && (
          <div className="flex flex-wrap gap-1 mt-1">
            {entry.customers?.name && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-sky-50 text-sky-700 border border-sky-200">
                <User className="h-3 w-3" />
                {entry.customers.name}
              </span>
            )}
            {entry.construction_works?.work_name && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-amber-50 text-amber-700 border border-amber-200">
                <Building2 className="h-3 w-3" />
                {entry.construction_works.work_name}
              </span>
            )}
          </div>
        )}
        {entry.notes && <p className="text-xs text-gray-500 mt-1">{entry.notes}</p>}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${source.color}`}>
          {source.label}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-center">
        {entry.type === 'expense' ? (
          entry.payment_status === 'confirmado' ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              <CheckCircle className="h-3 w-3" />
              Pago
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
              <Clock className="h-3 w-3" />
              Pendente
            </span>
          )
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
        <span className={entry.type === 'income' ? 'text-green-600' : 'text-red-600'}>
          {entry.type === 'expense' && '-'}
          {formatCurrency(entry.amount)}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
        <div className="flex items-center justify-center gap-2">
          {entry.type === 'expense' && entry.payment_status !== 'confirmado' && (
            <button
              onClick={() => onConfirmPayment(entry)}
              className="text-green-600 hover:text-green-800 transition-colors"
              title="Confirmar Pagamento"
            >
              <CheckCircle className="h-4 w-4" />
            </button>
          )}
          {entry.type === 'expense' && entry.payment_status === 'confirmado' && (
            <PaymentReceiptGenerator entry={entry} />
          )}
          {!systemGenerated ? (
            <>
              <button onClick={() => onEdit(entry)} className="text-blue-600 hover:text-blue-900 transition-colors" title="Editar">
                <Edit2 className="h-4 w-4" />
              </button>
              <button onClick={() => onDelete(entry.id)} className="text-red-600 hover:text-red-900 transition-colors" title="Excluir">
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          ) : entry.customer_revenue_id ? (
            <span className="inline-flex items-center gap-1 text-xs text-teal-600" title="Recebimento de cliente — edite pela aba Extrato de Clientes">
              <Lock className="h-3 w-3" />
              <Users className="h-3 w-3" />
            </span>
          ) : (
            <span className="text-xs text-gray-500" title="Criado automaticamente pelo sistema">
              <FileText className="h-4 w-4 inline" />
            </span>
          )}
        </div>
      </td>
    </tr>
  );
});

export default function FactoryFinanceManager({
  initialStartDate = '',
  initialEndDate = '',
}: FactoryFinanceManagerProps) {
  const [entries, setEntries] = useState<CashFlowEntry[]>([]);
  const [costCategories, setCostCategories] = useState<CostCategory[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [constructionWorks, setConstructionWorks] = useState<ConstructionWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'lancamentos' | 'recebiveis'>('lancamentos');

  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'income' | 'expense'>('income');
  const [editingEntry, setEditingEntry] = useState<CashFlowEntry | null>(null);

  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<'all' | 'confirmed' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedEntryForConfirm, setSelectedEntryForConfirm] = useState<CashFlowEntry | null>(null);

  const [formData, setFormData] = useState({
    type: 'income' as 'income' | 'expense',
    category: '',
    description: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    cost_category_id: '',
    payment_method_id: '',
    notes: '',
    reference: '',
    customer_id: '',
    construction_work_id: '',
  });

  useEffect(() => {
    if (initialStartDate) setStartDate(initialStartDate);
    if (initialEndDate) setEndDate(initialEndDate);
  }, [initialStartDate, initialEndDate]);

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  async function loadData() {
    setLoading(true);
    await Promise.all([
      loadEntries(),
      loadCostCategories(),
      loadPaymentMethods(),
      loadCustomers(),
      loadConstructionWorks(),
    ]);
    setLoading(false);
  }

  async function loadEntries() {
    // [CANCEL] Cancel any previous in-flight entries query before starting a new one
    const reqKey = createRequestKey('receitas-despesas', 'load_entries', { startDate, endDate });
    registerRequest(reqKey);

    try {
      // [MONITOR] Track list load time for receitas/despesas module
      const { data, error } = await measureAsync(
        'receitas:load_list',
        async () => {
          let query = supabase
            .from('cash_flow')
            // [CACHE] Restrict columns to only what the list view needs
            .select('id, date, type, description, amount, payment_method_id, cost_category_id, purchase_id, sale_id, payable_account_id, customer_revenue_id, customer_id, construction_work_id, notes, reference, payment_status, payment_confirmed_date, cost_categories(name, type), payment_methods(name), customers(name), construction_works(work_name)')
            .eq('business_unit', 'factory')
            .order('date', { ascending: false });

          if (startDate) query = query.gte('date', startDate);
          if (endDate) query = query.lte('date', endDate);

          return query;
        },
        { module: 'receitas-despesas' }
      );
      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error('Erro ao carregar lançamentos:', error);
    } finally {
      unregisterRequest(reqKey);
    }
  }

  async function loadCustomers() {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, cpf, person_type')
        .order('name');
      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  }

  async function loadConstructionWorks() {
    try {
      const { data, error } = await supabase
        .from('construction_works')
        .select('id, work_name, customer_id, status, customers(name)')
        .in('status', ['em_andamento', 'pausada'])
        .order('work_name');
      if (error) throw error;
      setConstructionWorks(data || []);
    } catch (error) {
      console.error('Erro ao carregar obras:', error);
    }
  }

  function handleOpenConfirmPayment(entry: CashFlowEntry) {
    setSelectedEntryForConfirm(entry);
    setShowConfirmModal(true);
  }

  function handleConfirmPaymentSuccess() {
    setShowConfirmModal(false);
    setSelectedEntryForConfirm(null);
    loadData();
  }

  async function loadCostCategories() {
    try {
      const { data, error } = await supabase
        .from('cost_categories')
        .select('id, name, type')
        .order('name');
      if (error) throw error;
      setCostCategories(data || []);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
    }
  }

  async function loadPaymentMethods() {
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('id, name')
        .order('name');
      if (error) throw error;
      setPaymentMethods(data || []);
    } catch (error) {
      console.error('Erro ao carregar formas de pagamento:', error);
    }
  }

  // [DEBOUNCE] Advanced debounce with maxWait=800ms — prevents rapid re-filters while typing
  // [CANCEL] cancelCategory cancels stale server queries on each keystroke
  const debouncedSearchTerm = useAdvancedDebounce(searchTerm, {
    delay: 350,
    maxWait: 800,
    cancelCategory: 'receitas-search',
  });

  // [MONITOR] Track search events
  const prevSearchRef = useRef('');
  useEffect(() => {
    if (debouncedSearchTerm !== prevSearchRef.current) {
      prevSearchRef.current = debouncedSearchTerm;
      if (debouncedSearchTerm) {
        recordMetric('receitas:search', 1, 'event', { term_length: String(debouncedSearchTerm.length) });
      }
    }
  }, [debouncedSearchTerm]);

  const filteredWorks = useMemo(() => {
    if (!formData.customer_id) return [];
    return constructionWorks.filter(w => w.customer_id === formData.customer_id);
  }, [formData.customer_id, constructionWorks]);

  function openModal(type: 'income' | 'expense') {
    setModalType(type);
    setEditingEntry(null);
    setFormData({
      type,
      category: '',
      description: '',
      amount: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      cost_category_id: '',
      payment_method_id: '',
      notes: '',
      reference: '',
      customer_id: '',
      construction_work_id: '',
    });
    setShowModal(true);
  }

  function handleEdit(entry: CashFlowEntry) {
    setEditingEntry(entry);
    setModalType(entry.type);
    setFormData({
      type: entry.type,
      category: entry.category || '',
      description: entry.description,
      amount: entry.amount.toString(),
      date: entry.date,
      cost_category_id: entry.cost_category_id || '',
      payment_method_id: entry.payment_method_id || '',
      notes: entry.notes || '',
      reference: entry.reference || '',
      customer_id: entry.customer_id || '',
      construction_work_id: entry.construction_work_id || '',
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const entryData = {
        type: formData.type,
        category: formData.category,
        description: formData.description,
        amount: parseFloat(formData.amount),
        date: formData.date,
        cost_category_id: formData.cost_category_id || null,
        payment_method_id: formData.payment_method_id || null,
        notes: formData.notes || null,
        reference: formData.reference || null,
        customer_id: formData.customer_id || null,
        construction_work_id: formData.construction_work_id || null,
        business_unit: 'factory',
      };

      if (editingEntry) {
        const { error } = await supabase
          .from('cash_flow')
          .update(entryData)
          .eq('id', editingEntry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cash_flow')
          .insert([entryData]);
        if (error) throw error;
      }

      setShowModal(false);
      loadData();
    } catch (error: any) {
      alert('Erro ao salvar: ' + error.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Deseja realmente excluir este lançamento?')) return;
    try {
      const { error } = await supabase
        .from('cash_flow')
        .delete()
        .eq('id', id);
      if (error) throw error;
      loadData();
    } catch (error: any) {
      alert('Erro ao excluir: ' + error.message);
    }
  }

  // [MEMO] filteredEntries uses memoization so the heavy filter does NOT run on every render.
  // [DEBOUNCE] Uses debouncedSearchTerm so typing does not re-filter on every keystroke.
  const filteredEntries = useMemo(() => {
    const start = performance.now();
    const searchLower = debouncedSearchTerm.toLowerCase();
    const result = entries.filter(entry => {
      if (filterType !== 'all' && entry.type !== filterType) return false;
      if (filterCategory !== 'all' && entry.cost_category_id !== filterCategory) return false;
      if (debouncedSearchTerm && !entry.description.toLowerCase().includes(searchLower)) return false;
      if (filterPaymentStatus !== 'all' && entry.type === 'expense') {
        const isConfirmed = entry.payment_status === 'confirmado';
        if (filterPaymentStatus === 'confirmed' && !isConfirmed) return false;
        if (filterPaymentStatus === 'pending' && isConfirmed) return false;
      }
      return true;
    });
    // [MONITOR] Track filter application duration
    recordMetric('receitas:apply_filter', performance.now() - start, 'ms', { total: String(result.length) });
    return result;
  }, [entries, filterType, filterCategory, debouncedSearchTerm, filterPaymentStatus]);

  // [MEMO] Summary calculations memoized — never recompute during unrelated state changes
  const { expensesPaid, expensesPending } = useMemo(() => {
    const expenseEntries = entries.filter(e => e.type === 'expense');
    return {
      expensesPaid: expenseEntries.filter(e => e.payment_status === 'confirmado').reduce((sum, e) => sum + e.amount, 0),
      expensesPending: expenseEntries.filter(e => e.payment_status !== 'confirmado').reduce((sum, e) => sum + e.amount, 0),
    };
  }, [entries]);

  // [MEMO] Category lists memoized — only rebuild when costCategories changes
  const incomeCategories = useMemo(() => costCategories.filter(c => c.type?.startsWith('income')), [costCategories]);
  const expenseCategories = useMemo(() => costCategories.filter(c => !c.type?.startsWith('income')), [costCategories]);

  // [MEMO] Stable callback refs so CashFlowRow's React.memo comparison works.
  // New function instances on every render would cause all rows to re-render.
  const handleEditCb = useCallback((e: CashFlowEntry) => handleEdit(e), []);
  const handleDeleteCb = useCallback((id: string) => handleDelete(id), []);
  const handleConfirmPaymentCb = useCallback((e: CashFlowEntry) => handleOpenConfirmPayment(e), []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-0 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('lancamentos')}
          className={`px-6 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'lancamentos'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Lançamentos
        </button>
        <button
          onClick={() => setActiveTab('recebiveis')}
          className={`px-6 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'recebiveis'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Recebíveis
        </button>
      </div>

      {/* Tab: Lançamentos */}
      {activeTab === 'lancamentos' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-full">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-blue-700 font-medium">Despesas Pagas</p>
                  <p className="text-xl font-bold text-blue-800">{formatCurrency(expensesPaid)}</p>
                </div>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-full">
                  <Clock className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-red-700 font-medium">Despesas a Pagar</p>
                  <p className="text-xl font-bold text-red-800">{formatCurrency(expensesPending)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Lançamentos</h2>
            <div className="flex gap-2">
              <button
                onClick={() => openModal('income')}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Plus className="h-4 w-4" />
                Nova Receita
              </button>
              <button
                onClick={() => openModal('expense')}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <Plus className="h-4 w-4" />
                Nova Despesa
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Filter className="h-4 w-4 inline mr-1" />
                Tipo
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Todos</option>
                <option value="income">Receitas</option>
                <option value="expense">Despesas</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Tag className="h-4 w-4 inline mr-1" />
                Categoria
              </label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Todas</option>
                {costCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <CheckCircle className="h-4 w-4 inline mr-1" />
                Status Pagto
              </label>
              <select
                value={filterPaymentStatus}
                onChange={(e) => setFilterPaymentStatus(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Todos</option>
                <option value="confirmed">Pagos</option>
                <option value="pending">Pendentes</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Search className="h-4 w-4 inline mr-1" />
                Buscar
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Descrição..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoria</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Origem</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            {/* [MEMO] CashFlowRow — each row only re-renders when its own entry data changes */}
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEntries.map((entry) => (
                <CashFlowRow
                  key={entry.id}
                  entry={entry}
                  onEdit={handleEditCb}
                  onDelete={handleDeleteCb}
                  onConfirmPayment={handleConfirmPaymentCb}
                />
              ))}
            </tbody>
          </table>

          {filteredEntries.length === 0 && (
            <div className="text-center py-12">
              <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-600">Nenhum lançamento encontrado no período</p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingEntry ? 'Editar ' : 'Nova '}
                  {modalType === 'income' ? 'Receita' : 'Despesa'}
                </h3>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Descrição *</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Valor *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data *</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Selecione...</option>
                    {(modalType === 'income' ? categoryOptionsIncome : categoryOptionsExpense).map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <User className="h-4 w-4 inline mr-1" />
                    Cliente
                  </label>
                  <select
                    value={formData.customer_id}
                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value, construction_work_id: '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Sem vinculo com cliente</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.cpf ? `(${c.cpf})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.customer_id && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Building2 className="h-4 w-4 inline mr-1" />
                      Obra
                    </label>
                    <select
                      value={formData.construction_work_id}
                      onChange={(e) => setFormData({ ...formData, construction_work_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Nao vincular a obra</option>
                      {filteredWorks.length > 0 ? (
                        filteredWorks.map(w => (
                          <option key={w.id} value={w.id}>{w.work_name}</option>
                        ))
                      ) : (
                        <option value="" disabled>Nenhuma obra em andamento</option>
                      )}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {filteredWorks.length > 0
                        ? `${filteredWorks.length} obra(s) ativa(s) para este cliente`
                        : 'Este cliente nao possui obras em andamento'}
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Categoria de Custo</label>
                  <select
                    value={formData.cost_category_id}
                    onChange={(e) => setFormData({ ...formData, cost_category_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Selecione...</option>
                    {(modalType === 'income' ? incomeCategories : expenseCategories).map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Forma de Pagamento</label>
                  <select
                    value={formData.payment_method_id}
                    onChange={(e) => setFormData({ ...formData, payment_method_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Selecione...</option>
                    {paymentMethods.map(pm => (
                      <option key={pm.id} value={pm.id}>{pm.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Referência</label>
                  <input
                    type="text"
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    placeholder="Nº NF, cheque..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Save className="h-4 w-4" />
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedEntryForConfirm && (
        <ConfirmPaymentModal
          isOpen={showConfirmModal}
          entry={{
            id: selectedEntryForConfirm.id,
            date: selectedEntryForConfirm.date,
            category: selectedEntryForConfirm.cost_categories?.name || 'Sem categoria',
            description: selectedEntryForConfirm.description,
            amount: selectedEntryForConfirm.amount,
            payment_method_id: selectedEntryForConfirm.payment_method_id,
            notes: selectedEntryForConfirm.notes,
            payment_status: selectedEntryForConfirm.payment_status || undefined,
            payment_confirmed_date: selectedEntryForConfirm.payment_confirmed_date || undefined,
            payment_methods: selectedEntryForConfirm.payment_methods ? { name: selectedEntryForConfirm.payment_methods.name } : undefined,
          }}
          onClose={() => {
            setShowConfirmModal(false);
            setSelectedEntryForConfirm(null);
          }}
          onSuccess={handleConfirmPaymentSuccess}
        />
      )}
        </div>
      )}

      {/* Tab: Recebíveis */}
      {activeTab === 'recebiveis' && (
        <FactoryReceivables />
      )}
    </div>
  );
}
