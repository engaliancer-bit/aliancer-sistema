import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Material {
  id: string;
  name: string;
  unit: string;
  unit_cost?: number;
}

interface Accessory {
  id: string;
  accessory_type: 'threaded_bar' | 'release_agent' | 'cloth' | 'other';
  material_id?: string;
  description: string;
  quantity: number;
  unit: string;
  bar_diameter_mm?: number;
  bar_length_meters?: number;
  notes: string;
  materials?: Material;
}

interface Props {
  productId: string;
  isVisible: boolean;
}

const ACCESSORY_TYPES = [
  { value: 'threaded_bar', label: 'Barra Roscada' },
  { value: 'release_agent', label: 'Desmoldante' },
  { value: 'cloth', label: 'Estopa' },
  { value: 'other', label: 'Outro' },
];

export default function ProductAccessoriesManager({ productId, isVisible }: Props) {
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    accessory_type: 'threaded_bar' as 'threaded_bar' | 'release_agent' | 'cloth' | 'other',
    material_id: '',
    description: '',
    quantity: '',
    unit: 'unid',
    bar_diameter_mm: '',
    bar_length_meters: '',
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
      const [accessoriesRes, materialsRes] = await Promise.all([
        supabase
          .from('product_accessories')
          .select('*, materials(id, name, unit, unit_cost)')
          .eq('product_id', productId)
          .order('accessory_type'),
        supabase
          .from('materials')
          .select('id, name, unit, unit_cost')
          .order('name'),
      ]);

      if (accessoriesRes.error) throw accessoriesRes.error;
      if (materialsRes.error) throw materialsRes.error;

      setAccessories(accessoriesRes.data || []);
      setMaterials(materialsRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.description || !formData.quantity) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      const accessoryData: any = {
        product_id: productId,
        accessory_type: formData.accessory_type,
        description: formData.description,
        quantity: parseFloat(formData.quantity),
        unit: formData.unit,
        notes: formData.notes,
      };

      if (formData.material_id && formData.material_id.trim() !== '') {
        accessoryData.material_id = formData.material_id;
      } else {
        accessoryData.material_id = null;
      }

      if (formData.bar_diameter_mm) {
        accessoryData.bar_diameter_mm = parseFloat(formData.bar_diameter_mm);
      }

      if (formData.bar_length_meters) {
        accessoryData.bar_length_meters = parseFloat(formData.bar_length_meters);
      }

      if (editingId) {
        const { error } = await supabase
          .from('product_accessories')
          .update(accessoryData)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('product_accessories')
          .insert([accessoryData]);

        if (error) throw error;
      }

      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Erro ao salvar acessório:', error);
      alert(`Erro ao salvar acessório: ${error.message}`);
    }
  };

  const handleEdit = (accessory: Accessory) => {
    setFormData({
      accessory_type: accessory.accessory_type,
      material_id: accessory.material_id || '',
      description: accessory.description,
      quantity: accessory.quantity.toString(),
      unit: accessory.unit,
      bar_diameter_mm: accessory.bar_diameter_mm?.toString() || '',
      bar_length_meters: accessory.bar_length_meters?.toString() || '',
      notes: accessory.notes || '',
    });
    setEditingId(accessory.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este acessório?')) return;

    try {
      const { error } = await supabase
        .from('product_accessories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Erro ao excluir acessório:', error);
      alert('Erro ao excluir acessório');
    }
  };

  const resetForm = () => {
    setFormData({
      accessory_type: 'threaded_bar',
      material_id: '',
      description: '',
      quantity: '',
      unit: 'unid',
      bar_diameter_mm: '',
      bar_length_meters: '',
      notes: '',
    });
    setEditingId(null);
  };

  const isBarType = () => {
    return formData.accessory_type === 'threaded_bar';
  };

  const calculateAccessoriesCost = () => {
    let totalCost = 0;
    const breakdown: Array<{
      name: string,
      type: string,
      quantity: number,
      unit: string,
      material?: string,
      unitCost?: number,
      total: number,
      notes?: string
    }> = [];

    accessories.forEach(accessory => {
      const typeName =
        accessory.accessory_type === 'threaded_bar' ? 'Barra Roscada' :
        accessory.accessory_type === 'release_agent' ? 'Desmoldante' :
        accessory.accessory_type === 'cloth' ? 'Pano' :
        'Outro';

      const item: any = {
        name: accessory.description,
        type: typeName,
        quantity: accessory.quantity,
        unit: accessory.unit,
        total: 0
      };

      if (accessory.notes) {
        item.notes = accessory.notes;
      }

      if (accessory.materials) {
        item.material = accessory.materials.name;
        if (accessory.materials.unit_cost) {
          item.unitCost = accessory.materials.unit_cost;
          const cost = accessory.quantity * accessory.materials.unit_cost;
          item.total = cost;
          totalCost += cost;
        }
      }

      breakdown.push(item);
    });

    return { totalCost, breakdown };
  };

  const accessoriesCost = calculateAccessoriesCost();

  if (!isVisible) return null;

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-4 mt-4">
      <h4 className="text-sm font-semibold text-gray-800 mb-3">
        Acessórios e Materiais Auxiliares
      </h4>

      <form onSubmit={handleSubmit} className="space-y-3 bg-white p-4 rounded border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Tipo de Acessório *
            </label>
            <select
              value={formData.accessory_type}
              onChange={(e) => setFormData({ ...formData, accessory_type: e.target.value as any })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              {ACCESSORY_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
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
              {materials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name} ({material.unit})
                  {material.unit_cost ? ` - R$ ${material.unit_cost.toFixed(2)}/${material.unit}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Descrição *
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Descreva o acessório ou material"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Quantidade *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ex: 2"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Unidade *
            </label>
            <select
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="unid">Unidade</option>
              <option value="kg">Quilograma (kg)</option>
              <option value="g">Grama (g)</option>
              <option value="l">Litro (l)</option>
              <option value="ml">Mililitro (ml)</option>
              <option value="m">Metro (m)</option>
            </select>
          </div>

          {isBarType() && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Diâmetro (mm)
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

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Comprimento (m)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.bar_length_meters}
                  onChange={(e) => setFormData({ ...formData, bar_length_meters: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: 0.5, 1.0"
                />
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
            </>
          )}
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
      ) : accessories.length === 0 ? (
        <div className="text-center py-4 text-sm text-gray-500">
          Nenhum acessório configurado ainda
        </div>
      ) : (
        <div className="space-y-2">
          <h5 className="text-xs font-semibold text-gray-700">Acessórios Configurados:</h5>
          {accessories.map((accessory) => (
            <div
              key={accessory.id}
              className="bg-white border border-gray-200 rounded p-3 flex items-center justify-between text-sm"
            >
              <div className="flex-1">
                <div className="font-medium text-gray-900">
                  {ACCESSORY_TYPES.find(t => t.value === accessory.accessory_type)?.label}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {accessory.description}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  <span className="font-semibold text-green-600">
                    {accessory.quantity} {accessory.unit}
                  </span>
                  {accessory.bar_diameter_mm && (
                    <span className="ml-2">Ø {accessory.bar_diameter_mm}mm</span>
                  )}
                  {accessory.bar_length_meters && (
                    <span className="ml-2">× {accessory.bar_length_meters}m</span>
                  )}
                  {accessory.materials && (
                    <span className="ml-2 text-blue-600">
                      (Estoque: {accessory.materials.name})
                    </span>
                  )}
                </div>
                {accessory.notes && (
                  <div className="text-xs text-gray-500 mt-1">
                    Obs: {accessory.notes}
                  </div>
                )}
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => handleEdit(accessory)}
                  className="text-blue-600 hover:text-blue-900"
                  title="Editar"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(accessory.id)}
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

      {accessoriesCost.breakdown.length > 0 && (
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-5 shadow-sm">
          <h5 className="text-base font-bold text-green-900 mb-4 flex items-center gap-2">
            📋 Memorial de Cálculo - Acessórios e Materiais Auxiliares
          </h5>
          <div className="space-y-3">
            {accessoriesCost.breakdown.map((item, index) => (
              <div key={index} className="bg-white rounded-lg p-4 shadow-sm border border-green-200">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="font-bold text-gray-900 text-sm mb-1">{item.name}</div>
                    <div className="text-xs text-green-700 font-medium">
                      {item.type}
                    </div>
                    {item.material && (
                      <div className="text-xs text-gray-600 mt-1">
                        Material: {item.material}
                      </div>
                    )}
                    {item.notes && (
                      <div className="text-xs text-gray-500 mt-1 italic">
                        {item.notes}
                      </div>
                    )}
                  </div>
                  {item.unitCost && (
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">
                        R$ {item.total.toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-200">
                  <div className="text-center">
                    <div className="text-xs text-gray-500">Quantidade</div>
                    <div className="font-semibold text-gray-900">{item.quantity.toFixed(2)} {item.unit}</div>
                  </div>
                  {item.unitCost && (
                    <div className="text-center">
                      <div className="text-xs text-gray-500">Preço Unit.</div>
                      <div className="font-semibold text-green-700">R$ {item.unitCost.toFixed(2)}/{item.unit}</div>
                    </div>
                  )}
                </div>

                {item.unitCost && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="text-xs text-gray-600 text-center">
                      <span className="font-medium">{item.quantity.toFixed(2)} {item.unit}</span>
                      {' × '}
                      <span className="font-medium">R$ {item.unitCost.toFixed(2)}/{item.unit}</span>
                      {' = '}
                      <span className="font-bold text-green-600">R$ {item.total.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {accessoriesCost.totalCost > 0 && (
              <div className="bg-green-600 text-white rounded-lg p-4 mt-4 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-lg">CUSTO TOTAL DE ACESSÓRIOS:</span>
                  <span className="font-bold text-2xl">
                    R$ {accessoriesCost.totalCost.toFixed(2)}
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
