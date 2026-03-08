import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  Download,
  Eye,
  EyeOff,
  Loader,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface IAJobDetailProps {
  jobId: string;
  onClose?: () => void;
}

interface JobDetail {
  id: string;
  created_at: string;
  updated_at: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  progress_percent: number;
  progress_stage: string;
  current_section: string | null;
  started_at: string | null;
  completed_at: string | null;
  briefing: string;
  intake_answers: any;
  error_message: string | null;
  error_details: any;
  tokens_used: number;
  processing_time_seconds: number | null;
  timeout_at: string | null;
  project_name: string;
  template_name: string;
  template_type: string;
  customer_name: string;
  files_count: number;
  outputs_count: number;
  latest_version: number | null;
}

interface Output {
  id: string;
  version: number;
  created_at: string;
  output_markdown: string;
  executive_summary: string | null;
  pending_items: any[];
  word_count: number | null;
  section_count: number | null;
  placeholders_count: number | null;
}

interface JobFile {
  id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  created_at: string;
  storage_path: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Aguardando Processamento',
  processing: 'Gerando Documento',
  completed: 'Concluido',
  failed: 'Erro',
  cancelled: 'Cancelado'
};

const STAGE_LABELS: Record<string, string> = {
  initializing: 'Inicializando...',
  loading_data: 'Carregando dados do projeto...',
  generating_document: 'Gerando documento...',
  done: 'Concluido',
  error: 'Erro'
};

const INITIAL_POLLING_INTERVAL = 3000;
const MAX_POLLING_INTERVAL = 30000;
const BACKOFF_MULTIPLIER = 1.5;
const MAX_POLLING_ATTEMPTS = 100;

export default function IAJobDetail({ jobId, onClose }: IAJobDetailProps) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [output, setOutput] = useState<Output | null>(null);
  const [files, setFiles] = useState<JobFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMarkdown, setShowMarkdown] = useState(false);
  const [showIntake, setShowIntake] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reprocessing, setReprocessing] = useState(false);

  const isMountedRef = useRef(true);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef(INITIAL_POLLING_INTERVAL);
  const pollingAttemptsRef = useRef(0);
  const lastStatusRef = useRef<string | null>(null);

  const clearPolling = useCallback(() => {
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
  }, []);

  const resetPollingInterval = useCallback(() => {
    pollingIntervalRef.current = INITIAL_POLLING_INTERVAL;
    pollingAttemptsRef.current = 0;
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearPolling();
    };
  }, [clearPolling]);

  const loadJobData = useCallback(async () => {
    if (!isMountedRef.current) return null;

    try {
      const { data: jobData, error: jobError } = await supabase
        .from('project_ia_jobs_detail')
        .select('*')
        .eq('id', jobId)
        .single();

      if (!isMountedRef.current) return null;

      if (jobError) throw jobError;
      setJob(jobData);

      const { data: outputData, error: outputError } = await supabase
        .from('project_ia_outputs')
        .select('*')
        .eq('job_id', jobId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!isMountedRef.current) return null;

      if (outputError) throw outputError;
      setOutput(outputData);

      const { data: filesData, error: filesError } = await supabase
        .from('project_ia_job_files')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });

      if (!isMountedRef.current) return null;

      if (filesError) throw filesError;
      setFiles(filesData || []);

      setError(null);
      return jobData;
    } catch (error: any) {
      if (!isMountedRef.current) return null;
      console.error('Erro ao carregar dados do job:', error);
      setError('Erro ao carregar dados: ' + error.message);
      return null;
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [jobId]);

  const scheduleNextPoll = useCallback((currentStatus: string | null) => {
    if (!isMountedRef.current) return;

    if (currentStatus !== 'pending' && currentStatus !== 'processing') {
      clearPolling();
      return;
    }

    pollingAttemptsRef.current++;

    if (pollingAttemptsRef.current > MAX_POLLING_ATTEMPTS) {
      console.warn('[IAJobDetail] Max polling attempts reached');
      clearPolling();
      return;
    }

    if (lastStatusRef.current === currentStatus) {
      pollingIntervalRef.current = Math.min(
        pollingIntervalRef.current * BACKOFF_MULTIPLIER,
        MAX_POLLING_INTERVAL
      );
    } else {
      resetPollingInterval();
    }

    lastStatusRef.current = currentStatus;

    pollingTimeoutRef.current = setTimeout(async () => {
      if (!isMountedRef.current) return;

      const jobData = await loadJobData();
      if (jobData && isMountedRef.current) {
        scheduleNextPoll(jobData.status);
      }
    }, pollingIntervalRef.current);
  }, [loadJobData, clearPolling, resetPollingInterval]);

  useEffect(() => {
    const initLoad = async () => {
      const jobData = await loadJobData();
      if (jobData && isMountedRef.current) {
        scheduleNextPoll(jobData.status);
      }
    };
    initLoad();
  }, [loadJobData, scheduleNextPoll]);

  useEffect(() => {
    if (!job) return;

    if ((job.status === 'pending' || job.status === 'processing') && job.created_at) {
      const createdTime = new Date(job.created_at).getTime();
      const now = Date.now();
      const secondsSinceCreated = (now - createdTime) / 1000;

      if (secondsSinceCreated > 120 && job.progress_percent === 0) {
        console.warn(`[IAJobDetail] Job ${job.id} possivelmente travado ha ${secondsSinceCreated}s`);
      }
    }
  }, [job]);

  const getStatusIcon = useCallback((status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-6 w-6 text-green-600" />;
      case 'processing':
        return <Clock className="h-6 w-6 text-blue-600 animate-spin" />;
      case 'failed':
        return <XCircle className="h-6 w-6 text-red-600" />;
      case 'pending':
        return <AlertCircle className="h-6 w-6 text-yellow-600" />;
      default:
        return <AlertCircle className="h-6 w-6 text-gray-600" />;
    }
  }, []);

  const formatDate = useCallback((date: string) => {
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  const formatFileSize = useCallback((bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }, []);

  const downloadFile = useCallback(async (file: JobFile) => {
    try {
      const { data, error } = await supabase.storage
        .from('ia-files')
        .download(file.storage_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Erro ao baixar arquivo:', error);
      alert('Erro ao baixar arquivo: ' + error.message);
    }
  }, []);

  const copyMarkdownToClipboard = useCallback(() => {
    if (output?.output_markdown) {
      navigator.clipboard.writeText(output.output_markdown);
      alert('Markdown copiado para a area de transferencia!');
    }
  }, [output?.output_markdown]);

  const handleReprocess = useCallback(async () => {
    if (!confirm('Deseja gerar uma nova versao deste documento? Isso criara uma versao incremental.')) {
      return;
    }

    try {
      setReprocessing(true);
      setError(null);

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-project-document`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ job_id: jobId })
      });

      if (!isMountedRef.current) return;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao invocar Edge Function');
      }

      resetPollingInterval();
      await loadJobData();

      if (isMountedRef.current) {
        alert('Novo documento sendo gerado! A pagina sera atualizada automaticamente.');
        scheduleNextPoll('processing');
      }
    } catch (error: any) {
      if (!isMountedRef.current) return;
      console.error('Erro ao reprocessar job:', error);
      setError('Erro ao reprocessar: ' + error.message);
    } finally {
      if (isMountedRef.current) {
        setReprocessing(false);
      }
    }
  }, [jobId, loadJobData, resetPollingInterval, scheduleNextPoll]);

  const intakeAnswersEntries = useMemo(() => {
    if (!job?.intake_answers) return [];
    return Object.entries(job.intake_answers);
  }, [job?.intake_answers]);

  const statusBadgeClass = useMemo(() => {
    if (!job) return '';
    switch (job.status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'processing': return 'bg-blue-100 text-blue-700';
      case 'failed': return 'bg-red-100 text-red-700';
      default: return 'bg-yellow-100 text-yellow-700';
    }
  }, [job?.status]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700">{error || 'Job nao encontrado'}</p>
        {onClose && (
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Fechar
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {getStatusIcon(job.status)}
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{job.template_name}</h2>
              <p className="text-sm text-gray-600">{job.template_type}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {(job.status === 'completed' || job.status === 'failed') && (
              <button
                onClick={handleReprocess}
                disabled={reprocessing}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                title="Gerar nova versao"
              >
                {reprocessing ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    Nova Versao
                  </>
                )}
              </button>
            )}
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusBadgeClass}`}>
              {STATUS_LABELS[job.status] || job.status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Projeto</p>
            <p className="font-medium text-gray-900">{job.project_name}</p>
          </div>
          <div>
            <p className="text-gray-600">Cliente</p>
            <p className="font-medium text-gray-900">{job.customer_name}</p>
          </div>
          <div>
            <p className="text-gray-600">Criado em</p>
            <p className="font-medium text-gray-900">{formatDate(job.created_at)}</p>
          </div>
          <div>
            <p className="text-gray-600">Versoes</p>
            <p className="font-medium text-gray-900">
              {job.outputs_count} {job.latest_version && `(v${job.latest_version})`}
            </p>
          </div>
        </div>

        {(job.status === 'pending' || job.status === 'processing') && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                {job.current_section || STAGE_LABELS[job.progress_stage] || job.progress_stage}
              </span>
              <span className="font-medium text-gray-900">{job.progress_percent || 0}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${job.progress_percent || 0}%` }}
              />
            </div>
            {job.timeout_at && (
              <p className="text-xs text-gray-500">
                Timeout em: {formatDate(job.timeout_at)}
              </p>
            )}
          </div>
        )}

        {job.error_message && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">
              <strong>Erro:</strong> {job.error_message}
            </p>
            {job.error_details && (
              <details className="mt-2">
                <summary className="text-xs text-red-600 cursor-pointer hover:underline">
                  Detalhes tecnicos
                </summary>
                <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-x-auto">
                  {JSON.stringify(job.error_details, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">Briefing</h3>
        <p className="text-gray-700 whitespace-pre-wrap">{job.briefing}</p>
      </div>

      {intakeAnswersEntries.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <button
            onClick={() => setShowIntake(!showIntake)}
            className="flex items-center justify-between w-full text-left"
          >
            <h3 className="text-lg font-medium text-gray-900">Respostas do Intake</h3>
            {showIntake ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </button>

          {showIntake && (
            <div className="mt-4 space-y-2">
              {intakeAnswersEntries.map(([key, value]) => (
                <div key={key} className="flex items-start gap-2 text-sm">
                  <span className="text-gray-600 min-w-24">{key}:</span>
                  <span className="text-gray-900 font-medium">
                    {typeof value === 'boolean' ? (value ? 'Sim' : 'Nao') : String(value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {files.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">
            Arquivos Anexados ({files.length})
          </h3>
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700 truncate">{file.file_name}</span>
                  <span className="text-xs text-gray-500 flex-shrink-0">
                    ({formatFileSize(file.file_size)})
                  </span>
                </div>
                <button
                  onClick={() => downloadFile(file)}
                  className="ml-2 p-1 text-blue-600 hover:text-blue-800"
                  title="Baixar"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {output?.executive_summary && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Resumo Executivo</h3>
          <p className="text-gray-700 italic">{output.executive_summary}</p>
        </div>
      )}

      {output && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Estatisticas</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {output.word_count && (
              <div>
                <p className="text-gray-600">Palavras</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {output.word_count.toLocaleString()}
                </p>
              </div>
            )}
            {output.section_count && (
              <div>
                <p className="text-gray-600">Secoes</p>
                <p className="text-2xl font-semibold text-gray-900">{output.section_count}</p>
              </div>
            )}
            {output.placeholders_count !== null && (
              <div>
                <p className="text-gray-600">Pendencias</p>
                <p className={`text-2xl font-semibold ${
                  output.placeholders_count === 0 ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {output.placeholders_count}
                </p>
              </div>
            )}
            <div>
              <p className="text-gray-600">Versao</p>
              <p className="text-2xl font-semibold text-gray-900">v{output.version}</p>
            </div>
          </div>
        </div>
      )}

      {output?.pending_items && output.pending_items.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-yellow-900 mb-3">
            Itens Pendentes ({output.pending_items.length})
          </h3>
          <ul className="space-y-2">
            {output.pending_items.map((item: any, idx: number) => (
              <li key={idx} className="flex items-start gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-900">{item.section}</p>
                  <p className="text-yellow-700">{item.item}</p>
                  {item.description && (
                    <p className="text-yellow-600 text-xs mt-1">{item.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {output?.output_markdown && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Documento Gerado</h3>
            <div className="flex gap-2">
              <button
                onClick={copyMarkdownToClipboard}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Copiar Markdown
              </button>
              <button
                onClick={() => setShowMarkdown(!showMarkdown)}
                className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                {showMarkdown ? (
                  <>
                    <EyeOff className="h-4 w-4" />
                    Ocultar
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    Visualizar
                  </>
                )}
              </button>
            </div>
          </div>

          {showMarkdown && (
            <div className="mt-4 p-4 bg-gray-50 rounded border border-gray-200 max-h-96 overflow-y-auto">
              <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                {output.output_markdown}
              </pre>
            </div>
          )}
        </div>
      )}

      {onClose && (
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Fechar
          </button>
        </div>
      )}
    </div>
  );
}
