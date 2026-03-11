import { useState, useEffect, useMemo, useCallback } from 'react';
import { Save, X, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useDebounce } from '../../hooks/useDebounce';
import { usePerformanceDiagnostics } from '../../hooks/usePerformanceDiagnostics';

interface ProductFormProps {
  productId?: string | null;
  onClose: () => void;
  onSave?: () => void;
}

interface FormData {
  name: string;
  code: string;
  description: string;
  unit: string;
  product_type: 'artifact' | 'premolded' | 'ferragens_diversas';
  recipe_id: string;
  concrete_volume_m3: string;
  peso_artefato: string;
  material_cost: string;
  labor_cost: string;
  production_cost: string;
  sale_price: string;
  margin_percentage: string;
  final_sale_price: string;
}

export default function ProductFormOptimized({ productId, onClose, onSave }: ProductFormProps) {
  const metrics = usePerformanceDiagnostics('ProductFormOptimized', 50);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    code: '',
    description: '',
    unit: 'unid',
    product_type: 'artifact',
    recipe_id: '',
    concrete_volume_m3: '',
    peso_artefato: '',
    material_cost: '',
    labor_cost: '',
    production_cost: '',
    sale_price: '',
    margin_percentage: '',
    final_sale_price: '',
  });

  const [recipes, setRecipes] = useState<any[]>([]);
  const [recipeMaterials, setRecipeMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [localVolume, setLocalVolume] = useState('');
  const [localWeight, setLocalWeight] = useState('');
  const [localMargin, setLocalMargin] = useState('');

  const debouncedVolume = useDebounce(localVolume, 300);
  const debouncedWeight = useDebounce(localWeight, 300);
  const debouncedMargin = useDebounce(localMargin, 300);

  useEffect(() => {
    const abortController = new AbortController();

    const loadRecipes = async () => {
      try {
        const { data, error } = await supabase
          .from('recipes')
          .select('id, name')
          .order('name');

        if (error) throw error;
        setRecipes(data || []);
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Erro ao carregar receitas:', error);
        }
      }
    };

    loadRecipes();

    return () => {
      abortController.abort();
    };
  }, []);

  useEffect(() => {
    if (!productId) return;

    const abortController = new AbortController();

    const loadProduct = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('id', productId)
          .single();

        if (error) throw error;

        setFormData({
          name: data.name || '',
          code: data.code || '',
          description: data.description || '',
          unit: data.unit || 'unid',
          product_type: data.product_type || 'artifact',
          recipe_id: data.recipe_id || '',
          concrete_volume_m3: data.concrete_volume_m3?.toString() || '',
          peso_artefato: data.peso_artefato?.toString() || '',
          material_cost: data.material_cost?.toString() || '',
          labor_cost: data.labor_cost?.toString() || '',
          production_cost: data.production_cost?.toString() || '',
          sale_price: data.sale_price?.toString() || '',
          margin_percentage: data.margin_percentage?.toString() || '',
          final_sale_price: data.final_sale_price?.toString() || '',
        });

        setLocalVolume(data.concrete_volume_m3?.toString() || '');
        setLocalWeight(data.peso_artefato?.toString() || '');
        setLocalMargin(data.margin_percentage?.toString() || '');
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Erro ao carregar produto:', error);
        }
      } finally {
        setLoading(false);
      }
    };

    loadProduct();

    return () => {
      abortController.abort();
    };
  }, [productId]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, concrete_volume_m3: debouncedVolume }));
  }, [debouncedVolume]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, peso_artefato: debouncedWeight }));
  }, [debouncedWeight]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, margin_percentage: debouncedMargin }));
  }, [debouncedMargin]);

  useEffect(() => {
    if (!formData.recipe_id) {
      setRecipeMaterials([]);
      return;
    }

    const abortController = new AbortController();

    const loadRecipeMaterials = async () => {
      try {
        const { data, error } = await supabase
          .from('recipe_materials')
          .select(`
            material_id,
            quantity,
            materials (
              id,
              name,
              unit,
              unit_cost
            )
          `)
          .eq('recipe_id', formData.recipe_id);

        if (error) throw error;
        setRecipeMaterials(data || []);
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Erro ao carregar materiais da receita:', error);
        }
      }
    };

    loadRecipeMaterials();

    return () => {
      abortController.abort();
    };
  }, [formData.recipe_id]);

  const materialCost = useMemo(() => {
    if (!formData.recipe_id || !formData.concrete_volume_m3 || recipeMaterials.length === 0) {
      return 0;
    }

    const volume = parseFloat(formData.concrete_volume_m3);
    if (isNaN(volume) || volume <= 0) return 0;

    return recipeMaterials.reduce((total, rm) => {
      const material = rm.materials;
      if (!material || !material.unit_cost) return total;

      const consumption = rm.quantity * volume;
      return total + (consumption * material.unit_cost);
    }, 0);
  }, [formData.recipe_id, formData.concrete_volume_m3, recipeMaterials]);

  useEffect(() => {
    if (materialCost > 0) {
      setFormData(prev => ({ ...prev, material_cost: materialCost.toFixed(2) }));
    }
  }, [materialCost]);

  const productionCost = useMemo(() => {
    const material = parseFloat(formData.material_cost) || 0;
    const labor = parseFloat(formData.labor_cost) || 0;
    return material + labor;
  }, [formData.material_cost, formData.labor_cost]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, production_cost: productionCost.toFixed(2) }));
  }, [productionCost]);

  const finalSalePrice = useMemo(() => {
    const basePrice = parseFloat(formData.sale_price) || 0;
    const margin = parseFloat(formData.margin_percentage) || 0;

    if (basePrice <= 0) return 0;

    return basePrice * (1 + margin / 100);
  }, [formData.sale_price, formData.margin_percentage]);

  useEffect(() => {
    if (finalSalePrice > 0) {
      setFormData(prev => ({ ...prev, final_sale_price: finalSalePrice.toFixed(2) }));
    }
  }, [finalSalePrice]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      alert('Informe o nome do produto');
      return;
    }

    try {
      setSaving(true);

      const productData = {
        name: formData.name,
        code: formData.code || null,
        description: formData.description || null,
        unit: formData.unit,
        product_type: formData.product_type,
        recipe_id: formData.recipe_id || null,
        concrete_volume_m3: parseFloat(formData.concrete_volume_m3) || null,
        peso_artefato: parseFloat(formData.peso_artefato) || null,
        material_cost: parseFloat(formData.material_cost) || null,
        labor_cost: parseFloat(formData.labor_cost) || null,
        production_cost: parseFloat(formData.production_cost) || null,
        sale_price: parseFloat(formData.sale_price) || null,
        margin_percentage: parseFloat(formData.margin_percentage) || null,
        final_sale_price: parseFloat(formData.final_sale_price) || null,
      };

      if (productId) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', productId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('products')
          .insert([productData]);

        if (error) throw error;
      }

      if (onSave) onSave();
      onClose();
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
      alert('Erro ao salvar produto');
    } finally {
      setSaving(false);
    }
  }, [formData, productId, onSave, onClose]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-blue-600"></div>
        <p className="mt-2 text-gray-600">Carregando produto...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-4">
      {import.meta.env.DEV && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs text-yellow-800">
          <strong>Performance:</strong> Renders: {metrics.renderCount} | Slow: {metrics.slowRenders} |
          Último render: {metrics.renderTime.toFixed(2)}ms
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nome do Produto *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Código
          </label>
          <input
            type="text"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipo
          </label>
          <select
            value={formData.product_type}
            onChange={(e) => setFormData({ ...formData, product_type: e.target.value as any })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="artifact">Artefato</option>
            <option value="premolded">Pré-Moldado</option>
            <option value="ferragens_diversas">Ferragens Diversas</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Descrição
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={2}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Receita (Traço)
          </label>
          <select
            value={formData.recipe_id}
            onChange={(e) => setFormData({ ...formData, recipe_id: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Selecione uma receita</option>
            {recipes.map((recipe) => (
              <option key={recipe.id} value={recipe.id}>
                {recipe.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Volume de Concreto (m³) <span className="text-xs text-gray-500">(debounce 300ms)</span>
          </label>
          <input
            type="number"
            step="0.001"
            value={localVolume}
            onChange={(e) => setLocalVolume(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Peso Artefato (kg) <span className="text-xs text-gray-500">(debounce 300ms)</span>
          </label>
          <input
            type="number"
            step="0.01"
            value={localWeight}
            onChange={(e) => setLocalWeight(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Custo Material (R$) <span className="text-xs text-green-600">(calculado)</span>
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.material_cost}
            onChange={(e) => setFormData({ ...formData, material_cost: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-green-50"
            readOnly
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Custo Mão de Obra (R$)
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.labor_cost}
            onChange={(e) => setFormData({ ...formData, labor_cost: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Custo Produção (R$) <span className="text-xs text-green-600">(calculado)</span>
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.production_cost}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-green-50"
            readOnly
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Preço Base (R$)
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.sale_price}
            onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Margem (%) <span className="text-xs text-gray-500">(debounce 300ms)</span>
          </label>
          <input
            type="number"
            step="0.01"
            value={localMargin}
            onChange={(e) => setLocalMargin(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Preço Final de Venda (R$) <span className="text-xs text-green-600">(calculado)</span>
        </label>
        <input
          type="number"
          step="0.01"
          value={formData.final_sale_price}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-green-50 text-lg font-semibold text-green-700"
          readOnly
        />
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Salvando...' : productId ? 'Atualizar Produto' : 'Salvar Produto'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <X className="w-5 h-5" />
          Cancelar
        </button>
      </div>
    </form>
  );
}
