import { useState, useEffect } from 'react';
import { Package, CheckCircle, XCircle, Clock, AlertCircle, Plus, X, QrCode, FileText, ChevronDown, ChevronUp, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ProductionLabel from './ProductionLabel';
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

export default function ProductionOrders() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showNewOrderForm, setShowNewOrderForm] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
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
  const [reportPeriod, setReportPeriod] = useState({
    startDate: '',
    endDate: '',
  });
  const [companySettings, setCompanySettings] = useState<Record<string, string>>({});
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [orderProductions, setOrderProductions] = useState<Record<string, ProductionRecord[]>>({});
  const [editingProduction, setEditingProduction] = useState<ProductionRecord | null>(null);
  const [editProductionForm, setEditProductionForm] = useState({
    quantity: '',
    production_date: '',
    notes: '',
  });

  useEffect(() => {
    loadOrders();
    loadProducts();
    loadCustomers();
    loadCompanySettings();
  }, []);

  const loadCompanySettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*');

      if (error) throw error;

      const settingsMap: Record<string, string> = {};
      data?.forEach((s: { setting_key: string; setting_value: string }) => {
        settingsMap[s.setting_key] = s.setting_value;
      });

      setCompanySettings(settingsMap);
    } catch (error) {
      console.error('Erro ao carregar configurações da empresa:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    }
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, person_type')
        .order('name');

      if (error) throw error;
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

      setOrderProductions(prev => ({
        ...prev,
        [orderId]: data || []
      }));
    } catch (error) {
      console.error('Erro ao carregar produções da ordem:', error);
      alert('Erro ao carregar produções da ordem');
    }
  };

  const toggleOrderExpanded = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
      if (!orderProductions[orderId]) {
        loadOrderProductions(orderId);
      }
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
    setEditProductionForm({
      quantity: '',
      production_date: '',
      notes: '',
    });
  };

  const handleUpdateProduction = async () => {
    if (!editingProduction) return;

    const quantity = parseFloat(editProductionForm.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      alert('Quantidade deve ser um número positivo');
      return;
    }

    try {
      const { error } = await supabase
        .from('production')
        .update({
          quantity: quantity,
          production_date: editProductionForm.production_date,
          notes: editProductionForm.notes || null,
        })
        .eq('id', editingProduction.id);

      if (error) throw error;

      await loadOrderProductions(editingProduction.production_order_id);
      await loadOrders();
      handleCancelEditProduction();
      alert('Produção atualizada com sucesso!');
    } catch (error: any) {
      console.error('Erro ao atualizar produção:', error);
      alert(`Erro ao atualizar produção: ${error.message}`);
    }
  };

  const handleDeleteProduction = async (production: ProductionRecord) => {
    if (!confirm(`Confirma a exclusão desta produção de ${production.quantity} unidades?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('production')
        .delete()
        .eq('id', production.id);

      if (error) throw error;

      await loadOrderProductions(production.production_order_id);
      await loadOrders();
      alert('Produção excluída com sucesso!');
    } catch (error: any) {
      console.error('Erro ao excluir produção:', error);
      alert(`Erro ao excluir produção: ${error.message}`);
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
            .select(`
              *,
              products(name, unit),
              materials(name, unit),
              compositions(name)
            `)
            .eq('production_order_id', order.id);

          return {
            ...order,
            production_order_items: items || [],
          };
        })
      );

      setOrders(ordersWithItems);
    } catch (error) {
      console.error('Erro ao carregar ordens de produção:', error);
      alert('Erro ao carregar ordens de produção');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLabelForItem = async (order: ProductionOrder, item: ProductionOrderItem) => {
    try {
      let recipeName = 'Traço não especificado';

      if (item.product_id) {
        const { data: productData } = await supabase
          .from('products')
          .select('recipe_id, name, unit, recipes(name)')
          .eq('id', item.product_id)
          .maybeSingle();

        if (productData?.recipes?.name) {
          recipeName = productData.recipes.name;
        }

        const qrToken = `${crypto.randomUUID()}-${Date.now()}`;

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

        setLabelData({
          productName: productData?.name || item.products?.name || '',
          quantity: item.quantity,
          unit: productData?.unit || item.products?.unit || 'un',
          productionDate: new Date().toISOString().split('T')[0],
          recipeName,
          orderNumber: order.order_number,
          customerName: order.customers?.name,
          qrToken,
        });
        setShowLabel(true);
      }
    } catch (error) {
      console.error('Erro ao gerar etiqueta do item:', error);
      alert('Erro ao gerar etiqueta do item');
    }
  };

  const handleGenerateLabel = async (order: ProductionOrder) => {
    try {
      let recipeName = 'Traço não especificado';

      if (order.products?.recipe_id) {
        const { data: recipeData } = await supabase
          .from('recipes')
          .select('name')
          .eq('id', order.products.recipe_id)
          .maybeSingle();

        if (recipeData) {
          recipeName = recipeData.name;
        }
      }

      const qrToken = `${crypto.randomUUID()}-${Date.now()}`;

      const { data: trackingData, error: trackingError } = await supabase
        .from('product_tracking')
        .insert([{
          qr_token: qrToken,
          production_id: null,
          production_order_id: order.id,
          product_id: order.product_id,
          recipe_name: recipeName,
          quantity: order.total_quantity,
          production_date: new Date().toISOString().split('T')[0],
        }])
        .select()
        .single();

      if (trackingError) throw trackingError;

      const { data: productData } = await supabase
        .from('products')
        .select('enable_stage_tracking')
        .eq('id', order.product_id)
        .maybeSingle();

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
            notes: stage.stage_key === 'quote_created'
              ? 'Etapa registrada automaticamente ao criar orçamento'
              : 'Etapa registrada automaticamente ao aprovar orçamento e criar ordem de produção',
          }));

          await supabase
            .from('production_tracking_stages')
            .insert(stageRecords);
        }
      }

      setLabelData({
        productName: order.products?.name || 'Produto',
        quantity: order.total_quantity,
        unit: order.products?.unit || 'un',
        productionDate: new Date().toISOString().split('T')[0],
        recipeName: recipeName,
        orderNumber: order.order_number,
        customerName: order.customers?.name,
        qrToken: qrToken,
      });
      setShowLabel(true);
    } catch (error) {
      console.error('Erro ao gerar etiqueta:', error);
      alert('Erro ao gerar etiqueta');
    }
  };

  const handleAddItemToOrder = () => {
    if (!currentItem.product_id || !currentItem.quantity) {
      alert('Selecione um produto e informe a quantidade');
      return;
    }

    const quantity = parseInt(currentItem.quantity);
    if (quantity <= 0) {
      alert('A quantidade deve ser maior que zero');
      return;
    }

    const product = products.find(p => p.id === currentItem.product_id);
    if (!product) {
      alert('Produto não encontrado');
      return;
    }

    if (newOrderItems.some(item => item.product_id === currentItem.product_id)) {
      alert('Este produto já foi adicionado. Remova-o primeiro se desejar alterar a quantidade.');
      return;
    }

    const newItem: NewOrderItem = {
      product_id: currentItem.product_id,
      product_name: product.name,
      quantity: quantity,
      notes: currentItem.notes || '',
    };

    setNewOrderItems([...newOrderItems, newItem]);
    setCurrentItem({
      product_id: '',
      quantity: '',
      notes: '',
    });
  };

  const handleRemoveItemFromOrder = (productId: string) => {
    setNewOrderItems(newOrderItems.filter(item => item.product_id !== productId));
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newOrderItems.length === 0) {
      alert('Adicione pelo menos um produto à ordem de produção');
      return;
    }

    try {
      const { data: maxOrderNumber } = await supabase
        .from('production_orders')
        .select('order_number')
        .order('order_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextOrderNumber = (maxOrderNumber?.order_number || 0) + 1;
      const totalQuantity = newOrderItems.reduce((sum, item) => sum + item.quantity, 0);

      const orderData = {
        order_number: nextOrderNumber,
        product_id: newOrderItems.length === 1 ? newOrderItems[0].product_id : null,
        customer_id: newOrder.customer_id || null,
        total_quantity: totalQuantity,
        produced_quantity: 0,
        remaining_quantity: totalQuantity,
        status: 'open',
        notes: newOrder.notes || `Ordem com ${newOrderItems.length} item(ns)`,
        deadline: newOrder.deadline || null,
      };

      const { data: insertedOrder, error: orderError } = await supabase
        .from('production_orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) throw orderError;

      const itemsToInsert = newOrderItems.map(item => ({
        production_order_id: insertedOrder.id,
        item_type: 'product',
        product_id: item.product_id,
        quantity: item.quantity,
        produced_quantity: 0,
        unit_price: 0,
        notes: item.notes,
      }));

      const { error: itemsError } = await supabase
        .from('production_order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      alert(`Ordem de produção ${nextOrderNumber} criada com sucesso!\n${newOrderItems.length} item(ns) adicionado(s).`);
      setShowNewOrderForm(false);
      setNewOrder({
        customer_id: '',
        notes: '',
        deadline: '',
      });
      setNewOrderItems([]);
      setCurrentItem({
        product_id: '',
        quantity: '',
        notes: '',
      });
      loadOrders();
    } catch (error: any) {
      console.error('Erro ao criar ordem:', error);
      alert('Erro ao criar ordem de produção: ' + error.message);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta ordem de produção? Esta ação não pode ser desfeita.')) return;

    try {
      const { error } = await supabase
        .from('production_orders')
        .delete()
        .eq('id', orderId);

      if (error) throw error;

      alert('Ordem de produção excluída com sucesso');
      loadOrders();
    } catch (error) {
      console.error('Erro ao excluir ordem:', error);
      alert('Erro ao excluir ordem');
    }
  };

  const handleCompleteOrder = async (orderId: string) => {
    if (!confirm('Marcar esta ordem como concluída?')) return;

    try {
      const { error } = await supabase
        .from('production_orders')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (error) throw error;

      alert('Ordem de produção concluída');
      loadOrders();
    } catch (error) {
      console.error('Erro ao concluir ordem:', error);
      alert('Erro ao concluir ordem');
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Aberta';
      case 'in_progress': return 'Em Produção';
      case 'completed': return 'Concluída';
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

  const getProgressPercentage = (order: ProductionOrder) => {
    if (order.total_quantity === 0) return 0;
    return (order.produced_quantity / order.total_quantity) * 100;
  };

  const handleGenerateReport = async () => {
    if (!reportPeriod.startDate || !reportPeriod.endDate) {
      alert('Por favor, selecione o período para o relatório');
      return;
    }

    const startDate = new Date(reportPeriod.startDate + 'T00:00:00');
    const endDate = new Date(reportPeriod.endDate + 'T23:59:59');

    const ordersInPeriod = orders.filter((order) => {
      if (order.status === 'completed' || order.status === 'cancelled') return false;
      if (!order.deadline) return false;

      const deadline = new Date(order.deadline + 'T00:00:00');
      return deadline >= startDate && deadline <= endDate;
    });

    ordersInPeriod.sort((a, b) => {
      const dateA = new Date(a.deadline + 'T00:00:00');
      const dateB = new Date(b.deadline + 'T00:00:00');
      return dateA.getTime() - dateB.getTime();
    });

    if (ordersInPeriod.length === 0) {
      alert('Nenhuma ordem de produção encontrada no período selecionado');
      return;
    }

    try {
      const doc = new jsPDF();
      let currentY = 14;

      const headerTitle = companySettings.report_header_title || 'RELATÓRIO DE PRODUÇÃO';
      const headerSubtitle = companySettings.report_header_subtitle || 'Sistema de Gestão';
      const footerText = companySettings.report_footer_text || 'Documento gerado automaticamente pelo sistema';
      const showCompanyInfo = companySettings.report_show_company_info === 'true';
      const showLogo = companySettings.report_show_logo === 'true';
      const companyName = companySettings.company_trade_name || companySettings.company_name || '';
      const logoUrl = companySettings.company_logo_url;

      const pageWidth = doc.internal.pageSize.width;
      const rightMargin = pageWidth - 14;
      const logoWidth = 40;
      const logoHeight = 20;
      let logoStartY = currentY;

      if (showLogo && logoUrl) {
        try {
          const response = await fetch(logoUrl);
          const blob = await response.blob();
          const reader = new FileReader();

          await new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          const logoData = reader.result as string;
          doc.addImage(logoData, 'PNG', rightMargin - logoWidth, logoStartY, logoWidth, logoHeight);
        } catch (error) {
          console.error('Erro ao carregar logo:', error);
        }
      }

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(headerTitle, 14, currentY, { maxWidth: pageWidth - logoWidth - 24 });
      currentY += 6;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(headerSubtitle, 14, currentY);
      currentY += 8;

      if (companyName) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(companyName, 14, currentY);
        currentY += 6;
      }

      if (showCompanyInfo) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');

        const companyInfo = [];
        const address = [
          companySettings.company_address_street,
          companySettings.company_address_number,
          companySettings.company_address_neighborhood,
          companySettings.company_address_city,
          companySettings.company_address_state
        ].filter(Boolean).join(', ');

        if (address) companyInfo.push(address);
        if (companySettings.company_phone) companyInfo.push(`Tel: ${companySettings.company_phone}`);
        if (companySettings.company_email) companyInfo.push(`Email: ${companySettings.company_email}`);

        companyInfo.forEach(info => {
          doc.text(info, 14, currentY, { maxWidth: pageWidth - logoWidth - 24 });
          currentY += 4;
        });
        currentY += 2;
      }

      if (showLogo && logoUrl && currentY < (logoStartY + logoHeight)) {
        currentY = logoStartY + logoHeight + 4;
      }

      doc.setDrawColor(10, 126, 194);
      doc.setLineWidth(0.5);
      doc.line(14, currentY, 196, currentY);
      currentY += 8;

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Ordens de Produção - Por Urgência', 14, currentY);
      currentY += 6;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Período: ${new Date(reportPeriod.startDate).toLocaleDateString('pt-BR')} a ${new Date(reportPeriod.endDate).toLocaleDateString('pt-BR')}`, 14, currentY);
      currentY += 5;
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, currentY);
      currentY += 8;

      const tableData = ordersInPeriod.map((order) => {
        const isOverdue = new Date(order.deadline + 'T00:00:00') < new Date() && order.status !== 'completed';
        const deadlineFormatted = new Date(order.deadline + 'T00:00:00').toLocaleDateString('pt-BR');

        return [
          `OP #${order.order_number}`,
          order.products?.name || 'N/A',
          order.customers?.name || 'Reposição de Estoque',
          `${order.remaining_quantity} ${order.products?.unit || 'un'}`,
          deadlineFormatted + (isOverdue ? ' ⚠️' : ''),
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
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 40 },
          2: { cellWidth: 40 },
          3: { cellWidth: 25 },
          4: { cellWidth: 30 },
          5: { cellWidth: 25 },
        },
        didParseCell: function(data) {
          if (data.row.index >= 0 && data.column.index === 4) {
            const cellValue = data.cell.text.join('');
            if (cellValue.includes('⚠️')) {
              data.cell.styles.textColor = [220, 38, 38];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
      });

      const totalRemaining = ordersInPeriod.reduce((sum, order) => sum + order.remaining_quantity, 0);
      const finalY = (doc as any).lastAutoTable.finalY || currentY;

      currentY = finalY + 10;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(`Total de ordens: ${ordersInPeriod.length}`, 14, currentY);
      currentY += 6;
      doc.text(`Total a produzir: ${totalRemaining} unidades`, 14, currentY);

      const overdueCount = ordersInPeriod.filter((order) =>
        new Date(order.deadline + 'T00:00:00') < new Date()
      ).length;

      if (overdueCount > 0) {
        currentY += 6;
        doc.setTextColor(220, 38, 38);
        doc.text(`⚠️ Ordens atrasadas: ${overdueCount}`, 14, currentY);
        doc.setTextColor(0, 0, 0);
      }

      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text(footerText, 14, pageHeight - 10, { maxWidth: pageWidth - 28 });

      doc.save(`relatorio-producao-${reportPeriod.startDate}-a-${reportPeriod.endDate}.pdf`);
      setShowReportModal(false);
      setReportPeriod({ startDate: '', endDate: '' });
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      alert('Erro ao gerar relatório. Verifique as configurações da empresa.');
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (filterStatus === 'all') return true;
    return order.status === filterStatus;
  });

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
          onClose={() => {
            setShowLabel(false);
            setLabelData(null);
          }}
        />
      )}

      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Relatório de Produção por Urgência
              </h3>
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportPeriod({ startDate: '', endDate: '' });
                }}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Selecione o período de prazos de entrega para gerar o relatório de produção ordenado por urgência.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Inicial do Prazo
                </label>
                <input
                  type="date"
                  value={reportPeriod.startDate}
                  onChange={(e) =>
                    setReportPeriod({ ...reportPeriod, startDate: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Final do Prazo
                </label>
                <input
                  type="date"
                  value={reportPeriod.endDate}
                  onChange={(e) =>
                    setReportPeriod({ ...reportPeriod, endDate: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Nota:</strong> O relatório incluirá apenas ordens abertas ou em produção com prazo no período selecionado, ordenadas da mais urgente para a menos urgente.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowReportModal(false);
                    setReportPeriod({ startDate: '', endDate: '' });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGenerateReport}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-semibold"
                >
                  <FileText className="w-5 h-5" />
                  Gerar Relatório
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Package className="w-6 h-6" />
              Ordens de Produção
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Gerencie as ordens de produção e acompanhe o progresso
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowReportModal(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              title="Gerar relatório de produção por urgência"
            >
              <FileText className="w-5 h-5" />
              Relatório
            </button>
            <button
              onClick={() => setShowNewOrderForm(!showNewOrderForm)}
              className="bg-[#0A7EC2] text-white px-4 py-2 rounded-lg hover:bg-[#0968A8] transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Nova Ordem
            </button>
            <div className="hidden md:block">
              <img
                src="/ordem_de_producao.jpg"
                alt="Ordens de Produção"
                className="w-32 h-32 object-contain"
              />
            </div>
          </div>
        </div>

        {showNewOrderForm && (
          <div className="mb-6 p-6 bg-blue-50 rounded-lg border-2 border-[#0A7EC2]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Nova Ordem de Produção
              </h3>
              <button
                onClick={() => {
                  setShowNewOrderForm(false);
                  setNewOrder({ customer_id: '', notes: '', deadline: '' });
                  setNewOrderItems([]);
                  setCurrentItem({ product_id: '', quantity: '', notes: '' });
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cliente (Opcional)
                  </label>
                  <select
                    value={newOrder.customer_id}
                    onChange={(e) =>
                      setNewOrder({ ...newOrder, customer_id: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                  >
                    <option value="">Reposição de Estoque</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} ({customer.person_type === 'pf' ? 'PF' : 'PJ'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prazo de Entrega
                  </label>
                  <input
                    type="date"
                    value={newOrder.deadline}
                    onChange={(e) =>
                      setNewOrder({ ...newOrder, deadline: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observações da Ordem
                  </label>
                  <input
                    type="text"
                    value={newOrder.notes}
                    onChange={(e) =>
                      setNewOrder({ ...newOrder, notes: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                    placeholder="Informações adicionais sobre a ordem"
                  />
                </div>
              </div>

              <div className="border-t-2 border-gray-300 pt-4">
                <h4 className="text-md font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Produtos da Ordem
                </h4>

                {newOrderItems.length > 0 && (
                  <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200">
                    <div className="space-y-2">
                      {newOrderItems.map((item, index) => (
                        <div key={item.product_id} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900">
                              {index + 1}. {item.product_name}
                            </div>
                            <div className="text-sm text-gray-600">
                              Quantidade: <span className="font-bold text-green-700">{item.quantity} unidades</span>
                              {item.notes && <span className="ml-2">- {item.notes}</span>}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveItemFromOrder(item.product_id)}
                            className="text-red-600 hover:text-red-800 p-2"
                            title="Remover item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-300">
                      <div className="text-sm font-bold text-gray-900">
                        Total: {newOrderItems.reduce((sum, item) => sum + item.quantity, 0)} unidades em {newOrderItems.length} produto(s)
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Produto
                    </label>
                    <select
                      value={currentItem.product_id}
                      onChange={(e) =>
                        setCurrentItem({ ...currentItem, product_id: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                    >
                      <option value="">Selecione um produto</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantidade
                    </label>
                    <input
                      type="number"
                      value={currentItem.quantity}
                      onChange={(e) =>
                        setCurrentItem({ ...currentItem, quantity: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                      placeholder="0"
                      min="1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Obs. do Item
                    </label>
                    <input
                      type="text"
                      value={currentItem.notes}
                      onChange={(e) =>
                        setCurrentItem({ ...currentItem, notes: e.target.value })
                      }
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
                  Adicionar Produto à Ordem
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
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={newOrderItems.length === 0}
                  className="bg-[#0A7EC2] text-white px-4 py-2 rounded-lg hover:bg-[#0968A8] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  <CheckCircle className="w-5 h-5" />
                  Criar Ordem de Produção
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filterStatus === 'all'
                ? 'bg-[#0A7EC2] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todas ({orders.length})
          </button>
          <button
            onClick={() => setFilterStatus('open')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filterStatus === 'open'
                ? 'bg-[#0A7EC2] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Abertas ({orders.filter((o) => o.status === 'open').length})
          </button>
          <button
            onClick={() => setFilterStatus('in_progress')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filterStatus === 'in_progress'
                ? 'bg-[#0A7EC2] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Em Produção ({orders.filter((o) => o.status === 'in_progress').length})
          </button>
          <button
            onClick={() => setFilterStatus('completed')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filterStatus === 'completed'
                ? 'bg-[#0A7EC2] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Concluídas ({orders.filter((o) => o.status === 'completed').length})
          </button>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p>Nenhuma ordem de produção encontrada</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredOrders.map((order) => {
              const progress = getProgressPercentage(order);
              return (
                <div
                  key={order.id}
                  className="border-2 border-gray-300 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {/* Cabeçalho com dados do cliente e informações principais */}
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="bg-white text-blue-700 font-bold px-3 py-1 rounded text-sm">
                            OP #{order.order_number}
                          </span>
                          <span
                            className={`px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1 ${getStatusColor(
                              order.status
                            )}`}
                          >
                            {getStatusIcon(order.status)}
                            {getStatusLabel(order.status)}
                          </span>
                        </div>
                        <h3 className="text-2xl font-bold mb-1">
                          {order.customers ? (
                            <>
                              {order.customers.name}
                              <span className="text-sm font-normal ml-2 opacity-90">
                                ({order.customers.person_type === 'pf' ? 'Pessoa Física' : 'Pessoa Jurídica'})
                              </span>
                            </>
                          ) : (
                            <span className="italic">Reposição de Estoque</span>
                          )}
                        </h3>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="opacity-80 mb-1">Criada em</div>
                        <div className="font-semibold">
                          {new Date(order.created_at).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                      {order.deadline && (
                        <div>
                          <div className="opacity-80 mb-1">Prazo de Entrega</div>
                          <div className={`font-semibold ${
                            new Date(order.deadline + 'T00:00:00') < new Date() && order.status !== 'completed'
                              ? 'text-red-200'
                              : 'text-white'
                          }`}>
                            {new Date(order.deadline + 'T00:00:00').toLocaleDateString('pt-BR')}
                            {new Date(order.deadline + 'T00:00:00') < new Date() && order.status !== 'completed' && (
                              <span className="ml-2 bg-red-500 text-white px-2 py-1 rounded text-xs">
                                ATRASADO
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      <div>
                        <div className="opacity-80 mb-1">Total de Itens</div>
                        <div className="font-semibold">
                          {order.production_order_items?.length || 1} {order.production_order_items?.length === 1 ? 'item' : 'itens'}
                        </div>
                      </div>
                    </div>

                    {order.notes && (
                      <div className="mt-3 pt-3 border-t border-blue-500 text-sm">
                        <span className="opacity-80">Observações:</span> {order.notes}
                      </div>
                    )}
                  </div>

                  {/* Lista de itens */}
                  <div className="p-6 bg-white">
                    {order.production_order_items && order.production_order_items.length > 0 ? (
                      order.production_order_items.map((item, index) => {
                        const itemProgress = item.quantity > 0 ? (item.produced_quantity / item.quantity) * 100 : 0;
                        return (
                          <div key={item.id} className="border-b border-gray-200 pb-4 mb-4 last:border-b-0 last:mb-0 last:pb-0">
                            {/* Nome e quantidade */}
                            <div className="mb-2">
                              <h4 className="text-lg font-bold text-gray-900 mb-1">
                                {item.products?.name || item.materials?.name || item.compositions?.name}
                              </h4>
                              <div className="text-sm text-gray-700">
                                <span className="font-semibold">{item.quantity} {item.products?.unit || item.materials?.unit || 'unidades'}</span>
                                {item.notes && <span className="ml-3 text-gray-600 italic">({item.notes})</span>}
                              </div>
                            </div>

                            {/* Barra de progresso */}
                            <div className="relative mb-3">
                              <div className="w-full bg-gray-300 rounded-full h-8 shadow-inner">
                                <div
                                  className={`h-8 rounded-full transition-all flex items-center justify-end pr-3 ${
                                    itemProgress === 100
                                      ? 'bg-gradient-to-r from-green-500 to-green-600'
                                      : itemProgress >= 50
                                      ? 'bg-gradient-to-r from-yellow-400 to-yellow-500'
                                      : 'bg-gradient-to-r from-blue-500 to-blue-600'
                                  }`}
                                  style={{ width: `${Math.min(itemProgress, 100)}%` }}
                                >
                                  {itemProgress > 10 && (
                                    <span className="text-white font-bold text-sm">
                                      {itemProgress.toFixed(0)}%
                                    </span>
                                  )}
                                </div>
                              </div>
                              {itemProgress <= 10 && itemProgress > 0 && (
                                <span className="absolute right-3 top-1 text-gray-700 font-bold text-sm">
                                  {itemProgress.toFixed(0)}%
                                </span>
                              )}
                            </div>

                            {/* Botões de ação */}
                            {(order.status === 'open' || order.status === 'in_progress') && item.product_id && (
                              <button
                                onClick={() => handleGenerateLabelForItem(order, item)}
                                className="bg-[#0A7EC2] text-white px-4 py-2 rounded hover:bg-[#0968A8] transition-colors flex items-center gap-2 text-sm"
                              >
                                <QrCode className="w-4 h-4" />
                                Gerar Etiqueta
                              </button>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="pb-4">
                        {/* Item único */}
                        <div className="mb-2">
                          <h4 className="text-lg font-bold text-gray-900 mb-1">
                            {order.products?.name || 'Produto'}
                          </h4>
                          <div className="text-sm text-gray-700">
                            <span className="font-semibold">{order.total_quantity} {order.products?.unit || 'unidades'}</span>
                          </div>
                        </div>

                        {/* Barra de progresso */}
                        <div className="relative mb-3">
                          <div className="w-full bg-gray-300 rounded-full h-8 shadow-inner">
                            <div
                              className={`h-8 rounded-full transition-all flex items-center justify-end pr-3 ${
                                progress === 100
                                  ? 'bg-gradient-to-r from-green-500 to-green-600'
                                  : progress >= 50
                                  ? 'bg-gradient-to-r from-yellow-400 to-yellow-500'
                                  : 'bg-gradient-to-r from-blue-500 to-blue-600'
                              }`}
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            >
                              {progress > 10 && (
                                <span className="text-white font-bold text-sm">
                                  {progress.toFixed(0)}%
                                </span>
                              )}
                            </div>
                          </div>
                          {progress <= 10 && progress > 0 && (
                            <span className="absolute right-3 top-1 text-gray-700 font-bold text-sm">
                              {progress.toFixed(0)}%
                            </span>
                          )}
                        </div>

                        {/* Botões de ação */}
                        {(order.status === 'open' || order.status === 'in_progress') && order.product_id && (
                          <button
                            onClick={() => handleGenerateLabelForItem(order, {
                              id: order.id,
                              production_order_id: order.id,
                              item_type: 'product',
                              product_id: order.product_id,
                              quantity: order.total_quantity,
                              produced_quantity: order.produced_quantity,
                              unit_price: 0,
                              products: order.products
                            } as any)}
                            className="bg-[#0A7EC2] text-white px-4 py-2 rounded hover:bg-[#0968A8] transition-colors flex items-center gap-2 text-sm"
                          >
                            <QrCode className="w-4 h-4" />
                            Gerar Etiqueta
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {order.produced_quantity > 0 && (
                    <div className="mb-4 border-t border-gray-200 pt-4">
                      <button
                        onClick={() => toggleOrderExpanded(order.id)}
                        className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-700 hover:text-[#0A7EC2] transition-colors"
                      >
                        <span>Produções Registradas ({order.produced_quantity} unidades)</span>
                        {expandedOrders.has(order.id) ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>

                      {expandedOrders.has(order.id) && (
                        <div className="mt-3 space-y-2">
                          {orderProductions[order.id]?.map((prod) => (
                            <div
                              key={prod.id}
                              className="bg-gray-50 border border-gray-200 rounded-lg p-3"
                            >
                              {editingProduction?.id === prod.id ? (
                                <div className="space-y-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Quantidade *
                                      </label>
                                      <input
                                        type="number"
                                        value={editProductionForm.quantity}
                                        onChange={(e) =>
                                          setEditProductionForm({
                                            ...editProductionForm,
                                            quantity: e.target.value,
                                          })
                                        }
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-[#0A7EC2]"
                                        min="1"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Data *
                                      </label>
                                      <input
                                        type="date"
                                        value={editProductionForm.production_date}
                                        onChange={(e) =>
                                          setEditProductionForm({
                                            ...editProductionForm,
                                            production_date: e.target.value,
                                          })
                                        }
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-[#0A7EC2]"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                      Observações
                                    </label>
                                    <input
                                      type="text"
                                      value={editProductionForm.notes}
                                      onChange={(e) =>
                                        setEditProductionForm({
                                          ...editProductionForm,
                                          notes: e.target.value,
                                        })
                                      }
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-[#0A7EC2]"
                                      placeholder="Observações"
                                    />
                                  </div>
                                  <div className="flex gap-2 pt-2">
                                    <button
                                      onClick={handleUpdateProduction}
                                      className="flex-1 bg-green-500 text-white px-3 py-1.5 rounded text-sm hover:bg-green-600 transition-colors flex items-center justify-center gap-1"
                                    >
                                      <CheckCircle className="w-3 h-3" />
                                      Salvar
                                    </button>
                                    <button
                                      onClick={handleCancelEditProduction}
                                      className="flex-1 bg-gray-300 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-400 transition-colors"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="text-sm font-medium text-gray-900">
                                      {prod.quantity} {prod.products?.unit || 'unid'}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {new Date(prod.production_date).toLocaleDateString('pt-BR')}
                                    </div>
                                    {prod.notes && (
                                      <div className="text-xs text-gray-600 mt-1">
                                        {prod.notes}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => handleEditProduction(prod)}
                                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                      title="Editar"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteProduction(prod)}
                                      className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                      title="Excluir"
                                    >
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
                    <div className="p-6 pt-4 border-t border-gray-200 bg-gray-50">
                      <div className="flex gap-2">
                        {order.remaining_quantity === 0 && (
                          <button
                            onClick={() => handleCompleteOrder(order.id)}
                            className="flex-1 bg-green-500 text-white px-4 py-3 rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2 font-semibold"
                          >
                            <CheckCircle className="w-5 h-5" />
                            Concluir Ordem
                          </button>
                        )}
                        <button
                          onClick={() => handleCancelOrder(order.id)}
                          className="flex-1 bg-red-500 text-white px-4 py-3 rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2 font-semibold"
                        >
                          <Trash2 className="w-5 h-5" />
                          Excluir Ordem
                        </button>
                      </div>
                    </div>
                  )}

                  {order.status === 'completed' && order.completed_at && (
                    <div className="pt-4 border-t border-gray-200">
                      <div className="text-sm text-green-600">
                        <CheckCircle className="w-4 h-4 inline mr-1" />
                        Concluída em{' '}
                        {new Date(order.completed_at).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
