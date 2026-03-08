import { useState, useEffect } from 'react';
import { Calendar, AlertCircle, Check, X, DollarSign, Clock, Send, CheckCircle, Building } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DocumentDeadline {
  id: string;
  property_type: 'rural' | 'urban';
  document_type: string;
  document_number: string;
  expiry_date: string;
  renewal_cost: number;
  status: 'active' | 'alert_sent' | 'proposal_accepted' | 'renewal_in_progress' | 'renewed' | 'completed' | 'expired';
  alert_sent_at: string | null;
  accepted_at: string | null;
  renewed_at: string | null;
  completed_at: string | null;
  notes: string;
  created_at: string;
  applies_to_all: boolean;
}

const DOCUMENT_TYPES = [
  { value: 'ccir', label: 'CCIR - Certificado de Cadastro de Imóvel Rural' },
  { value: 'itr', label: 'ITR - Imposto Territorial Rural' },
  { value: 'cib', label: 'CIB - Cadastro de Imóvel em Bioma' },
  { value: 'car', label: 'CAR - Cadastro Ambiental Rural' },
  { value: 'iptu', label: 'IPTU - Imposto Predial e Territorial Urbano' },
  { value: 'certidao', label: 'Certidões Diversas' },
  { value: 'other', label: 'Outro Documento' },
];

const STATUS_LABELS = {
  active: { label: 'Ativo', color: 'bg-green-100 text-green-800' },
  alert_sent: { label: 'Alertas Enviados', color: 'bg-yellow-100 text-yellow-800' },
  proposal_accepted: { label: 'Propostas Aceitas', color: 'bg-blue-100 text-blue-800' },
  renewal_in_progress: { label: 'Em Renovação', color: 'bg-purple-100 text-purple-800' },
  renewed: { label: 'Renovado', color: 'bg-indigo-100 text-indigo-800' },
  completed: { label: 'Concluído', color: 'bg-gray-100 text-gray-800' },
  expired: { label: 'Vencido', color: 'bg-red-100 text-red-800' },
};

export default function GeneralDocumentDeadlines() {
  const [deadlines, setDeadlines] = useState<DocumentDeadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    property_type: 'rural' as 'rural' | 'urban',
    document_type: 'ccir',
    document_number: '',
    expiry_date: '',
    renewal_cost: '',
    notes: '',
  });

  useEffect(() => {
    loadDeadlines();
  }, []);

  const loadDeadlines = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('document_deadlines')
        .select('*')
        .eq('applies_to_all', true)
        .order('expiry_date', { ascending: true });

      if (error) throw error;
      setDeadlines(data || []);
    } catch (error) {
      console.error('Erro ao carregar prazos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase
        .from('document_deadlines')
        .insert([{
          property_type: formData.property_type,
          document_type: formData.document_type,
          document_number: formData.document_number,
          expiry_date: formData.expiry_date,
          renewal_cost: parseFloat(formData.renewal_cost) || 0,
          notes: formData.notes,
          status: 'active',
          applies_to_all: true,
        }]);

      if (error) throw error;

      setFormData({
        property_type: 'rural',
        document_type: 'ccir',
        document_number: '',
        expiry_date: '',
        renewal_cost: '',
        notes: '',
      });
      setShowForm(false);
      loadDeadlines();
      alert('Prazo geral cadastrado com sucesso!');
    } catch (error) {
      console.error('Erro ao cadastrar prazo:', error);
      alert('Erro ao cadastrar prazo');
    }
  };

  const handleSendAlerts = async (deadline: DocumentDeadline) => {
    if (!confirm(`Deseja enviar alertas para TODOS os clientes com imóveis ${deadline.property_type === 'rural' ? 'rurais' : 'urbanos'}?`)) return;

    try {
      console.log('Iniciando envio de alertas...', {
        deadlineId: deadline.id,
        propertyType: deadline.property_type,
        documentType: deadline.document_type,
      });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp-notification`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            deadlineId: deadline.id,
            propertyType: deadline.property_type,
            appliesToAll: true,
            messageType: 'expiry_alert',
            documentType: deadline.document_type,
            documentNumber: deadline.document_number,
            expiryDate: deadline.expiry_date,
            renewalCost: deadline.renewal_cost,
          }),
        }
      );

      const responseData = await response.json();
      console.log('Resposta da Edge Function:', responseData);

      if (!response.ok) {
        throw new Error(responseData.error || 'Erro ao enviar notificações');
      }

      const { error: updateError } = await supabase
        .from('document_deadlines')
        .update({
          status: 'alert_sent',
          alert_sent_at: new Date().toISOString()
        })
        .eq('id', deadline.id);

      if (updateError) throw updateError;

      loadDeadlines();
      alert(`Alertas processados com sucesso!\n\n${responseData.message || 'Verifique os logs para detalhes.'}`);
    } catch (error) {
      console.error('Erro ao enviar alertas:', error);
      alert(`Erro ao enviar alertas!\n\nPossíveis causas:\n1. Configurações da empresa não preenchidas (vá em Configurações)\n2. Número de WhatsApp do remetente não configurado\n3. API do WhatsApp não configurada\n4. Clientes sem telefone cadastrado\n\nVerifique o console (F12) para mais detalhes.`);
    }
  };

  const handleUpdateStatus = async (deadline: DocumentDeadline, newStatus: string) => {
    try {
      const updates: any = { status: newStatus };

      if (newStatus === 'proposal_accepted') {
        updates.accepted_at = new Date().toISOString();
      } else if (newStatus === 'renewed') {
        updates.renewed_at = new Date().toISOString();
      } else if (newStatus === 'completed') {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('document_deadlines')
        .update(updates)
        .eq('id', deadline.id);

      if (error) throw error;
      loadDeadlines();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este prazo geral?')) return;

    try {
      const { error } = await supabase
        .from('document_deadlines')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadDeadlines();
    } catch (error) {
      console.error('Erro ao excluir prazo:', error);
      alert('Erro ao excluir prazo');
    }
  };

  const getDaysUntilExpiry = (expiryDate: string) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getExpiryColor = (expiryDate: string) => {
    const days = getDaysUntilExpiry(expiryDate);
    if (days < 0) return 'text-red-600 font-semibold';
    if (days <= 30) return 'text-orange-600 font-semibold';
    if (days <= 60) return 'text-yellow-600';
    return 'text-gray-600';
  };

  return (
    <div className="space-y-6">
      <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
        <h4 className="text-md font-bold text-yellow-900 mb-2 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Antes de Enviar Alertas
        </h4>
        <p className="text-sm text-yellow-800">
          Para que as notificações via WhatsApp funcionem, você precisa primeiro configurar os dados da empresa em:
          <strong className="ml-1">Indústria → Configurações</strong>
        </p>
        <p className="text-sm text-yellow-800 mt-1">
          Configure: Nome da Empresa, Telefone, Número WhatsApp Remetente, Dados Bancários e API WhatsApp
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-[#0A7EC2]" />
              Gestão de Prazos de Documentos
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Configure prazos que se aplicam a todos os imóveis de um tipo (rural ou urbano)
            </p>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-[#0A7EC2] text-white rounded-lg hover:bg-[#0968A8] transition-colors flex items-center gap-2"
            >
              <Calendar className="w-5 h-5" />
              Adicionar Prazo Geral
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-4 space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Building className="w-4 h-4 inline mr-1" />
                  Tipo de Imóvel
                </label>
                <select
                  value={formData.property_type}
                  onChange={(e) => setFormData({ ...formData, property_type: e.target.value as 'rural' | 'urban' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="rural">Imóveis Rurais</option>
                  <option value="urban">Imóveis Urbanos</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Este prazo se aplicará a todos os imóveis deste tipo
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Documento
                </label>
                <select
                  value={formData.document_type}
                  onChange={(e) => setFormData({ ...formData, document_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  {DOCUMENT_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número/Identificação do Documento
                </label>
                <input
                  type="text"
                  value={formData.document_number}
                  onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Protocolo, número de referência"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data de Vencimento
                </label>
                <input
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor do Serviço de Renovação (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.renewal_cost}
                  onChange={(e) => setFormData({ ...formData, renewal_cost: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observações
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={2}
                placeholder="Informações adicionais sobre o prazo..."
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-[#0A7EC2] text-white rounded-lg hover:bg-[#0968A8] transition-colors flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Cadastrar Prazo
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormData({
                    property_type: 'rural',
                    document_type: 'ccir',
                    document_number: '',
                    expiry_date: '',
                    renewal_cost: '',
                    notes: '',
                  });
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-center py-8 text-gray-500">
            Carregando prazos...
          </div>
        ) : deadlines.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
            Nenhum prazo geral cadastrado
          </div>
        ) : (
          <div className="space-y-4">
            {deadlines.map((deadline) => {
              const daysUntil = getDaysUntilExpiry(deadline.expiry_date);
              const docType = DOCUMENT_TYPES.find(t => t.value === deadline.document_type);
              const statusInfo = STATUS_LABELS[deadline.status];

              return (
                <div
                  key={deadline.id}
                  className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Building className="w-4 h-4 text-gray-500" />
                        <span className="text-xs font-medium text-gray-600 uppercase">
                          {deadline.property_type === 'rural' ? 'Imóveis Rurais' : 'Imóveis Urbanos'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <h5 className="font-semibold text-gray-900">
                        {docType?.label || deadline.document_type.toUpperCase()}
                      </h5>
                      {deadline.document_number && (
                        <p className="text-xs text-gray-600">Nº: {deadline.document_number}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-xs">
                    <div>
                      <p className="text-gray-500">Vencimento</p>
                      <p className={`font-medium ${getExpiryColor(deadline.expiry_date)}`}>
                        {new Date(deadline.expiry_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </p>
                      {daysUntil >= 0 ? (
                        <p className="text-gray-500 text-xs">em {daysUntil} dias</p>
                      ) : (
                        <p className="text-red-600 text-xs font-semibold">Vencido há {Math.abs(daysUntil)} dias</p>
                      )}
                    </div>

                    {deadline.renewal_cost > 0 && (
                      <div>
                        <p className="text-gray-500">Valor do Serviço</p>
                        <p className="font-medium text-gray-900">
                          R$ {deadline.renewal_cost.toFixed(2)}
                        </p>
                      </div>
                    )}

                    {deadline.alert_sent_at && (
                      <div>
                        <p className="text-gray-500">Alertas Enviados</p>
                        <p className="font-medium text-gray-900">
                          {new Date(deadline.alert_sent_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    )}
                  </div>

                  {deadline.notes && (
                    <div className="mb-3 p-2 bg-gray-50 rounded text-xs">
                      <p className="text-gray-700">{deadline.notes}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                    {deadline.status === 'active' && daysUntil <= 60 && (
                      <button
                        onClick={() => handleSendAlerts(deadline)}
                        className="px-3 py-1.5 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors text-xs flex items-center gap-1"
                        title="Enviar alertas para todos os clientes"
                      >
                        <Send className="w-3 h-3" />
                        Enviar Alertas
                      </button>
                    )}

                    {deadline.status === 'alert_sent' && (
                      <button
                        onClick={() => handleUpdateStatus(deadline, 'renewal_in_progress')}
                        className="px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-xs flex items-center gap-1"
                      >
                        <Clock className="w-3 h-3" />
                        Iniciar Renovações
                      </button>
                    )}

                    {deadline.status === 'renewal_in_progress' && (
                      <button
                        onClick={() => handleUpdateStatus(deadline, 'renewed')}
                        className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs flex items-center gap-1"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Renovações Concluídas
                      </button>
                    )}

                    {deadline.status === 'renewed' && (
                      <button
                        onClick={() => handleUpdateStatus(deadline, 'completed')}
                        className="px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-xs flex items-center gap-1"
                      >
                        <DollarSign className="w-3 h-3" />
                        Marcar como Concluído
                      </button>
                    )}

                    {deadline.status !== 'completed' && (
                      <button
                        onClick={() => handleSendAlerts(deadline)}
                        className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors text-xs flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" />
                        Reenviar Alertas
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(deadline.id)}
                      className="px-3 py-1.5 border border-red-300 text-red-600 rounded hover:bg-red-50 transition-colors text-xs flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      Excluir
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
