import { useState, useEffect } from 'react';
import { Package, Calendar, ChevronUp, ChevronDown, QrCode, Layers, AlertCircle, Clock, CheckCircle, XCircle, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ProductionOrderItem {
  id: string;
  production_order_id: string;
  item_type: 'product' | 'material' | 'composition';
  product_id?: string;
  material_id?: string;
  composition_id?: string;
  quantity: number;
  produced_quantity: number;
  unit_price: number;
  notes?: string;
  products?: { name: string; unit: string };
  materials?: { name: string; unit: string };
  compositions?: { name: string };
}

interface ProductionOrder {
  id: string;
  order_number: number;
  quote_id?: string;
  customer_id: string | null;
  product_id: string;
  total_quantity: number;
  produced_quantity: number;
  remaining_quantity: number;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  notes: string;
  deadline?: string | null;
  created_at: string;
  customers?: { name: string; person_type: 'pf' | 'pj' } | null;
  products?: { name: string; unit: string };
  production_order_items?: ProductionOrderItem[];
}

interface QueueItem {
  item: ProductionOrderItem;
  order: ProductionOrder;
}

type SortField = 'deadline' | 'progress' | 'name';
type SortDir = 'asc' | 'desc';

interface Props {
  onSelectItem: (item: ProductionOrderItem, order: ProductionOrder) => void;
  onGenerateLabel: (order: ProductionOrder, item: ProductionOrderItem) => void;
  refreshKey: number;
}

export default function ProductionQueue({ onSelectItem, onGenerateLabel, refreshKey }: Props) {
  const [allItems, setAllItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'product' | 'material' | 'composition'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'in_progress' | 'completed' | 'cancelled'>('all');
  const [filterDeadline, setFilterDeadline] = useState<'all' | 'overdue' | 'today' | 'week'>('all');
  const [sortField, setSortField] = useState<SortField>('deadline');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: orders, error } = await supabase
        .from('production_orders')
        .select('*, customers(name, person_type), products(name, unit)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const ordersWithItems = await Promise.all(
        (orders || []).map(async (order) => {
          const { data: items } = await supabase
            .from('production_order_items')
            .select('*, products(name, unit), materials(name, unit), compositions(name)')
            .eq('production_order_id', order.id);
          return { ...order, production_order_items: items || [] };
        })
      );

      const flat: QueueItem[] = [];
      for (const order of ordersWithItems) {
        for (const item of (order.production_order_items || [])) {
          flat.push({ item, order });
        }
      }
      setAllItems(flat);
    } catch (err) {
      console.error('Erro ao carregar fila:', err);
    } finally {
      setLoading(false);
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filtered = allItems.filter(({ item, order }) => {
    if (filterType !== 'all' && item.item_type !== filterType) return false;
    if (filterStatus !== 'all' && order.status !== filterStatus) return false;
    if (filterDeadline !== 'all') {
      if (!order.deadline) return filterDeadline === 'all';
      const dl = new Date(order.deadline + 'T00:00:00');
      if (filterDeadline === 'overdue') return dl < today && order.status !== 'completed';
      if (filterDeadline === 'today') {
        const dlStr = dl.toDateString();
        return dlStr === today.toDateString();
      }
      if (filterDeadline === 'week') {
        const week = new Date(today);
        week.setDate(week.getDate() + 7);
        return dl >= today && dl <= week;
      }
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'deadline') {
      const da = a.order.deadline ? new Date(a.order.deadline + 'T00:00:00').getTime() : Infinity;
      const db = b.order.deadline ? new Date(b.order.deadline + 'T00:00:00').getTime() : Infinity;
      cmp = da - db;
    } else if (sortField === 'progress') {
      const pa = a.item.quantity === 0 ? 0 : a.item.produced_quantity / a.item.quantity;
      const pb = b.item.quantity === 0 ? 0 : b.item.produced_quantity / b.item.quantity;
      cmp = pa - pb;
    } else if (sortField === 'name') {
      const na = a.item.products?.name || a.item.materials?.name || '';
      const nb = b.item.products?.name || b.item.materials?.name || '';
      cmp = na.localeCompare(nb, 'pt-BR');
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 text-gray-300" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-500" /> : <ChevronDown className="w-3 h-3 text-blue-500" />;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <Clock className="w-3.5 h-3.5" />;
      case 'in_progress': return <AlertCircle className="w-3.5 h-3.5" />;
      case 'completed': return <CheckCircle className="w-3.5 h-3.5" />;
      case 'cancelled': return <XCircle className="w-3.5 h-3.5" />;
      default: return null;
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'open': return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'in_progress': return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'completed': return 'text-green-700 bg-green-50 border-green-200';
      case 'cancelled': return 'text-red-700 bg-red-50 border-red-200';
      default: return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Aberta';
      case 'in_progress': return 'Em Producao';
      case 'completed': return 'Concluida';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-gray-400 text-sm">Carregando fila...</div>
      </div>
    );
  }

  const overdueCount = allItems.filter(({ order }) =>
    order.deadline && new Date(order.deadline + 'T00:00:00') < today && order.status !== 'completed'
  ).length;

  return (
    <div className="space-y-4">
      {overdueCount > 0 && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span><strong>{overdueCount}</strong> item(ns) com prazo vencido</span>
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center bg-gray-50 rounded-xl p-4 border border-gray-200">
        <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Tipo:</span>
          {(['all', 'product', 'material', 'composition'] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                filterType === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
              }`}
            >
              {t === 'all' ? 'Todos' : t === 'product' ? 'Pre-moldado' : t === 'material' ? 'Material' : 'Composicao'}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-gray-300 hidden sm:block" />

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Status:</span>
          {(['all', 'open', 'in_progress', 'completed'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                filterStatus === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
              }`}
            >
              {s === 'all' ? 'Todos' : getStatusLabel(s)}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-gray-300 hidden sm:block" />

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Prazo:</span>
          {(['all', 'overdue', 'today', 'week'] as const).map(d => (
            <button
              key={d}
              onClick={() => setFilterDeadline(d)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                filterDeadline === d
                  ? d === 'overdue' ? 'bg-red-600 text-white border-red-600' : 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
              }`}
            >
              {d === 'all' ? 'Todos' : d === 'overdue' ? 'Vencidos' : d === 'today' ? 'Hoje' : 'Esta semana'}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs text-gray-400 flex items-center gap-2">
        <span>{sorted.length} item(ns) encontrado(s)</span>
        <div className="flex items-center gap-3 ml-2">
          <button onClick={() => toggleSort('deadline')} className="flex items-center gap-1 hover:text-blue-600 transition-colors">
            Prazo <SortIcon field="deadline" />
          </button>
          <button onClick={() => toggleSort('progress')} className="flex items-center gap-1 hover:text-blue-600 transition-colors">
            Progresso <SortIcon field="progress" />
          </button>
          <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-blue-600 transition-colors">
            Nome <SortIcon field="name" />
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>Nenhum item encontrado com os filtros selecionados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(({ item, order }) => {
            const name = item.products?.name || item.materials?.name || item.compositions?.name || 'Item sem nome';
            const unit = item.products?.unit || item.materials?.unit || 'un';
            const progress = item.quantity === 0 ? 0 : Math.round((item.produced_quantity / item.quantity) * 100);
            const isOverdue = order.deadline
              && new Date(order.deadline + 'T00:00:00') < today
              && order.status !== 'completed';

            return (
              <div
                key={`${order.id}-${item.id}`}
                className={`bg-white rounded-xl border-2 p-4 transition-all duration-150 hover:shadow-md ${
                  isOverdue ? 'border-red-200 hover:border-red-300' : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isOverdue ? 'bg-red-50' : 'bg-blue-50'
                  }`}>
                    <Package className={`w-5 h-5 ${isOverdue ? 'text-red-500' : 'text-blue-500'}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-gray-900 text-sm truncate">{name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 ${getStatusStyle(order.status)}`}>
                        {getStatusIcon(order.status)}
                        {getStatusLabel(order.status)}
                      </span>
                      {isOverdue && (
                        <span className="text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full font-semibold">
                          Atrasado
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                      <span>OP #{order.order_number}</span>
                      {order.customers && <span className="flex items-center gap-1"><Package className="w-3 h-3" />{order.customers.name}</span>}
                      {order.deadline && (
                        <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-semibold' : ''}`}>
                          <Calendar className="w-3 h-3" />
                          {new Date(order.deadline + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            progress === 100 ? 'bg-green-500' : isOverdue ? 'bg-red-400' : 'bg-blue-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {item.produced_quantity}/{item.quantity} {unit} ({progress}%)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => onSelectItem(item, order)}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg border border-blue-200 transition-colors"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Detalhe</span>
                    </button>
                    {item.item_type === 'product' && item.product_id && (
                      <button
                        onClick={() => onGenerateLabel(order, item)}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-lg border border-gray-200 transition-colors"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">QR</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
