import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Building2, Calendar, User, Package, QrCode, Layers, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

  const handleExportGroupPDF = async (group: QuoteGroup) => {
    try {
      const doc = new jsPDF();
      const companyName = companySettings.company_trade_name || companySettings.company_name || '';
      const pageWidth = doc.internal.pageSize.width;
      let y = 14;

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('RELATORIO DE PRODUCAO POR OBRA', 14, y);
      y += 7;
      if (companyName) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(companyName, 14, y);
        y += 5;
      }

      doc.setDrawColor(10, 126, 194);
      doc.setLineWidth(0.5);
      doc.line(14, y, pageWidth - 14, y);
      y += 7;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Cliente: ${group.customerName}`, 14, y);
      y += 6;
      if (group.deadline) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Prazo: ${new Date(group.deadline + 'T00:00:00').toLocaleDateString('pt-BR')}`, 14, y);
        y += 5;
      }
      doc.setFontSize(9);
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, y);
      y += 8;

      for (const order of group.orders) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`OP #${order.order_number} — ${getStatusLabel(order.status)}`, 14, y);
        y += 5;

        const progress = order.total_quantity === 0 ? 0 : Math.round((order.produced_quantity / order.total_quantity) * 100);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Progresso: ${order.produced_quantity}/${order.total_quantity} (${progress}%)`, 14, y);
        y += 4;
        if (order.deadline) {
          doc.text(`Prazo: ${new Date(order.deadline + 'T00:00:00').toLocaleDateString('pt-BR')}`, 14, y);
          y += 4;
        }

        if (order.production_order_items && order.production_order_items.length > 0) {
          const rows = order.production_order_items.map(item => {
            const name = item.products?.name || item.materials?.name || item.compositions?.name || 'N/A';
            const unit = item.products?.unit || item.materials?.unit || 'un';
            const itemProgress = item.quantity === 0 ? 0 : Math.round((item.produced_quantity / item.quantity) * 100);
            return [name, `${item.quantity} ${unit}`, `${item.produced_quantity} ${unit}`, `${itemProgress}%`];
          });

          autoTable(doc, {
            startY: y,
            head: [['Produto/Item', 'Qtd. Solicitada', 'Qtd. Produzida', 'Progresso']],
            body: rows,
            theme: 'grid',
            headStyles: { fillColor: [10, 126, 194], textColor: 255, fontSize: 8 },
            bodyStyles: { fontSize: 8 },
            margin: { left: 14, right: 14 },
          });
          y = (doc as any).lastAutoTable.finalY + 6;
        }

        if (y > 260) { doc.addPage(); y = 14; }
      }

      doc.save(`obra-${group.customerName.replace(/\s+/g, '-')}.pdf`);
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
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
                        <div className="ml-auto flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${orderProgress === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                              style={{ width: `${orderProgress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{orderProgress}%</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {(order.production_order_items || []).map((item) => {
                          const itemName = item.products?.name || item.materials?.name || item.compositions?.name || 'Item sem nome';
                          const itemUnit = item.products?.unit || item.materials?.unit || 'un';
                          const itemProgress = item.quantity === 0 ? 0 : Math.round((item.produced_quantity / item.quantity) * 100);

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
  );
}
