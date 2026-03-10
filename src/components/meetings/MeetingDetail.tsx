import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, Brain, AlertCircle, CheckCircle, Loader2,
  FileText, ListChecks, BookOpen, ChevronDown, ChevronRight,
  Calendar, Mic, Video, Sparkles, RotateCcw,
} from 'lucide-react';
import { getMeetingById, processMeetingWithAI } from '../../services/meetingsService';
import type { MeetingDetail as MeetingDetailType, MeetingTask, MeetingStatus, MeetingSource } from '../../types/meetings';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import MeetingTaskCard from './MeetingTaskCard';

interface MeetingDetailProps {
  meetingId: string;
  onBack: () => void;
}

type ActiveTab = 'transcript' | 'structured';

function Toast({ message, type, onClose }: { message: string; type: 'error' | 'success' | 'info'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors = {
    error: 'bg-red-600',
    success: 'bg-green-600',
    info: 'bg-blue-600',
  };
  const icons = {
    error: AlertCircle,
    success: CheckCircle,
    info: Brain,
  };
  const Icon = icons[type];

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl text-white text-sm font-medium max-w-sm ${colors[type]}`}>
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="ml-1 opacity-70 hover:opacity-100 flex-shrink-0">✕</button>
    </div>
  );
}

function ConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm mx-4 w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
            <RotateCcw className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Reprocessar transcrição?</h3>
            <p className="text-sm text-gray-500 mt-0.5">Os tópicos e tarefas existentes serão substituídos.</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-medium"
          >
            Reprocessar
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUS_CONFIG: Record<MeetingStatus, { label: string; color: string; icon: React.ElementType }> = {
  imported: { label: 'Importado', color: 'bg-gray-100 text-gray-700', icon: FileText },
  processing: { label: 'Processando...', color: 'bg-yellow-100 text-yellow-700 animate-pulse', icon: Loader2 },
  processed: { label: 'Processado', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  approved: { label: 'Aprovado', color: 'bg-green-100 text-green-700', icon: CheckCircle },
};

const SOURCE_LABELS: Record<MeetingSource, string> = {
  manual: 'Manual',
  meet: 'Google Meet',
  zoom: 'Zoom',
};

const SOURCE_ICONS: Record<MeetingSource, React.ElementType> = {
  manual: Mic,
  meet: Video,
  zoom: Video,
};

function TopicAccordion({ title, summary, index }: { title: string; summary: string; index: number }) {
  const [open, setOpen] = useState(index === 0);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
            {index + 1}
          </span>
          <span className="font-medium text-gray-800 text-sm">{title}</span>
        </div>
        {open
          ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>
      {open && summary && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
          <p className="text-sm text-gray-600 leading-relaxed">{summary}</p>
        </div>
      )}
    </div>
  );
}

export default function MeetingDetail({ meetingId, onBack }: MeetingDetailProps) {
  const [meeting, setMeeting] = useState<MeetingDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('transcript');
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = useCallback((message: string, type: 'error' | 'success' | 'info') => {
    setToast({ message, type });
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getMeetingById(meetingId);
      setMeeting(data);
      if (data.status === 'processed' || data.status === 'approved') {
        setActiveTab('structured');
      }
      return data;
    } catch {
      if (!silent) showToast('Erro ao carregar a reunião.', 'error');
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, [meetingId, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (processing) {
      pollingRef.current = setInterval(async () => {
        const data = await load(true);
        if (data && data.status !== 'processing') {
          setProcessing(false);
          if (pollingRef.current) clearInterval(pollingRef.current);
          if (data.status === 'processed' || data.status === 'approved') {
            showToast('Transcrição processada com sucesso pela IA!', 'success');
            setActiveTab('structured');
          }
        }
      }, 3000);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [processing, load, showToast]);

  const runProcessing = useCallback(async () => {
    if (!meeting) return;
    setProcessing(true);
    setShowConfirm(false);
    showToast('Enviando transcrição para a IA...', 'info');

    const result = await processMeetingWithAI(meetingId);

    if (!result.success) {
      setProcessing(false);
      showToast(result.error ?? 'Falha ao iniciar o processamento.', 'error');
      return;
    }

    setMeeting(m => m ? { ...m, status: 'processing' } : m);
  }, [meeting, meetingId, showToast]);

  const handleProcessClick = () => {
    if (!meeting) return;
    if (meeting.status === 'processed' || meeting.status === 'approved') {
      setShowConfirm(true);
    } else {
      runProcessing();
    }
  };

  const handleTaskUpdated = useCallback((updated: MeetingTask) => {
    setMeeting(m => {
      if (!m) return m;
      return { ...m, tasks: m.tasks.map(t => t.id === updated.id ? updated : t) };
    });
  }, []);

  const handleTaskError = useCallback((msg: string) => showToast(msg, 'error'), [showToast]);

  const isProcessing = processing || meeting?.status === 'processing';
  const hasStructuredData = meeting?.status === 'processed' || meeting?.status === 'approved';

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-4 bg-gray-100 rounded w-1/4" />
        <div className="h-40 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-gray-600">Reunião não encontrada.</p>
        <button onClick={onBack} className="mt-4 text-sm text-green-600 underline">Voltar</button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[meeting.status];
  const StatusIcon = statusCfg.icon;
  const SourceIcon = SOURCE_ICONS[meeting.source];

  const doneTasks = meeting.tasks.filter(t => t.status === 'done').length;
  const totalTasks = meeting.tasks.length;

  return (
    <div className="space-y-5 max-w-5xl">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {showConfirm && <ConfirmModal onConfirm={runProcessing} onCancel={() => setShowConfirm(false)} />}

      <div className="flex items-start gap-4">
        <button
          onClick={onBack}
          className="flex-shrink-0 flex items-center gap-2 px-3 py-2 text-gray-600 border border-gray-300 bg-white rounded-lg hover:bg-gray-50 transition-colors text-sm mt-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold text-gray-900 truncate">{meeting.title}</h2>
          <div className="flex flex-wrap items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1.5 text-sm text-gray-500">
              <Calendar className="w-3.5 h-3.5" />
              {format(new Date(meeting.date), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
            <span className="flex items-center gap-1.5 text-sm text-gray-500">
              <SourceIcon className="w-3.5 h-3.5" />
              {SOURCE_LABELS[meeting.source]}
            </span>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.color}`}>
              <StatusIcon className={`w-3 h-3 ${isProcessing ? 'animate-spin' : ''}`} />
              {statusCfg.label}
            </span>
          </div>
        </div>
        <div className="flex-shrink-0">
          <button
            onClick={handleProcessClick}
            disabled={isProcessing}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all shadow-sm disabled:cursor-not-allowed ${
              isProcessing
                ? 'bg-gray-100 text-gray-400 border border-gray-200'
                : meeting.status === 'processed' || meeting.status === 'approved'
                ? 'bg-yellow-50 text-yellow-700 border border-yellow-300 hover:bg-yellow-100'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processando...
              </>
            ) : meeting.status === 'processed' || meeting.status === 'approved' ? (
              <>
                <RotateCcw className="w-4 h-4" />
                Reprocessar
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Processar com IA
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('transcript')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'transcript'
              ? 'border-green-600 text-green-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          Transcrição Original
        </button>
        <button
          onClick={() => setActiveTab('structured')}
          disabled={!hasStructuredData}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            activeTab === 'structured'
              ? 'border-green-600 text-green-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Brain className="w-4 h-4" />
          Visão Estruturada
          {!hasStructuredData && (
            <span className="ml-1 text-xs text-gray-400">(processe primeiro)</span>
          )}
        </button>
      </div>

      {activeTab === 'transcript' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
            <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" />
              Transcrição bruta
            </span>
            <span className="text-xs text-gray-400">
              {meeting.transcript?.trim()
                ? `${meeting.transcript.trim().split(/\s+/).length.toLocaleString('pt-BR')} palavras`
                : 'Vazia'}
            </span>
          </div>
          <div className="p-5">
            {meeting.transcript?.trim() ? (
              <pre className="text-sm text-gray-700 font-mono whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto">
                {meeting.transcript}
              </pre>
            ) : (
              <p className="text-gray-400 text-sm italic text-center py-8">Nenhuma transcrição disponível.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'structured' && hasStructuredData && (
        <div className="space-y-5">
          {meeting.summary && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-semibold text-green-900">Resumo Executivo</h3>
              </div>
              <p className="text-sm text-green-800 leading-relaxed">{meeting.summary}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-gray-500" />
                <h3 className="font-semibold text-gray-800">
                  Tópicos Discutidos
                  <span className="ml-2 text-xs font-normal text-gray-400">({meeting.topics.length})</span>
                </h3>
              </div>
              {meeting.topics.length === 0 ? (
                <div className="bg-white border border-dashed border-gray-200 rounded-lg p-8 text-center">
                  <p className="text-sm text-gray-400">Nenhum tópico identificado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {meeting.topics.map((topic, i) => (
                    <TopicAccordion
                      key={topic.id}
                      title={topic.title}
                      summary={topic.summary}
                      index={i}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-gray-500" />
                  <h3 className="font-semibold text-gray-800">
                    Action Items
                    <span className="ml-2 text-xs font-normal text-gray-400">({totalTasks})</span>
                  </h3>
                </div>
                {totalTasks > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: totalTasks > 0 ? `${(doneTasks / totalTasks) * 100}%` : '0%' }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{doneTasks}/{totalTasks}</span>
                  </div>
                )}
              </div>

              {totalTasks === 0 ? (
                <div className="bg-white border border-dashed border-gray-200 rounded-lg p-8 text-center">
                  <p className="text-sm text-gray-400">Nenhuma tarefa identificada</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                  {meeting.tasks.map(task => (
                    <MeetingTaskCard
                      key={task.id}
                      task={task}
                      onUpdated={handleTaskUpdated}
                      onError={handleTaskError}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {isProcessing && (
            <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
              <Loader2 className="w-4 h-4 text-yellow-600 animate-spin flex-shrink-0" />
              <p className="text-sm text-yellow-800">
                A IA está reprocessando a transcrição. Esta página atualizará automaticamente ao concluir.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'structured' && !hasStructuredData && (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-16 text-center">
          <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
            <Brain className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-base font-semibold text-gray-700 mb-2">Transcrição ainda não processada</h3>
          <p className="text-sm text-gray-400 mb-5">
            Clique em "Processar com IA" para extrair tópicos, resumo e tarefas automaticamente.
          </p>
          <button
            onClick={handleProcessClick}
            disabled={isProcessing}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            Processar com IA
          </button>
        </div>
      )}

      {isProcessing && activeTab === 'transcript' && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800">IA processando a transcrição...</p>
            <p className="text-xs text-blue-600 mt-0.5">Isso pode levar alguns segundos. A página será atualizada automaticamente.</p>
          </div>
          <button
            onClick={() => setActiveTab('structured')}
            className="ml-auto flex-shrink-0 text-xs text-blue-700 underline"
          >
            Ver resultado
          </button>
        </div>
      )}
    </div>
  );
}
