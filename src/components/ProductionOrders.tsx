import { useState, useEffect } from 'react';
import {
  Package, CheckCircle, XCircle, Clock, AlertCircle, Plus, X,
  QrCode, FileText, ChevronDown, ChevronUp, Edit2, Trash2,
  Building2, Layers, ListOrdered
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import ProductionLabel from './ProductionLabel';
import ProductionByQuote from './production/ProductionByQuote';
import ProductionQueue from './production/ProductionQueue';
import ProductionItemDetail from './production/ProductionItemDetail';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ProductionOrderItem {
  id: string;
  production_order_id: string;
  quote_item_id?: string;
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
  updated_at: string;
  completed_at?: string;
  customers?: { name: string; person_type: 'pf' | 'pj' } | null;
  products?: { name: string; unit: string; recipe_id?: string };
  production_order_items?: ProductionOrderItem[];
}

interface LabelData {
  productName: string;
  quantity: number;
  unit: string;
  productionDate: string;
  recipeName: string;
  orderNumber?: number;
  customerName?: string;
  qrToken: string;
  sequenceInfo?: string;
}

interface SubOrderInfo {
  id: string;
  sequence_number: number;
  total_in_item: number;
  qr_token: string;
  status: 'pending' | 'in_production' | 'produced' | 'shipped';
  produced_at?: string;
  notes?: string;
  qrCodeUrl?: string;
}

interface Product {
  id: string;
  name: string;
}

interface Customer {
  id: string;
  name: string;
  person_type: 'pf' | 'pj';
}

interface ProductionRecord {
  id: string;
  product_id: string;
  quantity: number;
  production_date: string;
  notes: string;
  production_order_id: string;
  products?: { name: string; unit: string };
}

interface NewOrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  notes: string;
}

type MainTab = 'por_obra' | 'fila' | 'lista';

export default function ProductionOrders() {
  const [mainTab, setMainTab] = useState<MainTab>('por_obra');
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showNewOrderForm, setShowNewOrderForm] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [newOrder, setNewOrder] = useState({
    customer_id: '',
    notes: '',
    deadline: '',
  });
  const [newOrderItems, setNewOrderItems] = useState<NewOrderItem[]>([]);
  const [currentItem, setCurrentItem] = useState({
    product_id: '',
    quantity: '',
    notes: '',
  });
  const [showLabel, setShowLabel] = useState(false);
  const [labelData, setLabelData] = useState<LabelData | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportPeriod, setReportPeriod] = useState({ startDate: '', endDate: '' });
  const [companySettings, setCompanySettings] = useState<Record<string, string>>({});
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [orderProductions, setOrderProductions] = useState<Record<string, ProductionRecord[]>>({});
  const [editingProduction, setEditingProduction] = useState<ProductionRecord | null>(null);
  const [editProductionForm, setEditProductionForm] = useState({
    quantity: '',
    production_date: '',
    notes: '',
  });
  const [selectedItem, setSelectedItem] = useState<{ item: ProductionOrderItem; order: ProductionOrder } | null>(null);

  useEffect(() => {
    loadOrders();
    loadProducts();
    loadCustomers();
    loadCompanySettings();
  }, []);

  const triggerRefresh = () => {
    setRefreshKey(k => k + 1);
    loadOrders();
  };

  const loadCompanySettings = async () => {
    try {
      const { data } = await supabase.from('company_settings').select('*');
      const settingsMap: Record<string, string> = {};
      data?.forEach((s: { setting_key: string; setting_value: string }) => {
        settingsMap[s.setting_key] = s.setting_value;
      });
      setCompanySettings(settingsMap);
    } catch (error) {
      console.error('Erro ao carregar configuracoes:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const { data } = await supabase.from('products').select('id, name').order('name');
      setProducts(data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    }
  };

  const loadCustomers = async () => {
    try {
      const { data } = await supabase.from('customers').select('id, name, person_type').order('name');
      setCustomers(data || []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  const loadOrderProductions = async (orderId: string) => {
    try {
      const { data, error } = await supabase
        .from('production')
        .select('*, products(name, unit)')
        .eq('production_order_id', orderId)
        .order('production_date', { ascending: false });
      if (error) throw error;
      setOrderProductions(prev => ({ ...prev, [orderId]: data || [] }));
    } catch (error) {
      console.error('Erro ao carregar producoes:', error);
    }
  };

  const toggleOrderExpanded = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
      if (!orderProductions[orderId]) loadOrderProductions(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  const handleEditProduction = (production: ProductionRecord) => {
    setEditingProduction(production);
    setEditProductionForm({
      quantity: production.quantity.toString(),
      production_date: production.production_date,
      notes: production.notes || '',
    });
  };

  const handleCancelEditProduction = () => {
    setEditingProduction(null);
    setEditProductionForm({ quantity: '', production_date: '', notes: '' });
  };

  const handleUpdateProduction = async () => {
    if (!editingProduction) return;
    const quantity = parseFloat(editProductionForm.quantity);
    if (isNaN(quantity) || quantity <= 0) { alert('Quantidade deve ser maior que zero'); return; }
    try {
      const { error } = await supabase.from('production').update({
        quantity,
        production_date: editProductionForm.production_date,
        notes: editProductionForm.notes || null,
      }).eq('id', editingProduction.id);
      if (error) throw error;
      await loadOrderProductions(editingProduction.production_order_id);
      await loadOrders();
      handleCancelEditProduction();
    } catch (error: any) {
      alert('Erro ao atualizar producao: ' + error.message);
    }
  };

  const handleDeleteProduction = async (production: ProductionRecord) => {
    if (!confirm(`Confirma a exclusao desta producao de ${production.quantity} unidades?`)) return;
    try {
      const { error } = await supabase.from('production').delete().eq('id', production.id);
      if (error) throw error;
      await loadOrderProductions(production.production_order_id);
      await loadOrders();
    } catch (error: any) {
      alert('Erro ao excluir producao: ' + error.message);
    }
  };

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('production_orders')
        .select('*, customers(name, person_type), products(name, unit, recipe_id)')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const ordersWithItems = await Promise.all(
        (data || []).map(async (order) => {
          const { data: items } = await supabase
            .from('production_order_items')
            .select('*, products(name, unit), materials(name, unit), compositions(name)')
            .eq('production_order_id', order.id);
          return { ...order, production_order_items: items || [] };
        })
      );
      setOrders(ordersWithItems);
    } catch (error) {
      console.error('Erro ao carregar ordens:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLabelForItem = async (
    order: ProductionOrder,
    item: ProductionOrderItem,
    subOrder?: SubOrderInfo
  ) => {
    try {
      let recipeName = 'Traco nao especificado';

      if (item.product_id) {
        const { data: productData } = await supabase
          .from('products')
          .select('recipe_id, name, unit, recipes(name)')
          .eq('id', item.product_id)
          .maybeSingle();

        if (productData?.recipes?.name) recipeName = productData.recipes.name;

        const qrToken = subOrder?.qr_token || `${crypto.randomUUID()}-${Date.now()}`;

        if (!subOrder) {
          const { data: trackingData, error: trackingError } = await supabase
            .from('product_tracking')
            .insert([{
              qr_token: qrToken,
              production_id: null,
              production_order_id: order.id,
              product_id: item.product_id,
              recipe_name: recipeName,
              quantity: item.quantity,
              production_date: new Date().toISOString().split('T')[0],
            }])
            .select()
            .single();

          if (trackingError) throw trackingError;

          if (productData?.enable_stage_tracking) {
            const { data: stages } = await supabase
              .from('production_stages')
              .select('id, stage_key')
              .in('stage_key', ['quote_created', 'quote_approved']);

            if (stages && stages.length > 0) {
              const stageRecords = stages.map(stage => ({
                tracking_id: trackingData.id,
                stage_id: stage.id,
                completed_by: 'Sistema',
                completed_at: new Date().toISOString(),
              }));
              await supabase.from('production_stage_records').insert(stageRecords);
            }
          }
        }

        const sequenceInfo = subOrder
          ? `Peca ${subOrder.sequence_number}/${subOrder.total_in_item}`
          : undefined;

        setLabelData({
          productName: productData?.name || item.products?.name || '',
          quantity: subOrder ? 1 : item.quantity,
          unit: productData?.unit || item.products?.unit || 'un',
          productionDate: new Date().toISOString().split('T')[0],
          recipeName,
          orderNumber: order.order_number,
          customerName: order.customers?.name,
          qrToken,
          sequenceInfo,
        });
        setShowLabel(true);
      }
    } catch (error: any) {
      console.error('Erro ao gerar etiqueta:', error);
      alert('Erro ao gerar etiqueta: ' + error.message);
    }
  };

  const handleAddItemToOrder = () => {
    if (!currentItem.product_id || !currentItem.quantity) {
      alert('Selecione um produto e informe a quantidade');
      return;
    }
    const quantity = parseInt(currentItem.quantity);
    if (quantity <= 0) { alert('A quantidade deve ser maior que zero'); return; }
    const product = products.find(p => p.id === currentItem.product_id);
    if (!product) { alert('Produto nao encontrado'); return; }
    if (newOrderItems.some(item => item.product_id === currentItem.product_id)) {
      alert('Este produto ja foi adicionado. Remova-o primeiro se desejar alterar a quantidade.');
      return;
    }
    setNewOrderItems([...newOrderItems, {
      product_id: currentItem.product_id,
      product_name: product.name,
      quantity,
      notes: currentItem.notes || '',
    }]);
    setCurrentItem({ product_id: '', quantity: '', notes: '' });
  };

  const handleRemoveItemFromOrder = (productId: string) => {
    setNewOrderItems(newOrderItems.filter(item => item.product_id !== productId));
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newOrderItems.length === 0) { alert('Adicione pelo menos um produto a ordem de producao'); return; }

    try {
      const { data: maxOrderNumber } = await supabase
        .from('production_orders')
        .select('order_number')
        .order('order_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextOrderNumber = (maxOrderNumber?.order_number || 0) + 1;
      const totalQuantity = newOrderItems.reduce((sum, item) => sum + item.quantity, 0);

      const { data: insertedOrder, error: orderError } = await supabase
        .from('production_orders')
        .insert({
          order_number: nextOrderNumber,
          product_id: newOrderItems.length === 1 ? newOrderItems[0].product_id : null,
          customer_id: newOrder.customer_id || null,
          total_quantity: totalQuantity,
          produced_quantity: 0,
          remaining_quantity: totalQuantity,
          status: 'open',
          notes: newOrder.notes || `Ordem com ${newOrderItems.length} item(ns)`,
          deadline: newOrder.deadline || null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const { error: itemsError } = await supabase
        .from('production_order_items')
        .insert(newOrderItems.map(item => ({
          production_order_id: insertedOrder.id,
          item_type: 'product',
          product_id: item.product_id,
          quantity: item.quantity,
          produced_quantity: 0,
          unit_price: 0,
          notes: item.notes,
        })));

      if (itemsError) throw itemsError;

      alert(`Ordem de producao ${nextOrderNumber} criada com sucesso!`);
      setShowNewOrderForm(false);
      setNewOrder({ customer_id: '', notes: '', deadline: '' });
      setNewOrderItems([]);
      setCurrentItem({ product_id: '', quantity: '', notes: '' });
      triggerRefresh();
    } catch (error: any) {
      alert('Erro ao criar ordem: ' + error.message);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta ordem de producao?')) return;
    try {
      const { error } = await supabase.from('production_orders').delete().eq('id', orderId);
      if (error) throw error;
      triggerRefresh();
    } catch (error) {
      alert('Erro ao excluir ordem');
    }
  };

  const handleCompleteOrder = async (orderId: string) => {
    if (!confirm('Marcar esta ordem como concluida?')) return;
    try {
      const { error } = await supabase.from('production_orders').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', orderId);
      if (error) throw error;
      triggerRefresh();
    } catch (error) {
      alert('Erro ao concluir ordem');
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <Clock className="w-4 h-4" />;
      case 'in_progress': return <AlertCircle className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'cancelled': return <XCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const handleGenerateReport = async () => {
    if (!reportPeriod.startDate || !reportPeriod.endDate) {
      alert('Por favor, selecione o periodo para o relatorio');
      return;
    }

    const startDate = new Date(reportPeriod.startDate + 'T00:00:00');
    const endDate = new Date(reportPeriod.endDate + 'T23:59:59');
    const ordersInPeriod = orders.filter((order) => {
      if (order.status === 'completed' || order.status === 'cancelled') return false;
      if (!order.deadline) return false;
      const deadline = new Date(order.deadline + 'T00:00:00');
      return deadline >= startDate && deadline <= endDate;
    }).sort((a, b) => new Date(a.deadline + 'T00:00:00').getTime() - new Date(b.deadline + 'T00:00:00').getTime());

    if (ordersInPeriod.length === 0) {
      alert('Nenhuma ordem encontrada no periodo selecionado');
      return;
    }

    try {
      const doc = new jsPDF();
      let currentY = 14;
      const headerTitle = companySettings.report_header_title || 'RELATORIO DE PRODUCAO';
      const headerSubtitle = companySettings.report_header_subtitle || 'Sistema de Gestao';
      const footerText = companySettings.report_footer_text || 'Documento gerado automaticamente pelo sistema';
      const companyName = companySettings.company_trade_name || companySettings.company_name || '';
      const pageWidth = doc.internal.pageSize.width;

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(headerTitle, 14, currentY);
      currentY += 6;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(headerSubtitle, 14, currentY);
      currentY += 5;
      if (companyName) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(companyName, 14, currentY);
        currentY += 6;
      }

      doc.setDrawColor(10, 126, 194);
      doc.setLineWidth(0.5);
      doc.line(14, currentY, 196, currentY);
      currentY += 8;

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Ordens de Producao - Por Urgencia', 14, currentY);
      currentY += 6;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Periodo: ${new Date(reportPeriod.startDate).toLocaleDateString('pt-BR')} a ${new Date(reportPeriod.endDate).toLocaleDateString('pt-BR')}`, 14, currentY);
      currentY += 5;
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, currentY);
      currentY += 8;

      const tableData = ordersInPeriod.map((order) => {
        const isOverdue = new Date(order.deadline + 'T00:00:00') < new Date() && order.status !== 'completed';
        return [
          `OP #${order.order_number}`,
          order.products?.name || 'N/A',
          order.customers?.name || 'Reposicao de Estoque',
          `${order.remaining_quantity} ${order.products?.unit || 'un'}`,
          new Date(order.deadline + 'T00:00:00').toLocaleDateString('pt-BR') + (isOverdue ? ' *' : ''),
          getStatusLabel(order.status),
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: [['Ordem', 'Produto', 'Cliente', 'Falta Produzir', 'Prazo', 'Status']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [10, 126, 194], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 8 },
      });

      const finalY = (doc as any).lastAutoTable.finalY || currentY;
      currentY = finalY + 10;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Total de ordens: ${ordersInPeriod.length}`, 14, currentY);
      currentY += 6;
      doc.text(`Total a produzir: ${ordersInPeriod.reduce((s, o) => s + o.remaining_quantity, 0)} unidades`, 14, currentY);

      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text(footerText, 14, pageHeight - 10, { maxWidth: pageWidth - 28 });

      doc.save(`relatorio-producao-${reportPeriod.startDate}-a-${reportPeriod.endDate}.pdf`);
      setShowReportModal(false);
      setReportPeriod({ startDate: '', endDate: '' });
    } catch (error) {
      alert('Erro ao gerar relatorio.');
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (filterStatus === 'all') return true;
    return order.status === filterStatus;
  });

  const tabs: { key: MainTab; label: string; icon: React.ElementType; count?: number }[] = [
    { key: 'por_obra', label: 'Por Obra', icon: Building2 },
    { key: 'fila', label: 'Fila de Producao', icon: ListOrdered },
    { key: 'lista', label: 'Lista Classica', icon: Package, count: orders.length },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showLabel && labelData && (
        <ProductionLabel
          productionData={labelData}
          onClose={() => { setShowLabel(false); setLabelData(null); }}
        />
      )}

      {selectedItem && (
        <ProductionItemDetail
          item={selectedItem.item}
          order={selectedItem.order}
          onClose={() => setSelectedItem(null)}
          onGenerateLabel={(order, item, subOrder) => handleGenerateLabelForItem(order, item, subOrder)}
          onRefresh={triggerRefresh}
        />
      )}

      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Relatorio de Producao por Urgencia
              </h3>
              <button onClick={() => { setShowReportModal(false); setReportPeriod({ startDate: '', endDate: '' }); }}>
                <X className="w-6 h-6 text-gray-500 hover:text-gray-700" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data Inicial do Prazo</label>
                <input
                  type="date"
                  value={reportPeriod.startDate}
                  onChange={(e) => setReportPeriod({ ...reportPeriod, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data Final do Prazo</label>
                <input
                  type="date"
                  value={reportPeriod.endDate}
                  onChange={(e) => setReportPeriod({ ...reportPeriod, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowReportModal(false); setReportPeriod({ startDate: '', endDate: '' }); }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGenerateReport}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 font-semibold"
                >
                  <FileText className="w-5 h-5" />
                  Gerar Relatorio
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-md overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Package className="w-6 h-6 text-blue-600" />
                Ordens de Producao
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">Gerencie e acompanhe o progresso das ordens</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowReportModal(true)}
                className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1.5 text-sm"
              >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Relatorio</span>
              </button>
              <button
                onClick={() => setShowNewOrderForm(!showNewOrderForm)}
                className="bg-[#0A7EC2] text-white px-3 py-2 rounded-lg hover:bg-[#0968A8] transition-colors flex items-center gap-1.5 text-sm font-semibold"
              >
                <Plus className="w-4 h-4" />
                Nova Ordem
              </button>
            </div>
          </div>

          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {tabs.map(({ key, label, icon: Icon, count }) => (
              <button
                key={key}
                onClick={() => setMainTab(key)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  mainTab === key
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
                {count !== undefined && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    mainTab === key ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {showNewOrderForm && (
          <div className="m-6 p-6 bg-blue-50 rounded-xl border-2 border-[#0A7EC2]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Nova Ordem de Producao
              </h3>
              <button
                onClick={() => {
                  setShowNewOrderForm(false);
                  setNewOrder({ customer_id: '', notes: '', deadline: '' });
                  setNewOrderItems([]);
                  setCurrentItem({ product_id: '', quantity: '', notes: '' });
                }}
              >
                <X className="w-5 h-5 text-gray-500 hover:text-gray-700" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cliente (Opcional)</label>
                  <select
                    value={newOrder.customer_id}
                    onChange={(e) => setNewOrder({ ...newOrder, customer_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                  >
                    <option value="">Reposicao de Estoque</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.person_type === 'pf' ? 'PF' : 'PJ'})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Prazo de Entrega</label>
                  <input
                    type="date"
                    value={newOrder.deadline}
                    onChange={(e) => setNewOrder({ ...newOrder, deadline: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Observacoes da Ordem</label>
                  <input
                    type="text"
                    value={newOrder.notes}
                    onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                    placeholder="Informacoes adicionais"
                  />
                </div>
              </div>

              <div className="border-t-2 border-gray-300 pt-4">
                <h4 className="text-md font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Produtos da Ordem
                </h4>

                {newOrderItems.length > 0 && (
                  <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200 space-y-2">
                    {newOrderItems.map((item, index) => (
                      <div key={item.product_id} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900">{index + 1}. {item.product_name}</div>
                          <div className="text-sm text-gray-600">
                            Quantidade: <span className="font-bold text-green-700">{item.quantity} unidades</span>
                            {item.notes && <span className="ml-2">- {item.notes}</span>}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItemFromOrder(item.product_id)}
                          className="text-red-600 hover:text-red-800 p-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-gray-200 text-sm font-bold text-gray-900">
                      Total: {newOrderItems.reduce((sum, item) => sum + item.quantity, 0)} unidades em {newOrderItems.length} produto(s)
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Produto</label>
                    <select
                      value={currentItem.product_id}
                      onChange={(e) => setCurrentItem({ ...currentItem, product_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                    >
                      <option value="">Selecione um produto</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                    <input
                      type="number"
                      value={currentItem.quantity}
                      onChange={(e) => setCurrentItem({ ...currentItem, quantity: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                      placeholder="0"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Obs. do Item</label>
                    <input
                      type="text"
                      value={currentItem.notes}
                      onChange={(e) => setCurrentItem({ ...currentItem, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                      placeholder="Opcional"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddItemToOrder}
                  className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-semibold"
                >
                  <Plus className="w-5 h-5" />
                  Adicionar Produto a Ordem
                </button>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t-2 border-gray-300">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewOrderForm(false);
                    setNewOrder({ customer_id: '', notes: '', deadline: '' });
                    setNewOrderItems([]);
                    setCurrentItem({ product_id: '', quantity: '', notes: '' });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={newOrderItems.length === 0}
                  className="bg-[#0A7EC2] text-white px-4 py-2 rounded-lg hover:bg-[#0968A8] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  <CheckCircle className="w-5 h-5" />
                  Criar Ordem de Producao
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="p-6">
          {mainTab === 'por_obra' && (
            <ProductionByQuote
              onSelectItem={(item, order) => setSelectedItem({ item, order })}
              onGenerateLabel={handleGenerateLabelForItem}
              refreshKey={refreshKey}
            />
          )}

          {mainTab === 'fila' && (
            <ProductionQueue
              onSelectItem={(item, order) => setSelectedItem({ item, order })}
              onGenerateLabel={handleGenerateLabelForItem}
              refreshKey={refreshKey}
            />
          )}

          {mainTab === 'lista' && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                {[
                  { key: 'all', label: `Todas (${orders.length})` },
                  { key: 'open', label: `Abertas (${orders.filter(o => o.status === 'open').length})` },
                  { key: 'in_progress', label: `Em Producao (${orders.filter(o => o.status === 'in_progress').length})` },
                  { key: 'completed', label: `Concluidas (${orders.filter(o => o.status === 'completed').length})` },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setFilterStatus(key)}
                    className={`px-4 py-2 rounded-lg transition-colors text-sm ${
                      filterStatus === key ? 'bg-[#0A7EC2] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {filteredOrders.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>Nenhuma ordem de producao encontrada</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredOrders.map((order) => {
                    const progress = order.total_quantity === 0 ? 0 : (order.produced_quantity / order.total_quantity) * 100;
                    return (
                      <div key={order.id} className="border-2 border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow">
                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-5 text-white">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2 flex-wrap">
                                <span className="bg-white text-blue-700 font-bold px-3 py-1 rounded text-sm">
                                  OP #{order.order_number}
                                </span>
                                <span className={`px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1 ${getStatusColor(order.status)}`}>
                                  {getStatusIcon(order.status)}
                                  {getStatusLabel(order.status)}
                                </span>
                              </div>
                              <h3 className="text-xl font-bold mb-1">
                                {order.customers ? (
                                  <>
                                    {order.customers.name}
                                    <span className="text-sm font-normal ml-2 opacity-90">
                                      ({order.customers.person_type === 'pf' ? 'Pessoa Fisica' : 'Pessoa Juridica'})
                                    </span>
                                  </>
                                ) : (
                                  <span className="italic">Reposicao de Estoque</span>
                                )}
                              </h3>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                            <div>
                              <div className="opacity-80 mb-1">Criada em</div>
                              <div className="font-semibold">{new Date(order.created_at).toLocaleDateString('pt-BR')}</div>
                            </div>
                            {order.deadline && (
                              <div>
                                <div className="opacity-80 mb-1">Prazo de Entrega</div>
                                <div className={`font-semibold ${
                                  new Date(order.deadline + 'T00:00:00') < new Date() && order.status !== 'completed' ? 'text-red-200' : ''
                                }`}>
                                  {new Date(order.deadline + 'T00:00:00').toLocaleDateString('pt-BR')}
                                </div>
                              </div>
                            )}
                            <div>
                              <div className="opacity-80 mb-1">Total de Itens</div>
                              <div className="font-semibold">{order.production_order_items?.length || 1} item(ns)</div>
                            </div>
                          </div>

                          {order.notes && (
                            <div className="mt-3 pt-3 border-t border-blue-500 text-sm opacity-90">
                              {order.notes}
                            </div>
                          )}
                        </div>

                        <div className="p-5 bg-white">
                          {(order.production_order_items && order.production_order_items.length > 0
                            ? order.production_order_items
                            : [{
                                id: order.id,
                                production_order_id: order.id,
                                item_type: 'product' as const,
                                product_id: order.product_id,
                                quantity: order.total_quantity,
                                produced_quantity: order.produced_quantity,
                                unit_price: 0,
                                products: order.products,
                              }]
                          ).map((item) => {
                            const itemProgress = item.quantity > 0 ? (item.produced_quantity / item.quantity) * 100 : 0;
                            return (
                              <div key={item.id} className="border-b border-gray-100 pb-4 mb-4 last:border-b-0 last:mb-0 last:pb-0">
                                <div className="flex items-center justify-between mb-2">
                                  <div>
                                    <h4 className="font-bold text-gray-900">
                                      {item.products?.name || item.materials?.name || item.compositions?.name}
                                    </h4>
                                    <div className="text-sm text-gray-600">
                                      <span className="font-semibold">{item.quantity} {item.products?.unit || item.materials?.unit || 'unidades'}</span>
                                      {item.notes && <span className="ml-2 italic">({item.notes})</span>}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => setSelectedItem({ item: item as ProductionOrderItem, order })}
                                    className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1.5 rounded-lg border border-blue-200 transition-colors"
                                  >
                                    <Layers className="w-3.5 h-3.5" />
                                    Detalhe
                                  </button>
                                </div>

                                <div className="relative mb-2">
                                  <div className="w-full bg-gray-200 rounded-full h-6 shadow-inner">
                                    <div
                                      className={`h-6 rounded-full transition-all flex items-center justify-end pr-3 ${
                                        itemProgress === 100 ? 'bg-gradient-to-r from-green-500 to-green-600'
                                        : itemProgress >= 50 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500'
                                        : 'bg-gradient-to-r from-blue-500 to-blue-600'
                                      }`}
                                      style={{ width: `${Math.min(itemProgress, 100)}%` }}
                                    >
                                      {itemProgress > 10 && (
                                        <span className="text-white font-bold text-xs">{itemProgress.toFixed(0)}%</span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {(order.status === 'open' || order.status === 'in_progress') && item.product_id && (
                                  <button
                                    onClick={() => handleGenerateLabelForItem(order, item as ProductionOrderItem)}
                                    className="bg-[#0A7EC2] text-white px-3 py-1.5 rounded-lg hover:bg-[#0968A8] transition-colors flex items-center gap-2 text-sm"
                                  >
                                    <QrCode className="w-4 h-4" />
                                    Gerar Etiqueta
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {order.produced_quantity > 0 && (
                          <div className="px-5 pb-3 border-t border-gray-100">
                            <button
                              onClick={() => toggleOrderExpanded(order.id)}
                              className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-600 hover:text-[#0A7EC2] py-3 transition-colors"
                            >
                              <span>Producoes Registradas ({order.produced_quantity} unidades)</span>
                              {expandedOrders.has(order.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>

                            {expandedOrders.has(order.id) && (
                              <div className="space-y-2 pb-2">
                                {orderProductions[order.id]?.map((prod) => (
                                  <div key={prod.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                    {editingProduction?.id === prod.id ? (
                                      <div className="space-y-2">
                                        <div className="grid grid-cols-2 gap-2">
                                          <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Quantidade *</label>
                                            <input
                                              type="number"
                                              value={editProductionForm.quantity}
                                              onChange={(e) => setEditProductionForm({ ...editProductionForm, quantity: e.target.value })}
                                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-[#0A7EC2]"
                                              min="1"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Data *</label>
                                            <input
                                              type="date"
                                              value={editProductionForm.production_date}
                                              onChange={(e) => setEditProductionForm({ ...editProductionForm, production_date: e.target.value })}
                                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-[#0A7EC2]"
                                            />
                                          </div>
                                        </div>
                                        <input
                                          type="text"
                                          value={editProductionForm.notes}
                                          onChange={(e) => setEditProductionForm({ ...editProductionForm, notes: e.target.value })}
                                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-[#0A7EC2]"
                                          placeholder="Observacoes"
                                        />
                                        <div className="flex gap-2">
                                          <button onClick={handleUpdateProduction} className="flex-1 bg-green-500 text-white px-3 py-1.5 rounded text-sm hover:bg-green-600 flex items-center justify-center gap-1">
                                            <CheckCircle className="w-3 h-3" /> Salvar
                                          </button>
                                          <button onClick={handleCancelEditProduction} className="flex-1 bg-gray-300 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-400">
                                            Cancelar
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <div className="text-sm font-medium text-gray-900">{prod.quantity} {prod.products?.unit || 'unid'}</div>
                                          <div className="text-xs text-gray-500">{new Date(prod.production_date).toLocaleDateString('pt-BR')}</div>
                                          {prod.notes && <div className="text-xs text-gray-600 mt-1">{prod.notes}</div>}
                                        </div>
                                        <div className="flex gap-1">
                                          <button onClick={() => handleEditProduction(prod)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded">
                                            <Edit2 className="w-4 h-4" />
                                          </button>
                                          <button onClick={() => handleDeleteProduction(prod)} className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {(order.status === 'open' || order.status === 'in_progress') && (
                          <div className="p-5 pt-3 border-t border-gray-100 bg-gray-50 flex gap-2">
                            {order.remaining_quantity === 0 && (
                              <button
                                onClick={() => handleCompleteOrder(order.id)}
                                className="flex-1 bg-green-500 text-white px-4 py-2.5 rounded-lg hover:bg-green-600 flex items-center justify-center gap-2 font-semibold text-sm"
                              >
                                <CheckCircle className="w-4 h-4" />
                                Concluir Ordem
                              </button>
                            )}
                            <button
                              onClick={() => handleCancelOrder(order.id)}
                              className="flex-1 bg-red-500 text-white px-4 py-2.5 rounded-lg hover:bg-red-600 flex items-center justify-center gap-2 font-semibold text-sm"
                            >
                              <Trash2 className="w-4 h-4" />
                              Excluir Ordem
                            </button>
                          </div>
                        )}

                        {order.status === 'completed' && order.completed_at && (
                          <div className="px-5 pb-4 pt-2 border-t border-gray-100 text-sm text-green-600">
                            <CheckCircle className="w-4 h-4 inline mr-1" />
                            Concluida em {new Date(order.completed_at).toLocaleDateString('pt-BR')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
