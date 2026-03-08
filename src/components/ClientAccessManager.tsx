import React, { useState, useEffect } from 'react';
import { Link2, Send, Eye, EyeOff, Copy, Check, Clock, Users, Bell, CheckSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  client_portal_enabled: boolean;
  last_access_at: string | null;
}

interface AccessToken {
  id: string;
  customer_id: string;
  token: string;
  phone_number: string;
  expires_at: string;
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
  customer_name: string;
}

export default function ClientAccessManager() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [accessTokens, setAccessTokens] = useState<AccessToken[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});

  // New approval/notification states
  const [showNewApproval, setShowNewApproval] = useState(false);
  const [showNewNotification, setShowNewNotification] = useState(false);
  const [newApproval, setNewApproval] = useState({
    customer_id: '',
    title: '',
    description: '',
    estimated_value: '',
    estimated_days: '',
    expires_in_days: '15'
  });
  const [newNotification, setNewNotification] = useState({
    customer_id: '',
    type: 'geral',
    title: '',
    message: '',
    priority: 'normal'
  });

  useEffect(() => {
    loadCustomers();
    loadAccessTokens();
  }, []);

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  const loadAccessTokens = async () => {
    try {
      const { data, error } = await supabase
        .from('customer_access_tokens')
        .select(`
          *,
          customers(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAccessTokens((data || []).map(token => ({
        ...token,
        customer_name: token.customers?.name || 'N/A'
      })));
    } catch (error) {
      console.error('Erro ao carregar tokens:', error);
    }
  };

  const generateAccessToken = async (customerId: string) => {
    try {
      setLoading(true);

      const customer = customers.find(c => c.id === customerId);
      if (!customer) {
        console.error('❌ Cliente não encontrado:', customerId);
        alert('Cliente não encontrado');
        return;
      }

      if (!customer.phone) {
        alert('Cliente não possui telefone cadastrado. Por favor, cadastre um telefone primeiro.');
        return;
      }

      console.log('🔧 Gerando token para cliente:', customer.name);
      console.log('📱 Telefone:', customer.phone);

      const { data, error } = await supabase.rpc('generate_customer_access_token', {
        p_customer_id: customerId,
        p_phone_number: customer.phone,
        p_expires_in_days: 90
      });

      if (error) {
        console.error('❌ Erro ao gerar token:', error);
        throw error;
      }

      console.log('✅ Token gerado com sucesso:', data);
      alert('Token de acesso gerado com sucesso!');
      loadAccessTokens();
      setSelectedCustomer(customerId);
    } catch (error: any) {
      console.error('❌ Erro ao gerar token:', error);
      alert(`Erro ao gerar token de acesso: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleCustomerAccess = async (customerId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('customers')
        .update({ client_portal_enabled: enabled })
        .eq('id', customerId);

      if (error) throw error;

      setCustomers(prev =>
        prev.map(c => c.id === customerId ? { ...c, client_portal_enabled: enabled } : c)
      );
    } catch (error) {
      console.error('Erro ao atualizar acesso:', error);
      alert('Erro ao atualizar acesso do cliente');
    }
  };

  const deactivateToken = async (tokenId: string) => {
    if (!confirm('Deseja realmente excluir este token? O cliente não poderá mais acessar o portal com ele e esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('customer_access_tokens')
        .delete()
        .eq('id', tokenId);

      if (error) throw error;

      alert('Token excluído com sucesso');
      loadAccessTokens();
    } catch (error) {
      console.error('Erro ao excluir token:', error);
      alert('Erro ao excluir token');
    }
  };

  const copyToClipboard = async (text: string, tokenId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedToken(tokenId);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch (error) {
      console.error('Erro ao copiar:', error);
      alert('Erro ao copiar para área de transferência');
    }
  };

  const getPortalUrl = (token: string) => {
    const origin = window.location.origin;
    return `${origin}/portal.html?token=${token}`;
  };

  const getWhatsAppUrl = (phone: string, token: string) => {
    const portalUrl = getPortalUrl(token);
    const message = `Olá! Você tem acesso ao Portal do Cliente.\n\n🔗 *Clique no link abaixo:*\n${portalUrl}\n\n📱 Funciona em Android, iOS e computador.\n\nSe tiver dificuldades, entre em contato.`;
    const encodedMessage = encodeURIComponent(message);
    const cleanPhone = phone.replace(/\D/g, '');
    return `https://wa.me/55${cleanPhone}?text=${encodedMessage}`;
  };

  const createApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(newApproval.expires_in_days));

      const { error } = await supabase
        .from('service_approvals')
        .insert([{
          customer_id: newApproval.customer_id,
          title: newApproval.title,
          description: newApproval.description,
          estimated_value: parseFloat(newApproval.estimated_value),
          estimated_days: newApproval.estimated_days ? parseInt(newApproval.estimated_days) : null,
          expires_at: expiresAt.toISOString(),
          status: 'pendente'
        }]);

      if (error) throw error;

      // Criar notificação automática
      await supabase.rpc('create_client_notification', {
        p_customer_id: newApproval.customer_id,
        p_type: 'aprovacao',
        p_title: 'Nova Aprovação Necessária',
        p_message: `Você tem um novo orçamento aguardando aprovação: ${newApproval.title}`,
        p_priority: 'alta'
      });

      alert('Aprovação criada com sucesso! O cliente foi notificado.');
      setShowNewApproval(false);
      setNewApproval({
        customer_id: '',
        title: '',
        description: '',
        estimated_value: '',
        estimated_days: '',
        expires_in_days: '15'
      });
    } catch (error) {
      console.error('Erro ao criar aprovação:', error);
      alert('Erro ao criar aprovação');
    } finally {
      setLoading(false);
    }
  };

  const createNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);

      const { error } = await supabase.rpc('create_client_notification', {
        p_customer_id: newNotification.customer_id,
        p_type: newNotification.type,
        p_title: newNotification.title,
        p_message: newNotification.message,
        p_priority: newNotification.priority
      });

      if (error) throw error;

      alert('Notificação enviada com sucesso!');
      setShowNewNotification(false);
      setNewNotification({
        customer_id: '',
        type: 'geral',
        title: '',
        message: '',
        priority: 'normal'
      });
    } catch (error) {
      console.error('Erro ao criar notificação:', error);
      alert('Erro ao criar notificação');
    } finally {
      setLoading(false);
    }
  };

  const customerTokens = selectedCustomer
    ? accessTokens.filter(t => t.customer_id === selectedCustomer)
    : accessTokens;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Portal do Cliente</h2>
          <p className="text-gray-600 mt-1">
            Gerencie o acesso dos clientes aos seus dados e projetos
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowNewApproval(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            <CheckSquare className="w-5 h-5" />
            Nova Aprovação
          </button>
          <button
            onClick={() => setShowNewNotification(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Bell className="w-5 h-5" />
            Enviar Notificação
          </button>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Como funciona o Portal do Cliente?</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Gere um token de acesso único para cada cliente</li>
          <li>• Envie o link por WhatsApp ou e-mail</li>
          <li>• O cliente acessa seus imóveis, documentos e projetos</li>
          <li>• Pode aprovar orçamentos e solicitar serviços</li>
          <li>• Recebe notificações de vencimentos e atualizações</li>
          <li>• O token é válido por 90 dias e pode ser desativado a qualquer momento</li>
        </ul>
      </div>

      {/* Customers List */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Clientes</h3>
          <p className="text-sm text-gray-600 mt-1">
            Gere tokens de acesso e envie para seus clientes
          </p>
        </div>

        <div className="p-6">
          <div className="space-y-3">
            {customers.map(customer => {
              const hasActiveToken = accessTokens.some(
                t => t.customer_id === customer.id && t.is_active && new Date(t.expires_at) > new Date()
              );

              return (
                <div
                  key={customer.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-gray-900">{customer.name}</h4>
                        {hasActiveToken && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                            Com acesso
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>{customer.phone || 'Sem telefone'}</span>
                        <span>{customer.email || 'Sem e-mail'}</span>
                        {customer.last_access_at && (
                          <span className="text-gray-500">
                            Último acesso: {new Date(customer.last_access_at).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleCustomerAccess(customer.id, !customer.client_portal_enabled)}
                        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                          customer.client_portal_enabled
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {customer.client_portal_enabled ? 'Habilitado' : 'Desabilitado'}
                      </button>

                      {customer.client_portal_enabled && (
                        <>
                          <button
                            onClick={() => generateAccessToken(customer.id)}
                            disabled={loading}
                            className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-gray-400 text-sm"
                          >
                            <Link2 className="w-4 h-4" />
                            Gerar Token
                          </button>

                          {hasActiveToken && (
                            <button
                              onClick={() => setSelectedCustomer(selectedCustomer === customer.id ? null : customer.id)}
                              className="px-3 py-1 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors text-sm"
                            >
                              {selectedCustomer === customer.id ? 'Ocultar' : 'Ver Tokens'}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Token List for Selected Customer */}
                  {selectedCustomer === customer.id && (
                    <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                      {customerTokens.map(token => {
                        const isExpired = new Date(token.expires_at) < new Date();
                        const portalUrl = getPortalUrl(token.token);

                        return (
                          <div
                            key={token.id}
                            className={`bg-gray-50 rounded-lg p-4 ${!token.is_active || isExpired ? 'opacity-60' : ''}`}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    token.is_active && !isExpired
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {!token.is_active ? 'Desativado' : isExpired ? 'Expirado' : 'Ativo'}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    Criado em {new Date(token.created_at).toLocaleDateString('pt-BR')}
                                  </span>
                                </div>
                                <div className="text-sm text-gray-600 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4" />
                                    Expira em: {new Date(token.expires_at).toLocaleDateString('pt-BR')}
                                  </div>
                                  {token.last_used_at && (
                                    <div className="flex items-center gap-2 text-gray-500">
                                      <Users className="w-4 h-4" />
                                      Último uso: {new Date(token.last_used_at).toLocaleDateString('pt-BR')}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {token.is_active && !isExpired && (
                                <button
                                  onClick={() => deactivateToken(token.id)}
                                  className="text-red-600 hover:text-red-700 text-sm font-medium"
                                >
                                  Excluir
                                </button>
                              )}
                            </div>

                            <div className="space-y-2">
                              {/* Token Display */}
                              <div>
                                <label className="text-xs text-gray-600 mb-1 block">Token:</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type={showTokens[token.id] ? 'text' : 'password'}
                                    value={token.token}
                                    readOnly
                                    className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-sm font-mono"
                                  />
                                  <button
                                    onClick={() => setShowTokens({ ...showTokens, [token.id]: !showTokens[token.id] })}
                                    className="p-2 border border-gray-300 rounded hover:bg-gray-50"
                                  >
                                    {showTokens[token.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                  </button>
                                  <button
                                    onClick={() => copyToClipboard(token.token, token.id)}
                                    className="p-2 border border-gray-300 rounded hover:bg-gray-50"
                                  >
                                    {copiedToken === token.id ? (
                                      <Check className="w-4 h-4 text-green-600" />
                                    ) : (
                                      <Copy className="w-4 h-4" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              {/* Portal URL */}
                              <div>
                                <label className="text-xs text-gray-600 mb-1 block">Link do Portal:</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={portalUrl}
                                    readOnly
                                    className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-sm"
                                  />
                                  <button
                                    onClick={() => copyToClipboard(portalUrl, `url-${token.id}`)}
                                    className="p-2 border border-gray-300 rounded hover:bg-gray-50"
                                  >
                                    {copiedToken === `url-${token.id}` ? (
                                      <Check className="w-4 h-4 text-green-600" />
                                    ) : (
                                      <Copy className="w-4 h-4" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              {/* Token Simples para Copiar */}
                              <div>
                                <label className="text-xs text-gray-600 mb-1 block">Código de Acesso (token):</label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    readOnly
                                    value={token.token}
                                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm font-mono text-xs"
                                  />
                                  <button
                                    onClick={() => copyToClipboard(token.token, `token-${token.id}`)}
                                    className="p-2 border border-gray-300 rounded hover:bg-gray-50"
                                  >
                                    {copiedToken === `token-${token.id}` ? (
                                      <Check className="w-4 h-4 text-green-600" />
                                    ) : (
                                      <Copy className="w-4 h-4" />
                                    )}
                                  </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  Use este código se o link não funcionar
                                </p>
                              </div>

                              {/* WhatsApp Link */}
                              <div>
                                <label className="text-xs text-gray-600 mb-1 block">Enviar por WhatsApp:</label>
                                <a
                                  href={customer.phone ? getWhatsAppUrl(customer.phone, token.token) : '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => {
                                    if (!customer.phone || customer.phone.trim() === '') {
                                      e.preventDefault();
                                      alert('Cliente não possui telefone cadastrado. Por favor, cadastre um telefone válido primeiro.');
                                      return;
                                    }
                                    const cleanPhone = customer.phone.replace(/\D/g, '');
                                    if (cleanPhone.length < 10 || cleanPhone.length > 13) {
                                      e.preventDefault();
                                      alert('Número de telefone inválido. Por favor, verifique o telefone cadastrado do cliente (deve ter DDD + número).');
                                      return;
                                    }
                                  }}
                                  className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm font-medium"
                                >
                                  <Send className="w-4 h-4" />
                                  Enviar pelo WhatsApp
                                </a>
                                <p className="text-xs text-gray-500 mt-1">
                                  Link otimizado para funcionar em qualquer dispositivo (Android, iOS, PC)
                                </p>
                              </div>

                              {/* Instruções para o Cliente */}
                              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                                <h4 className="text-xs font-semibold text-blue-900 mb-1">📱 Instruções para o Cliente:</h4>
                                <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                                  <li>Clique no link recebido pelo WhatsApp</li>
                                  <li>Aguarde carregar o Portal do Cliente</li>
                                  <li>Se não abrir, copie o código acima e cole na tela de login</li>
                                </ol>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {customers.length === 0 && (
              <div className="text-center py-8 text-gray-600">
                Nenhum cliente cadastrado ainda.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Approval Modal */}
      {showNewApproval && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Criar Aprovação de Serviço</h3>

            <form onSubmit={createApproval} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                <select
                  value={newApproval.customer_id}
                  onChange={(e) => setNewApproval({ ...newApproval, customer_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Selecione um cliente</option>
                  {customers.filter(c => c.client_portal_enabled).map(customer => (
                    <option key={customer.id} value={customer.id}>{customer.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                <input
                  type="text"
                  value={newApproval.title}
                  onChange={(e) => setNewApproval({ ...newApproval, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Levantamento Topográfico - Fazenda Santa Clara"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea
                  value={newApproval.description}
                  onChange={(e) => setNewApproval({ ...newApproval, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Descreva o serviço que está sendo orçado..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor Estimado (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newApproval.estimated_value}
                    onChange={(e) => setNewApproval({ ...newApproval, estimated_value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prazo Estimado (dias)</label>
                  <input
                    type="number"
                    value={newApproval.estimated_days}
                    onChange={(e) => setNewApproval({ ...newApproval, estimated_days: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Validade da Proposta (dias)</label>
                <input
                  type="number"
                  value={newApproval.expires_in_days}
                  onChange={(e) => setNewApproval({ ...newApproval, expires_in_days: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewApproval(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {loading ? 'Criando...' : 'Criar Aprovação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Notification Modal */}
      {showNewNotification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Enviar Notificação</h3>

            <form onSubmit={createNotification} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                <select
                  value={newNotification.customer_id}
                  onChange={(e) => setNewNotification({ ...newNotification, customer_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Selecione um cliente</option>
                  {customers.filter(c => c.client_portal_enabled).map(customer => (
                    <option key={customer.id} value={customer.id}>{customer.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    value={newNotification.type}
                    onChange={(e) => setNewNotification({ ...newNotification, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="geral">Geral</option>
                    <option value="projeto">Projeto</option>
                    <option value="documento">Documento</option>
                    <option value="vencimento">Vencimento</option>
                    <option value="servico">Serviço</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
                  <select
                    value={newNotification.priority}
                    onChange={(e) => setNewNotification({ ...newNotification, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="baixa">Baixa</option>
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                <input
                  type="text"
                  value={newNotification.title}
                  onChange={(e) => setNewNotification({ ...newNotification, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Documento próximo do vencimento"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem</label>
                <textarea
                  value={newNotification.message}
                  onChange={(e) => setNewNotification({ ...newNotification, message: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Digite a mensagem da notificação..."
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewNotification(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {loading ? 'Enviando...' : 'Enviar Notificação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
