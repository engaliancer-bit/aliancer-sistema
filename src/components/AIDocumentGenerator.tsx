import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  FileText,
  Plus,
  Eye,
  Download,
  Sparkles,
  CheckCircle,
  XCircle,
  Upload,
  X,
  Paperclip,
  AlertCircle,
  Loader,
  ChevronLeft,
  ChevronRight,
  Settings,
  Save,
  Edit,
  ArrowRight,
  Info
} from 'lucide-react';

// Interfaces
interface SystemConfig {
  max_attachments_per_document: number;
  max_attachment_size_mb: number;
  default_polling_interval_seconds: number;
  documents_per_page: number;
}

interface IASection {
  order: number;
  title: string;
  required: boolean;
  description?: string;
}

interface IntakeQuestion {
  id: string;
  question: string;
  type: 'text' | 'textarea' | 'select' | 'boolean' | 'date' | 'number';
  options?: string[];
  required: boolean;
  placeholder?: string;
}

interface IAConfig {
  ia_enabled: boolean;
  ia_doc_type: string;
  ia_sections: IASection[];
  ia_intake_questions: IntakeQuestion[];
  ia_required_inputs: string[];
  ia_style_guide: string;
  ia_rules: {
    not_invent_data: boolean;
    use_placeholders: boolean;
    generate_pending_list: boolean;
    require_technical_review: boolean;
    description?: string;
    references?: string[];
    placeholders_rules?: string;
  };
}

interface Template {
  id: string;
  name: string;
  document_type: string;
  description: string;
  ia_enabled?: boolean;
  ia_doc_type?: string;
  ia_sections?: IASection[];
  ia_intake_questions?: IntakeQuestion[];
  ia_style_guide?: string;
  ia_rules?: any;
}

interface Project {
  id: string;
  name: string;
  customer_id: string;
  property_id: string | null;
  status: string;
  customers: { name: string };
  properties: { name: string; property_type: string } | null;
}

interface DocumentListItem {
  id: string;
  document_title: string;
  document_type: string;
  status: string;
  version: number;
  attachments_count: number;
  customer_name: string;
  project_name: string;
  job_status: string | null;
  job_progress: number | null;
  created_at: string;
}

export default function AIDocumentGenerator() {
  // Estado LOCAL (não global!)
  const [activeTab, setActiveTab] = useState<'documents' | 'templates'>('documents');
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [config, setConfig] = useState<SystemConfig>({
    max_attachments_per_document: 5,
    max_attachment_size_mb: 50,
    default_polling_interval_seconds: 3,
    documents_per_page: 20
  });

  // Paginação
  const [currentPage, setCurrentPage] = useState(0);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [loading, setLoading] = useState(false);

  // Modais
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [documentTitle, setDocumentTitle] = useState('');
  const [pendingDocumentId, setPendingDocumentId] = useState<string | null>(null);
  const [intakeAnswers, setIntakeAnswers] = useState<Record<string, any>>({});
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  // Upload
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Polling
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [pollingJobs, setPollingJobs] = useState<Set<string>>(new Set());

  // Busca de projetos
  const [projectSearch, setProjectSearch] = useState<string>('');
  const [projectsLoading, setProjectsLoading] = useState(false);

  // Carregar configurações do sistema
  useEffect(() => {
    loadSystemConfig();
    loadTemplates();
    loadProjects();
  }, []);

  // Debounce para busca de projetos
  useEffect(() => {
    const timer = setTimeout(() => {
      loadProjects(projectSearch);
    }, 300);

    return () => clearTimeout(timer);
  }, [projectSearch]);

  // Carregar documentos com paginação
  useEffect(() => {
    loadDocuments();
  }, [currentPage]);

  // Iniciar polling para jobs ativos
  useEffect(() => {
    if (pollingJobs.size > 0) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => stopPolling();
  }, [pollingJobs]);

  const loadSystemConfig = async () => {
    try {
      const { data } = await supabase
        .from('ai_system_config')
        .select('config_key, config_value')
        .in('config_key', [
          'max_attachments_per_document',
          'max_attachment_size_mb',
          'default_polling_interval_seconds',
          'documents_per_page'
        ]);

      if (data) {
        const configMap: any = {};
        data.forEach(item => {
          configMap[item.config_key] = parseInt(item.config_value as string);
        });
        setConfig(prev => ({ ...prev, ...configMap }));
      }
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
    }
  };

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const offset = currentPage * config.documents_per_page;

      const { count } = await supabase
        .from('ai_generated_documents')
        .select('*', { count: 'exact', head: true });

      setTotalDocuments(count || 0);

      const { data } = await supabase
        .from('ai_documents_list')
        .select('*')
        .range(offset, offset + config.documents_per_page - 1);

      if (data) {
        setDocuments(data as any);

        const activeJobs = data
          .filter(d => d.job_status === 'pending' || d.job_status === 'processing')
          .map(d => d.id);

        if (activeJobs.length > 0) {
          setPollingJobs(new Set(activeJobs));
        }
      }
    } catch (err) {
      console.error('Erro ao carregar documentos:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const { data } = await supabase
        .from('ai_document_templates')
        .select('id, name, document_type, description, ia_enabled, ia_doc_type, ia_sections, ia_intake_questions, ia_style_guide, ia_rules')
        .eq('is_active', true)
        .order('name');

      if (data) setTemplates(data as any);
    } catch (err) {
      console.error('Erro ao carregar templates:', err);
    }
  };

  const loadProjects = async (searchTerm: string = '') => {
    try {
      setProjectsLoading(true);

      // Query base: busca projetos "em andamento" (todos exceto 'registrado')
      let query = supabase
        .from('engineering_projects')
        .select(`
          id,
          name,
          customer_id,
          property_id,
          status,
          customers!engineering_projects_customer_id_fkey(name),
          properties!engineering_projects_property_id_fkey(name, property_type)
        `)
        .neq('status', 'registrado')
        .order('created_at', { ascending: false })
        .limit(50);

      // Se houver termo de busca, filtrar
      if (searchTerm.trim()) {
        // Busca case-insensitive no nome do projeto
        query = query.ilike('name', `%${searchTerm.trim()}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar projetos:', error);

        // Fallback: tentar buscar todos os projetos (sem filtro de status)
        const { data: fallbackData } = await supabase
          .from('engineering_projects')
          .select(`
            id,
            name,
            customer_id,
            property_id,
            status,
            customers!engineering_projects_customer_id_fkey(name),
            properties!engineering_projects_property_id_fkey(name, property_type)
          `)
          .order('created_at', { ascending: false })
          .limit(50);

        if (fallbackData) setProjects(fallbackData as any);
      } else {
        if (data) setProjects(data as any);
      }
    } catch (err) {
      console.error('Erro ao carregar projetos:', err);

      // Último fallback: sem filtros
      try {
        const { data: fallbackData } = await supabase
          .from('engineering_projects')
          .select(`
            id,
            name,
            customer_id,
            property_id,
            customers!engineering_projects_customer_id_fkey(name),
            properties!engineering_projects_property_id_fkey(name)
          `)
          .order('created_at', { ascending: false })
          .limit(50);

        if (fallbackData) setProjects(fallbackData as any);
      } catch (finalErr) {
        console.error('Erro crítico ao carregar projetos:', finalErr);
      }
    } finally {
      setProjectsLoading(false);
    }
  };

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return;

    const pollJobs = async () => {
      if (pollingJobs.size === 0) return;

      try {
        const { data } = await supabase
          .from('ai_generation_jobs')
          .select('id, document_id, status, progress')
          .in('document_id', Array.from(pollingJobs))
          .in('status', ['pending', 'processing']);

        if (data && data.length > 0) {
          setDocuments(prev => prev.map(doc => {
            const job = data.find(j => j.document_id === doc.id);
            if (job) {
              return {
                ...doc,
                job_status: job.status,
                job_progress: job.progress
              };
            }
            return doc;
          }));
        } else {
          loadDocuments();
          setPollingJobs(new Set());
        }
      } catch (err) {
        console.error('Erro no polling:', err);
      }
    };

    pollingIntervalRef.current = setInterval(
      pollJobs,
      config.default_polling_interval_seconds * 1000
    );
  }, [pollingJobs, config.default_polling_interval_seconds]);

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const handleCreateDocument = async () => {
    if (!selectedTemplate || !selectedProject) {
      alert('Selecione um template e um projeto');
      return;
    }

    setLoading(true);
    try {
      const project = projects.find(p => p.id === selectedProject);
      const template = templates.find(t => t.id === selectedTemplate);

      if (!project || !template) throw new Error('Projeto ou template não encontrado');

      const { data: doc, error } = await supabase
        .from('ai_generated_documents')
        .insert({
          template_id: selectedTemplate,
          project_id: project.id,
          customer_id: project.customer_id,
          property_id: project.property_id,
          document_title: documentTitle || template.name,
          document_type: template.document_type,
          status: 'rascunho',
          version: 1,
          created_by: 'Sistema'
        })
        .select()
        .single();

      if (error) throw error;

      const { data: sections } = await supabase
        .from('ai_document_sections')
        .select('id, section_title, section_number, content_type')
        .eq('template_id', selectedTemplate)
        .order('order_index');

      if (sections) {
        const sectionContents = sections.map(s => ({
          document_id: doc.id,
          section_id: s.id,
          section_title: s.section_title,
          section_number: s.section_number,
          content_type: s.content_type
        }));

        await supabase
          .from('ai_document_section_contents')
          .insert(sectionContents);
      }

      setShowCreateModal(false);
      setSelectedTemplate('');
      setSelectedProject('');
      setDocumentTitle('');
      loadDocuments();

      // Se template tem perguntas de intake, mostrar modal
      if (template.ia_enabled && template.ia_intake_questions && template.ia_intake_questions.length > 0) {
        setPendingDocumentId(doc.id);
        setIntakeAnswers({});
        setShowIntakeModal(true);
      }
    } catch (err) {
      console.error('Erro ao criar documento:', err);
      alert('Erro ao criar documento');
    } finally {
      setLoading(false);
    }
  };

  const handleStartGeneration = async (documentId: string) => {
    try {
      const doc = documents.find(d => d.id === documentId);
      if (!doc) return;

      const template = templates.find(t => t.name === doc.document_title.split(' - ')[0]);

      // Se tem perguntas de intake e não foram respondidas, mostrar modal
      if (template?.ia_intake_questions && template.ia_intake_questions.length > 0) {
        setPendingDocumentId(documentId);
        setIntakeAnswers({});
        setShowIntakeModal(true);
        return;
      }

      // Iniciar geração sem intake
      await startGenerationJob(documentId, {});
    } catch (err) {
      console.error('Erro ao iniciar geração:', err);
      alert('Erro ao iniciar geração');
    }
  };

  const startGenerationJob = async (documentId: string, answers: Record<string, any>) => {
    try {
      // Salvar respostas do intake
      if (Object.keys(answers).length > 0) {
        await supabase
          .from('ai_generated_documents')
          .update({ intake_answers: answers })
          .eq('id', documentId);
      }

      // Criar job
      const { data, error } = await supabase.rpc('start_generation_job', {
        p_document_id: documentId,
        p_generation_type: 'full_document',
        p_input_data: { intake_answers: answers },
        p_config: {},
        p_created_by: 'Sistema'
      });

      if (error) throw error;

      setPollingJobs(prev => new Set(prev).add(documentId));
      alert('Geração iniciada! O documento será processado em background.');

      setShowIntakeModal(false);
      setPendingDocumentId(null);
      setIntakeAnswers({});
    } catch (err) {
      console.error('Erro ao iniciar job:', err);
      alert('Erro ao iniciar geração');
    }
  };

  const handleFileUpload = async (documentId: string, file: File) => {
    const maxSizeMB = config.max_attachment_size_mb;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    if (file.size > maxSizeBytes) {
      alert(`Arquivo muito grande! Máximo: ${maxSizeMB}MB`);
      return;
    }

    const doc = documents.find(d => d.id === documentId);
    if (doc && doc.attachments_count >= config.max_attachments_per_document) {
      alert(`Máximo de ${config.max_attachments_per_document} anexos por documento`);
      return;
    }

    setUploadingFiles(prev => [...prev, file.name]);

    try {
      const fileName = `${documentId}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('ai-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('ai-documents')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('ai_document_attachments')
        .insert({
          document_id: documentId,
          file_name: file.name,
          file_type: getFileType(file.type),
          file_size_bytes: file.size,
          mime_type: file.type,
          storage_path: fileName,
          storage_url: publicUrl,
          uploaded_by: 'Sistema'
        });

      if (dbError) throw dbError;

      loadDocuments();
    } catch (err) {
      console.error('Erro no upload:', err);
      alert('Erro ao fazer upload do arquivo');
    } finally {
      setUploadingFiles(prev => prev.filter(n => n !== file.name));
    }
  };

  const handleSaveTemplateConfig = async () => {
    if (!editingTemplate) return;

    try {
      const { error } = await supabase
        .from('ai_document_templates')
        .update({
          ia_enabled: editingTemplate.ia_enabled,
          ia_doc_type: editingTemplate.ia_doc_type,
          ia_sections: editingTemplate.ia_sections,
          ia_intake_questions: editingTemplate.ia_intake_questions,
          ia_style_guide: editingTemplate.ia_style_guide,
          ia_rules: editingTemplate.ia_rules
        })
        .eq('id', editingTemplate.id);

      if (error) throw error;

      setShowConfigModal(false);
      setEditingTemplate(null);
      loadTemplates();
      alert('Configuração salva com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar configuração:', err);
      alert('Erro ao salvar configuração');
    }
  };

  const getFileType = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.includes('document') || mimeType.includes('word')) return 'document';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'spreadsheet';
    return 'other';
  };

  const getStatusBadge = (status: string, jobProgress?: number | null) => {
    if (jobProgress !== null && jobProgress !== undefined && jobProgress < 100) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <Loader className="w-4 h-4 animate-spin" />
          Gerando {jobProgress}%
        </span>
      );
    }

    const badges: any = {
      rascunho: { label: 'Rascunho', className: 'bg-gray-100 text-gray-800', icon: FileText },
      gerado: { label: 'Gerado', className: 'bg-green-100 text-green-800', icon: CheckCircle },
      em_revisao: { label: 'Em Revisão', className: 'bg-yellow-100 text-yellow-800', icon: Eye },
      aprovado: { label: 'Aprovado', className: 'bg-emerald-100 text-emerald-800', icon: CheckCircle },
      rejeitado: { label: 'Rejeitado', className: 'bg-red-100 text-red-800', icon: XCircle }
    };

    const badge = badges[status] || badges.rascunho;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.className}`}>
        <Icon className="w-4 h-4" />
        {badge.label}
      </span>
    );
  };

  const renderIntakeQuestion = (question: IntakeQuestion) => {
    const value = intakeAnswers[question.id] || '';

    switch (question.type) {
      case 'text':
      case 'date':
      case 'number':
        return (
          <input
            type={question.type}
            value={value}
            onChange={(e) => setIntakeAnswers(prev => ({ ...prev, [question.id]: e.target.value }))}
            placeholder={question.placeholder}
            required={question.required}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          />
        );

      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => setIntakeAnswers(prev => ({ ...prev, [question.id]: e.target.value }))}
            placeholder={question.placeholder}
            required={question.required}
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          />
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => setIntakeAnswers(prev => ({ ...prev, [question.id]: e.target.value }))}
            required={question.required}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="">Selecione</option>
            {question.options?.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );

      case 'boolean':
        return (
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name={question.id}
                checked={value === true}
                onChange={() => setIntakeAnswers(prev => ({ ...prev, [question.id]: true }))}
                required={question.required}
              />
              Sim
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name={question.id}
                checked={value === false}
                onChange={() => setIntakeAnswers(prev => ({ ...prev, [question.id]: false }))}
                required={question.required}
              />
              Não
            </label>
          </div>
        );

      default:
        return null;
    }
  };

  const currentTemplate = pendingDocumentId
    ? templates.find(t => {
        const doc = documents.find(d => d.id === pendingDocumentId);
        return doc && t.name === doc.document_title.split(' - ')[0];
      })
    : null;

  const totalPages = Math.ceil(totalDocuments / config.documents_per_page);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-8 h-8 text-blue-600" />
          Documentos Técnicos com IA
        </h1>
        <p className="text-gray-600 mt-2">
          Sistema assíncrono de geração de documentos com configuração personalizável por template
        </p>
      </div>

      {/* Banner Informativo */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-medium text-blue-900 mb-1">
              Fluxo Recomendado: Gerar documentos dentro do projeto
            </h3>
            <p className="text-sm text-blue-700 mb-3">
              Para manter os documentos organizados e automaticamente vinculados ao projeto correto,
              recomendamos gerar documentos diretamente na aba <strong>"Documentos IA"</strong> dentro de cada projeto.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  // Navegar para projetos (assumindo que há uma prop ou contexto para navegação)
                  // Por enquanto, vamos apenas mostrar um alert
                  alert('Vá para: Escritório → Projetos → Abrir um Projeto → Aba "Documentos IA"');
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <ArrowRight className="w-4 h-4" />
                Ir para Projetos
              </button>
              <span className="text-xs text-blue-600">
                Esta tela é uma visão geral opcional de todos os documentos
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'documents'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Meus Documentos
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'templates'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Templates
          </button>
        </div>
      </div>

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <div>
          <div className="mb-4 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Total: {totalDocuments} documentos
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Novo Documento
            </button>
          </div>

          {loading && documents.length === 0 ? (
            <div className="text-center py-12">
              <Loader className="w-8 h-8 text-gray-400 mx-auto mb-4 animate-spin" />
              <p className="text-gray-600">Carregando...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">Nenhum documento ainda</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Criar Primeiro Documento
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-gray-900">{doc.document_title}</h3>
                          {getStatusBadge(doc.status, doc.job_progress)}
                        </div>
                        <p className="text-sm text-gray-600">
                          v{doc.version} | {doc.project_name} | {doc.customer_name}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>{new Date(doc.created_at).toLocaleDateString('pt-BR')}</span>
                          {doc.attachments_count > 0 && (
                            <span className="flex items-center gap-1">
                              <Paperclip className="w-3 h-3" />
                              {doc.attachments_count} anexo(s)
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.status === 'rascunho' && !doc.job_status && (
                          <button
                            onClick={() => handleStartGeneration(doc.id)}
                            className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 flex items-center gap-1"
                          >
                            <Sparkles className="w-4 h-4" />
                            Gerar
                          </button>
                        )}
                        {doc.status === 'gerado' && (
                          <button
                            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 flex items-center gap-1"
                          >
                            <Download className="w-4 h-4" />
                            Exportar
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (fileInputRef.current) {
                              fileInputRef.current.dataset.documentId = doc.id;
                              fileInputRef.current.click();
                            }
                          }}
                          className="text-gray-600 hover:text-gray-900 px-3 py-1 text-sm flex items-center gap-1"
                        >
                          <Upload className="w-4 h-4" />
                          Anexar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                    disabled={currentPage === 0}
                    className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Anterior
                  </button>
                  <span className="text-sm text-gray-600">
                    Página {currentPage + 1} de {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                    disabled={currentPage >= totalPages - 1}
                    className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Próxima
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900 flex-1">{template.name}</h3>
                {template.ia_enabled && (
                  <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
                    IA
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-3">{template.description}</p>
              {template.ia_doc_type && (
                <p className="text-xs text-gray-500 mb-2">
                  Tipo: {template.ia_doc_type}
                </p>
              )}
              {template.ia_intake_questions && template.ia_intake_questions.length > 0 && (
                <p className="text-xs text-gray-500 mb-3">
                  {template.ia_intake_questions.length} pergunta(s) de intake
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedTemplate(template.id);
                    setShowCreateModal(true);
                  }}
                  className="flex-1 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 text-sm"
                >
                  Usar Template
                </button>
                <button
                  onClick={() => {
                    setEditingTemplate(template);
                    setShowConfigModal(true);
                  }}
                  className="bg-gray-100 text-gray-700 px-3 py-2 rounded hover:bg-gray-200"
                  title="Configurar IA"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Criar Documento */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Criar Novo Documento</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template
                </label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">Selecione</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Projeto
                </label>

                {/* Campo de busca */}
                <input
                  type="text"
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  placeholder="Buscar por nome do projeto..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-2"
                />

                {/* Lista de projetos */}
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  disabled={projectsLoading}
                >
                  <option value="">
                    {projectsLoading
                      ? 'Carregando...'
                      : projects.length === 0
                        ? 'Nenhum projeto encontrado'
                        : 'Selecione um projeto'}
                  </option>
                  {projects.map((p) => {
                    const customerName = p.customers?.name || 'Sem cliente';
                    const propertyName = p.properties?.name || 'Sem imóvel';
                    const projectName = p.name || 'Sem nome';

                    return (
                      <option key={p.id} value={p.id}>
                        {customerName} - {propertyName} - {projectName}
                      </option>
                    );
                  })}
                </select>

                {/* Status do projeto selecionado */}
                {selectedProject && projects.find(p => p.id === selectedProject) && (
                  <div className="mt-2 text-sm text-gray-600">
                    <span className="font-medium">Status:</span>{' '}
                    {(() => {
                      const project = projects.find(p => p.id === selectedProject);
                      const statusMap: Record<string, string> = {
                        'a_iniciar': 'A Iniciar',
                        'em_desenvolvimento': 'Em Desenvolvimento',
                        'em_correcao': 'Em Correção',
                        'finalizado': 'Finalizado',
                        'entregue': 'Entregue',
                        'em_exigencia': 'Em Exigência',
                        'registrado': 'Registrado'
                      };
                      return statusMap[project?.status || ''] || project?.status || 'Desconhecido';
                    })()}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título (opcional)
                </label>
                <input
                  type="text"
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Deixe vazio para usar o nome do template"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setSelectedTemplate('');
                  setSelectedProject('');
                  setDocumentTitle('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateDocument}
                disabled={!selectedTemplate || !selectedProject || loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Criando...' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Perguntas de Intake */}
      {showIntakeModal && currentTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-2">Informações para Geração</h2>
            <p className="text-sm text-gray-600 mb-4">
              Por favor, responda as perguntas abaixo para que a IA gere o documento com as informações corretas.
            </p>

            <div className="space-y-4">
              {currentTemplate.ia_intake_questions?.map((question) => (
                <div key={question.id}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {question.question}
                    {question.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {renderIntakeQuestion(question)}
                </div>
              ))}
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4">
              <p className="text-sm text-yellow-800">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                Estas informações serão usadas pela IA para gerar o documento. Dados faltantes serão marcados como [A COMPLETAR].
              </p>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowIntakeModal(false);
                  setPendingDocumentId(null);
                  setIntakeAnswers({});
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (pendingDocumentId) {
                    startGenerationJob(pendingDocumentId, intakeAnswers);
                  }
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Gerar Documento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Configuração de IA do Template */}
      {showConfigModal && editingTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Configuração de IA - {editingTemplate.name}</h2>

            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingTemplate.ia_enabled}
                    onChange={(e) => setEditingTemplate({
                      ...editingTemplate,
                      ia_enabled: e.target.checked
                    })}
                    className="w-5 h-5"
                  />
                  <span className="font-medium">IA Habilitada</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Documento
                </label>
                <select
                  value={editingTemplate.ia_doc_type}
                  onChange={(e) => setEditingTemplate({
                    ...editingTemplate,
                    ia_doc_type: e.target.value
                  })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="laudo">Laudo</option>
                  <option value="relatorio">Relatório</option>
                  <option value="estudo">Estudo</option>
                  <option value="diagnostico">Diagnóstico</option>
                  <option value="memorial">Memorial</option>
                  <option value="projeto_textual">Projeto Textual</option>
                  <option value="outro">Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Guia de Estilo
                </label>
                <textarea
                  value={editingTemplate.ia_style_guide}
                  onChange={(e) => setEditingTemplate({
                    ...editingTemplate,
                    ia_style_guide: e.target.value
                  })}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Tom técnico e profissional. Linguagem clara conforme padrões Aliancer..."
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">Regras de Geração</h3>
                <div className="space-y-2 text-sm text-blue-800">
                  <p>✓ Não inventar dados - usar [A COMPLETAR]</p>
                  <p>✓ Gerar lista de pendências ao final</p>
                  <p>✓ Requer revisão técnica</p>
                  <p>✓ Referenciar normas técnicas (ABNT, NBR)</p>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>Seções:</strong> {editingTemplate.ia_sections?.length || 0} configuradas
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Perguntas:</strong> {editingTemplate.ia_intake_questions?.length || 0} configuradas
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowConfigModal(false);
                  setEditingTemplate(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveTemplateConfig}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Salvar Configuração
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input hidden para upload */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const documentId = (e.target as any).dataset.documentId;
          if (file && documentId) {
            handleFileUpload(documentId, file);
          }
          e.target.value = '';
        }}
      />
    </div>
  );
}
