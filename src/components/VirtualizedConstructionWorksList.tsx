import { useCallback, useMemo } from 'react';
import { HardHat, Edit2, Trash2, Eye, Calendar, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import VirtualizedListAdvanced, { useVirtualizedPagination, useVirtualizedHeight } from './VirtualizedListAdvanced';

interface ConstructionWork {
  id: string;
  customer_name: string;
  description: string;
  start_date: string;
  end_date?: string;
  status: string;
  total_value?: number;
  address?: string;
}

interface VirtualizedConstructionWorksListProps {
  searchTerm?: string;
  filterStatus?: string;
  onEdit?: (work: ConstructionWork) => void;
  onDelete?: (workId: string) => void;
  onView?: (work: ConstructionWork) => void;
}

export default function VirtualizedConstructionWorksList({
  searchTerm = '',
  filterStatus = 'all',
  onEdit,
  onDelete,
  onView,
}: VirtualizedConstructionWorksListProps) {
  const PAGE_SIZE = 50;
  const ITEM_HEIGHT = 90;

  const fetchWorks = useCallback(async (offset: number, limit: number): Promise<ConstructionWork[]> => {
    let query = supabase
      .from('construction_works')
      .select(`
        id,
        description,
        start_date,
        end_date,
        status,
        total_value,
        address,
        customers!inner(name)
      `)
      .order('start_date', { ascending: false });

    if (filterStatus !== 'all') {
      query = query.eq('status', filterStatus);
    }

    if (searchTerm) {
      query = query.or(`description.ilike.%${searchTerm}%,address.ilike.%${searchTerm}%,customers.name.ilike.%${searchTerm}%`);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao carregar obras:', error);
      return [];
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      customer_name: item.customers?.name || 'Cliente não encontrado',
      description: item.description,
      start_date: item.start_date,
      end_date: item.end_date,
      status: item.status,
      total_value: item.total_value,
      address: item.address,
    }));
  }, [searchTerm, filterStatus]);

  const { items, hasNextPage, isLoading, loadMore, reset } = useVirtualizedPagination(
    fetchWorks,
    PAGE_SIZE
  );

  useMemo(() => {
    reset();
  }, [searchTerm, filterStatus, reset]);

  const containerHeight = useVirtualizedHeight(600, ITEM_HEIGHT, items.length);

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'planning': 'Planejamento',
      'in_progress': 'Em Andamento',
      'paused': 'Pausada',
      'completed': 'Concluída',
      'cancelled': 'Cancelada',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'planning': 'bg-blue-100 text-blue-800',
      'in_progress': 'bg-green-100 text-green-800',
      'paused': 'bg-yellow-100 text-yellow-800',
      'completed': 'bg-gray-100 text-gray-800',
      'cancelled': 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  const renderWork = useCallback((work: ConstructionWork, index: number, style: React.CSSProperties) => {
    return (
      <div
        style={style}
        className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 border-b border-gray-200"
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <HardHat className="w-6 h-6 text-orange-600" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-medium text-gray-900 truncate">
                {work.description}
              </h3>
              <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(work.status)}`}>
                {getStatusLabel(work.status)}
              </span>
            </div>

            <p className="text-sm text-gray-600 truncate mt-1">
              Cliente: {work.customer_name}
            </p>

            {work.address && (
              <p className="text-xs text-gray-500 truncate mt-1">
                {work.address}
              </p>
            )}

            <div className="flex items-center gap-4 mt-2">
              <span className="text-xs text-gray-600 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Início: {formatDate(work.start_date)}
              </span>
              {work.end_date && (
                <span className="text-xs text-gray-600 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Fim: {formatDate(work.end_date)}
                </span>
              )}
              {work.total_value && (
                <span className="text-xs font-medium text-gray-900 flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  R$ {work.total_value.toFixed(2)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
          {onView && (
            <button
              onClick={() => onView(work)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded"
              title="Visualizar"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(work)}
              className="p-2 text-amber-600 hover:bg-amber-50 rounded"
              title="Editar"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => {
                if (window.confirm('Deseja realmente excluir esta obra?')) {
                  onDelete(work.id);
                }
              }}
              className="p-2 text-red-600 hover:bg-red-50 rounded"
              title="Excluir"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }, [onEdit, onDelete, onView]);

  if (isLoading && items.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        <span className="ml-3 text-gray-600">Carregando obras...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            {items.length} {items.length === 1 ? 'obra' : 'obras'}
            {hasNextPage && ' (carregue mais para ver todas)'}
          </span>
          <span className="text-xs text-gray-500">
            Performance otimizada
          </span>
        </div>
      </div>

      <VirtualizedListAdvanced
        items={items}
        height={containerHeight}
        itemHeight={ITEM_HEIGHT}
        renderItem={renderWork}
        hasNextPage={hasNextPage}
        isNextPageLoading={isLoading}
        loadNextPage={loadMore}
        emptyMessage="Nenhuma obra encontrada"
        loadingMessage="Carregando mais obras..."
        threshold={20}
      />

      <div className="bg-gray-50 px-6 py-2 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>Virtualização ativa</span>
          <span>Memória otimizada</span>
        </div>
      </div>
    </div>
  );
}
