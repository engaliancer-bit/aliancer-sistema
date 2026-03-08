import React, { useState, useEffect, useCallback } from 'react';
import {
  User,
  DollarSign,
  FileText,
  Calendar,
  Plus,
  Download,
  Search,
  X,
  CheckCircle,
  Clock,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Customer {
  id: string;
  name: string;
  cpf: string;
  phone: string;
}

interface AdditionalCost {
  id: string;
  project_id: string;
  cost_type: string;
  description: string;
  value: number;
  date: string;
}

interface ProjectSummary {
  id: string;
  name: string;
  start_date: string;
  status: string;
  grand_total: number;
  total_received: number;
  balance: number;
  property_name: string;
  service_description: string;
  service_fees: number;
  additional_costs: AdditionalCost[];
}

interface Payment {
  id: string;
  project_id: string;
  project_name: string;
  service_description: string;
  payment_date: string;
  value: number;
  payment_method: string;
  conta_caixa_id: string;
  account_name: string;
  notes: string;
}

interface Account {
  id: string;
  nome: string;
}

export default function EngineeringClientStatement() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [paymentForm, setPaymentForm] = useState({
    project_id: '',
    payment_date: new Date().toISOString().split('T')[0],
    value: '',
    payment_method: 'pix',
    conta_caixa_id: '',
    notes: ''
  });

  useEffect(() => {
    loadCustomers();
    loadAccounts();
  }, []);

  useEffect(() => {
    if (selectedCustomerId) {
      loadCustomerData();
    } else {
      setProjects([]);
      setPayments([]);
      setSelectedCustomer(null);
    }
  }, [selectedCustomerId]);

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, cpf, phone')
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  const loadAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('contas_caixa')
        .select('id, nome')
        .order('nome');

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
    }
  };

  const loadCustomerData = async () => {
    if (!selectedCustomerId) return;

    setLoading(true);
    try {
      // Carregar dados do cliente
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('id, name, cpf, phone')
        .eq('id', selectedCustomerId)
        .single();

      if (customerError) throw customerError;
      setSelectedCustomer(customerData);

      // Carregar projetos do cliente com nome do serviço
      const { data: projectsData, error: projectsError } = await supabase
        .from('engineering_projects')
        .select(`
          id,
          name,
          start_date,
          status,
          grand_total,
          total_received,
          balance,
          total_actual_value,
          property:property_id (name),
          template:template_id (name)
        `)
        .eq('customer_id', selectedCustomerId)
        .order('start_date', { ascending: false });

      if (projectsError) throw projectsError;

      // Carregar custos adicionais de todos os projetos
      const projectIds = (projectsData || []).map((p: any) => p.id);
      let additionalCostsData: any[] = [];

      if (projectIds.length > 0) {
        const { data: costsData, error: costsError } = await supabase
          .from('engineering_project_costs')
          .select('*')
          .in('project_id', projectIds)
          .order('date', { ascending: true });

        if (!costsError) {
          additionalCostsData = costsData || [];
        }
      }

      const formattedProjects = (projectsData || []).map((p: any) => {
        const projectCosts = additionalCostsData.filter((c: any) => c.project_id === p.id);
        const serviceFees = p.total_actual_value || 0;

        return {
          id: p.id,
          name: p.name,
          start_date: p.start_date,
          status: p.status,
          grand_total: p.grand_total || 0,
          total_received: p.total_received || 0,
          balance: p.balance || 0,
          property_name: p.property?.name || 'N/A',
          service_description: p.template?.name || p.name,
          service_fees: serviceFees,
          additional_costs: projectCosts
        };
      });

      setProjects(formattedProjects);

      // Carregar pagamentos de todos os projetos do cliente
      if (formattedProjects.length > 0) {
        const projectIds = formattedProjects.map(p => p.id);

        const { data: paymentsData, error: paymentsError } = await supabase
          .from('engineering_project_payments')
          .select(`
            id,
            project_id,
            payment_date,
            value,
            payment_method,
            conta_caixa_id,
            notes,
            project:project_id (
              name,
              template:template_id (name)
            ),
            conta_caixa:conta_caixa_id (nome)
          `)
          .in('project_id', projectIds)
          .order('payment_date', { ascending: false });

        if (paymentsError) throw paymentsError;

        const formattedPayments = (paymentsData || []).map((p: any) => ({
          id: p.id,
          project_id: p.project_id,
          project_name: p.project?.name || 'N/A',
          service_description: p.project?.template?.name || p.project?.name || 'N/A',
          payment_date: p.payment_date,
          value: p.value,
          payment_method: p.payment_method,
          conta_caixa_id: p.conta_caixa_id,
          account_name: p.conta_caixa?.nome || 'N/A',
          notes: p.notes || ''
        }));

        setPayments(formattedPayments);
      } else {
        setPayments([]);
      }
    } catch (error) {
      console.error('Erro ao carregar dados do cliente:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!paymentForm.project_id || !paymentForm.value || !paymentForm.conta_caixa_id) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('engineering_project_payments')
        .insert({
          project_id: paymentForm.project_id,
          payment_date: paymentForm.payment_date,
          value: parseFloat(paymentForm.value),
          payment_method: paymentForm.payment_method,
          conta_caixa_id: paymentForm.conta_caixa_id,
          notes: paymentForm.notes
        });

      if (error) throw error;

      alert('Recebimento cadastrado com sucesso!');
      setShowPaymentForm(false);
      setPaymentForm({
        project_id: '',
        payment_date: new Date().toISOString().split('T')[0],
        value: '',
        payment_method: 'pix',
        conta_caixa_id: '',
        notes: ''
      });
      loadCustomerData();
    } catch (error: any) {
      console.error('Erro ao cadastrar recebimento:', error);
      alert('Erro ao cadastrar recebimento: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const exportToPDF = async () => {
    if (!selectedCustomer) return;

    try {
      // Carregar configurações da empresa (estrutura key-value)
      const { data: settingsData } = await supabase
        .from('company_settings')
        .select('setting_key, setting_value');

      // Converter array de settings para objeto
      const settingsMap: Record<string, string> = {};
      settingsData?.forEach((s: any) => {
        settingsMap[s.setting_key] = s.setting_value;
      });

      // Mapear para o formato esperado pelo addPDFHeader
      const companyData = {
        logo_url: settingsMap.company_logo_url,
        company_name: settingsMap.company_name,
        company_address: settingsMap.company_address,
        company_phone: settingsMap.company_phone,
        company_email: settingsMap.company_email,
        company_cnpj: settingsMap.company_cnpj
      };

      const doc = new jsPDF();

      // Adicionar cabeçalho com logo
      const { addPDFHeader } = await import('../lib/pdfGenerator');
      let currentY = await addPDFHeader(
        doc,
        'Extrato do Cliente - Projetos de Engenharia',
        companyData,
        15
      );

      currentY += 5;

      // Dados do cliente
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Dados do Cliente', 14, currentY);
      currentY += 7;

      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Cliente: ${selectedCustomer.name}`, 14, currentY);
      currentY += 5;
      doc.text(`CPF: ${selectedCustomer.cpf || 'N/A'}`, 14, currentY);
      currentY += 5;
      doc.text(`Telefone: ${selectedCustomer.phone || 'N/A'}`, 14, currentY);
      currentY += 10;

      // Resumo financeiro
      const totalValue = projects.reduce((sum, p) => sum + p.grand_total, 0);
      const totalReceived = projects.reduce((sum, p) => sum + p.total_received, 0);
      const totalBalance = projects.reduce((sum, p) => sum + p.balance, 0);

      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Resumo Financeiro', 14, currentY);
      currentY += 7;

      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Total de Projetos: ${projects.length}`, 14, currentY);
      currentY += 5;
      doc.text(`Valor Total: R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14, currentY);
      currentY += 5;
      doc.text(`Total Recebido: R$ ${totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14, currentY);
      currentY += 8;

      // Saldo a Receber em destaque (vermelho e negrito)
      doc.setTextColor(220, 38, 38); // Cor vermelha
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text(`SALDO A RECEBER: R$ ${totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14, currentY);
      doc.setTextColor(0, 0, 0); // Voltar para preto
      doc.setFont(undefined, 'normal');
      currentY += 15;

      // Discriminação de Custos por Projeto

      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Discriminação de Valores por Projeto', 14, currentY);
      currentY += 7;

      projects.forEach((project, index) => {
        // Verificar se precisa de nova página
        if (currentY > 250) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(41, 128, 185);
        doc.text(`${project.service_description} - ${project.property_name}`, 14, currentY);
        doc.setTextColor(0, 0, 0);
        currentY += 6;

        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');

        // Valor negociado
        doc.text(`• Valor Negociado:`, 18, currentY);
        doc.text(`R$ ${project.service_fees.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 140, currentY, { align: 'right' });
        currentY += 5;

        // Custos adicionais
        if (project.additional_costs.length > 0) {
          project.additional_costs.forEach((cost: AdditionalCost) => {
            const costLabel = `• ${getCostTypeLabel(cost.cost_type)}: ${cost.description}`;
            doc.text(costLabel, 18, currentY);
            doc.text(`R$ ${cost.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 140, currentY, { align: 'right' });
            currentY += 5;
          });
        }

        // Total do projeto
        doc.setFont(undefined, 'bold');
        doc.text('TOTAL DO PROJETO:', 18, currentY);
        doc.text(`R$ ${project.grand_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 140, currentY, { align: 'right' });
        currentY += 3;

        // Linha separadora
        doc.setDrawColor(200, 200, 200);
        doc.line(14, currentY, 196, currentY);
        currentY += 7;
        doc.setFont(undefined, 'normal');
      });

      // Seção de Recebimentos com detalhes
      if (payments.length > 0) {
        // Verificar se precisa de nova página
        if (currentY > 230) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('Detalhamento de Recebimentos', 14, currentY);
        currentY += 7;

        const paymentsTableData = payments.map(p => [
          new Date(p.payment_date).toLocaleDateString('pt-BR'),
          p.service_description,
          getPaymentMethodLabel(p.payment_method),
          p.account_name,
          `R$ ${p.value.toFixed(2)}`,
          p.notes || '-'
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [['Data', 'Serviço Prestado', 'Forma Pgto', 'Conta', 'Valor', 'Observações']],
          body: paymentsTableData,
          theme: 'grid',
          headStyles: { fillColor: [39, 174, 96], fontSize: 9 },
          styles: { fontSize: 8, cellPadding: 2 },
          columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: 45 },
            2: { cellWidth: 25 },
            3: { cellWidth: 30 },
            4: { cellWidth: 25, halign: 'right' },
            5: { cellWidth: 35 }
          }
        });

        // Totalizador de recebimentos
        currentY = (doc as any).lastAutoTable.finalY + 5;
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text(`Total de Recebimentos: ${payments.length}`, 14, currentY);
        currentY += 5;
        doc.setTextColor(34, 197, 94); // Verde
        doc.text(`Valor Total Recebido: R$ ${totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14, currentY);
        doc.setTextColor(0, 0, 0); // Voltar para preto
      }

      doc.save(`extrato_cliente_${selectedCustomer.name.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF. Por favor, tente novamente.');
    }
  };

  const getCostTypeLabel = (costType: string): string => {
    const labels: Record<string, string> = {
      'material': 'Material',
      'labor': 'Mão de Obra',
      'equipment': 'Equipamento',
      'service': 'Serviço',
      'travel': 'Viagem/Deslocamento',
      'other': 'Outros'
    };
    return labels[costType] || costType;
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      'a_iniciar': 'A Iniciar',
      'em_desenvolvimento': 'Em Desenvolvimento',
      'em_correcao': 'Em Correção',
      'finalizado': 'Finalizado',
      'entregue': 'Entregue',
      'em_exigencia': 'Em Exigência',
      'registrado': 'Registrado'
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      'a_iniciar': 'bg-gray-100 text-gray-800',
      'em_desenvolvimento': 'bg-blue-100 text-blue-800',
      'em_correcao': 'bg-yellow-100 text-yellow-800',
      'finalizado': 'bg-green-100 text-green-800',
      'entregue': 'bg-purple-100 text-purple-800',
      'em_exigencia': 'bg-orange-100 text-orange-800',
      'registrado': 'bg-teal-100 text-teal-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPaymentMethodLabel = (method: string): string => {
    const labels: Record<string, string> = {
      'dinheiro': 'Dinheiro',
      'pix': 'PIX',
      'transferencia': 'Transferência',
      'cheque': 'Cheque',
      'cartao': 'Cartão'
    };
    return labels[method] || method;
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.cpf && c.cpf.includes(searchTerm))
  );

  const totalValue = projects.reduce((sum, p) => sum + p.grand_total, 0);
  const totalReceived = projects.reduce((sum, p) => sum + p.total_received, 0);
  const totalBalance = projects.reduce((sum, p) => sum + p.balance, 0);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <User className="h-6 w-6" />
            Extrato do Cliente
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Visualize todos os projetos e movimentações financeiras de um cliente
          </p>
        </div>
      </div>

      {/* Seleção do Cliente */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selecione o Cliente
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nome ou CPF..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {searchTerm && (
          <div className="mt-4 max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
            {filteredCustomers.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                Nenhum cliente encontrado
              </div>
            ) : (
              filteredCustomers.map(customer => (
                <button
                  key={customer.id}
                  onClick={() => {
                    setSelectedCustomerId(customer.id);
                    setSearchTerm('');
                  }}
                  className={`w-full text-left p-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 ${
                    selectedCustomerId === customer.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="font-medium text-gray-900">{customer.name}</div>
                  <div className="text-sm text-gray-500">
                    {customer.cpf && `CPF: ${customer.cpf}`}
                    {customer.phone && ` • Tel: ${customer.phone}`}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Conteúdo do Extrato */}
      {selectedCustomer && (
        <>
          {/* Resumo Financeiro */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total de Projetos</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{projects.length}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Valor Total</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Recebido</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    R$ {totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <div className="bg-red-50 rounded-lg shadow-sm border-2 border-red-300 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-red-700 uppercase">Saldo a Receber</p>
                  <p className="text-3xl font-extrabold text-red-600 mt-1">
                    R$ {totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <AlertCircle className="h-10 w-10 text-red-600" />
              </div>
            </div>
          </div>

          {/* Ações */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowPaymentForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="h-5 w-5" />
              Cadastrar Recebimento
            </button>
            <button
              onClick={exportToPDF}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="h-5 w-5" />
              Exportar PDF
            </button>
          </div>

          {/* Discriminação de Custos por Projeto */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Discriminação de Valores por Projeto</h3>
            </div>
            <div className="p-6 space-y-6">
              {projects.map(project => (
                <div key={project.id} className="border-b border-gray-200 pb-6 last:border-0 last:pb-0">
                  <div className="mb-4">
                    <h4 className="text-base font-semibold text-blue-600">
                      {project.service_description} - {project.property_name}
                    </h4>
                    <p className="text-sm text-gray-500">
                      Status: <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                        {getStatusLabel(project.status)}
                      </span>
                    </p>
                  </div>

                  <div className="space-y-2 bg-gray-50 p-4 rounded-lg">
                    {/* Valor negociado */}
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-700">• Valor Negociado:</span>
                      <span className="font-medium text-gray-900">
                        R$ {project.service_fees.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Custos adicionais */}
                    {project.additional_costs.map((cost: AdditionalCost) => (
                      <div key={cost.id} className="flex justify-between items-center text-sm">
                        <span className="text-gray-700">
                          • {getCostTypeLabel(cost.cost_type)}: {cost.description}
                        </span>
                        <span className="font-medium text-gray-900">
                          R$ {cost.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}

                    {/* Total do projeto */}
                    <div className="flex justify-between items-center text-sm pt-2 mt-2 border-t border-gray-300">
                      <span className="font-bold text-gray-900">TOTAL DO PROJETO:</span>
                      <span className="font-bold text-lg text-blue-600">
                        R$ {project.grand_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Recebido e Saldo */}
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-700">Total Recebido:</span>
                      <span className="font-medium text-green-600">
                        R$ {project.total_received.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {project.balance > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-semibold text-red-700">Saldo a Receber:</span>
                        <span className="font-bold text-red-600">
                          R$ {project.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Histórico de Pagamentos */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Histórico de Recebimentos</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Serviço Prestado</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Forma Pagamento</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Conta</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Observações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        Nenhum recebimento encontrado
                      </td>
                    </tr>
                  ) : (
                    payments.map(payment => (
                      <tr key={payment.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {new Date(payment.payment_date).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{payment.service_description}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {getPaymentMethodLabel(payment.payment_method)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{payment.account_name}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-green-600">
                          R$ {payment.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{payment.notes || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal de Cadastro de Recebimento */}
      {showPaymentForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">Cadastrar Recebimento</h3>
              <button
                onClick={() => setShowPaymentForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Projeto *
                </label>
                <select
                  value={paymentForm.project_id}
                  onChange={(e) => setPaymentForm({ ...paymentForm, project_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Selecione o projeto</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.name} - Saldo: R$ {project.balance.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data do Recebimento *
                  </label>
                  <input
                    type="date"
                    value={paymentForm.payment_date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={paymentForm.value}
                    onChange={(e) => setPaymentForm({ ...paymentForm, value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0,00"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Forma de Pagamento *
                  </label>
                  <select
                    value={paymentForm.payment_method}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="pix">PIX</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="transferencia">Transferência</option>
                    <option value="cheque">Cheque</option>
                    <option value="cartao">Cartão</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Conta de Caixa *
                  </label>
                  <select
                    value={paymentForm.conta_caixa_id}
                    onChange={(e) => setPaymentForm({ ...paymentForm, conta_caixa_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Selecione a conta</option>
                    {accounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações
                </label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Observações sobre o recebimento..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? 'Cadastrando...' : 'Cadastrar Recebimento'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPaymentForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
