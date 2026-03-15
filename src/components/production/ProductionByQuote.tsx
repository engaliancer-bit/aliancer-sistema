import { useState, useEffect, useCallback } from 'react';
import {
  ChevronDown, ChevronRight, Building2, Calendar, Package, QrCode, Layers,
  FileText, Plus, Trash2, RefreshCw, AlertCircle, Search, X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

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

interface QuoteGroup {
  quoteId: string | null;
  quoteNumber?: number;
  customerName: string;
  customerPersonType?: 'pf' | 'pj';
  deadline?: string | null;
  orders: ProductionOrder[];
}

interface ProductOption {
  id: string;
  name: string;
  unit: string;
}

interface Props {
  onSelectItem: (item: ProductionOrderItem, order: ProductionOrder) => void;
  onGenerateLabel: (order: ProductionOrder, item: ProductionOrderItem) => void;
  refreshKey: number;
}

export default function ProductionByQuote({ onSelectItem, onGenerateLabel, refreshKey }: Props) {
  const [groups, setGroups] = useState<QuoteGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [companySettings, setCompanySettings] = useState<Record<string, string>>({});

  const [syncingOrderId, setSyncingOrderId] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  const [addItemModal, setAddItemModal] = useState<{ order: ProductionOrder; group: QuoteGroup } | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [addQuantity, setAddQuantity] = useState(1);
  const [addingItem, setAddingItem] = useState(false);

  useEffect(() => {
    loadData();
    loadCompanySettings();
  }, [refreshKey]);

  const loadCompanySettings = async () => {
    const { data } = await supabase.from('company_settings').select('*');
    const map: Record<string, string> = {};
    data?.forEach((s: { setting_key: string; setting_value: string }) => {
      map[s.setting_key] = s.setting_value;
    });
    setCompanySettings(map);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: orders, error } = await supabase
        .from('production_orders')
        .select(`
          *,
          customers(name, person_type),
          products(name, unit)
        `)
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

      const groupMap = new Map<string, QuoteGroup>();

      for (const order of ordersWithItems) {
        const key = order.quote_id || '__avulsas__';
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            quoteId: order.quote_id || null,
            customerName: order.customers?.name || 'Reposicao de Estoque',
            customerPersonType: order.customers?.person_type,
            deadline: order.deadline,
            orders: [],
          });
        }
        const group = groupMap.get(key)!;
        if (order.deadline && (!group.deadline || order.deadline < group.deadline)) {
          group.deadline = order.deadline;
        }
        group.orders.push(order);
      }

      if (orders && orders.length > 0) {
        const quoteIds = [...new Set(orders.map(o => o.quote_id).filter(Boolean))];
        if (quoteIds.length > 0) {
          const { data: quotes } = await supabase
            .from('quotes')
            .select('id, customers(name, person_type), delivery_deadline')
            .in('id', quoteIds);

          quotes?.forEach((q: any) => {
            const group = groupMap.get(q.id);
            if (group) {
              group.customerName = q.customers?.name || group.customerName;
              group.customerPersonType = q.customers?.person_type;
              if (q.delivery_deadline) group.deadline = q.delivery_deadline;
            }
          });
        }
      }

      setGroups([...groupMap.values()]);
    } catch (err) {
      console.error('Erro ao carregar grupos:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const getGroupProgress = (group: QuoteGroup) => {
    const total = group.orders.reduce((s, o) => s + o.total_quantity, 0);
    const done = group.orders.reduce((s, o) => s + o.produced_quantity, 0);
    return total === 0 ? 0 : Math.round((done / total) * 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'in_progress': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'completed': return 'bg-green-100 text-green-700 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
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

  const handleSyncItems = async (order: ProductionOrder) => {
    if (!order.quote_id) {
      alert('Esta ordem nao esta vinculada a um orcamento.');
      return;
    }
    setSyncingOrderId(order.id);
    try {
      const { data: quoteItems } = await supabase
        .from('quote_items')
        .select('*, products(id, name, unit), materials(id, name, unit), compositions(id, name)')
        .eq('quote_id', order.quote_id)
        .in('item_type', ['product', 'material', 'composition']);

      if (!quoteItems || quoteItems.length === 0) {
        alert('Nenhum item encontrado no orcamento vinculado.');
        return;
      }

      const itemsToInsert = quoteItems.map((qi: any) => {
        const product = Array.isArray(qi.products) ? qi.products[0] : qi.products;
        const material = Array.isArray(qi.materials) ? qi.materials[0] : qi.materials;
        return {
          production_order_id: order.id,
          quote_item_id: qi.id,
          item_type: qi.item_type,
          product_id: qi.item_type === 'product' ? (product?.id || qi.product_id) : null,
          material_id: qi.item_type === 'material' ? (material?.id || qi.material_id) : null,
          composition_id: qi.item_type === 'composition' ? qi.composition_id : null,
          quantity: Number(qi.quantity),
          produced_quantity: 0,
          unit_price: Number(qi.proposed_price) || 0,
          notes: 'Sincronizado automaticamente do orcamento',
        };
      });

      const { error } = await supabase
        .from('production_order_items')
        .insert(itemsToInsert);

      if (error) throw error;

      const totalQty = itemsToInsert.reduce((s: number, i: any) => s + i.quantity, 0);
      await supabase
        .from('production_orders')
        .update({ total_quantity: totalQty, remaining_quantity: totalQty })
        .eq('id', order.id);

      await loadData();
    } catch (err: any) {
      console.error('Erro ao sincronizar itens:', err);
      alert('Erro ao sincronizar: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setSyncingOrderId(null);
    }
  };

  const handleDeleteItem = async (item: ProductionOrderItem, order: ProductionOrder) => {
    if (!confirm(`Remover "${item.products?.name || item.materials?.name || 'este item'}" da ordem OP #${order.order_number}?`)) return;
    setDeletingItemId(item.id);
    try {
      const { error } = await supabase
        .from('production_order_items')
        .delete()
        .eq('id', item.id);
      if (error) throw error;

      const newTotal = Math.max(0, order.total_quantity - item.quantity);
      const newRemaining = Math.max(0, (order.remaining_quantity || 0) - item.quantity + item.produced_quantity);
      await supabase
        .from('production_orders')
        .update({ total_quantity: newTotal, remaining_quantity: newRemaining })
        .eq('id', order.id);

      await loadData();
    } catch (err: any) {
      alert('Erro ao remover item: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setDeletingItemId(null);
    }
  };

  const handleOpenAddItem = (order: ProductionOrder, group: QuoteGroup) => {
    setAddItemModal({ order, group });
    setProductSearch('');
    setProductOptions([]);
    setSelectedProduct(null);
    setAddQuantity(1);
  };

  const searchProducts = useCallback(async (query: string) => {
    if (query.trim().length < 2) { setProductOptions([]); return; }
    const { data } = await supabase
      .from('products')
      .select('id, name, unit')
      .ilike('name', `%${query}%`)
      .limit(20);
    setProductOptions(data || []);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchProducts(productSearch), 300);
    return () => clearTimeout(timer);
  }, [productSearch, searchProducts]);

  const handleConfirmAddItem = async () => {
    if (!selectedProduct || !addItemModal) return;
    setAddingItem(true);
    try {
      const { error } = await supabase
        .from('production_order_items')
        .insert({
          production_order_id: addItemModal.order.id,
          item_type: 'product',
          product_id: selectedProduct.id,
          quantity: addQuantity,
          produced_quantity: 0,
          unit_price: 0,
          notes: 'Adicionado manualmente',
        });
      if (error) throw error;

      const newTotal = addItemModal.order.total_quantity + addQuantity;
      const newRemaining = (addItemModal.order.remaining_quantity || 0) + addQuantity;
      await supabase
        .from('production_orders')
        .update({ total_quantity: newTotal, remaining_quantity: newRemaining })
        .eq('id', addItemModal.order.id);

      setAddItemModal(null);
      await loadData();
    } catch (err: any) {
      alert('Erro ao adicionar item: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setAddingItem(false);
    }
  };

  const loadImageAsBase64 = (url: string): Promise<string | null> => {
    return new Promise((resolve) => {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(null); return; }
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(null);
        img.src = url;
      } catch {
        resolve(null);
      }
    });
  };

  const handleExportGroupPDF = async (group: QuoteGroup) => {
    try {
      const doc = new jsPDF();
      const companyName = companySettings.company_trade_name || companySettings.company_name || 'Aliancer Engenharia e Topografia';
      const companyAddress = companySettings.company_address || '';
      const companyPhone = companySettings.company_phone || '';
      const logoUrl = companySettings.logo_url || '';
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      let y = 14;

      const addPageIfNeeded = (neededSpace: number) => {
        if (y + neededSpace > pageHeight - 20) {
          doc.addPage();
          y = 14;
          return true;
        }
        return false;
      };

      let logoBase64: string | null = null;
      if (logoUrl) {
        logoBase64 = await loadImageAsBase64(logoUrl);
      }

      const drawPageHeader = () => {
        if (logoBase64) {
          doc.addImage(logoBase64, 'PNG', 14, y, 28, 12);
        }
        const textX = logoBase64 ? 46 : 14;
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(10, 126, 194);
        doc.text(companyName.toUpperCase(), textX, y + 5);
        if (companyAddress || companyPhone) {
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 100, 100);
          const contactLine = [companyAddress, companyPhone].filter(Boolean).join('  |  ');
          doc.text(contactLine, textX, y + 10);
        }
        y += 18;
        doc.setDrawColor(10, 126, 194);
        doc.setLineWidth(0.8);
        doc.line(14, y, pageWidth - 14, y);
        y += 4;
      };

      drawPageHeader();

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text('RELATORIO DE PRODUCAO POR OBRA', 14, y);
      y += 6;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text(`Cliente: ${group.customerName}`, 14, y);
      y += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      if (group.deadline) {
        doc.text(`Prazo de entrega: ${new Date(group.deadline + 'T00:00:00').toLocaleDateString('pt-BR')}`, 14, y);
        y += 4;
      }
      const totalProgress = getGroupProgress(group);
      const totalPecas = group.orders.reduce((s, o) => s + o.total_quantity, 0);
      const produzidas = group.orders.reduce((s, o) => s + o.produced_quantity, 0);
      doc.text(`Progresso geral: ${produzidas}/${totalPecas} (${totalProgress}%)   |   Total de ordens: ${group.orders.length}`, 14, y);
      y += 4;
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, y);
      y += 6;
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.3);
      doc.line(14, y, pageWidth - 14, y);
      y += 5;

      for (const order of group.orders) {
        addPageIfNeeded(45);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(10, 126, 194);
        doc.text(`OP #${order.order_number}  —  ${getStatusLabel(order.status)}`, 14, y);
        y += 5;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        const orderProg = order.total_quantity === 0 ? 0 : Math.round((order.produced_quantity / order.total_quantity) * 100);
        doc.text(`Progresso: ${order.produced_quantity}/${order.total_quantity} (${orderProg}%)`, 14, y);
        if (order.deadline) {
          doc.text(`Prazo: ${new Date(order.deadline + 'T00:00:00').toLocaleDateString('pt-BR')}`, 100, y);
        }
        y += 5;

        if (!order.production_order_items || order.production_order_items.length === 0) {
          doc.setFontSize(8);
          doc.setTextColor(180, 60, 60);
          doc.text('Ordem sem itens registrados.', 14, y);
          y += 8;
          continue;
        }

        for (const item of order.production_order_items) {
          addPageIfNeeded(50);

          const iname = item.products?.name || item.materials?.name || item.compositions?.name || 'Item';
          const iunit = item.products?.unit || item.materials?.unit || 'un';
          const itemProg = item.quantity === 0 ? 0 : Math.round((item.produced_quantity / item.quantity) * 100);

          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(30, 30, 30);
          doc.text(`Produto: ${iname}`, 18, y);
          y += 4;

          if (item.product_id) {
            const [productData, moldData, reinforcementsData] = await Promise.all([
              supabase.from('products')
                .select('*, reference_volume, recipes(id, name, concrete_type, specific_weight)')
                .eq('id', item.product_id)
                .maybeSingle()
                .then(r => r.data),
              supabase.from('molds')
                .select('section_width_meters, section_height_meters, reference_measurement_meters, reference_volume_m3')
                .eq('product_id', item.product_id)
                .maybeSingle()
                .then(r => r.data),
              supabase.from('product_reinforcements')
                .select('*, materials(name, unit)')
                .eq('product_id', item.product_id)
                .order('reinforcement_type')
                .then(r => r.data),
            ]);

            let recipeItems: any[] = [];
            if (productData?.recipes?.id) {
              const ri = await supabase.from('recipe_items')
                .select('*, materials(name, unit)')
                .eq('recipe_id', productData.recipes.id);
              recipeItems = ri.data || [];
            }

            const unitVol = moldData?.reference_volume_m3 || productData?.reference_volume || null;
            const totalVol = unitVol ? unitVol * item.quantity : null;

            const dimParts: string[] = [];
            if (moldData?.section_width_meters) dimParts.push(`Larg: ${(moldData.section_width_meters * 100).toFixed(0)} cm`);
            if (moldData?.section_height_meters) dimParts.push(`Alt: ${(moldData.section_height_meters * 100).toFixed(0)} cm`);
            if (moldData?.reference_measurement_meters) dimParts.push(`Comp: ${moldData.reference_measurement_meters.toFixed(2)} m`);
            if (productData?.total_weight) dimParts.push(`Peso unit.: ${productData.total_weight.toFixed(1)} kg`);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(80, 80, 80);
            if (dimParts.length > 0) {
              doc.text(dimParts.join('  |  '), 18, y);
              y += 4;
            }

            autoTable(doc, {
              startY: y,
              head: [['Qtd. Solicitada', 'Qtd. Produzida', 'Progresso', 'Volume Total Concreto']],
              body: [[
                `${item.quantity} ${iunit}`,
                `${item.produced_quantity} ${iunit}`,
                `${itemProg}%`,
                totalVol ? `${totalVol.toFixed(3)} m³` : 'Nao cadastrado',
              ]],
              theme: 'grid',
              headStyles: { fillColor: [240, 247, 255], textColor: [10, 126, 194], fontSize: 7, fontStyle: 'bold' },
              bodyStyles: { fontSize: 8 },
              margin: { left: 18, right: 14 },
            });
            y = (doc as any).lastAutoTable.finalY + 4;

            if (productData?.recipes && recipeItems.length > 0) {
              addPageIfNeeded(30);
              doc.setFontSize(8);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(30, 30, 30);
              const concreteTypeLabel = productData.recipes.concrete_type === 'dry' ? 'Concreto Seco (TCS)' : 'Concreto Plastico (TCP)';
              doc.text(`Traco: ${productData.recipes.name} — ${concreteTypeLabel}`, 18, y);
              y += 4;

              const recipeRows = recipeItems.map((ri: any) => {
                const totalQty = totalVol ? (ri.quantity * totalVol).toFixed(3) : '—';
                return [ri.materials?.name || '—', ri.quantity.toFixed(3), ri.materials?.unit || '—', totalQty];
              });
              autoTable(doc, {
                startY: y,
                head: [['Material', 'Qtd./m³', 'Unidade', `Qtd. Total (${item.quantity} pcs)`]],
                body: recipeRows,
                theme: 'grid',
                headStyles: { fillColor: [230, 245, 255], textColor: [10, 80, 140], fontSize: 7, fontStyle: 'bold' },
                bodyStyles: { fontSize: 8 },
                margin: { left: 18, right: 14 },
              });
              y = (doc as any).lastAutoTable.finalY + 4;
            }

            if (reinforcementsData && reinforcementsData.length > 0) {
              addPageIfNeeded(30);
              doc.setFontSize(8);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(30, 30, 30);
              doc.text('Ferragem:', 18, y);
              y += 4;

              const renfRows = reinforcementsData.map((r: any) => {
                const totalBar = r.total_length_meters || r.bar_count * r.bar_length_meters;
                return [
                  r.materials?.name || r.description || '—',
                  r.bar_diameter_mm > 0 ? `${r.bar_diameter_mm} mm` : '—',
                  String(r.bar_count),
                  `${r.bar_length_meters.toFixed(2)} m`,
                  `${totalBar.toFixed(2)} m`,
                  `${(totalBar * item.quantity).toFixed(2)} m`,
                ];
              });
              autoTable(doc, {
                startY: y,
                head: [['Aco / Material', 'Diam.', 'Barras', 'Comp./Barra', 'Total/peca', `Total (${item.quantity} pcs)`]],
                body: renfRows,
                theme: 'grid',
                headStyles: { fillColor: [255, 247, 230], textColor: [140, 80, 10], fontSize: 7, fontStyle: 'bold' },
                bodyStyles: { fontSize: 8 },
                margin: { left: 18, right: 14 },
              });
              y = (doc as any).lastAutoTable.finalY + 4;
            }

            try {
              const qrDataUrl = await QRCode.toDataURL(`prod-item-${item.id}`, { width: 80, margin: 1 });
              const qrY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY - 18 : y;
              if (qrY > 14 && qrY < pageHeight - 30) {
                doc.addImage(qrDataUrl, 'PNG', pageWidth - 36, qrY, 20, 20);
              }
            } catch {}

          } else {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(80, 80, 80);
            doc.text(`Qtd: ${item.quantity} ${iunit}  |  Produzido: ${item.produced_quantity} ${iunit}  |  ${itemProg}%`, 18, y);
            y += 5;
          }

          doc.setDrawColor(220, 220, 220);
          doc.setLineWidth(0.2);
          doc.line(18, y, pageWidth - 14, y);
          y += 4;
        }

        y += 3;
        if (y > pageHeight - 30) { doc.addPage(); y = 14; drawPageHeader(); }
      }

      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(160, 160, 160);
        doc.text(`Pagina ${i} de ${totalPages}`, pageWidth - 32, pageHeight - 8);
        doc.text(companyName, 14, pageHeight - 8);
      }

      doc.save(`producao-${group.customerName.replace(/\s+/g, '-')}.pdf`);
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
      alert('Erro ao gerar relatorio.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-gray-400 text-sm">Carregando...</div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <Layers className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p>Nenhuma ordem de producao encontrada</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {groups.map((group) => {
          const key = group.quoteId || '__avulsas__';
          const expanded = expandedGroups.has(key);
          const progress = getGroupProgress(group);
          const totalPecas = group.orders.reduce((s, o) => s + o.total_quantity, 0);
          const produzidas = group.orders.reduce((s, o) => s + o.produced_quantity, 0);
          const isOverdue = group.deadline && new Date(group.deadline + 'T00:00:00') < new Date() && progress < 100;
          const allDone = group.orders.every(o => o.status === 'completed');

          return (
            <div
              key={key}
              className={`border-2 rounded-xl overflow-hidden transition-all duration-200 ${
                allDone ? 'border-green-200' : isOverdue ? 'border-red-200' : 'border-gray-200'
              }`}
            >
              <button
                onClick={() => toggleGroup(key)}
                className={`w-full text-left p-5 flex items-center gap-4 transition-colors ${
                  allDone ? 'bg-green-50 hover:bg-green-100' : isOverdue ? 'bg-red-50 hover:bg-red-100' : 'bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex-shrink-0 text-gray-400">
                  {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </div>

                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  allDone ? 'bg-green-100' : 'bg-blue-100'
                }`}>
                  <Building2 className={`w-5 h-5 ${allDone ? 'text-green-600' : 'text-blue-600'}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-bold text-gray-900 text-base">{group.customerName}</span>
                    {group.customerPersonType && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {group.customerPersonType === 'pf' ? 'Pessoa Fisica' : 'Pessoa Juridica'}
                      </span>
                    )}
                    {group.quoteId === null && (
                      <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">Avulsa</span>
                    )}
                    {isOverdue && (
                      <span className="text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded-full font-semibold">Atrasado</span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-2 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      {group.orders.length} ordem(ns) — {totalPecas} peca(s)
                    </span>
                    {group.deadline && (
                      <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-semibold' : ''}`}>
                        <Calendar className="w-3 h-3" />
                        Prazo: {new Date(group.deadline + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          allDone ? 'bg-green-500' : progress > 60 ? 'bg-blue-500' : progress > 30 ? 'bg-amber-500' : 'bg-red-400'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold whitespace-nowrap ${allDone ? 'text-green-600' : 'text-gray-600'}`}>
                      {produzidas}/{totalPecas} ({progress}%)
                    </span>
                  </div>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); handleExportGroupPDF(group); }}
                  className="flex-shrink-0 flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 bg-gray-100 hover:bg-blue-50 px-3 py-2 rounded-lg border border-gray-200 hover:border-blue-200 transition-colors"
                  title="Exportar relatorio da obra"
                >
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">Exportar</span>
                </button>
              </button>

              {expanded && (
                <div className="border-t border-gray-100 divide-y divide-gray-100">
                  {group.orders.map((order) => {
                    const orderProgress = order.total_quantity === 0 ? 0 : Math.round((order.produced_quantity / order.total_quantity) * 100);
                    const hasNoItems = !order.production_order_items || order.production_order_items.length === 0;
                    const isSyncing = syncingOrderId === order.id;

                    return (
                      <div key={order.id} className="bg-gray-50 px-5 py-4">
                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                          <span className="font-bold text-sm text-gray-800">OP #{order.order_number}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getStatusColor(order.status)}`}>
                            {getStatusLabel(order.status)}
                          </span>
                          {order.deadline && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(order.deadline + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </span>
                          )}
                          <div className="ml-auto flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => handleOpenAddItem(order, group)}
                              className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 bg-green-50 hover:bg-green-100 px-2 py-1.5 rounded-lg border border-green-200 transition-colors"
                              title="Adicionar item manualmente"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Adicionar
                            </button>
                            {order.quote_id && (
                              <button
                                onClick={() => handleSyncItems(order)}
                                disabled={isSyncing}
                                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1.5 rounded-lg border border-blue-200 transition-colors disabled:opacity-50"
                                title="Sincronizar itens do orcamento automaticamente"
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                                Sincronizar
                              </button>
                            )}
                            <div className="w-20 bg-gray-200 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${orderProgress === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                                style={{ width: `${orderProgress}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">{orderProgress}%</span>
                          </div>
                        </div>

                        {hasNoItems && !isSyncing && (
                          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
                            <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 text-xs text-amber-700">
                              <div className="font-semibold mb-1">Ordem sem itens registrados</div>
                              <div>
                                {order.quote_id
                                  ? 'Clique em "Sincronizar" para carregar automaticamente os itens do orcamento, ou use "Adicionar" para incluir manualmente.'
                                  : 'Use "Adicionar" para incluir os itens manualmente.'}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          {(order.production_order_items || []).map((item) => {
                            const itemName = item.products?.name || item.materials?.name || item.compositions?.name || 'Item sem nome';
                            const itemUnit = item.products?.unit || item.materials?.unit || 'un';
                            const itemProgress = item.quantity === 0 ? 0 : Math.round((item.produced_quantity / item.quantity) * 100);
                            const isDeleting = deletingItemId === item.id;

                            return (
                              <div
                                key={item.id}
                                className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3 hover:border-blue-300 hover:shadow-sm transition-all"
                              >
                                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <Package className="w-4 h-4 text-blue-500" />
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-gray-800 text-sm truncate">{itemName}</div>
                                  <div className="text-xs text-gray-500">
                                    {item.produced_quantity}/{item.quantity} {itemUnit}
                                    <span className="ml-2 text-gray-400">({itemProgress}%)</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <button
                                    onClick={() => onSelectItem(item, order)}
                                    className="text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1.5 rounded-lg border border-blue-200 transition-colors flex items-center gap-1"
                                  >
                                    <Layers className="w-3.5 h-3.5" />
                                    Detalhe
                                  </button>
                                  {item.item_type === 'product' && item.product_id && (
                                    <button
                                      onClick={() => onGenerateLabel(order, item)}
                                      className="text-xs text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 px-2 py-1.5 rounded-lg border border-gray-200 transition-colors flex items-center gap-1"
                                    >
                                      <QrCode className="w-3.5 h-3.5" />
                                      QR
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteItem(item, order)}
                                    disabled={isDeleting}
                                    className="text-xs text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 p-1.5 rounded-lg border border-red-200 transition-colors disabled:opacity-50"
                                    title="Remover item da ordem"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {order.notes && (
                          <div className="mt-2 text-xs text-gray-400 italic truncate">
                            {order.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {addItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">Adicionar Item</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  OP #{addItemModal.order.order_number} — {addItemModal.group.customerName}
                </p>
              </div>
              <button onClick={() => setAddItemModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Buscar Produto</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={e => { setProductSearch(e.target.value); setSelectedProduct(null); }}
                    placeholder="Digite o nome do produto..."
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                {productOptions.length > 0 && !selectedProduct && (
                  <div className="mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {productOptions.map(p => (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedProduct(p); setProductSearch(p.name); setProductOptions([]); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-100 last:border-0"
                      >
                        <span className="font-medium text-gray-800">{p.name}</span>
                        <span className="ml-2 text-xs text-gray-400">{p.unit}</span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedProduct && (
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                    <Package className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="flex-1">{selectedProduct.name}</span>
                    <button
                      onClick={() => { setSelectedProduct(null); setProductSearch(''); }}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Quantidade</label>
                <input
                  type="number"
                  min={1}
                  value={addQuantity}
                  onChange={e => setAddQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button
                onClick={() => setAddItemModal(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmAddItem}
                disabled={!selectedProduct || addingItem}
                className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {addingItem
                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                  : <Plus className="w-4 h-4" />
                }
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
