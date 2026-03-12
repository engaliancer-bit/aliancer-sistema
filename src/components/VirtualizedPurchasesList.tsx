import { useCallback, useMemo } from 'react';
import { Calendar, DollarSign, Package, User, Edit2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import VirtualizedListAdvanced, { useVirtualizedPagination, useVirtualizedHeight } from './VirtualizedListAdvanced';

interface Purchase {
  id: string;
  purchase_date: string;
  total_cost: number;
  supplier_id: string;
  payment_type: 'vista' | 'prazo';
  status: string;
  suppliers?: {
    name: string;
  };
  purchase_items?: Array<{
    quantity: number;
    materials?: {
      name: string;
    };
  }>;
}

interface VirtualizedPurchasesListProps {
  searchTerm?: string;
  filterPaymentType?: string;
  onViewDetails?: (purchase: Purchase) => void;
  onEdit?: (purchase: Purchase) => void;
}

export default function VirtualizedPurchasesList({
  searchTerm = '',
  filterPaymentType = 'all',
  onViewDetails,
  onEdit,
}: VirtualizedPurchasesListProps) {
  const PAGE_SIZE = 50;
  const ITEM_HEIGHT = 90;

  const fetchPurchases = useCallback(async (offset: number, limit: number): Promise<Purchase[]> => {
    let query = supabase
      .from('purchases')
      .select(`
        *,
        suppliers (name),
        purchase_items (
          quantity,
          materials (name)
        )
      `)
      .order('purchase_date', { ascending: false });

    if (filterPaymentType !== 'all') {
      query = query.eq('payment_type', filterPaymentType);
    }

    if (searchTerm) {
      query = query.or(`suppliers.name.ilike.%${searchTerm}%`);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao carregar compras:', error);
      return [];
    }

    return data || [];
  }, [searchTerm, filterPaymentType]);

  const { items, hasNextPage, isLoading, loadMore, reset } = useVirtualizedPagination(
    fetchPurchases,
    PAGE_SIZE
  );

  useMemo(() => {
    reset();
  }, [searchTerm, filterPaymentType, reset]);

  const containerHeight = useVirtualizedHeight(600, ITEM_HEIGHT, items.length);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getPaymentTypeLabel = (type: string) => {
    return type === 'vista' ? 'À Vista' : 'A Prazo';
  };

  const getPaymentTypeColor = (type: string) => {
    return type === 'vista' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';
  };

  const renderPurchase = useCallback((purchase: Purchase, index: number, style: React.CSSProperties) => {
    const itemsCount = purchase.purchase_items?.length || 0;
    const firstItem = purchase.purchase_items?.[0];

    return (
      <div
        style={style}
        className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 border-b border-gray-200 cursor-pointer"
        onClick={() => onViewDetails?.(purchase)}
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-sm font-medium text-gray-900">
                Compra #{purchase.id.slice(0, 8)}
              </h3>
              <span className={`px-2 py-1 text-xs rounded-full ${getPaymentTypeColor(purchase.payment_type)}`}>
                {getPaymentTypeLabel(purchase.payment_type)}
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-600">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {purchase.suppliers?.name || 'Fornecedor não informado'}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(purchase.purchase_date)}
              </span>
              <span className="flex items-center gap-1">
                <Package className="w-3 h-3" />
                {itemsCount} {itemsCount === 1 ? 'item' : 'itens'}
              </span>
            </div>

            {firstItem?.materials && (
              <p className="text-xs text-gray-500 mt-1 truncate">
                {firstItem.materials.name}
                {itemsCount > 1 && ` e mais ${itemsCount - 1}`}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 ml-4">
          <div className="text-right">
            <div className="flex items-center gap-1 text-sm font-bold text-gray-900">
              <DollarSign className="w-4 h-4" />
              {formatCurrency(purchase.total_cost)}
            </div>
          </div>
          {onEdit && (
            <button
              onClick={e => { e.stopPropagation(); onEdit(purchase); }}
              className="p-2 text-gray-400 hover:text-[#0A7EC2] hover:bg-blue-50 rounded-lg transition-colors flex-shrink-0"
              title="Editar compra"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }, [onViewDetails, onEdit]);

  if (isLoading && items.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        <span className="ml-3 text-gray-600">Carregando compras...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            {items.length} {items.length === 1 ? 'compra' : 'compras'}
            {hasNextPage && ' (role para carregar mais)'}
          </span>
          <span className="text-xs text-gray-500">
            {onEdit ? 'Clique no lapis para editar' : 'Clique em uma compra para ver detalhes'}
          </span>
        </div>
      </div>

      <VirtualizedListAdvanced
        items={items}
        height={containerHeight}
        itemHeight={ITEM_HEIGHT}
        renderItem={renderPurchase}
        hasNextPage={hasNextPage}
        isNextPageLoading={isLoading}
        loadNextPage={loadMore}
        emptyMessage="Nenhuma compra encontrada"
        loadingMessage="Carregando mais compras..."
        threshold={20}
      />

      <div className="bg-gray-50 px-6 py-2 border-t border-gray-200">
        <div className="text-xs text-gray-600 text-center">
          Performance otimizada: apenas itens visíveis são renderizados
        </div>
      </div>
    </div>
  );
}
