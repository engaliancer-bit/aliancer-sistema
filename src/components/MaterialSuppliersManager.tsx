import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Supplier {
  id: string;
  name: string;
  phone: string;
  email: string;
}

interface MaterialSupplier {
  id: string;
  supplier_id: string;
  is_primary: boolean;
  unit_cost: number;
  notes: string;
  suppliers?: Supplier;
}

interface Props {
  materialId: string;
  materialName: string;
  isVisible: boolean;
  onClose: () => void;
}

export default function MaterialSuppliersManager({ materialId, materialName, isVisible, onClose }: Props) {
  const [materialSuppliers, setMaterialSuppliers] = useState<MaterialSupplier[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    supplier_id: '',
    is_primary: false,
    unit_cost: '',
    notes: '',
  });

  useEffect(() => {
    if (isVisible && materialId) {
      loadData();
    }
  }, [materialId, isVisible]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [materialSuppliersRes, suppliersRes] = await Promise.all([
        supabase
          .from('material_suppliers')
          .select('*, suppliers(id, name, phone, email)')
          .eq('material_id', materialId)
          .order('is_primary', { ascending: false }),
        supabase
          .from('suppliers')
          .select('id, name, phone, email')
          .order('name'),
      ]);

      if (materialSuppliersRes.error) throw materialSuppliersRes.error;
      if (suppliersRes.error) throw suppliersRes.error;

      setMaterialSuppliers(materialSuppliersRes.data || []);
      setSuppliers(suppliersRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.supplier_id) {
      alert('Selecione um fornecedor');
      return;
    }

    try {
      const supplierData = {
        material_id: materialId,
        supplier_id: formData.supplier_id,
        is_primary: formData.is_primary,
        unit_cost: formData.unit_cost ? parseFloat(formData.unit_cost) : 0,
        notes: formData.notes,
      };

      if (formData.is_primary) {
        await supabase
          .from('material_suppliers')
          .update({ is_primary: false })
          .eq('material_id', materialId)
          .neq('id', editingId || '');
      }

      if (editingId) {
        const { error } = await supabase
          .from('material_suppliers')
          .update(supplierData)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('material_suppliers')
          .insert([supplierData]);

        if (error) throw error;
      }

      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Erro ao salvar fornecedor:', error);
      if (error.code === '23505') {
        alert('Este fornecedor já está cadastrado para este insumo');
      } else {
        alert(`Erro ao salvar fornecedor: ${error.message}`);
      }
    }
  };

  const handleEdit = (materialSupplier: MaterialSupplier) => {
    setFormData({
      supplier_id: materialSupplier.supplier_id,
      is_primary: materialSupplier.is_primary,
      unit_cost: materialSupplier.unit_cost.toString(),
      notes: materialSupplier.notes || '',
    });
    setEditingId(materialSupplier.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este fornecedor?')) return;

    try {
      const { error } = await supabase
        .from('material_suppliers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Erro ao excluir fornecedor:', error);
      alert('Erro ao excluir fornecedor');
    }
  };

  const handleSetPrimary = async (id: string) => {
    try {
      await supabase
        .from('material_suppliers')
        .update({ is_primary: false })
        .eq('material_id', materialId);

      const { error } = await supabase
        .from('material_suppliers')
        .update({ is_primary: true })
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Erro ao definir fornecedor principal:', error);
      alert('Erro ao definir fornecedor principal');
    }
  };

  const resetForm = () => {
    setFormData({
      supplier_id: '',
      is_primary: false,
      unit_cost: '',
      notes: '',
    });
    setEditingId(null);
  };

  if (!isVisible) return null;

  const availableSuppliers = suppliers.filter(
    s => !materialSuppliers.find(ms => ms.supplier_id === s.id) || editingId
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Fornecedores: {materialName}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-semibold text-gray-700">
              {editingId ? 'Editar Fornecedor' : 'Adicionar Fornecedor'}
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Fornecedor *
                </label>
                <select
                  value={formData.supplier_id}
                  onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  disabled={!!editingId}
                >
                  <option value="">Selecione um fornecedor</option>
                  {availableSuppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Custo Unitário (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.unit_cost}
                  onChange={(e) => setFormData({ ...formData, unit_cost: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>

              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_primary}
                    onChange={(e) => setFormData({ ...formData, is_primary: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Fornecedor Principal</span>
                </label>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Observações
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Observações sobre este fornecedor"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white px-4 py-2 text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
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
                  Cancelar
                </button>
              )}
            </div>
          </form>

          {loading ? (
            <div className="text-center py-4 text-sm text-gray-500">Carregando...</div>
          ) : materialSuppliers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhum fornecedor cadastrado ainda
            </div>
          ) : (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">Fornecedores Cadastrados:</h4>
              {materialSuppliers.map((ms) => (
                <div
                  key={ms.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className="font-semibold text-gray-900">
                          {ms.suppliers?.name}
                        </h5>
                        {ms.is_primary && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                            <Star className="w-3 h-3 fill-current" />
                            Principal
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        {ms.suppliers?.phone && (
                          <p>📱 {ms.suppliers.phone}</p>
                        )}
                        {ms.suppliers?.email && (
                          <p>📧 {ms.suppliers.email}</p>
                        )}
                        {ms.unit_cost > 0 && (
                          <p className="font-semibold text-green-600">
                            💰 R$ {ms.unit_cost.toFixed(2)} / unidade
                          </p>
                        )}
                        {ms.notes && (
                          <p className="text-xs text-gray-500">💬 {ms.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      {!ms.is_primary && (
                        <button
                          onClick={() => handleSetPrimary(ms.id)}
                          className="text-yellow-600 hover:text-yellow-900"
                          title="Definir como principal"
                        >
                          <Star className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(ms)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(ms.id)}
                        className="text-red-600 hover:text-red-900"
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
        </div>

        <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
