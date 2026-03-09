import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { Plus, Edit2, Trash2, Package, Search, FileDown, Settings, X, ShoppingCart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import InvoicePurchaseModal, { type InvoicePurchaseData } from './InvoicePurchaseModal';
import { useAdvancedDebounce } from '../hooks/useAdvancedDebounceThrottle';
import { registerRequest, unregisterRequest, createRequestKey } from '../lib/requestCancellation';
import VirtualizedListAdvanced, { useVirtualizedHeight } from './VirtualizedListAdvanced';

const STOCK_ITEM_HEIGHT = 56;
const MOVEMENT_ITEM_HEIGHT = 60;
const MOVEMENTS_PAGE_SIZE = 50;
const MAX_LIST_HEIGHT = 560;

interface Material {
  id: string;
  name: string;
  unit: string;
  supplier_id?: string;
  unit_cost?: number;
  suppliers?: { name: string };
}

interface MaterialMovement {
  id: string;
  material_id: string;
  quantity: number;
  movement_type: 'entrada' | 'saida';
  notes: string;
  movement_date?: string;
  created_at: string;
  materials?: { name: string };
}

interface MaterialInventoryItem {
  material_id: string;
  material_name: string;
  unit: string;
  total_quantity: number;
  supplier_name?: string;
  unit_cost: number;
  total_value: number;
}

interface Supplier {
  id: string;
  name: string;
}

// ─── Memoized stock row ───────────────────────────────────────────────────────
interface StockRowProps {
  item: MaterialInventoryItem;
  style: React.CSSProperties;
  onPurchase: (item: MaterialInventoryItem) => void;
  onAdjust: (item: MaterialInventoryItem) => void;
}

const StockRow = memo(function StockRow({ item, style, onPurchase, onAdjust }: StockRowProps) {
  return (
    <div style={style} className="flex items-center border-b border-gray-100 hover:bg-gray-50 bg-white px-4 text-sm">
      <div className="flex-1 min-w-0 font-medium text-gray-900 truncate pr-2">{item.material_name}</div>
      <div className="w-32 text-gray-600 hidden md:block truncate">{item.supplier_name}</div>
      <div className="w-14 text-gray-600 text-center">{item.unit}</div>
      <div className="w-28 text-right font-semibold text-gray-900">
        {item.total_quantity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <div className="w-28 text-right text-gray-900 hidden md:block">
        R$ {item.unit_cost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <div className="w-28 text-right font-semibold text-blue-600 hidden md:block">
        R$ {item.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <div className="w-20 text-center">
        <span className={`px-2 py-0.5 inline-flex text-xs font-semibold rounded-full ${
          item.total_quantity > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {item.total_quantity > 0 ? 'Disp.' : 'Esgot.'}
        </span>
      </div>
      <div className="w-36 flex gap-1 justify-center">
        <button
          onClick={() => onPurchase(item)}
          className="inline-flex items-center gap-1 px-2 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors"
        >
          <ShoppingCart className="w-3 h-3" />
          Comprar
        </button>
        <button
          onClick={() => onAdjust(item)}
          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
        >
          <Settings className="w-3 h-3" />
          Ajust.
        </button>
      </div>
    </div>
  );
});

// ─── Memoized movement row ────────────────────────────────────────────────────
interface MovementRowProps {
  movement: MaterialMovement;
  style: React.CSSProperties;
  onEdit: (m: MaterialMovement) => void;
  onDelete: (id: string) => void;
}

const MovementRow = memo(function MovementRow({ movement, style, onEdit, onDelete }: MovementRowProps) {
  return (
    <div style={style} className="flex items-center border-b border-gray-100 hover:bg-gray-50 bg-white px-4 text-sm">
      <div className="flex-1 font-medium text-gray-900 truncate pr-2">{movement.materials?.name}</div>
      <div className="w-24">
        <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
          movement.movement_type === 'entrada' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
        }`}>
          {movement.movement_type === 'entrada' ? 'Entrada' : 'Saída'}
        </span>
      </div>
      <div className="w-28 text-right text-gray-900">
        {parseFloat(movement.quantity.toString()).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      </div>
      <div className="flex-1 text-gray-600 truncate px-2">{movement.notes || '—'}</div>
      <div className="w-28 text-gray-600">
        {movement.movement_date
          ? new Date(movement.movement_date + 'T00:00:00').toLocaleDateString('pt-BR')
          : new Date(movement.created_at).toLocaleDateString('pt-BR')}
      </div>
      <div className="w-16 flex gap-2 justify-end">
        <button onClick={() => onEdit(movement)} className="text-green-600 hover:text-green-900">
          <Edit2 className="w-4 h-4" />
        </button>
        <button onClick={() => onDelete(movement.id)} className="text-red-600 hover:text-red-900">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

export default function MaterialInventory() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [inventory, setInventory] = useState<MaterialInventoryItem[]>([]);
  const [movements, setMovements] = useState<MaterialMovement[]>([]);
  const [hasMoreMovements, setHasMoreMovements] = useState(true);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'stock' | 'history'>('stock');

  const [formData, setFormData] = useState({
    material_id: '',
    quantity: '',
    movement_type: 'entrada' as 'entrada' | 'saida',
    notes: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustingMaterial, setAdjustingMaterial] = useState<MaterialInventoryItem | null>(null);
  const [adjustmentData, setAdjustmentData] = useState({ newQuantity: '', reason: '' });
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseInitialMaterial, setPurchaseInitialMaterial] = useState<{
    id: string; name: string; unit: string; unit_cost: number; supplier_id?: string | null;
  } | undefined>(undefined);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const movementsOffsetRef = useRef(0);
  const isLoadingMoreRef = useRef(false);

  const debouncedSearch = useAdvancedDebounce(searchTerm, { delay: 300, maxWait: 700 });

  useEffect(() => {
    loadData();
    loadCompanySettings();
    loadSuppliers();
  }, []);

  const loadCompanySettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('setting_key, setting_value')
        .limit(20);
      if (error) throw error;
      if (data && data.length > 0) {
        const settings: any = {};
        data.forEach((s: any) => { settings[s.setting_key] = s.setting_value; });
        setCompanySettings(settings);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

  const loadSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .order('name');
      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Erro ao carregar fornecedores:', error);
    }
  };

  const loadData = async () => {
    try {
      const [materialsRes] = await Promise.all([
        supabase
          .from('materials')
          .select('id, name, unit, supplier_id, unit_cost, suppliers(name)')
          .order('name'),
      ]);

      if (materialsRes.error) throw materialsRes.error;
      setMaterials(materialsRes.data || []);

      // Load movements first page
      movementsOffsetRef.current = 0;
      const movsRes = await supabase
        .from('material_movements')
        .select('id, material_id, quantity, movement_type, notes, movement_date, created_at, materials(name)')
        .order('created_at', { ascending: false })
        .range(0, MOVEMENTS_PAGE_SIZE - 1);

      if (!movsRes.error) {
        setMovements(movsRes.data || []);
        setHasMoreMovements((movsRes.data || []).length === MOVEMENTS_PAGE_SIZE);
        movementsOffsetRef.current = MOVEMENTS_PAGE_SIZE;
        calculateInventory(materialsRes.data || [], movsRes.data || []);
      } else {
        calculateInventory(materialsRes.data || [], []);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      alert('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const loadMoreMovements = useCallback(async () => {
    if (isLoadingMoreRef.current || !hasMoreMovements) return;
    isLoadingMoreRef.current = true;

    const reqKey = createRequestKey('inventory', 'movements_page', { offset: movementsOffsetRef.current });
    const controller = registerRequest(reqKey);

    try {
      const { data, error } = await supabase
        .from('material_movements')
        .select('id, material_id, quantity, movement_type, notes, movement_date, created_at, materials(name)')
        .order('created_at', { ascending: false })
        .range(movementsOffsetRef.current, movementsOffsetRef.current + MOVEMENTS_PAGE_SIZE - 1);

      if (controller.signal.aborted) return;
      if (error) throw error;

      setMovements(prev => [...prev, ...(data || [])]);
      setHasMoreMovements((data || []).length === MOVEMENTS_PAGE_SIZE);
      movementsOffsetRef.current += MOVEMENTS_PAGE_SIZE;
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.error('Erro ao carregar movimentos:', err);
    } finally {
      unregisterRequest(reqKey);
      isLoadingMoreRef.current = false;
    }
  }, [hasMoreMovements]);

  const calculateInventory = (mats: Material[], movs: MaterialMovement[]) => {
    const inventoryMap = new Map<string, number>();
    movs.forEach((mov) => {
      const current = inventoryMap.get(mov.material_id) || 0;
      const amount = parseFloat(mov.quantity.toString());
      inventoryMap.set(mov.material_id, mov.movement_type === 'entrada' ? current + amount : current - amount);
    });

    const inventoryData: MaterialInventoryItem[] = mats.map((mat) => {
      const totalQty = inventoryMap.get(mat.id) || 0;
      const unitCost = mat.unit_cost || 0;
      return {
        material_id: mat.id,
        material_name: mat.name,
        unit: mat.unit,
        total_quantity: totalQty,
        supplier_name: mat.suppliers?.name || '—',
        unit_cost: unitCost,
        total_value: totalQty * unitCost,
      };
    });

    setInventory(inventoryData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.material_id || !formData.quantity || parseFloat(formData.quantity) <= 0) {
      alert('Preencha todos os campos obrigatórios corretamente');
      return;
    }
    try {
      const data = {
        material_id: formData.material_id,
        quantity: parseFloat(formData.quantity),
        movement_type: formData.movement_type,
        notes: formData.notes,
      };
      if (editingId) {
        const { error } = await supabase.from('material_movements').update(data).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('material_movements').insert([data]);
        if (error) throw error;
      }
      setFormData({ material_id: '', quantity: '', movement_type: 'entrada', notes: '' });
      setEditingId(null);
      loadData();
    } catch (error) {
      console.error('Erro ao salvar movimento:', error);
      alert('Erro ao salvar movimento');
    }
  };

  const handleEdit = (movement: MaterialMovement) => {
    setFormData({
      material_id: movement.material_id,
      quantity: movement.quantity.toString(),
      movement_type: movement.movement_type,
      notes: movement.notes,
    });
    setEditingId(movement.id);
    setActiveTab('history');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este movimento?')) return;
    try {
      const { error } = await supabase.from('material_movements').delete().eq('id', id);
      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Erro ao excluir movimento:', error);
      alert('Erro ao excluir movimento');
    }
  };

  const handleCancel = () => {
    setFormData({ material_id: '', quantity: '', movement_type: 'entrada', notes: '' });
    setEditingId(null);
  };

  const openAdjustModal = (item: MaterialInventoryItem) => {
    setAdjustingMaterial(item);
    setAdjustmentData({ newQuantity: item.total_quantity.toString(), reason: '' });
    setShowAdjustModal(true);
  };

  const closeAdjustModal = () => {
    setShowAdjustModal(false);
    setAdjustingMaterial(null);
    setAdjustmentData({ newQuantity: '', reason: '' });
  };

  const handleAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingMaterial || !adjustmentData.newQuantity || !adjustmentData.reason.trim()) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }
    const newQty = parseFloat(adjustmentData.newQuantity);
    if (isNaN(newQty) || newQty < 0) { alert('Quantidade inválida'); return; }

    try {
      const difference = newQty - adjustingMaterial.total_quantity;
      if (difference !== 0) {
        const { error } = await supabase.from('material_movements').insert([{
          material_id: adjustingMaterial.material_id,
          quantity: Math.abs(difference),
          movement_type: difference > 0 ? 'entrada' : 'saida',
          notes: `AJUSTE MANUAL: ${adjustmentData.reason}`,
        }]);
        if (error) throw error;
        alert('Ajuste realizado com sucesso!');
        closeAdjustModal();
        loadData();
      } else {
        alert('A nova quantidade é igual à quantidade atual. Nenhum ajuste necessário.');
      }
    } catch (error) {
      console.error('Erro ao realizar ajuste:', error);
      alert('Erro ao realizar ajuste de estoque');
    }
  };

  const openPurchaseModal = useCallback((material?: MaterialInventoryItem) => {
    if (material) {
      const materialData = materials.find(m => m.id === material.material_id);
      setPurchaseInitialMaterial({
        id: material.material_id,
        name: material.material_name,
        unit: material.unit,
        unit_cost: material.unit_cost,
        supplier_id: materialData?.supplier_id || null,
      });
    } else {
      setPurchaseInitialMaterial(undefined);
    }
    setShowPurchaseModal(true);
  }, [materials]);

  const closePurchaseModal = useCallback(() => {
    setShowPurchaseModal(false);
    setPurchaseInitialMaterial(undefined);
  }, []);

  const handleInvoicePurchaseSave = async (data: InvoicePurchaseData) => {
    const supplierName = suppliers.find(s => s.id === data.supplierId)?.name || '';
    const nfLabel = data.invoiceNumber || 'N/A';
    const itemNames = data.items.map(i => i.product_name).join(', ');
    const itemNamesShort = itemNames.length > 80 ? itemNames.substring(0, 80) + '...' : itemNames;

    const { data: purchaseRecord, error: purchaseError } = await supabase
      .from('purchases')
      .insert([{
        invoice_number: data.invoiceNumber || `COMPRA-${Date.now()}`,
        invoice_date: data.purchaseDate,
        supplier_id: data.supplierId || null,
        total_amount: data.totalAmount,
        notes: data.notes || null,
        due_date: data.firstDueDate,
        payment_type: data.paymentType,
        installments_count: data.installments.length,
      }])
      .select()
      .single();

    if (purchaseError) throw purchaseError;

    const purchaseItems = data.items.map(item => ({
      purchase_id: purchaseRecord.id,
      material_id: item.material_id || null,
      product_description: item.product_name,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_cost,
      total_price: item.quantity * item.unit_cost,
      item_category: item.item_category || 'insumo',
      cost_category_id: item.cost_category_id || null,
      classification_status: item.cost_category_id ? 'classified' : 'pending',
    }));

    const { error: itemsError } = await supabase.from('purchase_items').insert(purchaseItems);
    if (itemsError) throw itemsError;

    const stockMovements = data.items
      .filter(item => item.material_id)
      .map(item => ({
        material_id: item.material_id!,
        movement_type: 'entrada',
        quantity: item.quantity,
        movement_date: data.purchaseDate,
        notes: `Compra - NF: ${nfLabel}`,
      }));

    if (stockMovements.length > 0) {
      const { error: movError } = await supabase.from('material_movements').insert(stockMovements);
      if (movError) throw movError;
    }

    const totalInstallments = data.installments.length;
    const payableRecords = data.installments.map(inst => ({
      purchase_id: purchaseRecord.id,
      supplier_id: data.supplierId || null,
      description: totalInstallments > 1
        ? `NF ${nfLabel} - ${supplierName || 'Fornecedor'} - Parcela ${inst.number}/${totalInstallments}`
        : `NF ${nfLabel} - ${supplierName || 'Fornecedor'}`,
      installment_number: inst.number,
      total_installments: totalInstallments,
      amount: inst.amount,
      due_date: inst.dueDate,
      payment_status: 'pending',
      notes: data.items.length > 1 ? `${data.items.length} itens: ${itemNamesShort}` : data.notes || null,
    }));

    const { error: payableError } = await supabase.from('payable_accounts').insert(payableRecords);
    if (payableError) throw payableError;

    closePurchaseModal();
    loadData();
    alert('Compra registrada com sucesso! Os itens foram adicionados ao estoque e as contas a pagar foram criadas.');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let yPos = 20;

    doc.setFillColor(41, 128, 185);
    doc.rect(0, 0, pageWidth, 45, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(companySettings?.company_name || 'Aliancer Engenharia e Topografia', 14, 15);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (companySettings?.company_cnpj) doc.text(`CNPJ: ${companySettings.company_cnpj}`, 14, 22);
    if (companySettings?.company_phone) doc.text(`Fone: ${companySettings.company_phone}`, 14, 27);
    if (companySettings?.company_email) doc.text(`E-mail: ${companySettings.company_email}`, 14, 32);
    if (companySettings?.company_address) doc.text(companySettings.company_address, 14, 37);
    doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth - 14, 15, { align: 'right' });

    yPos = 55;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO DE ESTOQUE DE INSUMOS', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    const totalQuantity = filteredInventory.reduce((sum, item) => sum + item.total_quantity, 0);
    const totalValue = filteredInventory.reduce((sum, item) => sum + item.total_value, 0);

    doc.setFillColor(240, 240, 240);
    doc.rect(14, yPos, pageWidth - 28, 20, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo:', 18, yPos + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total de Insumos: ${filteredInventory.length}`, 18, yPos + 14);
    doc.text(`Valor Total em Estoque: R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth / 2 + 10, yPos + 14);
    yPos += 28;

    autoTable(doc, {
      startY: yPos,
      head: [['Insumo', 'Unid.', 'Quantidade', 'Custo Unit.', 'Valor Total', 'Fornecedor']],
      body: filteredInventory.map(item => [
        item.material_name, item.unit,
        item.total_quantity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        'R$ ' + item.unit_cost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        'R$ ' + item.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        item.supplier_name || '—'
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { cellWidth: 50 }, 1: { halign: 'center', cellWidth: 15 },
        2: { halign: 'right', cellWidth: 25 }, 3: { halign: 'right', cellWidth: 25 },
        4: { halign: 'right', cellWidth: 30 }, 5: { cellWidth: 'auto' }
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 14, right: 14 },
    });

    const finalY = (doc as any).lastAutoTable.finalY || yPos;
    doc.setFillColor(41, 128, 185);
    doc.rect(14, finalY + 5, pageWidth - 28, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('VALOR TOTAL EM ESTOQUE:', 18, finalY + 12);
    doc.text(`R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - 18, finalY + 12, { align: 'right' });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.setFont('helvetica', 'normal');
      doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    }
    doc.save(`estoque-insumos-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Memoized filters
  const filteredInventory = useMemo(() => {
    if (!debouncedSearch) return inventory;
    const lower = debouncedSearch.toLowerCase();
    return inventory.filter(item => item.material_name.toLowerCase().includes(lower));
  }, [inventory, debouncedSearch]);

  const totalInventoryValue = useMemo(
    () => inventory.reduce((sum, item) => sum + item.total_value, 0),
    [inventory]
  );

  // Stable row callbacks
  const handlePurchaseCb = useCallback((item: MaterialInventoryItem) => openPurchaseModal(item), [openPurchaseModal]);
  const handleAdjustCb = useCallback((item: MaterialInventoryItem) => openAdjustModal(item), []);
  const handleEditMovCb = useCallback((m: MaterialMovement) => handleEdit(m), []);
  const handleDeleteMovCb = useCallback((id: string) => handleDelete(id), []);

  // Virtualized heights
  const stockHeight = useVirtualizedHeight(MAX_LIST_HEIGHT, STOCK_ITEM_HEIGHT, filteredInventory.length);
  const movHeight = useVirtualizedHeight(MAX_LIST_HEIGHT, MOVEMENT_ITEM_HEIGHT, movements.length);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total de Insumos</p>
              <p className="text-3xl font-bold text-gray-900">{inventory.length}</p>
            </div>
            <Package className="w-12 h-12 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div>
            <p className="text-sm text-gray-600">Valor Total em Estoque</p>
            <p className="text-3xl font-bold text-green-600">
              R$ {totalInventoryValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('stock')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'stock' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Estoque Atual
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'history' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Histórico de Movimentos
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'stock' ? (
            <>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h3 className="text-xl font-bold text-gray-800">Estoque de Insumos</h3>
                <div className="flex gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Buscar insumo..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <button
                    onClick={exportToPDF}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 whitespace-nowrap"
                  >
                    <FileDown className="w-5 h-5" />
                    Exportar PDF
                  </button>
                </div>
              </div>

              {filteredInventory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchTerm ? 'Nenhum insumo encontrado' : 'Nenhum insumo cadastrado'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {/* Table header */}
                  <div className="flex items-center bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <div className="flex-1 pr-2">Insumo</div>
                    <div className="w-32 hidden md:block">Fornecedor</div>
                    <div className="w-14 text-center">Unid.</div>
                    <div className="w-28 text-right">Quantidade</div>
                    <div className="w-28 text-right hidden md:block">Custo Unit.</div>
                    <div className="w-28 text-right hidden md:block">Valor Total</div>
                    <div className="w-20 text-center">Status</div>
                    <div className="w-36 text-center">Ações</div>
                  </div>
                  <VirtualizedListAdvanced
                    items={filteredInventory}
                    height={stockHeight}
                    itemHeight={STOCK_ITEM_HEIGHT}
                    threshold={15}
                    renderItem={(item, _index, style) => (
                      <StockRow
                        key={item.material_id}
                        item={item}
                        style={style}
                        onPurchase={handlePurchaseCb}
                        onAdjust={handleAdjustCb}
                      />
                    )}
                    emptyMessage="Nenhum insumo cadastrado"
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <h3 className="text-xl font-bold text-gray-800 mb-6">Registrar Movimento de Insumo</h3>

              {materials.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800 mb-6">
                  Cadastre insumos primeiro para registrar movimentações
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 mb-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Insumo *</label>
                      <select
                        value={formData.material_id}
                        onChange={(e) => setFormData({ ...formData, material_id: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        required
                      >
                        <option value="">Selecione um insumo</option>
                        {materials.map((material) => (
                          <option key={material.id} value={material.id}>
                            {material.name} ({material.unit})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade *</label>
                      <input
                        type="number" step="0.0001" min="0.0001"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="0.0000" required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Movimento *</label>
                    <select
                      value={formData.movement_type}
                      onChange={(e) => setFormData({ ...formData, movement_type: e.target.value as 'entrada' | 'saida' })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    >
                      <option value="entrada">Entrada (Compra/Recebimento)</option>
                      <option value="saida">Saída (Consumo/Uso)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Notas sobre o movimento" rows={2}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button type="submit" className="flex-1 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2">
                      <Plus className="w-5 h-5" />
                      {editingId ? 'Atualizar' : 'Registrar'}
                    </button>
                    {editingId && (
                      <button type="button" onClick={handleCancel} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                        Cancelar
                      </button>
                    )}
                  </div>
                </form>
              )}

              <h3 className="text-xl font-bold text-gray-800 mb-4 mt-8">Histórico de Movimentos</h3>

              {movements.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Nenhum movimento registrado</div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="flex items-center bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <div className="flex-1 pr-2">Insumo</div>
                    <div className="w-24">Tipo</div>
                    <div className="w-28 text-right">Quantidade</div>
                    <div className="flex-1 px-2">Observações</div>
                    <div className="w-28">Data</div>
                    <div className="w-16 text-right">Ações</div>
                  </div>
                  <VirtualizedListAdvanced
                    items={movements}
                    height={movHeight}
                    itemHeight={MOVEMENT_ITEM_HEIGHT}
                    threshold={15}
                    hasNextPage={hasMoreMovements}
                    loadNextPage={loadMoreMovements}
                    renderItem={(movement, _index, style) => (
                      <MovementRow
                        key={movement.id}
                        movement={movement}
                        style={style}
                        onEdit={handleEditMovCb}
                        onDelete={handleDeleteMovCb}
                      />
                    )}
                    emptyMessage="Nenhum movimento registrado"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Adjust Modal */}
      {showAdjustModal && adjustingMaterial && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Settings className="w-6 h-6 text-blue-600" />
                Ajuste Manual de Estoque
              </h3>
              <button onClick={closeAdjustModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAdjustment} className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="text-sm text-gray-600 mb-1">Insumo:</div>
                <div className="text-lg font-semibold text-gray-900">{adjustingMaterial.material_name}</div>
                <div className="text-sm text-gray-600 mt-2">Quantidade Atual:</div>
                <div className="text-2xl font-bold text-blue-600">
                  {adjustingMaterial.total_quantity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {adjustingMaterial.unit}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nova Quantidade *</label>
                <input
                  type="number" step="0.0001" min="0"
                  value={adjustmentData.newQuantity}
                  onChange={(e) => setAdjustmentData({ ...adjustmentData, newQuantity: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.0000" required
                />
                <p className="text-xs text-gray-500 mt-1">Digite a quantidade correta após conferência ou balanço</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo do Ajuste *</label>
                <textarea
                  value={adjustmentData.reason}
                  onChange={(e) => setAdjustmentData({ ...adjustmentData, reason: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3} placeholder="Ex: Balanço mensal, Conferência física, Correção de erro..." required
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-xs font-medium text-blue-800 mb-1">Informação:</div>
                <div className="text-xs text-blue-700">
                  O sistema calculará automaticamente a diferença e registrará como entrada ou saída no histórico.
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeAdjustModal} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                  Confirmar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPurchaseModal && (
        <InvoicePurchaseModal
          suppliers={suppliers}
          initialMaterial={purchaseInitialMaterial}
          onSave={handleInvoicePurchaseSave}
          onClose={closePurchaseModal}
        />
      )}
    </div>
  );
}
