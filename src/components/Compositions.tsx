import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Package, DollarSign, Save, X, Copy } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Material {
  id: string;
  name: string;
  unit: string;
  unit_cost: number;
  resale_enabled: boolean;
  resale_price: number;
}

interface Product {
  id: string;
  name: string;
  final_sale_price: number;
  unit: string;
}

interface CompositionItem {
  id?: string;
  composition_id?: string;
  item_type: 'product' | 'material' | 'service' | 'labor' | 'equipment';
  item_name: string;
  item_description: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  material_id?: string | null;
  product_id?: string | null;
}

interface Composition {
  id: string;
  name: string;
  description: string;
  total_cost: number;
  created_at: string;
}

export default function Compositions() {
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showItemForm, setShowItemForm] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  const [items, setItems] = useState<CompositionItem[]>([]);
  const [currentItem, setCurrentItem] = useState<CompositionItem>({
    item_type: 'material',
    item_name: '',
    item_description: '',
    quantity: 1,
    unit: 'un',
    unit_cost: 0,
    total_cost: 0,
    material_id: null,
    product_id: null,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [compositionsRes, materialsRes, productsRes] = await Promise.all([
        supabase
          .from('compositions')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('materials').select('id, name, unit, unit_cost, resale_enabled, resale_price').order('name'),
        supabase.from('products').select('id, name, unit, final_sale_price').order('name'),
      ]);

      if (compositionsRes.error) throw compositionsRes.error;
      if (materialsRes.error) throw materialsRes.error;
      if (productsRes.error) throw productsRes.error;

      setCompositions(compositionsRes.data || []);
      setMaterials(materialsRes.data || []);
      setProducts(productsRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      alert('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const loadCompositionItems = async (compositionId: string) => {
    try {
      const { data, error } = await supabase
        .from('composition_items')
        .select('*')
        .eq('composition_id', compositionId)
        .order('created_at');

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Erro ao carregar itens da composição:', error);
      alert('Erro ao carregar itens da composição');
    }
  };

  const handleItemTypeChange = (itemType: CompositionItem['item_type']) => {
    const defaultUnits = {
      product: 'un',
      material: 'un',
      service: 'un',
      labor: 'h',
      equipment: 'h',
    };

    setCurrentItem({
      ...currentItem,
      item_type: itemType,
      unit: defaultUnits[itemType],
      item_name: '',
      item_description: '',
      unit_cost: 0,
      material_id: null,
      product_id: null,
    });
  };

  const handleMaterialSelect = (materialId: string) => {
    const material = materials.find(m => m.id === materialId);
    if (material) {
      // Se for material de revenda, usa resale_price (com impostos inclusos)
      // Se for material de produção, usa unit_cost (custo sem impostos)
      const costToUse = material.resale_enabled ? material.resale_price : material.unit_cost;

      setCurrentItem({
        ...currentItem,
        material_id: materialId,
        product_id: null,
        item_name: material.name,
        unit: material.unit,
        unit_cost: costToUse,
        total_cost: currentItem.quantity * costToUse,
      });
    }
  };

  const handleProductSelect = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setCurrentItem({
        ...currentItem,
        product_id: productId,
        material_id: null,
        item_name: product.name,
        unit: product.unit,
        unit_cost: product.final_sale_price,
        total_cost: currentItem.quantity * product.final_sale_price,
      });
    }
  };

  const handleAddItem = () => {
    if (!currentItem.item_name) {
      alert('Informe o nome do item');
      return;
    }
    if (currentItem.quantity <= 0) {
      alert('Quantidade deve ser maior que zero');
      return;
    }
    if (currentItem.unit_cost < 0) {
      alert('Custo unitário não pode ser negativo');
      return;
    }

    const totalCost = currentItem.quantity * currentItem.unit_cost;
    const newItem = { ...currentItem, total_cost: totalCost };

    setItems([...items, newItem]);
    setCurrentItem({
      item_type: 'material',
      item_name: '',
      item_description: '',
      quantity: 1,
      unit: 'un',
      unit_cost: 0,
      total_cost: 0,
      material_id: null,
      product_id: null,
    });
    setShowItemForm(false);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      alert('Informe o nome da composição');
      return;
    }

    if (items.length === 0) {
      alert('Adicione pelo menos um item à composição');
      return;
    }

    try {
      const totalCost = items.reduce((sum, item) => sum + item.total_cost, 0);

      if (editingId) {
        const { error: compError } = await supabase
          .from('compositions')
          .update({
            name: formData.name,
            description: formData.description,
            total_cost: totalCost,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);

        if (compError) throw compError;

        await supabase
          .from('composition_items')
          .delete()
          .eq('composition_id', editingId);

        const itemsToInsert = items.map(item => ({
          composition_id: editingId,
          item_type: item.item_type,
          item_name: item.item_name,
          item_description: item.item_description,
          quantity: item.quantity,
          unit: item.unit,
          unit_cost: item.unit_cost,
          total_cost: item.total_cost,
          material_id: item.material_id,
          product_id: item.product_id,
        }));

        const { error: itemsError } = await supabase
          .from('composition_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      } else {
        const { data: compData, error: compError } = await supabase
          .from('compositions')
          .insert([
            {
              name: formData.name,
              description: formData.description,
              total_cost: totalCost,
            },
          ])
          .select()
          .single();

        if (compError) throw compError;

        const itemsToInsert = items.map(item => ({
          composition_id: compData.id,
          item_type: item.item_type,
          item_name: item.item_name,
          item_description: item.item_description,
          quantity: item.quantity,
          unit: item.unit,
          unit_cost: item.unit_cost,
          total_cost: item.total_cost,
          material_id: item.material_id,
          product_id: item.product_id,
        }));

        const { error: itemsError } = await supabase
          .from('composition_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      setFormData({ name: '', description: '' });
      setItems([]);
      setEditingId(null);
      loadData();
    } catch (error) {
      console.error('Erro ao salvar composição:', error);
      alert('Erro ao salvar composição');
    }
  };

  const handleEdit = async (composition: Composition) => {
    setFormData({
      name: composition.name,
      description: composition.description,
    });
    setEditingId(composition.id);
    await loadCompositionItems(composition.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta composição?')) return;

    try {
      const { error } = await supabase
        .from('compositions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Erro ao excluir composição:', error);
      alert('Erro ao excluir composição');
    }
  };

  const handleDuplicate = async (composition: Composition) => {
    if (!confirm('Deseja criar uma cópia desta composição?')) return;

    try {
      const { data: itemsData, error: itemsError } = await supabase
        .from('composition_items')
        .select('*')
        .eq('composition_id', composition.id);

      if (itemsError) throw itemsError;

      const newCompositionName = `Cópia de ${composition.name}`;
      const { data: newComposition, error: compositionError } = await supabase
        .from('compositions')
        .insert({
          name: newCompositionName,
          description: composition.description,
          total_cost: composition.total_cost,
        })
        .select()
        .single();

      if (compositionError) throw compositionError;

      if (itemsData && itemsData.length > 0) {
        const itemsToInsert = itemsData.map(item => ({
          composition_id: newComposition.id,
          item_type: item.item_type,
          item_name: item.item_name,
          item_description: item.item_description,
          quantity: item.quantity,
          unit: item.unit,
          unit_cost: item.unit_cost,
          total_cost: item.total_cost,
          material_id: item.material_id,
          product_id: item.product_id,
        }));

        const { error: insertItemsError } = await supabase
          .from('composition_items')
          .insert(itemsToInsert);

        if (insertItemsError) throw insertItemsError;
      }

      alert('Composição duplicada com sucesso!');
      loadData();
    } catch (error) {
      console.error('Erro ao duplicar composição:', error);
      alert('Erro ao duplicar composição');
    }
  };

  const handleCancel = () => {
    setFormData({ name: '', description: '' });
    setItems([]);
    setEditingId(null);
    setShowItemForm(false);
  };

  const getItemTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      product: 'Produto',
      material: 'Material',
      service: 'Serviço',
      labor: 'Mão de Obra',
      equipment: 'Equipamento',
    };
    return labels[type] || type;
  };

  const getTotalCost = () => {
    return items.reduce((sum, item) => sum + item.total_cost, 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Package className="w-6 h-6" />
            {editingId ? 'Editar Composição' : 'Nova Composição'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome da Composição *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                placeholder="Ex: Pórtico Pré-Moldado 12m"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                placeholder="Descrição breve da composição"
              />
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4 mt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Itens da Composição ({items.length})
              </h3>
              <button
                type="button"
                onClick={() => setShowItemForm(!showItemForm)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Adicionar Item
              </button>
            </div>

            {showItemForm && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <div className="flex items-start gap-2">
                    <div className="text-blue-600 mt-0.5">ℹ️</div>
                    <div className="flex-1">
                      <p className="text-sm text-blue-800">
                        <strong>Custo de Produção:</strong> Os insumos usados em composições sempre utilizam apenas o <strong>Custo Unitário</strong>,
                        sem impostos ou margens de revenda. Isso garante o cálculo correto do custo de produção.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo de Item *
                    </label>
                    <select
                      value={currentItem.item_type}
                      onChange={(e) => handleItemTypeChange(e.target.value as CompositionItem['item_type'])}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                    >
                      <option value="material">Material</option>
                      <option value="product">Produto</option>
                      <option value="service">Serviço</option>
                      <option value="labor">Mão de Obra</option>
                      <option value="equipment">Equipamento</option>
                    </select>
                  </div>

                  {currentItem.item_type === 'material' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Selecionar Material (Custo de Produção)
                      </label>
                      <select
                        value={currentItem.material_id || ''}
                        onChange={(e) => handleMaterialSelect(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                      >
                        <option value="">Digite manualmente ou selecione...</option>
                        {materials.map((material) => {
                          const costToShow = material.resale_enabled ? material.resale_price : material.unit_cost;
                          const typeLabel = material.resale_enabled ? '(Revenda)' : '(Produção)';
                          return (
                            <option key={material.id} value={material.id}>
                              {material.name} - R$ {costToShow.toFixed(4)}/{material.unit} {typeLabel}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  {currentItem.item_type === 'product' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Selecionar Produto
                      </label>
                      <select
                        value={currentItem.product_id || ''}
                        onChange={(e) => handleProductSelect(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                      >
                        <option value="">Digite manualmente ou selecione...</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome do Item *
                    </label>
                    <input
                      type="text"
                      value={currentItem.item_name}
                      onChange={(e) => setCurrentItem({ ...currentItem, item_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                      placeholder="Ex: Pilar Pré-Moldado"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Descrição
                    </label>
                    <input
                      type="text"
                      value={currentItem.item_description}
                      onChange={(e) => setCurrentItem({ ...currentItem, item_description: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                      placeholder="Detalhes do item"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantidade *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={currentItem.quantity}
                      onChange={(e) => {
                        const qty = parseFloat(e.target.value) || 0;
                        setCurrentItem({
                          ...currentItem,
                          quantity: qty,
                          total_cost: qty * currentItem.unit_cost,
                        });
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unidade *
                    </label>
                    <input
                      type="text"
                      value={currentItem.unit}
                      onChange={(e) => setCurrentItem({ ...currentItem, unit: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                      placeholder="un, kg, m²"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Custo Unit. (R$) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={currentItem.unit_cost}
                      onChange={(e) => {
                        const cost = parseFloat(e.target.value) || 0;
                        setCurrentItem({
                          ...currentItem,
                          unit_cost: cost,
                          total_cost: currentItem.quantity * cost,
                        });
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total (R$)
                    </label>
                    <input
                      type="text"
                      value={(currentItem.quantity * currentItem.unit_cost).toFixed(2)}
                      readOnly
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 font-semibold"
                    />
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Adicionar à Lista
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowItemForm(false);
                      setCurrentItem({
                        item_type: 'material',
                        item_name: '',
                        item_description: '',
                        quantity: 1,
                        unit: 'un',
                        unit_cost: 0,
                        total_cost: 0,
                        material_id: null,
                        product_id: null,
                      });
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {items.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Qtd</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Unid</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Custo Unit.</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {items.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            {getItemTypeLabel(item.item_type)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{item.item_name}</div>
                          {item.item_description && (
                            <div className="text-xs text-gray-500">{item.item_description}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-900">{item.quantity}</td>
                        <td className="px-4 py-3 text-center text-sm text-gray-600">{item.unit}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-900">
                          R$ {item.unit_cost.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                          R$ {item.total_cost.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="text-red-600 hover:text-red-900"
                            title="Remover"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={5} className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                        TOTAL DA COMPOSIÇÃO:
                      </td>
                      <td className="px-4 py-3 text-right text-lg font-bold text-[#0A7EC2]">
                        R$ {getTotalCost().toFixed(2)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {items.length === 0 && (
              <div className="text-center py-8 text-gray-500 border border-dashed border-gray-300 rounded-lg">
                Nenhum item adicionado ainda. Clique em "Adicionar Item" para começar.
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-[#0A7EC2] text-white px-6 py-2 rounded-lg hover:bg-[#0968A8] transition-colors flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              {editingId ? 'Atualizar Composição' : 'Salvar Composição'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          Composições Cadastradas ({compositions.length})
        </h3>

        {compositions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Nenhuma composição cadastrada ainda
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {compositions.map((composition) => (
              <div
                key={composition.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-gray-900">{composition.name}</h4>
                    {composition.description && (
                      <p className="text-sm text-gray-600 mt-1">{composition.description}</p>
                    )}
                  </div>
                </div>

                <div className="bg-blue-50 rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Custo Total:</span>
                    <div className="flex items-center gap-1 text-lg font-bold text-[#0A7EC2]">
                      <DollarSign className="w-5 h-5" />
                      {composition.total_cost.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleDuplicate(composition)}
                    className="px-3 py-2 border border-green-300 text-green-600 rounded-lg hover:bg-green-50 transition-colors"
                    title="Copiar Composição"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEdit(composition)}
                    className="flex-1 bg-[#0A7EC2] text-white px-3 py-2 rounded-lg hover:bg-[#0968A8] transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <Edit2 className="w-4 h-4" />
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(composition.id)}
                    className="px-3 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
