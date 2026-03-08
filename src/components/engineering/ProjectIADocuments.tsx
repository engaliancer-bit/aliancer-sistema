import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  FileText,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Download,
  RefreshCw,
  ListTodo,
  MapPin,
  Image,
  Paperclip,
  TrendingUp,
  AlertTriangle,
  Info,
  ChevronRight,
  Zap
} from 'lucide-react';
import GenerateIADocumentModal from './GenerateIADocumentModal';
import IAJobDetail from './IAJobDetail';

interface ProjectIADocumentsProps {
  projectId: string;
}

interface LatestOutput {
  output_id: string;
  job_id: string;
  version: number;
  created_at: string;
  executive_summary: string | null;
  compliance_risk_level: 'low' | 'medium' | 'high';
  compliance_risk_reasons: string[];
  inputs_quality: {
    polygon_status?: string;
    source_type?: string;
    source_year?: number;
    attachments_count?: number;
    geographic_quality?: string;
    car_number?: string;
  };
  pending_items: Array<{
    section: string;
    item: string;
    severity: 'CRÍTICA' | 'IMPORTANTE' | 'INFO';
  }>;
  word_count: number | null;
  section_count: number | null;
  job_status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  job_progress: number;
  template_name: string;
  attachments_count: number;
  critical_pending_count: number;
  important_pending_count: number;
  total_pending_count: number;
  total_jobs: number;
  total_outputs: number;
}

interface IAJob {
  id: string;
  created_at: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  template_name: string;
  template_type: string;
  progress: number;
  outputs_count: number;
  latest_version: number | null;
  error_message: string | null;
}

export default function ProjectIADocuments({ projectId }: ProjectIADocumentsProps) {
  const [latestOutput, setLatestOutput] = useState<LatestOutput | null>(null);
  const [jobs, setJobs] = useState<IAJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showJobDetail, setShowJobDetail] = useState(false);
  const [detailJobId, setDetailJobId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const loadLatestOutput = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('project_latest_ia_output')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();

      if (error) throw error;
      setLatestOutput(data);
    } catch (error) {
      console.error('Erro ao carregar último output:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadJobs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('project_ia_jobs_detail')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Erro ao carregar jobs:', error);
    }
  }, [projectId]);

  useEffect(() => {
    loadLatestOutput();
    loadJobs();
  }, [loadLatestOutput, loadJobs]);

  // ⚠️ POLLING REMOVIDO: Para evitar memory leaks, use o botão refresh manual
  // O polling detalhado acontece apenas em IAJobDetail quando o job está aberto

  const handleRefresh = useCallback(() => {
    loadLatestOutput();
    loadJobs();
  }, [loadLatestOutput, loadJobs]);

  const getRiskBadge = (level: string) => {
    const badges = {
      low: {
        bg: 'bg-green-100',
        text: 'text-green-800',
        icon: <CheckCircle className="h-4 w-4" />,
        label: 'Baixo Risco'
      },
      medium: {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        icon: <AlertTriangle className="h-4 w-4" />,
        label: 'Risco Médio'
      },
      high: {
        bg: 'bg-red-100',
        text: 'text-red-800',
        icon: <XCircle className="h-4 w-4" />,
        label: 'Risco Alto'
      }
    };
    return badges[level as keyof typeof badges] || badges.low;
  };

  const getPolygonStatusBadge = (status?: string) => {
    if (!status) return { label: 'Ausente', color: 'text-red-600', bg: 'bg-red-50' };

    const statuses: Record<string, { label: string; color: string; bg: string }> = {
      ok: { label: 'OK', color: 'text-green-700', bg: 'bg-green-50' },
      ausente: { label: 'Ausente', color: 'text-red-700', bg: 'bg-red-50' },
      absent: { label: 'Ausente', color: 'text-red-700', bg: 'bg-red-50' },
      invalido: { label: 'Inválido', color: 'text-red-700', bg: 'bg-red-50' },
      invalid: { label: 'Inválido', color: 'text-red-700', bg: 'bg-red-50' },
      baixa_qualidade: { label: 'Baixa Qual.', color: 'text-yellow-700', bg: 'bg-yellow-50' },
      low_quality: { label: 'Baixa Qual.', color: 'text-yellow-700', bg: 'bg-yellow-50' }
    };
    return statuses[status] || { label: status, color: 'text-gray-700', bg: 'bg-gray-50' };
  };

  const getSourceTypeLabel = (type?: string, year?: number) => {
    if (!type) return 'Não especificado';

    const types: Record<string, string> = {
      mapbiomas: `MapBiomas ${year || ''}`,
      imagem_georref: 'Imagem Georreferenciada',
      imagem_qualitativa: 'Imagem Qualitativa'
    };
    return types[type] || type;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'processing':
        return <Clock className="h-5 w-5 text-blue-600 animate-spin" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'pending':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-600" />;
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Documentos com IA</h3>
          <p className="text-sm text-gray-500 mt-1">
            Geração inteligente de documentos técnicos rurais
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            title="Atualizar status dos documentos"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-5 w-5" />
            Novo Documento IA
          </button>
        </div>
      </div>

      {/* Card Gerencial */}
      {latestOutput ? (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          {/* Linha de Gestão - Risco/Compliance */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Badge de Risco */}
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${getRiskBadge(latestOutput.compliance_risk_level).bg}`}>
                  <span className={getRiskBadge(latestOutput.compliance_risk_level).text}>
                    {getRiskBadge(latestOutput.compliance_risk_level).icon}
                  </span>
                  <span className={`font-medium text-sm ${getRiskBadge(latestOutput.compliance_risk_level).text}`}>
                    {getRiskBadge(latestOutput.compliance_risk_level).label}
                  </span>
                </div>

                {/* Motivo Principal */}
                {latestOutput.compliance_risk_reasons && latestOutput.compliance_risk_reasons.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Info className="h-4 w-4 text-gray-500" />
                    <span className="max-w-md truncate">{latestOutput.compliance_risk_reasons[0]}</span>
                    {latestOutput.compliance_risk_reasons.length > 1 && (
                      <span className="text-gray-500">+{latestOutput.compliance_risk_reasons.length - 1}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Checklist */}
              <div className="flex items-center gap-2 text-sm">
                <ListTodo className="h-4 w-4 text-gray-500" />
                <span className="text-gray-700">
                  Checklist: {latestOutput.total_outputs}/{latestOutput.total_jobs}
                </span>
              </div>
            </div>

            {/* Ações Rápidas */}
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => {
                  setDetailJobId(latestOutput.job_id);
                  setShowJobDetail(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <Eye className="h-3.5 w-3.5" />
                Abrir Último
              </button>

              <button
                onClick={() => setShowGenerateModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {latestOutput.total_outputs === 0 ? 'Gerar v1' : 'Nova Versão'}
              </button>

              {latestOutput.total_pending_count > 0 && (
                <button
                  onClick={() => {
                    setDetailJobId(latestOutput.job_id);
                    setShowJobDetail(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                >
                  <ListTodo className="h-3.5 w-3.5" />
                  Ver Pendências ({latestOutput.total_pending_count})
                </button>
              )}

              <button
                disabled
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-400 border border-gray-200 rounded cursor-not-allowed"
                title="Em desenvolvimento"
              >
                <Zap className="h-3.5 w-3.5" />
                Transformar em Tarefas
              </button>
            </div>
          </div>

          {/* Bloco Destaque - Último Documento */}
          <div className="px-6 py-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                {getStatusIcon(latestOutput.job_status)}
                <div>
                  <h4 className="font-medium text-gray-900">{latestOutput.template_name}</h4>
                  <p className="text-sm text-gray-500">
                    Versão {latestOutput.version} • {formatDate(latestOutput.created_at)}
                  </p>
                </div>
              </div>
            </div>

            {/* Progresso (se processando) */}
            {latestOutput.job_status === 'processing' && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-gray-600">Processando...</span>
                  <span className="text-sm font-medium text-blue-600">{latestOutput.job_progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${latestOutput.job_progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Preview do Executive Summary */}
            {latestOutput.executive_summary && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-gray-700 italic line-clamp-3">
                  {latestOutput.executive_summary}
                </p>
              </div>
            )}

            {/* Qualidade dos Insumos */}
            <div className="mb-4">
              <h5 className="text-sm font-medium text-gray-700 mb-2">Qualidade dos Insumos</h5>
              <div className="grid grid-cols-3 gap-3">
                {/* Polígono */}
                <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                  <MapPin className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-600 mb-1">Polígono</p>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded ${
                        getPolygonStatusBadge(latestOutput.inputs_quality?.polygon_status).bg
                      } ${getPolygonStatusBadge(latestOutput.inputs_quality?.polygon_status).color}`}
                    >
                      {getPolygonStatusBadge(latestOutput.inputs_quality?.polygon_status).label}
                    </span>
                  </div>
                </div>

                {/* Base de Dados */}
                <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                  <Image className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-600 mb-1">Base</p>
                    <p className="text-xs font-medium text-gray-900 truncate">
                      {getSourceTypeLabel(
                        latestOutput.inputs_quality?.source_type,
                        latestOutput.inputs_quality?.source_year
                      )}
                    </p>
                  </div>
                </div>

                {/* Anexos */}
                <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                  <Paperclip className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-600 mb-1">Anexos</p>
                    <p className="text-xs font-medium text-gray-900">
                      {latestOutput.attachments_count || 0} arquivo(s)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pendências Críticas */}
            {latestOutput.pending_items && latestOutput.pending_items.length > 0 && (
              <div className="mb-4">
                <h5 className="text-sm font-medium text-gray-700 mb-2">
                  Pendências Críticas ({latestOutput.critical_pending_count + latestOutput.important_pending_count})
                </h5>
                <div className="space-y-2">
                  {latestOutput.pending_items
                    .filter(p => p.severity === 'CRÍTICA' || p.severity === 'IMPORTANTE')
                    .slice(0, 5)
                    .map((pending, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                            pending.severity === 'CRÍTICA'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {pending.severity}
                        </span>
                        <div className="min-w-0">
                          <p className="text-gray-600">
                            <span className="font-medium text-gray-900">{pending.section}:</span> {pending.item}
                          </p>
                        </div>
                      </div>
                    ))}
                  {latestOutput.total_pending_count > 5 && (
                    <button
                      onClick={() => {
                        setDetailJobId(latestOutput.job_id);
                        setShowJobDetail(true);
                      }}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Ver todas as {latestOutput.total_pending_count} pendências →
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Ações do Documento */}
            <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
              <button
                onClick={() => {
                  setDetailJobId(latestOutput.job_id);
                  setShowJobDetail(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                <Eye className="h-4 w-4" />
                Abrir Documento
              </button>

              <button
                onClick={() => setShowGenerateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
              >
                <RefreshCw className="h-4 w-4" />
                Gerar Revisão
              </button>

              <button
                disabled
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-400 border border-gray-200 rounded-lg cursor-not-allowed text-sm font-medium"
                title="Em desenvolvimento"
              >
                <Download className="h-4 w-4" />
                Baixar DOCX
              </button>
            </div>
          </div>

          {/* Rodapé */}
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <ChevronRight className={`h-4 w-4 transition-transform ${showHistory ? 'rotate-90' : ''}`} />
              Ver histórico de versões ({latestOutput.total_outputs})
            </button>

            <button
              onClick={() => {
                setDetailJobId(latestOutput.job_id);
                setShowJobDetail(true);
              }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Abrir Central de Documentos →
            </button>
          </div>

          {/* Histórico (expansível) */}
          {showHistory && (
            <div className="px-6 py-4 border-t border-gray-200 space-y-3">
              <h5 className="text-sm font-medium text-gray-700 mb-3">Histórico de Jobs</h5>
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(job.status)}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{job.template_name}</p>
                      <p className="text-xs text-gray-500">
                        {formatDate(job.created_at)} • {job.outputs_count} versão(ões)
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setDetailJobId(job.id);
                      setShowJobDetail(true);
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Ver detalhes
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">Nenhum documento gerado ainda</p>
          <p className="text-sm text-gray-500 mb-4">
            Clique no botão acima para gerar seu primeiro documento com IA
          </p>
        </div>
      )}

      {/* Modal de Geração */}
      {showGenerateModal && (
        <GenerateIADocumentModal
          projectId={projectId}
          onClose={() => setShowGenerateModal(false)}
          onSuccess={(jobId) => {
            setShowGenerateModal(false);
            setDetailJobId(jobId);
            setShowJobDetail(true);
            loadLatestOutput();
            loadJobs();
          }}
        />
      )}

      {/* Modal de Detalhe do Job */}
      {showJobDetail && detailJobId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <IAJobDetail
                jobId={detailJobId}
                onClose={() => {
                  setShowJobDetail(false);
                  setDetailJobId(null);
                  loadLatestOutput();
                  loadJobs();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
