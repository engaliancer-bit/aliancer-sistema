import React, { useState, useEffect, useRef } from 'react';
import { Building2, Plus, X, Edit2, Trash2, Save, ChevronDown, ChevronRight, Calendar, MapPin, DollarSign, TrendingUp, Package, AlertCircle, FileText, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useHorizontalKeyboardScroll } from '../hooks/useHorizontalKeyboardScroll';
import ConstructionWorkStatement from './ConstructionWorkStatement';

interface Customer {
  id: string;
  name: string;
  person_type: string;
}

interface Work {
  id: string;
  customer_id: string;
  work_name: string;
  work_area: number;
  area_type: 'rural' | 'urbana';
  construction_type: 'residencial' | 'comercial' | 'industrial' | 'rural';
  occupancy_type: 'unifamiliar' | 'multifamiliar';
  address: string;
  city: string;
  state: string;
  zip_code: string;
  contract_type: 'pacote_fechado' | 'administracao';
  total_contract_value: number;
  administration_percentage: number;
  status: 'em_andamento' | 'pausada' | 'concluida' | 'cancelada';
  start_date: string;
  estimated_end_date: string;
  actual_end_date: string;
  notes: string;
  created_at: string;
  updated_at: string;
  customers?: Customer;
}

interface WorkItem {
  id: string;
  work_id: string;
  quote_id: string;
  quote_item_id: string;
  item_type: 'product' | 'material' | 'composition' | 'service';
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  added_date: string;
  notes: string;
  product_id?: string;
  material_id?: string;
  composition_id?: string;
  unit?: string;
}

interface Product {
  id: string;
  name: string;
  unit: string;
  sale_price: number;
}

interface Material {
  id: string;
  name: string;
  unit: string;
  resale_price: number;
}

interface Composition {
  id: string;
  name: string;
  unit: string;
  total_cost: number;
}

interface WorkPayments {
  total_paid: number;
  balance: number;
}

export default function ConstructionProjects() {
  const [works, setWorks] = useState<Work[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingWork, setEditingWork] = useState<Work | null>(null);
  const [expandedWorks, setExpandedWorks] = useState<Set<string>>(new Set());
  const [workItems, setWorkItems] = useState<{ [key: string]: WorkItem[] }>({});
  const [workPayments, setWorkPayments] = useState<{ [key: string]: WorkPayments }>({});
  const [showItemModal, setShowItemModal] = useState(false);
  const [selectedWorkId, setSelectedWorkId] = useState<string>('');
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [selectedWorkForStatement, setSelectedWorkForStatement] = useState<Work | null>(null);
  const [refreshingPayments, setRefreshingPayments] = useState<{ [key: string]: boolean }>({});
  const tableRef = useRef<HTMLDivElement>(null);

  useHorizontalKeyboardScroll(tableRef);

  const [formData, setFormData] = useState({
    customer_id: '',
    work_name: '',
    work_area: 0,
    area_type: 'urbana' as 'rural' | 'urbana',
    construction_type: 'residencial' as 'residencial' | 'comercial' | 'industrial' | 'rural',
    occupancy_type: 'unifamiliar' as 'unifamiliar' | 'multifamiliar',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    contract_type: 'pacote_fechado' as 'pacote_fechado' | 'administracao',
    total_contract_value: 0,
    administration_percentage: 0,
    status: 'em_andamento' as 'em_andamento' | 'pausada' | 'concluida' | 'cancelada',
    start_date: '',
    estimated_end_date: '',
    actual_end_date: '',
    notes: ''
  });

  const [newItem, setNewItem] = useState({
    item_type: 'product' as 'product' | 'material' | 'composition' | 'service',
    item_id: '',
    item_name: '',
    quantity: 1,
    unit_price: 0,
    unit: '',
    notes: ''
  });

  useEffect(() => {
    loadWorks();
    loadCustomers();
    loadProducts();
    loadMaterials();
    loadCompositions();
  }, []);

  const loadWorks = async () => {
    const { data, error } = await supabase
      .from('construction_works')
      .select(`
        *,
        customers (
          id,
          name,
          person_type
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading works:', error);
      return;
    }

    setWorks(data || []);
  };

  const loadCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, person_type')
      .order('name');

    if (!error) {
      setCustomers(data || []);
    }
  };

  const loadProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, unit, sale_price')
      .order('name');

    if (!error) {
      setProducts(data || []);
    }
  };

  const loadMaterials = async () => {
    const { data, error } = await supabase
      .from('materials')
      .select('id, name, unit, resale_price')
      .order('name');

    if (!error) {
      setMaterials(data || []);
    }
  };

  const loadCompositions = async () => {
    const { data, error } = await supabase
      .from('compositions')
      .select('id, name, unit, total_cost')
      .order('name');

    if (!error) {
      setCompositions(data || []);
    }
  };

  const loadWorkItems = async (workId: string) => {
    if (workItems[workId]) {
      return;
    }

    const { data, error } = await supabase
      .from('construction_work_items')
      .select('*')
      .eq('work_id', workId)
      .order('added_date', { ascending: false });

    if (error) {
      console.error('Error loading work items:', error);
      return;
    }

    setWorkItems(prev => ({
      ...prev,
      [workId]: data || []
    }));
  };

  const toggleWorkExpansion = async (workId: string) => {
    const newExpanded = new Set(expandedWorks);
    if (newExpanded.has(workId)) {
      newExpanded.delete(workId);
    } else {
      newExpanded.add(workId);
      await Promise.all([loadWorkItems(workId), loadWorkPayments(workId)]);
    }
    setExpandedWorks(newExpanded);
  };

  const loadWorkPayments = async (workId: string) => {
    const work = works.find(w => w.id === workId);
    if (!work) return;

    const [{ data: revenues }, { data: cashFlowEntries }] = await Promise.all([
      supabase
        .from('customer_revenue')
        .select('payment_amount')
        .eq('origin_type', 'construction_work')
        .eq('origin_id', workId)
        .eq('estornado', false),
      supabase
        .from('cash_flow')
        .select('amount, customer_revenue_id')
        .eq('construction_work_id', workId)
        .eq('type', 'income')
        .is('customer_revenue_id', null),
    ]);

    const fromRevenues = (revenues || []).reduce((sum, p) => sum + Number(p.payment_amount), 0);
    const fromCashFlow = (cashFlowEntries || []).reduce((sum, e) => sum + Number(e.amount), 0);
    const totalPaid = fromRevenues + fromCashFlow;
    const balance = Number(work.total_contract_value || 0) - totalPaid;

    setWorkPayments(prev => ({
      ...prev,
      [workId]: { total_paid: totalPaid, balance }
    }));
  };

  const handleRefreshPayments = async (workId: string) => {
    setRefreshingPayments(prev => ({ ...prev, [workId]: true }));
    await loadWorkPayments(workId);
    setRefreshingPayments(prev => ({ ...prev, [workId]: false }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customer_id || !formData.work_name) {
      alert('Preencha os campos obrigatórios');
      return;
    }

    if (formData.contract_type === 'pacote_fechado' && !formData.total_contract_value) {
      alert('Informe o valor total do pacote fechado');
      return;
    }

    if (formData.contract_type === 'administracao' && !formData.administration_percentage) {
      alert('Informe o percentual de administração');
      return;
    }

    const workData: any = {
      ...formData,
      total_contract_value: formData.contract_type === 'pacote_fechado' ? formData.total_contract_value : null,
      administration_percentage: formData.contract_type === 'administracao' ? formData.administration_percentage : null,
      start_date: formData.start_date || null,
      estimated_end_date: formData.estimated_end_date || null,
      actual_end_date: formData.actual_end_date || null
    };

    if (editingWork) {
      const { error } = await supabase
        .from('construction_works')
        .update(workData)
        .eq('id', editingWork.id);

      if (error) {
        console.error('Error updating work:', error);
        alert('Erro ao atualizar obra');
        return;
      }

      alert('Obra atualizada com sucesso!');
    } else {
      const { error } = await supabase
        .from('construction_works')
        .insert([workData]);

      if (error) {
        console.error('Error creating work:', error);
        alert('Erro ao criar obra');
        return;
      }

      alert('Obra criada com sucesso!');
    }

    resetForm();
    loadWorks();
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedWorkId || !newItem.item_name || newItem.quantity <= 0) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }

    const totalPrice = newItem.quantity * newItem.unit_price;

    const itemData: any = {
      work_id: selectedWorkId,
      item_type: newItem.item_type,
      item_name: newItem.item_name,
      quantity: newItem.quantity,
      unit_price: newItem.unit_price,
      total_price: totalPrice,
      unit: newItem.unit,
      notes: newItem.notes
    };

    if (newItem.item_type === 'product' && newItem.item_id) {
      itemData.product_id = newItem.item_id;
    } else if (newItem.item_type === 'material' && newItem.item_id) {
      itemData.material_id = newItem.item_id;
    } else if (newItem.item_type === 'composition' && newItem.item_id) {
      itemData.composition_id = newItem.item_id;
    }

    const { error } = await supabase
      .from('construction_work_items')
      .insert([itemData]);

    if (error) {
      console.error('Error adding item:', error);
      alert('Erro ao adicionar item');
      return;
    }

    setNewItem({
      item_type: 'product',
      item_id: '',
      item_name: '',
      quantity: 1,
      unit_price: 0,
      unit: '',
      notes: ''
    });
    setShowItemModal(false);
    setSelectedWorkId('');

    delete workItems[selectedWorkId];
    await loadWorkItems(selectedWorkId);
    alert('Item adicionado com sucesso!');
  };

  const handleEdit = (work: Work) => {
    setEditingWork(work);
    setFormData({
      customer_id: work.customer_id,
      work_name: work.work_name,
      work_area: work.work_area || 0,
      area_type: work.area_type || 'urbana',
      construction_type: work.construction_type || 'residencial',
      occupancy_type: work.occupancy_type || 'unifamiliar',
      address: work.address || '',
      city: work.city || '',
      state: work.state || '',
      zip_code: work.zip_code || '',
      contract_type: work.contract_type,
      total_contract_value: work.total_contract_value || 0,
      administration_percentage: work.administration_percentage || 0,
      status: work.status,
      start_date: work.start_date || '',
      estimated_end_date: work.estimated_end_date || '',
      actual_end_date: work.actual_end_date || '',
      notes: work.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta obra?')) {
      return;
    }

    const { error } = await supabase
      .from('construction_works')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting work:', error);
      alert('Erro ao excluir obra');
      return;
    }

    alert('Obra excluída com sucesso!');
    loadWorks();
  };

  const handleDeleteItem = async (itemId: string, workId: string) => {
    if (!confirm('Tem certeza que deseja excluir este item?')) {
      return;
    }

    const { error } = await supabase
      .from('construction_work_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      console.error('Error deleting item:', error);
      alert('Erro ao excluir item');
      return;
    }

    delete workItems[workId];
    await loadWorkItems(workId);
    alert('Item excluído com sucesso!');
  };

  const resetForm = () => {
    setFormData({
      customer_id: '',
      work_name: '',
      work_area: 0,
      area_type: 'urbana',
      construction_type: 'residencial',
      occupancy_type: 'unifamiliar',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      contract_type: 'pacote_fechado',
      total_contract_value: 0,
      administration_percentage: 0,
      status: 'em_andamento',
      start_date: '',
      estimated_end_date: '',
      actual_end_date: '',
      notes: ''
    });
    setEditingWork(null);
    setShowModal(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'em_andamento': return 'bg-blue-100 text-blue-800';
      case 'pausada': return 'bg-yellow-100 text-yellow-800';
      case 'concluida': return 'bg-green-100 text-green-800';
      case 'cancelada': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'em_andamento': return 'Em Andamento';
      case 'pausada': return 'Pausada';
      case 'concluida': return 'Concluída';
      case 'cancelada': return 'Cancelada';
      default: return status;
    }
  };

  const calculateWorkTotals = (workId: string) => {
    const items = workItems[workId] || [];
    const totalValue = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
    const totalItems = items.length;
    return { totalValue, totalItems };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            Obras
          </h2>
          <p className="text-gray-600 mt-1">Gerencie as obras da construtora</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          Nova Obra
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Total de Obras</p>
              <p className="text-2xl font-bold text-gray-900">{works.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Em Andamento</p>
              <p className="text-2xl font-bold text-gray-900">
                {works.filter(w => w.status === 'em_andamento').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-yellow-600" />
            <div>
              <p className="text-sm text-gray-600">Pausadas</p>
              <p className="text-2xl font-bold text-gray-900">
                {works.filter(w => w.status === 'pausada').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-purple-600" />
            <div>
              <p className="text-sm text-gray-600">Concluídas</p>
              <p className="text-2xl font-bold text-gray-900">
                {works.filter(w => w.status === 'concluida').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div ref={tableRef} className="bg-white rounded-lg shadow overflow-hidden overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Detalhes</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome da Obra</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contrato</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Início</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {works.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Building2 className="h-12 w-12 text-gray-400" />
                    <p className="text-lg">Nenhuma obra cadastrada</p>
                  </div>
                </td>
              </tr>
            )}
            {works.map((work) => {
              const { totalValue, totalItems } = calculateWorkTotals(work.id);
              return (
                <React.Fragment key={work.id}>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => toggleWorkExpansion(work.id)}
                        className="p-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                      >
                        {expandedWorks.has(work.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedWorkId(work.id);
                            setShowItemModal(true);
                          }}
                          className="p-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                          title="Adicionar item"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedWorkForStatement(work);
                            setShowStatementModal(true);
                          }}
                          className="p-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                          title="Ver Extrato"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(work)}
                          className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(work.id)}
                          className="p-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="font-medium">{work.work_name}</div>
                      {work.work_area && (
                        <div className="text-xs text-gray-500">{work.work_area} m²</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {work.customers?.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <div>{work.construction_type}</div>
                      <div className="text-xs text-gray-500">{work.area_type}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {work.contract_type === 'pacote_fechado' ? (
                        <div>
                          <div className="font-medium">Pacote Fechado</div>
                          <div className="text-xs">R$ {work.total_contract_value?.toFixed(2)}</div>
                        </div>
                      ) : (
                        <div>
                          <div className="font-medium">Administração</div>
                          <div className="text-xs">{work.administration_percentage}%</div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(work.status)}`}>
                        {getStatusLabel(work.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {work.start_date ? new Date(work.start_date).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                  {expandedWorks.has(work.id) && (
                    <tr>
                      <td colSpan={8} className="px-6 py-4 bg-gray-50">
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div className="bg-white p-4 rounded-lg border">
                              <div className="flex items-center gap-2 mb-2">
                                <MapPin className="h-5 w-5 text-gray-600" />
                                <h4 className="font-semibold text-gray-700">Localização</h4>
                              </div>
                              <p className="text-sm text-gray-600">{work.address || 'Não informado'}</p>
                              <p className="text-sm text-gray-600">{work.city} - {work.state}</p>
                              {work.zip_code && <p className="text-sm text-gray-600">CEP: {work.zip_code}</p>}
                            </div>
                            <div className="bg-white p-4 rounded-lg border">
                              <div className="flex items-center gap-2 mb-2">
                                <Calendar className="h-5 w-5 text-gray-600" />
                                <h4 className="font-semibold text-gray-700">Prazos</h4>
                              </div>
                              <p className="text-sm text-gray-600">
                                Previsão: {work.estimated_end_date ? new Date(work.estimated_end_date).toLocaleDateString() : 'Não definido'}
                              </p>
                              {work.actual_end_date && (
                                <p className="text-sm text-gray-600">
                                  Conclusão: {new Date(work.actual_end_date).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                            <div className="bg-white p-4 rounded-lg border">
                              <div className="flex items-center gap-2 mb-2">
                                <Package className="h-5 w-5 text-gray-600" />
                                <h4 className="font-semibold text-gray-700">Itens da Obra</h4>
                              </div>
                              <p className="text-sm text-gray-600">
                                Total de Itens: {totalItems}
                              </p>
                              <p className="text-sm font-medium text-blue-600">
                                Total: R$ {totalValue.toFixed(2)}
                              </p>
                            </div>
                          </div>

                          {work.contract_type === 'pacote_fechado' && workPayments[work.id] && (
                            <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border-2 border-green-200">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <DollarSign className="h-6 w-6 text-green-600" />
                                  <h4 className="font-bold text-gray-800 text-lg">Situação Financeira do Cliente</h4>
                                </div>
                                <button
                                  onClick={() => handleRefreshPayments(work.id)}
                                  disabled={refreshingPayments[work.id]}
                                  className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-white rounded transition-colors"
                                  title="Atualizar pagamentos"
                                >
                                  <RefreshCw className={`h-3.5 w-3.5 ${refreshingPayments[work.id] ? 'animate-spin' : ''}`} />
                                  Atualizar
                                </button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white p-3 rounded-lg border border-blue-200">
                                  <p className="text-xs text-gray-600 mb-1">Valor do Contrato</p>
                                  <p className="text-xl font-bold text-blue-600">
                                    R$ {(work.total_contract_value || 0).toFixed(2)}
                                  </p>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-green-200">
                                  <p className="text-xs text-gray-600 mb-1">Total Pago</p>
                                  <p className="text-xl font-bold text-green-600">
                                    R$ {workPayments[work.id].total_paid.toFixed(2)}
                                  </p>
                                </div>
                                <div className={`bg-white p-3 rounded-lg border-2 ${workPayments[work.id].balance > 0 ? 'border-orange-300' : 'border-green-300'}`}>
                                  <p className="text-xs text-gray-600 mb-1">Saldo Devedor</p>
                                  <p className={`text-xl font-bold ${workPayments[work.id].balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                    R$ {workPayments[work.id].balance.toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          <div>
                            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                              <Package className="h-5 w-5" />
                              Itens da Obra:
                            </h4>
                            {workItems[work.id] && workItems[work.id].length > 0 ? (
                              <div className="space-y-2">
                                {workItems[work.id].map((item) => (
                                  <div key={item.id} className="bg-white p-4 rounded border border-gray-200">
                                    <div className="flex justify-between items-start">
                                      <div className="flex-1">
                                        <div className="font-medium text-gray-900">{item.item_name}</div>
                                        <div className="text-sm text-gray-600 mt-1">
                                          Tipo: {item.item_type === 'product' ? 'Produto' : item.item_type === 'material' ? 'Insumo' : item.item_type === 'composition' ? 'Composição' : 'Serviço'}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                          Quantidade: {item.quantity} {item.unit ? `(${item.unit})` : ''} | Preço Unit.: R$ {item.unit_price.toFixed(2)}
                                        </div>
                                        {item.notes && (
                                          <div className="text-sm text-gray-500 mt-1">Obs: {item.notes}</div>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 ml-4">
                                        <div className="text-right">
                                          <div className="font-semibold text-blue-600 text-lg">
                                            R$ {item.total_price.toFixed(2)}
                                          </div>
                                        </div>
                                        <button
                                          onClick={() => handleDeleteItem(item.id, work.id)}
                                          className="p-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                                          title="Excluir item"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-gray-500 text-sm italic bg-white p-4 rounded border border-gray-200">
                                Nenhum item adicionado a esta obra
                              </div>
                            )}
                          </div>

                          {work.notes && (
                            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                              <h4 className="font-semibold text-gray-700 mb-2">Observações:</h4>
                              <p className="text-sm text-gray-600">{work.notes}</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {editingWork ? 'Editar Obra' : 'Nova Obra'}
              </h3>
              <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cliente *
                  </label>
                  <select
                    value={formData.customer_id}
                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  >
                    <option value="">Selecione um cliente...</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome da Obra *
                  </label>
                  <input
                    type="text"
                    value={formData.work_name}
                    onChange={(e) => setFormData({ ...formData, work_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Área (m²)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.work_area}
                    onChange={(e) => setFormData({ ...formData, work_area: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Área
                  </label>
                  <select
                    value={formData.area_type}
                    onChange={(e) => setFormData({ ...formData, area_type: e.target.value as 'rural' | 'urbana' })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="urbana">Urbana</option>
                    <option value="rural">Rural</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Construção
                  </label>
                  <select
                    value={formData.construction_type}
                    onChange={(e) => setFormData({ ...formData, construction_type: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="residencial">Residencial</option>
                    <option value="comercial">Comercial</option>
                    <option value="industrial">Industrial</option>
                    <option value="rural">Construção Rural</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ocupação
                  </label>
                  <select
                    value={formData.occupancy_type}
                    onChange={(e) => setFormData({ ...formData, occupancy_type: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="unifamiliar">Unifamiliar</option>
                    <option value="multifamiliar">Multifamiliar</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Endereço
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cidade
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estado
                  </label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    maxLength={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CEP
                  </label>
                  <input
                    type="text"
                    value={formData.zip_code}
                    onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Contrato *
                  </label>
                  <select
                    value={formData.contract_type}
                    onChange={(e) => setFormData({ ...formData, contract_type: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  >
                    <option value="pacote_fechado">Pacote Fechado</option>
                    <option value="administracao">Por Administração</option>
                  </select>
                </div>

                {formData.contract_type === 'pacote_fechado' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Valor Total do Pacote *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.total_contract_value}
                      onChange={(e) => setFormData({ ...formData, total_contract_value: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg"
                      required
                    />
                  </div>
                )}

                {formData.contract_type === 'administracao' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Percentual de Administração (%) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.administration_percentage}
                      onChange={(e) => setFormData({ ...formData, administration_percentage: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="em_andamento">Em Andamento</option>
                    <option value="pausada">Pausada</option>
                    <option value="concluida">Concluída</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data de Início
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Previsão de Término
                  </label>
                  <input
                    type="date"
                    value={formData.estimated_end_date}
                    onChange={(e) => setFormData({ ...formData, estimated_end_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                {formData.status === 'concluida' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Data de Conclusão
                    </label>
                    <input
                      type="date"
                      value={formData.actual_end_date}
                      onChange={(e) => setFormData({ ...formData, actual_end_date: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observações
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  <Save className="h-5 w-5" />
                  {editingWork ? 'Atualizar' : 'Criar'} Obra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Adicionar Item à Obra</h3>
              <button
                onClick={() => {
                  setShowItemModal(false);
                  setSelectedWorkId('');
                  setNewItem({
                    item_type: 'product',
                    item_id: '',
                    item_name: '',
                    quantity: 1,
                    unit_price: 0,
                    unit: '',
                    notes: ''
                  });
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Item *
                </label>
                <select
                  value={newItem.item_type}
                  onChange={(e) => {
                    setNewItem({
                      ...newItem,
                      item_type: e.target.value as any,
                      item_id: '',
                      item_name: '',
                      unit_price: 0,
                      unit: ''
                    });
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="product">Produto</option>
                  <option value="material">Insumo</option>
                  <option value="composition">Composição</option>
                  <option value="service">Serviço</option>
                </select>
              </div>

              {newItem.item_type === 'service' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome do Serviço *
                  </label>
                  <input
                    type="text"
                    value={newItem.item_name}
                    onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selecione o {newItem.item_type === 'product' ? 'Produto' : newItem.item_type === 'material' ? 'Insumo' : 'Composição'} *
                  </label>
                  <select
                    value={newItem.item_id}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      let selectedItem: any = null;
                      let price = 0;
                      let unit = '';

                      if (newItem.item_type === 'product') {
                        selectedItem = products.find(p => p.id === selectedId);
                        price = selectedItem?.sale_price || 0;
                        unit = selectedItem?.unit || '';
                      } else if (newItem.item_type === 'material') {
                        selectedItem = materials.find(m => m.id === selectedId);
                        price = selectedItem?.resale_price || 0;
                        unit = selectedItem?.unit || '';
                      } else if (newItem.item_type === 'composition') {
                        selectedItem = compositions.find(c => c.id === selectedId);
                        price = selectedItem?.total_cost || 0;
                        unit = selectedItem?.unit || '';
                      }

                      setNewItem({
                        ...newItem,
                        item_id: selectedId,
                        item_name: selectedItem?.name || '',
                        unit_price: price,
                        unit: unit
                      });
                    }}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  >
                    <option value="">Selecione...</option>
                    {newItem.item_type === 'product' && products.map(product => (
                      <option key={product.id} value={product.id}>
                        {product.name} - {product.unit} - R$ {product.sale_price.toFixed(2)}
                      </option>
                    ))}
                    {newItem.item_type === 'material' && materials.map(material => (
                      <option key={material.id} value={material.id}>
                        {material.name} - {material.unit} - R$ {material.resale_price.toFixed(2)}
                      </option>
                    ))}
                    {newItem.item_type === 'composition' && compositions.map(composition => (
                      <option key={composition.id} value={composition.id}>
                        {composition.name} - {composition.unit} - R$ {composition.total_cost.toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {newItem.item_type === 'service' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unidade *
                  </label>
                  <input
                    type="text"
                    value={newItem.unit}
                    onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Ex: un, m², m³, h"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantidade *
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                  min="0.001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preço Unitário
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newItem.unit_price}
                  onChange={(e) => setNewItem({ ...newItem, unit_price: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observações
                </label>
                <textarea
                  value={newItem.notes}
                  onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Total:</span> R${' '}
                  {(newItem.quantity * newItem.unit_price).toFixed(2)}
                </p>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                <Save className="h-5 w-5" />
                Adicionar Item
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Statement Modal */}
      {showStatementModal && selectedWorkForStatement && (
        <ConstructionWorkStatement
          work={selectedWorkForStatement}
          onClose={() => {
            setShowStatementModal(false);
            setSelectedWorkForStatement(null);
          }}
        />
      )}
    </div>
  );
}
