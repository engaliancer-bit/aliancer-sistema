import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, BookOpen, X, Calculator, Printer } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Material {
  id: string;
  name: string;
  unit: string;
}

interface RecipeItem {
  id: string;
  material_id: string;
  quantity: number;
  materials?: Material;
}

type RecipeConcreteType =
  | 'dry'
  | 'plastic'
  | 'argamassa_assentamento'
  | 'argamassa_reboco'
  | 'argamassa_emboco'
  | 'argamassa_chapisco'
  | 'argamassa_contrapiso';

const RECIPE_TYPE_LABELS: Record<RecipeConcreteType, string> = {
  dry: 'TCS AL - Concreto Seco',
  plastic: 'TCP AL - Concreto Plastico',
  argamassa_assentamento: 'Argamassa de Assentamento',
  argamassa_reboco: 'Argamassa de Reboco',
  argamassa_emboco: 'Argamassa de Emboco',
  argamassa_chapisco: 'Argamassa de Chapisco',
  argamassa_contrapiso: 'Argamassa de Contrapiso',
};

const MORTAR_TYPES: RecipeConcreteType[] = [
  'argamassa_assentamento',
  'argamassa_reboco',
  'argamassa_emboco',
  'argamassa_chapisco',
  'argamassa_contrapiso',
];

const isMortarType = (t: string) => MORTAR_TYPES.includes(t as RecipeConcreteType);
const needsSpecificWeight = (t: string) => t === 'plastic' || isMortarType(t);
const needsMoisture = (t: string) => t === 'dry';

interface Recipe {
  id: string;
  name: string;
  description: string;
  concrete_type?: RecipeConcreteType;
  specific_weight?: number;
  moisture_percentage?: number;
  created_at: string;
  recipe_items?: RecipeItem[];
}

export default function Recipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    concrete_type: '' as '' | RecipeConcreteType,
    specific_weight: '',
    moisture_percentage: '',
  });
  const [recipeItems, setRecipeItems] = useState<Array<{ material_id: string; quantity: string }>>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const [calcRecipeId, setCalcRecipeId] = useState<string>('');
  const [calcCementKg, setCalcCementKg] = useState<string>('');
  const [calcResults, setCalcResults] = useState<null | {
    items: Array<{ name: string; unit: string; quantity: number; isCement: boolean }>;
    totalWeight: number;
    moistureKg: number | null;
    totalWithMoisture: number | null;
    moisturePercentage: number | null;
  }>(null);
  const [calcError, setCalcError] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [recipesRes, recipeItemsRes, materialsRes] = await Promise.all([
        supabase.from('recipes').select('id, name, description, concrete_type, specific_weight, moisture_percentage, created_at').order('name').limit(200),
        supabase.from('recipe_items').select('id, recipe_id, material_id, quantity').limit(1000),
        supabase.from('materials').select('id, name, unit').order('name').limit(500),
      ]);

      if (recipesRes.error) throw recipesRes.error;
      if (recipeItemsRes.error) throw recipeItemsRes.error;
      if (materialsRes.error) throw materialsRes.error;

      const recipesWithItems = (recipesRes.data || []).map(recipe => {
        const items = (recipeItemsRes.data || [])
          .filter(item => item.recipe_id === recipe.id)
          .map(item => {
            const material = materialsRes.data?.find(m => m.id === item.material_id);
            return {
              ...item,
              materials: material || null
            };
          });

        return {
          ...recipe,
          recipe_items: items
        };
      });

      setRecipes(recipesWithItems);
      setMaterials(materialsRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar receitas:', error);
      alert('Erro ao carregar receitas');
    } finally {
      setLoading(false);
    }
  };

  const addRecipeItem = () => {
    setRecipeItems([...recipeItems, { material_id: '', quantity: '' }]);
  };

  const updateRecipeItem = (index: number, field: string, value: string) => {
    const updated = [...recipeItems];
    updated[index] = { ...updated[index], [field]: value };
    setRecipeItems(updated);
  };

  const removeRecipeItem = (index: number) => {
    setRecipeItems(recipeItems.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Nome do traço é obrigatório');
      return;
    }

    if (recipeItems.length === 0) {
      alert('Adicione pelo menos um insumo ao traço');
      return;
    }

    if (recipeItems.some((item) => !item.material_id || !item.quantity || parseFloat(item.quantity) <= 0)) {
      alert('Preencha todos os insumos corretamente');
      return;
    }

    const parsedSpecificWeight = formData.specific_weight ? parseFloat(formData.specific_weight) : 0;
    const parsedMoisturePercentage = formData.moisture_percentage ? parseFloat(formData.moisture_percentage) : 0;

    const recipeData = {
      name: formData.name,
      description: formData.description,
      concrete_type: formData.concrete_type && formData.concrete_type !== '' ? formData.concrete_type : null,
      specific_weight: parsedSpecificWeight > 0 ? parsedSpecificWeight : null,
      moisture_percentage: (parsedMoisturePercentage >= 0 && parsedMoisturePercentage <= 100) ? parsedMoisturePercentage : null,
    };

    try {
      let recipeId = editingId;

      if (editingId) {
        const { error } = await supabase
          .from('recipes')
          .update(recipeData)
          .eq('id', editingId);

        if (error) throw error;

        await supabase.from('recipe_items').delete().eq('recipe_id', editingId);
      } else {
        const { data, error } = await supabase
          .from('recipes')
          .insert([recipeData])
          .select()
          .maybeSingle();

        if (error) throw error;
        recipeId = data?.id;
      }

      const itemsToInsert = recipeItems.map((item) => ({
        recipe_id: recipeId,
        material_id: item.material_id,
        quantity: parseFloat(item.quantity),
      }));

      const { error: itemsError } = await supabase
        .from('recipe_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      setFormData({ name: '', description: '', concrete_type: '', specific_weight: '', moisture_percentage: '' });
      setRecipeItems([]);
      setEditingId(null);
      loadData();
    } catch (error: any) {
      console.error('======= ERRO AO SALVAR TRAÇO =======');
      console.error('Erro completo:', error);
      console.error('Mensagem:', error?.message);
      console.error('Detalhes:', error?.details);
      console.error('Hint:', error?.hint);
      console.error('Código:', error?.code);
      console.error('Dados enviados:', recipeData);
      console.error('====================================');
      alert(`Erro ao salvar traço: ${error?.message || 'Erro desconhecido'}\n${error?.details || ''}`);
    }
  };

  const handleEdit = (recipe: Recipe) => {
    const ct = recipe.concrete_type || '';
    setFormData({
      name: recipe.name,
      description: recipe.description,
      concrete_type: ct,
      specific_weight: recipe.specific_weight ? recipe.specific_weight.toString() : '',
      moisture_percentage: recipe.moisture_percentage ? recipe.moisture_percentage.toString() : '',
    });
    setRecipeItems(
      (recipe.recipe_items || []).map((item) => ({
        material_id: item.material_id,
        quantity: item.quantity.toString(),
      }))
    );
    setEditingId(recipe.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este traço?')) return;

    try {
      const { error } = await supabase.from('recipes').delete().eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Erro ao excluir traço:', error);
      alert('Erro ao excluir traço');
    }
  };

  const handleCancel = () => {
    setFormData({ name: '', description: '', concrete_type: '', specific_weight: '', moisture_percentage: '' });
    setRecipeItems([]);
    setEditingId(null);
  };

  const handleCalculate = () => {
    setCalcError('');
    setCalcResults(null);

    if (!calcRecipeId) {
      setCalcError('Selecione um traco para calcular.');
      return;
    }

    const kg = parseFloat(calcCementKg);
    if (!calcCementKg || isNaN(kg) || kg <= 0) {
      setCalcError('Informe a quantidade de cimento em kg (valor maior que zero).');
      return;
    }

    const recipe = recipes.find(r => r.id === calcRecipeId);
    if (!recipe || !recipe.recipe_items || recipe.recipe_items.length === 0) {
      setCalcError('Traco selecionado nao possui insumos cadastrados.');
      return;
    }

    const cementItem = recipe.recipe_items.find(item =>
      item.materials?.name?.toLowerCase().includes('cimento')
    );

    if (!cementItem) {
      setCalcError('Nenhum insumo com "cimento" no nome foi encontrado neste traco. Utilize apenas tracos que contenham cimento como referencia.');
      return;
    }

    const cementQty = parseFloat(cementItem.quantity.toString());
    if (cementQty <= 0) {
      setCalcError('A quantidade de cimento no traco deve ser maior que zero.');
      return;
    }

    const ratio = kg / cementQty;

    const items = recipe.recipe_items.map(item => {
      const isCement = item.id === cementItem.id;
      return {
        name: item.materials?.name || 'Insumo desconhecido',
        unit: item.materials?.unit || '',
        quantity: parseFloat(item.quantity.toString()) * ratio,
        isCement,
      };
    }).sort((a, b) => (b.isCement ? 1 : 0) - (a.isCement ? 1 : 0));

    const totalWeight = items.reduce((sum, i) => sum + i.quantity, 0);

    let moistureKg: number | null = null;
    let totalWithMoisture: number | null = null;
    let moisturePercentage: number | null = null;

    if (recipe.concrete_type === 'dry' && recipe.moisture_percentage && recipe.moisture_percentage > 0) {
      moisturePercentage = recipe.moisture_percentage;
      moistureKg = totalWeight * (recipe.moisture_percentage / 100);
      totalWithMoisture = totalWeight + moistureKg;
    }

    setCalcResults({ items, totalWeight, moistureKg, totalWithMoisture, moisturePercentage });
  };

  const handlePrintCalc = () => {
    const recipe = recipes.find(r => r.id === calcRecipeId);
    if (!calcResults || !recipe) return;

    const win = window.open('', '_blank');
    if (!win) return;

    const rows = calcResults.items.map(item => `
      <tr style="${item.isCement ? 'background:#e0f2fe;font-weight:bold;' : ''}">
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${item.name}${item.isCement ? ' <em style="font-size:11px;color:#0369a1;">(referencia)</em>' : ''}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.unit}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${item.quantity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    `).join('');

    const moistureRow = calcResults.moistureKg !== null ? `
      <tr style="background:#f0fdf4;">
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">Umidade (${calcResults.moisturePercentage?.toFixed(2)}%)</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">kg</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${calcResults.moistureKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    ` : '';

    win.document.write(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>Massada - ${recipe.name}</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;color:#111;}h1{font-size:18px;margin-bottom:4px;}p{margin:2px 0;font-size:13px;color:#555;}table{width:100%;border-collapse:collapse;margin-top:16px;}th{background:#f3f4f6;padding:8px 12px;text-align:left;font-size:13px;border-bottom:2px solid #d1d5db;}td{font-size:13px;}.total{background:#1e3a5f;color:white;font-weight:bold;}</style>
      </head><body>
      <h1>Calculadora de Massada</h1>
      <p><strong>Traco:</strong> ${recipe.name}</p>
      <p><strong>Cimento utilizado:</strong> ${parseFloat(calcCementKg).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</p>
      <table>
        <thead><tr><th>Insumo</th><th style="text-align:center;">Unidade</th><th style="text-align:right;">Quantidade</th></tr></thead>
        <tbody>
          ${rows}
          ${moistureRow}
          <tr class="total">
            <td colspan="2" style="padding:10px 12px;">Peso Total da Massada${calcResults.totalWithMoisture !== null ? ' (com umidade)' : ''}</td>
            <td style="padding:10px 12px;text-align:right;">${(calcResults.totalWithMoisture ?? calcResults.totalWeight).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg</td>
          </tr>
        </tbody>
      </table>
      <p style="margin-top:20px;font-size:11px;color:#aaa;">Gerado em ${new Date().toLocaleString('pt-BR')}</p>
      <script>window.print();</script>
      </body></html>
    `);
    win.document.close();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Carregando...</div>
      </div>
    );
  }

  const viewingRecipe = recipes.find((r) => r.id === viewingId);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <BookOpen className="w-6 h-6" />
          {editingId ? 'Editar Traço' : 'Criar Novo Traço'}
        </h2>

        {materials.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
            Cadastre insumos primeiro para criar traços
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Traço *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  placeholder="Ex: Traço 1:2:3"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Traço
                </label>
                <select
                  value={formData.concrete_type}
                  onChange={(e) => setFormData({ ...formData, concrete_type: e.target.value as '' | RecipeConcreteType, specific_weight: '', moisture_percentage: '' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value="">Nao especificado</option>
                  <optgroup label="Concreto">
                    <option value="dry">TCS AL - Concreto Seco</option>
                    <option value="plastic">TCP AL - Concreto Plastico</option>
                  </optgroup>
                  <optgroup label="Argamassa">
                    <option value="argamassa_assentamento">Argamassa de Assentamento</option>
                    <option value="argamassa_reboco">Argamassa de Reboco</option>
                    <option value="argamassa_emboco">Argamassa de Emboco</option>
                    <option value="argamassa_chapisco">Argamassa de Chapisco</option>
                    <option value="argamassa_contrapiso">Argamassa de Contrapiso</option>
                  </optgroup>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  TCS AL = Traco Concreto Seco | TCP AL = Traco Concreto Plastico
                </p>
              </div>

              {formData.concrete_type && needsMoisture(formData.concrete_type) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Umidade da Massa (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.moisture_percentage}
                    onChange={(e) => setFormData({ ...formData, moisture_percentage: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Ex: 6.00"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Percentual de umidade adicionado ao peso total dos insumos
                  </p>
                </div>
              )}

              {formData.concrete_type && needsSpecificWeight(formData.concrete_type) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Peso Especifico (kg/m³) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={formData.specific_weight}
                    onChange={(e) => setFormData({ ...formData, specific_weight: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder={isMortarType(formData.concrete_type) ? 'Ex: 1800' : 'Ex: 2400'}
                    required={needsSpecificWeight(formData.concrete_type)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {isMortarType(formData.concrete_type)
                      ? 'Peso da argamassa por metro cubico (tipico: 1700-1900 kg/m³)'
                      : 'Peso do concreto por metro cubico (tipico: 2300-2500 kg/m³)'}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  placeholder="Descrição do traço"
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-700">Insumos do Traço</h3>
                <button
                  type="button"
                  onClick={addRecipeItem}
                  className="bg-cyan-600 text-white px-3 py-1.5 rounded-lg hover:bg-cyan-700 transition-colors text-sm flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Adicionar
                </button>
              </div>

              {recipeItems.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  Nenhum insumo adicionado ainda
                </div>
              ) : (
                <div className="space-y-3">
                  {recipeItems.map((item, index) => (
                    <div key={index} className="flex gap-3 items-end">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Insumo
                        </label>
                        <select
                          value={item.material_id}
                          onChange={(e) => updateRecipeItem(index, 'material_id', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                          required
                        >
                          <option value="">Selecione</option>
                          {materials.map((mat) => (
                            <option key={mat.id} value={mat.id}>
                              {mat.name} ({mat.unit})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-32">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Quantidade
                        </label>
                        <input
                          type="number"
                          step="0.0001"
                          min="0.0001"
                          value={item.quantity}
                          onChange={(e) => updateRecipeItem(index, 'quantity', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                          placeholder="0.0000"
                          required
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => removeRecipeItem(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <button
                type="submit"
                className="flex-1 bg-cyan-600 text-white px-6 py-2 rounded-lg hover:bg-cyan-700 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                {editingId ? 'Atualizar' : 'Criar'}
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
        )}
      </div>

      {recipes.length > 0 && (
        <div className="bg-white rounded-lg shadow-md border-l-4 border-cyan-500 p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-1 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-cyan-600" />
            Calculadora de Massada
          </h2>
          <p className="text-sm text-gray-500 mb-5">
            Informe o traco e os kg de cimento disponivel para calcular a dosagem completa da massada.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Traco</label>
              <select
                value={calcRecipeId}
                onChange={(e) => { setCalcRecipeId(e.target.value); setCalcResults(null); setCalcError(''); }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              >
                <option value="">Selecione um traco...</option>
                {['dry', 'plastic'].some(t => recipes.some(r => r.concrete_type === t)) && (
                  <optgroup label="Concreto">
                    {recipes.filter(r => r.concrete_type === 'dry' || r.concrete_type === 'plastic').map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} {r.concrete_type ? `— ${RECIPE_TYPE_LABELS[r.concrete_type]}` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
                {MORTAR_TYPES.some(t => recipes.some(r => r.concrete_type === t)) && (
                  <optgroup label="Argamassa">
                    {recipes.filter(r => isMortarType(r.concrete_type || '')).map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} {r.concrete_type ? `— ${RECIPE_TYPE_LABELS[r.concrete_type]}` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
                {recipes.filter(r => !r.concrete_type).length > 0 && (
                  <optgroup label="Outros">
                    {recipes.filter(r => !r.concrete_type).map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cimento disponivel (kg)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={calcCementKg}
                  onChange={(e) => { setCalcCementKg(e.target.value); setCalcResults(null); setCalcError(''); }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent pr-12"
                  placeholder="0.00"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400 pointer-events-none">kg</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleCalculate}
            className="bg-cyan-600 text-white px-6 py-2 rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2 font-medium"
          >
            <Calculator className="w-4 h-4" />
            Calcular Massada
          </button>

          {calcError && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
              {calcError}
            </div>
          )}

          {calcResults && (
            <div className="mt-6 border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b">
                <span className="font-semibold text-gray-800 text-sm">
                  Dosagem para {parseFloat(calcCementKg).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg de cimento
                </span>
                <button
                  onClick={handlePrintCalc}
                  className="text-gray-500 hover:text-gray-800 flex items-center gap-1 text-sm transition-colors"
                  title="Imprimir"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir
                </button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100 text-gray-600 text-xs uppercase tracking-wide">
                    <th className="px-4 py-2 text-left font-semibold">Insumo</th>
                    <th className="px-4 py-2 text-center font-semibold">Unidade</th>
                    <th className="px-4 py-2 text-right font-semibold">Quantidade</th>
                  </tr>
                </thead>
                <tbody>
                  {calcResults.items.map((item, idx) => (
                    <tr key={idx} className={item.isCement ? 'bg-cyan-50' : 'border-t border-gray-100'}>
                      <td className="px-4 py-2.5 text-gray-900">
                        {item.name}
                        {item.isCement && (
                          <span className="ml-2 text-xs font-medium text-cyan-600 bg-cyan-100 px-1.5 py-0.5 rounded">
                            referencia
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-600">{item.unit}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                        {item.quantity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  {calcResults.moistureKg !== null && (
                    <tr className="border-t border-gray-200 bg-green-50">
                      <td className="px-4 py-2.5 text-gray-700">
                        Umidade
                        <span className="ml-2 text-xs text-gray-500">({calcResults.moisturePercentage?.toFixed(2)}% sobre insumos)</span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-600">kg</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-800">
                        {calcResults.moistureKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-slate-800 text-white">
                    <td className="px-4 py-3 font-bold" colSpan={2}>
                      Peso Total da Massada{calcResults.totalWithMoisture !== null ? ' (com umidade)' : ''}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-lg">
                      {(calcResults.totalWithMoisture ?? calcResults.totalWeight).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          Tracos Cadastrados ({recipes.length})
        </h3>

        {recipes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Nenhum traço cadastrado ainda
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recipes.map((recipe) => (
              <div
                key={recipe.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <h4 className="font-semibold text-gray-900 mb-1">{recipe.name}</h4>
                {recipe.concrete_type && (
                  <p className="text-xs font-semibold text-cyan-700 mb-1">
                    {RECIPE_TYPE_LABELS[recipe.concrete_type] || recipe.concrete_type}
                  </p>
                )}
                <p className="text-sm text-gray-600 mb-3">
                  {recipe.description || 'Sem descrição'}
                </p>
                <p className="text-xs text-gray-500 mb-3">
                  {recipe.recipe_items?.length || 0} insumo(s)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewingId(recipe.id)}
                    className="flex-1 text-cyan-600 hover:text-cyan-900 text-sm py-1"
                  >
                    Detalhes
                  </button>
                  <button
                    onClick={() => handleEdit(recipe)}
                    className="text-blue-600 hover:text-blue-900"
                    title="Editar"
                  >
                    <Edit2 className="w-4 h-4 inline" />
                  </button>
                  <button
                    onClick={() => handleDelete(recipe.id)}
                    className="text-red-600 hover:text-red-900"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4 inline" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewingRecipe && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="sticky top-0 bg-white p-6 border-b flex justify-between items-center">
              <h3 className="text-2xl font-bold text-gray-900">{viewingRecipe.name}</h3>
              <button
                onClick={() => setViewingId(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              {viewingRecipe.description && (
                <p className="text-gray-600 mb-4">{viewingRecipe.description}</p>
              )}

              {viewingRecipe.concrete_type && (
                <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4 mb-4">
                  <h4 className="font-semibold text-cyan-900 mb-2">Informacoes Tecnicas:</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Tipo:</span>
                      <span className="font-semibold text-gray-900">
                        {RECIPE_TYPE_LABELS[viewingRecipe.concrete_type] || viewingRecipe.concrete_type}
                      </span>
                    </div>

                    {needsMoisture(viewingRecipe.concrete_type) && viewingRecipe.moisture_percentage && viewingRecipe.moisture_percentage > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-700">Umidade da Massa:</span>
                        <span className="font-semibold text-cyan-700">
                          {viewingRecipe.moisture_percentage.toFixed(2)}%
                        </span>
                      </div>
                    )}

                    {needsSpecificWeight(viewingRecipe.concrete_type) && viewingRecipe.specific_weight && viewingRecipe.specific_weight > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-700">Peso Especifico:</span>
                        <span className="font-semibold text-gray-900">
                          {viewingRecipe.specific_weight.toFixed(0)} kg/m³
                        </span>
                      </div>
                    )}

                    {needsSpecificWeight(viewingRecipe.concrete_type) && viewingRecipe.specific_weight && viewingRecipe.specific_weight > 0 && (
                      (() => {
                        const totalInsumos = viewingRecipe.recipe_items?.reduce((sum, item) => sum + parseFloat(item.quantity.toString()), 0) || 0;
                        if (totalInsumos <= 0) return null;
                        const sw = viewingRecipe.specific_weight;
                        return (
                          <div className="mt-2 pt-2 border-t border-cyan-200">
                            <p className="text-xs font-semibold text-cyan-800 mb-1">Consumo por m³:</p>
                            {viewingRecipe.recipe_items?.map(item => {
                              const proporcao = parseFloat(item.quantity.toString()) / totalInsumos;
                              const kgPorM3 = proporcao * sw;
                              return (
                                <div key={item.id} className="flex justify-between text-xs text-cyan-700">
                                  <span>{item.materials?.name}</span>
                                  <span className="font-medium">{kgPorM3.toFixed(1)} kg/m³</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()
                    )}
                  </div>

                  {needsMoisture(viewingRecipe.concrete_type) && viewingRecipe.moisture_percentage && viewingRecipe.moisture_percentage > 0 && (
                    <div className="mt-3 pt-3 border-t border-cyan-300">
                      <p className="text-xs text-cyan-800">
                        <strong>Calculo do Peso Total:</strong> Peso dos insumos + {viewingRecipe.moisture_percentage.toFixed(2)}% de umidade
                      </p>
                      <p className="text-xs text-cyan-700 mt-1">
                        {(() => {
                          const totalInsumos = viewingRecipe.recipe_items?.reduce((sum, item) => sum + parseFloat(item.quantity.toString()), 0) || 0;
                          const pesoUmidade = totalInsumos * (viewingRecipe.moisture_percentage / 100);
                          const pesoTotal = totalInsumos + pesoUmidade;
                          return `Exemplo: ${totalInsumos.toFixed(2)} kg + ${pesoUmidade.toFixed(2)} kg = ${pesoTotal.toFixed(2)} kg total`;
                        })()}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <h4 className="font-semibold text-gray-900 mb-3">Insumos:</h4>
              <div className="space-y-2">
                {viewingRecipe.recipe_items?.map((item) => (
                  <div key={item.id} className="flex justify-between p-2 bg-gray-50 rounded">
                    <span className="text-gray-900">{item.materials?.name}</span>
                    <span className="font-semibold text-gray-900">
                      {parseFloat(item.quantity.toString()).toLocaleString('pt-BR')} {item.materials?.unit}
                    </span>
                  </div>
                ))}
              </div>

              {viewingRecipe.recipe_items && viewingRecipe.recipe_items.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between items-center bg-gray-100 p-3 rounded-lg">
                    <span className="font-semibold text-gray-900">Peso Total dos Insumos:</span>
                    <span className="font-bold text-lg text-gray-900">
                      {viewingRecipe.recipe_items.reduce((sum, item) => sum + parseFloat(item.quantity.toString()), 0).toFixed(4)} kg
                    </span>
                  </div>

                  {viewingRecipe.concrete_type === 'dry' && viewingRecipe.moisture_percentage && viewingRecipe.moisture_percentage > 0 && (
                    <div className="flex justify-between items-center bg-cyan-100 p-3 rounded-lg mt-2">
                      <span className="font-semibold text-cyan-900">Peso Total com Umidade:</span>
                      <span className="font-bold text-lg text-cyan-900">
                        {(() => {
                          const totalInsumos = viewingRecipe.recipe_items.reduce((sum, item) => sum + parseFloat(item.quantity.toString()), 0);
                          const pesoTotal = totalInsumos + (totalInsumos * (viewingRecipe.moisture_percentage / 100));
                          return pesoTotal.toFixed(4);
                        })()} kg
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
