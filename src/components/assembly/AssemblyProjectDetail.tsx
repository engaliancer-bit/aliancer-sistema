import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Check, Clock, CheckCircle2, AlertCircle, Edit2, Trash2, ChevronDown, ChevronRight, Package, Wrench, HardHat, X, Calendar, User, Layers, BoxSelect } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { AssemblyProject, AssemblyStage, AssemblyStageItem, AssemblyTemplate } from './types';

const ITEM_TYPE_CONFIG = {
  material: { label: 'Insumo', icon: Package, color: 'bg-blue-100 text-blue-700 border-blue-200', section: 'materials' },
  product: { label: 'Produto', icon: BoxSelect, color: 'bg-orange-100 text-orange-700 border-orange-200', section: 'materials' },
  composition: { label: 'Composicao', icon: Layers, color: 'bg-amber-100 text-amber-700 border-amber-200', section: 'materials' },
  equipment: { label: 'Equipamento', icon: Wrench, color: 'bg-green-100 text-green-700 border-green-200', section: 'checklist' },
} as const;

const ITEM_STATUS_CONFIG = {
  pending: { label: 'Pendente', color: 'bg-gray-100 text-gray-600' },
  available: { label: 'Disponível', color: 'bg-blue-100 text-blue-700' },
  sent: { label: 'Enviado', color: 'bg-green-100 text-green-700' },
  used: { label: 'Utilizado', color: 'bg-gray-200 text-gray-500 line-through' },
};

const STAGE_STATUS = {
  pending: { label: 'Pendente', color: 'border-gray-200 bg-gray-50', badge: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
  in_progress: { label: 'Em Andamento', color: 'border-orange-200 bg-orange-50', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  completed: { label: 'Concluída', color: 'border-green-200 bg-green-50', badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
};

interface StageItemRowProps {
  item: AssemblyStageItem;
  onUpdateStatus: (id: string, status: AssemblyStageItem['status']) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function StageItemRow({ item, onUpdateStatus, onDelete }: StageItemRowProps) {
  const typeConfig = ITEM_TYPE_CONFIG[item.item_type] ?? ITEM_TYPE_CONFIG.material;
  const TypeIcon = typeConfig.icon;
  const statusConfig = ITEM_STATUS_CONFIG[item.status];
  const nextStatus: Record<AssemblyStageItem['status'], AssemblyStageItem['status']> = {
    pending: 'available', available: 'sent', sent: 'used', used: 'pending'
  };

  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg border bg-white text-sm transition-opacity ${item.status === 'used' ? 'opacity-60' : ''}`}>
      <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border flex-shrink-0 ${typeConfig.color}`}>
        <TypeIcon className="w-3 h-3" />
        <span className="hidden sm:block">{typeConfig.label}</span>
      </span>
      <span className={`flex-1 font-medium text-gray-700 ${item.status === 'used' ? 'line-through text-gray-400' : ''}`}>{item.item_name}</span>
      <span className="text-gray-500 text-xs flex-shrink-0">{item.quantity} {item.unit}</span>
      <button
        onClick={() => onUpdateStatus(item.id, nextStatus[item.status])}
        className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 hover:opacity-80 transition-opacity ${statusConfig.color}`}
        title="Clique para avançar o status"
      >
        {statusConfig.label}
      </button>
      {item.notes && <span className="text-gray-400 text-xs hidden lg:block">{item.notes}</span>}
      <button onClick={() => onDelete(item.id)} className="p-0.5 text-gray-300 hover:text-red-500 flex-shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

interface AddItemFormProps {
  onSave: (data: Omit<AssemblyStageItem, 'id' | 'assembly_stage_id' | 'created_at' | 'updated_at' | 'sent_at'>) => Promise<void>;
  onCancel: () => void;
}

function AddItemForm({ onSave, onCancel }: AddItemFormProps) {
  const [form, setForm] = useState({
    item_type: 'material' as AssemblyStageItem['item_type'],
    item_name: '',
    quantity: 1,
    unit: 'un',
    notes: '',
    status: 'pending' as AssemblyStageItem['status'],
    product_id: null as string | null,
    material_id: null as string | null,
    composition_id: null as string | null,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.item_name.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-3 space-y-2 mt-2">
      <div className="flex gap-1">
        {(Object.keys(ITEM_TYPE_CONFIG) as Array<keyof typeof ITEM_TYPE_CONFIG>).map(type => {
          const cfg = ITEM_TYPE_CONFIG[type];
          const Icon = cfg.icon;
          return (
            <button key={type} type="button"
              onClick={() => setForm(f => ({ ...f, item_type: type }))}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs border font-medium transition-colors ${form.item_type === type ? cfg.color : 'bg-white text-gray-500 border-gray-200'}`}
            >
              <Icon className="w-3 h-3" />{cfg.label}
            </button>
          );
        })}
      </div>
      <input className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400" placeholder="Nome do item *" value={form.item_name} onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))} required autoFocus />
      <div className="grid grid-cols-2 gap-2">
        <input type="number" min="0.01" step="0.01" className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400" placeholder="Qtd" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: parseFloat(e.target.value) || 1 }))} />
        <input className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400" placeholder="Unidade" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">Cancelar</button>
        <button type="submit" disabled={saving} className="px-2 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 flex items-center gap-1">
          <Check className="w-3 h-3" />{saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}

interface StageCardProps {
  stage: AssemblyStage;
  onUpdateStatus: (id: string, status: AssemblyStage['status'], completedDate?: string) => Promise<void>;
  onUpdate: (id: string, data: Partial<AssemblyStage>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddItem: (stageId: string, data: Omit<AssemblyStageItem, 'id' | 'assembly_stage_id' | 'created_at' | 'updated_at' | 'sent_at'>) => Promise<void>;
  onUpdateItemStatus: (id: string, status: AssemblyStageItem['status']) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
}

function StageCard({ stage, onUpdateStatus, onUpdate, onDelete, onAddItem, onUpdateItemStatus, onDeleteItem }: StageCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [editForm, setEditForm] = useState({ name: stage.name, description: stage.description, responsible: stage.responsible, planned_date: stage.planned_date ?? '', notes: stage.notes });

  const cfg = STAGE_STATUS[stage.status];
  const itemCount = stage.items?.length ?? 0;
  const doneCount = stage.items?.filter(i => i.status === 'used' || i.status === 'sent').length ?? 0;
  const progress = itemCount > 0 ? Math.round((doneCount / itemCount) * 100) : 0;

  const handleSaveEdit = async () => {
    await onUpdate(stage.id, { ...editForm, planned_date: editForm.planned_date || null });
    setEditing(false);
  };

  const cycleStatus = async () => {
    const next: Record<AssemblyStage['status'], AssemblyStage['status']> = { pending: 'in_progress', in_progress: 'completed', completed: 'pending' };
    const nextStatus = next[stage.status];
    await onUpdateStatus(stage.id, nextStatus, nextStatus === 'completed' ? new Date().toISOString().split('T')[0] : undefined);
  };

  return (
    <div className={`rounded-xl border-2 ${cfg.color} overflow-hidden transition-all`}>
      <div className="p-3 sm:p-4">
        <div className="flex items-start gap-3">
          <button onClick={cycleStatus} className="mt-0.5 flex-shrink-0" title="Clique para avançar o status">
            {stage.status === 'completed' ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : stage.status === 'in_progress' ? (
              <Clock className="w-5 h-5 text-orange-500" />
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="space-y-2">
                <input className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-orange-400" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome da etapa" />
                <textarea className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400 resize-none" rows={2} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} placeholder="Instruções" />
                <div className="grid grid-cols-2 gap-2">
                  <input className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400" type="date" value={editForm.planned_date} onChange={e => setEditForm(f => ({ ...f, planned_date: e.target.value }))} />
                  <input className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400" value={editForm.responsible} onChange={e => setEditForm(f => ({ ...f, responsible: e.target.value }))} placeholder="Responsável" />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSaveEdit} className="px-2 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 flex items-center gap-1"><Check className="w-3 h-3" />Salvar</button>
                  <button onClick={() => setEditing(false)} className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">Cancelar</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-800 text-sm">{stage.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>{cfg.label}</span>
                </div>
                {stage.description && <p className="text-xs text-gray-500 mt-0.5">{stage.description}</p>}
                <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 flex-wrap">
                  {stage.responsible && <span className="flex items-center gap-1"><User className="w-3 h-3" />{stage.responsible}</span>}
                  {stage.planned_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(stage.planned_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}
                  {stage.completed_date && <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="w-3 h-3" />Concluída em {new Date(stage.completed_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}
                </div>
              </>
            )}
          </div>

          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1 text-gray-400 hover:text-gray-700 rounded transition-colors"
              title="Ver itens"
            >
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            <button onClick={() => setEditing(true)} className="p-1 text-gray-400 hover:text-gray-700 rounded transition-colors">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onDelete(stage.id)} className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {itemCount > 0 && !editing && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-white rounded-full overflow-hidden border border-gray-200">
              <div className="h-full bg-orange-400 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs text-gray-400 flex-shrink-0">{doneCount}/{itemCount}</span>
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t border-current border-opacity-10 px-4 pb-4 bg-white bg-opacity-50">
          {(() => {
            const materialItems = stage.items?.filter(i => ITEM_TYPE_CONFIG[i.item_type]?.section === 'materials') ?? [];
            const checklistItems = stage.items?.filter(i => ITEM_TYPE_CONFIG[i.item_type]?.section === 'checklist') ?? [];
            const hasAny = materialItems.length > 0 || checklistItems.length > 0;
            return (
              <>
                {hasAny ? (
                  <div className="pt-3 space-y-4">
                    {materialItems.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                          <Package className="w-3 h-3" /> Materiais e Insumos
                        </p>
                        <div className="space-y-1.5">
                          {materialItems.map(item => (
                            <StageItemRow key={item.id} item={item} onUpdateStatus={onUpdateItemStatus} onDelete={onDeleteItem} />
                          ))}
                        </div>
                      </div>
                    )}
                    {checklistItems.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                          <Wrench className="w-3 h-3" /> Equipamentos e Ferramentas
                        </p>
                        <div className="space-y-1.5">
                          {checklistItems.map(item => (
                            <StageItemRow key={item.id} item={item} onUpdateStatus={onUpdateItemStatus} onDelete={onDeleteItem} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic pt-3">Nenhum item nesta etapa.</p>
                )}
              </>
            );
          })()}

          <div className="pt-2">
            {addingItem ? (
              <AddItemForm
                onSave={(data) => onAddItem(stage.id, data)}
                onCancel={() => setAddingItem(false)}
              />
            ) : (
              <button
                onClick={() => setAddingItem(true)}
                className="flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-700 font-medium py-1"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar item
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface ApplyTemplateModalProps {
  projectId: string;
  existingCount: number;
  onClose: () => void;
  onApplied: () => void;
}

function ApplyTemplateModal({ projectId, existingCount, onClose, onApplied }: ApplyTemplateModalProps) {
  const [templates, setTemplates] = useState<AssemblyTemplate[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('assembly_templates')
      .select('*, stages:assembly_template_stages(*, items:assembly_template_stage_items(*))')
      .order('name')
      .then(({ data }) => {
        setTemplates(data ?? []);
        setLoading(false);
      });
  }, []);

  const handleApply = async () => {
    if (!selected) return;
    const template = templates.find(t => t.id === selected);
    if (!template || !template.stages) return;
    setApplying(true);
    try {
      for (const [idx, tStage] of template.stages.entries()) {
        const { data: newStage, error: stgErr } = await supabase
          .from('assembly_stages')
          .insert({
            assembly_project_id: projectId,
            template_stage_id: tStage.id,
            name: tStage.name,
            description: tStage.description,
            stage_order: existingCount + idx,
          })
          .select()
          .single();
        if (stgErr) throw stgErr;

        if (tStage.items && tStage.items.length > 0) {
          const items = tStage.items.map(({ id: _id, template_stage_id: _sid, created_at: _cat, ...rest }: Record<string, unknown>) => ({
            ...rest,
            assembly_stage_id: newStage.id,
            status: 'pending',
          }));
          const { error: itmErr } = await supabase.from('assembly_stage_items').insert(items);
          if (itmErr) throw itmErr;
        }
      }
      onApplied();
      onClose();
    } catch {
      alert('Erro ao aplicar template.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Aplicar Template de Etapas</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Nenhum template disponível. Crie templates na aba "Templates".</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {templates.map(t => (
                <label key={t.id} className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${selected === t.id ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="template" value={t.id} checked={selected === t.id} onChange={() => setSelected(t.id)} className="mt-0.5" />
                  <div>
                    <p className="font-medium text-sm text-gray-800">{t.name}</p>
                    {t.description && <p className="text-xs text-gray-500">{t.description}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{(t.stages as unknown[])?.length ?? 0} etapas</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-3 p-5 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button
            onClick={handleApply}
            disabled={!selected || applying}
            className="flex-1 px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
          >
            {applying ? 'Aplicando...' : 'Aplicar Template'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface Props {
  project: AssemblyProject;
  onBack: () => void;
  onProjectUpdated: () => void;
}

export default function AssemblyProjectDetail({ project, onBack, onProjectUpdated }: Props) {
  const [stages, setStages] = useState<AssemblyStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingStage, setAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const showToast = (message: string, type: 'error' | 'success') => setToast({ message, type });

  const loadStages = useCallback(async () => {
    setLoading(true);
    try {
      const { data: stagesData, error: stgErr } = await supabase
        .from('assembly_stages')
        .select('*')
        .eq('assembly_project_id', project.id)
        .order('stage_order', { ascending: true });

      if (stgErr) throw stgErr;

      const { data: items, error: itmErr } = await supabase
        .from('assembly_stage_items')
        .select('*')
        .in('assembly_stage_id', (stagesData ?? []).map(s => s.id));

      if (itmErr) throw itmErr;

      const stagesWithItems = (stagesData ?? []).map(s => ({
        ...s,
        items: (items ?? []).filter(i => i.assembly_stage_id === s.id),
      }));

      setStages(stagesWithItems);
    } catch {
      showToast('Erro ao carregar etapas.', 'error');
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    loadStages();
  }, [loadStages]);

  const handleAddStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStageName.trim()) return;
    try {
      const { error } = await supabase.from('assembly_stages').insert({
        assembly_project_id: project.id,
        name: newStageName.trim(),
        stage_order: stages.length,
      });
      if (error) throw error;
      setNewStageName('');
      setAddingStage(false);
      showToast('Etapa adicionada!', 'success');
      await loadStages();
    } catch {
      showToast('Erro ao adicionar etapa.', 'error');
    }
  };

  const handleUpdateStageStatus = async (id: string, status: AssemblyStage['status'], completedDate?: string) => {
    try {
      const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (completedDate) update.completed_date = completedDate;
      else update.completed_date = null;
      const { error } = await supabase.from('assembly_stages').update(update).eq('id', id);
      if (error) throw error;
      await loadStages();
      onProjectUpdated();
    } catch {
      showToast('Erro ao atualizar etapa.', 'error');
    }
  };

  const handleUpdateStage = async (id: string, data: Partial<AssemblyStage>) => {
    try {
      const { error } = await supabase.from('assembly_stages').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      showToast('Etapa atualizada!', 'success');
      await loadStages();
    } catch {
      showToast('Erro ao atualizar etapa.', 'error');
    }
  };

  const handleDeleteStage = async (id: string) => {
    if (!confirm('Excluir esta etapa e todos os seus itens?')) return;
    try {
      const { error } = await supabase.from('assembly_stages').delete().eq('id', id);
      if (error) throw error;
      showToast('Etapa excluída.', 'success');
      await loadStages();
    } catch {
      showToast('Erro ao excluir etapa.', 'error');
    }
  };

  const handleAddItem = async (stageId: string, data: Omit<AssemblyStageItem, 'id' | 'assembly_stage_id' | 'created_at' | 'updated_at' | 'sent_at'>) => {
    try {
      const { error } = await supabase.from('assembly_stage_items').insert({ ...data, assembly_stage_id: stageId });
      if (error) throw error;
      showToast('Item adicionado!', 'success');
      await loadStages();
    } catch {
      showToast('Erro ao adicionar item.', 'error');
    }
  };

  const handleUpdateItemStatus = async (id: string, status: AssemblyStageItem['status']) => {
    try {
      const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (status === 'sent') update.sent_at = new Date().toISOString();
      const { error } = await supabase.from('assembly_stage_items').update(update).eq('id', id);
      if (error) throw error;
      await loadStages();
    } catch {
      showToast('Erro ao atualizar status.', 'error');
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      const { error } = await supabase.from('assembly_stage_items').delete().eq('id', id);
      if (error) throw error;
      await loadStages();
    } catch {
      showToast('Erro ao remover item.', 'error');
    }
  };

  const totalStages = stages.length;
  const completedStages = stages.filter(s => s.status === 'completed').length;
  const inProgressStages = stages.filter(s => s.status === 'in_progress').length;
  const overallProgress = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

  const statusLabels: Record<AssemblyProject['status'], string> = {
    planning: 'Planejamento',
    in_progress: 'Em Andamento',
    completed: 'Concluída',
    cancelled: 'Cancelada',
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {showTemplateModal && (
        <ApplyTemplateModal
          projectId={project.id}
          existingCount={stages.length}
          onClose={() => setShowTemplateModal(false)}
          onApplied={loadStages}
        />
      )}

      <div className="flex items-center gap-4">
        <button onClick={onBack} className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900">{project.name}</h2>
          <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5 flex-wrap">
            {project.customer && <span>{project.customer.name}</span>}
            <span className="text-gray-300">|</span>
            <span>{statusLabels[project.status]}</span>
            {project.expected_end_date && (
              <>
                <span className="text-gray-300">|</span>
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Prazo: {new Date(project.expected_end_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{totalStages}</p>
          <p className="text-xs text-gray-500">Total de etapas</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{completedStages}</p>
          <p className="text-xs text-green-600">Concluídas</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-orange-700">{inProgressStages}</p>
          <p className="text-xs text-orange-600">Em andamento</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-blue-700">{overallProgress}%</p>
          <p className="text-xs text-blue-600">Progresso</p>
        </div>
      </div>

      {totalStages > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-3">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span>Progresso geral da obra</span>
            <span>{completedStages} de {totalStages} etapas concluídas</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-500"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Etapas de Montagem</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTemplateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 transition-colors"
          >
            <Layers className="w-3.5 h-3.5" /> Usar Template
          </button>
          <button
            onClick={() => setAddingStage(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar Etapa
          </button>
        </div>
      </div>

      {addingStage && (
        <form onSubmit={handleAddStage} className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex gap-2">
          <input
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            placeholder="Nome da nova etapa (ex: Execução da fundação) *"
            value={newStageName}
            onChange={e => setNewStageName(e.target.value)}
            required
            autoFocus
          />
          <button type="submit" className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> Salvar
          </button>
          <button type="button" onClick={() => { setAddingStage(false); setNewStageName(''); }} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            <X className="w-4 h-4" />
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : stages.length === 0 ? (
        <div className="text-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
          <HardHat className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhuma etapa criada.</p>
          <p className="text-sm mt-1">Adicione etapas manualmente ou aplique um template para começar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {stages.map(stage => (
            <StageCard
              key={stage.id}
              stage={stage}
              onUpdateStatus={handleUpdateStageStatus}
              onUpdate={handleUpdateStage}
              onDelete={handleDeleteStage}
              onAddItem={handleAddItem}
              onUpdateItemStatus={handleUpdateItemStatus}
              onDeleteItem={handleDeleteItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}
