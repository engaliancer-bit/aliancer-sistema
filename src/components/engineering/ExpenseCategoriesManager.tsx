import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2, Save, X, Tag, Palette } from 'lucide-react';

interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
  is_custom: boolean;
  color: string | null;
  active: boolean;
  display_order: number;
}

const COLOR_OPTIONS = [
  { value: '#3B82F6', label: 'Azul' },
  { value: '#10B981', label: 'Verde' },
  { value: '#F59E0B', label: 'Amarelo' },
  { value: '#EF4444', label: 'Vermelho' },
  { value: '#8B5CF6', label: 'Roxo' },
  { value: '#EC4899', label: 'Rosa' },
  { value: '#14B8A6', label: 'Turquesa' },
  { value: '#F97316', label: 'Laranja' },
  { value: '#6B7280', label: 'Cinza' },
];

export default function ExpenseCategoriesManager() {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6'
  });

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('engineering_expense_categories')
        .select('*')
        .order('is_custom', { ascending: true })
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Nome da categoria é obrigatório');
      return;
    }

    try {
      if (editingCategory) {
        // Atualizar categoria existente
        const { error } = await supabase
          .from('engineering_expense_categories')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            color: formData.color
          })
          .eq('id', editingCategory.id);

        if (error) throw error;
        alert('Categoria atualizada com sucesso!');
      } else {
        // Criar nova categoria
        const { error } = await supabase
          .from('engineering_expense_categories')
          .insert({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            color: formData.color,
            is_custom: true,
            active: true
          });

        if (error) throw error;
        alert('Categoria criada com sucesso!');
      }

      resetForm();
      await loadCategories();
    } catch (error) {
      console.error('Erro ao salvar categoria:', error);
      alert('Erro ao salvar categoria');
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Deseja realmente excluir a categoria "${name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('engineering_expense_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('Categoria excluída com sucesso!');
      await loadCategories();
    } catch (error: any) {
      console.error('Erro ao excluir categoria:', error);
      if (error.code === '23503') {
        alert('Não é possível excluir esta categoria pois existem lançamentos vinculados a ela');
      } else {
        alert('Erro ao excluir categoria');
      }
    }
  }

  async function toggleActive(id: string, currentActive: boolean) {
    try {
      const { error } = await supabase
        .from('engineering_expense_categories')
        .update({ active: !currentActive })
        .eq('id', id);

      if (error) throw error;
      await loadCategories();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  }

  function startEdit(category: ExpenseCategory) {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      color: category.color || '#3B82F6'
    });
    setShowForm(true);
  }

  function resetForm() {
    setFormData({
      name: '',
      description: '',
      color: '#3B82F6'
    });
    setEditingCategory(null);
    setShowForm(false);
  }

  const customCategories = categories.filter(c => c.is_custom);
  const systemCategories = categories.filter(c => !c.is_custom);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Tag className="w-5 h-5 text-blue-600" />
            Categorias de Despesas
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Gerencie as categorias para organizar suas despesas
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          {showForm ? (
            <>
              <X className="w-4 h-4" />
              Cancelar
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Nova Categoria
            </>
          )}
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome da Categoria *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Aluguel, Energia, Telefonia..."
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descrição
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Descrição opcional da categoria"
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Cor
              </label>
              <div className="grid grid-cols-3 gap-2">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, color: color.value })}
                    className={`p-2 rounded-lg border-2 transition-all flex items-center gap-2 ${
                      formData.color === color.value
                        ? 'border-gray-900 shadow-md'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: color.value }}
                    />
                    <span className="text-xs text-gray-700">{color.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              type="submit"
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {editingCategory ? 'Salvar Alterações' : 'Criar Categoria'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Lista de Categorias */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Categorias do Sistema */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
              Categorias do Sistema
            </h3>
            <div className="space-y-2">
              {systemCategories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: category.color || '#6B7280' }}
                    />
                    <div>
                      <p className="font-medium text-gray-900">{category.name}</p>
                      {category.description && (
                        <p className="text-sm text-gray-600">{category.description}</p>
                      )}
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                    Sistema
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Categorias Customizadas */}
          {customCategories.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                Categorias Customizadas
              </h3>
              <div className="space-y-2">
                {customCategories.map((category) => (
                  <div
                    key={category.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      category.active
                        ? 'bg-white border-gray-200'
                        : 'bg-gray-50 border-gray-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: category.color || '#6B7280' }}
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{category.name}</p>
                        {category.description && (
                          <p className="text-sm text-gray-600">{category.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleActive(category.id, category.active)}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                          category.active
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                      >
                        {category.active ? 'Ativa' : 'Inativa'}
                      </button>

                      <button
                        onClick={() => startEdit(category)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4 text-blue-600" />
                      </button>

                      <button
                        onClick={() => handleDelete(category.id, category.name)}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {customCategories.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500">
              <Tag className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma categoria customizada criada</p>
              <p className="text-sm mt-1">Clique em "Nova Categoria" para começar</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
