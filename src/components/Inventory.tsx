import { useState, useEffect } from 'react';
import { Package2, TrendingUp, Search, Edit2, Trash2, Eye, FileText, Download, Settings } from 'lucide-react';
import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface InventoryItem {
  product_id: string;
  product_name: string;
  description: string;
  unit: string;
  total_quantity: number;
  quantity_reserved: number;
  unit_price: number;
  is_resale?: boolean;
}

interface ProductionRecord {
  id: string;
  product_id: string;
  quantity: number;
  production_date: string;
  notes?: string;
  production_order_id?: string;
  order_number?: number;
}

interface MaterialMovementRecord {
  id: string;
  material_id: string;
  quantity: number;
  movement_type: string;
  movement_date: string;
  notes?: string;
}

interface UnifiedMovement {
  id: string;
  movement_date: string;
  quantity: number;
  movement_type: 'entrada' | 'saida' | 'reservado';
  notes?: string;
  customer_name?: string;
  delivery_id?: string;
  order_number?: number;
}

export default function Inventory() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [adjustType, setAdjustType] = useState<'add' | 'remove'>('add');
  const [productionRecords, setProductionRecords] = useState<ProductionRecord[]>([]);
  const [materialMovements, setMaterialMovements] = useState<MaterialMovementRecord[]>([]);
  const [unifiedMovements, setUnifiedMovements] = useState<UnifiedMovement[]>([]);
  const [editingRecord, setEditingRecord] = useState<ProductionRecord | MaterialMovementRecord | null>(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [reportFilters, setReportFilters] = useState({
    includeResale: true,
    includeProducts: true,
  });

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    try {
      const [productsRes, stockRes, resaleRes] = await Promise.all([
        supabase.from('products')
          .select('id,name,description,unit,sale_price,final_sale_price')
          .limit(500)
          .order('name'),
        supabase.from('product_stock_view')
          .select('product_id,available_stock,quantity_reserved')
          .limit(500),
        supabase.from('materials')
          .select('id,name,description,unit,resale_price')
          .eq('resale_enabled', true)
          .limit(500)
          .order('name'),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (stockRes.error) throw stockRes.error;
      if (resaleRes.error) throw resaleRes.error;

      const products = productsRes.data || [];
      const stockData = stockRes.data || [];
      const resaleMaterials = resaleRes.data || [];

      const stockMap = new Map<string, number>();
      const reservedMap = new Map<string, number>();
      stockData?.forEach((stock) => {
        stockMap.set(stock.product_id, parseFloat(stock.available_stock || 0));
        reservedMap.set(stock.product_id, parseFloat(stock.quantity_reserved || 0));
      });

      const inventoryData: InventoryItem[] = (products || [])
        .map((product) => ({
          product_id: product.id,
          product_name: product.name,
          description: product.description,
          unit: product.unit,
          total_quantity: stockMap.get(product.id) || 0,
          quantity_reserved: reservedMap.get(product.id) || 0,
          unit_price: parseFloat(product.final_sale_price || product.sale_price || 0),
          is_resale: false,
        }))
        .filter((item) => item.total_quantity !== 0 || item.quantity_reserved > 0);

      const resaleMaterialIds = (resaleMaterials || []).map(m => m.id);

      let materialMovements: any[] = [];
      if (resaleMaterialIds.length > 0) {
        const movementsRes = await supabase
          .from('material_movements')
          .select('material_id,quantity,movement_type')
          .in('material_id', resaleMaterialIds)
          .limit(50000);
        if (movementsRes.error) throw movementsRes.error;
        materialMovements = movementsRes.data || [];
      }

      const resaleInventoryMap = new Map<string, number>();
      materialMovements?.forEach((movement) => {
        const current = resaleInventoryMap.get(movement.material_id) || 0;
        const qty = parseFloat(movement.quantity.toString());
        if (movement.movement_type === 'entrada') {
          resaleInventoryMap.set(movement.material_id, current + qty);
        } else if (movement.movement_type === 'saida') {
          resaleInventoryMap.set(movement.material_id, current - qty);
        }
      });

      const resaleInventoryData: InventoryItem[] = (resaleMaterials || [])
        .map((material) => ({
          product_id: material.id,
          product_name: material.name,
          description: material.description || '',
          unit: material.unit,
          total_quantity: resaleInventoryMap.get(material.id) || 0,
          quantity_reserved: 0,
          unit_price: parseFloat(material.resale_price || 0),
          is_resale: true,
        }))
        .filter((item) => item.total_quantity > 0);

      setInventory([...inventoryData, ...resaleInventoryData]);
    } catch (error) {
      console.error('Erro ao carregar estoque:', error);
      alert('Erro ao carregar estoque');
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustStock = (item: InventoryItem) => {
    setAdjustItem(item);
    setAdjustQuantity('');
    setAdjustNotes('');
    setAdjustType('add');
    setShowAdjustModal(true);
  };

  const handleSaveAdjustment = async () => {
    if (!adjustItem || !adjustQuantity) {
      alert('Preencha a quantidade do ajuste');
      return;
    }

    const quantity = parseFloat(adjustQuantity);
    if (isNaN(quantity) || quantity <= 0) {
      alert('Quantidade inválida');
      return;
    }

    try {
      if (adjustItem.is_resale) {
        const { error } = await supabase
          .from('material_movements')
          .insert({
            material_id: adjustItem.product_id,
            quantity: quantity,
            movement_type: adjustType === 'add' ? 'entrada' : 'saida',
            movement_date: new Date().toISOString().split('T')[0],
            notes: adjustNotes || `Ajuste de estoque (${adjustType === 'add' ? 'entrada' : 'saída'})`
          });

        if (error) throw error;
      } else {
        if (adjustType === 'add') {
          const { error } = await supabase
            .from('production')
            .insert({
              product_id: adjustItem.product_id,
              quantity: quantity,
              production_date: new Date().toISOString().split('T')[0],
              production_type: 'adjustment',
              notes: adjustNotes || 'Ajuste de estoque (entrada)'
            });

          if (error) throw error;
        } else {
          const { data: delivery, error: deliveryError } = await supabase
            .from('deliveries')
            .insert({
              delivery_date: new Date().toISOString(),
              status: 'closed',
              notes: 'Ajuste manual de estoque (saída)'
            })
            .select()
            .single();

          if (deliveryError) throw deliveryError;

          if (delivery) {
            const { error: itemError } = await supabase
              .from('delivery_items')
              .insert({
                delivery_id: delivery.id,
                product_id: adjustItem.product_id,
                quantity: quantity,
                loaded_quantity: quantity,
                loaded_at: new Date().toISOString(),
                notes: adjustNotes || 'Ajuste manual de estoque (saída)'
              });

            if (itemError) throw itemError;
          }
        }
      }

      setShowAdjustModal(false);
      setAdjustItem(null);
      setAdjustQuantity('');
      setAdjustNotes('');
      await loadInventory();
      alert('Ajuste de estoque realizado com sucesso!');
    } catch (error) {
      console.error('Erro ao ajustar estoque:', error);
      alert('Erro ao ajustar estoque');
    }
  };

  const loadProductDetails = async (item: InventoryItem) => {
    try {
      if (item.is_resale) {
        const { data, error } = await supabase
          .from('material_movements')
          .select('*')
          .eq('material_id', item.product_id)
          .order('movement_date', { ascending: false });

        if (error) throw error;
        setMaterialMovements(data || []);
        setProductionRecords([]);
        setUnifiedMovements([]);
      } else {
        const [productionsResult, deliveriesResult, reservationsResult] = await Promise.all([
          supabase
            .from('production')
            .select(`
              *,
              production_orders (order_number)
            `)
            .eq('product_id', item.product_id)
            .eq('production_type', 'stock')
            .order('production_date', { ascending: false }),

          supabase
            .from('delivery_items')
            .select(`
              id,
              quantity,
              loaded_quantity,
              loaded_at,
              notes,
              deliveries (
                id,
                delivery_date,
                status,
                customer_id,
                customers (name),
                quotes (
                  customers (name)
                )
              )
            `)
            .eq('product_id', item.product_id)
            .gt('loaded_quantity', 0)
            .order('loaded_at', { ascending: false }),

          supabase
            .from('delivery_items')
            .select(`
              id,
              quantity,
              loaded_quantity,
              notes,
              deliveries (
                id,
                delivery_date,
                status,
                customer_id,
                customers (name),
                quotes (
                  customers (name)
                )
              )
            `)
            .eq('product_id', item.product_id)
            .in('deliveries.status', ['open', 'in_progress'])
            .eq('loaded_quantity', 0)
        ]);

        if (productionsResult.error) throw productionsResult.error;
        if (deliveriesResult.error) throw deliveriesResult.error;

        const productions = (productionsResult.data || []).map(p => {
          const orderNumber = p.production_orders?.order_number;
          const orderLabel = orderNumber ? `Ordem de Produção #${orderNumber}` : undefined;
          const notes = p.notes
            ? (orderLabel ? `${orderLabel} — ${p.notes}` : p.notes)
            : orderLabel;
          return {
            id: p.id,
            movement_date: p.production_date,
            quantity: p.quantity,
            movement_type: 'entrada' as const,
            notes,
            order_number: orderNumber
          };
        });

        const getCustomerName = (d: any) => {
          return d.deliveries?.customers?.name ||
            (d.deliveries?.quotes as any)?.customers?.name ||
            undefined;
        };

        const deliveries = (deliveriesResult.data || []).map(d => ({
          id: d.id,
          movement_date: d.loaded_at || d.deliveries?.delivery_date || '',
          quantity: d.loaded_quantity,
          movement_type: 'saida' as const,
          notes: d.notes || undefined,
          customer_name: getCustomerName(d),
          delivery_id: d.deliveries?.id
        }));

        const reservations = (reservationsResult.data || [])
          .filter(d => d.deliveries && ['open', 'in_progress'].includes(d.deliveries.status))
          .map(d => ({
            id: `res-${d.id}`,
            movement_date: d.deliveries?.delivery_date || '',
            quantity: d.quantity,
            movement_type: 'reservado' as const,
            notes: d.notes || undefined,
            customer_name: getCustomerName(d),
            delivery_id: d.deliveries?.id
          }));

        const allMovements = [...productions, ...deliveries, ...reservations].sort((a, b) => {
          return new Date(b.movement_date).getTime() - new Date(a.movement_date).getTime();
        });

        setUnifiedMovements(allMovements);
        setProductionRecords([]);
        setMaterialMovements([]);
      }

      setSelectedItem(item);
      setShowDetailsModal(true);
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
      alert('Erro ao carregar detalhes do produto');
    }
  };

  const handleEditRecord = (record: ProductionRecord | MaterialMovementRecord) => {
    setEditingRecord(record);
    setEditQuantity(record.quantity.toString());
  };

  const handleSaveEdit = async () => {
    if (!editingRecord || !editQuantity) return;

    try {
      const newQuantity = parseFloat(editQuantity);
      if (isNaN(newQuantity) || newQuantity <= 0) {
        alert('Quantidade inválida');
        return;
      }

      if ('movement_type' in editingRecord) {
        const { error } = await supabase
          .from('material_movements')
          .update({ quantity: newQuantity })
          .eq('id', editingRecord.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('production')
          .update({ quantity: newQuantity })
          .eq('id', editingRecord.id);

        if (error) throw error;
      }

      setEditingRecord(null);
      setEditQuantity('');
      if (selectedItem) {
        await loadProductDetails(selectedItem);
      }
      await loadInventory();
      alert('Quantidade atualizada com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar quantidade:', error);
      alert('Erro ao atualizar quantidade');
    }
  };

  const handleDeleteRecord = async (record: ProductionRecord | MaterialMovementRecord) => {
    if (!confirm('Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      if ('movement_type' in record) {
        const { error } = await supabase
          .from('material_movements')
          .delete()
          .eq('id', record.id);

        if (error) throw error;
      } else {
        if ('production_order_id' in record && record.production_order_id) {
          alert('Este registro está vinculado a uma ordem de produção e não pode ser excluído diretamente. Exclua ou edite a ordem de produção correspondente.');
          return;
        }

        const { error } = await supabase
          .from('production')
          .delete()
          .eq('id', record.id);

        if (error) {
          console.error('Erro detalhado:', error);
          throw error;
        }
      }

      if (selectedItem) {
        await loadProductDetails(selectedItem);
      }
      await loadInventory();
      alert('Registro excluído com sucesso!');
    } catch (error: any) {
      console.error('Erro ao excluir registro:', error);
      alert(`Erro ao excluir registro: ${error.message || 'Erro desconhecido'}`);
    }
  };

  const generateInventoryReport = async () => {
    try {
      const { data: companySettings } = await supabase
        .from('company_settings')
        .select('*')
        .single();

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      let logoImg: HTMLImageElement | null = null;
      if (companySettings?.logo_url) {
        try {
          logoImg = new Image();
          logoImg.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            logoImg!.onload = resolve;
            logoImg!.onerror = reject;
            logoImg!.src = companySettings.logo_url;
          });
        } catch (err) {
          console.warn('Erro ao carregar logo:', err);
          logoImg = null;
        }
      }

      if (logoImg) {
        const logoWidth = 40;
        const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
        doc.addImage(logoImg, 'PNG', 15, 10, logoWidth, logoHeight);
      }

      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Relatório de Estoque', pageWidth / 2, 20, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - 15, 15, { align: 'right' });

      if (companySettings?.company_name) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(companySettings.company_name, pageWidth / 2, 30, { align: 'center' });
      }

      let startY = companySettings?.company_name ? 40 : 35;

      if (reportFilters.includeResale) {
        const resaleItems = inventory.filter(item => item.is_resale);
        if (resaleItems.length > 0) {
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.text('Insumos/Revenda', 15, startY);
          startY += 5;

          const totalResale = resaleItems.reduce((sum, item) => sum + (item.total_quantity * item.unit_price), 0);

          autoTable(doc, {
            startY: startY,
            head: [['Produto', 'Descrição', 'Unidade', 'Quantidade', 'Preço Unit.', 'Valor Total']],
            body: [
              ...resaleItems.map(item => [
                item.product_name,
                item.description || '-',
                item.unit,
                item.total_quantity.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }),
                'R$ ' + item.unit_price.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }),
                'R$ ' + (item.total_quantity * item.unit_price).toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }),
              ]),
              ['', '', '', '', 'TOTAL:', 'R$ ' + totalResale.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })]
            ],
            theme: 'grid',
            headStyles: { fillColor: [16, 185, 129], textColor: 255 },
            styles: { fontSize: 9 },
            margin: { left: 15, right: 15 },
          });

          startY = (doc as any).lastAutoTable.finalY + 10;
        }
      }

      if (reportFilters.includeProducts) {
        const productItems = inventory.filter(item => !item.is_resale);
        if (productItems.length > 0) {
          if (startY > pageHeight - 40) {
            doc.addPage();
            startY = 20;
          }

          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.text('Produtos de Produção', 15, startY);
          startY += 5;

          const totalProducts = productItems.reduce((sum, item) => sum + (item.total_quantity * item.unit_price), 0);

          autoTable(doc, {
            startY: startY,
            head: [['Produto', 'Descrição', 'Unidade', 'Disponível', 'Reservado', 'Preço Unit.', 'Valor Total']],
            body: [
              ...productItems.map(item => [
                item.product_name,
                item.description || '-',
                item.unit,
                item.total_quantity.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }),
                item.quantity_reserved > 0 ? item.quantity_reserved.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }) : '-',
                'R$ ' + item.unit_price.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }),
                'R$ ' + (item.total_quantity * item.unit_price).toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }),
              ]),
              ['', '', '', '', '', 'TOTAL:', 'R$ ' + totalProducts.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })]
            ],
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246], textColor: 255 },
            styles: { fontSize: 9 },
            margin: { left: 15, right: 15 },
          });
        }
      }

      const fileName = `relatorio-estoque-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      alert('Relatório gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      alert('Erro ao gerar relatório');
    }
  };

  const filteredInventory = inventory.filter((item) =>
    item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalProducts = inventory.length;
  const productsWithStock = inventory.filter((item) => item.total_quantity > 0).length;
  const totalStockValue = inventory.reduce((sum, item) => sum + (item.total_quantity * item.unit_price), 0);

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
              <p className="text-sm text-gray-600">Total de Produtos Ativos</p>
              <p className="text-3xl font-bold text-gray-900">{totalProducts}</p>
            </div>
            <Package2 className="w-12 h-12 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Itens em Estoque</p>
              <p className="text-3xl font-bold text-green-600">{productsWithStock}</p>
            </div>
            <TrendingUp className="w-12 h-12 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Valor Total em Estoque</p>
              <p className="text-2xl font-bold text-blue-600">
                R$ {totalStockValue.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <Package2 className="w-12 h-12 text-blue-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Package2 className="w-6 h-6" />
            Estoque de Produtos
          </h2>

          <div className="flex gap-2">
            <button
              onClick={() => setShowReportModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <FileText className="w-5 h-5" />
              Gerar Relatório
            </button>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {filteredInventory.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchTerm
              ? 'Nenhum produto encontrado'
              : 'Nenhum produto em estoque'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Produto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descrição
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unidade
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Disponível
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-amber-600 uppercase tracking-wider">
                    Reservado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Preço Unit.
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInventory.map((item) => (
                  <tr key={item.product_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleAdjustStock(item)}
                          className="text-orange-600 hover:text-orange-900"
                          title="Ajustar estoque"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => loadProductDetails(item)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Ver detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {item.product_name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        {item.description || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.is_resale ? (
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-emerald-100 text-emerald-800">
                          Revenda
                        </span>
                      ) : (
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          Produção
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{item.unit}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className={`text-sm font-semibold ${item.total_quantity < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                        {item.total_quantity.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {item.quantity_reserved > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                          {item.quantity_reserved.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-900">
                        R$ {item.unit_price.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-bold text-green-600">
                        R$ {(item.total_quantity * item.unit_price).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdjustModal && adjustItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Ajustar Estoque</h3>
              <p className="text-sm text-gray-600 mt-1">
                {adjustItem.product_name}
              </p>
              <p className="text-sm font-semibold text-blue-600 mt-1">
                Estoque Atual: {adjustItem.total_quantity.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} {adjustItem.unit}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Ajuste
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={adjustType === 'add'}
                      onChange={() => setAdjustType('add')}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Adicionar ao Estoque</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={adjustType === 'remove'}
                      onChange={() => setAdjustType('remove')}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Remover do Estoque</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantidade
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observações
                </label>
                <textarea
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Motivo do ajuste (opcional)"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowAdjustModal(false);
                  setAdjustItem(null);
                  setAdjustQuantity('');
                  setAdjustNotes('');
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveAdjustment}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Salvar Ajuste
              </button>
            </div>
          </div>
        </div>
      )}

      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Gerar Relatório de Estoque</h3>
              <p className="text-sm text-gray-600 mt-1">
                Selecione os tipos de produtos que deseja incluir no relatório
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="includeResale"
                  checked={reportFilters.includeResale}
                  onChange={(e) =>
                    setReportFilters({ ...reportFilters, includeResale: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="includeResale" className="ml-3 text-sm font-medium text-gray-700">
                  Insumos/Revenda ({inventory.filter(item => item.is_resale).length} itens)
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="includeProducts"
                  checked={reportFilters.includeProducts}
                  onChange={(e) =>
                    setReportFilters({ ...reportFilters, includeProducts: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="includeProducts" className="ml-3 text-sm font-medium text-gray-700">
                  Produtos de Produção ({inventory.filter(item => !item.is_resale).length} itens)
                </label>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setShowReportModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setShowReportModal(false);
                  generateInventoryReport();
                }}
                disabled={!reportFilters.includeResale && !reportFilters.includeProducts}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Download className="w-5 h-5" />
                Gerar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailsModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Detalhes do Estoque: {selectedItem.product_name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedItem.is_resale ? 'Produto de Revenda' : 'Produto de Produção'}
                  </p>
                  <p className="text-lg font-semibold text-blue-600 mt-2">
                    Estoque Total: {selectedItem.total_quantity.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} {selectedItem.unit}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedItem(null);
                    setEditingRecord(null);
                    setEditQuantity('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="text-2xl">&times;</span>
                </button>
              </div>
            </div>

            <div className="p-6">
              {selectedItem.is_resale ? (
                <>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">
                    Movimentações de Estoque
                  </h4>
                  {materialMovements.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                      Nenhuma movimentação registrada
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Data
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Tipo
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                              Quantidade
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Observações
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                              Ações
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {materialMovements.map((movement) => (
                            <tr key={movement.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {new Date(movement.movement_date).toLocaleDateString('pt-BR')}
                              </td>
                              <td className="px-4 py-3">
                                {movement.movement_type === 'entrada' ? (
                                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                    Entrada
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                    Saída
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {editingRecord?.id === movement.id ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editQuantity}
                                    onChange={(e) => setEditQuantity(e.target.value)}
                                    className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                                  />
                                ) : (
                                  <span className="text-sm font-semibold text-gray-900">
                                    {movement.quantity.toLocaleString('pt-BR', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {movement.notes || '-'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  {editingRecord?.id === movement.id ? (
                                    <>
                                      <button
                                        onClick={handleSaveEdit}
                                        className="text-green-600 hover:text-green-900 text-xs font-medium"
                                      >
                                        Salvar
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditingRecord(null);
                                          setEditQuantity('');
                                        }}
                                        className="text-gray-600 hover:text-gray-900 text-xs font-medium"
                                      >
                                        Cancelar
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => handleEditRecord(movement)}
                                        className="text-blue-600 hover:text-blue-900"
                                        title="Editar quantidade"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteRecord(movement)}
                                        className="text-red-600 hover:text-red-900"
                                        title="Excluir registro"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">
                    Movimentação de Estoque (Entradas e Saídas)
                  </h4>

                  {unifiedMovements.length > 0 && (
                    <div className="grid grid-cols-4 gap-3 mb-6">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <TrendingUp className="w-4 h-4 text-green-600" />
                          <span className="text-xs font-medium text-green-900">Total Produzido</span>
                        </div>
                        <p className="text-xl font-bold text-green-700">
                          {unifiedMovements
                            .filter(m => m.movement_type === 'entrada')
                            .reduce((sum, m) => sum + m.quantity, 0)
                            .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>

                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Package2 className="w-4 h-4 text-red-600" />
                          <span className="text-xs font-medium text-red-900">Total Entregue</span>
                        </div>
                        <p className="text-xl font-bold text-red-700">
                          {unifiedMovements
                            .filter(m => m.movement_type === 'saida')
                            .reduce((sum, m) => sum + m.quantity, 0)
                            .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>

                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Package2 className="w-4 h-4 text-amber-600" />
                          <span className="text-xs font-medium text-amber-900">Reservado</span>
                        </div>
                        <p className="text-xl font-bold text-amber-700">
                          {unifiedMovements
                            .filter(m => m.movement_type === 'reservado')
                            .reduce((sum, m) => sum + m.quantity, 0)
                            .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Package2 className="w-4 h-4 text-blue-600" />
                          <span className="text-xs font-medium text-blue-900">Saldo Disponível</span>
                        </div>
                        <p className="text-xl font-bold text-blue-700">
                          {(
                            unifiedMovements
                              .filter(m => m.movement_type === 'entrada')
                              .reduce((sum, m) => sum + m.quantity, 0) -
                            unifiedMovements
                              .filter(m => m.movement_type === 'saida')
                              .reduce((sum, m) => sum + m.quantity, 0) -
                            unifiedMovements
                              .filter(m => m.movement_type === 'reservado')
                              .reduce((sum, m) => sum + m.quantity, 0)
                          ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  )}

                  {unifiedMovements.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                      Nenhuma movimentação registrada
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Data
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                              Tipo
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                              Quantidade
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Cliente/Observações
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {unifiedMovements.map((movement) => (
                            <tr key={movement.id} className={movement.movement_type === 'reservado' ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-gray-50'}>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {new Date(movement.movement_date).toLocaleDateString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                })}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {movement.movement_type === 'entrada' ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    <TrendingUp className="w-3 h-3 mr-1" />
                                    Produção
                                  </span>
                                ) : movement.movement_type === 'reservado' ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                    <Package2 className="w-3 h-3 mr-1" />
                                    Reservado
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    <Package2 className="w-3 h-3 mr-1" />
                                    Entregue
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className={`text-sm font-semibold ${
                                  movement.movement_type === 'entrada'
                                    ? 'text-green-700'
                                    : movement.movement_type === 'reservado'
                                    ? 'text-amber-700'
                                    : 'text-red-700'
                                }`}>
                                  {movement.movement_type === 'entrada' ? '+' : '-'}
                                  {movement.quantity.toLocaleString('pt-BR', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {movement.customer_name ? (
                                  <div>
                                    <span className="font-medium text-gray-900">{movement.customer_name}</span>
                                    {movement.notes && (
                                      <span className="block text-xs text-gray-500">{movement.notes}</span>
                                    )}
                                  </div>
                                ) : (
                                  <span>{movement.notes || '-'}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedItem(null);
                  setEditingRecord(null);
                  setEditQuantity('');
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
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
