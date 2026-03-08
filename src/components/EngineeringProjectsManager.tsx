import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  FileText,
  DollarSign,
  Calendar,
  MapPin,
  User,
  Users,
  Building,
  CheckCircle2,
  Circle,
  Clock,
  TrendingUp,
  Download,
  AlertCircle,
  Home,
  CheckSquare,
  UserCog,
  MessageCircle,
  Printer,
  RotateCcw
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ProjectIADocuments from './engineering/ProjectIADocuments';
import EngineeringClientStatement from './EngineeringClientStatement';
import WhatsAppBillingModal from './engineering/WhatsAppBillingModal';
import { cacheManager, CACHE_TTL } from '../lib/cacheManager';
import { generateProjectPaymentReceipt } from './engineering/ProjectPaymentReceiptGenerator';

interface Customer {
  id: string;
  name: string;
  cpf: string;
  phone?: string;
}

interface Property {
  id: string;
  customer_id: string;
  name: string;
  property_type: 'rural' | 'urbano';
  municipality: string;
  state: string;
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
  is_recurring_monthly?: boolean;
  recurring_due_day?: number;
  recurring_description?: string;
}

interface ProjectService {
  id?: string;
  service_id: string;
  service_name?: string;
  suggested_value: number;
  actual_value: number;
  description: string;
}

interface ProjectCost {
  id?: string;
  cost_type: string;
  description: string;
  value: number;
  date: string;
}

interface ProjectPayment {
  id?: string;
  payment_date: string;
  value: number;
  payment_method: string;
  conta_caixa_id: string | null;
  notes: string;
}

interface ProjectStage {
  id?: string;
  stage_name: string;
  description: string;
  status: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
  order_index: number;
  estimated_days: number;
  start_date: string | null;
  due_date: string | null;
  completed_date: string | null;
  responsible_employee_id: string | null;
  responsible_employee_name?: string;
}

interface StageHistory {
  id: string;
  stage_id: string;
  project_id: string;
  old_status: string;
  new_status: string;
  changed_by_employee_id: string | null;
  changed_at: string;
  notes: string;
  stage_name?: string;
  employee_name?: string;
}

interface EngineeringProject {
  id: string;
  name: string;
  customer_id: string;
  customer_name?: string;
  property_id: string;
  property_name?: string;
  property_type: 'rural' | 'urbano';
  start_date: string;
  estimated_completion_date: string | null;
  actual_completion_date: string | null;
  status: 'a_iniciar' | 'em_desenvolvimento' | 'em_correcao' | 'finalizado' | 'entregue' | 'em_exigencia' | 'registrado';
  has_deadline: boolean;
  deadline_date: string | null;
  total_suggested_value: number;
  total_actual_value: number;
  total_additional_costs: number;
  total_concrete_markers: number;
  grand_total: number;
  total_received: number;
  balance: number;
  notes: string;
  created_at: string;
  responsible_employee_id: string | null;
  responsible_employee_name?: string;
  exigency_description: string;
  exigency_deadline: string | null;
  registered_date: string | null;
  car_rectification_requested: boolean;
}

interface ProjectToCollect {
  id: string;
  project_name: string;
  customer_name: string;
  customer_id: string;
  balance_due: number;
  grand_total: number;
  total_received: number;
}

export default function EngineeringProjectsManager() {
  const [projects, setProjects] = useState<EngineeringProject[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [serviceTemplates, setServiceTemplates] = useState<ServiceTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<EngineeringProject | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'consultoria' | 'to_collect' | 'client_statement'>('active');
  const [detailTab, setDetailTab] = useState<'checklist' | 'financeiro' | 'documentos_ia'>('checklist');
  const [projectsToCollect, setProjectsToCollect] = useState<ProjectToCollect[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [projectProgress, setProjectProgress] = useState<Record<string, { completed: number; total: number }>>({});
  const [companySettings, setCompanySettings] = useState<Record<string, string>>({});

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    customer_id: '',
    property_id: '',
    property_type: 'urbano' as 'rural' | 'urbano',
    start_date: new Date().toISOString().split('T')[0],
    estimated_completion_date: '',
    has_deadline: false,
    deadline_date: '',
    notes: '',
    is_recurring: false,
    recurring_due_day: 10,
  });

  // Project detail data
  const [projectServices, setProjectServices] = useState<ProjectService[]>([]);
  const [projectCosts, setProjectCosts] = useState<ProjectCost[]>([]);
  const [projectPayments, setProjectPayments] = useState<ProjectPayment[]>([]);
  const [projectStages, setProjectStages] = useState<ProjectStage[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [stageHistory, setStageHistory] = useState<StageHistory[]>([]);

  // WhatsApp Billing
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [selectedProjectForBilling, setSelectedProjectForBilling] = useState<{
    id: string;
    customerName: string;
    customerPhone: string;
  } | null>(null);

  // Detectar se é projeto de consultoria
  const isConsultoriaProject = useMemo(() => {
    return selectedServices.some(serviceId => {
      const template = serviceTemplates.find(t => t.id === serviceId);
      return template?.category === 'consultoria';
    });
  }, [selectedServices, serviceTemplates]);

  // Financial form
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [showCostForm, setShowCostForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [newService, setNewService] = useState({
    service_id: '',
    suggested_value: '',
    actual_value: '',
    description: '',
  });

  const [editServiceData, setEditServiceData] = useState({
    suggested_value: '',
    actual_value: '',
    description: '',
  });

  const [newCost, setNewCost] = useState({
    cost_type: 'taxa',
    description: '',
    value: '',
    date: new Date().toISOString().split('T')[0],
  });

  const [newPayment, setNewPayment] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    value: '',
    payment_method: 'pix',
    conta_caixa_id: '',
    notes: '',
  });

  const [accounts, setAccounts] = useState<Array<{ id: string; nome: string }>>([]);

  useEffect(() => {
    loadProjects();
    loadProjectsToCollect();
    loadCustomers();
    loadEmployees();
    loadServiceTemplates();
    loadAccounts();
    loadCompanySettings();
  }, []);

  // Cleanup quando o formulário fecha
  useEffect(() => {
    if (!showForm) {
      // Reseta o estado de edição
      setEditingId(null);
    }
  }, [showForm]);

  // REMOVIDO: useEffect que causava travamento ao selecionar cliente
  // Agora usamos handleCustomerChange que é otimizado e não trava a UI

  async function loadProjects() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('engineering_projects')
        .select(`
          *,
          customers (name),
          properties (name, property_type),
          employees:responsible_employee_id (name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const projectsWithRelations = (data || []).map((p: any) => ({
        ...p,
        customer_name: p.customers?.name || 'Cliente não encontrado',
        property_name: p.properties?.name || 'Imóvel não encontrado',
        responsible_employee_name: p.employees?.name || null,
      }));

      // Sort projects: "em_exigencia" first, then others
      const sortedProjects = projectsWithRelations.sort((a: any, b: any) => {
        if (a.status === 'em_exigencia' && b.status !== 'em_exigencia') return -1;
        if (a.status !== 'em_exigencia' && b.status === 'em_exigencia') return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setProjects(sortedProjects);

      // Load progress for each project
      await loadProjectsProgress(projectsWithRelations.map((p: any) => p.id));
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      alert('Erro ao carregar projetos');
    } finally {
      setLoading(false);
    }
  }

  async function loadProjectsToCollect() {
    try {
      const { data, error } = await supabase
        .from('projects_to_collect')
        .select('*');

      if (error) throw error;
      setProjectsToCollect(data || []);
    } catch (error) {
      console.error('Erro ao carregar projetos a cobrar:', error);
    }
  }

  function getDaysUntilDeadline(deadline: string | null): number | null {
    if (!deadline) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadlineDate = new Date(deadline);
    deadlineDate.setHours(0, 0, 0, 0);
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  function getUrgencyLevel(daysRemaining: number | null): 'vencido' | 'urgente' | 'atencao' | 'normal' {
    if (daysRemaining === null) return 'normal';
    if (daysRemaining <= 0) return 'vencido';
    if (daysRemaining <= 5) return 'urgente';
    if (daysRemaining <= 10) return 'atencao';
    return 'normal';
  }

  function getUrgencyColor(urgency: 'vencido' | 'urgente' | 'atencao' | 'normal'): string {
    switch (urgency) {
      case 'vencido': return 'bg-red-600 text-white border-red-700';
      case 'urgente': return 'bg-red-500 text-white border-red-600';
      case 'atencao': return 'bg-orange-400 text-white border-orange-500';
      case 'normal': return 'bg-red-100 text-red-800 border-red-300';
    }
  }

  async function loadProjectsProgress(projectIds: string[]) {
    try {
      const { data, error } = await supabase
        .from('engineering_project_stages')
        .select('project_id, status')
        .in('project_id', projectIds);

      if (error) throw error;

      // Calculate progress for each project
      const progressMap: Record<string, { completed: number; total: number }> = {};

      projectIds.forEach(projectId => {
        const stages = (data || []).filter((s: any) => s.project_id === projectId);
        const completed = stages.filter((s: any) => s.status === 'concluida').length;
        const total = stages.length;

        progressMap[projectId] = { completed, total };
      });

      setProjectProgress(progressMap);
    } catch (error) {
      console.error('Erro ao carregar progresso dos projetos:', error);
    }
  }

  async function loadCustomers() {
    try {
      const cached = cacheManager.get<Customer[]>('eng_customers');
      if (cached) { setCustomers(cached); return; }

      const { data, error } = await supabase
        .from('customers')
        .select('id, name, cpf, phone')
        .order('name');

      if (error) throw error;
      const result = data || [];
      cacheManager.setMemory('eng_customers', result, CACHE_TTL.MEDIUM);
      setCustomers(result);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  }

  async function loadEmployees() {
    try {
      const cached = cacheManager.get<Employee[]>('eng_employees');
      if (cached) { setEmployees(cached); return; }

      const { data, error } = await supabase
        .from('employees')
        .select('id, name, role, active')
        .eq('active', true)
        .eq('business_unit', 'engineering')
        .order('name');

      if (error) throw error;
      const result = data || [];
      cacheManager.setMemory('eng_employees', result, CACHE_TTL.MEDIUM);
      setEmployees(result);
    } catch (error) {
      console.error('Erro ao carregar colaboradores:', error);
    }
  }

  const loadCustomerProperties = useCallback(async (customerId: string) => {
    if (!customerId) {
      setProperties([]);
      return;
    }

    setLoadingProperties(true);
    try {
      // Pequeno delay para permitir que a UI atualize antes da query
      await new Promise(resolve => setTimeout(resolve, 0));

      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('customer_id', customerId)
        .order('name');

      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error('Erro ao carregar imóveis:', error);
    } finally {
      setLoadingProperties(false);
    }
  }, []);

  // Handler otimizado para mudança de cliente
  const handleCustomerChange = useCallback((customerId: string) => {
    // 1. Atualiza o estado imediatamente (não trava UI)
    setFormData(prev => ({
      ...prev,
      customer_id: customerId,
      property_id: '', // Reseta o imóvel selecionado
    }));

    // 2. Busca properties em background (não trava UI)
    if (customerId) {
      loadCustomerProperties(customerId);
    } else {
      setProperties([]);
    }
  }, [loadCustomerProperties]);

  async function loadServiceTemplates() {
    try {
      const cached = cacheManager.get<ServiceTemplate[]>('eng_service_templates');
      if (cached) { setServiceTemplates(cached); return; }

      const { data, error } = await supabase
        .from('engineering_service_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      const result = data || [];
      cacheManager.setMemory('eng_service_templates', result, CACHE_TTL.MEDIUM);
      setServiceTemplates(result);
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
    }
  }

  async function loadAccounts() {
    try {
      const cached = cacheManager.get<Array<{ id: string; nome: string }>>('eng_accounts');
      if (cached) { setAccounts(cached); return; }

      const { data, error } = await supabase
        .from('contas_caixa')
        .select('id, nome')
        .order('nome');

      if (error) throw error;
      const result = data || [];
      cacheManager.setMemory('eng_accounts', result, CACHE_TTL.LONG);
      setAccounts(result);
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
    }
  }

  async function loadCompanySettings() {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('setting_key, setting_value');

      if (error) throw error;

      if (data) {
        const settingsMap: Record<string, string> = {};
        data.forEach((row: { setting_key: string; setting_value: string }) => {
          if (row.setting_key && row.setting_value !== null) {
            settingsMap[row.setting_key] = row.setting_value;
          }
        });
        setCompanySettings(settingsMap);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações da empresa:', error);
    }
  }

  async function loadProjectDetails(projectId: string) {
    try {
      // Load services
      const { data: services, error: servicesError } = await supabase
        .from('engineering_project_services')
        .select(`
          *,
          engineering_service_templates (name)
        `)
        .eq('project_id', projectId);

      if (servicesError) throw servicesError;

      setProjectServices(
        (services || []).map((s: any) => ({
          ...s,
          service_name: s.engineering_service_templates?.name || 'Serviço não encontrado',
        }))
      );

      // Load costs
      const { data: costs, error: costsError } = await supabase
        .from('engineering_project_costs')
        .select('*')
        .eq('project_id', projectId);

      if (costsError) throw costsError;
      setProjectCosts(costs || []);

      // Load payments
      const { data: payments, error: paymentsError } = await supabase
        .from('engineering_project_payments')
        .select('*')
        .eq('project_id', projectId)
        .order('payment_date', { ascending: false });

      if (paymentsError) throw paymentsError;
      setProjectPayments(payments || []);

      // Load stages (checklist)
      const { data: stages, error: stagesError } = await supabase
        .from('engineering_project_stages')
        .select(`
          *,
          employees:responsible_employee_id (name)
        `)
        .eq('project_id', projectId)
        .order('order_index');

      if (stagesError) throw stagesError;
      setProjectStages((stages || []).map((s: any) => ({
        ...s,
        responsible_employee_name: s.employees?.name || null,
      })));
    } catch (error) {
      console.error('Erro ao carregar detalhes do projeto:', error);
      alert('Erro ao carregar detalhes do projeto');
    }
  }

  async function handleChangeProjectResponsible(projectId: string, employeeId: string | null) {
    try {
      const { error } = await supabase
        .from('engineering_projects')
        .update({ responsible_employee_id: employeeId })
        .eq('id', projectId);

      if (error) throw error;

      await loadProjects();
      if (selectedProject) {
        await loadProjectDetails(projectId);
        const updatedProject = projects.find(p => p.id === projectId);
        if (updatedProject) {
          setSelectedProject({...updatedProject, responsible_employee_id: employeeId});
        }
      }
    } catch (error) {
      console.error('Erro ao alterar responsável do projeto:', error);
      alert('Erro ao alterar responsável do projeto');
    }
  }

  async function handleChangeProjectStatus(projectId: string, newStatus: string) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    // Validar que o status é válido
    const validStatuses = ['a_iniciar', 'em_desenvolvimento', 'em_correcao', 'finalizado', 'entregue', 'em_exigencia', 'registrado'];
    if (!validStatuses.includes(newStatus)) {
      console.error('Status inválido:', newStatus);
      alert(`Status inválido: ${newStatus}. Por favor, atualize a página (Ctrl+Shift+R) e tente novamente.`);
      return;
    }

    // If changing to "em_exigencia", ask for description and deadline
    if (newStatus === 'em_exigencia') {
      const exigencyDesc = prompt('Digite a descrição das exigências:');
      if (!exigencyDesc) return;

      const deadlineStr = prompt('Digite o prazo para resolver as exigências (formato: DD/MM/AAAA):');
      if (!deadlineStr) return;

      // Parse date from DD/MM/YYYY to YYYY-MM-DD
      const parts = deadlineStr.split('/');
      if (parts.length !== 3) {
        alert('Data inválida. Use o formato DD/MM/AAAA');
        return;
      }

      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      const deadline = `${year}-${month}-${day}`;

      // Validate date
      const deadlineDate = new Date(deadline);
      if (isNaN(deadlineDate.getTime())) {
        alert('Data inválida.');
        return;
      }

      try {
        const { error } = await supabase
          .from('engineering_projects')
          .update({
            status: newStatus,
            exigency_description: exigencyDesc,
            exigency_deadline: deadline
          })
          .eq('id', projectId);

        if (error) throw error;
        await loadProjects();
      } catch (error) {
        console.error('Erro ao alterar status:', error);
        alert('Erro ao alterar status do projeto');
      }
      return;
    }

    // If changing FROM "em_exigencia" to another status, clear exigency fields
    if (project.status === 'em_exigencia' && newStatus !== 'em_exigencia') {
      try {
        const { error } = await supabase
          .from('engineering_projects')
          .update({
            status: newStatus,
            exigency_description: '',
            exigency_deadline: null
          })
          .eq('id', projectId);

        if (error) throw error;
        await loadProjects();
        await loadProjectsToCollect();
      } catch (error) {
        console.error('Erro ao alterar status:', error);
        alert('Erro ao alterar status do projeto');
      }
      return;
    }

    // If changing to "registrado", handle special flow
    if (newStatus === 'registrado') {
      const registeredDate = new Date().toISOString().split('T')[0];

      try {
        // Update status to registered
        const { error } = await supabase
          .from('engineering_projects')
          .update({
            status: newStatus,
            registered_date: registeredDate
          })
          .eq('id', projectId);

        if (error) throw error;

        // Ask if user wants to update property registration
        if (confirm('Projeto marcado como registrado! Deseja atualizar o cadastro do imóvel agora?')) {
          // Reload properties and redirect to properties tab
          alert('Por favor, vá até a aba "Imóveis" para atualizar o cadastro do imóvel.');
        }

        // Ask if user wants to start CAR rectification project
        if (confirm('Deseja iniciar o projeto de retificação do CAR desta parcela?')) {
          // Mark flag
          await supabase
            .from('engineering_projects')
            .update({ car_rectification_requested: true })
            .eq('id', projectId);

          alert('Por favor, vá até "Projetos de Engenharia" para cadastrar o novo projeto de retificação do CAR.');
        }

        await loadProjects();
      } catch (error) {
        console.error('Erro ao marcar como registrado:', error);
        alert('Erro ao marcar projeto como registrado');
      }
      return;
    }

    // For other status changes, just update
    try {
      const { error } = await supabase
        .from('engineering_projects')
        .update({ status: newStatus })
        .eq('id', projectId);

      if (error) throw error;
      await loadProjects();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      alert('Erro ao alterar status do projeto');
    }
  }

  async function handleChangeStageResponsible(stageId: string, employeeId: string | null) {
    try {
      const { error } = await supabase
        .from('engineering_project_stages')
        .update({ responsible_employee_id: employeeId })
        .eq('id', stageId);

      if (error) throw error;

      if (selectedProject) {
        await loadProjectDetails(selectedProject.id);
      }
    } catch (error) {
      console.error('Erro ao alterar responsável da etapa:', error);
      alert('Erro ao alterar responsável da etapa');
    }
  }

  function handleNewProject() {
    setEditingId(null);
    setFormData({
      name: '',
      customer_id: '',
      property_id: '',
      property_type: 'urbano',
      start_date: new Date().toISOString().split('T')[0],
      estimated_completion_date: '',
      has_deadline: false,
      deadline_date: '',
      notes: '',
    });
    setSelectedServices([]);
    setShowForm(true);
  }

  const handleEdit = useCallback((project: EngineeringProject) => {
    setEditingId(project.id);
    setFormData({
      name: project.name,
      customer_id: project.customer_id,
      property_id: project.property_id,
      property_type: project.property_type,
      start_date: project.start_date,
      estimated_completion_date: project.estimated_completion_date || '',
      has_deadline: project.has_deadline,
      deadline_date: project.deadline_date || '',
      notes: project.notes || '',
    });

    if (project.customer_id) {
      loadCustomerProperties(project.customer_id);
    }

    setShowForm(true);
  }, [loadCustomerProperties]);

  const handleOpenWhatsAppBilling = useCallback((project: EngineeringProject) => {
    const customer = customers.find(c => c.id === project.customer_id);
    if (!customer) {
      alert('Cliente não encontrado');
      return;
    }

    if (!customer.phone) {
      alert('Cliente não possui telefone cadastrado');
      return;
    }

    if (!project.balance || project.balance <= 0) {
      alert('Este projeto não possui saldo devedor');
      return;
    }

    setSelectedProjectForBilling({
      id: project.id,
      customerName: customer.name,
      customerPhone: customer.phone
    });
    setShowWhatsAppModal(true);
  }, [customers]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      // Se houver apenas um serviço selecionado, definir como template_id
      const template_id = selectedServices.length === 1 ? selectedServices[0] : null;

      // Se for consultoria com recorrência, atualizar o template
      if (isConsultoriaProject && formData.is_recurring && template_id) {
        const { error: templateError } = await supabase
          .from('engineering_service_templates')
          .update({
            is_recurring_monthly: true,
            recurring_due_day: formData.recurring_due_day || 10,
            recurring_description: `Cobrança mensal recorrente - vence dia ${formData.recurring_due_day || 10}`,
          })
          .eq('id', template_id);

        if (templateError) {
          console.error('Erro ao atualizar template:', templateError);
        }
      }

      const projectData = {
        name: formData.name,
        customer_id: formData.customer_id,
        property_id: formData.property_id || null,
        property_type: formData.property_type,
        start_date: formData.start_date,
        estimated_completion_date: formData.estimated_completion_date || null,
        has_deadline: formData.has_deadline,
        deadline_date: formData.has_deadline ? formData.deadline_date : null,
        notes: formData.notes,
        template_id: template_id,
        status: editingId ? undefined : 'a_iniciar',
      };

      if (editingId) {
        const { error } = await supabase
          .from('engineering_projects')
          .update(projectData)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        console.log('Serviços selecionados:', selectedServices);

        const { data: newProject, error } = await supabase
          .from('engineering_projects')
          .insert([projectData])
          .select()
          .single();

        if (error) throw error;

        console.log('Projeto criado:', newProject);

        // Add selected services
        if (selectedServices.length > 0 && newProject) {
          console.log('Templates disponíveis:', serviceTemplates);

          const servicesToInsert = selectedServices.map((serviceId) => {
            const template = serviceTemplates.find((s) => s.id === serviceId);
            console.log(`Template encontrado para ${serviceId}:`, template);

            // Garantir que fees seja convertido para número
            const fees = template?.fees ? Number(template.fees) : 0;

            return {
              project_id: newProject.id,
              service_id: serviceId,
              suggested_value: fees,
              actual_value: fees,
              description: template?.name || '',
            };
          });

          console.log('Inserindo serviços:', servicesToInsert);

          const { error: servicesError } = await supabase
            .from('engineering_project_services')
            .insert(servicesToInsert);

          if (servicesError) {
            console.error('Erro ao inserir serviços:', servicesError);
            throw servicesError;
          }

          // Create checklist stages from selected services
          const stagesToInsert: any[] = [];
          let orderIndex = 0;

          // For each selected service, get its checklist items and create stages
          for (const serviceId of selectedServices) {
            const template = serviceTemplates.find((s) => s.id === serviceId);

            // Get checklist items for this service
            const { data: checklistItems, error: checklistError } = await supabase
              .from('engineering_service_checklist_items')
              .select('*')
              .eq('service_template_id', serviceId)
              .order('order_index');

            if (checklistError) {
              console.error('Erro ao buscar checklist items:', checklistError);
            }

            if (checklistItems && checklistItems.length > 0) {
              // Create a stage for each checklist item
              checklistItems.forEach((item: any) => {
                stagesToInsert.push({
                  project_id: newProject.id,
                  stage_name: item.item_text,
                  description: `Etapa do serviço: ${template?.name || ''}`,
                  status: 'pendente',
                  order_index: orderIndex++,
                  estimated_days: Math.ceil((template?.estimated_time_days || 5) / checklistItems.length),
                });
              });
            } else {
              // Fallback: create a single stage with the service name
              stagesToInsert.push({
                project_id: newProject.id,
                stage_name: template?.name || '',
                description: template?.description || '',
                status: 'pendente',
                order_index: orderIndex++,
                estimated_days: template?.estimated_time_days || 5,
              });
            }
          }

          console.log('Inserindo etapas:', stagesToInsert);

          if (stagesToInsert.length > 0) {
            const { error: stagesError } = await supabase
              .from('engineering_project_stages')
              .insert(stagesToInsert);

            if (stagesError) {
              console.error('Erro ao inserir etapas:', stagesError);
              throw stagesError;
            }

            console.log('Etapas criadas com sucesso!');
          }
        } else {
          console.log('Nenhum serviço selecionado ou projeto não foi criado');
        }
      }

      await loadProjects();
      setShowForm(false);
    } catch (error: any) {
      console.error('Erro ao salvar projeto:', error);
      alert('Erro ao salvar projeto: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este projeto?')) return;

    try {
      const { error } = await supabase
        .from('engineering_projects')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadProjects();
    } catch (error) {
      console.error('Erro ao excluir projeto:', error);
      alert('Erro ao excluir projeto');
    }
  }, []);

  const handleViewDetails = useCallback((project: EngineeringProject) => {
    setSelectedProject(project);
    loadProjectDetails(project.id);
    setShowDetailModal(true);
  }, []);

  function handleToggleStage(stageId: string, currentStatus: string) {
    const newStatus = currentStatus === 'concluida' ? 'pendente' : 'concluida';

    // Update local state only
    setProjectStages(prevStages =>
      prevStages.map(stage => {
        if (stage.id === stageId) {
          return {
            ...stage,
            status: newStatus as 'pendente' | 'em_andamento' | 'concluida' | 'cancelada',
            completed_date: newStatus === 'concluida'
              ? new Date().toISOString().split('T')[0]
              : null
          };
        }
        return stage;
      })
    );

    setHasUnsavedChanges(true);
  }

  async function handleSaveProgress() {
    if (!selectedProject) return;

    setLoading(true);
    try {
      // Get original stages to compare changes
      const { data: originalStages } = await supabase
        .from('engineering_project_stages')
        .select('id, status')
        .in('id', projectStages.map(s => s.id!));

      // Save all stages with their current status and track history
      for (const stage of projectStages) {
        const originalStage = originalStages?.find(os => os.id === stage.id);
        const oldStatus = originalStage?.status || 'pendente';
        const newStatus = stage.status;

        const updateData: any = {
          status: stage.status,
          completed_date: stage.completed_date
        };

        const { error } = await supabase
          .from('engineering_project_stages')
          .update(updateData)
          .eq('id', stage.id);

        if (error) throw error;

        // If status changed, record in history
        if (oldStatus !== newStatus) {
          await supabase
            .from('engineering_project_stage_history')
            .insert({
              stage_id: stage.id,
              project_id: selectedProject.id,
              old_status: oldStatus,
              new_status: newStatus,
              changed_by_employee_id: selectedProject.responsible_employee_id,
              notes: newStatus === 'concluida' ? 'Etapa concluída' : 'Status alterado'
            });
        }
      }

      setHasUnsavedChanges(false);
      alert('Progresso salvo com sucesso!');

      // Update progress in the project list
      const completed = projectStages.filter(s => s.status === 'concluida').length;
      const total = projectStages.length;
      setProjectProgress(prev => ({
        ...prev,
        [selectedProject.id]: { completed, total }
      }));

      // Reload to ensure consistency
      await loadProjectDetails(selectedProject.id);
    } catch (error) {
      console.error('Erro ao salvar progresso:', error);
      alert('Erro ao salvar progresso');
    } finally {
      setLoading(false);
    }
  }

  async function handleEditService(service: ProjectService) {
    setEditingServiceId(service.id!);
    setEditServiceData({
      suggested_value: service.suggested_value.toString(),
      actual_value: service.actual_value.toString(),
      description: service.description
    });
  }

  async function handleUpdateService(serviceId: string) {
    if (!selectedProject) return;

    // Validar campos numéricos
    const suggestedValue = parseFloat(editServiceData.suggested_value);
    const actualValue = parseFloat(editServiceData.actual_value);

    if (isNaN(suggestedValue) || isNaN(actualValue)) {
      alert('Por favor, insira valores numéricos válidos');
      return;
    }

    if (suggestedValue < 0 || actualValue < 0) {
      alert('Os valores não podem ser negativos');
      return;
    }

    try {
      const { error } = await supabase
        .from('engineering_project_services')
        .update({
          suggested_value: suggestedValue,
          actual_value: actualValue,
          description: editServiceData.description || ''
        })
        .eq('id', serviceId);

      if (error) throw error;

      await loadProjectDetails(selectedProject.id);
      await loadProjects();
      setEditingServiceId(null);
      alert('Serviço atualizado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao atualizar serviço:', error);
      const errorMsg = error?.message || JSON.stringify(error);
      alert(`Erro ao atualizar serviço: ${errorMsg}`);
    }
  }

  async function loadStageHistory(projectId: string) {
    try {
      const { data, error } = await supabase
        .from('engineering_project_stage_history')
        .select(`
          *,
          engineering_project_stages (stage_name),
          employees:changed_by_employee_id (name)
        `)
        .eq('project_id', projectId)
        .order('changed_at', { ascending: false });

      if (error) throw error;

      const historyWithRelations = (data || []).map((h: any) => ({
        ...h,
        stage_name: h.engineering_project_stages?.stage_name || 'Etapa não encontrada',
        employee_name: h.employees?.name || 'Sistema'
      }));

      setStageHistory(historyWithRelations);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      alert('Erro ao carregar histórico');
    }
  }

  async function handleAddService(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProject) return;

    try {
      const { error } = await supabase
        .from('engineering_project_services')
        .insert([
          {
            project_id: selectedProject.id,
            service_id: newService.service_id,
            suggested_value: parseFloat(newService.suggested_value),
            actual_value: parseFloat(newService.actual_value),
            description: newService.description,
          },
        ]);

      if (error) throw error;

      await loadProjectDetails(selectedProject.id);
      await loadProjects();
      setShowServiceForm(false);
      setNewService({
        service_id: '',
        suggested_value: '',
        actual_value: '',
        description: '',
      });
    } catch (error) {
      console.error('Erro ao adicionar serviço:', error);
      alert('Erro ao adicionar serviço');
    }
  }

  async function handleAddCost(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProject) return;

    // Validar campos
    if (!newCost.description.trim()) {
      alert('Por favor, insira uma descrição para o custo');
      return;
    }

    const costValue = parseFloat(newCost.value);
    if (isNaN(costValue) || costValue <= 0) {
      alert('Por favor, insira um valor válido maior que zero');
      return;
    }

    if (!newCost.date) {
      alert('Por favor, selecione uma data');
      return;
    }

    try {
      const { error } = await supabase
        .from('engineering_project_costs')
        .insert([
          {
            project_id: selectedProject.id,
            cost_type: newCost.cost_type,
            description: newCost.description.trim(),
            value: costValue,
            date: newCost.date,
          },
        ]);

      if (error) throw error;

      await loadProjectDetails(selectedProject.id);
      await loadProjects();
      setShowCostForm(false);
      setNewCost({
        cost_type: 'taxa',
        description: '',
        value: '',
        date: new Date().toISOString().split('T')[0],
      });
    } catch (error: any) {
      console.error('Erro ao adicionar custo:', error);
      const errorMsg = error?.message || JSON.stringify(error);
      alert(`Erro ao adicionar custo: ${errorMsg}`);
    }
  }

  async function handleAddPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProject) return;

    try {
      const paymentData = {
        project_id: selectedProject.id,
        payment_date: newPayment.payment_date,
        value: parseFloat(newPayment.value),
        payment_method: newPayment.payment_method,
        conta_caixa_id: newPayment.conta_caixa_id || null,
        notes: newPayment.notes || null,
      };

      console.log('Tentando inserir recebimento:', paymentData);

      const { error } = await supabase
        .from('engineering_project_payments')
        .insert([paymentData]);

      if (error) {
        console.error('Erro detalhado:', error);
        throw error;
      }

      await loadProjectDetails(selectedProject.id);
      await loadProjects();
      await loadProjectsToCollect();
      setShowPaymentForm(false);
      setNewPayment({
        payment_date: new Date().toISOString().split('T')[0],
        value: '',
        payment_method: 'pix',
        conta_caixa_id: '',
        notes: '',
      });
      alert('Recebimento adicionado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao adicionar recebimento:', error);
      const errorMsg = error?.message || JSON.stringify(error);
      alert(`Erro ao adicionar recebimento: ${errorMsg}`);
    }
  }

  async function handleGenerateReceipt(payment: ProjectPayment) {
    if (!selectedProject) return;
    try {
      const totalReceived = projectPayments.reduce((sum, p) => sum + p.value, 0);
      const grandTotal = selectedProject.grand_total || 0;
      const balance = Math.max(0, grandTotal - totalReceived);

      let accountName = 'Não informado';
      if (payment.conta_caixa_id) {
        const account = accounts.find(a => a.id === payment.conta_caixa_id);
        if (account) accountName = account.nome;
      }

      await generateProjectPaymentReceipt(
        {
          paymentId: payment.id!,
          paymentDate: payment.payment_date,
          value: payment.value,
          paymentMethod: payment.payment_method,
          accountName,
          notes: payment.notes || undefined,
          projectName: selectedProject.name,
          customerName: selectedProject.customer_name || 'Cliente',
          propertyName: selectedProject.property_name || undefined,
          grandTotal,
          totalReceived,
          balance,
        },
        {
          logo_url: companySettings.company_logo_url,
          company_name: companySettings.company_trade_name || companySettings.company_name,
          company_address: companySettings.company_address,
          company_phone: companySettings.company_phone,
          company_email: companySettings.company_email,
          company_cnpj: companySettings.company_cnpj,
        }
      );
    } catch (error) {
      console.error('Erro ao gerar recibo:', error);
      alert('Erro ao gerar recibo de recebimento.');
    }
  }

  async function handleReversePayment(payment: ProjectPayment) {
    if (!selectedProject) return;
    const formattedDate = new Date(payment.payment_date).toLocaleDateString('pt-BR');
    const formattedValue = payment.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const confirmed = window.confirm(
      `Deseja estornar o recebimento de R$ ${formattedValue} registrado em ${formattedDate}?\n\nEsta ação removerá o registro permanentemente e não pode ser desfeita.`
    );
    if (!confirmed) return;
    try {
      const { error } = await supabase
        .from('engineering_project_payments')
        .delete()
        .eq('id', payment.id!);
      if (error) throw error;
      await loadProjectDetails(selectedProject.id);
      await loadProjects();
      await loadProjectsToCollect();
      alert('Recebimento estornado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao estornar recebimento:', error);
      alert(`Erro ao estornar recebimento: ${error?.message || JSON.stringify(error)}`);
    }
  }

  async function handleMarkAsComplete() {
    if (!selectedProject) return;

    // Check if there are unsaved changes
    if (hasUnsavedChanges) {
      alert('Você tem alterações não salvas no checklist. Por favor, salve o progresso antes de finalizar o projeto.');
      return;
    }

    // Check if all stages are completed
    const allStagesCompleted = projectStages.every(stage => stage.status === 'concluida');
    if (!allStagesCompleted) {
      alert('Todas as etapas do checklist devem estar concluídas antes de marcar o projeto como finalizado.');
      return;
    }

    if (!confirm('Tem certeza que deseja marcar este projeto como finalizado?')) return;

    try {
      const { error } = await supabase
        .from('engineering_projects')
        .update({
          status: 'finalizado',
          actual_completion_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', selectedProject.id);

      if (error) throw error;

      await loadProjects();
      await loadProjectsToCollect();
      setShowDetailModal(false);
      alert('Projeto marcado como finalizado!');
    } catch (error) {
      console.error('Erro ao finalizar projeto:', error);
      alert('Erro ao finalizar projeto');
    }
  }

  async function exportFinancialStatement() {
    if (!selectedProject) return;

    const doc = new jsPDF();
    let currentY = 14;

    const headerTitle = 'EXTRATO FINANCEIRO DO PROJETO';
    const headerSubtitle = companySettings.report_header_subtitle || 'Aliancer Engenharia e Topografia';
    const showCompanyInfo = companySettings.report_show_company_info === 'true';
    const showLogo = companySettings.report_show_logo === 'true';
    const companyName = companySettings.company_trade_name || companySettings.company_name || 'Aliancer Engenharia e Topografia';
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
    currentY += 6;

    if (showCompanyInfo) {
      const companyInfo: string[] = [];
      companyInfo.push(companyName);

      const addressParts: string[] = [];
      if (companySettings.company_street) addressParts.push(companySettings.company_street);
      if (companySettings.company_number) addressParts.push(`nº ${companySettings.company_number}`);
      if (companySettings.company_neighborhood) addressParts.push(companySettings.company_neighborhood);
      if (companySettings.company_city) addressParts.push(companySettings.company_city);
      if (companySettings.company_state) addressParts.push(companySettings.company_state);

      const address = addressParts.join(', ');
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

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Informações do Projeto', 14, currentY);
    currentY += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Projeto: ${selectedProject.name}`, 14, currentY);
    currentY += 5;
    doc.text(`Cliente: ${selectedProject.customer_name}`, 14, currentY);
    currentY += 5;
    doc.text(`Imóvel: ${selectedProject.property_name}`, 14, currentY);
    currentY += 5;
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, currentY);
    currentY += 10;

    if (projectServices.length > 0) {
      doc.setFontSize(14);
      doc.text('Serviços', 14, currentY);
      currentY += 8;

      const servicesData = projectServices.map((s) => [
        s.service_name,
        `R$ ${s.suggested_value.toFixed(2)}`,
        `R$ ${s.actual_value.toFixed(2)}`,
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Serviço', 'Valor Sugerido', 'Valor Negociado']],
        body: servicesData,
        theme: 'grid',
      });

      currentY = (doc as any).lastAutoTable.finalY + 10;
    }

    if (projectCosts.length > 0) {
      doc.setFontSize(14);
      doc.text('Custos Adicionais', 14, currentY);
      currentY += 8;

      const costsData = projectCosts.map((c) => [
        c.cost_type,
        c.description,
        new Date(c.date).toLocaleDateString('pt-BR'),
        `R$ ${c.value.toFixed(2)}`,
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Tipo', 'Descrição', 'Data', 'Valor']],
        body: costsData,
        theme: 'grid',
      });

      currentY = (doc as any).lastAutoTable.finalY + 10;
    }

    if (projectPayments.length > 0) {
      doc.setFontSize(14);
      doc.text('Recebimentos', 14, currentY);
      currentY += 8;

      const paymentsData = projectPayments.map((p) => [
        new Date(p.payment_date).toLocaleDateString('pt-BR'),
        p.payment_method,
        `R$ ${p.value.toFixed(2)}`,
        p.notes || '-',
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Data', 'Forma de Pagamento', 'Valor', 'Observações']],
        body: paymentsData,
        theme: 'grid',
      });

      currentY = (doc as any).lastAutoTable.finalY + 10;
    }

    const totalServices = projectServices.reduce((sum, s) => sum + s.actual_value, 0);
    const totalCosts = projectCosts.reduce((sum, c) => sum + c.value, 0);
    const totalPayments = projectPayments.reduce((sum, p) => sum + p.value, 0);
    const clientDebt = totalServices + totalCosts;
    const balance = clientDebt - totalPayments;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo Financeiro', 14, currentY);
    currentY += 8;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total de Serviços: R$ ${totalServices.toFixed(2)}`, 14, currentY);
    currentY += 6;
    doc.text(`Total de Custos Adicionais: R$ ${totalCosts.toFixed(2)}`, 14, currentY);
    currentY += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Débito do Cliente: R$ ${clientDebt.toFixed(2)}`, 14, currentY);
    currentY += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Total Recebido: R$ ${totalPayments.toFixed(2)}`, 14, currentY);
    currentY += 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    const balanceColor = balance > 0 ? [220, 38, 38] : [22, 163, 74];
    doc.setTextColor(...balanceColor);
    doc.text(`Saldo Devedor: R$ ${balance.toFixed(2)}`, 14, currentY);
    doc.setTextColor(0, 0, 0);

    doc.save(`extrato_${selectedProject.name.replace(/\s+/g, '_')}.pdf`);
  }

  const filteredProjects = useMemo(() => projects.filter((p) => {
    if (activeTab === 'active') {
      return p.status !== 'registrado' && p.property_id !== null;
    } else if (activeTab === 'completed') {
      return p.status === 'registrado';
    } else if (activeTab === 'consultoria') {
      return p.property_id === null;
    } else if (activeTab === 'to_collect') {
      return false;
    }
    return true;
  }), [projects, activeTab]);

  const projectUrgencyMap = useMemo(() => {
    const map: Record<string, { daysRemaining: number | null; urgency: 'vencido' | 'urgente' | 'atencao' | 'normal'; urgencyColor: string }> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const p of filteredProjects) {
      let daysRemaining: number | null = null;
      if (p.exigency_deadline) {
        const d = new Date(p.exigency_deadline);
        d.setHours(0, 0, 0, 0);
        daysRemaining = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }
      let urgency: 'vencido' | 'urgente' | 'atencao' | 'normal' = 'normal';
      if (daysRemaining !== null) {
        if (daysRemaining <= 0) urgency = 'vencido';
        else if (daysRemaining <= 5) urgency = 'urgente';
        else if (daysRemaining <= 10) urgency = 'atencao';
      }
      const urgencyColor = urgency === 'vencido'
        ? 'bg-red-600 text-white border-red-700'
        : urgency === 'urgente'
        ? 'bg-red-500 text-white border-red-600'
        : urgency === 'atencao'
        ? 'bg-orange-400 text-white border-orange-500'
        : 'bg-red-100 text-red-800 border-red-300';
      map[p.id] = { daysRemaining, urgency, urgencyColor };
    }
    return map;
  }, [filteredProjects]);

  const completedStagesCount = projectStages.filter((s) => s.status === 'concluida').length;
  const progressPercentage =
    projectStages.length > 0 ? (completedStagesCount / projectStages.length) * 100 : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Building className="w-8 h-8 text-blue-600" />
            Projetos de Engenharia
          </h1>
          <p className="text-gray-600 mt-1">Gerenciamento completo de projetos</p>
        </div>
        <button
          onClick={handleNewProject}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Novo Projeto
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('active')}
            className={`pb-2 px-1 border-b-2 transition-colors ${
              activeTab === 'active'
                ? 'border-blue-600 text-blue-600 font-medium'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Em Andamento ({projects.filter((p) => p.status !== 'registrado').length})
          </button>
          <button
            onClick={() => setActiveTab('to_collect')}
            className={`pb-2 px-1 border-b-2 transition-colors ${
              activeTab === 'to_collect'
                ? 'border-orange-600 text-orange-600 font-medium'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            A Cobrar ({projectsToCollect.length})
          </button>
          <button
            onClick={() => setActiveTab('consultoria')}
            className={`pb-2 px-1 border-b-2 transition-colors ${
              activeTab === 'consultoria'
                ? 'border-teal-600 text-teal-600 font-medium'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Consultoria ({projects.filter((p) => p.property_id === null).length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`pb-2 px-1 border-b-2 transition-colors ${
              activeTab === 'completed'
                ? 'border-blue-600 text-blue-600 font-medium'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Registrados ({projects.filter((p) => p.status === 'registrado').length})
          </button>
          <button
            onClick={() => setActiveTab('client_statement')}
            className={`pb-2 px-1 border-b-2 transition-colors ${
              activeTab === 'client_statement'
                ? 'border-purple-600 text-purple-600 font-medium'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Extrato do Cliente
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      ) : activeTab === 'client_statement' ? (
        <EngineeringClientStatement />
      ) : activeTab === 'to_collect' ? (
        projectsToCollect.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">Nenhum projeto com saldo a receber</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full bg-white shadow-md rounded-lg overflow-hidden">
              <thead className="bg-orange-600 text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Cliente</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Projeto</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Conclusão</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Valor Total</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Recebido</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Saldo Devedor</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {projectsToCollect.map((projectToCollect) => {
                  const statusColors = {
                    finalizado: 'bg-blue-100 text-blue-800',
                    entregue: 'bg-green-100 text-green-800',
                  };
                  const statusLabels = {
                    finalizado: 'Finalizado',
                    entregue: 'Entregue',
                  };

                  return (
                    <tr key={projectToCollect.id} className="hover:bg-orange-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColors[projectToCollect.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'}`}>
                          {statusLabels[projectToCollect.status as keyof typeof statusLabels] || projectToCollect.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900 font-medium">{projectToCollect.customer_name}</div>
                        {projectToCollect.customer_phone && (
                          <div className="text-xs text-gray-500">{projectToCollect.customer_phone}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">{projectToCollect.project_name}</td>
                      <td className="px-4 py-3 text-center">
                        {projectToCollect.actual_completion_date ? (
                          <div className="text-sm text-gray-600">
                            {new Date(projectToCollect.actual_completion_date).toLocaleDateString('pt-BR')}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                        R$ {projectToCollect.grand_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-green-600 text-right font-medium">
                        R$ {projectToCollect.total_received.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm text-red-600 font-bold">
                          R$ {projectToCollect.balance_due.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-gray-500">
                          {((projectToCollect.balance_due / projectToCollect.grand_total) * 100).toFixed(0)}% pendente
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              const project = projects.find(p => p.id === projectToCollect.id);
                              if (project) {
                                handleOpenWhatsAppBilling(project);
                              }
                            }}
                            className="p-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                            title="Enviar Cobrança via WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              const project = projects.find(p => p.id === projectToCollect.id);
                              if (project) {
                                setSelectedProject(project);
                                loadProjectDetails(project.id);
                                setShowDetailModal(true);
                                setDetailTab('checklist');
                              }
                            }}
                            className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            title="Ver Projeto Completo"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              const project = projects.find(p => p.id === projectToCollect.id);
                              if (project) {
                                setSelectedProject(project);
                                loadProjectDetails(project.id);
                                setShowDetailModal(true);
                                setDetailTab('financeiro');
                              }
                            }}
                            className="p-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
                            title="Ver Detalhes Financeiros"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Building className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">
            {activeTab === 'active'
              ? 'Nenhum projeto em andamento'
              : 'Nenhum projeto registrado'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => {
            const { daysRemaining, urgencyColor } = projectUrgencyMap[project.id] || { daysRemaining: null, urgencyColor: 'bg-red-100 text-red-800 border-red-300' };

            return (
            <div
              key={project.id}
              className={`rounded-lg shadow-md border p-4 hover:shadow-lg transition-shadow ${
                project.status === 'em_exigencia'
                  ? 'bg-red-50 border-red-400 border-2'
                  : 'bg-white border-gray-200'
              }`}
            >
              {project.status === 'em_exigencia' && (
                <div className={`mb-3 p-2 border rounded-lg ${urgencyColor}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      <AlertCircle className="w-5 h-5" />
                      PROJETO COM EXIGÊNCIAS
                    </div>
                    {project.exigency_deadline && (
                      <div className="text-xs font-bold">
                        {daysRemaining !== null && daysRemaining <= 0 ? (
                          <span>VENCIDO!</span>
                        ) : daysRemaining !== null && daysRemaining === 1 ? (
                          <span>1 DIA!</span>
                        ) : daysRemaining !== null ? (
                          <span>{daysRemaining} DIAS</span>
                        ) : null}
                      </div>
                    )}
                  </div>
                  <p className="text-xs ml-7">{project.exigency_description}</p>
                  {project.exigency_deadline && (
                    <p className="text-xs ml-7 mt-1 font-medium">
                      Prazo: {new Date(project.exigency_deadline + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                  <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                    <User className="w-4 h-4" />
                    {project.customer_name}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                    <MapPin className="w-4 h-4" />
                    {project.property_name}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(project)}
                    className="text-blue-600 hover:text-blue-700 p-1"
                    title="Editar"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(project.id)}
                    className="text-red-600 hover:text-red-700 p-1"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Tipo de Imóvel:</span>
                  <span className="font-medium">
                    {project.property_type === 'rural' ? 'Rural' : 'Urbano'}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-gray-600 text-xs">Status:</span>
                  <select
                    value={project.status}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleChangeProjectStatus(project.id, e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className={`px-2 py-1 rounded text-xs font-medium border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      project.status === 'registrado'
                        ? 'bg-green-100 text-green-800 border-green-300'
                        : project.status === 'entregue'
                        ? 'bg-blue-100 text-blue-800 border-blue-300'
                        : project.status === 'finalizado'
                        ? 'bg-teal-100 text-teal-800 border-teal-300'
                        : project.status === 'em_correcao'
                        ? 'bg-orange-100 text-orange-800 border-orange-300'
                        : project.status === 'em_desenvolvimento'
                        ? 'bg-blue-100 text-blue-800 border-blue-300'
                        : project.status === 'em_exigencia'
                        ? 'bg-red-100 text-red-800 border-red-300'
                        : 'bg-gray-100 text-gray-800 border-gray-300'
                    }`}
                  >
                    <option value="a_iniciar">A Iniciar</option>
                    <option value="em_desenvolvimento">Em Desenvolvimento</option>
                    <option value="em_correcao">Em Correção</option>
                    <option value="finalizado">Finalizado</option>
                    <option value="entregue">Entregue</option>
                    <option value="em_exigencia">Em Exigência</option>
                    <option value="registrado">Registrado</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Responsável:</span>
                  <span className="font-medium">
                    {project.responsible_employee_name || 'Não atribuído'}
                  </span>
                </div>
                {project.has_deadline && (
                  <div className="flex items-center justify-between text-orange-600">
                    <span className="flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      Vencimento:
                    </span>
                    <span className="font-medium">
                      {new Date(project.deadline_date!).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between font-medium text-green-600">
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    Total:
                  </span>
                  <span>R$ {(project.grand_total || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Progress Bar */}
              {projectProgress[project.id] && projectProgress[project.id].total > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-600 flex items-center gap-1">
                      <CheckSquare className="w-3.5 h-3.5" />
                      Progresso do Checklist
                    </span>
                    <span className="text-xs font-bold text-blue-600">
                      {projectProgress[project.id].completed}/{projectProgress[project.id].total} etapas
                    </span>
                  </div>
                  <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500 ease-in-out"
                      style={{
                        width: `${
                          projectProgress[project.id].total > 0
                            ? (projectProgress[project.id].completed / projectProgress[project.id].total) * 100
                            : 0
                        }%`
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-gray-500">
                      {projectProgress[project.id].total > 0
                        ? Math.round((projectProgress[project.id].completed / projectProgress[project.id].total) * 100)
                        : 0}% concluído
                    </span>
                    {projectProgress[project.id].completed === projectProgress[project.id].total && projectProgress[project.id].total > 0 && (
                      <span className="text-xs text-green-600 font-medium flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" />
                        Completo
                      </span>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={() => handleViewDetails(project)}
                className="w-full mt-4 bg-blue-50 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-100 flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Ver Detalhes
              </button>
            </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {editingId ? 'Editar Projeto' : 'Novo Projeto'}
                    {isConsultoriaProject && (
                      <span className="ml-2 text-sm font-normal text-blue-600">(Consultoria)</span>
                    )}
                  </h2>
                  <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-700">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Projeto *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                  <select
                    required
                    value={formData.customer_id}
                    onChange={(e) => handleCustomerChange(e.target.value)}
                    disabled={loadingProperties}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                  >
                    <option value="">Selecione um cliente</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} - {customer.cpf}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.customer_id && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Imóvel {!isConsultoriaProject && '*'}
                        {isConsultoriaProject && (
                          <span className="text-xs text-gray-500 ml-2">(opcional para consultoria)</span>
                        )}
                      </label>

                      {loadingProperties ? (
                        <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                          <span className="text-gray-600">Carregando imóveis...</span>
                        </div>
                      ) : (
                        <>
                          <select
                            required={!isConsultoriaProject}
                            value={formData.property_id}
                            onChange={(e) => {
                              const property = properties.find((p) => p.id === e.target.value);
                              setFormData({
                                ...formData,
                                property_id: e.target.value,
                                property_type: property?.property_type || 'urbano',
                              });
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="">{isConsultoriaProject ? 'Não vinculado a imóvel' : 'Selecione um imóvel'}</option>
                            {properties.map((property) => (
                              <option key={property.id} value={property.id}>
                                {property.name} - {property.property_type === 'rural' ? 'Rural' : 'Urbano'} - {property.municipality}/{property.state}
                              </option>
                            ))}
                          </select>
                        </>
                      )}

                      {!loadingProperties && properties.length === 0 && !isConsultoriaProject && (
                        <p className="text-sm text-gray-500 mt-1">Nenhum imóvel cadastrado para este cliente</p>
                      )}

                      {isConsultoriaProject && (
                        <p className="text-sm text-blue-600 mt-1">
                          Para projetos de consultoria, o imóvel é opcional
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Imóvel *</label>
                      <div className="flex gap-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="urbano"
                            checked={formData.property_type === 'urbano'}
                            onChange={(e) => setFormData({ ...formData, property_type: e.target.value })}
                            className="mr-2"
                          />
                          <Home className="w-4 h-4 mr-1" />
                          Urbano
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="rural"
                            checked={formData.property_type === 'rural'}
                            onChange={(e) => setFormData({ ...formData, property_type: e.target.value })}
                            className="mr-2"
                          />
                          <MapPin className="w-4 h-4 mr-1" />
                          Rural
                        </label>
                      </div>
                    </div>
                  </>
                )}

                {!editingId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Serviços do Projeto</label>
                    <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto">
                      {serviceTemplates.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center py-4">
                          Nenhum template de serviço encontrado. Cadastre templates na aba "Tabela de Serviços" primeiro.
                        </p>
                      ) : (
                        serviceTemplates.map((service) => (
                          <label key={service.id} className="flex items-start gap-2 mb-2">
                            <input
                              type="checkbox"
                              checked={selectedServices.includes(service.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedServices([...selectedServices, service.id]);
                                } else {
                                  setSelectedServices(selectedServices.filter((id) => id !== service.id));
                                }
                              }}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{service.name}</div>
                              <div className="text-sm text-gray-600">
                                R$ {(service.fees || 0).toFixed(2)} - {service.estimated_time_days || 0} dias
                              </div>
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data de Início *</label>
                    <input
                      type="date"
                      required
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Previsão de Conclusão</label>
                    <input
                      type="date"
                      value={formData.estimated_completion_date}
                      onChange={(e) => setFormData({ ...formData, estimated_completion_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={formData.has_deadline}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          has_deadline: e.target.checked,
                          deadline_date: e.target.checked ? formData.deadline_date : '',
                        })
                      }
                    />
                    <span className="text-sm font-medium text-gray-700">Este projeto possui vencimento</span>
                  </label>

                  {formData.has_deadline && (
                    <input
                      type="date"
                      required
                      value={formData.deadline_date}
                      onChange={(e) => setFormData({ ...formData, deadline_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {loading ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900">{selectedProject.name}</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Cliente: {selectedProject.customer_name} | Imóvel: {selectedProject.property_name}
                  </p>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <UserCog className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-600">Responsável Atual do Projeto</p>
                    <p className="text-sm font-bold text-gray-900">
                      {selectedProject.responsible_employee_name || 'Nenhum responsável definido'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedProject.responsible_employee_id || ''}
                    onChange={(e) => handleChangeProjectResponsible(selectedProject.id, e.target.value || null)}
                    className="px-3 py-2 border border-blue-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            </div>

            <div className="flex border-b border-gray-200 justify-between items-center">
              <div className="flex">
                <button
                  onClick={() => setDetailTab('checklist')}
                  className={`px-6 py-3 font-medium ${
                    detailTab === 'checklist'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Checklist/Etapas
                </button>
                <button
                  onClick={() => setDetailTab('financeiro')}
                  className={`px-6 py-3 font-medium ${
                    detailTab === 'financeiro'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Financeiro
                </button>
                <button
                  onClick={() => setDetailTab('documentos_ia')}
                  className={`px-6 py-3 font-medium ${
                    detailTab === 'documentos_ia'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Documentos IA
                </button>
              </div>
              {detailTab === 'checklist' && (
                <button
                  onClick={() => setShowHistoryModal(true)}
                  className="mr-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"
                >
                  <Clock className="w-4 h-4" />
                  Ver Histórico
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {detailTab === 'checklist' && (
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          <CheckSquare className="w-5 h-5 text-blue-600" />
                          Progresso do Projeto
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {completedStagesCount} de {projectStages.length} etapas concluídas
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-blue-600">
                          {progressPercentage.toFixed(0)}%
                        </div>
                        <div className="text-xs text-gray-600">Completo</div>
                      </div>
                    </div>
                    <div className="bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-500 ease-in-out"
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                  </div>

                  {projectStages.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                      <CheckSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 font-medium">Nenhuma etapa cadastrada</p>
                      <p className="text-sm text-gray-400 mt-1">As etapas serão criadas automaticamente ao adicionar serviços</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <CheckSquare className="w-4 h-4" />
                        Checklist de Atividades
                      </h4>
                      {projectStages.map((stage, index) => (
                        <div
                          key={stage.id}
                          className={`group border rounded-lg p-4 transition-all ${
                            stage.status === 'concluida'
                              ? 'bg-green-50 border-green-300'
                              : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-md'
                          }`}
                        >
                          <div
                            className="flex items-start gap-4 cursor-pointer"
                            onClick={() => handleToggleStage(stage.id!, stage.status)}
                          >
                            <div className="flex-shrink-0 pt-1">
                              {stage.status === 'concluida' ? (
                                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                                  <CheckCircle2 className="w-4 h-4 text-white" />
                                </div>
                              ) : (
                                <div className="w-6 h-6 rounded-full border-2 border-gray-300 group-hover:border-blue-500 transition-colors flex items-center justify-center">
                                  <Circle className="w-4 h-4 text-gray-300 group-hover:text-blue-500" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-gray-400">#{index + 1}</span>
                                    <h4 className={`font-semibold ${
                                      stage.status === 'concluida'
                                        ? 'text-green-700 line-through'
                                        : 'text-gray-900'
                                    }`}>
                                      {stage.stage_name}
                                    </h4>
                                  </div>
                                  {stage.description && (
                                    <p className="text-sm text-gray-600 mt-1">{stage.description}</p>
                                  )}
                                  <div className="flex items-center gap-4 mt-2">
                                    {stage.estimated_days > 0 && (
                                      <span className="text-xs text-gray-500 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {stage.estimated_days} {stage.estimated_days === 1 ? 'dia' : 'dias'}
                                      </span>
                                    )}
                                    {stage.completed_date && (
                                      <span className="text-xs text-green-600 flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" />
                                        Concluído em {new Date(stage.completed_date).toLocaleDateString('pt-BR')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  stage.status === 'concluida'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-700'
                                }`}>
                                  {stage.status === 'concluida' ? 'Concluído' : 'Pendente'}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 pt-3 border-t border-gray-200 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                            <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <div className="flex-1 flex items-center gap-2">
                              <span className="text-xs text-gray-600 font-medium">Responsável:</span>
                              <select
                                value={stage.responsible_employee_id || ''}
                                onChange={(e) => handleChangeStageResponsible(stage.id!, e.target.value || null)}
                                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <option value="">Atribuir responsável...</option>
                                {employees.map((emp) => (
                                  <option key={emp.id} value={emp.id}>
                                    {emp.name} - {emp.role}
                                  </option>
                                ))}
                              </select>
                              {stage.responsible_employee_name && (
                                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                  {stage.responsible_employee_name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedProject.status !== 'completed' && projectStages.length > 0 && (
                    <div className="mt-6 space-y-3">
                      {hasUnsavedChanges && (
                        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-yellow-800">
                              Você tem alterações não salvas
                            </p>
                            <p className="text-xs text-yellow-700 mt-1">
                              Clique em "Salvar Progresso" para confirmar as mudanças antes de concluir o projeto.
                            </p>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={handleSaveProgress}
                        disabled={!hasUnsavedChanges || loading}
                        className={`w-full px-6 py-3 rounded-lg flex items-center justify-center gap-2 font-medium shadow transition-all ${
                          hasUnsavedChanges && !loading
                            ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        <Save className="w-5 h-5" />
                        {loading ? 'Salvando...' : 'Salvar Progresso do Checklist'}
                      </button>

                      <button
                        onClick={handleMarkAsComplete}
                        disabled={hasUnsavedChanges || completedStagesCount !== projectStages.length || loading}
                        className={`w-full px-6 py-3 rounded-lg flex items-center justify-center gap-2 font-medium shadow-lg transition-all ${
                          !hasUnsavedChanges && completedStagesCount === projectStages.length && !loading
                            ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 hover:shadow-xl'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        {hasUnsavedChanges
                          ? 'Salve o Progresso Antes de Finalizar'
                          : completedStagesCount !== projectStages.length
                          ? `Finalizar Projeto (${completedStagesCount}/${projectStages.length} etapas)`
                          : 'Marcar Projeto como Finalizado'}
                      </button>

                      {completedStagesCount !== projectStages.length && !hasUnsavedChanges && (
                        <p className="text-xs text-gray-500 text-center">
                          Complete todas as {projectStages.length} etapas do checklist para finalizar o projeto
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {detailTab === 'financeiro' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-600 font-medium">Total de Serviços</p>
                      <p className="text-2xl font-bold text-blue-700 mt-1">
                        R$ {projectServices.reduce((sum, s) => sum + s.actual_value, 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-sm text-red-600 font-medium">Total de Custos</p>
                      <p className="text-2xl font-bold text-red-700 mt-1">
                        R$ {projectCosts.reduce((sum, c) => sum + c.value, 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <p className="text-sm text-orange-600 font-medium">Débito do Cliente</p>
                      <p className="text-2xl font-bold text-orange-700 mt-1">
                        R$ {(projectServices.reduce((sum, s) => sum + s.actual_value, 0) + projectCosts.reduce((sum, c) => sum + c.value, 0)).toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-sm text-green-600 font-medium">Total Recebido</p>
                      <p className="text-2xl font-bold text-green-700 mt-1">
                        R$ {projectPayments.reduce((sum, p) => sum + p.value, 0).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 mb-6">
                    <button
                      onClick={() => setShowCostForm(true)}
                      className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
                    >
                      <Plus className="w-5 h-5" />
                      Adicionar Custo
                    </button>
                    <button
                      onClick={() => setShowPaymentForm(true)}
                      className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                    >
                      <Plus className="w-5 h-5" />
                      Adicionar Recebimento
                    </button>
                    <button
                      onClick={exportFinancialStatement}
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                      <FileText className="w-5 h-5" />
                      Extrato PDF
                    </button>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Serviços do Projeto</h3>
                    {projectServices.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">Nenhum serviço cadastrado</p>
                    ) : (
                      <div className="space-y-2">
                        {projectServices.map((service) => (
                          <div key={service.id} className="border border-gray-200 rounded-lg p-3">
                            {editingServiceId === service.id ? (
                              <div className="space-y-3">
                                <p className="font-medium text-gray-900">{service.service_name}</p>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs text-gray-600 mb-1">Valor Sugerido</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={editServiceData.suggested_value}
                                      onChange={(e) => setEditServiceData({ ...editServiceData, suggested_value: e.target.value })}
                                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-600 mb-1">Valor Negociado</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={editServiceData.actual_value}
                                      onChange={(e) => setEditServiceData({ ...editServiceData, actual_value: e.target.value })}
                                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Descrição</label>
                                  <input
                                    type="text"
                                    value={editServiceData.description}
                                    onChange={(e) => setEditServiceData({ ...editServiceData, description: e.target.value })}
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleUpdateService(service.id!)}
                                    className="flex-1 bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                                  >
                                    Salvar
                                  </button>
                                  <button
                                    onClick={() => setEditingServiceId(null)}
                                    className="flex-1 bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-400"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex justify-between items-center">
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">{service.service_name}</p>
                                  {service.description && (
                                    <p className="text-sm text-gray-600">{service.description}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <p className="text-sm text-gray-600">
                                      Sugerido: R$ {service.suggested_value.toFixed(2)}
                                    </p>
                                    <p className="font-medium text-green-600">
                                      Negociado: R$ {service.actual_value.toFixed(2)}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => handleEditService(service)}
                                    className="text-blue-600 hover:text-blue-700 p-1"
                                    title="Editar valores"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Custos Adicionais</h3>
                    {projectCosts.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">Nenhum custo adicionado</p>
                    ) : (
                      <div className="space-y-2">
                        {projectCosts.map((cost) => (
                          <div key={cost.id} className="border border-gray-200 rounded-lg p-3">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-medium text-gray-900">{cost.description}</p>
                                <p className="text-sm text-gray-600">
                                  {cost.cost_type} - {new Date(cost.date).toLocaleDateString('pt-BR')}
                                </p>
                              </div>
                              <p className="font-medium text-red-600">R$ {cost.value.toFixed(2)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Recebimentos</h3>
                    {projectPayments.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">Nenhum recebimento registrado</p>
                    ) : (
                      <div className="space-y-2">
                        {projectPayments.map((payment) => (
                          <div key={payment.id} className="border border-gray-200 rounded-lg p-3">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-medium text-gray-900">
                                  {new Date(payment.payment_date).toLocaleDateString('pt-BR')}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {payment.payment_method}
                                  {payment.notes && ` - ${payment.notes}`}
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <p className="font-medium text-green-600">R$ {payment.value.toFixed(2)}</p>
                                <button
                                  onClick={() => handleGenerateReceipt(payment)}
                                  className="text-gray-500 hover:text-blue-600 p-1 rounded hover:bg-blue-50 transition-colors"
                                  title="Gerar recibo de recebimento"
                                >
                                  <Printer className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleReversePayment(payment)}
                                  className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                                  title="Estornar recebimento"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {detailTab === 'documentos_ia' && selectedProject && (
                <ProjectIADocuments projectId={selectedProject.id} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cost Form Modal */}
      {showCostForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">Adicionar Custo</h3>
              <form onSubmit={handleAddCost} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Custo *</label>
                  <select
                    required
                    value={newCost.cost_type}
                    onChange={(e) => setNewCost({ ...newCost, cost_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="taxa">Taxa</option>
                    <option value="deslocamento">Deslocamento</option>
                    <option value="hospedagem">Hospedagem</option>
                    <option value="alimentacao">Alimentação</option>
                    <option value="material">Material</option>
                    <option value="terceirizado">Serviço Terceirizado</option>
                    <option value="outros">Outros</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
                  <input
                    type="text"
                    required
                    value={newCost.description}
                    onChange={(e) => setNewCost({ ...newCost, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newCost.value}
                    onChange={(e) => setNewCost({ ...newCost, value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
                  <input
                    type="date"
                    required
                    value={newCost.date}
                    onChange={(e) => setNewCost({ ...newCost, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCostForm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                  >
                    Adicionar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Payment Form Modal */}
      {showPaymentForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">Adicionar Recebimento</h3>
              <form onSubmit={handleAddPayment} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data do Recebimento *</label>
                  <input
                    type="date"
                    required
                    value={newPayment.payment_date}
                    onChange={(e) => setNewPayment({ ...newPayment, payment_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newPayment.value}
                    onChange={(e) => setNewPayment({ ...newPayment, value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Forma de Pagamento *</label>
                  <select
                    required
                    value={newPayment.payment_method}
                    onChange={(e) => setNewPayment({ ...newPayment, payment_method: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="pix">PIX</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="transferencia">Transferência</option>
                    <option value="cartao">Cartão</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Conta/Caixa</label>
                  <select
                    value={newPayment.conta_caixa_id}
                    onChange={(e) => setNewPayment({ ...newPayment, conta_caixa_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione...</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                  <textarea
                    value={newPayment.notes}
                    onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowPaymentForm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                  >
                    Adicionar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Histórico do Checklist */}
      {showHistoryModal && selectedProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Clock className="w-6 h-6 text-blue-600" />
                Histórico do Checklist
              </h3>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setStageHistory([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-semibold">Projeto:</span> {selectedProject.name}
                  </div>
                  <div>
                    <span className="font-semibold">Responsável Geral:</span>{' '}
                    {selectedProject.responsible_employee_name || 'Não atribuído'}
                  </div>
                </div>
              </div>

              <button
                onClick={() => loadStageHistory(selectedProject.id)}
                className="mb-4 w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Clock className="w-4 h-4" />
                Carregar Histórico
              </button>

              {stageHistory.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">
                    Nenhum histórico registrado ainda ou clique em "Carregar Histórico"
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {stageHistory.map((history) => (
                    <div
                      key={history.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{history.stage_name}</h4>
                          <p className="text-sm text-gray-600 mt-1">{history.notes}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-600">
                            {new Date(history.changed_at).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">Status:</span>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              history.old_status === 'concluida'
                                ? 'bg-green-100 text-green-700'
                                : history.old_status === 'em_andamento'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {history.old_status === 'concluida'
                              ? 'Concluída'
                              : history.old_status === 'em_andamento'
                              ? 'Em Andamento'
                              : history.old_status === 'cancelada'
                              ? 'Cancelada'
                              : 'Pendente'}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              history.new_status === 'concluida'
                                ? 'bg-green-100 text-green-700'
                                : history.new_status === 'em_andamento'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {history.new_status === 'concluida'
                              ? 'Concluída'
                              : history.new_status === 'em_andamento'
                              ? 'Em Andamento'
                              : history.new_status === 'cancelada'
                              ? 'Cancelada'
                              : 'Pendente'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">
                            Por: <span className="font-medium">{history.employee_name}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setStageHistory([]);
                }}
                className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cobrança WhatsApp */}
      {showWhatsAppModal && selectedProjectForBilling && (
        <WhatsAppBillingModal
          projectId={selectedProjectForBilling.id}
          customerName={selectedProjectForBilling.customerName}
          customerPhone={selectedProjectForBilling.customerPhone}
          onClose={() => {
            setShowWhatsAppModal(false);
            setSelectedProjectForBilling(null);
          }}
        />
      )}
    </div>
  );
}
