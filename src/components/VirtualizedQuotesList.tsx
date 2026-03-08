import { useCallback, useMemo } from 'react';
import { FileText, Edit2, Trash2, Eye, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import VirtualizedListAdvanced, { useVirtualizedPagination, useVirtualizedHeight } from './VirtualizedListAdvanced';

interface Quote {
  id: string;
  customer_name: string;
  created_at: string;
  status: string;
  delivery_deadline?: string;
  total_value?: number;
}

interface VirtualizedQuotesListProps {
  searchTerm?: string;
  filterStatus?: string;
  onEdit?: (quote: Quote) => void;
  onDelete?: (quoteId: string) => void;
  onView?: (quote: Quote) => void;
}

export default function VirtualizedQuotesList({
  searchTerm = '',
  filterStatus = 'all',
  onEdit,
  onDelete,
  onView,
}: VirtualizedQuotesListProps) {
  const PAGE_SIZE = 50;
  const ITEM_HEIGHT = 80;

  const fetchQuotes = useCallback(async (offset: number, limit: number): Promise<Quote[]> => {
    let query = supabase
      .from('quotes')
      .select(`
        id,
        created_at,
        status,
        delivery_deadline,
        total_value,
        customers!inner(name)
      `)
      .order('created_at', { ascending: false });

    if (filterStatus !== 'all') {
      query = query.eq('status', filterStatus);
    }

    if (searchTerm) {
      query = query.or(`customers.name.ilike.%${searchTerm}%`);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao carregar orçamentos:', error);
      return [];
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      customer_name: item.customers?.name || 'Cliente não encontrado',
      created_at: item.created_at,
      status: item.status,
      delivery_deadline: item.delivery_deadline,
      total_value: item.total_value,
    }));
  }, [searchTerm, filterStatus]);

  const { items, hasNextPage, isLoading, loadMore, reset } = useVirtualizedPagination(
    fetchQuotes,
    PAGE_SIZE
  );

  useMemo(() => {
    reset();
  }, [searchTerm, filterStatus, reset]);

  const containerHeight = useVirtualizedHeight(600, ITEM_HEIGHT, items.length);

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'pending': 'Pendente',
      'approved': 'Aprovado',
      'rejected': 'Rejeitado',
      'completed': 'Concluído',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'approved': 'bg-green-100 text-green-800',
      'rejected': 'bg-red-100 text-red-800',
      'completed': 'bg-blue-100 text-blue-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  const renderQuote = useCallback((quote: Quote, index: number, style: React.CSSProperties) => {
    return (
      <div
        style={style}
        className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 border-b border-gray-200"
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-medium text-gray-900 truncate">
                {quote.customer_name}
              </h3>
              <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(quote.status)}`}>
                {getStatusLabel(quote.status)}
              </span>
            </div>

            <div className="flex items-center gap-4 mt-2">
              <span className="text-xs text-gray-600 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Criado: {formatDate(quote.created_at)}
              </span>
              {quote.delivery_deadline && (
                <span className="text-xs text-gray-600 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Entrega: {formatDate(quote.delivery_deadline)}
                </span>
              )}
              {quote.total_value && (
                <span className="text-xs font-medium text-gray-900">
                  R$ {quote.total_value.toFixed(2)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
          {onView && (
            <button
              onClick={() => onView(quote)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded"
              title="Visualizar"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(quote)}
              className="p-2 text-amber-600 hover:bg-amber-50 rounded"
              title="Editar"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => {
                if (window.confirm('Deseja realmente excluir este orçamento?')) {
                  onDelete(quote.id);
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Carregando orçamentos...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            {items.length} {items.length === 1 ? 'orçamento' : 'orçamentos'}
            {hasNextPage && ' (carregue mais para ver todos)'}
          </span>
          <span className="text-xs text-gray-500">
            Performance otimizada com virtualização
          </span>
        </div>
      </div>

      <VirtualizedListAdvanced
        items={items}
        height={containerHeight}
        itemHeight={ITEM_HEIGHT}
        renderItem={renderQuote}
        hasNextPage={hasNextPage}
        isNextPageLoading={isLoading}
        loadNextPage={loadMore}
        emptyMessage="Nenhum orçamento encontrado"
        loadingMessage="Carregando mais orçamentos..."
        threshold={20}
      />

      <div className="bg-gray-50 px-6 py-2 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>Lista virtualizada</span>
          <span>Apenas itens visíveis são renderizados</span>
        </div>
      </div>
    </div>
  );
}
