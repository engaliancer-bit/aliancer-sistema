import { useState } from 'react';
import { Edit2, Check, X, Calendar, User, Tag, ChevronDown } from 'lucide-react';
import type { MeetingTask, TaskPriority, TaskStatus } from '../../types/meetings';
import { updateMeetingTask } from '../../services/meetingsService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MeetingTaskCardProps {
  task: MeetingTask;
  onUpdated: (updated: MeetingTask) => void;
  onError: (msg: string) => void;
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; dot: string }> = {
  high: { label: 'Alto', color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
  medium: { label: 'Médio', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  low: { label: 'Baixo', color: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' },
};

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'bg-orange-100 text-orange-700' },
  in_progress: { label: 'Em andamento', color: 'bg-blue-100 text-blue-700' },
  done: { label: 'Concluída', color: 'bg-green-100 text-green-700' },
};

export default function MeetingTaskCard({ task, onUpdated, onError }: MeetingTaskCardProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    responsible_name: task.responsible_name,
    due_date: task.due_date ?? '',
    status: task.status,
    priority: task.priority,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateMeetingTask(task.id, {
        responsible_name: form.responsible_name,
        due_date: form.due_date || null,
        status: form.status,
        priority: form.priority,
      });
      onUpdated(updated);
      setEditing(false);
    } catch {
      onError('Erro ao salvar tarefa.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm({
      responsible_name: task.responsible_name,
      due_date: task.due_date ?? '',
      status: task.status,
      priority: task.priority,
    });
    setEditing(false);
  };

  const handleQuickStatusToggle = async () => {
    const next: TaskStatus = task.status === 'pending' ? 'in_progress' : task.status === 'in_progress' ? 'done' : 'pending';
    setSaving(true);
    try {
      const updated = await updateMeetingTask(task.id, { status: next });
      onUpdated(updated);
    } catch {
      onError('Erro ao atualizar status.');
    } finally {
      setSaving(false);
    }
  };

  const priority = PRIORITY_CONFIG[task.priority];
  const statusCfg = STATUS_CONFIG[task.status];

  return (
    <div className={`bg-white border rounded-lg p-4 transition-all ${task.status === 'done' ? 'opacity-60' : ''} ${editing ? 'border-green-400 shadow-md' : 'border-gray-200 hover:border-gray-300'}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={handleQuickStatusToggle}
          disabled={saving}
          title="Alternar status"
          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
            task.status === 'done'
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-300 hover:border-green-400'
          }`}
        >
          {task.status === 'done' && <Check className="w-3 h-3" />}
        </button>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium text-gray-800 leading-snug ${task.status === 'done' ? 'line-through text-gray-400' : ''}`}>
            {task.description}
          </p>

          {!editing && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${priority.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
                {priority.label}
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.color}`}>
                {statusCfg.label}
              </span>
              {task.category && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  <Tag className="w-3 h-3" />
                  {task.category}
                </span>
              )}
              {task.responsible_name && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <User className="w-3 h-3" />
                  {task.responsible_name}
                </span>
              )}
              {task.due_date && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(task.due_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                </span>
              )}
            </div>
          )}

          {editing && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Responsável</label>
                  <input
                    type="text"
                    value={form.responsible_name}
                    onChange={e => setForm(f => ({ ...f, responsible_name: e.target.value }))}
                    placeholder="Nome do responsável"
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Prazo</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <div className="relative">
                    <select
                      value={form.status}
                      onChange={e => setForm(f => ({ ...f, status: e.target.value as TaskStatus }))}
                      className="w-full pl-2 pr-6 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500 bg-white appearance-none"
                    >
                      <option value="pending">Pendente</option>
                      <option value="in_progress">Em andamento</option>
                      <option value="done">Concluída</option>
                    </select>
                    <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Prioridade</label>
                  <div className="relative">
                    <select
                      value={form.priority}
                      onChange={e => setForm(f => ({ ...f, priority: e.target.value as TaskPriority }))}
                      className="w-full pl-2 pr-6 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500 bg-white appearance-none"
                    >
                      <option value="high">Alto</option>
                      <option value="medium">Médio</option>
                      <option value="low">Baixo</option>
                    </select>
                    <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  <Check className="w-3 h-3" />
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 text-gray-600 text-xs border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex-shrink-0 p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
            title="Editar tarefa"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
