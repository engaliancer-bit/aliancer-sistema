import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Edit2, Save, X, Clock, DollarSign, List, CheckSquare, FileText, ArrowUp, ArrowDown, UserCog } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ChecklistItem {
  id?: string;
  item_text: string;
  order_index: number;
  is_required: boolean;
  responsible_employee_id: string | null;
  responsible_employee_name?: string;
}

interface Employee {
  id: string;
  name: string;
  role: string;
  active: boolean;
}

interface ServiceTemplate {
  id: string;
  name: string;
  description: string;
  fees: number;
  estimated_time_days: number;
  category: string;
  is_active: boolean;
  is_recurring_monthly: boolean;
  recurring_due_day: number;
  recurring_description: string;
  created_at: string;
}

export default function EngineeringServices() {
  const [services, setServices] = useState<ServiceTemplate[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [companySettings, setCompanySettings] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    fees: '',
    estimated_time_days: '',
    category: 'topografia',
    is_recurring_monthly: false,
    recurring_due_day: '1',
    recurring_description: '',
  });

  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [newChecklistResponsible, setNewChecklistResponsible] = useState('');

  const categories = [
    { value: 'topografia', label: 'Topografia' },
    { value: 'projetos', label: 'Projetos' },
    { value: 'laudos', label: 'Laudos e Pareceres' },
    { value: 'licenciamento', label: 'Licenciamento' },
    { value: 'fiscalizacao', label: 'Fiscalização' },
    { value: 'consultoria', label: 'Consultoria' },
    { value: 'outros', label: 'Outros' },
  ];

  useEffect(() => {
    loadServices();
    loadEmployees();
    loadCompanySettings();
  }, []);

  async function loadCompanySettings() {
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
      console.error('Erro ao carregar configurações:', error);
    }
  }

  async function loadEmployees() {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, role, active')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Erro ao carregar colaboradores:', error);
    }
  }

  async function loadServices() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('engineering_service_templates')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Erro ao carregar serviços:', error);
      alert('Erro ao carregar serviços');
    } finally {
      setLoading(false);
    }
  }

  async function loadChecklistItems(serviceId: string) {
    try {
      const { data, error } = await supabase
        .from('engineering_service_checklist_items')
        .select(`
          *,
          employees:responsible_employee_id (name)
        `)
        .eq('service_template_id', serviceId)
        .order('order_index', { ascending: true });

      if (error) throw error;

      const itemsWithNames = (data || []).map((item: any) => ({
        ...item,
        responsible_employee_name: item.employees?.name || null,
      }));

      setChecklistItems(itemsWithNames);
    } catch (error) {
      console.error('Erro ao carregar checklist:', error);
    }
  }

  function handleAddChecklistItem() {
    if (!newChecklistItem.trim()) return;

    const employee = employees.find(e => e.id === newChecklistResponsible);

    setChecklistItems([
      ...checklistItems,
      {
        item_text: newChecklistItem,
        order_index: checklistItems.length,
        is_required: false,
        responsible_employee_id: newChecklistResponsible || null,
        responsible_employee_name: employee?.name || null,
      },
    ]);
    setNewChecklistItem('');
    setNewChecklistResponsible('');
  }

  function handleRemoveChecklistItem(index: number) {
    setChecklistItems(checklistItems.filter((_, i) => i !== index));
  }

  function handleToggleRequired(index: number) {
    const updated = [...checklistItems];
    updated[index].is_required = !updated[index].is_required;
    setChecklistItems(updated);
  }

  function handleUpdateResponsible(index: number, employeeId: string) {
    const updated = [...checklistItems];
    const employee = employees.find(e => e.id === employeeId);
    updated[index].responsible_employee_id = employeeId || null;
    updated[index].responsible_employee_name = employee?.name || null;
    setChecklistItems(updated);
  }

  function handleMoveChecklistItemUp(index: number) {
    if (index === 0) return;
    const updated = [...checklistItems];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    updated.forEach((item, i) => {
      item.order_index = i;
    });
    setChecklistItems(updated);
  }

  function handleMoveChecklistItemDown(index: number) {
    if (index === checklistItems.length - 1) return;
    const updated = [...checklistItems];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    updated.forEach((item, i) => {
      item.order_index = i;
    });
    setChecklistItems(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const serviceData = {
        name: formData.name,
        description: formData.description,
        fees: parseFloat(formData.fees) || 0,
        estimated_time_days: parseFloat(formData.estimated_time_days) || 0,
        category: formData.category,
        is_active: true,
        is_recurring_monthly: formData.is_recurring_monthly,
        recurring_due_day: formData.is_recurring_monthly ? parseInt(formData.recurring_due_day) || 1 : 1,
        recurring_description: formData.is_recurring_monthly ? formData.recurring_description : '',
      };

      let serviceId: string;

      if (editingId) {
        const { error } = await supabase
          .from('engineering_service_templates')
          .update(serviceData)
          .eq('id', editingId);

        if (error) throw error;
        serviceId = editingId;

        await supabase
          .from('engineering_service_checklist_items')
          .delete()
          .eq('service_template_id', editingId);
      } else {
        const { data, error } = await supabase
          .from('engineering_service_templates')
          .insert(serviceData)
          .select()
          .single();

        if (error) throw error;
        serviceId = data.id;
      }

      if (checklistItems.length > 0) {
        const checklistData = checklistItems.map((item, index) => ({
          service_template_id: serviceId,
          item_text: item.item_text,
          order_index: index,
          is_required: item.is_required,
          responsible_employee_id: item.responsible_employee_id,
        }));

        const { error: checklistError } = await supabase
          .from('engineering_service_checklist_items')
          .insert(checklistData);

        if (checklistError) throw checklistError;
      }

      alert(editingId ? 'Serviço atualizado com sucesso!' : 'Serviço cadastrado com sucesso!');
      resetForm();
      loadServices();
    } catch (error) {
      console.error('Erro ao salvar serviço:', error);
      alert('Erro ao salvar serviço');
    } finally {
      setLoading(false);
    }
  }

  async function handleEdit(service: ServiceTemplate) {
    setEditingId(service.id);
    setFormData({
      name: service.name,
      description: service.description,
      fees: (service.fees || 0).toString(),
      estimated_time_days: (service.estimated_time_days || 0).toString(),
      category: service.category,
      is_recurring_monthly: service.is_recurring_monthly || false,
      recurring_due_day: (service.recurring_due_day || 1).toString(),
      recurring_description: service.recurring_description || '',
    });
    await loadChecklistItems(service.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja excluir este serviço? O checklist também será excluído.')) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('engineering_service_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('Serviço excluído com sucesso!');
      loadServices();
    } catch (error) {
      console.error('Erro ao excluir serviço:', error);
      alert('Erro ao excluir serviço');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      description: '',
      fees: '',
      estimated_time_days: '',
      category: 'topografia',
      is_recurring_monthly: false,
      recurring_due_day: '1',
      recurring_description: '',
    });
    setChecklistItems([]);
    setNewChecklistItem('');
    setEditingId(null);
    setShowForm(false);
  }

  async function generateReport() {
    const doc = new jsPDF();
    let currentY = 14;

    const headerTitle = companySettings.report_header_title || 'Relatório Gerencial';
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
    doc.text('Tabela de Serviços de Engenharia', 14, currentY);
    currentY += 6;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })}`, 14, currentY);
    currentY += 8;

    const tableData = services.map(service => [
      service.name,
      `${service.estimated_time_days || 0} ${(service.estimated_time_days || 0) === 1 ? 'dia' : 'dias'}`,
      `R$ ${(service.fees || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Nome do Serviço', 'Tempo Estimado', 'Honorários']],
      body: tableData,
      headStyles: {
        fillColor: [10, 126, 194],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'left',
        fontSize: 10
      },
      bodyStyles: {
        textColor: [50, 50, 50],
        fontSize: 9
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250]
      },
      columnStyles: {
        0: { cellWidth: 90 },
        1: { cellWidth: 45, halign: 'center' },
        2: { cellWidth: 45, halign: 'right' }
      },
      margin: { left: 14, right: 14 },
      theme: 'grid',
      didDrawPage: (data) => {
        const pageHeight = doc.internal.pageSize.height;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100);
        doc.text(footerText, 14, pageHeight - 10);
        doc.text(`Página ${data.pageNumber}`, 196, pageHeight - 10, { align: 'right' });
      }
    });

    doc.save(`tabela_servicos_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  const groupedServices = services.reduce((acc, service) => {
    if (!acc[service.category]) {
      acc[service.category] = [];
    }
    acc[service.category].push(service);
    return acc;
  }, {} as Record<string, ServiceTemplate[]>);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Tabela de Serviços de Engenharia</h2>
        <div className="flex gap-2">
          <button
            onClick={generateReport}
            disabled={services.length === 0}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Gerar Relatório PDF"
          >
            <FileText className="w-5 h-5" />
            Gerar Relatório
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            {showForm ? 'Cancelar' : 'Novo Serviço'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
          <h3 className="text-xl font-semibold mb-4 text-gray-900">
            {editingId ? 'Editar Serviço' : 'Cadastrar Novo Serviço'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Serviço *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoria
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Honorários (R$)
                  </div>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.fees}
                  onChange={(e) => setFormData({ ...formData, fees: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Tempo Estimado (dias)
                  </div>
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.estimated_time_days}
                  onChange={(e) => setFormData({ ...formData, estimated_time_days: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Descrição detalhada do serviço..."
              />
            </div>

            {formData.category === 'consultoria' && (
              <div className="border-t pt-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-blue-600" />
                    <h4 className="text-lg font-semibold text-gray-900">Cobrança Recorrente Mensal</h4>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="is_recurring_monthly"
                      checked={formData.is_recurring_monthly}
                      onChange={(e) => setFormData({ ...formData, is_recurring_monthly: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="is_recurring_monthly" className="text-sm font-medium text-gray-700">
                      Este serviço tem cobrança mensal recorrente (contrato de consultoria)
                    </label>
                  </div>

                  {formData.is_recurring_monthly && (
                    <div className="space-y-4 pl-7">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Dia do Vencimento *
                          </label>
                          <select
                            value={formData.recurring_due_day}
                            onChange={(e) => setFormData({ ...formData, recurring_due_day: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            required={formData.is_recurring_monthly}
                          >
                            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                              <option key={day} value={day}>
                                Dia {day}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-gray-500 mt-1">
                            Cobranças serão geradas automaticamente neste dia de cada mês
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Valor Mensal (R$)
                          </label>
                          <input
                            type="text"
                            value={formData.fees}
                            disabled
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                            placeholder="Definido acima"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            O valor definido em "Honorários" será cobrado mensalmente
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Descrição para Cobranças (opcional)
                        </label>
                        <textarea
                          value={formData.recurring_description}
                          onChange={(e) => setFormData({ ...formData, recurring_description: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          rows={2}
                          placeholder="Ex: Mensalidade de consultoria ambiental - Contrato 2026"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Se não preenchido, será usado: "Mensalidade de consultoria - MM/AAAA"
                        </p>
                      </div>

                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-sm text-yellow-800">
                          <strong>Atenção:</strong> Ao criar um projeto usando este template, o sistema gerará automaticamente
                          uma cobrança mensal no dia {formData.recurring_due_day} de cada mês, enquanto o projeto estiver ativo.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-3">
                <List className="w-5 h-5 text-gray-700" />
                <h4 className="text-lg font-semibold text-gray-900">Checklist Padrão</h4>
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newChecklistItem}
                    onChange={(e) => setNewChecklistItem(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleAddChecklistItem())}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Digite o item do checklist..."
                  />
                  <button
                    type="button"
                    onClick={handleAddChecklistItem}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <UserCog className="w-4 h-4 text-gray-600" />
                  <select
                    value={newChecklistResponsible}
                    onChange={(e) => setNewChecklistResponsible(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">Sem responsável pré-definido</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} - {emp.role}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {checklistItems.length > 0 && (
                <div className="space-y-2 bg-gray-50 p-4 rounded-lg">
                  {checklistItems.map((item, index) => (
                    <div
                      key={index}
                      className="bg-white p-3 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => handleMoveChecklistItemUp(index)}
                            disabled={index === 0}
                            className={`${
                              index === 0
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-600 hover:text-blue-600'
                            }`}
                            title="Mover para cima"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveChecklistItemDown(index)}
                            disabled={index === checklistItems.length - 1}
                            className={`${
                              index === checklistItems.length - 1
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-600 hover:text-blue-600'
                            }`}
                            title="Mover para baixo"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                        </div>
                        <span className="text-sm text-gray-500 font-semibold w-8">#{index + 1}</span>
                        <button
                          type="button"
                          onClick={() => handleToggleRequired(index)}
                          className={`flex-shrink-0 ${
                            item.is_required ? 'text-blue-600' : 'text-gray-400'
                          }`}
                          title={item.is_required ? 'Marcar como opcional' : 'Marcar como obrigatório'}
                        >
                          <CheckSquare className="w-5 h-5" />
                        </button>
                        <span className="flex-1 text-gray-700">
                          {item.item_text}
                          {item.is_required && (
                            <span className="ml-2 text-xs text-blue-600 font-medium">(obrigatório)</span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveChecklistItem(index)}
                          className="text-red-600 hover:text-red-700"
                          title="Remover item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 ml-14">
                        <UserCog className="w-4 h-4 text-gray-500" />
                        <select
                          value={item.responsible_employee_id || ''}
                          onChange={(e) => handleUpdateResponsible(index, e.target.value)}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Sem responsável</option>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.name} - {emp.role}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                {loading ? 'Salvando...' : editingId ? 'Atualizar Serviço' : 'Cadastrar Serviço'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-6">
        {Object.entries(groupedServices).length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <List className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Nenhum serviço cadastrado ainda.</p>
            <p className="text-gray-500 text-sm mt-2">
              Clique em "Novo Serviço" para começar a cadastrar seus serviços de engenharia.
            </p>
          </div>
        ) : (
          Object.entries(groupedServices).map(([category, categoryServices]) => {
            const categoryLabel = categories.find((c) => c.value === category)?.label || category;
            return (
              <div key={category}>
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <div className="w-1 h-6 bg-blue-600 rounded"></div>
                  {categoryLabel}
                  <span className="text-sm text-gray-500 font-normal">
                    ({categoryServices.length})
                  </span>
                </h3>

                <div className="grid grid-cols-1 gap-4">
                  {categoryServices.map((service) => (
                    <ServiceCard
                      key={service.id}
                      service={service}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

interface ServiceCardProps {
  service: ServiceTemplate;
  onEdit: (service: ServiceTemplate) => void;
  onDelete: (id: string) => void;
}

function ServiceCard({ service, onEdit, onDelete }: ServiceCardProps) {
  const [showChecklist, setShowChecklist] = useState(false);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);

  async function loadChecklist() {
    if (showChecklist) {
      setShowChecklist(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('engineering_service_checklist_items')
        .select('*')
        .eq('service_template_id', service.id)
        .order('order_index', { ascending: true });

      if (error) throw error;
      setChecklistItems(data || []);
      setShowChecklist(true);
    } catch (error) {
      console.error('Erro ao carregar checklist:', error);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
      <div className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <h4 className="text-lg font-semibold text-gray-900">{service.name}</h4>
            {service.description && (
              <p className="text-gray-600 text-sm mt-1">{service.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onEdit(service)}
              className="text-blue-600 hover:text-blue-700 p-2"
              title="Editar"
            >
              <Edit2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => onDelete(service.id)}
              className="text-red-600 hover:text-red-700 p-2"
              title="Excluir"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-1 text-gray-700">
            <DollarSign className="w-4 h-4 text-green-600" />
            <span className="font-medium">
              R$ {(service.fees || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              {service.is_recurring_monthly && (
                <span className="ml-1 text-xs text-blue-600 font-medium">/mês</span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1 text-gray-700">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>
              {service.estimated_time_days || 0} {(service.estimated_time_days || 0) === 1 ? 'dia' : 'dias'}
            </span>
          </div>
        </div>

        {service.is_recurring_monthly && (
          <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-2">
            <p className="text-xs text-blue-800">
              <strong>Cobrança Recorrente:</strong> Todo dia {service.recurring_due_day} de cada mês
            </p>
            {service.recurring_description && (
              <p className="text-xs text-blue-700 mt-1">{service.recurring_description}</p>
            )}
          </div>
        )}

        <button
          onClick={loadChecklist}
          className="mt-3 text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          <List className="w-4 h-4" />
          {showChecklist ? 'Ocultar Checklist' : 'Ver Checklist'}
        </button>

        {showChecklist && (
          <div className="mt-3 bg-gray-50 rounded-lg p-3 border border-gray-200">
            {checklistItems.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhum item no checklist</p>
            ) : (
              <ul className="space-y-2">
                {checklistItems.map((item) => (
                  <li key={item.id} className="text-sm">
                    <div className="flex items-start gap-2">
                      <CheckSquare className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                        item.is_required ? 'text-blue-600' : 'text-gray-400'
                      }`} />
                      <div className="flex-1">
                        <span className="text-gray-700">
                          {item.item_text}
                          {item.is_required && (
                            <span className="ml-2 text-xs text-blue-600 font-medium">(obrigatório)</span>
                          )}
                        </span>
                        {item.responsible_employee_name && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-gray-600">
                            <UserCog className="w-3 h-3" />
                            <span>Responsável: {item.responsible_employee_name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
