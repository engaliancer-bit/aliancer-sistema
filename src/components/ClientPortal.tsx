import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Home, Building, FileText, Bell, LogOut, Eye, Download,
  CheckCircle, Clock, AlertCircle, XCircle, Plus, File,
  Image as ImageIcon, Paperclip, ArrowLeft
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// Types
interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface Property {
  id: string;
  name: string;
  registration_number: string;
  area: number;
  municipality: string;
  state: string;
}

interface PropertyDocument {
  id: string;
  document_type: string;
  document_number: string;
  issue_date: string;
  expiry_date: string | null;
  notes: string | null;
}

interface Attachment {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  file_path: string;
  created_at: string;
}

interface Project {
  id: string;
  title: string;
  service_type: string;
  status: string;
  progress_percentage: number;
  current_phase: string;
  property_name: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  is_read: boolean;
  created_at: string;
}

export default function ClientPortal() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  // Navigation
  const [activeTab, setActiveTab] = useState<'home' | 'properties' | 'projects' | 'notifications'>('home');

  // Data state
  const [properties, setProperties] = useState<Property[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Property details
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [propertyDocuments, setPropertyDocuments] = useState<PropertyDocument[]>([]);
  const [propertyAttachments, setPropertyAttachments] = useState<Attachment[]>([]);

  const hasLoadedData = useRef(false);
  const customerIdRef = useRef<string | null>(null);

  const authenticateWithToken = useCallback(async (token: string) => {
    try {
      const { data, error } = await supabase.rpc('validate_customer_token', {
        p_token: token
      });

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        const customerData = data[0];

        localStorage.setItem('client_portal_token', token);

        setCustomer({
          id: customerData.customer_id,
          name: customerData.customer_name,
          email: customerData.customer_email || '',
          phone: customerData.customer_phone || ''
        });

        setIsAuthenticated(true);
      } else {
        localStorage.removeItem('client_portal_token');
        alert('Seu acesso expirou ou é inválido. Por favor, solicite um novo link.');
      }
    } catch (error: any) {
      localStorage.removeItem('client_portal_token');
      alert('Erro ao validar acesso. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  const initializePortal = useCallback(async () => {
    try {
      setLoading(true);

      const urlParams = new URLSearchParams(window.location.search);
      let token = urlParams.get('portal');

      if (!token) {
        token = localStorage.getItem('client_portal_token');
      }

      if (token) {
        await authenticateWithToken(token);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Erro ao inicializar portal');
      setLoading(false);
    }
  }, [authenticateWithToken]);

  const loadAllData = useCallback(async () => {
    if (!customer) {
      return;
    }

    try {
      const { data: propsData, error: propsError } = await supabase
        .from('properties')
        .select('id, name, registration_number, area, municipality, state')
        .eq('customer_id', customer.id)
        .eq('client_access_enabled', true)
        .order('name');

      if (!propsError) {
        setProperties(propsData || []);
      }

      const { data: projectsData, error: projectsError } = await supabase
        .from('engineering_projects')
        .select(`
          id, title, service_type, status, progress_percentage, current_phase,
          properties (name)
        `)
        .eq('customer_id', customer.id)
        .eq('client_visible', true)
        .order('created_at', { ascending: false });

      if (!projectsError) {
        setProjects((projectsData || []).map(p => ({
          id: p.id,
          title: p.title,
          service_type: p.service_type,
          status: p.status,
          progress_percentage: p.progress_percentage || 0,
          current_phase: p.current_phase || 'Iniciando',
          property_name: (p.properties as any)?.name || 'N/A'
        })));
      }

      const { data: notifsData, error: notifsError } = await supabase
        .from('client_notifications')
        .select('*')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!notifsError) {
        setNotifications(notifsData || []);
      }

    } catch (error) {
      console.error('Erro ao carregar dados');
    }
  }, [customer]);

  // Initialize - Check for token and authenticate
  useEffect(() => {
    initializePortal();
  }, [initializePortal]);

  // Load data when authenticated (only once per customer)
  useEffect(() => {
    if (isAuthenticated && customer && customer.id !== customerIdRef.current) {
      customerIdRef.current = customer.id;
      if (!hasLoadedData.current) {
        hasLoadedData.current = true;
        loadAllData();
      }
    }
  }, [isAuthenticated, customer?.id, loadAllData]);

  const loadPropertyDetails = async (property: Property) => {
    try {
      setLoading(true);
      setSelectedProperty(property);

      const { data: docsData, error: docsError } = await supabase
        .from('property_documents')
        .select('*')
        .eq('property_id', property.id)
        .order('document_type');

      if (!docsError) {
        setPropertyDocuments(docsData || []);
      }

      const { data: attachmentsData, error: attachmentsError } = await supabase
        .from('attachments')
        .select('*')
        .eq('entity_type', 'property')
        .eq('entity_id', property.id)
        .order('created_at', { ascending: false });

      if (!attachmentsError) {
        setPropertyAttachments(attachmentsData || []);
      }

    } catch (error) {
      console.error('Erro ao carregar detalhes');
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = async (attachment: Attachment) => {
    try {
      const { data, error } = await supabase.storage
        .from('attachments')
        .download(attachment.file_path);

      if (error) throw error;

      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Erro ao baixar arquivo');
      alert('Erro ao baixar arquivo. Por favor, tente novamente.');
    }
  };

  const viewFile = async (attachment: Attachment) => {
    try {
      const { data, error } = await supabase.storage
        .from('attachments')
        .createSignedUrl(attachment.file_path, 3600);

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Erro ao visualizar arquivo');
      alert('Erro ao abrir arquivo. Por favor, tente novamente.');
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from('client_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.error('Erro ao marcar notificação:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('client_portal_token');
    setIsAuthenticated(false);
    setCustomer(null);
    setProperties([]);
    setProjects([]);
    setNotifications([]);
    setSelectedProperty(null);
    window.location.href = '/';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-blue-600" />;
    if (fileType === 'application/pdf') return <FileText className="w-5 h-5 text-red-600" />;
    return <File className="w-5 h-5 text-gray-600" />;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'pendente': 'bg-yellow-100 text-yellow-800',
      'em_analise': 'bg-blue-100 text-blue-800',
      'em_andamento': 'bg-purple-100 text-purple-800',
      'aprovado': 'bg-green-100 text-green-800',
      'concluido': 'bg-gray-100 text-gray-800',
      'cancelado': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'baixa': 'text-gray-600',
      'normal': 'text-blue-600',
      'alta': 'text-orange-600',
      'urgente': 'text-red-600'
    };
    return colors[priority] || 'text-gray-600';
  };

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-gray-700">Carregando Portal do Cliente...</p>
        </div>
      </div>
    );
  }

  // Login screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Portal do Cliente</h1>
            <p className="text-gray-600">Acesso não autorizado ou link expirado</p>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800">
              Por favor, use o link de acesso enviado por WhatsApp ou entre em contato para solicitar um novo acesso.
            </p>
          </div>

          <button
            onClick={() => window.location.href = '/'}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Voltar para o Início
          </button>
        </div>
      </div>
    );
  }

  // Main portal interface
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Portal do Cliente</h1>
              <p className="text-sm text-gray-600">Olá, {customer?.name}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1 overflow-x-auto">
            <button
              onClick={() => {
                setActiveTab('home');
                setSelectedProperty(null);
              }}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'home'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Início</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('properties');
                setSelectedProperty(null);
              }}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'properties'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Building className="w-4 h-4" />
              <span>Imóveis</span>
              {properties.length > 0 && (
                <span className="bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full">
                  {properties.length}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab('projects');
                setSelectedProperty(null);
              }}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'projects'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Projetos</span>
              {projects.length > 0 && (
                <span className="bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full">
                  {projects.length}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab('notifications');
                setSelectedProperty(null);
              }}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'notifications'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>Notificações</span>
              {notifications.filter(n => !n.is_read).length > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {notifications.filter(n => !n.is_read).length}
                </span>
              )}
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Home Tab */}
        {activeTab === 'home' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Bem-vindo ao seu Portal!
              </h2>
              <p className="text-gray-600">
                Aqui você pode acompanhar seus imóveis, projetos e notificações.
              </p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Imóveis</p>
                    <p className="text-3xl font-bold text-gray-900">{properties.length}</p>
                  </div>
                  <Building className="w-10 h-10 text-blue-600" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Projetos</p>
                    <p className="text-3xl font-bold text-gray-900">{projects.length}</p>
                  </div>
                  <FileText className="w-10 h-10 text-green-600" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Não Lidas</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {notifications.filter(n => !n.is_read).length}
                    </p>
                  </div>
                  <Bell className="w-10 h-10 text-orange-600" />
                </div>
              </div>
            </div>

            {/* Recent Notifications */}
            {notifications.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Notificações Recentes
                </h3>
                <div className="space-y-3">
                  {notifications.slice(0, 5).map(notif => (
                    <div
                      key={notif.id}
                      className={`p-4 rounded-lg border ${
                        notif.is_read ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{notif.title}</h4>
                          <p className="text-sm text-gray-600 mt-1">{notif.message}</p>
                          <p className="text-xs text-gray-500 mt-2">
                            {formatDate(notif.created_at)}
                          </p>
                        </div>
                        {!notif.is_read && (
                          <button
                            onClick={() => markAsRead(notif.id)}
                            className="text-blue-600 hover:text-blue-700 text-sm"
                          >
                            Marcar como lida
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Properties Tab */}
        {activeTab === 'properties' && !selectedProperty && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Meus Imóveis</h2>
            </div>

            {properties.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <Building className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nenhum imóvel disponível
                </h3>
                <p className="text-gray-600">
                  Entre em contato conosco para adicionar imóveis ao seu portal.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {properties.map(property => (
                  <div
                    key={property.id}
                    className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      loadPropertyDetails(property);
                    }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <Building className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {property.name}
                    </h3>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p>Matrícula: {property.registration_number || 'N/A'}</p>
                      <p>Área: {property.area} ha</p>
                      <p>{property.municipality} - {property.state}</p>
                    </div>
                    <button className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
                      Ver Detalhes
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Property Details */}
        {activeTab === 'properties' && selectedProperty && (
          <div className="space-y-6">
            <button
              onClick={() => setSelectedProperty(null)}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar para lista de imóveis
            </button>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {selectedProperty.name}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Matrícula</p>
                  <p className="font-medium text-gray-900">
                    {selectedProperty.registration_number || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Área</p>
                  <p className="font-medium text-gray-900">{selectedProperty.area} hectares</p>
                </div>
                <div>
                  <p className="text-gray-600">Município</p>
                  <p className="font-medium text-gray-900">{selectedProperty.municipality}</p>
                </div>
                <div>
                  <p className="text-gray-600">Estado</p>
                  <p className="font-medium text-gray-900">{selectedProperty.state}</p>
                </div>
              </div>
            </div>

            {/* Documents */}
            {propertyDocuments.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Documentos</h3>
                <div className="space-y-3">
                  {propertyDocuments.map(doc => (
                    <div key={doc.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{doc.document_type}</h4>
                          <p className="text-sm text-gray-600 mt-1">
                            Número: {doc.document_number || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Emissão: {doc.issue_date ? formatDate(doc.issue_date) : 'N/A'}
                          </p>
                          {doc.expiry_date && (
                            <p className="text-xs text-gray-500">
                              Validade: {formatDate(doc.expiry_date)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Attachments */}
            {propertyAttachments.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Anexos ({propertyAttachments.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {propertyAttachments.map(attachment => (
                    <div
                      key={attachment.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        {getFileIcon(attachment.file_type)}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">
                            {attachment.file_name}
                          </h4>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatFileSize(attachment.file_size)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDate(attachment.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => viewFile(attachment)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                          <Eye className="w-4 h-4" />
                          Visualizar
                        </button>
                        <button
                          onClick={() => downloadFile(attachment)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                        >
                          <Download className="w-4 h-4" />
                          Baixar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {propertyDocuments.length === 0 && propertyAttachments.length === 0 && (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <Paperclip className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nenhum documento ou anexo disponível
                </h3>
                <p className="text-gray-600">
                  Este imóvel ainda não possui documentos ou anexos cadastrados.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Projects Tab */}
        {activeTab === 'projects' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">Meus Projetos</h2>

            {projects.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nenhum projeto disponível
                </h3>
                <p className="text-gray-600">
                  Você ainda não possui projetos cadastrados.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {projects.map(project => (
                  <div key={project.id} className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {project.title}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {project.service_type} • {project.property_name}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(project.status)}`}>
                        {project.status}
                      </span>
                    </div>

                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-600">Progresso</span>
                        <span className="font-medium text-gray-900">
                          {project.progress_percentage}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${project.progress_percentage}%` }}
                        />
                      </div>
                    </div>

                    <p className="text-sm text-gray-600">
                      Fase atual: <span className="font-medium text-gray-900">{project.current_phase}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">Notificações</h2>

            {notifications.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <Bell className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nenhuma notificação
                </h3>
                <p className="text-gray-600">
                  Você não possui notificações no momento.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map(notif => (
                  <div
                    key={notif.id}
                    className={`bg-white rounded-lg shadow-sm p-6 ${
                      !notif.is_read ? 'border-l-4 border-blue-600' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-gray-900">{notif.title}</h3>
                          <span className={`text-sm ${getPriorityColor(notif.priority)}`}>
                            {notif.priority}
                          </span>
                        </div>
                        <p className="text-gray-600 mb-2">{notif.message}</p>
                        <p className="text-xs text-gray-500">
                          {formatDate(notif.created_at)}
                        </p>
                      </div>
                      {!notif.is_read && (
                        <button
                          onClick={() => markAsRead(notif.id)}
                          className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          Marcar como lida
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
