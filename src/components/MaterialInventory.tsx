import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Package, Search, FileDown, Settings, X, ShoppingCart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import InvoicePurchaseModal, { type InvoicePurchaseData } from './InvoicePurchaseModal';

interface Material {
  id: string;
  name: string;
  unit: string;
  description: string;
  supplier_id?: string;
  unit_cost?: number;
  suppliers?: {
    name: string;
  };
}

interface MaterialMovement {
  id: string;
  material_id: string;
  quantity: number;
  movement_type: 'entrada' | 'saida';
  notes: string;
  movement_date?: string;
  created_at: string;
  materials?: Material;
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

export default function MaterialInventory() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [inventory, setInventory] = useState<MaterialInventoryItem[]>([]);
  const [movements, setMovements] = useState<MaterialMovement[]>([]);
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
  const [adjustmentData, setAdjustmentData] = useState({
    newQuantity: '',
    reason: '',
  });
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseInitialMaterial, setPurchaseInitialMaterial] = useState<{
    id: string;
    name: string;
    unit: string;
    unit_cost: number;
    supplier_id?: string | null;
  } | undefined>(undefined);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    loadData();
    loadCompanySettings();
    loadSuppliers();
  }, []);

  const loadCompanySettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const settings: any = {};
        data.forEach((setting: any) => {
          settings[setting.setting_key] = setting.setting_value;
        });
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
      const [materialsRes, movementsRes] = await Promise.all([
        supabase.from('materials').select('*, suppliers(name)').order('name'),
        supabase.from('material_movements').select('*, materials(*)')
          .order('created_at', { ascending: false }),
      ]);

      if (materialsRes.error) throw materialsRes.error;

      setMaterials(materialsRes.data || []);

      if (!movementsRes.error) {
        setMovements(movementsRes.data || []);
        calculateInventory(materialsRes.data || [], movementsRes.data || []);
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

  const calculateInventory = (mats: Material[], movs: MaterialMovement[]) => {
    const inventoryMap = new Map<string, number>();

    movs.forEach((mov) => {
      const current = inventoryMap.get(mov.material_id) || 0;
      const amount = parseFloat(mov.quantity.toString());
      inventoryMap.set(
        mov.material_id,
        mov.movement_type === 'entrada' ? current + amount : current - amount
      );
    });

    const inventoryData: MaterialInventoryItem[] = mats.map((mat) => {
      const totalQty = inventoryMap.get(mat.id) || 0;
      const unitCost = mat.unit_cost || 0;
      const totalValue = totalQty * unitCost;

      return {
        material_id: mat.id,
        material_name: mat.name,
        unit: mat.unit,
        total_quantity: totalQty,
        supplier_name: mat.suppliers?.name || '-',
        unit_cost: unitCost,
        total_value: totalValue,
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
        const { error } = await supabase
          .from('material_movements')
          .update(data)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('material_movements')
          .insert([data]);

        if (error) throw error;
      }

      setFormData({
        material_id: '',
        quantity: '',
        movement_type: 'entrada',
        notes: '',
      });
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
      const { error } = await supabase
        .from('material_movements')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Erro ao excluir movimento:', error);
      alert('Erro ao excluir movimento');
    }
  };

  const handleCancel = () => {
    setFormData({
      material_id: '',
      quantity: '',
      movement_type: 'entrada',
      notes: '',
    });
    setEditingId(null);
  };

  const openAdjustModal = (item: MaterialInventoryItem) => {
    setAdjustingMaterial(item);
    setAdjustmentData({
      newQuantity: item.total_quantity.toString(),
      reason: '',
    });
    setShowAdjustModal(true);
  };

  const closeAdjustModal = () => {
    setShowAdjustModal(false);
    setAdjustingMaterial(null);
    setAdjustmentData({
      newQuantity: '',
      reason: '',
    });
  };

  const handleAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!adjustingMaterial || !adjustmentData.newQuantity || !adjustmentData.reason.trim()) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }

    const newQty = parseFloat(adjustmentData.newQuantity);
    if (isNaN(newQty) || newQty < 0) {
      alert('Quantidade inválida');
      return;
    }

    try {
      const currentQty = adjustingMaterial.total_quantity;
      const difference = newQty - currentQty;

      if (difference !== 0) {
        const movementType = difference > 0 ? 'entrada' : 'saida';
        const absoluteDifference = Math.abs(difference);

        const { error } = await supabase
          .from('material_movements')
          .insert([{
            material_id: adjustingMaterial.material_id,
            quantity: absoluteDifference,
            movement_type: movementType,
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
      notes: data.items.length > 1
        ? `${data.items.length} itens: ${itemNamesShort}`
        : data.notes || null,
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

    // Cabeçalho com informações da empresa
    doc.setFillColor(41, 128, 185);
    doc.rect(0, 0, pageWidth, 45, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(companySettings?.company_name || 'Aliancer Engenharia e Topografia', 14, 15);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (companySettings?.company_cnpj) {
      doc.text(`CNPJ: ${companySettings.company_cnpj}`, 14, 22);
    }
    if (companySettings?.company_phone) {
      doc.text(`Fone: ${companySettings.company_phone}`, 14, 27);
    }
    if (companySettings?.company_email) {
      doc.text(`E-mail: ${companySettings.company_email}`, 14, 32);
    }
    if (companySettings?.company_address) {
      doc.text(companySettings.company_address, 14, 37);
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth - 14, 15, { align: 'right' });

    yPos = 55;

    // Título do Relatório
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO DE ESTOQUE DE INSUMOS', pageWidth / 2, yPos, { align: 'center' });

    yPos += 10;

    // Informações resumidas
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

    // Tabela de Insumos
    const tableData = filteredInventory.map(item => [
      item.material_name,
      item.unit,
      item.total_quantity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      'R$ ' + item.unit_cost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      'R$ ' + item.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      item.supplier_name || '-'
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Insumo', 'Unid.', 'Quantidade', 'Custo Unit.', 'Valor Total', 'Fornecedor']],
      body: tableData,
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { halign: 'center', cellWidth: 15 },
        2: { halign: 'right', cellWidth: 25 },
        3: { halign: 'right', cellWidth: 25 },
        4: { halign: 'right', cellWidth: 30 },
        5: { cellWidth: 'auto' }
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 14, right: 14 },
    });

    const finalY = (doc as any).lastAutoTable.finalY || yPos;

    // Totalizador
    doc.setFillColor(41, 128, 185);
    doc.rect(14, finalY + 5, pageWidth - 28, 12, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('VALOR TOTAL EM ESTOQUE:', 18, finalY + 12);
    doc.text(`R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - 18, finalY + 12, { align: 'right' });

    // Rodapé
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Página ${i} de ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }

    doc.save(`estoque-insumos-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const filteredInventory = inventory.filter((item) =>
    item.material_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalInventoryValue = inventory.reduce((sum, item) => sum + item.total_value, 0);

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
                activeTab === 'stock'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Estoque Atual
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'history'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Insumo
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fornecedor
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Unidade
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Quantidade
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Custo Unit.
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Valor Total
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredInventory.map((item) => (
                        <tr key={item.material_id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">
                              {item.material_name}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-600">{item.supplier_name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600">{item.unit}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="text-sm font-semibold text-gray-900">
                              {item.total_quantity.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="text-sm text-gray-900">
                              R$ {item.unit_cost.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="text-sm font-semibold text-blue-600">
                              R$ {item.total_value.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className={`px-3 py-1 inline-flex text-xs font-semibold rounded-full ${
                              item.total_quantity > 0
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {item.total_quantity > 0 ? 'Disponível' : 'Esgotado'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => openPurchaseModal(item)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors"
                                title="Registrar Compra"
                              >
                                <ShoppingCart className="w-3.5 h-3.5" />
                                Comprar
                              </button>
                              <button
                                onClick={() => openAdjustModal(item)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                                title="Ajuste Manual de Estoque"
                              >
                                <Settings className="w-3.5 h-3.5" />
                                Ajustar
                              </button>
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
              <h3 className="text-xl font-bold text-gray-800 mb-6">Registrar Movimento de Insumo</h3>

              {materials.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800 mb-6">
                  Cadastre insumos primeiro para registrar movimentações
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 mb-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Insumo *
                      </label>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quantidade *
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        min="0.0001"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="0.0000"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo de Movimento *
                    </label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Observações
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Notas sobre o movimento"
                      rows={2}
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="flex-1 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-5 h-5" />
                      {editingId ? 'Atualizar' : 'Registrar'}
                    </button>
                    {editingId && (
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </form>
              )}

              <h3 className="text-xl font-bold text-gray-800 mb-4 mt-8">Histórico de Movimentos</h3>

              {movements.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Nenhum movimento registrado
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Insumo
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tipo
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Quantidade
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Observações
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Data
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {movements.map((movement) => (
                        <tr key={movement.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">
                              {movement.materials?.name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              movement.movement_type === 'entrada'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-orange-100 text-orange-800'
                            }`}>
                              {movement.movement_type === 'entrada' ? 'Entrada' : 'Saída'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="text-sm text-gray-900">
                              {parseFloat(movement.quantity.toString()).toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                              })}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-600">{movement.notes || '-'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600">
                              {movement.movement_date
                                ? new Date(movement.movement_date).toLocaleDateString('pt-BR')
                                : new Date(movement.created_at).toLocaleDateString('pt-BR')}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => handleEdit(movement)}
                              className="text-green-600 hover:text-green-900 mr-3"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4 inline" />
                            </button>
                            <button
                              onClick={() => handleDelete(movement.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4 inline" />
                            </button>
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
      </div>

      {/* Modal de Ajuste Manual */}
      {showAdjustModal && adjustingMaterial && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Settings className="w-6 h-6 text-blue-600" />
                Ajuste Manual de Estoque
              </h3>
              <button
                onClick={closeAdjustModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleAdjustment} className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="text-sm text-gray-600 mb-1">Insumo:</div>
                <div className="text-lg font-semibold text-gray-900">{adjustingMaterial.material_name}</div>
                <div className="text-sm text-gray-600 mt-2">Quantidade Atual:</div>
                <div className="text-2xl font-bold text-blue-600">
                  {adjustingMaterial.total_quantity.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} {adjustingMaterial.unit}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nova Quantidade *
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={adjustmentData.newQuantity}
                  onChange={(e) => setAdjustmentData({ ...adjustmentData, newQuantity: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.0000"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Digite a quantidade correta após conferência ou balanço
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo do Ajuste *
                </label>
                <textarea
                  value={adjustmentData.reason}
                  onChange={(e) => setAdjustmentData({ ...adjustmentData, reason: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Ex: Balanço mensal, Conferência física, Correção de erro..."
                  required
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-xs font-medium text-blue-800 mb-1">Informação:</div>
                <div className="text-xs text-blue-700">
                  O sistema calculará automaticamente a diferença e registrará como entrada ou saída no histórico.
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeAdjustModal}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
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
