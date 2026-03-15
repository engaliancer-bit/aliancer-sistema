import { useState, useEffect, useCallback } from 'react';
import { Plus, HardHat, Calendar, Clock, AlertCircle, Edit2, Trash2, X, Check, Layers } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { AssemblyProject } from './types';
import AssemblyTemplates from './AssemblyTemplates';
import AssemblyProjectDetail from './AssemblyProjectDetail';

function Toast({ message, type, onClose }: { message: string; type: 'error' | 'success'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
      {type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
      {message}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">✕</button>
    </div>
  );
}

const STATUS_CONFIG: Record<AssemblyProject['status'], { label: string; badge: string; dot: string }> = {
  planning: { label: 'Planejamento', badge: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
  in_progress: { label: 'Em Andamento', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  completed: { label: 'Concluída', badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  cancelled: { label: 'Cancelada', badge: 'bg-red-100 text-red-600', dot: 'bg-red-400' },
};

interface ProjectFormData {
  name: string;
  status: AssemblyProject['status'];
  customer_id: string;
  quote_id: string;
  start_date: string;
  expected_end_date: string;
  notes: string;
}

interface ProjectFormProps {
  initial?: Partial<ProjectFormData>;
  onSave: (data: ProjectFormData) => Promise<void>;
  onCancel: () => void;
  customers: { id: string; name: string }[];
  quotes: { id: string; quote_number: string; total_value: number }[];
}

function ProjectForm({ initial, onSave, onCancel, customers, quotes }: ProjectFormProps) {
  const [form, setForm] = useState<ProjectFormData>({
    name: initial?.name ?? '',
    status: initial?.status ?? 'planning',
    customer_id: initial?.customer_id ?? '',
    quote_id: initial?.quote_id ?? '',
    start_date: initial?.start_date ?? '',
    expected_end_date: initial?.expected_end_date ?? '',
    notes: initial?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        placeholder="Nome da obra / projeto *"
        value={form.name}
        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        required
        autoFocus
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Cliente</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            value={form.customer_id}
            onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}
          >
            <option value="">Selecione um cliente...</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Orçamento vinculado</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            value={form.quote_id}
            onChange={e => setForm(f => ({ ...f, quote_id: e.target.value }))}
          >
            <option value="">Nenhum</option>
            {quotes.map(q => (
              <option key={q.id} value={q.id}>
                #{q.quote_number} — {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(q.total_value ?? 0)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            value={form.status}
            onChange={e => setForm(f => ({ ...f, status: e.target.value as AssemblyProject['status'] }))}
          >
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Data de início</label>
          <input
            type="date"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            value={form.start_date}
            onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Prazo previsto</label>
          <input
            type="date"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            value={form.expected_end_date}
            onChange={e => setForm(f => ({ ...f, expected_end_date: e.target.value }))}
          />
        </div>
      </div>
      <textarea
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
        placeholder="Observações (opcional)"
        rows={2}
        value={form.notes}
        onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
      />
      <div className="flex gap-3 justify-end">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
        <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2">
          <Check className="w-3.5 h-3.5" />{saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}

interface ProjectCardProps {
  project: AssemblyProject;
  onOpen: (project: AssemblyProject) => void;
  onEdit: (project: AssemblyProject) => void;
  onDelete: (id: string) => void;
}

function ProjectCard({ project, onOpen, onEdit, onDelete }: ProjectCardProps) {
  const cfg = STATUS_CONFIG[project.status];
  const stages = project.stages ?? [];
  const total = stages.length;
  const done = stages.filter(s => s.status === 'completed').length;
  const inProg = stages.filter(s => s.status === 'in_progress').length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div
      className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
      onClick={() => onOpen(project)}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-gray-900 text-base group-hover:text-orange-600 transition-colors">{project.name}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${cfg.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
            </div>
            {project.customer && <p className="text-sm text-gray-500 mt-0.5">{project.customer.name}</p>}
            {project.quote && (
              <p className="text-xs text-gray-400 mt-0.5">Orçamento #{project.quote.quote_number}</p>
            )}
          </div>
          <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
            <button onClick={() => onEdit(project)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onDelete(project.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="bg-gray-50 rounded-lg py-2">
            <p className="text-lg font-bold text-gray-700">{total}</p>
            <p className="text-xs text-gray-400">Etapas</p>
          </div>
          <div className="bg-orange-50 rounded-lg py-2">
            <p className="text-lg font-bold text-orange-600">{inProg}</p>
            <p className="text-xs text-orange-400">Andamento</p>
          </div>
          <div className="bg-green-50 rounded-lg py-2">
            <p className="text-lg font-bold text-green-600">{done}</p>
            <p className="text-xs text-green-400">Concluídas</p>
          </div>
        </div>

        {total > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Progresso</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center gap-4 text-xs text-gray-400 flex-wrap">
          {project.start_date && (
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Início: {new Date(project.start_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
          )}
          {project.expected_end_date && (
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Prazo: {new Date(project.expected_end_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
          )}
        </div>
      </div>
    </div>
  );
}

type InnerTab = 'projects' | 'templates';

export default function AssemblyStructure() {
  const [activeTab, setActiveTab] = useState<InnerTab>('projects');
  const [projects, setProjects] = useState<AssemblyProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<AssemblyProject | null>(null);
  const [openProject, setOpenProject] = useState<AssemblyProject | null>(null);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [quotes, setQuotes] = useState<{ id: string; quote_number: string; total_value: number }[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [filterStatus, setFilterStatus] = useState<AssemblyProject['status'] | 'all'>('all');

  const showToast = (message: string, type: 'error' | 'success') => setToast({ message, type });

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const { data: projectsData, error: projErr } = await supabase
        .from('assembly_projects')
        .select('*, customer:customers(name), quote:quotes(quote_number, total_value)')
        .order('created_at', { ascending: false });

      if (projErr) throw projErr;

      const { data: stages, error: stgErr } = await supabase
        .from('assembly_stages')
        .select('id, assembly_project_id, status, stage_order')
        .in('assembly_project_id', (projectsData ?? []).map(p => p.id));

      if (stgErr) throw stgErr;

      const projectsWithStages = (projectsData ?? []).map(p => ({
        ...p,
        stages: (stages ?? []).filter(s => s.assembly_project_id === p.id),
      }));

      setProjects(projectsWithStages);
    } catch {
      showToast('Erro ao carregar projetos.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRelated = useCallback(async () => {
    const [{ data: cust }, { data: qts }] = await Promise.all([
      supabase.from('customers').select('id, name').order('name'),
      supabase.from('quotes').select('id, quote_number, total_value').order('created_at', { ascending: false }),
    ]);
    setCustomers(cust ?? []);
    setQuotes(qts ?? []);
  }, []);

  useEffect(() => {
    loadProjects();
    loadRelated();
  }, [loadProjects, loadRelated]);

  const handleCreate = async (data: ProjectFormData) => {
    try {
      const payload: Record<string, unknown> = {
        name: data.name.trim(),
        status: data.status,
        notes: data.notes,
      };
      if (data.customer_id) payload.customer_id = data.customer_id;
      if (data.quote_id) payload.quote_id = data.quote_id;
      if (data.start_date) payload.start_date = data.start_date;
      if (data.expected_end_date) payload.expected_end_date = data.expected_end_date;

      const { error } = await supabase.from('assembly_projects').insert(payload);
      if (error) throw error;
      setShowForm(false);
      showToast('Projeto criado com sucesso!', 'success');
      await loadProjects();
    } catch {
      showToast('Erro ao criar projeto.', 'error');
    }
  };

  const handleUpdate = async (data: ProjectFormData) => {
    if (!editingProject) return;
    try {
      const payload: Record<string, unknown> = {
        name: data.name.trim(),
        status: data.status,
        notes: data.notes,
        updated_at: new Date().toISOString(),
        customer_id: data.customer_id || null,
        quote_id: data.quote_id || null,
        start_date: data.start_date || null,
        expected_end_date: data.expected_end_date || null,
      };
      const { error } = await supabase.from('assembly_projects').update(payload).eq('id', editingProject.id);
      if (error) throw error;
      setEditingProject(null);
      showToast('Projeto atualizado!', 'success');
      await loadProjects();
    } catch {
      showToast('Erro ao atualizar projeto.', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este projeto? Todas as etapas e itens serão removidos.')) return;
    try {
      const { error } = await supabase.from('assembly_projects').delete().eq('id', id);
      if (error) throw error;
      showToast('Projeto excluído.', 'success');
      await loadProjects();
    } catch {
      showToast('Erro ao excluir projeto.', 'error');
    }
  };

  const filteredProjects = filterStatus === 'all'
    ? projects
    : projects.filter(p => p.status === filterStatus);

  const tabs: { id: InnerTab; label: string; icon: React.ElementType }[] = [
    { id: 'projects', label: 'Obras em Montagem', icon: HardHat },
    { id: 'templates', label: 'Templates de Etapas', icon: Layers },
  ];

  if (openProject) {
    return (
      <AssemblyProjectDetail
        project={openProject}
        onBack={() => setOpenProject(null)}
        onProjectUpdated={loadProjects}
      />
    );
  }

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {(editingProject) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Editar Projeto</h3>
              <button onClick={() => setEditingProject(null)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <ProjectForm
                initial={{
                  name: editingProject.name,
                  status: editingProject.status,
                  customer_id: editingProject.customer_id ?? '',
                  quote_id: editingProject.quote_id ?? '',
                  start_date: editingProject.start_date ?? '',
                  expected_end_date: editingProject.expected_end_date ?? '',
                  notes: editingProject.notes,
                }}
                onSave={handleUpdate}
                onCancel={() => setEditingProject(null)}
                customers={customers}
                quotes={quotes}
              />
            </div>
          </div>
        </div>
      )}

      <div className="border-b border-gray-200">
        <nav className="flex gap-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {activeTab === 'templates' && <AssemblyTemplates />}

      {activeTab === 'projects' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Obras em Montagem</h2>
              <p className="text-sm text-gray-500 mt-0.5">Gerencie projetos de montagem de estrutura com etapas e checklists.</p>
            </div>
            <button
              onClick={() => setShowForm(s => !s)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium text-sm"
            >
              <Plus className="w-4 h-4" /> Nova Obra
            </button>
          </div>

          {showForm && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
              <h3 className="font-semibold text-orange-800 mb-4">Nova Obra de Montagem</h3>
              <ProjectForm
                onSave={handleCreate}
                onCancel={() => setShowForm(false)}
                customers={customers}
                quotes={quotes}
              />
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 text-xs rounded-full font-medium border transition-colors ${filterStatus === 'all' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
            >
              Todos ({projects.length})
            </button>
            {(Object.entries(STATUS_CONFIG) as [AssemblyProject['status'], typeof STATUS_CONFIG[keyof typeof STATUS_CONFIG]][]).map(([k, v]) => {
              const count = projects.filter(p => p.status === k).length;
              return (
                <button
                  key={k}
                  onClick={() => setFilterStatus(k)}
                  className={`px-3 py-1.5 text-xs rounded-full font-medium border transition-colors ${filterStatus === k ? `${v.badge} border-current` : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                >
                  {v.label} ({count})
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
              <HardHat className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">{filterStatus === 'all' ? 'Nenhum projeto criado.' : 'Nenhum projeto com este status.'}</p>
              <p className="text-sm mt-1">Crie uma nova obra para começar a gerenciar as etapas de montagem.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredProjects.map(project => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onOpen={setOpenProject}
                  onEdit={setEditingProject}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
