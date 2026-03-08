import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Settings } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Material {
  id: string;
  name: string;
  unit: string;
  unit_cost?: number;
  cost_per_meter?: number;
  unit_length_meters?: number;
}

interface Reinforcement {
  id: string;
  reinforcement_type: 'longitudinal' | 'transversal' | 'lifting_hooks' | 'threaded_bar_hooks';
  material_id?: string;
  bar_count: number;
  bar_length_meters: number;
  total_length_meters: number;
  bar_diameter_mm?: number;
  longitudinal_position?: 'superior' | 'middle' | 'inferior';
  description?: string;
  notes: string;
  is_standard_pattern?: boolean;
  materials?: Material;
}

interface Product {
  id: string;
  length: number;
  mold_id?: string;
}

interface Props {
  productId: string;
  isVisible: boolean;
}

export default function ProductReinforcementManager({ productId, isVisible }: Props) {
  const [reinforcements, setReinforcements] = useState<Reinforcement[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [autoFilledMessage, setAutoFilledMessage] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    reinforcement_type: 'longitudinal' as 'longitudinal' | 'transversal' | 'lifting_hooks' | 'threaded_bar_hooks',
    material_id: '',
    bar_count: '',
    bar_length_meters: '',
    bar_diameter_mm: '',
    longitudinal_position: '' as '' | 'superior' | 'middle' | 'inferior',
    description: '',
    notes: '',
  });

  useEffect(() => {
    if (isVisible && productId) {
      loadData();
    }
  }, [productId, isVisible]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [reinforcementsRes, materialsRes, productRes] = await Promise.all([
        supabase
          .from('product_reinforcements')
          .select('*, materials(id, name, unit, unit_cost, cost_per_meter, unit_length_meters)')
          .eq('product_id', productId)
          .order('reinforcement_type'),
        supabase
          .from('materials')
          .select('id, name, unit, unit_cost, cost_per_meter, unit_length_meters')
          .order('name'),
        supabase
          .from('products')
          .select('id, length, mold_id')
          .eq('id', productId)
          .single(),
      ]);

      if (reinforcementsRes.error) throw reinforcementsRes.error;
      if (materialsRes.error) throw materialsRes.error;
      if (productRes.error) throw productRes.error;

      setReinforcements(reinforcementsRes.data || []);
      setMaterials(materialsRes.data || []);
      setProduct(productRes.data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleStandardPattern = async (reinforcementId: string) => {
    try {
      const currentReinforcement = reinforcements.find(r => r.id === reinforcementId);
      if (!currentReinforcement) return;

      const newStandardValue = !currentReinforcement.is_standard_pattern;

      if (newStandardValue) {
        const otherTransversal = reinforcements.filter(
          r => r.reinforcement_type === 'transversal' && r.id !== reinforcementId && r.is_standard_pattern
        );

        for (const other of otherTransversal) {
          await supabase
            .from('product_reinforcements')
            .update({ is_standard_pattern: false })
            .eq('id', other.id);
        }
      }

      const { error } = await supabase
        .from('product_reinforcements')
        .update({ is_standard_pattern: newStandardValue })
        .eq('id', reinforcementId);

      if (error) throw error;

      await loadData();

      if (newStandardValue) {
        alert('Estribo marcado como padrão! Use este como referência para cálculos proporcionais.');
      } else {
        alert('Estribo desmarcado como padrão.');
      }
    } catch (error) {
      console.error('Erro ao alternar padrão:', error);
      alert('Erro ao alterar o estribo padrão');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    console.log('=== INÍCIO DO SUBMIT ===');
    console.log('Event:', e);
    console.log('productId recebido:', productId);
    console.log('formData:', formData);

    if (!productId) {
      console.error('productId está vazio!');
      alert('Erro: ID do produto não encontrado. Salve o produto primeiro.');
      return;
    }

    if (!formData.bar_count || !formData.bar_length_meters) {
      console.error('Campos obrigatórios vazios:', { bar_count: formData.bar_count, bar_length_meters: formData.bar_length_meters });
      alert('Preencha todos os campos obrigatórios (Quantidade e Comprimento)');
      return;
    }

    try {
      const barCount = parseFloat(formData.bar_count);
      const barLength = parseFloat(formData.bar_length_meters);

      console.log('barCount:', barCount, 'barLength:', barLength);

      if (isNaN(barCount) || isNaN(barLength) || barCount <= 0 || barLength <= 0) {
        console.error('Valores numéricos inválidos');
        alert('Quantidade de barras e comprimento devem ser valores numéricos positivos');
        return;
      }

      const totalLength = barCount * barLength;

      const reinforcementData: any = {
        product_id: productId,
        reinforcement_type: formData.reinforcement_type,
        bar_count: barCount,
        bar_length_meters: barLength,
        total_length_meters: totalLength,
        description: formData.description || '',
        notes: formData.notes || '',
      };

      if (formData.material_id && formData.material_id.trim() !== '') {
        reinforcementData.material_id = formData.material_id;
      }

      if (formData.bar_diameter_mm && formData.bar_diameter_mm.trim() !== '') {
        const diameter = parseFloat(formData.bar_diameter_mm);
        if (!isNaN(diameter) && diameter > 0) {
          reinforcementData.bar_diameter_mm = diameter;
        }
      }

      if (formData.reinforcement_type === 'longitudinal' && formData.longitudinal_position && formData.longitudinal_position.trim() !== '') {
        reinforcementData.longitudinal_position = formData.longitudinal_position;
      }

      console.log('=== DADOS A SEREM SALVOS ===');
      console.log(JSON.stringify(reinforcementData, null, 2));

      if (editingId) {
        console.log('Atualizando armadura:', editingId);
        const { data, error } = await supabase
          .from('product_reinforcements')
          .update(reinforcementData)
          .eq('id', editingId)
          .select();

        if (error) {
          console.error('=== ERRO DO SUPABASE (UPDATE) ===');
          console.error('Error object:', error);
          console.error('Error message:', error.message);
          console.error('Error details:', error.details);
          console.error('Error hint:', error.hint);
          throw error;
        }
        console.log('=== SUCESSO (UPDATE) ===');
        console.log('Dados retornados:', data);
      } else {
        console.log('Inserindo nova armadura');
        const { data, error } = await supabase
          .from('product_reinforcements')
          .insert([reinforcementData])
          .select();

        if (error) {
          console.error('=== ERRO DO SUPABASE (INSERT) ===');
          console.error('Error object:', error);
          console.error('Error message:', error.message);
          console.error('Error details:', error.details);
          console.error('Error hint:', error.hint);
          throw error;
        }
        console.log('=== SUCESSO (INSERT) ===');
        console.log('Dados retornados:', data);
      }

      console.log('Chamando resetForm...');
      resetForm();
      console.log('Chamando loadData...');
      await loadData();
      console.log('Mostrando alert de sucesso...');
      alert(editingId ? 'Armadura atualizada com sucesso!' : 'Armadura adicionada com sucesso!');
      console.log('=== FIM DO SUBMIT (SUCESSO) ===');
    } catch (error: any) {
      console.error('=== ERRO CAPTURADO NO CATCH ===');
      console.error('Error completo:', error);
      console.error('Error message:', error?.message);
      console.error('Error stack:', error?.stack);
      console.error('Error name:', error?.name);
      alert(`Erro ao salvar armadura: ${error?.message || 'Erro desconhecido'}. Veja o console para mais detalhes.`);
    }
  };

  const handleEdit = (reinforcement: Reinforcement) => {
    setFormData({
      reinforcement_type: reinforcement.reinforcement_type,
      material_id: reinforcement.material_id || '',
      bar_count: reinforcement.bar_count.toString(),
      bar_length_meters: reinforcement.bar_length_meters.toString(),
      bar_diameter_mm: reinforcement.bar_diameter_mm?.toString() || '',
      longitudinal_position: reinforcement.longitudinal_position || '',
      description: reinforcement.description || '',
      notes: reinforcement.notes || '',
    });
    setEditingId(reinforcement.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta armadura?')) return;

    try {
      const { error } = await supabase
        .from('product_reinforcements')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Erro ao excluir armadura:', error);
      alert('Erro ao excluir armadura');
    }
  };

  const resetForm = () => {
    setFormData({
      reinforcement_type: 'longitudinal',
      material_id: '',
      bar_count: '',
      bar_length_meters: '',
      bar_diameter_mm: '',
      longitudinal_position: '',
      description: '',
      notes: '',
    });
    setEditingId(null);
    setAutoFilledMessage(null);
  };

  const applyTransversalAutoFill = () => {
    const existingTransversal = reinforcements.find(r => r.reinforcement_type === 'transversal');

    if (!existingTransversal) {
      console.log('[AutoFill] Nenhuma armadura transversal existente encontrada');
      return false;
    }

    console.log('[AutoFill] Armadura transversal encontrada:', existingTransversal);

    const materialName = materials.find(m => m.id === existingTransversal.material_id)?.name;
    const diameterValue = existingTransversal.bar_diameter_mm;

    console.log('[AutoFill] Aplicando:', {
      material_id: existingTransversal.material_id,
      materialName,
      bar_diameter_mm: diameterValue
    });

    setFormData(prev => ({
      ...prev,
      material_id: existingTransversal.material_id || '',
      bar_diameter_mm: existingTransversal.bar_diameter_mm?.toString() || '',
    }));

    let message = 'Material e diâmetro preenchidos automaticamente baseado na primeira armadura transversal';
    if (materialName || diameterValue) {
      const parts = [];
      if (materialName) parts.push(`Material: ${materialName}`);
      if (diameterValue) parts.push(`Diâmetro: Ø ${diameterValue}mm`);
      message += ` (${parts.join(', ')})`;
    }
    setAutoFilledMessage(message);

    setTimeout(() => setAutoFilledMessage(null), 8000);

    return true;
  };

  const calculateTotalLength = () => {
    if (formData.bar_count && formData.bar_length_meters) {
      return (parseFloat(formData.bar_count) * parseFloat(formData.bar_length_meters)).toFixed(2);
    }
    return '0.00';
  };

  const calculateReinforcementsCost = () => {
    let totalCost = 0;
    const breakdown: Array<{
      name: string,
      barCount: number,
      barLength: number,
      totalLength: number,
      diameter?: number,
      position?: string,
      material?: string,
      unitCost?: number,
      total: number
    }> = [];

    reinforcements.forEach(reinforcement => {
      const typeName =
        reinforcement.reinforcement_type === 'longitudinal' ? 'Longitudinal' :
        reinforcement.reinforcement_type === 'transversal' ? 'Transversal' :
        reinforcement.reinforcement_type === 'lifting_hooks' ? 'Içamento' :
        'Ganchos Barra Roscada';

      const positionText = reinforcement.longitudinal_position === 'superior' ? '(Superior)' :
        reinforcement.longitudinal_position === 'middle' ? '(Meio)' :
        reinforcement.longitudinal_position === 'inferior' ? '(Inferior)' : '';

      const item: any = {
        name: `${typeName}${positionText}${reinforcement.description ? ' - ' + reinforcement.description : ''}`,
        barCount: reinforcement.bar_count,
        barLength: reinforcement.bar_length_meters,
        totalLength: reinforcement.total_length_meters,
        total: 0
      };

      if (reinforcement.bar_diameter_mm) {
        item.diameter = reinforcement.bar_diameter_mm;
      }

      if (reinforcement.materials) {
        item.material = reinforcement.materials.name;
        const costPerMeter = reinforcement.materials.unit_cost || reinforcement.materials.cost_per_meter;
        if (costPerMeter) {
          item.unitCost = costPerMeter;
          const cost = reinforcement.total_length_meters * costPerMeter;
          item.total = cost;
          totalCost += cost;
        }
      }

      breakdown.push(item);
    });

    return { totalCost, breakdown };
  };

  const reinforcementsCost = calculateReinforcementsCost();

  if (!isVisible) return null;

  const transversalReinforcements = reinforcements.filter(r => r.reinforcement_type === 'transversal');
  const standardReinforcement = transversalReinforcements.find(r => r.is_standard_pattern);

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-4">
      <h4 className="text-sm font-semibold text-gray-800 mb-3">
        Configuração de Armaduras (Pré-Moldado)
      </h4>

      {transversalReinforcements.length > 0 && (
        <div className="bg-white border border-blue-300 rounded-lg p-4 mb-4">
          <h5 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Padrão de Estribos para Proporcionalidade
          </h5>
          <p className="text-xs text-gray-600 mb-3">
            Marque qual estribo transversal será usado como padrão de referência para cálculos proporcionais.
            Apenas um pode ser marcado por vez.
          </p>

          <div className="space-y-2">
            {transversalReinforcements.map((reinforcement) => {
              const material = reinforcement.materials;
              const isStandard = reinforcement.is_standard_pattern;

              return (
                <div
                  key={reinforcement.id}
                  className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                    isStandard
                      ? 'bg-blue-50 border-blue-400'
                      : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isStandard || false}
                        onChange={() => toggleStandardPattern(reinforcement.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-xs font-medium text-gray-700">
                        {isStandard ? 'PADRÃO' : 'Marcar como padrão'}
                      </span>
                    </label>

                    <div className="flex-1">
                      <div className="text-xs font-medium text-gray-900">
                        {reinforcement.bar_count} estribos × {reinforcement.bar_length_meters}m
                        {reinforcement.bar_diameter_mm && ` • Ø ${reinforcement.bar_diameter_mm}mm`}
                      </div>
                      {material && (
                        <div className="text-xs text-gray-600">
                          Material: {material.name}
                        </div>
                      )}
                      {reinforcement.description && (
                        <div className="text-xs text-gray-500">
                          {reinforcement.description}
                        </div>
                      )}
                    </div>
                  </div>

                  {isStandard && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                      <span>✓</span>
                      Referência
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {standardReinforcement && product && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800">
                <strong>Padrão configurado:</strong> {standardReinforcement.bar_count} estribos
                para {product.length}m de comprimento
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Espaçamento: {((product.length * 100) / standardReinforcement.bar_count).toFixed(2)} cm entre estribos
              </p>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 bg-white p-4 rounded border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Tipo de Armadura *
            </label>
            <select
              value={formData.reinforcement_type}
              onChange={(e) => {
                const newType = e.target.value as 'longitudinal' | 'transversal' | 'lifting_hooks' | 'threaded_bar_hooks';

                console.log('[Select onChange] Tipo selecionado:', newType);
                console.log('[Select onChange] editingId:', editingId);
                console.log('[Select onChange] Armaduras existentes:', reinforcements.length);

                setAutoFilledMessage(null);

                setFormData(prev => ({
                  ...prev,
                  reinforcement_type: newType
                }));

                if (newType === 'transversal' && !editingId) {
                  console.log('[Select onChange] Tentando aplicar auto-fill...');
                  setTimeout(() => {
                    applyTransversalAutoFill();
                  }, 50);
                }
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="longitudinal">Longitudinal (Principal)</option>
              <option value="transversal">Transversal (Estribos)</option>
              <option value="lifting_hooks">Armadura de Içamento</option>
              <option value="threaded_bar_hooks">Ganchos da Barra Roscada</option>
            </select>
            {autoFilledMessage && (
              <div className="mt-2 text-xs bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg flex items-start gap-2">
                <span className="flex-shrink-0 mt-0.5">✓</span>
                <span>{autoFilledMessage}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Descrição
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ex: CA-50, CA-60, etc."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Número de Barras *
            </label>
            <input
              type="number"
              step="1"
              min="0"
              value={formData.bar_count}
              onChange={(e) => setFormData({ ...formData, bar_count: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ex: 4"
              required
            />
          </div>


          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Comprimento por Barra (m) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.bar_length_meters}
              onChange={(e) => setFormData({ ...formData, bar_length_meters: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ex: 2.5"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Diâmetro da Barra (mm)
            </label>
            <select
              value={formData.bar_diameter_mm}
              onChange={(e) => setFormData({ ...formData, bar_diameter_mm: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Selecione o diâmetro</option>
              <optgroup label="CA 60 (Fios)">
                <option value="4.2">Ø 4.2mm - CA 60</option>
                <option value="5.0">Ø 5.0mm - CA 60</option>
                <option value="6.0">Ø 6.0mm - CA 60</option>
              </optgroup>
              <optgroup label="CA 50 (Barras)">
                <option value="6.3">Ø 6.3mm - CA 50</option>
                <option value="8.0">Ø 8.0mm - CA 50</option>
                <option value="10.0">Ø 10.0mm - CA 50</option>
                <option value="12.5">Ø 12.5mm - CA 50</option>
                <option value="16.0">Ø 16.0mm - CA 50</option>
                <option value="20.0">Ø 20.0mm - CA 50</option>
                <option value="25.0">Ø 25.0mm - CA 50</option>
                <option value="32.0">Ø 32.0mm - CA 50</option>
              </optgroup>
            </select>
            {formData.bar_diameter_mm && (
              <div className="mt-2 text-xs font-medium">
                {['4.2', '5.0', '6.0'].includes(formData.bar_diameter_mm) ? (
                  <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded">
                    Tipo: CA 60 (Fio)
                  </span>
                ) : ['6.3', '8.0', '10.0', '12.5', '16.0', '20.0', '25.0', '32.0'].includes(formData.bar_diameter_mm) ? (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                    Tipo: CA 50 (Barra)
                  </span>
                ) : null}
              </div>
            )}
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-orange-50 border border-gray-300 rounded-lg p-3">
            <div className="text-xs font-bold text-gray-800 mb-2 flex items-center gap-1">
              <span className="text-blue-600">ℹ️</span> Referência de Diâmetros
            </div>
            <div className="space-y-1">
              <div className="text-[10px] font-semibold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded">
                CA 60 - Fios
              </div>
              <div className="text-[10px] text-gray-700 pl-2">
                • 4.2mm, 5.0mm, 6.0mm
              </div>
              <div className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded mt-1.5">
                CA 50 - Barras
              </div>
              <div className="text-[10px] text-gray-700 pl-2">
                • 6.3mm, 8.0mm, 10.0mm
              </div>
              <div className="text-[10px] text-gray-700 pl-2">
                • 12.5mm, 16mm, 20mm
              </div>
              <div className="text-[10px] text-gray-700 pl-2">
                • 25mm, 32mm
              </div>
            </div>
          </div>

          {formData.reinforcement_type === 'longitudinal' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Posição Longitudinal
              </label>
              <select
                value={formData.longitudinal_position}
                onChange={(e) => setFormData({ ...formData, longitudinal_position: e.target.value as '' | 'superior' | 'middle' | 'inferior' })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Não especificado</option>
                <option value="superior">Superior</option>
                <option value="middle">Intermediária (Pele)</option>
                <option value="inferior">Inferior</option>
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Material do Estoque (Opcional)
          </label>
          <select
            value={formData.material_id}
            onChange={(e) => setFormData({ ...formData, material_id: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Nenhum material vinculado</option>
            {materials.map((material) => {
              const costPerMeter = material.unit_cost || material.cost_per_meter;
              const displayUnit = material.unit;
              return (
                <option key={material.id} value={material.id}>
                  {material.name} ({material.unit})
                  {costPerMeter ? ` - R$ ${costPerMeter.toFixed(4)}/${displayUnit}` : ''}
                  {material.unit_length_meters && (
                    ` (Barra de ${material.unit_length_meters}m)`
                  )}
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Observações
          </label>
          <input
            type="text"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Observações adicionais"
          />
        </div>

        {(formData.bar_count && formData.bar_length_meters) && (
          <div className="bg-blue-50 border border-blue-200 rounded p-2">
            <p className="text-xs text-gray-700">
              <span className="font-semibold">Comprimento Total:</span> {calculateTotalLength()} metros
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 bg-green-600 text-white px-4 py-2 text-sm rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
          >
            {editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {editingId ? 'Atualizar' : 'Adicionar'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <div className="text-center py-4 text-sm text-gray-500">Carregando...</div>
      ) : reinforcements.length === 0 ? (
        <div className="text-center py-4 text-sm text-gray-500">
          Nenhuma armadura configurada ainda
        </div>
      ) : (
        <div className="space-y-2">
          <h5 className="text-xs font-semibold text-gray-700">Armaduras Configuradas:</h5>
          {reinforcements.map((reinforcement) => (
            <div
              key={reinforcement.id}
              className="bg-white border border-gray-200 rounded p-3 flex items-center justify-between text-sm"
            >
              <div className="flex-1">
                <div className="font-medium text-gray-900">
                  {reinforcement.reinforcement_type === 'longitudinal' && '🔸 Longitudinal'}
                  {reinforcement.reinforcement_type === 'transversal' && '🔹 Transversal'}
                  {reinforcement.reinforcement_type === 'lifting_hooks' && '🪝 Armadura de Içamento'}
                  {reinforcement.reinforcement_type === 'threaded_bar_hooks' && '🔩 Ganchos da Barra Roscada'}
                  {reinforcement.longitudinal_position && (
                    <span className="ml-2 text-xs font-normal text-blue-600">
                      ({reinforcement.longitudinal_position === 'superior' ? 'Superior' :
                        reinforcement.longitudinal_position === 'middle' ? 'Intermediária (Pele)' : 'Inferior'})
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {reinforcement.description && (
                    <span className="font-medium text-gray-800">{reinforcement.description}</span>
                  )}
                  {reinforcement.bar_diameter_mm && (
                    <span className={reinforcement.description ? 'ml-2' : ''}>
                      Ø {reinforcement.bar_diameter_mm}mm
                    </span>
                  )}
                  {(reinforcement.description || reinforcement.bar_diameter_mm) && ' - '}
                  {reinforcement.bar_count} barras × {reinforcement.bar_length_meters}m =
                  <span className="font-semibold text-blue-600 ml-1">
                    {reinforcement.total_length_meters.toFixed(2)}m total
                  </span>
                  {reinforcement.materials && (
                    <span className="ml-2 text-blue-600">
                      (Estoque: {reinforcement.materials.name})
                    </span>
                  )}
                </div>
                {reinforcement.notes && (
                  <div className="text-xs text-gray-500 mt-1">
                    Obs: {reinforcement.notes}
                  </div>
                )}
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => handleEdit(reinforcement)}
                  className="text-blue-600 hover:text-blue-900"
                  title="Editar"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(reinforcement.id)}
                  className="text-red-600 hover:text-red-900"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {reinforcementsCost.breakdown.length > 0 && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg p-5 shadow-sm">
          <h5 className="text-base font-bold text-blue-900 mb-4 flex items-center gap-2">
            📋 Memorial de Cálculo - Armaduras
          </h5>
          <div className="space-y-3">
            {reinforcementsCost.breakdown.map((item, index) => (
              <div key={index} className="bg-white rounded-lg p-4 shadow-sm border border-blue-200">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="font-bold text-gray-900 text-sm mb-1">{item.name}</div>
                    {item.diameter && (
                      <div className="text-xs text-blue-700 font-medium">
                        Ø {item.diameter} mm
                      </div>
                    )}
                    {item.material && (
                      <div className="text-xs text-gray-600 mt-1">
                        Material: {item.material}
                      </div>
                    )}
                  </div>
                  {item.unitCost && (
                    <div className="text-right">
                      <div className="text-lg font-bold text-blue-600">
                        R$ {item.total.toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-200">
                  <div className="text-center">
                    <div className="text-xs text-gray-500">Qtd. Barras</div>
                    <div className="font-semibold text-gray-900">{item.barCount}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500">Comp. Unit.</div>
                    <div className="font-semibold text-gray-900">{item.barLength.toFixed(2)}m</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500">Comp. Total</div>
                    <div className="font-semibold text-blue-700">{item.totalLength.toFixed(2)}m</div>
                  </div>
                </div>

                {item.unitCost && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="text-xs text-gray-600 text-center">
                      <span className="font-medium">{item.totalLength.toFixed(2)}m</span>
                      {' × '}
                      <span className="font-medium">R$ {item.unitCost.toFixed(2)}/m</span>
                      {' = '}
                      <span className="font-bold text-blue-600">R$ {item.total.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {reinforcementsCost.totalCost > 0 && (
              <div className="bg-blue-600 text-white rounded-lg p-4 mt-4 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-lg">CUSTO TOTAL DE ARMADURAS:</span>
                  <span className="font-bold text-2xl">
                    R$ {reinforcementsCost.totalCost.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
