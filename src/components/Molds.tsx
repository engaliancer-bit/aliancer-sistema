import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Edit2, Trash2, Plus, Save, X, Box, Settings, Star } from 'lucide-react';

interface MoldReinforcement {
  id: string;
  mold_id: string;
  type: 'longitudinal' | 'transversal' | 'lifting' | 'threaded_bar_hook';
  reinforcement_location: 'base' | 'flange';
  identifier: string;
  position: string;
  quantity: number;
  reference_length_meters?: number;
  length_adjustment_meters?: number;
  stirrup_spacing_meters?: number;
  stirrup_standard_length_meters?: number;
  stirrup_standard_quantity?: number;
  bar_length_meters?: number;
  description: string;
  notes: string;
  is_standard_pattern?: boolean;
}

interface Mold {
  id: string;
  name: string;
  description: string;
  section_width_meters?: number;
  section_height_meters?: number;
  reference_measurement_meters?: number;
  reference_volume_m3?: number;
  has_flange?: boolean;
  flange_section_width_cm?: number;
  flange_section_height_cm?: number;
  flange_reference_measurement_meters?: number;
  flange_reference_volume_m3?: number;
  standard_length_meters?: number;
  standard_stirrup_count?: number;
  standard_stirrup_spacing_cm?: number;
  created_at: string;
  reinforcements?: MoldReinforcement[];
}

export default function Molds() {
  const [molds, setMolds] = useState<Mold[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<'basic' | 'reinforcements'>('basic');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    section_width_meters: '',
    section_height_meters: '',
    reference_measurement_meters: '',
    reference_volume_m3: '',
    has_flange: false,
    flange_section_width_cm: '',
    flange_section_height_cm: '',
    flange_reference_measurement_meters: '',
    flange_reference_volume_m3: '',
  });

  const [reinforcements, setReinforcements] = useState<MoldReinforcement[]>([]);
  const [showReinforcementForm, setShowReinforcementForm] = useState(false);
  const [editingReinforcementId, setEditingReinforcementId] = useState<string | null>(null);

  const [reinforcementForm, setReinforcementForm] = useState({
    type: 'longitudinal' as 'longitudinal' | 'transversal' | 'lifting' | 'threaded_bar_hook',
    reinforcement_location: 'base' as 'base' | 'flange',
    identifier: '',
    position: '',
    quantity: '1',
    reference_length_meters: '',
    length_adjustment_meters: '',
    stirrup_spacing_meters: '',
    stirrup_standard_length_meters: '',
    stirrup_standard_quantity: '',
    bar_length_meters: '',
    description: '',
    notes: '',
  });

  useEffect(() => {
    loadMolds();
  }, []);

  const loadMolds = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('molds')
        .select('*')
        .order('name');

      if (error) throw error;
      setMolds(data || []);
    } catch (error) {
      console.error('Erro ao carregar fôrmas:', error);
      alert('Erro ao carregar fôrmas');
    } finally {
      setLoading(false);
    }
  };

  const loadReinforcementsForMold = async (moldId: string) => {
    try {
      const { data, error } = await supabase
        .from('mold_reinforcements')
        .select('*')
        .eq('mold_id', moldId)
        .order('type, identifier');

      if (error) throw error;
      setReinforcements(data || []);
    } catch (error) {
      console.error('Erro ao carregar armaduras:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Nome da fôrma é obrigatório');
      return;
    }

    try {
      const moldData = {
        name: formData.name,
        description: formData.description,
        section_width_meters: formData.section_width_meters ? parseFloat(formData.section_width_meters) : null,
        section_height_meters: formData.section_height_meters ? parseFloat(formData.section_height_meters) : null,
        reference_measurement_meters: formData.reference_measurement_meters ? parseFloat(formData.reference_measurement_meters) : null,
        reference_volume_m3: formData.reference_volume_m3 ? parseFloat(formData.reference_volume_m3) : null,
        has_flange: formData.has_flange,
        flange_section_width_cm: formData.has_flange && formData.flange_section_width_cm ? parseFloat(formData.flange_section_width_cm) : null,
        flange_section_height_cm: formData.has_flange && formData.flange_section_height_cm ? parseFloat(formData.flange_section_height_cm) : null,
        flange_reference_measurement_meters: formData.has_flange && formData.flange_reference_measurement_meters ? parseFloat(formData.flange_reference_measurement_meters) : null,
        flange_reference_volume_m3: formData.has_flange && formData.flange_reference_volume_m3 ? parseFloat(formData.flange_reference_volume_m3) : null,
      };

      if (editingId) {
        const { error } = await supabase
          .from('molds')
          .update({ ...moldData, updated_at: new Date().toISOString() })
          .eq('id', editingId);

        if (error) throw error;
        alert('Fôrma atualizada com sucesso!');
      } else {
        const { data, error } = await supabase
          .from('molds')
          .insert([moldData])
          .select()
          .single();

        if (error) throw error;
        alert('Fôrma cadastrada com sucesso!');

        if (data) {
          setEditingId(data.id);
          setCurrentStep('reinforcements');
          return;
        }
      }

      loadMolds();
      if (currentStep === 'basic') {
        setCurrentStep('reinforcements');
      }
    } catch (error) {
      console.error('Erro ao salvar fôrma:', error);
      alert('Erro ao salvar fôrma');
    }
  };

  const handleEdit = async (mold: Mold) => {
    setFormData({
      name: mold.name,
      description: mold.description || '',
      section_width_meters: mold.section_width_meters?.toString() || '',
      section_height_meters: mold.section_height_meters?.toString() || '',
      reference_measurement_meters: mold.reference_measurement_meters?.toString() || '',
      reference_volume_m3: mold.reference_volume_m3?.toString() || '',
      has_flange: mold.has_flange || false,
      flange_section_width_cm: mold.flange_section_width_cm?.toString() || '',
      flange_section_height_cm: mold.flange_section_height_cm?.toString() || '',
      flange_reference_measurement_meters: mold.flange_reference_measurement_meters?.toString() || '',
      flange_reference_volume_m3: mold.flange_reference_volume_m3?.toString() || '',
    });
    setEditingId(mold.id);
    await loadReinforcementsForMold(mold.id);
    setCurrentStep('basic');
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta fôrma? Isso removerá todas as armaduras associadas.')) {
      return;
    }

    try {
      const { error } = await supabase.from('molds').delete().eq('id', id);
      if (error) throw error;

      alert('Fôrma excluída com sucesso!');
      loadMolds();
    } catch (error) {
      console.error('Erro ao excluir fôrma:', error);
      alert('Erro ao excluir fôrma');
    }
  };

  const handleAddReinforcement = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingId) {
      alert('Salve a fôrma primeiro antes de adicionar armaduras');
      return;
    }

    if (!reinforcementForm.type) {
      alert('Selecione o tipo de armadura');
      return;
    }

    try {
      const reinforcementData = {
        mold_id: editingId,
        type: reinforcementForm.type,
        reinforcement_location: reinforcementForm.reinforcement_location,
        identifier: reinforcementForm.identifier,
        position: reinforcementForm.position,
        quantity: parseInt(reinforcementForm.quantity) || 1,
        reference_length_meters: reinforcementForm.reference_length_meters ? parseFloat(reinforcementForm.reference_length_meters) : null,
        length_adjustment_meters: reinforcementForm.length_adjustment_meters ? parseFloat(reinforcementForm.length_adjustment_meters) : null,
        stirrup_spacing_meters: reinforcementForm.stirrup_spacing_meters ? parseFloat(reinforcementForm.stirrup_spacing_meters) : null,
        stirrup_standard_length_meters: reinforcementForm.stirrup_standard_length_meters ? parseFloat(reinforcementForm.stirrup_standard_length_meters) : null,
        stirrup_standard_quantity: reinforcementForm.stirrup_standard_quantity ? parseInt(reinforcementForm.stirrup_standard_quantity) : null,
        bar_length_meters: reinforcementForm.bar_length_meters ? parseFloat(reinforcementForm.bar_length_meters) : null,
        description: reinforcementForm.description,
        notes: reinforcementForm.notes,
      };

      if (editingReinforcementId) {
        const { error } = await supabase
          .from('mold_reinforcements')
          .update(reinforcementData)
          .eq('id', editingReinforcementId);

        if (error) throw error;
        alert('Armadura atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('mold_reinforcements')
          .insert([reinforcementData]);

        if (error) throw error;
        alert('Armadura adicionada com sucesso!');
      }

      await loadReinforcementsForMold(editingId);
      resetReinforcementForm();
      setShowReinforcementForm(false);
    } catch (error) {
      console.error('Erro ao salvar armadura:', error);
      alert('Erro ao salvar armadura');
    }
  };

  const handleEditReinforcement = (reinforcement: MoldReinforcement) => {
    setReinforcementForm({
      type: reinforcement.type,
      reinforcement_location: reinforcement.reinforcement_location || 'base',
      identifier: reinforcement.identifier || '',
      position: reinforcement.position || '',
      quantity: reinforcement.quantity?.toString() || '1',
      reference_length_meters: reinforcement.reference_length_meters?.toString() || '',
      length_adjustment_meters: reinforcement.length_adjustment_meters?.toString() || '',
      stirrup_spacing_meters: reinforcement.stirrup_spacing_meters?.toString() || '',
      stirrup_standard_length_meters: reinforcement.stirrup_standard_length_meters?.toString() || '',
      stirrup_standard_quantity: reinforcement.stirrup_standard_quantity?.toString() || '',
      bar_length_meters: reinforcement.bar_length_meters?.toString() || '',
      description: reinforcement.description || '',
      notes: reinforcement.notes || '',
    });
    setEditingReinforcementId(reinforcement.id);
    setShowReinforcementForm(true);
  };

  const handleDeleteReinforcement = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta armadura?')) {
      return;
    }

    try {
      const { error } = await supabase.from('mold_reinforcements').delete().eq('id', id);
      if (error) throw error;

      alert('Armadura excluída com sucesso!');
      if (editingId) {
        await loadReinforcementsForMold(editingId);
      }
    } catch (error) {
      console.error('Erro ao excluir armadura:', error);
      alert('Erro ao excluir armadura');
    }
  };

  const toggleStandardPattern = async (reinforcementId: string, currentValue: boolean) => {
    if (!editingId) return;

    try {
      if (!currentValue) {
        await supabase
          .from('mold_reinforcements')
          .update({ is_standard_pattern: false })
          .eq('mold_id', editingId)
          .eq('type', 'transversal');
      }

      const { error } = await supabase
        .from('mold_reinforcements')
        .update({ is_standard_pattern: !currentValue })
        .eq('id', reinforcementId);

      if (error) throw error;

      await loadReinforcementsForMold(editingId);
    } catch (error) {
      console.error('Erro ao alternar padrão:', error);
      alert('Erro ao marcar armadura como padrão');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      section_width_meters: '',
      section_height_meters: '',
      reference_measurement_meters: '',
      reference_volume_m3: '',
      has_flange: false,
      flange_section_width_cm: '',
      flange_section_height_cm: '',
      flange_reference_measurement_meters: '',
      flange_reference_volume_m3: '',
    });
    setEditingId(null);
    setReinforcements([]);
    setCurrentStep('basic');
    setShowForm(false);
    resetReinforcementForm();
  };

  const resetReinforcementForm = () => {
    setReinforcementForm({
      type: 'longitudinal',
      reinforcement_location: 'base',
      identifier: '',
      position: '',
      quantity: '1',
      reference_length_meters: '',
      length_adjustment_meters: '',
      stirrup_spacing_meters: '',
      stirrup_standard_length_meters: '',
      stirrup_standard_quantity: '',
      bar_length_meters: '',
      description: '',
      notes: '',
    });
    setEditingReinforcementId(null);
  };

  const getReinforcementTypeName = (type: string) => {
    const types = {
      longitudinal: 'Longitudinal',
      transversal: 'Transversal (Estribos)',
      lifting: 'Içamento',
      threaded_bar_hook: 'Gancho de Barra Roscada',
    };
    return types[type as keyof typeof types] || type;
  };

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Box className="w-6 h-6" />
            Cadastro de Fôrmas
          </h2>
          <p className="text-gray-600 mt-1">
            Cadastre fôrmas com suas medidas padrão e configurações de armaduras
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nova Fôrma
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900">
              {editingId ? 'Editar Fôrma' : 'Nova Fôrma'}
            </h3>
            <button
              onClick={resetForm}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navegação por etapas */}
          <div className="flex gap-4 mb-6 border-b">
            <button
              onClick={() => setCurrentStep('basic')}
              className={`pb-3 px-4 font-medium transition-colors ${
                currentStep === 'basic'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              1. Informações Básicas
            </button>
            <button
              onClick={() => {
                if (editingId) {
                  setCurrentStep('reinforcements');
                } else {
                  alert('Salve as informações básicas primeiro');
                }
              }}
              className={`pb-3 px-4 font-medium transition-colors ${
                currentStep === 'reinforcements'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              disabled={!editingId}
            >
              2. Configuração de Armaduras
            </button>
          </div>

          {currentStep === 'basic' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome da Fôrma *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: Pilar 15x20"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={2}
                    placeholder="Descrição da fôrma"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Largura da Seção (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.section_width_meters}
                    onChange={(e) => setFormData({ ...formData, section_width_meters: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: 0.15"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Altura da Seção (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.section_height_meters}
                    onChange={(e) => setFormData({ ...formData, section_height_meters: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: 0.20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Medida de Referência (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.reference_measurement_meters}
                    onChange={(e) => setFormData({ ...formData, reference_measurement_meters: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: 4.85"
                  />
                  <p className="text-xs text-gray-500 mt-1">Comprimento padrão para cálculo</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Volume de Referência (m³)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.reference_volume_m3}
                    onChange={(e) => setFormData({ ...formData, reference_volume_m3: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: 0.1455"
                  />
                  <p className="text-xs text-gray-500 mt-1">Volume para a medida de referência</p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4 mt-4">
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="has_flange"
                    checked={formData.has_flange}
                    onChange={(e) => setFormData({ ...formData, has_flange: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="has_flange" className="text-sm font-medium text-gray-700">
                    Este produto possui aba (tesoura)
                  </label>
                </div>

                {formData.has_flange && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6 border-l-2 border-blue-200">
                    <div className="md:col-span-2">
                      <h5 className="text-sm font-semibold text-gray-900 mb-3">Medidas Padrão da Aba</h5>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Largura da Seção da Aba (cm)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.flange_section_width_cm}
                        onChange={(e) => setFormData({ ...formData, flange_section_width_cm: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Ex: 10"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Altura da Seção da Aba (cm)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.flange_section_height_cm}
                        onChange={(e) => setFormData({ ...formData, flange_section_height_cm: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Ex: 5"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Comprimento de Referência da Aba (m)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.flange_reference_measurement_meters}
                        onChange={(e) => setFormData({ ...formData, flange_reference_measurement_meters: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Ex: 4.85"
                      />
                      <p className="text-xs text-gray-500 mt-1">Comprimento padrão da aba</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Volume de Referência da Aba (m³)
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        value={formData.flange_reference_volume_m3}
                        onChange={(e) => setFormData({ ...formData, flange_reference_volume_m3: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Ex: 0.0242"
                      />
                      <p className="text-xs text-gray-500 mt-1">Volume da aba para o comprimento de referência</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                >
                  <Save className="w-5 h-5" />
                  {editingId ? 'Atualizar e Continuar' : 'Salvar e Continuar'}
                </button>
              </div>
            </form>
          )}

          {currentStep === 'reinforcements' && editingId && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Armaduras da Fôrma
                </h4>
                <button
                  onClick={() => {
                    resetReinforcementForm();
                    setShowReinforcementForm(true);
                  }}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar Armadura
                </button>
              </div>

              {/* Lista de Armaduras da Base */}
              {reinforcements.filter(r => r.reinforcement_location === 'base').length > 0 && (
                <div className="space-y-3">
                  <h5 className="text-md font-semibold text-gray-800 flex items-center gap-2">
                    Armaduras da Base
                  </h5>
                  {reinforcements.filter(r => r.reinforcement_location === 'base').map((reinforcement) => (
                    <div
                      key={reinforcement.id}
                      className="bg-gray-50 border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                              {getReinforcementTypeName(reinforcement.type)}
                            </span>
                            {reinforcement.identifier && (
                              <span className="text-sm font-semibold text-gray-700">
                                {reinforcement.identifier}
                              </span>
                            )}
                            {reinforcement.position && (
                              <span className="text-sm text-gray-600">
                                {reinforcement.position}
                              </span>
                            )}
                            <span className="text-sm text-gray-600">
                              Qtd: {reinforcement.quantity}
                            </span>
                          </div>

                          {reinforcement.type === 'longitudinal' && (
                            <div className="text-sm text-gray-600 space-y-1">
                              {reinforcement.reference_length_meters && (
                                <div>Comprimento Ref: {reinforcement.reference_length_meters}m</div>
                              )}
                              {reinforcement.length_adjustment_meters && (
                                <div>Ajuste: {reinforcement.length_adjustment_meters}m</div>
                              )}
                            </div>
                          )}

                          {reinforcement.type === 'transversal' && (
                            <div className="text-sm text-gray-600 space-y-1">
                              {reinforcement.stirrup_spacing_meters && (
                                <div>Espaçamento: {reinforcement.stirrup_spacing_meters}m</div>
                              )}
                              {reinforcement.stirrup_standard_length_meters && (
                                <div>Comprimento Estribo: {reinforcement.stirrup_standard_length_meters}m</div>
                              )}
                              {reinforcement.stirrup_standard_quantity && (
                                <div>Qtd Padrão: {reinforcement.stirrup_standard_quantity}</div>
                              )}
                            </div>
                          )}

                          {(reinforcement.type === 'lifting' || reinforcement.type === 'threaded_bar_hook') && (
                            <div className="text-sm text-gray-600">
                              {reinforcement.bar_length_meters && (
                                <div>Comprimento: {reinforcement.bar_length_meters}m</div>
                              )}
                            </div>
                          )}

                          {reinforcement.description && (
                            <div className="text-sm text-gray-600 mt-2">
                              {reinforcement.description}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          {reinforcement.type === 'transversal' && (
                            <button
                              onClick={() => toggleStandardPattern(reinforcement.id, reinforcement.is_standard_pattern || false)}
                              className={`${
                                reinforcement.is_standard_pattern
                                  ? 'text-yellow-500 hover:text-yellow-600'
                                  : 'text-gray-400 hover:text-yellow-500'
                              }`}
                              title={reinforcement.is_standard_pattern ? 'Estribo Padrão (clique para desmarcar)' : 'Marcar como Estribo Padrão'}
                            >
                              <Star className={`w-5 h-5 ${reinforcement.is_standard_pattern ? 'fill-yellow-500' : ''}`} />
                            </button>
                          )}
                          <button
                            onClick={() => handleEditReinforcement(reinforcement)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteReinforcement(reinforcement.id)}
                            className="text-red-600 hover:text-red-800"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Lista de Armaduras da Aba */}
              {reinforcements.filter(r => r.reinforcement_location === 'flange').length > 0 && (
                <div className="space-y-3">
                  <h5 className="text-md font-semibold text-gray-800 flex items-center gap-2">
                    Armaduras da Aba (Flange)
                  </h5>
                  {reinforcements.filter(r => r.reinforcement_location === 'flange').map((reinforcement) => (
                    <div
                      key={reinforcement.id}
                      className="bg-green-50 border border-green-200 rounded-lg p-4"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                              {getReinforcementTypeName(reinforcement.type)}
                            </span>
                            {reinforcement.identifier && (
                              <span className="text-sm font-semibold text-gray-700">
                                {reinforcement.identifier}
                              </span>
                            )}
                            {reinforcement.position && (
                              <span className="text-sm text-gray-600">
                                {reinforcement.position}
                              </span>
                            )}
                            <span className="text-sm text-gray-600">
                              Qtd: {reinforcement.quantity}
                            </span>
                          </div>

                          {reinforcement.type === 'longitudinal' && (
                            <div className="text-sm text-gray-600 space-y-1">
                              {reinforcement.reference_length_meters && (
                                <div>Comprimento Ref: {reinforcement.reference_length_meters}m</div>
                              )}
                              {reinforcement.length_adjustment_meters && (
                                <div>Ajuste: {reinforcement.length_adjustment_meters}m</div>
                              )}
                            </div>
                          )}

                          {reinforcement.type === 'transversal' && (
                            <div className="text-sm text-gray-600 space-y-1">
                              {reinforcement.stirrup_spacing_meters && (
                                <div>Espaçamento: {reinforcement.stirrup_spacing_meters}m</div>
                              )}
                              {reinforcement.stirrup_standard_length_meters && (
                                <div>Comprimento: {reinforcement.stirrup_standard_length_meters}m</div>
                              )}
                              {reinforcement.stirrup_standard_quantity && (
                                <div>Quantidade Padrão: {reinforcement.stirrup_standard_quantity}</div>
                              )}
                            </div>
                          )}

                          {(reinforcement.type === 'lifting' || reinforcement.type === 'threaded_bar_hook') && (
                            <div className="text-sm text-gray-600 space-y-1">
                              {reinforcement.bar_length_meters && (
                                <div>Comprimento: {reinforcement.bar_length_meters}m</div>
                              )}
                            </div>
                          )}

                          {reinforcement.description && (
                            <div className="text-sm text-gray-600 mt-2">
                              {reinforcement.description}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          {reinforcement.type === 'transversal' && (
                            <button
                              onClick={() => toggleStandardPattern(reinforcement.id, reinforcement.is_standard_pattern || false)}
                              className={`${
                                reinforcement.is_standard_pattern
                                  ? 'text-yellow-500 hover:text-yellow-600'
                                  : 'text-gray-400 hover:text-yellow-500'
                              }`}
                              title={reinforcement.is_standard_pattern ? 'Estribo Padrão (clique para desmarcar)' : 'Marcar como Estribo Padrão'}
                            >
                              <Star className={`w-5 h-5 ${reinforcement.is_standard_pattern ? 'fill-yellow-500' : ''}`} />
                            </button>
                          )}
                          <button
                            onClick={() => handleEditReinforcement(reinforcement)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteReinforcement(reinforcement.id)}
                            className="text-red-600 hover:text-red-800"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Formulário de Armadura */}
              {showReinforcementForm && (
                <form onSubmit={handleAddReinforcement} className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <h5 className="text-base font-semibold text-blue-900">
                      {editingReinforcementId ? 'Editar Armadura' : 'Nova Armadura'}
                    </h5>
                    <button
                      type="button"
                      onClick={() => {
                        setShowReinforcementForm(false);
                        resetReinforcementForm();
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tipo de Armadura *
                      </label>
                      <select
                        value={reinforcementForm.type}
                        onChange={(e) => setReinforcementForm({ ...reinforcementForm, type: e.target.value as any })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="longitudinal">Longitudinal</option>
                        <option value="transversal">Transversal (Estribos)</option>
                        <option value="lifting">Içamento</option>
                        <option value="threaded_bar_hook">Gancho de Barra Roscada</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Localização *
                      </label>
                      <select
                        value={reinforcementForm.reinforcement_location}
                        onChange={(e) => setReinforcementForm({ ...reinforcementForm, reinforcement_location: e.target.value as 'base' | 'flange' })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="base">Base (Parte Principal)</option>
                        <option value="flange">Aba (Flange)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Identificador {reinforcementForm.type === 'longitudinal' && '*'}
                      </label>
                      <input
                        type="text"
                        value={reinforcementForm.identifier}
                        onChange={(e) => setReinforcementForm({ ...reinforcementForm, identifier: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Ex: A, B, C"
                        required={reinforcementForm.type === 'longitudinal'}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Posição
                      </label>
                      <input
                        type="text"
                        value={reinforcementForm.position}
                        onChange={(e) => setReinforcementForm({ ...reinforcementForm, position: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Ex: Canto, Centro, Superior"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quantidade *
                      </label>
                      <input
                        type="number"
                        value={reinforcementForm.quantity}
                        onChange={(e) => setReinforcementForm({ ...reinforcementForm, quantity: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Ex: 4"
                        required
                      />
                    </div>

                    {/* Campos específicos para Longitudinal */}
                    {reinforcementForm.type === 'longitudinal' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Comprimento de Referência (m) *
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            value={reinforcementForm.reference_length_meters}
                            onChange={(e) => setReinforcementForm({ ...reinforcementForm, reference_length_meters: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="Ex: 4.95"
                            required
                          />
                          <p className="text-xs text-gray-500 mt-1">Comprimento para medida padrão</p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Ajuste de Comprimento (m)
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            value={reinforcementForm.length_adjustment_meters}
                            onChange={(e) => setReinforcementForm({ ...reinforcementForm, length_adjustment_meters: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="Ex: 0.10"
                          />
                          <p className="text-xs text-gray-500 mt-1">Ajuste fixo (ganchos, etc.)</p>
                        </div>
                      </>
                    )}

                    {/* Campos específicos para Transversal */}
                    {reinforcementForm.type === 'transversal' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Espaçamento entre Estribos (m) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={reinforcementForm.stirrup_spacing_meters}
                            onChange={(e) => setReinforcementForm({ ...reinforcementForm, stirrup_spacing_meters: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="Ex: 0.15"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Comprimento de Cada Estribo (m) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={reinforcementForm.stirrup_standard_length_meters}
                            onChange={(e) => setReinforcementForm({ ...reinforcementForm, stirrup_standard_length_meters: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="Ex: 0.60"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Quantidade Padrão de Estribos *
                          </label>
                          <input
                            type="number"
                            value={reinforcementForm.stirrup_standard_quantity}
                            onChange={(e) => setReinforcementForm({ ...reinforcementForm, stirrup_standard_quantity: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="Ex: 30"
                            required
                          />
                          <p className="text-xs text-gray-500 mt-1">Para a medida de referência</p>
                        </div>
                      </>
                    )}

                    {/* Campos para Içamento e Ganchos */}
                    {(reinforcementForm.type === 'lifting' || reinforcementForm.type === 'threaded_bar_hook') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Comprimento da Barra (m) *
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          value={reinforcementForm.bar_length_meters}
                          onChange={(e) => setReinforcementForm({ ...reinforcementForm, bar_length_meters: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Ex: 0.50"
                          required
                        />
                      </div>
                    )}

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Descrição
                      </label>
                      <textarea
                        value={reinforcementForm.description}
                        onChange={(e) => setReinforcementForm({ ...reinforcementForm, description: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        rows={2}
                        placeholder="Descrição adicional"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Observações
                      </label>
                      <textarea
                        value={reinforcementForm.notes}
                        onChange={(e) => setReinforcementForm({ ...reinforcementForm, notes: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        rows={2}
                        placeholder="Observações"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowReinforcementForm(false);
                        resetReinforcementForm();
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
                    >
                      <Save className="w-5 h-5" />
                      {editingReinforcementId ? 'Atualizar Armadura' : 'Adicionar Armadura'}
                    </button>
                  </div>
                </form>
              )}

              <div className="flex justify-between gap-3 pt-6 border-t">
                <button
                  onClick={() => setCurrentStep('basic')}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Voltar
                </button>
                <button
                  onClick={resetForm}
                  className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                >
                  <Save className="w-5 h-5" />
                  Concluir Cadastro
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lista de Fôrmas */}
      {!showForm && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {molds.map((mold) => (
            <div
              key={mold.id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{mold.name}</h3>
                  {mold.description && (
                    <p className="text-sm text-gray-600 mt-1">{mold.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(mold)}
                    className="text-blue-600 hover:text-blue-800"
                    title="Editar"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(mold.id)}
                    className="text-red-600 hover:text-red-800"
                    title="Excluir"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-700">
                {mold.section_width_meters && mold.section_height_meters && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Seção:</span>
                    <span className="font-medium">
                      {mold.section_width_meters}m × {mold.section_height_meters}m
                    </span>
                  </div>
                )}
                {mold.reference_measurement_meters && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Medida Ref:</span>
                    <span className="font-medium">{mold.reference_measurement_meters}m</span>
                  </div>
                )}
                {mold.reference_volume_m3 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Volume Ref:</span>
                    <span className="font-medium">{mold.reference_volume_m3}m³</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!showForm && molds.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Box className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Nenhuma fôrma cadastrada</p>
          <p className="text-sm text-gray-500 mt-2">
            Clique em "Nova Fôrma" para começar
          </p>
        </div>
      )}
    </div>
  );
}
