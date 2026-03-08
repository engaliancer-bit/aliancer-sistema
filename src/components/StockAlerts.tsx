import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Clock, Package, Phone, X, ClipboardList } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface StockAlert {
  id: string;
  item_type: 'product' | 'material';
  item_id: string;
  status: 'pending' | 'order_placed' | 'resolved';
  current_stock: number;
  minimum_stock: number;
  last_supplier_id: string | null;
  production_order_id: string | null;
  created_at: string;
  order_placed_at: string | null;
  notes: string | null;
}

interface AlertWithDetails extends StockAlert {
  item_name: string;
  item_unit: string;
  supplier_name?: string;
  supplier_contact?: string;
  supplier_email?: string;
  supplier_cnpj?: string;
  production_order_number?: string;
  supplier_id?: string;
}

interface MaterialSupplier {
  id: string;
  supplier_id: string;
  is_primary: boolean;
  unit_cost: number;
  suppliers?: {
    id: string;
    name: string;
    phone: string;
    email: string;
    cnpj: string;
  };
}

interface SupplierContact {
  id: string;
  supplier_id: string;
  name: string;
  phone: string;
  email: string;
  role: string;
  is_primary: boolean;
  is_whatsapp: boolean;
  notes: string;
}

export default function StockAlerts() {
  const [alerts, setAlerts] = useState<AlertWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<AlertWithDetails | null>(null);
  const [showSupplierDialog, setShowSupplierDialog] = useState(false);
  const [showProductionOrderDialog, setShowProductionOrderDialog] = useState(false);
  const [productionQuantity, setProductionQuantity] = useState('');
  const [supplierContacts, setSupplierContacts] = useState<SupplierContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<SupplierContact | null>(null);
  const [materialSuppliers, setMaterialSuppliers] = useState<MaterialSupplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<MaterialSupplier | null>(null);

  useEffect(() => {
    loadAlerts();
    checkStockLevels();
  }, []);

  const checkStockLevels = async () => {
    try {
      const { data: products } = await supabase
        .from('products')
        .select('id, name, unit, minimum_stock');

      const { data: materials } = await supabase
        .from('materials')
        .select('id, name, unit, minimum_stock, supplier_id');

      for (const product of products || []) {
        if (product.minimum_stock > 0) {
          const { data: stockData } = await supabase
            .from('product_stock_view')
            .select('available_stock')
            .eq('product_id', product.id)
            .maybeSingle();

          const currentStock = parseFloat(stockData?.available_stock || '0');

          if (currentStock < product.minimum_stock) {
            const { data: existingAlerts } = await supabase
              .from('stock_alerts')
              .select('id, status')
              .eq('item_type', 'product')
              .eq('item_id', product.id)
              .in('status', ['pending', 'order_placed']);

            if (!existingAlerts || existingAlerts.length === 0) {
              try {
                await supabase.from('stock_alerts').insert([{
                  item_type: 'product',
                  item_id: product.id,
                  status: 'pending',
                  current_stock: currentStock,
                  minimum_stock: product.minimum_stock,
                  last_supplier_id: null,
                }]);
              } catch (insertError: any) {
                if (!insertError.message?.includes('duplicate key') && !insertError.message?.includes('unique constraint')) {
                  console.error('Erro ao criar alerta:', insertError);
                }
              }
            } else if (existingAlerts.length > 0) {
              const alertToKeep = existingAlerts.find(a => a.status === 'order_placed') || existingAlerts[0];

              if (existingAlerts.length > 1) {
                const alertsToDelete = existingAlerts.filter(a => a.id !== alertToKeep.id);
                for (const alert of alertsToDelete) {
                  await supabase.from('stock_alerts').delete().eq('id', alert.id);
                }
              }

              await supabase
                .from('stock_alerts')
                .update({
                  current_stock: currentStock,
                  minimum_stock: product.minimum_stock
                })
                .eq('id', alertToKeep.id);
            }
          }
        }
      }

      for (const material of materials || []) {
        if (material.minimum_stock > 0) {
          const { data: movements } = await supabase
            .from('material_movements')
            .select('quantity, movement_type')
            .eq('material_id', material.id);

          let currentStock = 0;
          (movements || []).forEach((movement) => {
            const qty = parseFloat(movement.quantity.toString());
            if (movement.movement_type === 'entrada') {
              currentStock += qty;
            } else if (movement.movement_type === 'saida') {
              currentStock -= qty;
            }
          });

          if (currentStock < material.minimum_stock) {
            const { data: existingAlerts } = await supabase
              .from('stock_alerts')
              .select('id, status')
              .eq('item_type', 'material')
              .eq('item_id', material.id)
              .in('status', ['pending', 'order_placed']);

            if (!existingAlerts || existingAlerts.length === 0) {
              try {
                await supabase.from('stock_alerts').insert([{
                  item_type: 'material',
                  item_id: material.id,
                  status: 'pending',
                  current_stock: currentStock,
                  minimum_stock: material.minimum_stock,
                  last_supplier_id: material.supplier_id,
                }]);
              } catch (insertError: any) {
                if (!insertError.message?.includes('duplicate key') && !insertError.message?.includes('unique constraint')) {
                  console.error('Erro ao criar alerta:', insertError);
                }
              }
            } else if (existingAlerts.length > 0) {
              const alertToKeep = existingAlerts.find(a => a.status === 'order_placed') || existingAlerts[0];

              if (existingAlerts.length > 1) {
                const alertsToDelete = existingAlerts.filter(a => a.id !== alertToKeep.id);
                for (const alert of alertsToDelete) {
                  await supabase.from('stock_alerts').delete().eq('id', alert.id);
                }
              }

              await supabase
                .from('stock_alerts')
                .update({
                  current_stock: currentStock,
                  minimum_stock: material.minimum_stock
                })
                .eq('id', alertToKeep.id);
            }
          }
        }
      }

      loadAlerts();
    } catch (error) {
      console.error('Erro ao verificar níveis de estoque:', error);
    }
  };

  const loadAlerts = async () => {
    try {
      const { data: alertsData, error } = await supabase
        .from('stock_alerts')
        .select('*')
        .in('status', ['pending', 'order_placed'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      const alertsWithDetails: AlertWithDetails[] = [];

      for (const alert of alertsData || []) {
        if (alert.item_type === 'product') {
          const { data: product } = await supabase
            .from('products')
            .select('name, unit')
            .eq('id', alert.item_id)
            .single();

          let productionOrderNumber = undefined;
          if (alert.production_order_id) {
            const { data: productionOrder } = await supabase
              .from('production_orders')
              .select('order_number')
              .eq('id', alert.production_order_id)
              .single();
            productionOrderNumber = productionOrder?.order_number;
          }

          if (product) {
            alertsWithDetails.push({
              ...alert,
              item_name: product.name,
              item_unit: product.unit,
              production_order_number: productionOrderNumber,
            });
          }
        } else if (alert.item_type === 'material') {
          const { data: material } = await supabase
            .from('materials')
            .select('name, unit, suppliers(name, contact, email, cnpj)')
            .eq('id', alert.item_id)
            .single();

          if (material) {
            const supplier = material.suppliers as any;
            alertsWithDetails.push({
              ...alert,
              item_name: material.name,
              item_unit: material.unit,
              supplier_name: supplier?.name,
              supplier_contact: supplier?.contact,
              supplier_email: supplier?.email,
              supplier_cnpj: supplier?.cnpj,
              supplier_id: alert.last_supplier_id || undefined,
            });
          }
        }
      }

      setAlerts(alertsWithDetails);
    } catch (error) {
      console.error('Erro ao carregar alertas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewSupplier = async (alert: AlertWithDetails) => {
    setSelectedAlert(alert);
    setSelectedContact(null);
    setSelectedSupplier(null);

    if (alert.item_type === 'material') {
      try {
        const { data, error } = await supabase
          .from('material_suppliers')
          .select('*, suppliers(id, name, phone, email, cnpj)')
          .eq('material_id', alert.item_id)
          .order('is_primary', { ascending: false });

        if (error) throw error;
        setMaterialSuppliers(data || []);

        if (data && data.length > 0) {
          const primarySupplier = data.find(s => s.is_primary) || data[0];
          setSelectedSupplier(primarySupplier);
          await loadSupplierContacts(primarySupplier.supplier_id);
        }
      } catch (error) {
        console.error('Erro ao carregar fornecedores:', error);
        setMaterialSuppliers([]);
        setSupplierContacts([]);
      }
    } else {
      setMaterialSuppliers([]);
      setSupplierContacts([]);
    }

    setShowSupplierDialog(true);
  };

  const loadSupplierContacts = async (supplierId: string) => {
    try {
      const { data, error } = await supabase
        .from('supplier_contacts')
        .select('*')
        .eq('supplier_id', supplierId)
        .eq('is_whatsapp', true)
        .order('is_primary', { ascending: false })
        .order('name');

      if (error) throw error;
      setSupplierContacts(data || []);
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
      setSupplierContacts([]);
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedAlert) return;

    let contactPhone = selectedContact?.phone || selectedSupplier?.suppliers?.phone || selectedAlert.supplier_contact;

    if (!contactPhone) {
      alert('Por favor, selecione um fornecedor e contato com telefone');
      return;
    }

    try {
      const { error } = await supabase
        .from('stock_alerts')
        .update({
          status: 'order_placed',
          order_placed_at: new Date().toISOString(),
        })
        .eq('id', selectedAlert.id);

      if (error) throw error;

      const phone = contactPhone.replace(/\D/g, '');
      const contactName = selectedContact ? ` - ${selectedContact.name}` : '';
      const supplierName = selectedSupplier?.suppliers?.name || selectedAlert.supplier_name || '';
      const message = encodeURIComponent(
        `Olá${contactName}! Gostaria de fazer um pedido de ${selectedAlert.item_name}.\n\nFornecedor: ${supplierName}\nEstoque atual: ${selectedAlert.current_stock.toFixed(2)} ${selectedAlert.item_unit}\nEstoque mínimo: ${selectedAlert.minimum_stock.toFixed(2)} ${selectedAlert.item_unit}\n\nPoderia me enviar informações sobre disponibilidade e preço?`
      );
      window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');

      setShowSupplierDialog(false);
      setSelectedAlert(null);
      setSelectedContact(null);
      setSelectedSupplier(null);
      setMaterialSuppliers([]);
      setSupplierContacts([]);
      loadAlerts();
    } catch (error) {
      console.error('Erro ao registrar pedido:', error);
      alert('Erro ao registrar pedido');
    }
  };

  const handleViewProductionOrder = (alert: AlertWithDetails) => {
    setSelectedAlert(alert);
    const suggestedQuantity = Math.ceil(alert.minimum_stock - alert.current_stock);
    setProductionQuantity(suggestedQuantity > 0 ? suggestedQuantity.toString() : '');
    setShowProductionOrderDialog(true);
  };

  const handleCreateProductionOrder = async () => {
    if (!selectedAlert || !productionQuantity) {
      alert('Por favor, informe a quantidade a ser produzida');
      return;
    }

    const quantity = parseFloat(productionQuantity);
    if (quantity <= 0) {
      alert('A quantidade deve ser maior que zero');
      return;
    }

    try {
      const { data: lastOrder } = await supabase
        .from('production_orders')
        .select('order_number')
        .order('order_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextOrderNumber = lastOrder ? lastOrder.order_number + 1 : 1;

      const { data: newOrder, error: orderError } = await supabase
        .from('production_orders')
        .insert([{
          order_number: nextOrderNumber,
          product_id: selectedAlert.item_id,
          customer_id: null,
          total_quantity: Math.floor(quantity),
          remaining_quantity: Math.floor(quantity),
          status: 'open',
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      const { error: alertError } = await supabase
        .from('stock_alerts')
        .update({
          status: 'order_placed',
          order_placed_at: new Date().toISOString(),
          production_order_id: newOrder.id,
        })
        .eq('id', selectedAlert.id);

      if (alertError) throw alertError;

      alert(`Ordem de Produção #${nextOrderNumber} criada com sucesso!\n\nQuantidade: ${quantity} ${selectedAlert.item_unit}\n\nA ordem está disponível na aba "Ordens de Produção".`);

      setShowProductionOrderDialog(false);
      setSelectedAlert(null);
      setProductionQuantity('');
      loadAlerts();
    } catch (error) {
      console.error('Erro ao criar ordem de produção:', error);
      alert('Erro ao criar ordem de produção');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-3 py-1 inline-flex items-center gap-1 text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
            <AlertTriangle className="w-3 h-3" />
            Pendente
          </span>
        );
      case 'order_placed':
        return (
          <span className="px-3 py-1 inline-flex items-center gap-1 text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3" />
            Pedido Realizado
          </span>
        );
      case 'resolved':
        return (
          <span className="px-3 py-1 inline-flex items-center gap-1 text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3" />
            Resolvido
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Alertas Pendentes</p>
              <p className="text-3xl font-bold text-red-600">
                {alerts.filter(a => a.status === 'pending').length}
              </p>
            </div>
            <AlertTriangle className="w-12 h-12 text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pedidos Realizados</p>
              <p className="text-3xl font-bold text-yellow-600">
                {alerts.filter(a => a.status === 'order_placed').length}
              </p>
            </div>
            <Clock className="w-12 h-12 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total de Alertas</p>
              <p className="text-3xl font-bold text-gray-900">{alerts.length}</p>
            </div>
            <Package className="w-12 h-12 text-blue-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6" />
            Alertas de Estoque Baixo
          </h2>
        </div>

        {alerts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <p className="text-lg font-medium">Nenhum alerta de estoque!</p>
            <p className="text-sm mt-2">Todos os itens estão com estoque adequado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estoque Atual
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estoque Mínimo
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fornecedor
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {alerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {alert.item_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {alert.item_type === 'product' ? (
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          Produto
                        </span>
                      ) : (
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                          Insumo
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-semibold text-red-600">
                        {alert.current_stock.toFixed(2)} {alert.item_unit}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-900">
                        {alert.minimum_stock.toFixed(2)} {alert.item_unit}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {getStatusBadge(alert.status)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        {alert.item_type === 'product' ? (
                          alert.production_order_number ? (
                            <span className="font-medium text-green-600">OP #{alert.production_order_number}</span>
                          ) : (
                            <span className="text-gray-400">Produção própria</span>
                          )
                        ) : (
                          alert.supplier_name || <span className="text-gray-400">Sem fornecedor</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {alert.item_type === 'product' ? (
                        <button
                          onClick={() => handleViewProductionOrder(alert)}
                          className="text-[#0A7EC2] hover:text-[#0968A8] font-medium text-sm flex items-center gap-1 mx-auto"
                          disabled={alert.status === 'order_placed' && alert.production_order_id !== null}
                        >
                          <ClipboardList className="w-4 h-4" />
                          {alert.status === 'pending' ? 'Criar Ordem' : 'Ver Ordem'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleViewSupplier(alert)}
                          className="text-[#0A7EC2] hover:text-[#0968A8] font-medium text-sm"
                        >
                          {alert.status === 'pending' ? 'Realizar Pedido' : 'Ver Detalhes'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showSupplierDialog && selectedAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Detalhes do Pedido</h3>
              <button
                onClick={() => setShowSupplierDialog(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Item</h4>
                <p className="text-lg font-bold text-gray-900">{selectedAlert.item_name}</p>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <p className="text-xs text-gray-600">Estoque Atual</p>
                    <p className="text-sm font-semibold text-red-600">
                      {selectedAlert.current_stock.toFixed(2)} {selectedAlert.item_unit}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Estoque Mínimo</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {selectedAlert.minimum_stock.toFixed(2)} {selectedAlert.item_unit}
                    </p>
                  </div>
                </div>
              </div>

              {materialSuppliers.length > 0 && (
                <div className="bg-purple-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">
                    Selecione o Fornecedor
                  </h4>
                  <div className="space-y-2">
                    {materialSuppliers.map((ms) => (
                      <label
                        key={ms.id}
                        className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-white transition-colors"
                      >
                        <input
                          type="radio"
                          name="supplier"
                          checked={selectedSupplier?.id === ms.id}
                          onChange={async () => {
                            setSelectedSupplier(ms);
                            setSelectedContact(null);
                            await loadSupplierContacts(ms.supplier_id);
                          }}
                          className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900">
                              {ms.suppliers?.name}
                            </p>
                            {ms.is_primary && (
                              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                                Principal
                              </span>
                            )}
                          </div>
                          {ms.unit_cost > 0 && (
                            <p className="text-xs text-gray-600">
                              Custo: R$ {ms.unit_cost.toFixed(2)}
                            </p>
                          )}
                          {ms.suppliers?.phone && (
                            <p className="text-xs text-gray-600">
                              📱 {ms.suppliers.phone}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {selectedSupplier && (
                <>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Dados do Fornecedor Selecionado</h4>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-gray-600">Nome</p>
                        <p className="text-sm font-medium text-gray-900">{selectedSupplier.suppliers?.name}</p>
                      </div>
                      {selectedSupplier.suppliers?.cnpj && (
                        <div>
                          <p className="text-xs text-gray-600">CNPJ</p>
                          <p className="text-sm font-medium text-gray-900">{selectedSupplier.suppliers.cnpj}</p>
                        </div>
                      )}
                      {selectedSupplier.suppliers?.phone && (
                        <div>
                          <p className="text-xs text-gray-600">Telefone Principal</p>
                          <p className="text-sm font-medium text-gray-900">{selectedSupplier.suppliers.phone}</p>
                        </div>
                      )}
                      {selectedSupplier.suppliers?.email && (
                        <div>
                          <p className="text-xs text-gray-600">E-mail</p>
                          <p className="text-sm font-medium text-gray-900">{selectedSupplier.suppliers.email}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {supplierContacts.length > 0 && (
                    <div className="bg-green-50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">
                        Selecione o Contato para WhatsApp
                      </h4>
                      <div className="space-y-2">
                        {selectedSupplier?.suppliers?.phone && (
                          <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-white transition-colors">
                            <input
                              type="radio"
                              name="contact"
                              checked={selectedContact === null}
                              onChange={() => setSelectedContact(null)}
                              className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                Telefone Principal do Fornecedor
                              </p>
                              <p className="text-xs text-gray-600">{selectedSupplier.suppliers.phone}</p>
                            </div>
                          </label>
                        )}
                        {supplierContacts.map((contact) => (
                          <label
                            key={contact.id}
                            className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-white transition-colors"
                          >
                            <input
                              type="radio"
                              name="contact"
                              checked={selectedContact?.id === contact.id}
                              onChange={() => setSelectedContact(contact)}
                              className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-gray-900">{contact.name}</p>
                                {contact.is_primary && (
                                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                    Principal
                                  </span>
                                )}
                              </div>
                              {contact.role && (
                                <p className="text-xs text-gray-600">{contact.role}</p>
                              )}
                              <p className="text-xs text-gray-600">{contact.phone}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {materialSuppliers.length === 0 && !selectedAlert.supplier_name && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    Este item não possui fornecedores cadastrados. Cadastre fornecedores para facilitar os pedidos de reposição.
                  </p>
                </div>
              )}

              {selectedAlert.status === 'order_placed' && selectedAlert.order_placed_at && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-800">
                    Pedido realizado em{' '}
                    {new Date(selectedAlert.order_placed_at).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              {selectedAlert.status === 'pending' && (selectedSupplier || selectedAlert.supplier_contact || supplierContacts.length > 0) ? (
                <button
                  onClick={handlePlaceOrder}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm hover:shadow-md transition-all"
                >
                  <Phone className="w-5 h-5" />
                  Realizar Pedido via WhatsApp
                </button>
              ) : selectedAlert.status === 'pending' ? (
                <div className="flex-1 text-center text-sm text-gray-600">
                  Cadastre um contato com WhatsApp para o fornecedor para enviar o pedido
                </div>
              ) : null}
              <button
                onClick={() => {
                  setShowSupplierDialog(false);
                  setSelectedContact(null);
                  setSupplierContacts([]);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {showProductionOrderDialog && selectedAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <ClipboardList className="w-5 h-5" />
                {selectedAlert.production_order_id ? 'Detalhes da Ordem' : 'Criar Ordem de Produção'}
              </h3>
              <button
                onClick={() => {
                  setShowProductionOrderDialog(false);
                  setProductionQuantity('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Produto</h4>
                <p className="text-lg font-bold text-gray-900">{selectedAlert.item_name}</p>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <p className="text-xs text-gray-600">Estoque Atual</p>
                    <p className="text-sm font-semibold text-red-600">
                      {selectedAlert.current_stock.toFixed(2)} {selectedAlert.item_unit}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Estoque Mínimo</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {selectedAlert.minimum_stock.toFixed(2)} {selectedAlert.item_unit}
                    </p>
                  </div>
                </div>
              </div>

              {selectedAlert.production_order_id ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-green-800 mb-2">Ordem de Produção Criada</h4>
                  <p className="text-sm text-green-700">
                    A Ordem de Produção <span className="font-bold">#{selectedAlert.production_order_number}</span> foi criada para este alerta.
                  </p>
                  <p className="text-sm text-green-700 mt-2">
                    Criada em:{' '}
                    {selectedAlert.order_placed_at && new Date(selectedAlert.order_placed_at).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  <p className="text-xs text-green-600 mt-3">
                    Acesse a aba "Ordens de Produção" para visualizar os detalhes e gerar o relatório.
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Uma ordem de produção será criada para repor o estoque deste produto. Informe a quantidade a ser produzida.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quantidade a Produzir *
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={productionQuantity}
                      onChange={(e) => setProductionQuantity(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                      placeholder="Ex: 1000"
                      autoFocus
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Sugestão: {Math.ceil(selectedAlert.minimum_stock - selectedAlert.current_stock)} {selectedAlert.item_unit} (para atingir o estoque mínimo)
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              {!selectedAlert.production_order_id && (
                <button
                  onClick={handleCreateProductionOrder}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#0A7EC2] text-white rounded-lg hover:bg-[#0968A8] shadow-sm hover:shadow-md transition-all"
                >
                  <ClipboardList className="w-5 h-5" />
                  Criar Ordem de Produção
                </button>
              )}
              <button
                onClick={() => {
                  setShowProductionOrderDialog(false);
                  setProductionQuantity('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
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
