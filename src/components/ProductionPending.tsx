import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, Package, TrendingUp, Calendar } from 'lucide-react';

interface PendingItem {
  order_id: string;
  order_number: number;
  product_id: string;
  product_name: string;
  product_code: string | null;
  customer_name: string;
  quantity_ordered: number;
  quantity_produced: number;
  quantity_pending: number;
  order_status: string;
  deadline: string | null;
  delivery_date: string | null;
}

export default function ProductionPending() {
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'urgent' | 'late'>('all');

  useEffect(() => {
    loadPendingItems();
  }, []);

  const loadPendingItems = async () => {
    try {
      setLoading(true);

      // Buscar itens pendentes de ordens de produção
      const { data: orderItems, error: orderError } = await supabase
        .from('production_order_items')
        .select(`
          id,
          quantity,
          production_order_id,
          product_id,
          products!inner (
            id,
            name,
            code
          ),
          production_orders!inner (
            id,
            order_number,
            status,
            deadline,
            quote_id,
            quotes (
              id,
              customer_id,
              customers (
                id,
                name
              )
            )
          )
        `)
        .in('production_orders.status', ['pending', 'in_progress']);

      if (orderError) throw orderError;

      // Buscar produções para cada item
      const itemsWithProduction = await Promise.all(
        (orderItems || []).map(async (item: any) => {
          const { data: productions } = await supabase
            .from('production')
            .select('quantity')
            .eq('production_order_item_id', item.id);

          const quantityProduced = productions?.reduce((sum, p) => sum + Number(p.quantity), 0) || 0;
          const quantityPending = Number(item.quantity) - quantityProduced;

          // Buscar data de entrega
          const { data: deliveries } = await supabase
            .from('deliveries')
            .select('delivery_date')
            .eq('production_order_id', item.production_order_id)
            .order('delivery_date', { ascending: true })
            .limit(1)
            .single();

          if (quantityPending > 0) {
            return {
              order_id: item.production_orders.id,
              order_number: item.production_orders.order_number,
              product_id: item.products.id,
              product_name: item.products.name,
              product_code: item.products.code,
              customer_name: item.production_orders.quotes?.customers?.name || 'Sem cliente',
              quantity_ordered: Number(item.quantity),
              quantity_produced: quantityProduced,
              quantity_pending: quantityPending,
              order_status: item.production_orders.status,
              deadline: item.production_orders.deadline,
              delivery_date: deliveries?.delivery_date || null,
            };
          }
          return null;
        })
      );

      const pending = itemsWithProduction.filter((item): item is PendingItem => item !== null);
      setPendingItems(pending);
    } catch (error) {
      console.error('Erro ao carregar itens pendentes:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredItems = () => {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    switch (filter) {
      case 'urgent':
        return pendingItems.filter(item => {
          if (!item.deadline) return false;
          const deadline = new Date(item.deadline);
          return deadline <= threeDaysFromNow && deadline >= now;
        });
      case 'late':
        return pendingItems.filter(item => {
          if (!item.deadline) return false;
          return new Date(item.deadline) < now;
        });
      default:
        return pendingItems;
    }
  };

  const getStatusBadge = (item: PendingItem) => {
    if (!item.deadline) {
      return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">Sem prazo</span>;
    }

    const now = new Date();
    const deadline = new Date(item.deadline);
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    if (deadline < now) {
      return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">Atrasado</span>;
    } else if (deadline <= threeDaysFromNow) {
      return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">Urgente</span>;
    } else {
      return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">No prazo</span>;
    }
  };

  const getProgressPercentage = (produced: number, total: number) => {
    return Math.round((produced / total) * 100);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const totalPending = pendingItems.reduce((sum, item) => sum + item.quantity_pending, 0);
  const urgentItems = pendingItems.filter(item => {
    if (!item.deadline) return false;
    const deadline = new Date(item.deadline);
    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    return deadline <= threeDaysFromNow && deadline >= new Date();
  });
  const lateItems = pendingItems.filter(item => {
    if (!item.deadline) return false;
    return new Date(item.deadline) < new Date();
  });

  const filteredItems = getFilteredItems();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Carregando itens pendentes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="h-6 w-6" />
          Itens a Produzir
        </h2>
        <p className="text-gray-600 mt-1">
          Lista de produtos pendentes de produção conforme ordens abertas
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Pendente</p>
              <p className="text-2xl font-bold text-gray-900">{totalPending}</p>
              <p className="text-xs text-gray-500 mt-1">{pendingItems.length} produtos</p>
            </div>
            <Package className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Atrasados</p>
              <p className="text-2xl font-bold text-red-600">{lateItems.length}</p>
              <p className="text-xs text-gray-500 mt-1">
                {lateItems.reduce((sum, item) => sum + item.quantity_pending, 0)} unidades
              </p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Urgentes</p>
              <p className="text-2xl font-bold text-yellow-600">{urgentItems.length}</p>
              <p className="text-xs text-gray-500 mt-1">Próximos 3 dias</p>
            </div>
            <TrendingUp className="h-8 w-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">No Prazo</p>
              <p className="text-2xl font-bold text-green-600">
                {pendingItems.length - lateItems.length - urgentItems.length}
              </p>
              <p className="text-xs text-gray-500 mt-1">Dentro do prazo</p>
            </div>
            <Calendar className="h-8 w-8 text-green-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Todos ({pendingItems.length})
        </button>
        <button
          onClick={() => setFilter('late')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'late'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Atrasados ({lateItems.length})
        </button>
        <button
          onClick={() => setFilter('urgent')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'urgent'
              ? 'bg-yellow-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Urgentes ({urgentItems.length})
        </button>
      </div>

      {/* Table */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Nenhum item pendente de produção</p>
          <p className="text-gray-500 text-sm mt-2">
            {filter !== 'all'
              ? 'Tente outro filtro para ver mais itens'
              : 'Todas as ordens de produção estão completas'
            }
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    OP#
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Produto
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pedido
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Produzido
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Falta Produzir
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progresso
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Prazo
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Entrega
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredItems.map((item, index) => {
                  const progress = getProgressPercentage(item.quantity_produced, item.quantity_ordered);

                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-gray-900">
                          {item.order_number}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{item.customer_name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 font-medium">{item.product_name}</div>
                        {item.product_code && (
                          <div className="text-xs text-gray-500">Cód: {item.product_code}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-sm font-medium text-gray-900">
                          {item.quantity_ordered}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-sm text-blue-600 font-medium">
                          {item.quantity_produced}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-sm font-bold text-red-600">
                          {item.quantity_pending}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 w-24">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                progress === 100
                                  ? 'bg-green-500'
                                  : progress >= 50
                                  ? 'bg-blue-500'
                                  : 'bg-yellow-500'
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-600">
                            {progress}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                        {formatDate(item.deadline)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                        {formatDate(item.delivery_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {getStatusBadge(item)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer Summary */}
      {filteredItems.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-800">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">
              Total a produzir ({filter === 'all' ? 'Todos' : filter === 'late' ? 'Atrasados' : 'Urgentes'}): {' '}
              <strong>{filteredItems.reduce((sum, item) => sum + item.quantity_pending, 0)} unidades</strong>
              {' '}de {filteredItems.length} produtos diferentes
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
