import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { supabase } from '../lib/supabase';
import { useAdvancedDebounce } from '../hooks/useAdvancedDebounceThrottle';
import { registerRequest, unregisterRequest, createRequestKey } from '../lib/requestCancellation';
import VirtualizedListAdvanced, { useVirtualizedHeight } from './VirtualizedListAdvanced';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Filter,
  FileText,
  AlertCircle,
  CheckCircle,
  X,
  Save,
  Search,
  Edit2,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import PayrollConfirmationModal from './engineering/PayrollConfirmationModal';

const ENTRY_ITEM_HEIGHT = 64;
const MAX_LIST_HEIGHT = 600;
const ENTRIES_PAGE_SIZE = 50;

interface FinanceEntry {
  id: string;
  entry_type: 'receita' | 'despesa';
  category: string;
  custom_category_id: string | null;
  amount: number;
  description: string;
  project_id: string | null;
  customer_id: string | null;
  payment_id: string | null;
  advance_id: string | null;
  payroll_schedule_id: string | null;
  payment_method: string | null;
  entry_date: string;
  due_date: string | null;
  paid_date: string | null;
  status: 'pendente' | 'efetivado' | 'cancelado';
  notes: string | null;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
  customer_id: string;
}

interface Customer {
  id: string;
  name: string;
}

interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
  is_custom: boolean;
  color: string | null;
  active: boolean;
}

interface ProjectAdvance {
  id: string;
  project_id: string;
  customer_id: string;
  description: string;
  amount: number;
  advance_type: string;
  advance_date: string;
  reimbursed: boolean;
  reimbursed_date: string | null;
  notes: string | null;
}

interface EngineeringFinanceManagerProps {
  initialStartDate?: string;
  initialEndDate?: string;
}

// ─── Memoized entry row ───────────────────────────────────────────────────────
interface FinanceEntryRowProps {
  entry: FinanceEntry;
  style: React.CSSProperties;
  getCategoryLabel: (entry: FinanceEntry) => string;
  formatCurrency: (value: number) => string;
  onEdit: (entry: FinanceEntry) => void;
  onDelete: (id: string) => void;
}

const FinanceEntryRow = memo(function FinanceEntryRow({
  entry, style, getCategoryLabel, formatCurrency, onEdit, onDelete,
}: FinanceEntryRowProps) {
  const isSystemEntry = !!(entry.payment_id || entry.advance_id || entry.payroll_schedule_id);
  return (
    <div style={style} className="flex items-center border-b border-gray-100 hover:bg-gray-50 bg-white px-6 text-sm gap-3">
      <div className="w-24 whitespace-nowrap text-gray-900 flex-shrink-0">
        {format(new Date(entry.entry_date), 'dd/MM/yyyy')}
      </div>
      <div className="w-24 flex-shrink-0">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
          entry.entry_type === 'receita' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {entry.entry_type === 'receita' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {entry.entry_type === 'receita' ? 'Receita' : 'Despesa'}
        </span>
      </div>
      <div className="w-36 text-gray-600 flex-shrink-0 truncate">{getCategoryLabel(entry)}</div>
      <div className="flex-1 min-w-0">
        <div className="text-gray-900 truncate">{entry.description}</div>
        {entry.notes && <p className="text-xs text-gray-500 truncate">{entry.notes}</p>}
      </div>
      <div className="w-32 text-right font-medium flex-shrink-0">
        <span className={entry.entry_type === 'receita' ? 'text-green-600' : 'text-red-600'}>
          {entry.entry_type === 'despesa' && '-'}{formatCurrency(entry.amount)}
        </span>
      </div>
      <div className="w-24 text-center flex-shrink-0">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
          entry.status === 'efetivado' ? 'bg-blue-100 text-blue-800'
          : entry.status === 'pendente' ? 'bg-yellow-100 text-yellow-800'
          : 'bg-gray-100 text-gray-800'
        }`}>
          {entry.status === 'efetivado' ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
          {entry.status === 'efetivado' ? 'Efetivado' : entry.status === 'pendente' ? 'Pendente' : 'Cancelado'}
        </span>
      </div>
      <div className="w-16 text-center flex-shrink-0">
        {!isSystemEntry ? (
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => onEdit(entry)} className="text-blue-600 hover:text-blue-900 transition-colors" title="Editar">
              <Edit2 className="h-4 w-4" />
            </button>
            <button onClick={() => onDelete(entry.id)} className="text-red-600 hover:text-red-900 transition-colors" title="Excluir">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <span className="text-xs text-gray-500" title="Criado automaticamente pelo sistema">
            <FileText className="h-4 w-4 inline" />
          </span>
        )}
      </div>
    </div>
  );
});

export default function EngineeringFinanceManager({
  initialStartDate = '',
  initialEndDate = '',
}: EngineeringFinanceManagerProps) {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'receita' | 'despesa' | 'antecipacao'>('receita');
  const [editingEntry, setEditingEntry] = useState<FinanceEntry | null>(null);

  // Estado para modal de confirmação de salários
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [hasPendingPayrolls, setHasPendingPayrolls] = useState(false);
  const [payrollModalDismissed, setPayrollModalDismissed] = useState(false);

  const [filterType, setFilterType] = useState<'all' | 'receita' | 'despesa'>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);

  const [formData, setFormData] = useState({
    entry_type: 'receita' as 'receita' | 'despesa',
    category: '',
    amount: '',
    description: '',
    project_id: '',
    customer_id: '',
    payment_method: 'pix',
    entry_date: format(new Date(), 'yyyy-MM-dd'),
    paid_date: format(new Date(), 'yyyy-MM-dd'),
    status: 'efetivado' as 'pendente' | 'efetivado' | 'cancelado',
    notes: '',
    advance_type: 'taxa',
  });

  const categoryOptionsReceita = [
    { value: 'honorarios', label: 'Honorários' },
    { value: 'antecipacao_reembolso', label: 'Antecipação/Reembolso' },
    { value: 'outras_receitas', label: 'Outras Receitas' },
  ];

  // Categorias de despesa: sistema + customizadas
  const categoryOptionsDespesa = [
    { value: 'antecipacao_cliente', label: 'Antecipação para Cliente', isSystem: true },
    { value: 'operacional', label: 'Despesa Operacional', isSystem: true },
    { value: 'salario_clt', label: 'Salário CLT', isSystem: true },
    { value: 'outras_despesas', label: 'Outras Despesas', isSystem: true },
    ...expenseCategories
      .filter(cat => cat.active)
      .map(cat => ({
        value: `custom_${cat.id}`,
        label: cat.name,
        isSystem: false,
        categoryId: cat.id
      }))
  ];

  const advanceTypeOptions = [
    { value: 'taxa', label: 'Taxa' },
    { value: 'material', label: 'Material' },
    { value: 'servico_terceiro', label: 'Serviço de Terceiro' },
    { value: 'deslocamento', label: 'Deslocamento' },
    { value: 'outros', label: 'Outros' },
  ];

  const paymentMethodOptions = [
    { value: 'dinheiro', label: 'Dinheiro' },
    { value: 'pix', label: 'PIX' },
    { value: 'transferencia', label: 'Transferência' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'cartao', label: 'Cartão' },
    { value: 'boleto', label: 'Boleto' },
  ];

  // [DEBOUNCE] Prevent rapid-fire loadData on quick date changes
  const debouncedStartDate = useAdvancedDebounce(startDate, { delay: 350, maxWait: 800, cancelCategory: 'eng-finance' });
  const debouncedEndDate = useAdvancedDebounce(endDate, { delay: 350, maxWait: 800, cancelCategory: 'eng-finance' });
  const debouncedSearch = useAdvancedDebounce(searchTerm, { delay: 300, maxWait: 700 });

  const isLoadingDataRef = useRef(false);

  // Sincronizar datas das props
  useEffect(() => {
    if (initialStartDate) setStartDate(initialStartDate);
    if (initialEndDate) setEndDate(initialEndDate);
  }, [initialStartDate, initialEndDate]);

  useEffect(() => {
    loadData();
    checkPendingPayrolls();
  }, [debouncedStartDate, debouncedEndDate]);

  // Verificar salários pendentes periodicamente
  useEffect(() => {
    checkPendingPayrolls();

    // Verificar a cada 5 minutos
    const interval = setInterval(() => {
      checkPendingPayrolls();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    if (isLoadingDataRef.current) return;
    isLoadingDataRef.current = true;
    setLoading(true);
    try {
      await Promise.all([
        loadEntries(),
        loadProjects(),
        loadCustomers(),
        loadExpenseCategories(),
      ]);
    } finally {
      isLoadingDataRef.current = false;
      setLoading(false);
    }
  }

  async function checkPendingPayrolls() {
    try {
      const { data, error } = await supabase
        .from('v_pending_payroll_current_month')
        .select('schedule_id')
        .limit(1);

      if (error) throw error;

      const hasPending = data && data.length > 0;
      setHasPendingPayrolls(hasPending);

      // Abrir modal automaticamente se houver pendentes e não foi dispensado ainda
      // Modal deve reaparecer sempre que o componente é montado e há pendentes
      if (hasPending && !payrollModalDismissed && !showPayrollModal) {
        setShowPayrollModal(true);
      }
    } catch (error) {
      console.error('Erro ao verificar salários pendentes:', error);
    }
  }

  function handleClosePayrollModal() {
    setShowPayrollModal(false);
    // Marcar como dispensado apenas para esta sessão
    // Na próxima vez que o componente montar, irá verificar novamente
    setPayrollModalDismissed(true);
  }

  async function loadExpenseCategories() {
    try {
      const { data, error } = await supabase
        .from('engineering_expense_categories')
        .select('*')
        .eq('active', true)
        .order('is_custom', { ascending: true })
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setExpenseCategories(data || []);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
    }
  }

  async function loadEntries() {
    const reqKey = createRequestKey('eng-finance', 'load_entries');
    const controller = registerRequest(reqKey);
    try {
      let query = supabase
        .from('engineering_finance_entries')
        .select('id, entry_type, category, custom_category_id, amount, description, project_id, customer_id, payment_id, advance_id, payroll_schedule_id, payment_method, entry_date, due_date, paid_date, status, notes, created_at')
        .order('entry_date', { ascending: false });

      if (debouncedStartDate) {
        query = query.gte('entry_date', debouncedStartDate);
      }
      if (debouncedEndDate) {
        query = query.lte('entry_date', debouncedEndDate);
      }

      const { data, error } = await query;
      if (controller.signal.aborted) return;
      if (error) throw error;
      setEntries(data || []);
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      console.error('Erro ao carregar lançamentos:', error);
    } finally {
      unregisterRequest(reqKey);
    }
  }

  async function loadProjects() {
    try {
      const { data, error } = await supabase
        .from('engineering_projects')
        .select('id, name, customer_id')
        .order('name');

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
    }
  }

  async function loadCustomers() {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  }

  function openModal(type: 'receita' | 'despesa' | 'antecipacao') {
    setModalType(type);
    setEditingEntry(null);
    setFormData({
      entry_type: type === 'antecipacao' ? 'despesa' : type,
      category: type === 'receita' ? 'honorarios' : type === 'antecipacao' ? 'antecipacao_cliente' : 'operacional',
      amount: '',
      description: '',
      project_id: '',
      customer_id: '',
      payment_method: 'pix',
      entry_date: format(new Date(), 'yyyy-MM-dd'),
      paid_date: format(new Date(), 'yyyy-MM-dd'),
      status: 'efetivado',
      notes: '',
      advance_type: 'taxa',
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      if (modalType === 'antecipacao') {
        await handleAdvanceSubmit();
      } else {
        await handleRegularEntrySubmit();
      }

      setShowModal(false);
      loadData();
    } catch (error: any) {
      alert('Erro ao salvar: ' + error.message);
    }
  }

  async function handleRegularEntrySubmit() {
    // Processar categoria customizada
    let categoryValue = formData.category;
    let customCategoryId = null;

    if (categoryValue.startsWith('custom_')) {
      customCategoryId = categoryValue.replace('custom_', '');
      // Usar uma categoria padrão para o campo category
      categoryValue = 'outras_despesas';
    }

    const entryData = {
      entry_type: formData.entry_type,
      category: categoryValue,
      custom_category_id: customCategoryId,
      amount: parseFloat(formData.amount),
      description: formData.description,
      project_id: formData.project_id || null,
      customer_id: formData.customer_id || null,
      payment_method: formData.payment_method,
      entry_date: formData.entry_date,
      paid_date: formData.paid_date,
      status: formData.status,
      notes: formData.notes || null,
    };

    if (editingEntry) {
      // Editar
      const { error } = await supabase
        .from('engineering_finance_entries')
        .update(entryData)
        .eq('id', editingEntry.id);

      if (error) throw error;
    } else {
      // Criar
      const { error } = await supabase
        .from('engineering_finance_entries')
        .insert([entryData]);

      if (error) throw error;
    }
  }

  async function handleAdvanceSubmit() {
    const { data, error } = await supabase
      .from('engineering_project_advances')
      .insert([{
        project_id: formData.project_id,
        customer_id: formData.customer_id,
        description: formData.description,
        amount: parseFloat(formData.amount),
        advance_type: formData.advance_type,
        advance_date: formData.entry_date,
        notes: formData.notes || null,
      }]);

    if (error) throw error;
  }

  const filteredEntries = useMemo(() => entries.filter(entry => {
    if (filterType !== 'all' && entry.entry_type !== filterType) return false;
    if (filterCategory !== 'all' && entry.category !== filterCategory) return false;
    if (filterStatus !== 'all' && entry.status !== filterStatus) return false;
    if (debouncedSearch && !entry.description.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
    return true;
  }), [entries, filterType, filterCategory, filterStatus, debouncedSearch]);

  const getCategoryLabel = useCallback(function getCategoryLabel(entry: FinanceEntry): string {
    // Se tem categoria customizada, buscar o nome
    if (entry.custom_category_id) {
      const customCat = expenseCategories.find(c => c.id === entry.custom_category_id);
      if (customCat) return customCat.name;
    }

    // Categorias padrão
    const categoryMap: { [key: string]: string } = {
      'honorarios': 'Honorários',
      'antecipacao_reembolso': 'Antecipação/Reembolso',
      'outras_receitas': 'Outras Receitas',
      'antecipacao_cliente': 'Antecipação para Cliente',
      'operacional': 'Despesa Operacional',
      'salario_clt': 'Salário CLT',
      'outras_despesas': 'Outras Despesas',
    };

    return categoryMap[entry.category] || entry.category;
  }, [expenseCategories]);

  const formatCurrency = useCallback(function formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }, []);

  const handleEditCallback = useCallback((entry: FinanceEntry) => {
    setEditingEntry(entry);
    let categoryValue = entry.category;
    if (entry.custom_category_id) {
      categoryValue = `custom_${entry.custom_category_id}`;
    }
    setFormData({
      entry_type: entry.entry_type,
      category: categoryValue,
      amount: entry.amount.toString(),
      description: entry.description,
      project_id: entry.project_id || '',
      customer_id: entry.customer_id || '',
      payment_method: entry.payment_method || 'pix',
      entry_date: entry.entry_date,
      paid_date: entry.paid_date || entry.entry_date,
      status: entry.status,
      notes: entry.notes || '',
      advance_type: 'taxa',
    });
    setModalType(entry.entry_type);
    setShowModal(true);
  }, []);

  const handleDeleteCallback = useCallback(async (id: string) => {
    if (!confirm('Deseja realmente excluir este lançamento?')) return;
    try {
      const { error } = await supabase
        .from('engineering_finance_entries')
        .delete()
        .eq('id', id);
      if (error) throw error;
      alert('Lançamento excluído com sucesso!');
      loadData();
    } catch (error: any) {
      alert('Erro ao excluir: ' + error.message);
    }
  }, []);

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
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Receitas e Despesas</h2>
            <div className="flex gap-2">
              <button
                onClick={() => openModal('receita')}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Plus className="h-4 w-4" />
                Nova Receita
              </button>
              <button
                onClick={() => openModal('despesa')}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <Plus className="h-4 w-4" />
                Nova Despesa
              </button>
              <button
                onClick={() => openModal('antecipacao')}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                <Plus className="h-4 w-4" />
                Antecipação
              </button>
            </div>
          </div>

          {/* Alerta de Salários Pendentes */}
          {hasPendingPayrolls && (
            <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5 mr-3 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Pagamento de Salários Pendente
                  </h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    Há salários de colaboradores CLT aguardando confirmação de pagamento para este mês.
                  </p>
                </div>
                <button
                  onClick={() => setShowPayrollModal(true)}
                  className="ml-3 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Confirmar Pagamentos
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                <option value="receita">Receitas</option>
                <option value="despesa">Despesas</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Categoria</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Todas</option>
                <optgroup label="Receitas">
                  {categoryOptionsReceita.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Despesas">
                  {categoryOptionsDespesa.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </optgroup>
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
          <div className="min-w-full">
            <div className="bg-gray-50 border-b border-gray-200">
              <div className="flex items-center px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider gap-3">
                <div className="w-24 flex-shrink-0">Data</div>
                <div className="w-24 flex-shrink-0">Tipo</div>
                <div className="w-36 flex-shrink-0">Categoria</div>
                <div className="flex-1 min-w-0">Descrição</div>
                <div className="w-32 text-right flex-shrink-0">Valor</div>
                <div className="w-24 text-center flex-shrink-0">Status</div>
                <div className="w-16 text-center flex-shrink-0">Ações</div>
              </div>
            </div>
            {filteredEntries.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">Nenhum lançamento encontrado</p>
              </div>
            ) : (
              <VirtualizedListAdvanced
                items={filteredEntries}
                height={Math.min(filteredEntries.length * ENTRY_ITEM_HEIGHT, MAX_LIST_HEIGHT)}
                itemHeight={ENTRY_ITEM_HEIGHT}
                threshold={15}
                renderItem={(entry, _index, style) => (
                  <FinanceEntryRow
                    key={entry.id}
                    entry={entry}
                    style={style}
                    getCategoryLabel={getCategoryLabel}
                    formatCurrency={formatCurrency}
                    onEdit={handleEditCallback}
                    onDelete={handleDeleteCallback}
                  />
                )}
                emptyMessage="Nenhum lançamento encontrado"
              />
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingEntry ? 'Editar ' : 'Nova '}
                  {modalType === 'receita' && 'Receita'}
                  {modalType === 'despesa' && 'Despesa'}
                  {modalType === 'antecipacao' && 'Antecipação para Cliente'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Categoria *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Selecione...</option>
                    {formData.entry_type === 'receita' ? (
                      categoryOptionsReceita.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))
                    ) : (
                      <>
                        <optgroup label="Categorias do Sistema">
                          {categoryOptionsDespesa.filter((c: any) => c.isSystem).map((cat: any) => (
                            <option key={cat.value} value={cat.value}>
                              {cat.label}
                            </option>
                          ))}
                        </optgroup>
                        {categoryOptionsDespesa.filter((c: any) => !c.isSystem).length > 0 && (
                          <optgroup label="Categorias Customizadas">
                            {categoryOptionsDespesa.filter((c: any) => !c.isSystem).map((cat: any) => (
                              <option key={cat.value} value={cat.value}>
                                {cat.label}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </>
                    )}
                  </select>
                </div>

                {modalType === 'antecipacao' && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tipo de Antecipação *
                    </label>
                    <select
                      value={formData.advance_type}
                      onChange={(e) => setFormData({ ...formData, advance_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      {advanceTypeOptions.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Valor *
                  </label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data *
                  </label>
                  <input
                    type="date"
                    value={formData.entry_date}
                    onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descrição *
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                {modalType === 'antecipacao' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Projeto *
                      </label>
                      <select
                        value={formData.project_id}
                        onChange={(e) => {
                          const projectId = e.target.value;
                          const project = projects.find(p => p.id === projectId);
                          setFormData({
                            ...formData,
                            project_id: projectId,
                            customer_id: project?.customer_id || ''
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      >
                        <option value="">Selecione...</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cliente *
                      </label>
                      <select
                        value={formData.customer_id}
                        onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      >
                        <option value="">Selecione...</option>
                        {customers.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {modalType !== 'antecipacao' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Projeto (opcional)
                      </label>
                      <select
                        value={formData.project_id}
                        onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Nenhum</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Método de Pagamento
                      </label>
                      <select
                        value={formData.payment_method}
                        onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {paymentMethodOptions.map((method) => (
                          <option key={method.value} value={method.value}>
                            {method.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="efetivado">Efetivado</option>
                        <option value="pendente">Pendente</option>
                      </select>
                    </div>
                  </>
                )}

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observações
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {modalType === 'antecipacao' && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-orange-800">
                      <p className="font-medium">Atenção: Antecipação para Cliente</p>
                      <p className="mt-1">
                        Este valor será:
                      </p>
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>Registrado como despesa do escritório</li>
                        <li>Adicionado ao valor total do projeto (grand_total)</li>
                        <li>Incorporado ao saldo devedor do cliente</li>
                        <li>Marcado como reembolso quando houver recebimento</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

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

      {/* Modal de Confirmação de Salários */}
      <PayrollConfirmationModal
        isOpen={showPayrollModal}
        onClose={handleClosePayrollModal}
        onConfirm={() => {
          // Recarregar dados e verificar novamente
          setShowPayrollModal(false);
          setPayrollModalDismissed(false); // Resetar para permitir reabertura se ainda houver pendentes
          loadData();
          checkPendingPayrolls();
        }}
      />
    </div>
  );
}
