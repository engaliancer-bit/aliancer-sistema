import React, { useEffect, useMemo, useCallback, useRef, memo, useReducer } from 'react';
import { supabase } from '../lib/supabase';
import { useRealtimeChannel, RealtimeEvent } from '../hooks/useRealtimeChannel';
import { useNormalizedRefTable } from '../hooks/useNormalizedRefTable';
import { useAdvancedDebounce } from '../hooks/useAdvancedDebounceThrottle';
import { measureAsync, recordMetric, incrementRenderCount, recordRealtimeEvent, METRIC } from '../lib/performanceMonitor';
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
  User,
  ChevronDown,
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

const PAGE_SIZE = 100;

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

// [REDUCER] Single state update instead of 5 separate setState calls.
// All reference data batched into one dispatch → 1 render instead of 5.
interface RefDataState {
  costCategories: CostCategory[];
  paymentMethods: PaymentMethod[];
  customers: Customer[];
  constructionWorks: ConstructionWork[];
}

type RefDataAction = { type: 'SET_ALL'; payload: Partial<RefDataState> };

function refDataReducer(state: RefDataState, action: RefDataAction): RefDataState {
  if (action.type === 'SET_ALL') return { ...state, ...action.payload };
  return state;
}

const initialRefData: RefDataState = {
  costCategories: [],
  paymentMethods: [],
  customers: [],
  constructionWorks: [],
};

export default function FactoryFinanceManager({
  initialStartDate = '',
  initialEndDate = '',
}: FactoryFinanceManagerProps) {
  incrementRenderCount('FactoryFinanceManager');

  const [entries, setEntries] = React.useState<CashFlowEntry[]>([]);
  const [refData, dispatchRefData] = useReducer(refDataReducer, initialRefData);
  const { costCategories, paymentMethods, customers, constructionWorks } = refData;

  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(0);
  const [activeTab, setActiveTab] = React.useState<'lancamentos' | 'recebiveis'>('lancamentos');

  const [showModal, setShowModal] = React.useState(false);
  const [modalType, setModalType] = React.useState<'income' | 'expense'>('income');
  const [editingEntry, setEditingEntry] = React.useState<CashFlowEntry | null>(null);

  const [filterType, setFilterType] = React.useState<'all' | 'income' | 'expense'>('all');
  const [filterCategory, setFilterCategory] = React.useState('all');
  const [filterPaymentStatus, setFilterPaymentStatus] = React.useState<'all' | 'confirmed' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [startDate, setStartDate] = React.useState(initialStartDate);
  const [endDate, setEndDate] = React.useState(initialEndDate);

  const [showConfirmModal, setShowConfirmModal] = React.useState(false);
  const [selectedEntryForConfirm, setSelectedEntryForConfirm] = React.useState<CashFlowEntry | null>(null);

  const [formData, setFormData] = React.useState({
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

  const debouncedStartDate = useAdvancedDebounce(startDate, {
    delay: 350,
    maxWait: 800,
    cancelCategory: 'receitas-despesas',
  });
  const debouncedEndDate = useAdvancedDebounce(endDate, {
    delay: 350,
    maxWait: 800,
    cancelCategory: 'receitas-despesas',
  });

  const isLoadingDataRef = useRef(false);
  const refDataLoadedRef = useRef(false);

  const pendingInsertCashFlowRef = useRef<Set<string>>(new Set());
  const insertCashFlowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initialStartDate) setStartDate(initialStartDate);
    if (initialEndDate) setEndDate(initialEndDate);
  }, [initialStartDate, initialEndDate]);

  // [PERF] Reference data loaded once on mount — never re-loaded on date changes.
  // Batched into single dispatch to produce exactly 1 re-render.
  useEffect(() => {
    if (refDataLoadedRef.current) return;
    refDataLoadedRef.current = true;

    async function loadRefData() {
      try {
        const [catRes, pmRes, custRes, worksRes] = await Promise.all([
          supabase.from('cost_categories').select('id, name, type').order('name'),
          supabase.from('payment_methods').select('id, name').order('name'),
          supabase.from('customers').select('id, name, cpf, person_type').order('name'),
          supabase
            .from('construction_works')
            .select('id, work_name, customer_id, status')
            .in('status', ['em_andamento', 'pausada'])
            .order('work_name'),
        ]);

        // [REDUCER] Single dispatch → 1 render for all 4 reference tables
        dispatchRefData({
          type: 'SET_ALL',
          payload: {
            costCategories: catRes.data || [],
            paymentMethods: pmRes.data || [],
            customers: custRes.data || [],
            constructionWorks: (worksRes.data || []) as ConstructionWork[],
          },
        });
      } catch (err) {
        console.error('Erro ao carregar dados de referência:', err);
      }
    }

    loadRefData();
  }, []);

  // [MEMO] Reference Maps built once when the arrays change, not on every render.
  const costCatMap = useMemo(
    () => new Map(costCategories.map((c) => [c.id, c])),
    [costCategories]
  );
  const payMethodMap = useMemo(
    () => new Map(paymentMethods.map((p) => [p.id, p])),
    [paymentMethods]
  );
  const customersMap = useMemo(
    () => new Map(customers.map((c) => [c.id, c])),
    [customers]
  );
  const constructionWorksMap = useMemo(
    () => new Map(constructionWorks.map((w) => [w.id, w])),
    [constructionWorks]
  );

  // Stable refs so realtime callback can access latest maps without re-subscribing
  const costCatMapRef = useRef(costCatMap);
  costCatMapRef.current = costCatMap;
  const payMethodMapRef = useRef(payMethodMap);
  payMethodMapRef.current = payMethodMap;
  const customersMapRef = useRef(customersMap);
  customersMapRef.current = customersMap;
  const constructionWorksMapRef = useRef(constructionWorksMap);
  constructionWorksMapRef.current = constructionWorksMap;

  const { populate: populateCostCategoriesCache } = useNormalizedRefTable<CostCategory>({
    tableName: 'cost_categories',
    selectFields: 'id, name, type',
  });
  const { populate: populatePaymentMethodsCache } = useNormalizedRefTable<PaymentMethod>({
    tableName: 'payment_methods',
    selectFields: 'id, name',
  });
  const { populate: populateCustomersCache } = useNormalizedRefTable<Customer>({
    tableName: 'customers',
    selectFields: 'id, name, cpf, person_type',
  });
  const { populate: populateConstructionWorksCache } = useNormalizedRefTable<ConstructionWork>({
    tableName: 'construction_works',
    selectFields: 'id, work_name, customer_id, status',
  });

  useEffect(() => {
    if (costCategories.length > 0) populateCostCategoriesCache(costCategories);
  }, [costCategories, populateCostCategoriesCache]);
  useEffect(() => {
    if (paymentMethods.length > 0) populatePaymentMethodsCache(paymentMethods);
  }, [paymentMethods, populatePaymentMethodsCache]);
  useEffect(() => {
    if (customers.length > 0) populateCustomersCache(customers);
  }, [customers, populateCustomersCache]);
  useEffect(() => {
    if (constructionWorks.length > 0) populateConstructionWorksCache(constructionWorks);
  }, [constructionWorks, populateConstructionWorksCache]);

  // [PERF] enrichEntry uses ref-based Maps — no JOIN needed in the SQL query.
  function enrichEntry(raw: Record<string, unknown>): CashFlowEntry {
    const costCatId = raw.cost_category_id as string | null;
    const payMethodId = raw.payment_method_id as string | null;
    const customerId = raw.customer_id as string | null;
    const workId = raw.construction_work_id as string | null;

    const costCat = costCatId ? (costCatMapRef.current.get(costCatId) ?? null) : null;
    const payMethod = payMethodId ? (payMethodMapRef.current.get(payMethodId) ?? null) : null;
    const customer = customerId ? (customersMapRef.current.get(customerId) ?? null) : null;
    const work = workId ? (constructionWorksMapRef.current.get(workId) ?? null) : null;

    return {
      ...(raw as unknown as CashFlowEntry),
      cost_categories: costCat ? { name: costCat.name, type: costCat.type } : null,
      payment_methods: payMethod ? { name: payMethod.name } : null,
      customers: customer ? { name: customer.name } : null,
      construction_works: work ? { work_name: work.work_name } : null,
    };
  }

  // [PERF] Lean SELECT — no JOINs. Enrichment happens locally via Maps.
  async function loadEntries(page = 0, append = false) {
    const reqKey = createRequestKey('receitas-despesas', 'load_entries');
    const controller = registerRequest(reqKey);

    try {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const queryStart = performance.now();
      const { data, error } = await measureAsync(
        'receitas:load_list',
        async () => {
          let query = supabase
            .from('cash_flow')
            .select(
              'id, date, type, description, amount, payment_method_id, cost_category_id, ' +
              'purchase_id, sale_id, payable_account_id, customer_revenue_id, customer_id, ' +
              'construction_work_id, notes, reference, payment_status, payment_confirmed_date'
            )
            .eq('business_unit', 'factory')
            .order('date', { ascending: false })
            .range(from, to);

          if (startDate) query = query.gte('date', startDate);
          if (endDate) query = query.lte('date', endDate);

          return query;
        },
        { module: 'receitas-despesas' }
      );
      const queryTime = performance.now() - queryStart;

      if (controller.signal.aborted) return;
      if (error) throw error;

      const transformStart = performance.now();
      const enriched = (data || []).map((row) => enrichEntry(row as Record<string, unknown>));
      const transformTime = performance.now() - transformStart;

      if (process.env.NODE_ENV !== 'production') {
        console.debug(
          `[factory_finance.load] page=${page} queryTime=${queryTime.toFixed(1)}ms transformTime=${transformTime.toFixed(1)}ms rowCount=${enriched.length}`
        );
      }

      if (append) {
        setEntries((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const newItems = enriched.filter((e) => !existingIds.has(e.id));
          return [...prev, ...newItems];
        });
      } else {
        setEntries(enriched);
      }

      // [PAGINATION] Show "load more" only when a full page was returned
      setHasMore(enriched.length === PAGE_SIZE);
      setCurrentPage(page);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.error('Erro ao carregar lançamentos:', err);
    } finally {
      unregisterRequest(reqKey);
    }
  }

  async function loadData() {
    if (isLoadingDataRef.current) return;
    isLoadingDataRef.current = true;
    if (insertCashFlowTimerRef.current) {
      clearTimeout(insertCashFlowTimerRef.current);
      insertCashFlowTimerRef.current = null;
    }
    pendingInsertCashFlowRef.current.clear();
    setLoading(true);
    const t0 = performance.now();
    try {
      await loadEntries(0, false);
      recordMetric(METRIC.FACTORY_FINANCE_LOAD, performance.now() - t0);
    } finally {
      isLoadingDataRef.current = false;
      setLoading(false);
    }
  }

  async function handleLoadMore() {
    setLoadingMore(true);
    try {
      await loadEntries(currentPage + 1, true);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    cancelRequestsByCategory('receitas-despesas');
    loadData();
  }, [debouncedStartDate, debouncedEndDate]);

  const startDateRef = useRef(startDate);
  startDateRef.current = startDate;
  const endDateRef = useRef(endDate);
  endDateRef.current = endDate;

  useRealtimeChannel({
    channelName: 'receitas-cash-flow',
    tables: ['cash_flow'],
    onBatchEvents: useCallback((events: RealtimeEvent[]) => {
      events.forEach(() => recordRealtimeEvent(METRIC.FACTORY_FINANCE_REALTIME));
      const insertIds: string[] = [];

      setEntries((prev) => {
        let next = [...prev];

        for (const evt of events) {
          if (evt.eventType === 'DELETE') {
            const oldId = (evt.old as any)?.id as string | undefined;
            if (oldId) next = next.filter((e) => e.id !== oldId);
            continue;
          }

          const row = (evt.new || evt.old) as Record<string, unknown>;
          if (!row || !row.id) continue;
          if ((row.business_unit as string) !== 'factory') continue;

          const entryDate = row.date as string;
          const sd = startDateRef.current;
          const ed = endDateRef.current;
          if (sd && entryDate < sd) continue;
          if (ed && entryDate > ed) continue;

          if (evt.eventType === 'UPDATE') {
            const enriched = enrichEntry(row);
            next = next.map((e) => (e.id === enriched.id ? enriched : e));
          } else if (evt.eventType === 'INSERT') {
            if (!pendingInsertCashFlowRef.current.has(row.id as string)) {
              insertIds.push(row.id as string);
            } else {
              pendingInsertCashFlowRef.current.delete(row.id as string);
            }
          }
        }

        return next;
      });

      if (insertIds.length > 0) {
        insertIds.forEach((id) => pendingInsertCashFlowRef.current.add(id));
        if (insertCashFlowTimerRef.current) clearTimeout(insertCashFlowTimerRef.current);
        insertCashFlowTimerRef.current = setTimeout(async () => {
          const ids = Array.from(pendingInsertCashFlowRef.current);
          pendingInsertCashFlowRef.current.clear();
          try {
            let batchQuery = supabase
              .from('cash_flow')
              .select(
                'id, date, type, description, amount, payment_method_id, cost_category_id, ' +
                'purchase_id, sale_id, payable_account_id, customer_revenue_id, customer_id, ' +
                'construction_work_id, notes, reference, payment_status, payment_confirmed_date'
              )
              .in('id', ids)
              .eq('business_unit', 'factory');

            const sd = startDateRef.current;
            const ed = endDateRef.current;
            if (sd) batchQuery = batchQuery.gte('date', sd);
            if (ed) batchQuery = batchQuery.lte('date', ed);

            const { data } = await batchQuery;
            if (data && data.length > 0) {
              const enriched = data.map((row) => enrichEntry(row as Record<string, unknown>));
              setEntries((prev) => {
                const existingIds = new Set(prev.map((e) => e.id));
                const newItems = enriched.filter((e) => !existingIds.has(e.id));
                if (newItems.length === 0) return prev;
                return [...newItems, ...prev];
              });
            }
          } catch (err) {
            console.error('Erro ao buscar novos lançamentos em lote:', err);
          }
        }, 300);
      }
    }, []),
  });

  const debouncedSearchTerm = useAdvancedDebounce(searchTerm, {
    delay: 350,
    maxWait: 800,
    cancelCategory: 'receitas-search',
  });

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
      category: (entry as any).category || '',
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
        const updatedEntry: CashFlowEntry = {
          ...editingEntry,
          ...entryData,
          cost_categories: entryData.cost_category_id
            ? costCatMapRef.current.get(entryData.cost_category_id)
              ? { name: costCatMapRef.current.get(entryData.cost_category_id)!.name, type: costCatMapRef.current.get(entryData.cost_category_id)!.type }
              : null
            : null,
          payment_methods: entryData.payment_method_id
            ? costCatMapRef.current.get(entryData.payment_method_id)
              ? { name: payMethodMapRef.current.get(entryData.payment_method_id)!.name }
              : null
            : null,
          customers: entryData.customer_id
            ? customersMapRef.current.get(entryData.customer_id)
              ? { name: customersMapRef.current.get(entryData.customer_id)!.name }
              : null
            : null,
          construction_works: entryData.construction_work_id
            ? constructionWorksMapRef.current.get(entryData.construction_work_id)
              ? { work_name: constructionWorksMapRef.current.get(entryData.construction_work_id)!.work_name }
              : null
            : null,
        };
        setEntries((prev) => prev.map((e) => (e.id === editingEntry.id ? updatedEntry : e)));
      } else {
        const { data, error } = await supabase
          .from('cash_flow')
          .insert([entryData])
          .select(
            'id, date, type, description, amount, payment_method_id, cost_category_id, ' +
            'purchase_id, sale_id, payable_account_id, customer_revenue_id, customer_id, ' +
            'construction_work_id, notes, reference, payment_status, payment_confirmed_date'
          )
          .single();
        if (error) throw error;
        if (data) {
          const newEntry = enrichEntry(data as Record<string, unknown>);
          pendingInsertCashFlowRef.current.add(newEntry.id);
          setEntries((prev) => {
            const existingIds = new Set(prev.map((e) => e.id));
            if (existingIds.has(newEntry.id)) return prev;
            return [newEntry, ...prev];
          });
        }
      }

      setShowModal(false);
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
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (error: any) {
      alert('Erro ao excluir: ' + error.message);
    }
  }

  function handleOpenConfirmPayment(entry: CashFlowEntry) {
    setSelectedEntryForConfirm(entry);
    setShowConfirmModal(true);
  }

  function handleConfirmPaymentSuccess() {
    setShowConfirmModal(false);
    if (selectedEntryForConfirm) {
      const confirmedId = selectedEntryForConfirm.id;
      const confirmedDate = format(new Date(), 'yyyy-MM-dd');
      setEntries((prev) =>
        prev.map((e) =>
          e.id === confirmedId
            ? { ...e, payment_status: 'confirmado', payment_confirmed_date: confirmedDate }
            : e
        )
      );
    }
    setSelectedEntryForConfirm(null);
  }

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
    recordMetric('receitas:apply_filter', performance.now() - start, 'ms', { total: String(result.length) });
    recordMetric(METRIC.FACTORY_FINANCE_FILTER_APPLY, performance.now() - start);
    return result;
  }, [entries, filterType, filterCategory, debouncedSearchTerm, filterPaymentStatus]);

  const { expensesPaid, expensesPending } = useMemo(() => {
    const expenseEntries = entries.filter(e => e.type === 'expense');
    return {
      expensesPaid: expenseEntries.filter(e => e.payment_status === 'confirmado').reduce((sum, e) => sum + e.amount, 0),
      expensesPending: expenseEntries.filter(e => e.payment_status !== 'confirmado').reduce((sum, e) => sum + e.amount, 0),
    };
  }, [entries]);

  const incomeCategories = useMemo(() => costCategories.filter(c => c.type?.startsWith('income')), [costCategories]);
  const expenseCategories = useMemo(() => costCategories.filter(c => !c.type?.startsWith('income')), [costCategories]);

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

            {/* [PAGINATION] Load more button — avoids loading thousands of rows upfront */}
            {hasMore && (
              <div className="flex justify-center py-4 border-t border-gray-100">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loadingMore ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                      Carregando...
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Carregar mais {PAGE_SIZE} registros
                    </>
                  )}
                </button>
              </div>
            )}
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

      {activeTab === 'recebiveis' && (
        <FactoryReceivables />
      )}
    </div>
  );
}
