import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Save, AlertCircle, CheckCircle, Loader2, FileText, Mic, Video, Calendar } from 'lucide-react';
import { createMeeting } from '../../services/meetingsService';
import type { CreateMeetingData, MeetingSource } from '../../types/meetings';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';

interface EngineeringProject {
  id: string;
  name: string;
}

interface MeetingNewProps {
  onBack: () => void;
  onCreated: (id: string) => void;
}

function Toast({ message, type, onClose }: { message: string; type: 'error' | 'success'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
      {type === 'error' ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle className="w-4 h-4 flex-shrink-0" />}
      {message}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">✕</button>
    </div>
  );
}

const SOURCE_OPTIONS: { value: MeetingSource; label: string; icon: React.ElementType; description: string }[] = [
  { value: 'manual', label: 'Manual', icon: Mic, description: 'Transcrição digitada ou colada manualmente' },
  { value: 'meet', label: 'Google Meet', icon: Video, description: 'Transcrição exportada do Google Meet' },
  { value: 'zoom', label: 'Zoom', icon: Video, description: 'Transcrição exportada do Zoom' },
];

function localDatetimeDefault() {
  const now = new Date();
  now.setSeconds(0, 0);
  return format(now, "yyyy-MM-dd'T'HH:mm");
}

export default function MeetingNew({ onBack, onCreated }: MeetingNewProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(localDatetimeDefault());
  const [source, setSource] = useState<MeetingSource>('manual');
  const [transcript, setTranscript] = useState('');
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState<EngineeringProject[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('engineering_projects')
        .select('id, name')
        .order('name');
      setProjects(data ?? []);
    } catch {
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setToast({ message: 'O título é obrigatório.', type: 'error' });
      return;
    }
    if (!date) {
      setToast({ message: 'A data/hora é obrigatória.', type: 'error' });
      return;
    }
    if (!transcript.trim()) {
      setToast({ message: 'A transcrição é obrigatória.', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      const payload: CreateMeetingData = {
        title: title.trim(),
        date: new Date(date).toISOString(),
        source,
        transcript: transcript.trim(),
        project_id: projectId || null,
        status: 'imported',
      };
      console.log('Dados enviados:', payload);
      const created = await createMeeting(payload);
      setToast({ message: 'Reunião criada com sucesso!', type: 'success' });
      setTimeout(() => onCreated(created.id), 600);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('Detalhes do erro:', error);
      setToast({ message: `Erro ao salvar: ${message}`, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const transcriptWordCount = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;

  return (
    <div className="space-y-6 max-w-3xl">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 text-gray-600 border border-gray-300 bg-white rounded-lg hover:bg-gray-50 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Nova Reunião</h2>
          <p className="text-sm text-gray-500">Registre a transcrição e dados da reunião</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 text-base border-b border-gray-100 pb-3">
            Dados da Reunião
          </h3>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Título <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Alinhamento técnico - Projeto João Silva"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-shadow"
              disabled={saving}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                <Calendar className="w-3.5 h-3.5 inline mr-1" />
                Data e Hora <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-shadow"
                disabled={saving}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Projeto Vinculado
              </label>
              <select
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-shadow bg-white"
                disabled={saving}
              >
                <option value="">— Nenhum —</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Origem <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {SOURCE_OPTIONS.map(opt => {
                const Icon = opt.icon;
                const selected = source === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSource(opt.value)}
                    disabled={saving}
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                      selected
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${selected ? 'text-green-600' : 'text-gray-400'}`} />
                    <div>
                      <p className={`text-sm font-semibold ${selected ? 'text-green-800' : 'text-gray-700'}`}>
                        {opt.label}
                      </p>
                      <p className={`text-xs mt-0.5 ${selected ? 'text-green-600' : 'text-gray-400'}`}>
                        {opt.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3 shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="font-semibold text-gray-800 text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-green-600" />
              Transcrição <span className="text-red-500">*</span>
            </h3>
            {transcriptWordCount > 0 && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                {transcriptWordCount.toLocaleString('pt-BR')} palavras
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Cole o texto completo da transcrição da reunião. Pode ser o texto gerado automaticamente pelo Google Meet, Zoom ou digitado manualmente.
          </p>
          <textarea
            value={transcript}
            onChange={e => setTranscript(e.target.value)}
            placeholder="Cole aqui a transcrição da reunião...&#10;&#10;Exemplo:&#10;[00:00] João: Bom dia a todos. Vamos começar com a apresentação do projeto...&#10;[00:12] Maria: Perfeito. Conforme discutido anteriormente..."
            rows={16}
            className="w-full px-3 py-3 border border-gray-300 rounded-lg text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-shadow resize-y min-h-[220px]"
            disabled={saving}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            disabled={saving}
            className="px-5 py-2.5 text-gray-700 border border-gray-300 bg-white rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salvar Reunião
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
