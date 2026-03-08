import React, { useState, useEffect } from 'react';
import { Package, AlertCircle, CheckCircle, Clock, Truck, Factory, RefreshCw, Bug } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ConstructionQuoteDebug from './ConstructionQuoteDebug';

interface ConstructionQuoteItem {
  id: string;
  construction_project_id: string;
  quote_id: string;
  quote_type: 'quote' | 'ribbed_slab';
  product_id: string | null;
  material_id: string | null;
  item_type: 'product' | 'material';
  quantity_required: number;
  quantity_in_stock: number;
  quantity_to_produce: number;
  unit: string;
  status: 'pending_stock_check' | 'available_for_delivery' | 'in_production' | 'partially_available' | 'delivered';
  production_order_id: string | null;
  delivery_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  products?: {
    name: string;
    code: string;
    unit: string;
  };
  materials?: {
    name: string;
    unit: string;
  };
  production_orders?: {
    order_number: string;
    status: string;
  };
  deliveries?: {
    delivery_date: string;
    status: string;
  };
}

interface ConstructionQuoteItemsProps {
  constructionProjectId: string;
  onItemsLoaded?: (items: ConstructionQuoteItem[]) => void;
}

export default function ConstructionQuoteItems({
  constructionProjectId,
  onItemsLoaded
}: ConstructionQuoteItemsProps) {
  const [items, setItems] = useState<ConstructionQuoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingQuote, setProcessingQuote] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>('');
  const [selectedQuoteType, setSelectedQuoteType] = useState<'quote' | 'ribbed_slab'>('quote');
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    loadItems();
  }, [constructionProjectId]);

  const loadItems = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('construction_quote_items')
        .select(`
          *,
          products(name, code, unit),
          materials(name, unit),
          production_orders(order_number, status),
          deliveries(delivery_date, status)
        `)
        .eq('construction_project_id', constructionProjectId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setItems(data || []);
      if (onItemsLoaded) {
        onItemsLoaded(data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshStockStatus = async () => {
    try {
      setRefreshing(true);

      const stockPromises = items.map(item => {
        if (item.item_type === 'product' && item.product_id) {
          return supabase.rpc('get_product_stock', {
            product_id_param: item.product_id
          }).then(({ data }) => ({ item, stockData: data }));
        } else if (item.item_type === 'material' && item.material_id) {
          return supabase.rpc('get_material_stock', {
            material_id_param: item.material_id
          }).then(({ data }) => ({ item, stockData: data }));
        }
        return Promise.resolve({ item, stockData: null });
      });

      const stockResults = await Promise.all(stockPromises);

      const updatePromises = stockResults
        .filter(result => result.stockData !== null)
        .map(({ item, stockData }) => {
          const quantityInStock = stockData;
          const quantityToProduce = Math.max(item.quantity_required - quantityInStock, 0);

          let newStatus = item.status;
          if (item.status !== 'delivered') {
            if (quantityInStock >= item.quantity_required) {
              newStatus = 'available_for_delivery';
            } else if (quantityInStock > 0) {
              newStatus = 'partially_available';
            } else {
              newStatus = 'in_production';
            }
          }

          return supabase
            .from('construction_quote_items')
            .update({
              quantity_in_stock: quantityInStock,
              quantity_to_produce: quantityToProduce,
              status: newStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', item.id);
        });

      await Promise.all(updatePromises);
      await loadItems();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const processQuoteForConstruction = async () => {
    if (!selectedQuoteId || !selectedQuoteType) {
      alert('Selecione um orçamento primeiro');
      return;
    }

    try {
      setProcessingQuote(true);

      const { data, error } = await supabase.rpc('process_quote_approval_for_construction', {
        quote_id_param: selectedQuoteId,
        quote_type_param: selectedQuoteType,
        construction_project_id_param: constructionProjectId
      });

      if (error) throw error;

      if (data) {
        // Mostrar mensagem retornada pelo banco (sucesso ou duplicação)
        alert(data.message || 'Processamento concluído');

        // Se foi sucesso, recarregar itens
        if (data.success) {
          await loadItems();
          setSelectedQuoteId('');
        } else {
          // Se foi duplicação detectada, também recarregar para mostrar itens existentes
          if (data.existing_items > 0) {
            await loadItems();
          }
        }
      } else {
        alert('Erro: resposta inesperada do servidor');
      }
    } catch (error: any) {
      console.error('Erro ao processar orçamento:', error);
      alert('Erro ao processar orçamento: ' + error.message);
    } finally {
      setProcessingQuote(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      'pending_stock_check': {
        bg: 'bg-gray-100',
        text: 'text-gray-800',
        icon: Clock,
        label: 'Verificando Estoque'
      },
      'available_for_delivery': {
        bg: 'bg-green-100',
        text: 'text-green-800',
        icon: CheckCircle,
        label: 'Disponível para Entrega'
      },
      'in_production': {
        bg: 'bg-blue-100',
        text: 'text-blue-800',
        icon: Factory,
        label: 'Em Produção'
      },
      'partially_available': {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        icon: AlertCircle,
        label: 'Parcialmente Disponível'
      },
      'delivered': {
        bg: 'bg-purple-100',
        text: 'text-purple-800',
        icon: Truck,
        label: 'Entregue'
      }
    };

    const badge = badges[status as keyof typeof badges] || badges.pending_stock_check;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${badge.bg} ${badge.text}`}>
        <Icon className="w-4 h-4" />
        {badge.label}
      </span>
    );
  };

  const groupedItems = items.reduce((acc, item) => {
    const key = `${item.quote_type}_${item.quote_id}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {} as Record<string, ConstructionQuoteItem[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Debug Tool */}
      {showDebug && (
        <ConstructionQuoteDebug />
      )}

      {/* Vincular novo orçamento */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-orange-600" />
            Vincular Orçamento à Obra
          </h3>
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 flex items-center gap-2 text-sm"
          >
            <Bug className="w-4 h-4" />
            {showDebug ? 'Ocultar' : 'Debug'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Orçamento
            </label>
            <select
              value={selectedQuoteType}
              onChange={(e) => setSelectedQuoteType(e.target.value as 'quote' | 'ribbed_slab')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="quote">Orçamento Padrão</option>
              <option value="ribbed_slab">Laje Treliçada</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ID do Orçamento
            </label>
            <input
              type="text"
              value={selectedQuoteId}
              onChange={(e) => setSelectedQuoteId(e.target.value)}
              placeholder="Cole o ID do orçamento aqui"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={processQuoteForConstruction}
              disabled={processingQuote || !selectedQuoteId}
              className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processingQuote ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Package className="w-4 h-4" />
                  Vincular e Processar
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Como funciona:</strong> Ao vincular um orçamento, o sistema verificará automaticamente o estoque
            de todos os produtos E materiais das composições. Para produtos sem estoque, ordens de produção serão criadas
            automaticamente. Items com estoque disponível terão uma entrega criada automaticamente. Quando as ordens de
            produção forem finalizadas, os items ficarão disponíveis para entrega.
          </p>
        </div>
      </div>

      {/* Lista de itens */}
      {items.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-orange-600" />
              Itens Vinculados à Obra
            </h3>
            <button
              onClick={refreshStockStatus}
              disabled={refreshing}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar Status
            </button>
          </div>

          <div className="divide-y divide-gray-200">
            {Object.entries(groupedItems).map(([key, quoteItems]) => (
              <div key={key} className="p-6">
                <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
                  <span className="font-medium">
                    {quoteItems[0].quote_type === 'quote' ? 'Orçamento Padrão' : 'Laje Treliçada'}
                  </span>
                  <span>•</span>
                  <span className="font-mono text-xs">{quoteItems[0].quote_id}</span>
                </div>

                <div className="space-y-3">
                  {quoteItems.map((item) => {
                    const itemName = item.item_type === 'product'
                      ? item.products?.name
                      : item.materials?.name;
                    const itemCode = item.item_type === 'product' ? item.products?.code : null;
                    const itemUnit = item.unit || (item.item_type === 'product' ? item.products?.unit : item.materials?.unit);

                    return (
                    <div key={item.id} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                              item.item_type === 'product'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {item.item_type === 'product' ? 'PRODUTO' : 'MATERIAL'}
                            </span>
                          </div>
                          <h4 className="font-semibold text-gray-900">
                            {itemName}
                            {itemCode && (
                              <span className="ml-2 text-sm text-gray-500">
                                ({item.products.code})
                              </span>
                            )}
                          </h4>
                          {item.notes && (
                            <p className="text-sm text-gray-600 mt-1">{item.notes}</p>
                          )}
                        </div>
                        {getStatusBadge(item.status)}
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Necessário:</span>
                          <span className="ml-2 font-semibold text-gray-900">
                            {item.quantity_required} {itemUnit}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Em Estoque:</span>
                          <span className="ml-2 font-semibold text-green-700">
                            {item.quantity_in_stock} {itemUnit}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">{item.item_type === 'product' ? 'A Produzir' : 'Faltante'}:</span>
                          <span className="ml-2 font-semibold text-blue-700">
                            {item.quantity_to_produce} {itemUnit}
                          </span>
                        </div>
                      </div>

                      {item.production_order_id && item.production_orders && (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-sm">
                          <Factory className="w-4 h-4 text-blue-600" />
                          <span className="text-blue-800">
                            Ordem de Produção: <strong>{item.production_orders.order_number}</strong>
                            {' • Status: '}
                            <strong className="capitalize">{item.production_orders.status}</strong>
                          </span>
                        </div>
                      )}

                      {item.delivery_id && item.deliveries && (
                        <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-center gap-2 text-sm">
                          <Truck className="w-4 h-4 text-purple-600" />
                          <span className="text-purple-800">
                            Entregue em: <strong>{new Date(item.deliveries.delivery_date).toLocaleDateString('pt-BR')}</strong>
                          </span>
                        </div>
                      )}
                    </div>
                  );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Nenhum item vinculado
          </h3>
          <p className="text-gray-600">
            Vincule um orçamento aprovado a esta obra para começar a gerenciar os produtos.
          </p>
        </div>
      )}
    </div>
  );
}
