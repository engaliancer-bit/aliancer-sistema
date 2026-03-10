import { useState, useEffect, useCallback } from 'react';
import { Plus, Calendar, FileText, Video, Mic, CheckCircle, Clock, AlertCircle, ChevronRight, RefreshCw } from 'lucide-react';
import { getMeetings } from '../../services/meetingsService';
import type { Meeting, MeetingSource, MeetingStatus } from '../../types/meetings';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MeetingsListProps {
  onNewMeeting: () => void;
  onViewMeeting: (id: string) => void;
}

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

const STATUS_CONFIG: Record<MeetingStatus, { label: string; color: string; icon: React.ElementType }> = {
  imported: { label: 'Importado', color: 'bg-gray-100 text-gray-700', icon: FileText },
  processing: { label: 'Processando', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  processed: { label: 'Processado', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  approved: { label: 'Aprovado', color: 'bg-green-100 text-green-700', icon: CheckCircle },
};

function Toast({ message, type, onClose }: { message: string; type: 'error' | 'success'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
      {type === 'error' ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle className="w-4 h-4 flex-shrink-0" />}
      {message}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">✕</button>
    </div>
  );
}

export default function MeetingsList({ onNewMeeting, onViewMeeting }: MeetingsListProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMeetings();
      setMeetings(data);
    } catch {
      setToast({ message: 'Erro ao carregar reuniões.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Reuniões</h2>
          <p className="text-sm text-gray-500 mt-1">Transcrições e registros de reuniões técnicas</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 border border-gray-300 bg-white rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onNewMeeting}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nova Reunião
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-5 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/5" />
                </div>
                <div className="h-6 w-20 bg-gray-100 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : meetings.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-16 text-center">
          <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Nenhuma reunião cadastrada</h3>
          <p className="text-gray-500 text-sm mb-6">Registre a primeira reunião importando uma transcrição</p>
          <button
            onClick={onNewMeeting}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            Nova Reunião
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <div className="col-span-5">Título</div>
            <div className="col-span-2">Data</div>
            <div className="col-span-2">Origem</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-1" />
          </div>

          <ul className="divide-y divide-gray-100">
            {meetings.map(meeting => {
              const statusCfg = STATUS_CONFIG[meeting.status];
              const StatusIcon = statusCfg.icon;
              const SourceIcon = SOURCE_ICONS[meeting.source];

              return (
                <li key={meeting.id}>
                  <button
                    onClick={() => onViewMeeting(meeting.id)}
                    className="w-full text-left grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
                  >
                    <div className="md:col-span-5">
                      <p className="font-semibold text-gray-900 group-hover:text-green-700 transition-colors truncate">
                        {meeting.title}
                      </p>
                      {meeting.transcript && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {meeting.transcript.slice(0, 80)}...
                        </p>
                      )}
                    </div>
                    <div className="md:col-span-2 flex items-center gap-1.5 text-sm text-gray-600">
                      <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      {format(new Date(meeting.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </div>
                    <div className="md:col-span-2 flex items-center gap-1.5 text-sm text-gray-600">
                      <SourceIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      {SOURCE_LABELS[meeting.source]}
                    </div>
                    <div className="md:col-span-2">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusCfg.label}
                      </span>
                    </div>
                    <div className="md:col-span-1 flex items-center justify-end">
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-green-600 transition-colors" />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
