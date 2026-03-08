import { useState, useEffect } from 'react';
import { X, MessageCircle, Copy, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface WhatsAppBillingModalProps {
  projectId: string;
  customerName: string;
  customerPhone: string;
  onClose: () => void;
}

interface ProjectDetails {
  name: string;
  property_name: string;
  total_actual_value: number;
  grand_total: number;
  total_received: number;
  balance: number;
  services: Array<{
    description: string;
    value: number;
  }>;
  costs: Array<{
    cost_type: string;
    description: string;
    value: number;
  }>;
}

interface CompanySettings {
  name: string;
  phone: string;
  pix_key: string;
  bank_account: string;
}

export default function WhatsAppBillingModal({
  projectId,
  customerName,
  customerPhone,
  onClose
}: WhatsAppBillingModalProps) {
  const [projectDetails, setProjectDetails] = useState<ProjectDetails | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadData();
  }, [projectId]);

  async function loadData() {
    try {
      console.log('[WhatsApp Modal] Iniciando carregamento de dados para projeto:', projectId);

      // Carregar detalhes do projeto
      const { data: project, error: projectError } = await supabase
        .from('engineering_projects')
        .select('name, total_actual_value, grand_total, total_received, balance, property_id')
        .eq('id', projectId)
        .maybeSingle();

      console.log('[WhatsApp Modal] Projeto carregado:', project);

      if (projectError) {
        console.error('[WhatsApp Modal] Erro ao carregar projeto:', projectError);
        throw new Error(`Erro ao carregar projeto: ${projectError.message}`);
      }

      if (!project) {
        throw new Error('Projeto não encontrado');
      }

      // Carregar nome do imóvel
      let propertyName = 'N/A';
      if (project.property_id) {
        const { data: property, error: propertyError } = await supabase
          .from('properties')
          .select('name')
          .eq('id', project.property_id)
          .maybeSingle();

        if (propertyError) {
          console.error('[WhatsApp Modal] Erro ao carregar imóvel:', propertyError);
        } else if (property) {
          propertyName = property.name;
        }
      }

      console.log('[WhatsApp Modal] Imóvel:', propertyName);

      // Carregar custos adicionais
      const { data: costs, error: costsError } = await supabase
        .from('engineering_project_costs')
        .select('cost_type, description, value')
        .eq('project_id', projectId)
        .order('date', { ascending: true });

      if (costsError) {
        console.error('[WhatsApp Modal] Erro ao carregar custos:', costsError);
        throw new Error(`Erro ao carregar custos: ${costsError.message}`);
      }

      console.log('[WhatsApp Modal] Custos carregados:', costs?.length || 0);

      // Carregar configurações da empresa
      const { data: settingsData, error: settingsError } = await supabase
        .from('company_settings')
        .select('setting_key, setting_value, pix_key, bank_account');

      console.log('[WhatsApp Modal] Configurações carregadas:', settingsData);

      if (settingsError) {
        console.error('[WhatsApp Modal] Erro ao carregar configurações:', settingsError);
        throw new Error(`Erro ao carregar configurações: ${settingsError.message}`);
      }

      if (!settingsData || settingsData.length === 0) {
        throw new Error('Configure os dados da empresa em Configurações antes de enviar cobranças');
      }

      // Criar objeto de configurações a partir dos dados
      const settings: CompanySettings = {
        name: '',
        phone: '',
        pix_key: '',
        bank_account: ''
      };

      // Buscar nas configurações formato chave-valor
      settingsData.forEach((item: any) => {
        if (item.setting_key === 'company_name') {
          settings.name = item.setting_value || '';
        } else if (item.setting_key === 'company_phone' || item.setting_key === 'phone') {
          settings.phone = item.setting_value || '';
        } else if (item.setting_key === 'bank_pix' || item.setting_key === 'pix_key') {
          settings.pix_key = item.setting_value || '';
        } else if (item.setting_key === 'bank_account') {
          settings.bank_account = item.setting_value || '';
        }
      });

      // Também verificar colunas diretas (caso existam)
      if (settingsData.length > 0) {
        if (settingsData[0].pix_key) settings.pix_key = settingsData[0].pix_key;
        if (settingsData[0].bank_account) settings.bank_account = settingsData[0].bank_account;
      }

      console.log('[WhatsApp Modal] Configurações processadas:', settings);

      // Validar campos obrigatórios
      if (!settings.name) {
        throw new Error('Configure o nome da empresa em Configurações');
      }

      setProjectDetails({
        name: project.name,
        property_name: propertyName,
        total_actual_value: project.total_actual_value || 0,
        grand_total: project.grand_total || 0,
        total_received: project.total_received || 0,
        balance: project.balance || 0,
        services: [],
        costs: costs || []
      });

      setCompanySettings(settings);
      setLoading(false);

      console.log('[WhatsApp Modal] Dados carregados com sucesso');
    } catch (error) {
      console.error('[WhatsApp Modal] Erro completo:', error);

      let errorMessage = 'Erro desconhecido';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = JSON.stringify(error);
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      alert(`Erro ao carregar dados: ${errorMessage}`);
      onClose();
    }
  }

  function getCostTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      material: 'Material',
      travel: 'Viagem/Deslocamento',
      service: 'Serviço',
      honorarios_servicos_adicionais: 'Honorários - Serviços Adicionais',
      marco_concreto: 'Marco de Concreto',
      outros: 'Outros'
    };
    return labels[type] || type;
  }

  function calculateInstallments(amount: number, installments: number, interestRate: number = 0.012): number {
    const totalWithInterest = amount * Math.pow(1 + interestRate, installments);
    return totalWithInterest / installments;
  }

  function generateWhatsAppMessage(): string {
    if (!projectDetails || !companySettings) return '';

    const balance = projectDetails.balance;

    let message = `🏢 *${companySettings.name}*\n\n`;
    message += `Olá, ${customerName}! 👋\n\n`;
    message += `Segue o extrato detalhado do projeto:\n\n`;

    message += `📋 *PROJETO:* ${projectDetails.name}\n`;
    message += `🏠 *IMÓVEL:* ${projectDetails.property_name}\n\n`;

    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `💰 *DISCRIMINAÇÃO DE VALORES*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    message += `• *Valor Negociado:*\n`;
    message += `  R$ ${projectDetails.total_actual_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n`;

    if (projectDetails.costs.length > 0) {
      message += `• *Custos Adicionais:*\n`;
      projectDetails.costs.forEach(cost => {
        message += `  - ${getCostTypeLabel(cost.cost_type)}: ${cost.description}\n`;
        message += `    R$ ${cost.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      });
      message += `\n`;
    }

    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `💵 *RESUMO FINANCEIRO*\n\n`;
    message += `*Valor Total:* R$ ${projectDetails.grand_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
    message += `*Total Recebido:* R$ ${projectDetails.total_received.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n`;
    message += `🔴 *SALDO A RECEBER: R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n\n`;

    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `💳 *FORMAS DE PAGAMENTO*\n\n`;

    message += `💰 *À VISTA (sem juros):*\n`;
    message += `  • PIX: R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
    if (companySettings.pix_key) {
      message += `    Chave: ${companySettings.pix_key}\n`;
    }
    message += `  • Dinheiro: R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
    message += `  • Débito: R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n`;

    message += `💳 *CARTÃO DE CRÉDITO:*\n`;
    message += `  • 1x R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (sem juros)\n`;
    for (let i = 2; i <= 4; i++) {
      const installmentValue = calculateInstallments(balance, i);
      const percentIncrease = ((installmentValue * i / balance - 1) * 100).toFixed(1);
      message += `  • ${i}x R$ ${installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (+${percentIncrease}%)\n`;
    }
    message += `\n`;

    message += `📄 *BOLETO (consulte parcelamento):*\n`;
    message += `  • 1x R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (sem juros)\n`;
    for (let i = 2; i <= 3; i++) {
      const installmentValue = calculateInstallments(balance, i);
      const percentIncrease = ((installmentValue * i / balance - 1) * 100).toFixed(1);
      message += `  • ${i}x R$ ${installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (+${percentIncrease}%)\n`;
    }
    message += `\n`;

    message += `📝 *CHEQUE PRÉ-DATADO:*\n`;
    message += `  • 1x R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (sem juros)\n`;
    for (let i = 2; i <= 3; i++) {
      const installmentValue = calculateInstallments(balance, i);
      const percentIncrease = ((installmentValue * i / balance - 1) * 100).toFixed(1);
      message += `  • ${i}x R$ ${installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (+${percentIncrease}%)\n`;
    }
    message += `\n`;

    if (companySettings.bank_account) {
      message += `🏦 *TRANSFERÊNCIA BANCÁRIA:*\n`;
      message += `  ${companySettings.bank_account}\n\n`;
    }

    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `Estamos à disposição para esclarecer qualquer dúvida!\n\n`;

    if (companySettings.phone) {
      message += `📞 *Contato:* ${companySettings.phone}\n`;
    }

    message += `\n_Mensagem gerada automaticamente pelo Sistema de Gestão_`;

    return message;
  }

  function handleOpenWhatsApp() {
    const message = generateWhatsAppMessage();
    // Remover caracteres especiais do telefone
    const phoneNumber = customerPhone.replace(/\D/g, '');
    // Codificar mensagem para URL
    const encodedMessage = encodeURIComponent(message);
    // Abrir WhatsApp Web
    const whatsappUrl = `https://wa.me/55${phoneNumber}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  }

  function handleCopyMessage() {
    const message = generateWhatsAppMessage();
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Carregando dados...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <MessageCircle className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-bold">Cobrança via WhatsApp</h2>
              <p className="text-sm text-green-100">Envie um extrato de cobrança ao cliente</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-green-800 p-2 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Informações do Cliente */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-2">Destinatário</h3>
            <p className="text-sm text-gray-700"><strong>Nome:</strong> {customerName}</p>
            <p className="text-sm text-gray-700"><strong>Telefone:</strong> {customerPhone}</p>
          </div>

          {/* Preview da Mensagem */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-800 mb-3">Preview da Mensagem</h3>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm font-mono text-gray-800">
                {generateWhatsAppMessage()}
              </pre>
            </div>
          </div>

          {/* Resumo Financeiro */}
          {projectDetails && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
              <h3 className="font-semibold text-red-800 mb-2">Saldo Devedor</h3>
              <p className="text-3xl font-bold text-red-600">
                R$ {projectDetails.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          )}
        </div>

        {/* Footer - Ações */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex gap-3 justify-end">
          <button
            onClick={handleCopyMessage}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-600" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copiar Mensagem
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleOpenWhatsApp}
            className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            <MessageCircle className="w-4 h-4" />
            Abrir WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
