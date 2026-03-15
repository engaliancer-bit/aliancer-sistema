import { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronDown, ChevronRight, Trash2, Edit2, Copy, Package, Wrench, HardHat, Check, X, GripVertical, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { AssemblyTemplate, AssemblyTemplateStage, AssemblyTemplateStageItem } from './types';

function Toast({ message, type, onClose }: { message: string; type: 'error' | 'success'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
      {type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
      {message}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">✕</button>
    </div>
  );
}

const ITEM_TYPE_CONFIG = {
  material: { label: 'Material', icon: Package, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  product: { label: 'Produto', icon: HardHat, color: 'bg-orange-100 text-orange-700 border-orange-200' },
  equipment: { label: 'Equipamento', icon: Wrench, color: 'bg-green-100 text-green-700 border-green-200' },
};

interface StageItemFormProps {
  item?: Partial<AssemblyTemplateStageItem>;
  onSave: (data: Omit<AssemblyTemplateStageItem, 'id' | 'template_stage_id' | 'created_at'>) => Promise<void>;
  onCancel: () => void;
}

function StageItemForm({ item, onSave, onCancel }: StageItemFormProps) {
  const [form, setForm] = useState({
    item_type: (item?.item_type ?? 'material') as 'material' | 'product' | 'equipment',
    item_name: item?.item_name ?? '',
    quantity: item?.quantity ?? 1,
    unit: item?.unit ?? 'un',
    notes: item?.notes ?? '',
    product_id: item?.product_id ?? null,
    material_id: item?.material_id ?? null,
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
    <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(ITEM_TYPE_CONFIG) as Array<keyof typeof ITEM_TYPE_CONFIG>).map(type => {
          const cfg = ITEM_TYPE_CONFIG[type];
          const Icon = cfg.icon;
          return (
            <button
              key={type}
              type="button"
              onClick={() => setForm(f => ({ ...f, item_type: type }))}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-xs font-medium transition-colors ${form.item_type === type ? cfg.color : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {cfg.label}
            </button>
          );
        })}
      </div>
      <input
        className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        placeholder="Nome do item *"
        value={form.item_name}
        onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))}
        required
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          min="0.01"
          step="0.01"
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          placeholder="Quantidade"
          value={form.quantity}
          onChange={e => setForm(f => ({ ...f, quantity: parseFloat(e.target.value) || 1 }))}
        />
        <input
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          placeholder="Unidade (un, m, kg...)"
          value={form.unit}
          onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
        />
      </div>
      <input
        className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        placeholder="Observações (opcional)"
        value={form.notes}
        onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
      />
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">Cancelar</button>
        <button type="submit" disabled={saving} className="px-3 py-1.5 text-xs bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50 flex items-center gap-1">
          <Check className="w-3 h-3" /> {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}

interface StageFormProps {
  stage?: Partial<AssemblyTemplateStage>;
  onSave: (data: { name: string; description: string }) => Promise<void>;
  onCancel: () => void;
}

function StageForm({ stage, onSave, onCancel }: StageFormProps) {
  const [name, setName] = useState(stage?.name ?? '');
  const [description, setDescription] = useState(stage?.description ?? '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name, description });
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-2">
      <input
        className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        placeholder="Nome da etapa *"
        value={name}
        onChange={e => setName(e.target.value)}
        required
        autoFocus
      />
      <textarea
        className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
        placeholder="Instruções / Descrição (opcional)"
        rows={2}
        value={description}
        onChange={e => setDescription(e.target.value)}
      />
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">Cancelar</button>
        <button type="submit" disabled={saving} className="px-3 py-1.5 text-xs bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50 flex items-center gap-1">
          <Check className="w-3 h-3" /> {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}

interface StageCardProps {
  stage: AssemblyTemplateStage;
  onUpdate: (id: string, data: { name: string; description: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddItem: (stageId: string, data: Omit<AssemblyTemplateStageItem, 'id' | 'template_stage_id' | 'created_at'>) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
}

function StageCard({ stage, onUpdate, onDelete, onAddItem, onDeleteItem }: StageCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addingItem, setAddingItem] = useState(false);

  const handleUpdate = async (data: { name: string; description: string }) => {
    await onUpdate(stage.id, data);
    setEditing(false);
  };

  const handleAddItem = async (data: Omit<AssemblyTemplateStageItem, 'id' | 'template_stage_id' | 'created_at'>) => {
    await onAddItem(stage.id, data);
    setAddingItem(false);
  };

  const itemCount = stage.items?.length ?? 0;

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      {editing ? (
        <div className="p-3">
          <StageForm stage={stage} onSave={handleUpdate} onCancel={() => setEditing(false)} />
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3">
          <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-2 flex-1 text-left"
          >
            {expanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
            <span className="font-medium text-sm text-gray-800">{stage.name}</span>
            {stage.description && (
              <span className="text-xs text-gray-500 hidden sm:block truncate max-w-xs">— {stage.description}</span>
            )}
            {itemCount > 0 && (
              <span className="ml-auto mr-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{itemCount} {itemCount === 1 ? 'item' : 'itens'}</span>
            )}
          </button>
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={() => setEditing(true)} className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onDelete(stage.id)} className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {expanded && !editing && (
        <div className="border-t border-gray-100 bg-gray-50 p-3 space-y-2">
          {stage.items && stage.items.length > 0 ? (
            <div className="space-y-1.5">
              {stage.items.map(item => {
                const cfg = ITEM_TYPE_CONFIG[item.item_type];
                const Icon = cfg.icon;
                return (
                  <div key={item.id} className="flex items-center gap-2 bg-white border border-gray-200 rounded-md px-3 py-2 text-sm">
                    <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border ${cfg.color}`}>
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                    <span className="flex-1 font-medium text-gray-700">{item.item_name}</span>
                    <span className="text-gray-500 text-xs">{item.quantity} {item.unit}</span>
                    {item.notes && <span className="text-gray-400 text-xs hidden sm:block">— {item.notes}</span>}
                    <button onClick={() => onDeleteItem(item.id)} className="p-0.5 text-gray-300 hover:text-red-500 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">Nenhum item nesta etapa.</p>
          )}

          {addingItem ? (
            <StageItemForm onSave={handleAddItem} onCancel={() => setAddingItem(false)} />
          ) : (
            <button
              onClick={() => setAddingItem(true)}
              className="flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-700 font-medium py-1"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar item
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface TemplateCardProps {
  template: AssemblyTemplate;
  onUpdate: (id: string, data: { name: string; description: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDuplicate: (id: string) => Promise<void>;
  onAddStage: (templateId: string, data: { name: string; description: string }) => Promise<void>;
  onUpdateStage: (stageId: string, data: { name: string; description: string }) => Promise<void>;
  onDeleteStage: (stageId: string) => Promise<void>;
  onAddItem: (stageId: string, data: Omit<AssemblyTemplateStageItem, 'id' | 'template_stage_id' | 'created_at'>) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
}

function TemplateCard({
  template, onUpdate, onDelete, onDuplicate,
  onAddStage, onUpdateStage, onDeleteStage,
  onAddItem, onDeleteItem
}: TemplateCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addingStage, setAddingStage] = useState(false);

  const handleUpdate = async (data: { name: string; description: string }) => {
    await onUpdate(template.id, data);
    setEditing(false);
  };

  const handleAddStage = async (data: { name: string; description: string }) => {
    await onAddStage(template.id, data);
    setAddingStage(false);
  };

  const stageCount = template.stages?.length ?? 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <input
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-400"
                defaultValue={template.name}
                id={`template-name-${template.id}`}
              />
              <textarea
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                rows={2}
                defaultValue={template.description}
                id={`template-desc-${template.id}`}
              />
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const nameEl = document.getElementById(`template-name-${template.id}`) as HTMLInputElement;
                    const descEl = document.getElementById(`template-desc-${template.id}`) as HTMLTextAreaElement;
                    await handleUpdate({ name: nameEl.value, description: descEl.value });
                  }}
                  className="px-3 py-1.5 text-xs bg-orange-500 text-white rounded-md hover:bg-orange-600"
                >
                  Salvar
                </button>
                <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs border border-gray-300 rounded-md hover:bg-gray-50">Cancelar</button>
              </div>
            </div>
          ) : (
            <>
              <h3 className="font-semibold text-gray-900 text-base">{template.name}</h3>
              {template.description && (
                <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{template.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs text-gray-400">{stageCount} {stageCount === 1 ? 'etapa' : 'etapas'}</span>
                <button
                  onClick={() => setExpanded(e => !e)}
                  className="text-xs text-orange-600 hover:text-orange-700 font-medium flex items-center gap-0.5"
                >
                  {expanded ? <><ChevronDown className="w-3.5 h-3.5" /> Recolher</> : <><ChevronRight className="w-3.5 h-3.5" /> Ver etapas</>}
                </button>
              </div>
            </>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={() => onDuplicate(template.id)}
            className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
            title="Duplicar template"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            title="Editar"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(template.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            title="Excluir"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
          <div className="space-y-2">
            {template.stages && template.stages.length > 0 ? (
              template.stages
                .slice()
                .sort((a, b) => a.stage_order - b.stage_order)
                .map(stage => (
                  <StageCard
                    key={stage.id}
                    stage={stage}
                    onUpdate={onUpdateStage}
                    onDelete={onDeleteStage}
                    onAddItem={onAddItem}
                    onDeleteItem={onDeleteItem}
                  />
                ))
            ) : (
              <p className="text-sm text-gray-400 italic">Nenhuma etapa ainda. Adicione abaixo.</p>
            )}
          </div>

          {addingStage ? (
            <StageForm onSave={handleAddStage} onCancel={() => setAddingStage(false)} />
          ) : (
            <button
              onClick={() => setAddingStage(true)}
              className="flex items-center gap-2 w-full px-3 py-2 border-2 border-dashed border-orange-200 rounded-lg text-sm text-orange-600 hover:border-orange-400 hover:bg-orange-50 transition-colors font-medium"
            >
              <Plus className="w-4 h-4" /> Adicionar etapa
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function AssemblyTemplates() {
  const [templates, setTemplates] = useState<AssemblyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const showToast = (message: string, type: 'error' | 'success') => {
    setToast({ message, type });
  };

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const { data: tpls, error: tplErr } = await supabase
        .from('assembly_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (tplErr) throw tplErr;

      const { data: stages, error: stgErr } = await supabase
        .from('assembly_template_stages')
        .select('*')
        .order('stage_order', { ascending: true });

      if (stgErr) throw stgErr;

      const { data: items, error: itmErr } = await supabase
        .from('assembly_template_stage_items')
        .select('*');

      if (itmErr) throw itmErr;

      const stagesWithItems = (stages ?? []).map(s => ({
        ...s,
        items: (items ?? []).filter(i => i.template_stage_id === s.id),
      }));

      const templatesWithStages = (tpls ?? []).map(t => ({
        ...t,
        stages: stagesWithItems.filter(s => s.template_id === t.id),
      }));

      setTemplates(templatesWithStages);
    } catch {
      showToast('Erro ao carregar templates.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('assembly_templates')
        .insert({ name: newName.trim(), description: newDesc.trim() });
      if (error) throw error;
      setNewName('');
      setNewDesc('');
      setShowNewForm(false);
      showToast('Template criado com sucesso!', 'success');
      await loadTemplates();
    } catch {
      showToast('Erro ao criar template.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string, data: { name: string; description: string }) => {
    try {
      const { error } = await supabase
        .from('assembly_templates')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      showToast('Template atualizado!', 'success');
      await loadTemplates();
    } catch {
      showToast('Erro ao atualizar template.', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este template? Todas as etapas serão removidas.')) return;
    try {
      const { error } = await supabase.from('assembly_templates').delete().eq('id', id);
      if (error) throw error;
      showToast('Template excluído.', 'success');
      await loadTemplates();
    } catch {
      showToast('Erro ao excluir template.', 'error');
    }
  };

  const handleDuplicate = async (id: string) => {
    const source = templates.find(t => t.id === id);
    if (!source) return;
    try {
      const { data: newTpl, error: tplErr } = await supabase
        .from('assembly_templates')
        .insert({ name: `${source.name} (cópia)`, description: source.description })
        .select()
        .single();
      if (tplErr) throw tplErr;

      if (source.stages && source.stages.length > 0) {
        for (const stage of source.stages) {
          const { data: newStage, error: stgErr } = await supabase
            .from('assembly_template_stages')
            .insert({ template_id: newTpl.id, name: stage.name, description: stage.description, stage_order: stage.stage_order })
            .select()
            .single();
          if (stgErr) throw stgErr;

          if (stage.items && stage.items.length > 0) {
            const itemsToInsert = stage.items.map(({ id: _id, template_stage_id: _sid, created_at: _cat, ...rest }) => ({
              ...rest,
              template_stage_id: newStage.id,
            }));
            const { error: itmErr } = await supabase.from('assembly_template_stage_items').insert(itemsToInsert);
            if (itmErr) throw itmErr;
          }
        }
      }

      showToast('Template duplicado com sucesso!', 'success');
      await loadTemplates();
    } catch {
      showToast('Erro ao duplicar template.', 'error');
    }
  };

  const handleAddStage = async (templateId: string, data: { name: string; description: string }) => {
    try {
      const template = templates.find(t => t.id === templateId);
      const nextOrder = (template?.stages?.length ?? 0);
      const { error } = await supabase
        .from('assembly_template_stages')
        .insert({ template_id: templateId, name: data.name, description: data.description, stage_order: nextOrder });
      if (error) throw error;
      showToast('Etapa adicionada!', 'success');
      await loadTemplates();
    } catch {
      showToast('Erro ao adicionar etapa.', 'error');
    }
  };

  const handleUpdateStage = async (stageId: string, data: { name: string; description: string }) => {
    try {
      const { error } = await supabase
        .from('assembly_template_stages')
        .update(data)
        .eq('id', stageId);
      if (error) throw error;
      showToast('Etapa atualizada!', 'success');
      await loadTemplates();
    } catch {
      showToast('Erro ao atualizar etapa.', 'error');
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    if (!confirm('Excluir esta etapa e todos os seus itens?')) return;
    try {
      const { error } = await supabase.from('assembly_template_stages').delete().eq('id', stageId);
      if (error) throw error;
      showToast('Etapa excluída.', 'success');
      await loadTemplates();
    } catch {
      showToast('Erro ao excluir etapa.', 'error');
    }
  };

  const handleAddItem = async (stageId: string, data: Omit<AssemblyTemplateStageItem, 'id' | 'template_stage_id' | 'created_at'>) => {
    try {
      const { error } = await supabase
        .from('assembly_template_stage_items')
        .insert({ ...data, template_stage_id: stageId });
      if (error) throw error;
      showToast('Item adicionado!', 'success');
      await loadTemplates();
    } catch {
      showToast('Erro ao adicionar item.', 'error');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const { error } = await supabase.from('assembly_template_stage_items').delete().eq('id', itemId);
      if (error) throw error;
      showToast('Item removido.', 'success');
      await loadTemplates();
    } catch {
      showToast('Erro ao remover item.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Templates de Montagem</h2>
          <p className="text-sm text-gray-500 mt-0.5">Crie padrões reutilizáveis de etapas com listas de materiais e equipamentos.</p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium text-sm"
        >
          <Plus className="w-4 h-4" /> Novo Template
        </button>
      </div>

      {showNewForm && (
        <form onSubmit={handleCreate} className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
          <h3 className="font-medium text-orange-800 text-sm">Novo Template</h3>
          <input
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            placeholder="Nome do template (ex: Pórtico Pré-Moldado Padrão) *"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            required
            autoFocus
          />
          <textarea
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            placeholder="Descrição (opcional)"
            rows={2}
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
          />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setShowNewForm(false); setNewName(''); setNewDesc(''); }} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50">
              {saving ? 'Criando...' : 'Criar Template'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <HardHat className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum template criado ainda.</p>
          <p className="text-sm mt-1">Crie templates de etapas para reutilizar em suas obras de montagem.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {templates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onAddStage={handleAddStage}
              onUpdateStage={handleUpdateStage}
              onDeleteStage={handleDeleteStage}
              onAddItem={handleAddItem}
              onDeleteItem={handleDeleteItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}
