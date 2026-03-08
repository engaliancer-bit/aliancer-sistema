import { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Edit2, Trash2, Package, Scale, Save, Check, Search, FileDown, X, Copy, Zap, Settings, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase, Product } from '../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { usePagination } from '../hooks/usePagination';
import { useDebounce } from '../hooks/useDebounce';
import { useAbortController } from '../hooks/useAbortController';

interface Recipe {
  id: string;
  name: string;
  concrete_type?: 'dry' | 'plastic';
  specific_weight?: number;
  moisture_percentage?: number;
}

interface Material {
  id: string;
  name: string;
  unit: string;
  unit_cost?: number;
  cost_per_meter?: number;
  unit_length_meters?: number;
}

interface RecipeMaterialData {
  material_id: string;
  quantity: number;
  materials: Material & { unit_cost?: number };
}

interface MaterialCostBreakdown {
  material_name: string;
  recipe_quantity: number;
  product_consumption: number;
  unit_cost: number;
  total_cost: number;
  unit: string;
}

interface MaterialWeight {
  material_id: string;
  weight_per_unit: number;
}

interface ProductWithRecipe extends Product {
  recipes?: Recipe;
}

interface Reinforcement {
  tempId: string;
  type: string;
  reinforcement_location?: 'base' | 'flange';
  identifier?: string | null;
  material_id: string;
  material_name?: string;
  bar_count: number;
  bar_length_meters: number;
  bar_diameter_mm: number;
  longitudinal_position?: string | null;
  description: string;
  notes: string;
  reference_length_meters?: number;
  length_adjustment_meters?: number;
  calculated_total_length_meters?: number;
  stirrup_standard_length_meters?: number;
  stirrup_standard_quantity?: number;
  stirrup_spacing_meters?: number;
  stirrup_calculated_additional?: number;
  stirrup_special_total_meters?: number;
  stirrup_total_meters?: number;
}

interface StirrupSpecial {
  tempId: string;
  product_reinforcement_id?: string;
  description: string;
  stirrup_length_meters: number;
  quantity: number;
  total_meters: number;
}

interface Accessory {
  tempId: string;
  accessory_type: string;
  item_type: 'material' | 'product';
  material_id: string;
  material_name?: string;
  quantity: number;
  description: string;
}

interface CostMemory {
  traceMaterials: {
    material_name: string;
    quantity: number;
    unit: string;
    unit_cost: number;
    total_cost: number;
  }[];
  reinforcements: {
    description: string;
    material_name: string;
    bar_count: number;
    bar_length_meters: number;
    bar_diameter_mm: number;
    weight_kg: number;
    unit_cost: number;
    total_cost: number;
  }[];
  accessories: {
    material_name: string;
    quantity: number;
    unit: string;
    unit_cost: number;
    total_cost: number;
  }[];
  totalWeight: number;
  totalCost: number;
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
}

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
}

export default function Products() {
  const [products, setProducts] = useState<ProductWithRecipe[]>([]);
  const [productsOffset, setProductsOffset] = useState(0);
  const [hasMoreProducts, setHasMoreProducts] = useState(true);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
  const PRODUCTS_PAGE_SIZE = 50;
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [molds, setMolds] = useState<Mold[]>([]);
  const [selectedMold, setSelectedMold] = useState<Mold | null>(null);
  const [moldReinforcements, setMoldReinforcements] = useState<MoldReinforcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [costMemory, setCostMemory] = useState<CostMemory | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    unit: 'unid',
    product_type: 'artifact' as 'artifact' | 'premolded' | 'ferragens_diversas',
    concrete_volume_m3: '',
    recipe_id: '',
    total_weight: '',
    peso_artefato: '',
    cement_weight: '',
    material_cost: '',
    labor_cost: '',
    fixed_cost: '',
    transport_cost: '',
    loss_cost: '',
    production_cost: '',
    sale_price: '',
    margin_percentage: '',
    tax_percentage: '',
    final_sale_price: '',
    minimum_stock: '',
    column_section_width_cm: '',
    column_section_height_cm: '',
    column_section_area_m2: '',
    column_length_total: '',
    reference_measurement: '',
    reference_volume: '',
    is_simple_registration: false,
    manual_unit_cost: '',
    manual_tax_percentage: '',
    manual_profit_margin_percentage: '',
    manual_final_price: '',
    mold_id: '',
    has_flange: false,
    flange_length_meters: '',
    minimum_price: '',
    maximum_discount_percent: '',
    enable_stage_tracking: false,
    ncm: '',
    cfop: '',
    csosn: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recipeMaterialsData, setRecipeMaterialsData] = useState<RecipeMaterialData[]>([]);
  const [cementMaterial, setCementMaterial] = useState<RecipeMaterialData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [costBreakdown, setCostBreakdown] = useState<MaterialCostBreakdown[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const [reinforcements, setReinforcements] = useState<Reinforcement[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [editingReinforcementId, setEditingReinforcementId] = useState<string | null>(null);
  const [editingAccessoryId, setEditingAccessoryId] = useState<string | null>(null);
  const [isEditingReferenceFields, setIsEditingReferenceFields] = useState(false);
  const [isEditingReferenceLengthField, setIsEditingReferenceLengthField] = useState(false);
  const [stirrupSpecials, setStirrupSpecials] = useState<StirrupSpecial[]>([]);
  const [showStirrupModal, setShowStirrupModal] = useState(false);
  const [currentStirrupReinforcementId, setCurrentStirrupReinforcementId] = useState<string | null>(null);
  const [stirrupModalTab, setStirrupModalTab] = useState<'standard' | 'special'>('standard');
  const [reinforcementForm, setReinforcementForm] = useState({
    type: 'longitudinal',
    reinforcement_location: 'base' as 'base' | 'flange',
    identifier: '',
    material_id: '',
    bar_count: '',
    bar_length_meters: '',
    bar_diameter_mm: '',
    longitudinal_position: '',
    description: '',
    notes: '',
    reference_length_meters: '',
    length_adjustment_meters: '',
    calculated_total_length_meters: '',
    stirrup_standard_length_meters: '',
    stirrup_standard_quantity: '',
    stirrup_spacing_meters: '',
    stirrup_calculated_additional: '',
    stirrup_special_total_meters: '',
    stirrup_total_meters: '',
  });
  const [accessoryForm, setAccessoryForm] = useState({
    accessory_type: '',
    item_type: 'material' as 'material' | 'product',
    material_id: '',
    quantity: '',
    description: '',
  });

  const { signal } = useAbortController();

  useEffect(() => {
    loadData(signal);
    generateNextCode().then(code => {
      setFormData(prev => ({ ...prev, code }));
    });
  }, []);

  useEffect(() => {
    if (formData.recipe_id) {
      loadRecipeMaterials(formData.recipe_id, editingId || undefined);
      const recipe = recipes.find(r => r.id === formData.recipe_id);
      setSelectedRecipe(recipe || null);
    } else {
      setRecipeMaterialsData([]);
      setCementMaterial(null);
      setSelectedRecipe(null);
    }
  }, [formData.recipe_id, editingId, recipes]);

  useEffect(() => {
    if (
      selectedRecipe?.concrete_type === 'plastic' &&
      selectedRecipe.specific_weight &&
      formData.concrete_volume_m3 &&
      parseFloat(formData.concrete_volume_m3) > 0
    ) {
      const volume = parseFloat(formData.concrete_volume_m3);
      const specificWeight = selectedRecipe.specific_weight;
      const calculatedWeight = volume * specificWeight;

      setFormData(prev => ({
        ...prev,
        total_weight: calculatedWeight.toFixed(2),
      }));
    }
  }, [selectedRecipe, formData.concrete_volume_m3]);

  useEffect(() => {
    if (
      formData.product_type === 'premolded' &&
      formData.reference_volume &&
      formData.reference_measurement &&
      formData.column_length_total &&
      parseFloat(formData.reference_volume) > 0 &&
      parseFloat(formData.reference_measurement) > 0 &&
      parseFloat(formData.column_length_total) > 0
    ) {
      const calculatedVolume = (
        parseFloat(formData.reference_volume) *
        (parseFloat(formData.column_length_total) / parseFloat(formData.reference_measurement))
      ).toFixed(6);

      if (formData.concrete_volume_m3 !== calculatedVolume) {
        setFormData(prev => ({
          ...prev,
          concrete_volume_m3: calculatedVolume
        }));
      }
    }
  }, [
    formData.product_type,
    formData.reference_volume,
    formData.reference_measurement,
    formData.column_length_total
  ]);

  useEffect(() => {
    if (formData.is_simple_registration) {
      const unitCost = parseFloat(formData.manual_unit_cost) || 0;
      const taxPercentage = parseFloat(formData.manual_tax_percentage) || 0;
      const profitMargin = parseFloat(formData.manual_profit_margin_percentage) || 0;

      if (unitCost > 0) {
        const costWithTax = unitCost * (1 + taxPercentage / 100);
        const finalPrice = costWithTax * (1 + profitMargin / 100);

        setFormData(prev => ({
          ...prev,
          manual_final_price: finalPrice.toFixed(2),
        }));
      }
    }
  }, [
    formData.is_simple_registration,
    formData.manual_unit_cost,
    formData.manual_tax_percentage,
    formData.manual_profit_margin_percentage,
  ]);

  useEffect(() => {
    if (
      reinforcementForm.type === 'longitudinal' &&
      reinforcementForm.reference_length_meters &&
      formData.column_length_total &&
      formData.reference_measurement &&
      parseFloat(reinforcementForm.reference_length_meters) > 0 &&
      parseFloat(formData.column_length_total) > 0 &&
      parseFloat(formData.reference_measurement) > 0
    ) {
      const armaduraPadrao = parseFloat(reinforcementForm.reference_length_meters);
      const comprimentoTotal = parseFloat(formData.column_length_total);
      const medidaReferencia = parseFloat(formData.reference_measurement);

      const adjustment = comprimentoTotal - medidaReferencia;
      const calculatedTotal = armaduraPadrao + adjustment;

      setReinforcementForm(prev => ({
        ...prev,
        length_adjustment_meters: adjustment.toFixed(3),
        calculated_total_length_meters: calculatedTotal.toFixed(3),
        bar_length_meters: calculatedTotal.toFixed(3),
      }));
    }
  }, [
    reinforcementForm.type,
    reinforcementForm.reference_length_meters,
    formData.column_length_total,
    formData.reference_measurement,
  ]);

  useEffect(() => {
    if (
      reinforcementForm.type === 'transversal' &&
      reinforcementForm.stirrup_standard_length_meters &&
      reinforcementForm.stirrup_standard_quantity &&
      reinforcementForm.stirrup_spacing_meters &&
      formData.reference_measurement &&
      formData.column_length_total
    ) {
      const standardLength = parseFloat(reinforcementForm.stirrup_standard_length_meters);
      const standardQty = parseInt(reinforcementForm.stirrup_standard_quantity);
      const spacing = parseFloat(reinforcementForm.stirrup_spacing_meters);
      const referenceLength = parseFloat(formData.reference_measurement);
      const totalLength = parseFloat(formData.column_length_total);

      if (standardLength > 0 && standardQty > 0 && spacing > 0 && referenceLength > 0 && totalLength > 0) {
        const lengthDifference = totalLength - referenceLength;
        const additionalStirrups = Math.round(lengthDifference / spacing);

        const currentReinforcementSpecials = stirrupSpecials.filter(
          s => s.product_reinforcement_id === currentStirrupReinforcementId || s.tempId.startsWith('temp-')
        );
        const specialTotal = currentReinforcementSpecials.reduce((sum, s) => sum + s.total_meters, 0);

        const standardTotal = (standardQty + additionalStirrups) * standardLength;
        const totalMeters = standardTotal + specialTotal;

        setReinforcementForm(prev => ({
          ...prev,
          stirrup_calculated_additional: additionalStirrups.toString(),
          stirrup_special_total_meters: specialTotal.toFixed(3),
          stirrup_total_meters: totalMeters.toFixed(3),
          bar_length_meters: totalMeters.toFixed(3),
        }));
      }
    }
  }, [
    reinforcementForm.type,
    reinforcementForm.stirrup_standard_length_meters,
    reinforcementForm.stirrup_standard_quantity,
    reinforcementForm.stirrup_spacing_meters,
    formData.reference_measurement,
    formData.column_length_total,
    stirrupSpecials,
    currentStirrupReinforcementId,
  ]);

  const loadData = async (signal?: AbortSignal) => {
    try {
      setLoading(true);

      if (signal?.aborted) return;

      setProductsOffset(0);

      const [productsRes, recipesRes, materialsRes, moldsRes] = await Promise.all([
        supabase
          .from('products')
          .select('*')
          .order('name')
          .range(0, PRODUCTS_PAGE_SIZE - 1),
        supabase
          .from('recipes')
          .select('id, name, concrete_type, specific_weight, moisture_percentage')
          .order('name')
          .limit(200),
        supabase
          .from('materials')
          .select('id, name, unit, brand, unit_cost, cost_per_meter, unit_length_meters, total_weight_kg, resale_enabled, resale_price')
          .order('name')
          .limit(500),
        supabase
          .from('molds')
          .select('id, name, description, section_width_meters, section_height_meters, reference_measurement_meters, reference_volume_m3, has_flange, flange_section_width_cm, flange_section_height_cm, flange_reference_measurement_meters, flange_reference_volume_m3')
          .order('name')
          .limit(200),
      ]);

      if (signal?.aborted) return;

      if (productsRes.error) throw productsRes.error;
      if (recipesRes.error) throw recipesRes.error;
      if (materialsRes.error) throw materialsRes.error;
      if (moldsRes.error) throw moldsRes.error;

      const recipesData = recipesRes.data || [];
      const productsWithRecipes = (productsRes.data || []).map(product => {
        const recipe = recipesData.find(r => r.id === product.recipe_id);
        return {
          ...product,
          recipes: recipe || null
        };
      });

      if (signal?.aborted) return;

      setProducts(productsWithRecipes);
      setRecipes(recipesData);
      setMaterials(materialsRes.data || []);
      setMolds(moldsRes.data || []);
      setHasMoreProducts((productsRes.data?.length || 0) === PRODUCTS_PAGE_SIZE);
      setProductsOffset(PRODUCTS_PAGE_SIZE);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return;
      }
      console.error('Erro ao carregar dados:', error);
      alert(`Erro ao carregar dados: ${error.message}`);
    } finally {
      if (!signal || !signal.aborted) {
        setLoading(false);
      }
    }
  };

  const loadMoreProducts = async () => {
    if (loadingMoreProducts || !hasMoreProducts) return;

    try {
      setLoadingMoreProducts(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name')
        .range(productsOffset, productsOffset + PRODUCTS_PAGE_SIZE - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        const recipesMap = new Map(recipes.map(r => [r.id, r]));
        const newProducts = data.map(product => ({
          ...product,
          recipes: product.recipe_id ? recipesMap.get(product.recipe_id) || null : null
        }));
        setProducts(prev => [...prev, ...newProducts]);
        setHasMoreProducts(data.length === PRODUCTS_PAGE_SIZE);
        setProductsOffset(prev => prev + PRODUCTS_PAGE_SIZE);
      } else {
        setHasMoreProducts(false);
      }
    } catch (error) {
      console.error('Erro ao carregar mais produtos:', error);
    } finally {
      setLoadingMoreProducts(false);
    }
  };

  const generateNextCode = async () => {
    try {
      const { data: productsData, error } = await supabase
        .from('products')
        .select('code')
        .not('code', 'is', null)
        .order('code', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (productsData && productsData.length > 0) {
        const lastCode = productsData[0].code;
        const numericCode = parseInt(lastCode);
        if (!isNaN(numericCode)) {
          return (numericCode + 1).toString().padStart(lastCode.length, '0');
        }
      }

      return '001';
    } catch (error: any) {
      console.error('Erro ao gerar próximo código:', error);
      return '001';
    }
  };

  const resetFormWithNewCode = async (keepMoldAndType = false) => {
    const nextCode = await generateNextCode();
    const currentMoldId = keepMoldAndType ? formData.mold_id : '';
    const currentProductType = keepMoldAndType ? formData.product_type : 'artifact';

    setFormData({
      name: '',
      code: nextCode,
      description: '',
      unit: 'unid',
      product_type: currentProductType,
      concrete_volume_m3: '',
      recipe_id: '',
      mold_id: currentMoldId,
      total_weight: '',
      peso_artefato: '',
      cement_weight: '',
      material_cost: '',
      labor_cost: '',
      fixed_cost: '',
      transport_cost: '',
      loss_cost: '',
      production_cost: '',
      sale_price: '',
      margin_percentage: '',
      tax_percentage: '',
      final_sale_price: '',
      minimum_price: '',
      maximum_discount_percent: '',
      minimum_stock: '',
      column_section_width_cm: '',
      column_section_height_cm: '',
      column_section_area_m2: '',
      column_length_total: '',
      reference_measurement: '',
      reference_volume: '',
      is_simple_registration: false,
      manual_unit_cost: '',
      manual_tax_percentage: '',
      manual_profit_margin_percentage: '',
      manual_final_price: '',
      has_flange: false,
      flange_length_meters: '',
      enable_stage_tracking: false,
    });
    setEditingId(null);
    setRecipeMaterialsData([]);
    setCementMaterial(null);
    setReinforcements([]);
    setAccessories([]);
    setIsEditingReferenceFields(false);
    setReinforcementForm({
      type: 'longitudinal',
      material_id: '',
      bar_count: '',
      bar_length_meters: '',
      bar_diameter_mm: '',
      longitudinal_position: '',
      description: '',
      notes: '',
      reference_length_meters: '',
      length_adjustment_meters: '',
      calculated_total_length_meters: '',
      stirrup_standard_length_meters: '',
      stirrup_standard_quantity: '',
      stirrup_spacing_meters: '',
      stirrup_calculated_additional: '',
      stirrup_special_total_meters: '',
      stirrup_total_meters: '',
    });
    setAccessoryForm({
      accessory_type: '',
      material_id: '',
      quantity: '',
      description: '',
    });
    setCostMemory(null);
  };

  const loadMoldData = async (moldId: string, totalLength?: string) => {
    try {
      console.log('🔍 Carregando dados da fôrma:', moldId);

      // Preservar dados existentes das armaduras (material e diâmetro)
      const existingReinforcementsMap = new Map<string, {
        material_id: string;
        material_name: string;
        bar_diameter_mm: number;
      }>();

      reinforcements.forEach(r => {
        const key = `${r.type}-${r.identifier || ''}-${r.description}`;
        if (r.material_id || r.bar_diameter_mm > 0) {
          existingReinforcementsMap.set(key, {
            material_id: r.material_id,
            material_name: r.material_name || '',
            bar_diameter_mm: r.bar_diameter_mm,
          });
          console.log(`💾 Preservando dados de: ${key}`, {
            material_id: r.material_id,
            material_name: r.material_name,
            diameter: r.bar_diameter_mm
          });
        }
      });

      const { data: moldData, error: moldError } = await supabase
        .from('molds')
        .select('*')
        .eq('id', moldId)
        .maybeSingle();

      if (moldError) throw moldError;

      if (!moldData) {
        alert('Fôrma não encontrada');
        return;
      }

      setSelectedMold(moldData);

      const { data: reinforcementsData, error: reinforcementsError } = await supabase
        .from('mold_reinforcements')
        .select('*')
        .eq('mold_id', moldId)
        .order('type, identifier');

      if (reinforcementsError) throw reinforcementsError;

      setMoldReinforcements(reinforcementsData || []);

      if (reinforcementsData && reinforcementsData.length > 0) {
        const lengthDifference = totalLength && moldData.reference_measurement_meters
          ? parseFloat(totalLength) - moldData.reference_measurement_meters
          : 0;

        console.log(`📏 Diferença de comprimento: ${lengthDifference}m (Produto: ${totalLength}m - Referência: ${moldData.reference_measurement_meters}m)`);

        const convertedReinforcements: Reinforcement[] = reinforcementsData.map(mr => {
          let barLengthMeters = mr.bar_length_meters || 0;
          let barCount = mr.quantity || 1;

          if (mr.type === 'transversal') {
            if (mr.stirrup_standard_length_meters) {
              barLengthMeters = mr.stirrup_standard_length_meters;
            }
            if (mr.stirrup_standard_quantity) {
              barCount = mr.stirrup_standard_quantity;

              // Aplicar cálculo proporcional para estribos marcados como padrão (estrela na fôrma)
              if (mr.is_standard_pattern && totalLength && moldData.reference_measurement_meters && moldData.reference_measurement_meters > 0) {
                const productLength = parseFloat(totalLength);
                const referenceLength = moldData.reference_measurement_meters;
                const proportionalCount = Math.round((mr.stirrup_standard_quantity / referenceLength) * productLength);
                barCount = proportionalCount;
                console.log(`⭐ Ajustando estribo PADRÃO "${mr.description}": ${mr.stirrup_standard_quantity} estribos / ${referenceLength}m × ${productLength}m = ${proportionalCount} estribos`);
              }
            }
          } else {
            // Para armaduras longitudinais e outras, calcular o comprimento total
            if (barLengthMeters === 0 && mr.reference_length_meters) {
              const adjustment = mr.length_adjustment_meters || 0;
              barLengthMeters = mr.reference_length_meters + adjustment;

              // Aplicar a diferença de comprimento proporcional para armaduras longitudinais
              if (lengthDifference !== 0 && mr.type === 'longitudinal') {
                barLengthMeters += lengthDifference;
                barLengthMeters = parseFloat(barLengthMeters.toFixed(2));
                console.log(`🔧 Ajustando armadura longitudinal ${mr.identifier || mr.description}: ${mr.reference_length_meters} + ${adjustment} + ${lengthDifference} (diferença) = ${barLengthMeters.toFixed(2)}m`);
              } else {
                barLengthMeters = parseFloat(barLengthMeters.toFixed(2));
                console.log(`🔧 Calculando comprimento da armadura ${mr.description}: ${mr.reference_length_meters} + ${adjustment} = ${barLengthMeters.toFixed(2)}m`);
              }
            }
          }

          let calculatedTotalLength = mr.reference_length_meters && mr.length_adjustment_meters
            ? mr.reference_length_meters + mr.length_adjustment_meters
            : mr.reference_length_meters;

          // Aplicar diferença de comprimento ao calculatedTotalLength para armaduras longitudinais
          if (calculatedTotalLength && lengthDifference !== 0 && mr.type === 'longitudinal') {
            calculatedTotalLength += lengthDifference;
            calculatedTotalLength = parseFloat(calculatedTotalLength.toFixed(2));
          }

          const validPositions = ['superior', 'middle', 'inferior', 'pele'];
          let longitudinalPosition = null;
          if (mr.position && validPositions.includes(mr.position.trim())) {
            longitudinalPosition = mr.position.trim();
          }

          // Restaurar dados preservados (material e diâmetro)
          const key = `${mr.type === 'lifting' ? 'lifting_hooks' : mr.type === 'threaded_bar_hook' ? 'threaded_bar_hooks' : mr.type}-${mr.identifier || ''}-${mr.description || ''}`;
          const preserved = existingReinforcementsMap.get(key);

          if (preserved) {
            console.log(`♻️ Restaurando dados de: ${key}`, preserved);
          }

          return {
            tempId: `mold-${mr.id}-${Date.now()}`,
            type: mr.type === 'lifting' ? 'lifting_hooks' : mr.type === 'threaded_bar_hook' ? 'threaded_bar_hooks' : mr.type,
            identifier: mr.identifier || null,
            material_id: preserved?.material_id || '',
            material_name: preserved?.material_name || '',
            bar_count: barCount,
            bar_length_meters: barLengthMeters,
            bar_diameter_mm: preserved?.bar_diameter_mm || 0,
            longitudinal_position: longitudinalPosition,
            description: mr.description || '',
            notes: mr.notes || '',
            reference_length_meters: mr.reference_length_meters,
            length_adjustment_meters: mr.length_adjustment_meters,
            calculated_total_length_meters: calculatedTotalLength,
            stirrup_standard_length_meters: mr.stirrup_standard_length_meters,
            stirrup_standard_quantity: mr.stirrup_standard_quantity,
            stirrup_spacing_meters: mr.stirrup_spacing_meters,
            stirrup_calculated_additional: 0,
            stirrup_special_total_meters: 0,
            stirrup_total_meters: mr.stirrup_standard_length_meters && mr.stirrup_standard_quantity
              ? mr.stirrup_standard_length_meters * mr.stirrup_standard_quantity
              : 0,
          };
        });
        console.log('✅ Armaduras carregadas da fôrma:', convertedReinforcements);
        setReinforcements(convertedReinforcements);
      }

      if (moldData.section_width_meters && moldData.section_height_meters) {
        const widthCm = (moldData.section_width_meters * 100).toFixed(2);
        const heightCm = (moldData.section_height_meters * 100).toFixed(2);
        const areaM2 = (moldData.section_width_meters * moldData.section_height_meters).toFixed(4);

        setFormData(prev => ({
          ...prev,
          column_section_width_cm: widthCm,
          column_section_height_cm: heightCm,
          column_section_area_m2: areaM2,
        }));
      }

      if (moldData.reference_measurement_meters) {
        setFormData(prev => ({
          ...prev,
          reference_measurement: moldData.reference_measurement_meters!.toString(),
        }));
      }

      if (moldData.reference_volume_m3) {
        setFormData(prev => ({
          ...prev,
          reference_volume: moldData.reference_volume_m3!.toString(),
        }));
      }

      if (totalLength && moldData.reference_measurement_meters && moldData.reference_volume_m3) {
        const lengthNum = parseFloat(totalLength);
        const refLength = moldData.reference_measurement_meters;
        const refVolume = moldData.reference_volume_m3;

        const calculatedVolume = (refVolume / refLength) * lengthNum;

        setFormData(prev => ({
          ...prev,
          concrete_volume_m3: calculatedVolume.toFixed(6),
        }));
      }

      console.log('✅ Dados da fôrma carregados:', reinforcementsData?.length || 0, 'armaduras');
    } catch (error: any) {
      console.error('❌ Erro ao carregar dados da fôrma:', error);
      alert(`Erro ao carregar dados da fôrma: ${error.message}`);
    }
  };

  const loadRecipeMaterials = async (recipeId: string, productId?: string) => {
    try {
      console.log('🔍 Carregando materiais do traço:', recipeId);

      const { data: recipeMaterials, error: recipeMaterialsError } = await supabase
        .from('recipe_items')
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
        .eq('recipe_id', recipeId);

      if (recipeMaterialsError) {
        console.error('❌ Erro ao carregar materiais do traço:', recipeMaterialsError);
        throw recipeMaterialsError;
      }

      console.log('✅ Materiais carregados:', recipeMaterials?.length || 0, 'materiais');

      if (recipeMaterials && recipeMaterials.length > 0) {
        setRecipeMaterialsData(recipeMaterials as RecipeMaterialData[]);

        const cement = recipeMaterials.find(
          (rm) => rm.materials.name.toLowerCase().includes('cimento')
        );
        if (cement) {
          setCementMaterial(cement as RecipeMaterialData);

          if (productId) {
            const { data: existingWeights } = await supabase
              .from('product_material_weights')
              .select('material_id, weight_per_unit')
              .eq('product_id', productId);

            if (existingWeights && existingWeights.length > 0) {
              const cementWeight = existingWeights.find(
                (w) => w.material_id === cement.material_id
              );
              if (cementWeight) {
                setFormData((prev) => ({
                  ...prev,
                  cement_weight: cementWeight.weight_per_unit.toString(),
                }));
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Erro ao carregar materiais da receita:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Nome do produto é obrigatório');
      return;
    }

    try {
      let flangeVolume = 0;
      if (formData.has_flange && formData.flange_length_meters && selectedMold?.has_flange) {
        const flangeLength = parseFloat(formData.flange_length_meters);
        const flangeRefMeasurement = selectedMold.flange_reference_measurement_meters || 0;
        const flangeRefVolume = selectedMold.flange_reference_volume_m3 || 0;

        if (flangeRefMeasurement > 0 && flangeRefVolume > 0) {
          flangeVolume = (flangeRefVolume / flangeRefMeasurement) * flangeLength;
        }
      }

      const baseVolume = formData.concrete_volume_m3 ? parseFloat(formData.concrete_volume_m3) : 0;
      const totalConcreteVolume = baseVolume + flangeVolume;

      const productData = {
        name: formData.name,
        code: formData.code || null,
        description: formData.description,
        unit: formData.unit,
        product_type: formData.product_type,
        concrete_volume_m3: totalConcreteVolume,
        recipe_id: formData.recipe_id || null,
        mold_id: formData.mold_id || null,
        total_weight: formData.total_weight ? parseFloat(formData.total_weight) : 0,
        peso_artefato: formData.peso_artefato ? parseFloat(formData.peso_artefato) : null,
        material_cost: formData.material_cost ? parseFloat(formData.material_cost) : 0,
        custo_unitario_materiais: formData.material_cost ? parseFloat(formData.material_cost) : null,
        labor_cost: formData.labor_cost ? parseFloat(formData.labor_cost) : 0,
        fixed_cost: formData.fixed_cost ? parseFloat(formData.fixed_cost) : 0,
        transport_cost: formData.transport_cost ? parseFloat(formData.transport_cost) : 0,
        loss_cost: formData.loss_cost ? parseFloat(formData.loss_cost) : 0,
        production_cost: formData.production_cost ? parseFloat(formData.production_cost) : 0,
        sale_price: formData.sale_price ? parseFloat(formData.sale_price) : 0,
        margin_percentage: formData.margin_percentage ? parseFloat(formData.margin_percentage) : 0,
        tax_percentage: formData.tax_percentage ? parseFloat(formData.tax_percentage) : 0,
        final_sale_price: formData.final_sale_price ? parseFloat(formData.final_sale_price) : 0,
        minimum_price: formData.minimum_price ? parseFloat(formData.minimum_price) : null,
        maximum_discount_percent: formData.maximum_discount_percent ? parseFloat(formData.maximum_discount_percent) : null,
        minimum_stock: formData.minimum_stock ? parseFloat(formData.minimum_stock) : 0,
        column_section_width_cm: formData.column_section_width_cm ? parseFloat(formData.column_section_width_cm) : 0,
        column_section_height_cm: formData.column_section_height_cm ? parseFloat(formData.column_section_height_cm) : 0,
        column_section_area_m2: formData.column_section_area_m2 ? parseFloat(formData.column_section_area_m2) : 0,
        column_length_total: formData.column_length_total ? parseFloat(formData.column_length_total) : 0,
        reference_measurement: formData.reference_measurement ? parseFloat(formData.reference_measurement) : 0,
        reference_volume: formData.reference_volume ? parseFloat(formData.reference_volume) : 0,
        is_simple_registration: formData.is_simple_registration,
        manual_unit_cost: formData.manual_unit_cost ? parseFloat(formData.manual_unit_cost) : null,
        manual_tax_percentage: formData.manual_tax_percentage ? parseFloat(formData.manual_tax_percentage) : null,
        manual_profit_margin_percentage: formData.manual_profit_margin_percentage ? parseFloat(formData.manual_profit_margin_percentage) : null,
        manual_final_price: formData.manual_final_price ? parseFloat(formData.manual_final_price) : null,
        has_flange: formData.has_flange,
        flange_length_meters: formData.has_flange && formData.flange_length_meters ? parseFloat(formData.flange_length_meters) : null,
        flange_volume_m3: flangeVolume > 0 ? flangeVolume : null,
        enable_stage_tracking: formData.enable_stage_tracking,
        ncm: formData.ncm || null,
        cfop: formData.cfop || null,
        csosn: formData.csosn || null,
        last_price_update: new Date().toISOString(),
      };

      let productId = editingId;

      if (editingId) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const freshCode = await generateNextCode();
        productData.code = freshCode;

        const { data, error } = await supabase
          .from('products')
          .insert([productData])
          .select()
          .single();

        if (error) throw error;
        productId = data.id;
      }

      if (productId && formData.recipe_id && formData.cement_weight && cementMaterial && recipeMaterialsData.length > 0) {
        await supabase
          .from('product_material_weights')
          .delete()
          .eq('product_id', productId);

        const cementWeightValue = parseFloat(formData.cement_weight);
        const cementRatioInRecipe = cementMaterial.quantity;

        const weightsToInsert = recipeMaterialsData.map((materialData) => {
          const proportionalWeight = (materialData.quantity / cementRatioInRecipe) * cementWeightValue;
          return {
            product_id: productId,
            material_id: materialData.material_id,
            weight_per_unit: proportionalWeight,
          };
        });

        if (weightsToInsert.length > 0) {
          const { error: weightsError } = await supabase
            .from('product_material_weights')
            .insert(weightsToInsert);

          if (weightsError) throw weightsError;
        }
      }

      if (productId && formData.product_type === 'premolded') {
        await supabase
          .from('product_reinforcements')
          .delete()
          .eq('product_id', productId);

        if (reinforcements.length > 0) {
          const reinforcementsToInsert = reinforcements.map(r => {
            const validPositions = ['superior', 'middle', 'inferior', 'pele'];
            let longitudinalPosition = null;

            if (r.longitudinal_position && r.longitudinal_position.trim() !== '') {
              const trimmedPosition = r.longitudinal_position.trim();
              if (validPositions.includes(trimmedPosition)) {
                longitudinalPosition = trimmedPosition;
              } else {
                console.warn(`Posição longitudinal inválida: "${trimmedPosition}". Será salva como NULL.`);
              }
            }

            return {
              product_id: productId,
              reinforcement_type: r.type,
              reinforcement_location: r.reinforcement_location || 'base',
              identifier: r.identifier || null,
              material_id: r.material_id || null,
              bar_count: r.bar_count,
              bar_length_meters: r.bar_length_meters,
              bar_diameter_mm: r.bar_diameter_mm,
              longitudinal_position: longitudinalPosition,
              description: r.description,
              notes: r.notes,
              reference_length_meters: r.reference_length_meters || null,
              length_adjustment_meters: r.length_adjustment_meters || null,
              calculated_total_length_meters: r.calculated_total_length_meters || null,
              stirrup_standard_length_meters: r.stirrup_standard_length_meters || null,
              stirrup_standard_quantity: r.stirrup_standard_quantity || null,
              stirrup_spacing_meters: r.stirrup_spacing_meters || null,
              stirrup_calculated_additional: r.stirrup_calculated_additional || null,
              stirrup_special_total_meters: r.stirrup_special_total_meters || null,
              stirrup_total_meters: r.stirrup_total_meters || null,
            };
          });

          const { error: reinforcementError } = await supabase
            .from('product_reinforcements')
            .insert(reinforcementsToInsert);

          if (reinforcementError) throw reinforcementError;
        }

        await supabase
          .from('product_accessories')
          .delete()
          .eq('product_id', productId);

        if (accessories.length > 0) {
          const accessoriesToInsert = accessories.map(a => ({
            product_id: productId,
            accessory_type: a.accessory_type,
            item_type: a.item_type || 'material',
            material_id: (a.material_id && a.material_id.trim() !== '') ? a.material_id : null,
            quantity: a.quantity,
            description: a.description,
          }));

          const { error: accessoriesError } = await supabase
            .from('product_accessories')
            .insert(accessoriesToInsert);

          if (accessoriesError) throw accessoriesError;
        }
      }

      if (productId && formData.product_type === 'ferragens_diversas') {
        await supabase
          .from('product_accessories')
          .delete()
          .eq('product_id', productId);

        if (accessories.length > 0) {
          const accessoriesToInsert = accessories.map(a => ({
            product_id: productId,
            accessory_type: a.accessory_type,
            item_type: a.item_type || 'material',
            material_id: (a.material_id && a.material_id.trim() !== '') ? a.material_id : null,
            quantity: a.quantity,
            description: a.description,
          }));

          const { error: accessoriesError } = await supabase
            .from('product_accessories')
            .insert(accessoriesToInsert);

          if (accessoriesError) throw accessoriesError;
        }
      }

      await loadData();
      await resetFormWithNewCode(true);
      alert('Produto salvo com sucesso!');
    } catch (error: any) {
      console.error('Erro ao salvar produto:', error);
      alert(`Erro ao salvar produto: ${error.message || JSON.stringify(error)}`);
    }
  };

  const handleEdit = async (product: ProductWithRecipe) => {
    setFormData({
      name: product.name,
      code: (product as any).code || '',
      description: product.description || '',
      unit: product.unit,
      product_type: product.product_type || 'artifact',
      concrete_volume_m3: product.concrete_volume_m3 ? product.concrete_volume_m3.toString() : '',
      recipe_id: product.recipe_id || '',
      total_weight: product.total_weight ? product.total_weight.toString() : '',
      peso_artefato: (product as any).peso_artefato ? (product as any).peso_artefato.toString() : '',
      cement_weight: '',
      material_cost: product.material_cost ? product.material_cost.toString() : '',
      labor_cost: product.labor_cost ? product.labor_cost.toString() : '',
      fixed_cost: product.fixed_cost ? product.fixed_cost.toString() : '',
      transport_cost: product.transport_cost ? product.transport_cost.toString() : '',
      loss_cost: product.loss_cost ? product.loss_cost.toString() : '',
      production_cost: product.production_cost ? product.production_cost.toString() : '',
      sale_price: product.sale_price ? product.sale_price.toString() : '',
      margin_percentage: product.margin_percentage ? product.margin_percentage.toString() : '',
      tax_percentage: product.tax_percentage ? product.tax_percentage.toString() : '',
      final_sale_price: (product as any).final_sale_price ? (product as any).final_sale_price.toString() : '',
      minimum_price: (product as any).minimum_price ? (product as any).minimum_price.toString() : '',
      maximum_discount_percent: (product as any).maximum_discount_percent ? (product as any).maximum_discount_percent.toString() : '',
      minimum_stock: product.minimum_stock ? product.minimum_stock.toString() : '',
      column_section_width_cm: (product as any).column_section_width_cm ? (product as any).column_section_width_cm.toString() : '',
      column_section_height_cm: (product as any).column_section_height_cm ? (product as any).column_section_height_cm.toString() : '',
      column_section_area_m2: (product as any).column_section_area_m2 ? (product as any).column_section_area_m2.toString() : '',
      column_length_total: (product as any).column_length_total ? (product as any).column_length_total.toString() : '',
      reference_measurement: (product as any).reference_measurement ? (product as any).reference_measurement.toString() : '',
      reference_volume: (product as any).reference_volume ? (product as any).reference_volume.toString() : '',
      is_simple_registration: (product as any).is_simple_registration || false,
      manual_unit_cost: (product as any).manual_unit_cost ? (product as any).manual_unit_cost.toString() : '',
      manual_tax_percentage: (product as any).manual_tax_percentage ? (product as any).manual_tax_percentage.toString() : '',
      manual_profit_margin_percentage: (product as any).manual_profit_margin_percentage ? (product as any).manual_profit_margin_percentage.toString() : '',
      manual_final_price: (product as any).manual_final_price ? (product as any).manual_final_price.toString() : '',
      mold_id: (product as any).mold_id || '',
      has_flange: (product as any).has_flange || false,
      flange_length_meters: (product as any).flange_length_meters ? (product as any).flange_length_meters.toString() : '',
      enable_stage_tracking: (product as any).enable_stage_tracking || false,
      ncm: (product as any).ncm || '',
      cfop: (product as any).cfop || '',
      csosn: (product as any).csosn || '',
    });
    setEditingId(product.id);

    if (product.product_type === 'premolded') {
      const { data: reinforcementsData } = await supabase
        .from('product_reinforcements')
        .select(`
          *,
          materials (name)
        `)
        .eq('product_id', product.id);

      if (reinforcementsData) {
        const loadedReinforcements: Reinforcement[] = reinforcementsData.map(r => ({
          tempId: Math.random().toString(),
          type: r.reinforcement_type,
          identifier: r.identifier,
          material_id: r.material_id,
          material_name: (r.materials as any)?.name,
          bar_count: r.bar_count,
          bar_length_meters: r.bar_length_meters,
          bar_diameter_mm: r.bar_diameter_mm,
          longitudinal_position: r.longitudinal_position,
          description: r.description,
          notes: r.notes,
          reference_length_meters: r.reference_length_meters,
          length_adjustment_meters: r.length_adjustment_meters,
          calculated_total_length_meters: r.calculated_total_length_meters,
          stirrup_standard_length_meters: r.stirrup_standard_length_meters,
          stirrup_standard_quantity: r.stirrup_standard_quantity,
          stirrup_spacing_meters: r.stirrup_spacing_meters,
          stirrup_calculated_additional: r.stirrup_calculated_additional,
          stirrup_special_total_meters: r.stirrup_special_total_meters,
          stirrup_total_meters: r.stirrup_total_meters,
        }));
        setReinforcements(loadedReinforcements);
      }
    }

    if (product.product_type === 'premolded' || product.product_type === 'ferragens_diversas') {
      const { data: accessoriesData } = await supabase
        .from('product_accessories')
        .select(`
          *,
          materials (name)
        `)
        .eq('product_id', product.id);

      if (accessoriesData) {
        const loadedAccessories: Accessory[] = await Promise.all(
          accessoriesData.map(async (a) => {
            let itemName = '';

            if (a.item_type === 'product' && a.material_id) {
              const { data: productData } = await supabase
                .from('products')
                .select('name')
                .eq('id', a.material_id)
                .maybeSingle();
              itemName = productData?.name || '';
            } else {
              itemName = (a.materials as any)?.name || '';
            }

            return {
              tempId: Math.random().toString(),
              accessory_type: a.accessory_type,
              item_type: a.item_type || 'material',
              material_id: a.material_id,
              material_name: itemName,
              quantity: a.quantity,
              description: a.description,
            };
          })
        );
        setAccessories(loadedAccessories);
      }
    }

    if (product.recipe_id) {
      await loadRecipeMaterials(product.recipe_id, product.id);
    }

    if (recipeMaterialsData.length > 0) {
      calculateCostBreakdown();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClone = async (product: ProductWithRecipe) => {
    const nextCode = await generateNextCode();
    setFormData({
      name: product.name + ' - Cópia',
      code: nextCode,
      description: product.description || '',
      unit: product.unit,
      product_type: product.product_type || 'artifact',
      concrete_volume_m3: product.concrete_volume_m3 ? product.concrete_volume_m3.toString() : '',
      recipe_id: product.recipe_id || '',
      total_weight: product.total_weight ? product.total_weight.toString() : '',
      peso_artefato: (product as any).peso_artefato ? (product as any).peso_artefato.toString() : '',
      cement_weight: '',
      material_cost: product.material_cost ? product.material_cost.toString() : '',
      labor_cost: product.labor_cost ? product.labor_cost.toString() : '',
      fixed_cost: product.fixed_cost ? product.fixed_cost.toString() : '',
      transport_cost: product.transport_cost ? product.transport_cost.toString() : '',
      loss_cost: product.loss_cost ? product.loss_cost.toString() : '',
      production_cost: product.production_cost ? product.production_cost.toString() : '',
      sale_price: product.sale_price ? product.sale_price.toString() : '',
      margin_percentage: product.margin_percentage ? product.margin_percentage.toString() : '',
      tax_percentage: product.tax_percentage ? product.tax_percentage.toString() : '',
      final_sale_price: (product as any).final_sale_price ? (product as any).final_sale_price.toString() : '',
      minimum_price: (product as any).minimum_price ? (product as any).minimum_price.toString() : '',
      maximum_discount_percent: (product as any).maximum_discount_percent ? (product as any).maximum_discount_percent.toString() : '',
      minimum_stock: product.minimum_stock ? product.minimum_stock.toString() : '',
      column_section_width_cm: (product as any).column_section_width_cm ? (product as any).column_section_width_cm.toString() : '',
      column_section_height_cm: (product as any).column_section_height_cm ? (product as any).column_section_height_cm.toString() : '',
      column_section_area_m2: (product as any).column_section_area_m2 ? (product as any).column_section_area_m2.toString() : '',
      column_length_total: (product as any).column_length_total ? (product as any).column_length_total.toString() : '',
      reference_measurement: (product as any).reference_measurement ? (product as any).reference_measurement.toString() : '',
      reference_volume: (product as any).reference_volume ? (product as any).reference_volume.toString() : '',
      is_simple_registration: (product as any).is_simple_registration || false,
      manual_unit_cost: (product as any).manual_unit_cost ? (product as any).manual_unit_cost.toString() : '',
      manual_tax_percentage: (product as any).manual_tax_percentage ? (product as any).manual_tax_percentage.toString() : '',
      manual_profit_margin_percentage: (product as any).manual_profit_margin_percentage ? (product as any).manual_profit_margin_percentage.toString() : '',
      manual_final_price: (product as any).manual_final_price ? (product as any).manual_final_price.toString() : '',
      mold_id: (product as any).mold_id || '',
      has_flange: (product as any).has_flange || false,
      flange_length_meters: (product as any).flange_length_meters ? (product as any).flange_length_meters.toString() : '',
      enable_stage_tracking: (product as any).enable_stage_tracking || false,
      ncm: (product as any).ncm || '',
      cfop: (product as any).cfop || '',
      csosn: (product as any).csosn || '',
    });
    setEditingId(null); // Não define ID para criar novo produto

    if (product.product_type === 'premolded') {
      const { data: reinforcementsData } = await supabase
        .from('product_reinforcements')
        .select(`
          *,
          materials (name)
        `)
        .eq('product_id', product.id);

      if (reinforcementsData) {
        const loadedReinforcements: Reinforcement[] = reinforcementsData.map(r => ({
          tempId: Math.random().toString(),
          type: r.reinforcement_type,
          identifier: r.identifier,
          material_id: r.material_id,
          material_name: (r.materials as any)?.name,
          bar_count: r.bar_count,
          bar_length_meters: r.bar_length_meters,
          bar_diameter_mm: r.bar_diameter_mm,
          longitudinal_position: r.longitudinal_position,
          description: r.description,
          notes: r.notes,
          reference_length_meters: r.reference_length_meters,
          length_adjustment_meters: r.length_adjustment_meters,
          calculated_total_length_meters: r.calculated_total_length_meters,
          stirrup_standard_length_meters: r.stirrup_standard_length_meters,
          stirrup_standard_quantity: r.stirrup_standard_quantity,
          stirrup_spacing_meters: r.stirrup_spacing_meters,
          stirrup_calculated_additional: r.stirrup_calculated_additional,
          stirrup_special_total_meters: r.stirrup_special_total_meters,
          stirrup_total_meters: r.stirrup_total_meters,
        }));
        setReinforcements(loadedReinforcements);
      }
    }

    if (product.product_type === 'premolded' || product.product_type === 'ferragens_diversas') {
      const { data: accessoriesData } = await supabase
        .from('product_accessories')
        .select(`
          *,
          materials (name)
        `)
        .eq('product_id', product.id);

      if (accessoriesData) {
        const loadedAccessories: Accessory[] = await Promise.all(
          accessoriesData.map(async (a) => {
            let itemName = '';

            if (a.item_type === 'product' && a.material_id) {
              const { data: productData } = await supabase
                .from('products')
                .select('name')
                .eq('id', a.material_id)
                .maybeSingle();
              itemName = productData?.name || '';
            } else {
              itemName = (a.materials as any)?.name || '';
            }

            return {
              tempId: Math.random().toString(),
              accessory_type: a.accessory_type,
              item_type: a.item_type || 'material',
              material_id: a.material_id,
              material_name: itemName,
              quantity: a.quantity,
              description: a.description,
            };
          })
        );
        setAccessories(loadedAccessories);
      }
    }

    if (product.recipe_id) {
      await loadRecipeMaterials(product.recipe_id, product.id);
    }

    if (recipeMaterialsData.length > 0) {
      calculateCostBreakdown();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error: any) {
      console.error('Erro ao excluir produto:', error);
      alert(`Erro ao excluir produto: ${error.message}`);
    }
  };

  const calculateCostBreakdown = async () => {
    if (!formData.recipe_id || recipeMaterialsData.length === 0) {
      setCostBreakdown([]);
      return;
    }

    try {
      let breakdown: MaterialCostBreakdown[] = [];

      // Para produtos pré-moldados: usar volume × peso específico
      if (formData.product_type === 'premolded' && formData.concrete_volume_m3 && selectedRecipe?.specific_weight) {
        const volumeM3 = parseFloat(formData.concrete_volume_m3);
        const specificWeight = selectedRecipe.specific_weight;
        const pieceWeight = volumeM3 * specificWeight;

        // Calcular peso total do traço
        const totalTraceWeight = recipeMaterialsData.reduce((sum, mat) => sum + mat.quantity, 0);

        // Multiplicador proporcional
        const multiplier = pieceWeight / totalTraceWeight;

        breakdown = recipeMaterialsData.map((materialData) => {
          const proportionalWeight = materialData.quantity * multiplier;
          const unitCost = materialData.materials.unit_cost || 0;
          const totalCost = proportionalWeight * unitCost;

          return {
            material_name: materialData.materials.name,
            recipe_quantity: materialData.quantity,
            product_consumption: proportionalWeight,
            unit_cost: unitCost,
            total_cost: totalCost,
            unit: materialData.materials.unit,
          };
        });
      } else if (formData.product_type === 'artifact' && formData.peso_artefato && cementMaterial) {
        // Para artefatos: usar peso_artefato informado e manter proporção do traço
        const totalWeightKg = parseFloat(formData.peso_artefato);

        // Calcular peso total do traço (soma de todos os materiais)
        const totalTraceWeight = recipeMaterialsData.reduce((sum, mat) => sum + mat.quantity, 0);

        // Multiplicador proporcional: quanto do traço cabe no produto
        // Ex: Se traço = 14kg total e produto = 100kg, então multiplier = 100/14 = 7.14
        // Isso significa que o produto usa 7.14 "porções" do traço
        const multiplier = totalWeightKg / totalTraceWeight;

        breakdown = recipeMaterialsData.map((materialData) => {
          // Consumo = quantidade no traço × multiplicador
          // Ex: Se no traço tem 5.56kg de areia, no produto terá 5.56 × 7.14 = 39.7kg
          const proportionalWeight = materialData.quantity * multiplier;
          const unitCost = materialData.materials.unit_cost || 0;
          const totalCost = proportionalWeight * unitCost;

          return {
            material_name: materialData.materials.name,
            recipe_quantity: materialData.quantity,
            product_consumption: proportionalWeight,
            unit_cost: unitCost,
            total_cost: totalCost,
            unit: materialData.materials.unit,
          };
        });
      } else if (formData.cement_weight && cementMaterial) {
        // Para outros produtos: usar peso do cimento
        const cementWeightValue = parseFloat(formData.cement_weight);
        const cementRatioInRecipe = cementMaterial.quantity;

        breakdown = recipeMaterialsData.map((materialData) => {
          const proportionalWeight = (materialData.quantity / cementRatioInRecipe) * cementWeightValue;
          const unitCost = materialData.materials.unit_cost || 0;
          const totalCost = proportionalWeight * unitCost;

          return {
            material_name: materialData.materials.name,
            recipe_quantity: materialData.quantity,
            product_consumption: proportionalWeight,
            unit_cost: unitCost,
            total_cost: totalCost,
            unit: materialData.materials.unit,
          };
        });
      }

      setCostBreakdown(breakdown);

      const totalMaterialCost = breakdown.reduce((sum, item) => sum + item.total_cost, 0);
      setFormData((prev) => ({
        ...prev,
        material_cost: totalMaterialCost.toFixed(2),
      }));
    } catch (error: any) {
      console.error('Erro ao calcular breakdown de custos:', error);
    }
  };

  useEffect(() => {
    // Calcular breakdown para pré-moldados (volume + peso específico), artefatos (peso_artefato + cimento) ou outros produtos (peso cimento)
    const shouldCalculate =
      (formData.product_type === 'premolded' && formData.concrete_volume_m3 && selectedRecipe?.specific_weight) ||
      (formData.product_type === 'artifact' && formData.peso_artefato && cementMaterial) ||
      (formData.cement_weight && cementMaterial);

    if (shouldCalculate && recipeMaterialsData.length > 0) {
      calculateCostBreakdown();
    }
  }, [formData.cement_weight, formData.concrete_volume_m3, formData.peso_artefato, formData.product_type, recipeMaterialsData, cementMaterial, selectedRecipe]);

  useEffect(() => {
    const materialCost = parseFloat(formData.material_cost) || 0;
    const laborPercentage = parseFloat(formData.labor_cost) || 0;
    const fixedPercentage = parseFloat(formData.fixed_cost) || 0;
    const transportCost = parseFloat(formData.transport_cost) || 0;
    const lossPercentage = parseFloat(formData.loss_cost) || 0;

    const laborCost = materialCost * (laborPercentage / 100);
    const fixedCost = materialCost * (fixedPercentage / 100);
    const lossCost = materialCost * (lossPercentage / 100);

    const productionCost = materialCost + laborCost + fixedCost + transportCost + lossCost;

    setFormData((prev) => ({
      ...prev,
      production_cost: productionCost.toFixed(2),
    }));
  }, [
    formData.material_cost,
    formData.labor_cost,
    formData.fixed_cost,
    formData.transport_cost,
    formData.loss_cost,
  ]);

  useEffect(() => {
    const productionCost = parseFloat(formData.production_cost) || 0;
    const marginPercentage = parseFloat(formData.margin_percentage) || 0;

    if (productionCost > 0 && marginPercentage > 0) {
      const salePrice = productionCost * (1 + marginPercentage / 100);
      setFormData((prev) => ({
        ...prev,
        sale_price: salePrice.toFixed(2),
      }));
    }
  }, [formData.production_cost, formData.margin_percentage]);

  useEffect(() => {
    const salePrice = parseFloat(formData.sale_price) || 0;
    const taxPercentage = parseFloat(formData.tax_percentage) || 0;

    if (salePrice > 0) {
      const finalPrice = salePrice * (1 + taxPercentage / 100);
      setFormData((prev) => ({
        ...prev,
        final_sale_price: finalPrice.toFixed(2),
      }));
    }
  }, [formData.sale_price, formData.tax_percentage]);

  const exportToPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Relatório de Produtos', 14, 20);

    doc.setFontSize(11);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 28);
    doc.text(`Total de produtos: ${products.length}`, 14, 34);

    const headers = [['Código', 'Nome', 'Descrição', 'Unidade', 'Traço', 'Peso Total (kg)', 'Preço Final (R$)', 'Estoque Mín.']];

    const rows = products.map(product => [
      (product as any).code || '-',
      product.name,
      product.description || '-',
      product.unit,
      product.recipes?.name || '-',
      product.total_weight ? product.total_weight.toString() : '-',
      (product as any).final_sale_price ? `R$ ${parseFloat((product as any).final_sale_price.toString()).toFixed(2)}` : '-',
      product.minimum_stock ? product.minimum_stock.toString() : '-'
    ]);

    autoTable(doc, {
      head: headers,
      body: rows,
      startY: 40,
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [10, 126, 194],
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 40 },
        2: { cellWidth: 20 },
        3: { cellWidth: 30 },
        4: { cellWidth: 25 },
        5: { cellWidth: 25 },
        6: { cellWidth: 20 }
      },
      margin: { top: 40 }
    });

    doc.save(`produtos_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const addReinforcement = () => {
    if (!reinforcementForm.material_id || !reinforcementForm.bar_count || !reinforcementForm.bar_diameter_mm) {
      alert('Preencha todos os campos obrigatórios da armadura');
      return;
    }

    if (reinforcementForm.type === 'longitudinal') {
      if (!reinforcementForm.identifier) {
        alert('Preencha o identificador da armadura longitudinal (A, B, C, etc.)');
        return;
      }
      if (!reinforcementForm.reference_length_meters) {
        alert('Preencha a medida padrão da armadura longitudinal');
        return;
      }
      if (!formData.column_length_total || !formData.reference_measurement) {
        alert('Preencha o Comprimento Total do Pilar e a Medida de Referência no topo do formulário');
        return;
      }
    } else {
      if (!reinforcementForm.bar_length_meters) {
        alert('Preencha o comprimento por barra');
        return;
      }
    }

    if (!reinforcementForm.description) {
      alert('Preencha a descrição da armadura');
      return;
    }

    const material = materials.find(m => m.id === reinforcementForm.material_id);

    if (editingReinforcementId) {
      // Editando uma armadura existente
      setReinforcements(reinforcements.map(r =>
        r.tempId === editingReinforcementId
          ? {
              ...r,
              type: reinforcementForm.type,
              reinforcement_location: reinforcementForm.reinforcement_location,
              identifier: reinforcementForm.identifier || null,
              material_id: reinforcementForm.material_id,
              material_name: material?.name,
              bar_count: parseFloat(reinforcementForm.bar_count),
              bar_length_meters: parseFloat(reinforcementForm.bar_length_meters),
              bar_diameter_mm: parseFloat(reinforcementForm.bar_diameter_mm),
              longitudinal_position: (reinforcementForm.longitudinal_position && reinforcementForm.longitudinal_position.trim() !== '') ? reinforcementForm.longitudinal_position : null,
              description: reinforcementForm.description,
              notes: reinforcementForm.notes,
              reference_length_meters: reinforcementForm.reference_length_meters ? parseFloat(reinforcementForm.reference_length_meters) : undefined,
              length_adjustment_meters: reinforcementForm.length_adjustment_meters ? parseFloat(reinforcementForm.length_adjustment_meters) : undefined,
              calculated_total_length_meters: reinforcementForm.calculated_total_length_meters ? parseFloat(reinforcementForm.calculated_total_length_meters) : undefined,
              stirrup_standard_length_meters: reinforcementForm.stirrup_standard_length_meters ? parseFloat(reinforcementForm.stirrup_standard_length_meters) : undefined,
              stirrup_standard_quantity: reinforcementForm.stirrup_standard_quantity ? parseInt(reinforcementForm.stirrup_standard_quantity) : undefined,
              stirrup_spacing_meters: reinforcementForm.stirrup_spacing_meters ? parseFloat(reinforcementForm.stirrup_spacing_meters) : undefined,
              stirrup_calculated_additional: reinforcementForm.stirrup_calculated_additional ? parseInt(reinforcementForm.stirrup_calculated_additional) : undefined,
              stirrup_special_total_meters: reinforcementForm.stirrup_special_total_meters ? parseFloat(reinforcementForm.stirrup_special_total_meters) : undefined,
              stirrup_total_meters: reinforcementForm.stirrup_total_meters ? parseFloat(reinforcementForm.stirrup_total_meters) : undefined,
            }
          : r
      ));
      setEditingReinforcementId(null);
    } else {
      // Adicionando nova armadura
      const newReinforcement: Reinforcement = {
        tempId: Math.random().toString(),
        type: reinforcementForm.type,
        reinforcement_location: reinforcementForm.reinforcement_location,
        identifier: reinforcementForm.identifier || null,
        material_id: reinforcementForm.material_id,
        material_name: material?.name,
        bar_count: parseFloat(reinforcementForm.bar_count),
        bar_length_meters: parseFloat(reinforcementForm.bar_length_meters),
        bar_diameter_mm: parseFloat(reinforcementForm.bar_diameter_mm),
        longitudinal_position: (reinforcementForm.longitudinal_position && reinforcementForm.longitudinal_position.trim() !== '') ? reinforcementForm.longitudinal_position : null,
        description: reinforcementForm.description,
        notes: reinforcementForm.notes,
        reference_length_meters: reinforcementForm.reference_length_meters ? parseFloat(reinforcementForm.reference_length_meters) : undefined,
        length_adjustment_meters: reinforcementForm.length_adjustment_meters ? parseFloat(reinforcementForm.length_adjustment_meters) : undefined,
        calculated_total_length_meters: reinforcementForm.calculated_total_length_meters ? parseFloat(reinforcementForm.calculated_total_length_meters) : undefined,
        stirrup_standard_length_meters: reinforcementForm.stirrup_standard_length_meters ? parseFloat(reinforcementForm.stirrup_standard_length_meters) : undefined,
        stirrup_standard_quantity: reinforcementForm.stirrup_standard_quantity ? parseInt(reinforcementForm.stirrup_standard_quantity) : undefined,
        stirrup_spacing_meters: reinforcementForm.stirrup_spacing_meters ? parseFloat(reinforcementForm.stirrup_spacing_meters) : undefined,
        stirrup_calculated_additional: reinforcementForm.stirrup_calculated_additional ? parseInt(reinforcementForm.stirrup_calculated_additional) : undefined,
        stirrup_special_total_meters: reinforcementForm.stirrup_special_total_meters ? parseFloat(reinforcementForm.stirrup_special_total_meters) : undefined,
        stirrup_total_meters: reinforcementForm.stirrup_total_meters ? parseFloat(reinforcementForm.stirrup_total_meters) : undefined,
      };
      setReinforcements([...reinforcements, newReinforcement]);
    }

    setReinforcementForm({
      type: 'longitudinal',
      reinforcement_location: 'base',
      identifier: '',
      material_id: '',
      bar_count: '',
      bar_length_meters: '',
      bar_diameter_mm: '',
      longitudinal_position: '',
      description: '',
      notes: '',
      reference_length_meters: '',
      length_adjustment_meters: '',
      calculated_total_length_meters: '',
      stirrup_standard_length_meters: '',
      stirrup_standard_quantity: '',
      stirrup_spacing_meters: '',
      stirrup_calculated_additional: '',
      stirrup_special_total_meters: '',
      stirrup_total_meters: '',
    });
    setIsEditingReferenceLengthField(false);
  };

  const removeReinforcement = (tempId: string) => {
    setReinforcements(reinforcements.filter(r => r.tempId !== tempId));
    if (editingReinforcementId === tempId) {
      setEditingReinforcementId(null);
      setReinforcementForm({
        type: 'longitudinal',
        reinforcement_location: 'base',
        material_id: '',
        bar_count: '',
        bar_length_meters: '',
        bar_diameter_mm: '',
        longitudinal_position: '',
        description: '',
        notes: '',
        reference_length_meters: '',
        length_adjustment_meters: '',
        calculated_total_length_meters: '',
        stirrup_standard_length_meters: '',
        stirrup_standard_quantity: '',
        stirrup_spacing_meters: '',
        stirrup_calculated_additional: '',
        stirrup_special_total_meters: '',
        stirrup_total_meters: '',
      });
      setIsEditingReferenceLengthField(false);
    }
  };

  const updateReinforcementMaterial = (tempId: string, newMaterialId: string) => {
    const material = materials.find(m => m.id === newMaterialId);
    if (!material) {
      setReinforcements(reinforcements.map(r =>
        r.tempId === tempId
          ? { ...r, material_id: '', material_name: '' }
          : r
      ));
      return;
    }

    console.log('📦 Material selecionado:', material.name);
    console.log('💰 Custo:', material.unit_cost || material.cost_per_meter, `/${material.unit}`);

    setReinforcements(reinforcements.map(r =>
      r.tempId === tempId
        ? { ...r, material_id: newMaterialId, material_name: material.name }
        : r
    ));
  };

  const updateReinforcementDiameter = (tempId: string, newDiameter: number) => {
    setReinforcements(reinforcements.map(r =>
      r.tempId === tempId
        ? { ...r, bar_diameter_mm: newDiameter }
        : r
    ));
  };


  const addAccessory = () => {
    if (!accessoryForm.accessory_type || !accessoryForm.material_id || !accessoryForm.quantity) {
      alert('Preencha os campos obrigatórios do material auxiliar');
      return;
    }

    const material = materials.find(m => m.id === accessoryForm.material_id);
    const product = products.find(p => p.id === accessoryForm.material_id);
    const itemName = accessoryForm.item_type === 'material' ? material?.name : product?.name;

    if (editingAccessoryId) {
      // Editando um acessório existente
      setAccessories(accessories.map(a =>
        a.tempId === editingAccessoryId
          ? {
              ...a,
              accessory_type: accessoryForm.accessory_type,
              item_type: accessoryForm.item_type,
              material_id: accessoryForm.material_id,
              material_name: itemName,
              quantity: parseFloat(accessoryForm.quantity),
              description: accessoryForm.description,
            }
          : a
      ));
      setEditingAccessoryId(null);
    } else {
      // Adicionando novo acessório
      const newAccessory: Accessory = {
        tempId: Math.random().toString(),
        accessory_type: accessoryForm.accessory_type,
        item_type: accessoryForm.item_type,
        material_id: accessoryForm.material_id,
        material_name: itemName,
        quantity: parseFloat(accessoryForm.quantity),
        description: accessoryForm.description,
      };
      setAccessories([...accessories, newAccessory]);
    }

    setAccessoryForm({
      accessory_type: '',
      item_type: 'material',
      material_id: '',
      quantity: '',
      description: '',
    });
  };

  const editAccessory = (tempId: string) => {
    const accessory = accessories.find(a => a.tempId === tempId);
    if (accessory) {
      setAccessoryForm({
        accessory_type: accessory.accessory_type,
        item_type: accessory.item_type || 'material',
        material_id: accessory.material_id,
        quantity: accessory.quantity.toString(),
        description: accessory.description,
      });
      setEditingAccessoryId(tempId);

      // Scroll para o formulário
      const accessorySection = document.querySelector('.bg-green-50');
      if (accessorySection) {
        accessorySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const removeAccessory = (tempId: string) => {
    setAccessories(accessories.filter(a => a.tempId !== tempId));
    if (editingAccessoryId === tempId) {
      setEditingAccessoryId(null);
      setAccessoryForm({
        accessory_type: '',
        item_type: 'material',
        material_id: '',
        quantity: '',
        description: '',
      });
    }
  };

  const calculateReinforcementWeight = (barCount: number, lengthMeters: number, diameterMm: number): number => {
    const radiusMeters = (diameterMm / 1000) / 2;
    const volumeM3 = Math.PI * Math.pow(radiusMeters, 2) * lengthMeters * barCount;
    const steelDensity = 7850;
    return volumeM3 * steelDensity;
  };

  const calculateCompleteCostMemory = async () => {
    console.log('🧮 Calculando memória de custos...');
    console.log('📊 Estado atual:', {
      recipe_id: formData.recipe_id,
      product_type: formData.product_type,
      concrete_volume_m3: formData.concrete_volume_m3,
      cement_weight: formData.cement_weight,
      recipeMaterialsData_length: recipeMaterialsData.length,
      cementMaterial: cementMaterial?.materials?.name,
      selectedRecipe_specific_weight: selectedRecipe?.specific_weight,
      accessories_length: accessories.length
    });

    // TRATAMENTO ESPECIAL PARA FERRAGENS DIVERSAS
    if (formData.product_type === 'ferragens_diversas') {
      console.log('✅ Calculando custos para Ferragens Diversas');

      if (accessories.length === 0) {
        console.log('⚠️ Nenhum insumo adicionado ainda');
        setCostMemory(null);
        return;
      }

      try {
        const accessoryCosts = await Promise.all(
          accessories.map(async (a) => {
            let itemName = '';
            let unitCost = 0;
            let displayUnit = 'unid';

            if (a.material_id && a.material_id.trim() !== '') {
              if (a.item_type === 'product') {
                const { data: productData } = await supabase
                  .from('products')
                  .select('name, sale_price')
                  .eq('id', a.material_id)
                  .maybeSingle();

                itemName = productData?.name || '';
                unitCost = productData?.sale_price || 0;
                displayUnit = 'unid';
              } else {
                const { data: materialData } = await supabase
                  .from('materials')
                  .select('name, unit_cost, cost_per_meter, unit')
                  .eq('id', a.material_id)
                  .maybeSingle();

                itemName = materialData?.name || '';
                unitCost = materialData?.unit_cost || materialData?.cost_per_meter || 0;
                displayUnit = materialData?.unit || 'unid';
              }
            }

            const totalCost = parseFloat(a.quantity) * unitCost;

            return {
              material_name: itemName,
              quantity: parseFloat(a.quantity),
              unit: displayUnit,
              unit_cost: unitCost,
              total_cost: totalCost,
            };
          })
        );

        const accessoryTotalCost = accessoryCosts.reduce((sum, item) => sum + item.total_cost, 0);

        const memory: CostMemory = {
          traceMaterials: [],
          reinforcements: [],
          accessories: accessoryCosts,
          totalWeight: 0,
          totalCost: accessoryTotalCost,
        };

        console.log('💾 Salvando memória de cálculo (Ferragens Diversas):', {
          insumos: accessoryCosts.length,
          custoTotal: accessoryTotalCost
        });

        setCostMemory(memory);

        setFormData((prev) => ({
          ...prev,
          material_cost: accessoryTotalCost.toFixed(2),
          total_weight: '0',
        }));

        console.log('✅ Memória de cálculo salva com sucesso para Ferragens Diversas!');
        return;
      } catch (error: any) {
        console.error('❌ Erro ao calcular custos para Ferragens Diversas:', error);
        return;
      }
    }

    // VALIDAÇÕES PARA OUTROS TIPOS DE PRODUTOS
    if (!formData.recipe_id) {
      console.log('❌ Sem recipe_id');
      setCostMemory(null);
      return;
    }

    if (recipeMaterialsData.length === 0) {
      console.log('❌ Sem materiais do traço');
      setCostMemory(null);
      return;
    }

    // Para produtos pré-moldados, não precisamos do cementMaterial
    if (formData.product_type === 'premolded') {
      if (!formData.concrete_volume_m3) {
        console.log('❌ Produto pré-moldado sem volume de concreto');
        setCostMemory(null);
        return;
      }
      if (!selectedRecipe?.specific_weight) {
        console.log('❌ Traço sem peso específico');
        setCostMemory(null);
        return;
      }
    } else if (formData.product_type === 'artifact') {
      // Para artefatos, verificar se tem peso_artefato
      if (!formData.peso_artefato) {
        console.log('❌ Artefato sem peso unitário');
        setCostMemory(null);
        return;
      }
    } else {
      // Para outros produtos, precisamos do cementMaterial
      if (!cementMaterial) {
        console.log('❌ Produto sem material de cimento identificado');
        setCostMemory(null);
        return;
      }
      if (!formData.cement_weight) {
        console.log('❌ Produto sem peso de cimento');
        setCostMemory(null);
        return;
      }
    }

    try {
      let traceWeight = 0;
      let traceMaterials: any[] = [];

      // Para produtos pré-moldados, calcular peso baseado no volume × peso específico
      if (formData.product_type === 'premolded' && formData.concrete_volume_m3 && selectedRecipe?.specific_weight) {
        console.log('✅ Calculando para produto pré-moldado');
        const volumeM3 = parseFloat(formData.concrete_volume_m3);
        const specificWeight = selectedRecipe.specific_weight;
        traceWeight = volumeM3 * specificWeight;
        console.log('📐 Volume:', volumeM3, 'm³ × Peso específico:', specificWeight, 'kg/m³ = Peso da peça:', traceWeight, 'kg');

        // Calcular SOMA TOTAL do traço (todos os materiais)
        const totalTraceWeight = recipeMaterialsData.reduce((sum, mat) => sum + mat.quantity, 0);
        console.log('📊 Peso total do traço base:', totalTraceWeight, 'kg');

        // Calcular multiplicador proporcional: peso da peça / peso total do traço
        const multiplier = traceWeight / totalTraceWeight;
        console.log('🔢 Multiplicador proporcional:', multiplier.toFixed(4), '(', traceWeight, '/', totalTraceWeight, ')');

        // Calcular consumo proporcional de cada material
        traceMaterials = recipeMaterialsData.map((materialData) => {
          // Consumo proporcional: quantidade no traço × multiplicador
          const materialConsumption = materialData.quantity * multiplier;
          const unitCost = materialData.materials.unit_cost || 0;
          const totalCost = materialConsumption * unitCost;

          console.log(`  📦 ${materialData.materials.name}: ${materialData.quantity} ${materialData.materials.unit} × ${multiplier.toFixed(4)} = ${materialConsumption.toFixed(4)} ${materialData.materials.unit} → R$ ${totalCost.toFixed(2)}`);

          return {
            material_name: materialData.materials.name,
            quantity: materialConsumption,
            unit: materialData.materials.unit,
            unit_cost: unitCost,
            total_cost: totalCost,
            recipe_quantity_per_m3: materialData.quantity, // Guardar para exibir na memória
          };
        });
        console.log('✅ Total de materiais calculados:', traceMaterials.length);
      } else if (formData.product_type === 'artifact' && formData.peso_artefato) {
        // Para artefatos: calcular baseado no peso do produto e proporção dos insumos no traço
        console.log('✅ Calculando para artefato');
        const pesoArtefato = parseFloat(formData.peso_artefato);

        // Calcular SOMA TOTAL do traço (todos os materiais SEM umidade)
        const totalTraceWeightWithoutMoisture = recipeMaterialsData.reduce((sum, mat) => sum + mat.quantity, 0);
        console.log('📊 Peso total do traço (sem umidade):', totalTraceWeightWithoutMoisture, 'kg');

        // Obter percentual de umidade do traço (se existir)
        const moisturePercentage = selectedRecipe?.moisture_percentage || 0;
        console.log('💧 Umidade do traço:', moisturePercentage, '%');

        // Calcular peso sem umidade do produto
        // Fórmula: peso_sem_umidade = peso_com_umidade / (1 + umidade/100)
        const pesoSemUmidade = moisturePercentage > 0
          ? pesoArtefato / (1 + moisturePercentage / 100)
          : pesoArtefato;
        console.log('⚖️ Peso do artefato:', pesoArtefato, 'kg');
        console.log('📉 Peso sem umidade:', pesoSemUmidade.toFixed(4), 'kg');

        // Calcular multiplicador proporcional: peso sem umidade / peso total do traço
        const multiplier = pesoSemUmidade / totalTraceWeightWithoutMoisture;
        console.log('🔢 Multiplicador proporcional:', multiplier.toFixed(4), '(', pesoSemUmidade.toFixed(4), '/', totalTraceWeightWithoutMoisture, ')');

        // Calcular consumo proporcional de cada material
        traceMaterials = recipeMaterialsData.map((materialData) => {
          // Consumo proporcional: quantidade no traço × multiplicador
          const materialConsumption = materialData.quantity * multiplier;
          const unitCost = materialData.materials.unit_cost || 0;
          const totalCost = materialConsumption * unitCost;

          console.log(`  📦 ${materialData.materials.name}: ${materialData.quantity} ${materialData.materials.unit} × ${multiplier.toFixed(4)} = ${materialConsumption.toFixed(4)} ${materialData.materials.unit} → R$ ${totalCost.toFixed(2)}`);

          return {
            material_name: materialData.materials.name,
            quantity: materialConsumption,
            unit: materialData.materials.unit,
            unit_cost: unitCost,
            total_cost: totalCost,
            recipe_quantity: materialData.quantity, // Guardar para exibir na memória
          };
        });

        traceWeight = pesoSemUmidade;
        console.log('✅ Total de materiais calculados:', traceMaterials.length);
      } else if (formData.cement_weight) {
        // Para outros produtos, usar o peso do cimento informado
        const cementWeightValue = parseFloat(formData.cement_weight);
        const cementRatioInRecipe = cementMaterial.quantity;

        traceMaterials = recipeMaterialsData.map((materialData) => {
          const proportionalWeight = (materialData.quantity / cementRatioInRecipe) * cementWeightValue;
          const unitCost = materialData.materials.unit_cost || 0;
          const totalCost = proportionalWeight * unitCost;

          return {
            material_name: materialData.materials.name,
            quantity: proportionalWeight,
            unit: materialData.materials.unit,
            unit_cost: unitCost,
            total_cost: totalCost,
          };
        });

        traceWeight = traceMaterials.reduce((sum, item) => sum + item.quantity, 0);
      } else {
        setCostMemory(null);
        return;
      }

      const reinforcementCosts = await Promise.all(
        reinforcements.map(async (r) => {
          const material = materials.find(m => m.id === r.material_id);
          const weightKg = calculateReinforcementWeight(r.bar_count, r.bar_length_meters, r.bar_diameter_mm);
          const totalLengthMeters = r.bar_count * r.bar_length_meters;

          let costPerMeter = 0;
          if (r.material_id && r.material_id.trim() !== '') {
            const { data: materialData } = await supabase
              .from('materials')
              .select('unit_cost, cost_per_meter')
              .eq('id', r.material_id)
              .maybeSingle();

            costPerMeter = materialData?.unit_cost || materialData?.cost_per_meter || 0;
          }

          const totalCost = totalLengthMeters * costPerMeter;

          return {
            description: r.description,
            material_name: material?.name || '',
            bar_count: r.bar_count,
            bar_length_meters: r.bar_length_meters,
            bar_diameter_mm: r.bar_diameter_mm,
            weight_kg: weightKg,
            unit_cost: costPerMeter,
            total_cost: totalCost,
          };
        })
      );

      const accessoryCosts = await Promise.all(
        accessories.map(async (a) => {
          const material = materials.find(m => m.id === a.material_id);

          let unitCost = 0;
          let displayUnit = 'unid';
          if (a.material_id && a.material_id.trim() !== '') {
            const { data: materialData } = await supabase
              .from('materials')
              .select('unit_cost, cost_per_meter, unit')
              .eq('id', a.material_id)
              .maybeSingle();

            unitCost = materialData?.unit_cost || materialData?.cost_per_meter || 0;
            displayUnit = materialData?.unit || 'unid';
          }

          const totalCost = a.quantity * unitCost;

          return {
            material_name: material?.name || '',
            quantity: a.quantity,
            unit: displayUnit,
            unit_cost: unitCost,
            total_cost: totalCost,
          };
        })
      );

      const reinforcementWeight = reinforcementCosts.reduce((sum, item) => sum + item.weight_kg, 0);
      const totalWeight = traceWeight + reinforcementWeight;

      const traceTotalCost = traceMaterials.reduce((sum, item) => sum + item.total_cost, 0);
      const reinforcementTotalCost = reinforcementCosts.reduce((sum, item) => sum + item.total_cost, 0);
      const accessoryTotalCost = accessoryCosts.reduce((sum, item) => sum + item.total_cost, 0);
      const totalCost = traceTotalCost + reinforcementTotalCost + accessoryTotalCost;

      const memory: CostMemory = {
        traceMaterials,
        reinforcements: reinforcementCosts,
        accessories: accessoryCosts,
        totalWeight,
        totalCost,
      };

      console.log('💾 Salvando memória de cálculo:', {
        materiais: traceMaterials.length,
        armaduras: reinforcementCosts.length,
        acessorios: accessoryCosts.length,
        pesoTotal: totalWeight,
        custoTotal: totalCost
      });

      setCostMemory(memory);

      setFormData((prev) => ({
        ...prev,
        material_cost: totalCost.toFixed(2),
        total_weight: totalWeight.toFixed(2),
      }));

      console.log('✅ Memória de cálculo salva com sucesso!');
    } catch (error: any) {
      console.error('❌ Erro ao calcular memória de custos:', error);
    }
  };

  useEffect(() => {
    // Recalcular quando houver mudanças relevantes
    const shouldCalculate =
      (formData.cement_weight && recipeMaterialsData.length > 0 && cementMaterial) ||
      (formData.product_type === 'premolded' && formData.concrete_volume_m3 && selectedRecipe?.specific_weight && recipeMaterialsData.length > 0) ||
      (formData.product_type === 'ferragens_diversas' && accessories.length > 0);

    console.log('🔄 useEffect disparado - shouldCalculate:', shouldCalculate);

    if (shouldCalculate) {
      calculateCompleteCostMemory();
    } else {
      console.log('⏭️  Cálculo não executado - condições não satisfeitas');
    }
  }, [
    formData.cement_weight,
    formData.concrete_volume_m3,
    formData.product_type,
    recipeMaterialsData,
    cementMaterial,
    reinforcements,
    accessories,
    materials,
    selectedRecipe
  ]);


  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const filteredProducts = useMemo(() => {
    return products.filter(product =>
      product.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    );
  }, [products, debouncedSearchTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Carregando produtos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Package className="w-8 h-8 text-blue-600" />
          Produtos
        </h2>
        <button
          onClick={exportToPDF}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <FileDown className="w-5 h-5" />
          Exportar PDF
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">
            {editingId ? 'Editar Produto' : 'Novo Produto'}
          </h3>
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${formData.is_simple_registration ? 'bg-green-100' : 'bg-blue-100'}`}>
                {formData.is_simple_registration ? (
                  <Zap className="w-6 h-6 text-green-600" />
                ) : (
                  <Settings className="w-6 h-6 text-blue-600" />
                )}
              </div>
              <div>
                <div className="font-semibold text-gray-800 text-base">
                  {formData.is_simple_registration ? 'Cadastro Simplificado' : 'Cadastro Detalhado Completo'}
                </div>
                <div className="text-sm text-gray-600">
                  {formData.is_simple_registration
                    ? 'Informe valores manualmente (custos e margens)'
                    : 'Composição completa com traço, armaduras e cálculos automáticos'
                  }
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setFormData({
                  ...formData,
                  is_simple_registration: !formData.is_simple_registration
                });
              }}
              className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                formData.is_simple_registration ? 'bg-green-500' : 'bg-blue-500'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform ${
                  formData.is_simple_registration ? 'translate-x-9' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {formData.is_simple_registration && (
            <div className="mt-4 flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <span className="font-semibold">Atenção:</span> No modo simplificado, o sistema não possui informações suficientes para atualizar automaticamente o estoque de insumos.
                Recomendado apenas para produtos revendidos ou quando não há necessidade de controle detalhado de composição.
              </div>
            </div>
          )}
        </div>

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
              placeholder="Código do produto"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unidade de Medida
            </label>
            <select
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="unid">Unidade</option>
              <option value="m³">m³</option>
              <option value="m²">m²</option>
              <option value="m">Metro</option>
              <option value="kg">Quilograma</option>
              <option value="t">Tonelada</option>
            </select>
          </div>

          {!formData.is_simple_registration && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Produto
              </label>
              <select
                value={formData.product_type}
                onChange={(e) => {
                  const newType = e.target.value as 'artifact' | 'premolded' | 'ferragens_diversas';
                  setFormData({ ...formData, product_type: newType, mold_id: '', recipe_id: '' });
                  setSelectedMold(null);
                  setMoldReinforcements([]);
                  setSelectedRecipe(null);
                  if (newType !== 'premolded') {
                    setReinforcements([]);
                  }
                  // Limpa accessories apenas se mudar para 'artifact'
                  if (newType === 'artifact') {
                    setAccessories([]);
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="artifact">Artefato</option>
                <option value="premolded">Pré-Moldado</option>
                <option value="ferragens_diversas">Ferragens Diversas</option>
              </select>
            </div>
          )}

          {!formData.is_simple_registration && formData.product_type === 'premolded' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Selecionar Fôrma (Opcional)
                </label>
                <select
                  value={formData.mold_id}
                  onChange={(e) => {
                    setFormData({ ...formData, mold_id: e.target.value });
                    if (e.target.value) {
                      loadMoldData(e.target.value, formData.column_length_total);
                    } else {
                      setSelectedMold(null);
                      setMoldReinforcements([]);
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Nenhuma (Cadastro Manual)</option>
                  {molds.map((mold) => (
                    <option key={mold.id} value={mold.id}>
                      {mold.name}
                    </option>
                  ))}
                </select>
                {selectedMold && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Fôrma aplicada! Medidas e armaduras carregadas automaticamente.
                  </p>
                )}
              </div>

              {selectedMold?.has_flange && (
                <div className="border-l-4 border-blue-400 bg-blue-50 p-4 rounded">
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      id="product_has_flange"
                      checked={formData.has_flange}
                      onChange={(e) => setFormData({ ...formData, has_flange: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="product_has_flange" className="text-sm font-medium text-gray-900">
                      Este produto possui aba (tesoura)
                    </label>
                  </div>

                  {formData.has_flange && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Comprimento da Aba (m)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.flange_length_meters}
                        onChange={(e) => setFormData({ ...formData, flange_length_meters: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Ex: 4.85"
                      />
                      <p className="text-xs text-gray-600 mt-1">
                        O volume da aba será calculado automaticamente com base nas medidas da fôrma
                      </p>
                      {selectedMold.flange_reference_measurement_meters && selectedMold.flange_reference_volume_m3 && formData.flange_length_meters && (
                        <p className="text-xs text-blue-600 mt-2">
                          Volume estimado da aba: {(
                            (selectedMold.flange_reference_volume_m3 / selectedMold.flange_reference_measurement_meters) *
                            parseFloat(formData.flange_length_meters)
                          ).toFixed(4)} m³
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

        </div>

        {formData.is_simple_registration && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                  placeholder="Descrição do produto"
                />
              </div>
            </div>

            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-900 mb-3">
                Informações Fiscais (Para Nota Fiscal)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    NCM
                  </label>
                  <input
                    type="text"
                    value={formData.ncm}
                    onChange={(e) => setFormData({ ...formData, ncm: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: 68109900"
                    maxLength={8}
                  />
                  <p className="text-xs text-gray-500 mt-1">Nomenclatura Comum do Mercosul (8 dígitos)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CFOP
                  </label>
                  <input
                    type="text"
                    value={formData.cfop}
                    onChange={(e) => setFormData({ ...formData, cfop: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: 5101"
                    maxLength={4}
                  />
                  <p className="text-xs text-gray-500 mt-1">Código Fiscal de Operações (4 dígitos)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CSOSN
                  </label>
                  <input
                    type="text"
                    value={formData.csosn}
                    onChange={(e) => setFormData({ ...formData, csosn: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: 101"
                    maxLength={4}
                  />
                  <p className="text-xs text-gray-500 mt-1">Código Simples Nacional (3-4 dígitos)</p>
                </div>
              </div>
            </div>

            {formData.product_type !== 'ferragens_diversas' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Traço de Concreto
                  </label>
                  <select
                    value={formData.recipe_id}
                    onChange={(e) => setFormData({ ...formData, recipe_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Selecione um traço (opcional)</option>
                    {recipes.map((recipe) => (
                      <option key={recipe.id} value={recipe.id}>
                        {recipe.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estoque Mínimo
                  </label>
                  <input
                    type="number"
                    value={formData.minimum_stock}
                    onChange={(e) => setFormData({ ...formData, minimum_stock: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: 10"
                  />
                </div>
              </div>
            )}

            {formData.product_type === 'artifact' && formData.recipe_id && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 space-y-4">
                <h4 className="text-base font-semibold text-blue-800 flex items-center gap-2">
                  <Scale className="w-5 h-5" />
                  Cálculo de Consumo de Insumos para Artefatos
                </h4>
                <p className="text-sm text-blue-700">
                  Informe o peso unitário do produto e o sistema calculará automaticamente o consumo proporcional de cada insumo baseado nas proporções do traço.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Peso Unitário do Produto (kg) *
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={formData.peso_artefato}
                      onChange={(e) => setFormData({ ...formData, peso_artefato: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: 100.000"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Peso de uma unidade do produto em kg (até 3 casas decimais)</p>
                  </div>

                  {selectedRecipe && recipeMaterialsData.length > 0 && (
                    <div className="flex items-center">
                      <div className="bg-white border border-blue-300 rounded-lg p-4 w-full">
                        <p className="text-sm text-gray-600">Peso Total do Traço</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {recipeMaterialsData.reduce((sum, mat) => sum + mat.quantity, 0).toFixed(2)} kg
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Soma de todos os insumos (sem umidade)
                        </p>
                        {selectedRecipe.moisture_percentage && selectedRecipe.moisture_percentage > 0 && (
                          <p className="text-xs text-blue-600 mt-2 font-semibold">
                            Umidade: {selectedRecipe.moisture_percentage}%
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {recipeMaterialsData.length > 0 && formData.peso_artefato && (
                  <div className="bg-white border-2 border-blue-300 rounded-lg p-4">
                    <p className="text-sm font-semibold text-blue-800 mb-2">Como funciona o cálculo:</p>
                    <ol className="text-xs text-gray-700 space-y-1 list-decimal list-inside">
                      <li>Peso informado do produto: {parseFloat(formData.peso_artefato).toFixed(2)} kg</li>
                      {selectedRecipe?.moisture_percentage && selectedRecipe.moisture_percentage > 0 ? (
                        <>
                          <li>Desconta umidade de {selectedRecipe.moisture_percentage}%: {(parseFloat(formData.peso_artefato) / (1 + selectedRecipe.moisture_percentage / 100)).toFixed(2)} kg</li>
                          <li>Divide proporcionalmente pelos insumos do traço</li>
                        </>
                      ) : (
                        <li>Divide proporcionalmente pelos insumos do traço</li>
                      )}
                      <li>Cada insumo é calculado mantendo a proporção do traço</li>
                    </ol>
                  </div>
                )}
              </div>
            )}

            {formData.product_type === 'artifact' && costMemory && (
              <div className="md:col-span-2 bg-orange-50 border-2 border-orange-200 rounded-lg p-4 space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  📊 Memória de Cálculo - Detalhamento de Custos
                </h3>

                {costMemory.traceMaterials.length > 0 && (
                  <div className="bg-white rounded-lg p-4 border border-gray-200 space-y-3">
                    <h4 className="font-semibold text-gray-800 text-sm border-b pb-2">Materiais do Traço</h4>

                    {formData.product_type === 'artifact' && formData.peso_artefato && selectedRecipe && (
                      <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm space-y-2">
                        <div className="font-medium text-blue-800 mb-2">Cálculo Proporcional:</div>
                        <div className="text-gray-700 space-y-1">
                          <div>Peso do produto: {parseFloat(formData.peso_artefato).toFixed(2)} kg</div>
                          {selectedRecipe.moisture_percentage && selectedRecipe.moisture_percentage > 0 && (
                            <div>Umidade: {selectedRecipe.moisture_percentage}%</div>
                          )}
                          <div className="font-semibold text-blue-700">
                            Peso sem umidade: {selectedRecipe.moisture_percentage && selectedRecipe.moisture_percentage > 0
                              ? (parseFloat(formData.peso_artefato) / (1 + selectedRecipe.moisture_percentage / 100)).toFixed(2)
                              : parseFloat(formData.peso_artefato).toFixed(2)} kg
                          </div>
                        </div>
                        <div className="text-xs text-gray-600 italic border-t border-blue-200 pt-2 mt-2">
                          Consumo de cada material = Quantidade no traço × Multiplicador proporcional
                        </div>
                      </div>
                    )}

                    {costMemory.traceMaterials.map((item, index) => (
                      <div key={index} className="py-3 border-b last:border-0">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-gray-800">{item.material_name}</div>
                          <div className="text-right font-bold text-lg text-gray-900">
                            R$ {item.total_cost.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded space-y-1">
                          <div className="flex items-center justify-between">
                            <span>Consumo:</span>
                            <span className="font-bold text-blue-600">{item.quantity.toFixed(4)} {item.unit}</span>
                          </div>
                          <div className="flex items-center justify-between text-gray-500">
                            <span>Custo unitário:</span>
                            <span>R$ {item.unit_cost.toFixed(2)}/{item.unit}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-2 border-t-2">
                      <span className="font-semibold text-gray-700">Subtotal Materiais:</span>
                      <span className="font-bold text-blue-600">
                        R$ {costMemory.traceMaterials.reduce((sum, item) => sum + item.total_cost, 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {costMemory.reinforcements.length > 0 && (
                  <div className="bg-white rounded-lg p-4 border border-gray-200 space-y-3">
                    <h4 className="font-semibold text-gray-800 text-sm border-b pb-2">Armaduras</h4>
                    {costMemory.reinforcements.map((item, index) => (
                      <div key={index} className="text-sm py-2 border-b last:border-0 space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-gray-800">{item.description}</div>
                            <div className="text-xs text-gray-600">
                              Material: {item.material_name}
                            </div>
                            <div className="text-xs text-gray-600">
                              {item.bar_count} barras × {item.bar_length_meters}m × Ø{item.bar_diameter_mm}mm = {(item.bar_count * item.bar_length_meters).toFixed(2)}m total
                            </div>
                            <div className="text-xs text-gray-600">
                              {(item.bar_count * item.bar_length_meters).toFixed(2)}m × R$ {item.unit_cost.toFixed(4)}/m
                            </div>
                          </div>
                          <div className="text-right font-semibold text-gray-800">
                            R$ {item.total_cost.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-2 border-t-2">
                      <div>
                        <div className="font-semibold text-gray-700">Subtotal Armaduras:</div>
                        <div className="text-xs text-gray-600">
                          Peso total: {costMemory.reinforcements.reduce((sum, item) => sum + item.weight_kg, 0).toFixed(3)} kg
                        </div>
                      </div>
                      <span className="font-bold text-blue-600">
                        R$ {costMemory.reinforcements.reduce((sum, item) => sum + item.total_cost, 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {costMemory.accessories.length > 0 && (
                  <div className="bg-white rounded-lg p-4 border border-gray-200 space-y-3">
                    <h4 className="font-semibold text-gray-800 text-sm border-b pb-2">Materiais Auxiliares</h4>
                    {costMemory.accessories.map((item, index) => (
                      <div key={index} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                        <div className="flex-1">
                          <div className="font-medium text-gray-800">{item.material_name}</div>
                          <div className="text-xs text-gray-600">
                            {item.quantity} {item.unit} × R$ {item.unit_cost.toFixed(2)}/{item.unit}
                          </div>
                        </div>
                        <div className="text-right font-semibold text-gray-800">
                          R$ {item.total_cost.toFixed(2)}
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-2 border-t-2">
                      <span className="font-semibold text-gray-700">Subtotal Materiais Auxiliares:</span>
                      <span className="font-bold text-blue-600">
                        R$ {costMemory.accessories.reduce((sum, item) => sum + item.total_cost, 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-4 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold mb-1">CUSTO TOTAL DE MATERIAIS</div>
                      {costMemory.totalWeight > 0 && (
                        <div className="text-xs opacity-90">Peso total: {costMemory.totalWeight.toFixed(2)} kg</div>
                      )}
                    </div>
                    <div className="text-3xl font-bold">
                      R$ {costMemory.totalCost.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 space-y-4">
              <h4 className="text-base font-semibold text-green-800 flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Cadastro Simplificado - Custos e Margens
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custo Unitário (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.manual_unit_cost}
                  onChange={(e) => setFormData({ ...formData, manual_unit_cost: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Ex: 50.00"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Custo de produção ou aquisição</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Imposto (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.manual_tax_percentage}
                  onChange={(e) => setFormData({ ...formData, manual_tax_percentage: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Ex: 18.50"
                />
                <p className="text-xs text-gray-500 mt-1">Percentual de impostos</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Margem de Lucro (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.manual_profit_margin_percentage}
                  onChange={(e) => setFormData({ ...formData, manual_profit_margin_percentage: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Ex: 30.00"
                />
                <p className="text-xs text-gray-500 mt-1">Margem de lucro desejada</p>
              </div>
            </div>

            {formData.manual_final_price && parseFloat(formData.manual_final_price) > 0 && (
              <div className="bg-green-100 border border-green-300 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-green-900">Preço Final Calculado:</span>
                  <span className="text-2xl font-bold text-green-700">
                    R$ {parseFloat(formData.manual_final_price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="mt-2 text-xs text-green-700 space-y-1">
                  <div>Custo Base: R$ {parseFloat(formData.manual_unit_cost || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  {formData.manual_tax_percentage && parseFloat(formData.manual_tax_percentage) > 0 && (
                    <div>+ Impostos ({formData.manual_tax_percentage}%): R$ {(parseFloat(formData.manual_unit_cost || '0') * parseFloat(formData.manual_tax_percentage) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  )}
                  {formData.manual_profit_margin_percentage && parseFloat(formData.manual_profit_margin_percentage) > 0 && (
                    <div>+ Margem ({formData.manual_profit_margin_percentage}%): R$ {(parseFloat(formData.manual_unit_cost || '0') * (1 + parseFloat(formData.manual_tax_percentage || '0') / 100) * parseFloat(formData.manual_profit_margin_percentage) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  )}
                </div>
              </div>
            )}
            </div>
          </div>
        )}

        {!formData.is_simple_registration && formData.product_type === 'ferragens_diversas' && (
          <div className="md:col-span-2 bg-blue-50 border-2 border-blue-300 rounded-lg p-6 space-y-4">
            <h4 className="text-base font-semibold text-blue-800 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Insumos e Materiais (Ferragens Diversas)
            </h4>
            <p className="text-sm text-gray-600">
              Adicione os insumos ou produtos que compõem este produto
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white p-4 rounded border border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Material *
                </label>
                <input
                  type="text"
                  value={accessoryForm.accessory_type}
                  onChange={(e) => setAccessoryForm({ ...accessoryForm, accessory_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Ferro, Solda, Mão de Obra"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Item *
                </label>
                <select
                  value={accessoryForm.item_type}
                  onChange={(e) => {
                    setAccessoryForm({
                      ...accessoryForm,
                      item_type: e.target.value as 'material' | 'product',
                      material_id: ''
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="material">Insumo/Material</option>
                  <option value="product">Produto</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {accessoryForm.item_type === 'material' ? 'Material/Insumo *' : 'Produto *'}
                </label>
                <select
                  value={accessoryForm.material_id}
                  onChange={(e) => setAccessoryForm({ ...accessoryForm, material_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">
                    {accessoryForm.item_type === 'material' ? 'Selecione o material' : 'Selecione o produto'}
                  </option>
                  {accessoryForm.item_type === 'material' ? (
                    materials.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} - R$ {m.unit_cost?.toFixed(2) || '0.00'}/{m.unit}
                      </option>
                    ))
                  ) : (
                    products
                      .filter(p => p.id !== editingId)
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.code ? `[${p.code}] ` : ''}{p.name} - R$ {p.sale_price?.toFixed(2) || '0.00'}
                        </option>
                      ))
                  )}
                </select>
                {accessoryForm.item_type === 'product' && products.filter(p => p.id !== editingId).length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Nenhum produto cadastrado ainda. Cadastre produtos primeiro para poder selecioná-los.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantidade *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={accessoryForm.quantity}
                  onChange={(e) => setAccessoryForm({ ...accessoryForm, quantity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: 4.5"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <input
                  type="text"
                  value={accessoryForm.description}
                  onChange={(e) => setAccessoryForm({ ...accessoryForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Para estrutura principal"
                />
              </div>

              <div className="md:col-span-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addAccessory}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    {editingAccessoryId ? (
                      <>
                        <Save className="w-4 h-4" />
                        Atualizar Insumo
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Adicionar Insumo
                      </>
                    )}
                  </button>
                  {editingAccessoryId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAccessoryId(null);
                        setAccessoryForm({
                          accessory_type: '',
                          item_type: 'material',
                          material_id: '',
                          quantity: '',
                          description: '',
                        });
                      }}
                      className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {accessories.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-sm font-medium text-gray-700">Insumos Adicionados:</h5>
                {accessories.map((a) => {
                  const material = materials.find(m => m.id === a.material_id);
                  const product = products.find(p => p.id === a.material_id);
                  const unitCost = a.item_type === 'product'
                    ? (product?.sale_price || 0)
                    : (material?.unit_cost || 0);
                  const totalCost = parseFloat(a.quantity) * unitCost;

                  return (
                    <div key={a.tempId} className="flex items-center justify-between bg-white p-3 rounded border border-gray-200">
                      <div className="flex-1">
                        <div className="font-medium text-sm">
                          {a.material_name}
                          <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                            {a.accessory_type}
                          </span>
                          <span className={`ml-2 px-2 py-0.5 text-xs rounded ${
                            a.item_type === 'product'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {a.item_type === 'product' ? 'Produto' : 'Material'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600">
                          Quantidade: {a.quantity} × R$ {unitCost.toFixed(2)} = R$ {totalCost.toFixed(2)}
                        </div>
                        {a.description && <div className="text-xs text-gray-500">{a.description}</div>}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => editAccessory(a.tempId)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                          title="Editar insumo"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeAccessory(a.tempId)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                          title="Excluir insumo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                <div className="bg-blue-100 p-3 rounded border border-blue-300">
                  <div className="text-sm font-semibold text-blue-900">
                    Custo Total dos Insumos: R$ {accessories.reduce((sum, a) => {
                      const material = materials.find(m => m.id === a.material_id);
                      const product = products.find(p => p.id === a.material_id);
                      const unitCost = a.item_type === 'product'
                        ? (product?.sale_price || 0)
                        : (material?.unit_cost || 0);
                      return sum + (parseFloat(a.quantity) * unitCost);
                    }, 0).toFixed(2)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}


        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {!formData.is_simple_registration && formData.product_type === 'premolded' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Comprimento Total da Peça (m) *
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.column_length_total}
                onChange={(e) => {
                  const length = e.target.value;
                  const area = formData.column_section_area_m2;
                  const volume = area && length ? (parseFloat(area) * parseFloat(length)).toFixed(6) : '';
                  setFormData({
                    ...formData,
                    column_length_total: length,
                    concrete_volume_m3: volume
                  });

                  // Recalcular armaduras se houver forma selecionada
                  if (formData.mold_id && length) {
                    console.log('♻️ Recalculando armaduras com novo comprimento:', length);
                    loadMoldData(formData.mold_id, length);
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: 3.00"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Comprimento da peça pré-moldada (utilizado nos cálculos)</p>
            </div>
          )}

          {formData.product_type === 'premolded' && formData.reference_measurement && formData.reference_volume && formData.column_length_total && (
            <div className="md:col-span-2 bg-white border border-indigo-300 rounded-lg p-4">
              <p className="text-sm text-gray-700">
                Consumo Total de Concreto:
                <span className="font-bold text-indigo-700 ml-2 text-lg">
                  {(() => {
                    const baseVolume = parseFloat(formData.reference_volume) * (parseFloat(formData.column_length_total) / parseFloat(formData.reference_measurement));
                    let flangeVolume = 0;
                    if (formData.has_flange && formData.flange_length_meters && selectedMold?.has_flange && selectedMold?.flange_reference_measurement_meters && selectedMold?.flange_reference_volume_m3) {
                      flangeVolume = (selectedMold.flange_reference_volume_m3 / selectedMold.flange_reference_measurement_meters) * parseFloat(formData.flange_length_meters);
                    }
                    return (baseVolume + flangeVolume).toFixed(6);
                  })()} m³
                </span>
              </p>
              {formData.has_flange && formData.flange_length_meters && selectedMold?.has_flange && selectedMold?.flange_reference_measurement_meters && selectedMold?.flange_reference_volume_m3 && (
                <p className="text-xs text-gray-600 mt-2">
                  Volume base: {(parseFloat(formData.reference_volume) * (parseFloat(formData.column_length_total) / parseFloat(formData.reference_measurement))).toFixed(6)} m³ +
                  Volume da aba: {((selectedMold.flange_reference_volume_m3 / selectedMold.flange_reference_measurement_meters) * parseFloat(formData.flange_length_meters)).toFixed(6)} m³
                </p>
              )}
            </div>
          )}

          {!formData.is_simple_registration && (
            <>
              <div className="md:col-span-2">
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Traço (Receita)
                </label>
                <select
                  value={formData.recipe_id}
                  onChange={(e) => setFormData({ ...formData, recipe_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Nenhum traço selecionado</option>
                  {recipes.map((recipe) => (
                    <option key={recipe.id} value={recipe.id}>
                      {recipe.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estoque Mínimo
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.minimum_stock}
                  onChange={(e) => setFormData({ ...formData, minimum_stock: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: 100"
                />
              </div>

              {formData.product_type === 'artifact' && formData.recipe_id && (
                <div className="md:col-span-2 bg-blue-50 border-2 border-blue-200 rounded-lg p-6 space-y-4">
                  <h4 className="text-base font-semibold text-blue-800 flex items-center gap-2">
                    <Scale className="w-5 h-5" />
                    Cálculo de Consumo de Insumos para Artefatos
                  </h4>
                  <p className="text-sm text-blue-700">
                    Informe o peso unitário do produto e o sistema calculará automaticamente o consumo proporcional de cada insumo baseado nas proporções do traço.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Peso Unitário do Produto (kg) *
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        value={formData.peso_artefato}
                        onChange={(e) => setFormData({ ...formData, peso_artefato: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Ex: 100.000"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">Peso de uma unidade do produto em kg (até 3 casas decimais)</p>
                    </div>

                    {selectedRecipe && recipeMaterialsData.length > 0 && (
                      <div className="flex items-center">
                        <div className="bg-white border border-blue-300 rounded-lg p-4 w-full">
                          <p className="text-sm text-gray-600">Peso Total do Traço</p>
                          <p className="text-2xl font-bold text-blue-600">
                            {recipeMaterialsData.reduce((sum, mat) => sum + mat.quantity, 0).toFixed(2)} kg
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Soma de todos os insumos (sem umidade)
                          </p>
                          {selectedRecipe.moisture_percentage && selectedRecipe.moisture_percentage > 0 && (
                            <p className="text-xs text-blue-600 mt-2 font-semibold">
                              Umidade: {selectedRecipe.moisture_percentage}%
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {recipeMaterialsData.length > 0 && formData.peso_artefato && (
                    <div className="bg-white border-2 border-blue-300 rounded-lg p-4">
                      <p className="text-sm font-semibold text-blue-800 mb-2">Como funciona o cálculo:</p>
                      <ol className="text-xs text-gray-700 space-y-1 list-decimal list-inside">
                        <li>Peso informado do produto: {parseFloat(formData.peso_artefato).toFixed(2)} kg</li>
                        {selectedRecipe?.moisture_percentage && selectedRecipe.moisture_percentage > 0 ? (
                          <>
                            <li>Desconta umidade de {selectedRecipe.moisture_percentage}%: {(parseFloat(formData.peso_artefato) / (1 + selectedRecipe.moisture_percentage / 100)).toFixed(2)} kg</li>
                            <li>Divide proporcionalmente pelos insumos do traço</li>
                          </>
                        ) : (
                          <li>Divide proporcionalmente pelos insumos do traço</li>
                        )}
                        <li>Cada insumo é calculado mantendo a proporção do traço</li>
                      </ol>
                    </div>
                  )}
                </div>
              )}

              {formData.product_type === 'premolded' && (
                <div className="md:col-span-3 border-t border-gray-200 pt-4">
                  <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <input
                      type="checkbox"
                      id="enable_stage_tracking"
                      checked={formData.enable_stage_tracking}
                      onChange={(e) => setFormData({ ...formData, enable_stage_tracking: e.target.checked })}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <label htmlFor="enable_stage_tracking" className="text-sm font-semibold text-blue-900 cursor-pointer">
                        Ativar Acompanhamento de Etapas de Produção
                      </label>
                      <p className="text-xs text-blue-700 mt-1">
                        Quando ativado, cada peça terá um QR code único para registrar etapas como concretagem, desmolde, montagem, etc.
                        Ideal para produtos como pilares e tesouras pré-moldadas.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {!formData.is_simple_registration && cementMaterial && formData.product_type !== 'artifact' && formData.product_type !== 'premolded' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Peso de Cimento por Unidade (kg) *
              </label>
              <input
                type="number"
                step="0.0001"
                value={formData.cement_weight}
                onChange={(e) => setFormData({ ...formData, cement_weight: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: 0.8000"
              />
              <p className="text-xs text-gray-500 mt-1">
                Os demais insumos serão calculados proporcionalmente baseado no traço
              </p>
            </div>
          )}

          {formData.product_type === 'premolded' && formData.concrete_volume_m3 && selectedRecipe?.specific_weight && (
            <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                <Scale className="w-4 h-4" />
                Cálculo do Peso do Concreto
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Volume da peça:</span>
                  <span className="font-bold text-gray-900">{parseFloat(formData.concrete_volume_m3).toFixed(4)} m³</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Peso específico do traço:</span>
                  <span className="font-bold text-gray-900">{selectedRecipe.specific_weight.toFixed(2)} kg/m³</span>
                </div>
                <div className="h-px bg-green-300 my-2"></div>
                <div className="flex items-center justify-between bg-green-100 p-2 rounded">
                  <span className="font-semibold text-green-900">Peso do Concreto:</span>
                  <span className="text-xl font-bold text-green-700">
                    {(parseFloat(formData.concrete_volume_m3) * selectedRecipe.specific_weight).toFixed(2)} kg
                  </span>
                </div>
              </div>
            </div>
          )}

          {recipeMaterialsData.length > 0 && cementMaterial && formData.product_type !== 'artifact' && formData.product_type !== 'premolded' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Scale className="w-4 h-4" />
                Proporção do Traço (base: {cementMaterial.quantity} kg de {cementMaterial.materials.name})
              </h4>
              <div className="space-y-2">
                {recipeMaterialsData.map((materialData) => (
                  <div key={materialData.material_id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{materialData.materials.name}</span>
                    <span className="font-medium text-gray-900">
                      {materialData.quantity.toFixed(3)} {materialData.materials.unit}
                      {formData.cement_weight && (
                        <span className="text-blue-600 ml-2">
                          → {((materialData.quantity / cementMaterial.quantity) * parseFloat(formData.cement_weight)).toFixed(3)} kg/un
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!formData.is_simple_registration && formData.product_type === 'premolded' && reinforcements.length > 0 && (
                <div className="md:col-span-2 bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">
                    Armaduras Cadastradas para esta Fôrma
                  </h4>
                    {reinforcements.map((r) => {
                      const typeLabels: Record<string, string> = {
                        longitudinal: 'Longitudinal',
                        transversal: 'Transversal',
                        lifting_hooks: 'Içamento',
                        threaded_bar_hooks: 'Ganchos Barra Roscada'
                      };
                      const selectedMaterial = materials.find(m => m.id === r.material_id);
                      const costPerMeter = selectedMaterial?.unit_cost || selectedMaterial?.cost_per_meter || 0;
                      const totalMeters = parseFloat(r.bar_length_meters?.toString() || '0') * parseFloat(r.bar_count?.toString() || '0');
                      const totalCost = totalMeters * costPerMeter;

                      // Debug: mostrar cálculo do custo
                      if (r.material_id && selectedMaterial) {
                        console.log(`🔧 Armadura ${r.description}:`, {
                          material: selectedMaterial.name,
                          custo_por_metro: costPerMeter,
                          quantidade: r.bar_count,
                          comprimento: r.bar_length_meters,
                          total_metros: totalMeters,
                          custo_total: totalCost
                        });
                      }

                      return (
                        <div key={r.tempId} className="bg-white p-3 rounded border border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex-1">
                              <div className="font-medium text-sm">
                                {r.type === 'longitudinal' && r.identifier && (
                                  <span className="mr-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded">
                                    {r.identifier}
                                  </span>
                                )}
                                {r.description}
                                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                                  {typeLabels[r.type || 'longitudinal']}
                                </span>
                                {r.type === 'longitudinal' && r.longitudinal_position && (
                                  <span className="ml-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                                    {r.longitudinal_position === 'superior' ? 'Superior' :
                                     r.longitudinal_position === 'inferior' ? 'Inferior' :
                                     r.longitudinal_position === 'middle' ? 'Middle' :
                                     r.longitudinal_position === 'pele' ? 'Pele' : r.longitudinal_position}
                                  </span>
                                )}
                              </div>
                              {r.type === 'transversal' && r.stirrup_spacing_meters && (
                                <div className="text-xs text-gray-500 mt-1">
                                  Espaçamento: {r.stirrup_spacing_meters}m | Qtd padrão: {r.stirrup_standard_quantity} estribos
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => removeReinforcement(r.tempId)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded"
                                title="Excluir armadura"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Material: *
                              </label>
                              <select
                                value={r.material_id}
                                onChange={(e) => updateReinforcementMaterial(r.tempId, e.target.value)}
                                className={`w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500 ${
                                  !r.material_id ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                }`}
                              >
                                <option value="">Selecione o material</option>
                                {materials.map(m => {
                                  const mCostPerMeter = m.unit_cost || m.cost_per_meter;
                                  const displayUnit = m.unit;
                                  return (
                                    <option key={m.id} value={m.id}>
                                      {m.name} - R$ {mCostPerMeter?.toFixed(4) || '0.00'}/{displayUnit}
                                      {m.unit_length_meters ? ` (Barra de ${m.unit_length_meters}m)` : ''}
                                    </option>
                                  );
                                })}
                              </select>
                              {!r.material_id && (
                                <div className="mt-1 text-xs text-red-600">
                                  ⚠️ Material obrigatório
                                </div>
                              )}
                              {r.material_id && selectedMaterial && (
                                <div className="mt-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded">
                                  ✓ R$ {costPerMeter.toFixed(4)}/m
                                </div>
                              )}
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Diâmetro (mm):
                              </label>
                              <select
                                value={r.bar_diameter_mm || ''}
                                onChange={(e) => updateReinforcementDiameter(r.tempId, parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
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
                              {r.bar_diameter_mm && (
                                <div className="mt-1 text-xs font-medium">
                                  {[4.2, 5.0, 6.0].includes(r.bar_diameter_mm) ? (
                                    <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded">
                                      Tipo: CA 60 (Fio)
                                    </span>
                                  ) : [6.3, 8.0, 10.0, 12.5, 16.0, 20.0, 25.0, 32.0].includes(r.bar_diameter_mm) ? (
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

                            <div className="bg-green-50 p-2 rounded border border-green-200">
                              <div className="text-xs text-gray-600 mb-1">
                                <strong>Resumo do Cálculo:</strong>
                              </div>
                              <div className="text-xs text-gray-700 space-y-0.5">
                                {r.type === 'transversal' ? (
                                  <div>{r.bar_count} estribos × {r.bar_length_meters}m = {totalMeters.toFixed(2)}m total</div>
                                ) : (
                                  <div>{r.bar_count} barras × {r.bar_length_meters}m = {totalMeters.toFixed(2)}m total</div>
                                )}
                                <div>
                                  Ø{r.bar_diameter_mm || '?'}mm
                                  {r.bar_diameter_mm && (
                                    [4.2, 5.0, 6.0].includes(r.bar_diameter_mm) ? ' (CA 60)' :
                                    [6.3, 8.0, 10.0, 12.5, 16.0, 20.0, 25.0, 32.0].includes(r.bar_diameter_mm) ? ' (CA 50)' : ''
                                  )}
                                  {' × R$ '}{costPerMeter.toFixed(4)}/m
                                </div>
                                <div className="font-bold text-green-700 pt-1 border-t border-green-300">
                                  Custo Total: R$ {totalCost.toFixed(2)}
                                </div>
                              </div>
                            </div>
                          </div>

                          {r.notes && <div className="text-xs text-gray-500 italic mt-2">{r.notes}</div>}
                        </div>
                      );
                    })}
                </div>
              )}

          {costMemory && formData.product_type !== 'artifact' && (
            <div className="md:col-span-2 bg-orange-50 border-2 border-orange-200 rounded-lg p-4 space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                📊 Memória de Cálculo Completa
              </h3>

              {formData.total_weight && parseFloat(formData.total_weight) > 0 && (
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-700">Peso Total do Produto:</span>
                    <span className="text-xl font-bold text-blue-600">{parseFloat(formData.total_weight).toFixed(2)} kg</span>
                  </div>
                </div>
              )}

              {costMemory.traceMaterials.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-gray-200 space-y-3">
                  <h4 className="font-semibold text-gray-800 text-sm border-b pb-2">1. Materiais do Traço</h4>

                  {formData.product_type === 'premolded' && formData.concrete_volume_m3 && selectedRecipe?.specific_weight && (
                    <div className="bg-green-50 border border-green-200 rounded p-3 text-sm space-y-2">
                      <div className="font-medium text-green-800 mb-2">Cálculo do Peso do Concreto:</div>
                      <div className="text-gray-700">
                        Volume ({parseFloat(formData.concrete_volume_m3).toFixed(4)} m³) × Peso Específico ({selectedRecipe.specific_weight.toFixed(2)} kg/m³) =
                        <span className="font-bold text-green-700 ml-1">
                          {(parseFloat(formData.concrete_volume_m3) * selectedRecipe.specific_weight).toFixed(2)} kg
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 italic border-t border-green-200 pt-2 mt-2">
                        Consumo de cada material = Quantidade no traço (kg/m³) × Volume da peça (m³)
                      </div>
                    </div>
                  )}

                  {costMemory.traceMaterials.map((item, index) => (
                    <div key={index} className="py-3 border-b last:border-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-gray-800">{item.material_name}</div>
                        <div className="text-right font-bold text-lg text-gray-900">
                          R$ {item.total_cost.toFixed(2)}
                        </div>
                      </div>
                      {item.recipe_quantity_per_m3 && formData.concrete_volume_m3 ? (
                        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded space-y-1">
                          <div className="flex items-center justify-between">
                            <span>Traço:</span>
                            <span className="font-semibold">{item.recipe_quantity_per_m3.toFixed(3)} {item.unit}/m³</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Volume da peça:</span>
                            <span className="font-semibold">{parseFloat(formData.concrete_volume_m3).toFixed(4)} m³</span>
                          </div>
                          <div className="flex items-center justify-between border-t border-gray-300 pt-1 mt-1">
                            <span className="font-medium">Consumo:</span>
                            <span className="font-bold text-blue-600">{item.quantity.toFixed(4)} {item.unit}</span>
                          </div>
                          <div className="flex items-center justify-between text-gray-500">
                            <span>Custo unitário:</span>
                            <span>R$ {item.unit_cost.toFixed(2)}/{item.unit}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-600">
                          {item.quantity.toFixed(4)} {item.unit} × R$ {item.unit_cost.toFixed(2)}/{item.unit}
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 border-t-2">
                    <span className="font-semibold text-gray-700">Subtotal Traço:</span>
                    <span className="font-bold text-blue-600">
                      R$ {costMemory.traceMaterials.reduce((sum, item) => sum + item.total_cost, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {costMemory.reinforcements.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-gray-200 space-y-3">
                  <h4 className="font-semibold text-gray-800 text-sm border-b pb-2">2. Armaduras</h4>
                  {costMemory.reinforcements.map((item, index) => (
                    <div key={index} className="text-sm py-2 border-b last:border-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-gray-800">{item.description}</div>
                          <div className="text-xs text-gray-600">
                            Material: {item.material_name}
                          </div>
                          <div className="text-xs text-gray-600">
                            {item.bar_count} barras × {item.bar_length_meters}m × Ø{item.bar_diameter_mm}mm = {(item.bar_count * item.bar_length_meters).toFixed(2)}m total
                          </div>
                          <div className="text-xs text-gray-600">
                            {(item.bar_count * item.bar_length_meters).toFixed(2)}m × R$ {item.unit_cost.toFixed(4)}/m
                          </div>
                        </div>
                        <div className="text-right font-semibold text-gray-800">
                          R$ {item.total_cost.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 border-t-2">
                    <div>
                      <div className="font-semibold text-gray-700">Subtotal Armaduras:</div>
                      <div className="text-xs text-gray-600">
                        Peso total: {costMemory.reinforcements.reduce((sum, item) => sum + item.weight_kg, 0).toFixed(3)} kg
                      </div>
                    </div>
                    <span className="font-bold text-blue-600">
                      R$ {costMemory.reinforcements.reduce((sum, item) => sum + item.total_cost, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {costMemory.accessories.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-gray-200 space-y-3">
                  <h4 className="font-semibold text-gray-800 text-sm border-b pb-2">3. Materiais Auxiliares</h4>
                  {costMemory.accessories.map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">{item.material_name}</div>
                        <div className="text-xs text-gray-600">
                          {item.quantity} {item.unit} × R$ {item.unit_cost.toFixed(2)}/{item.unit}
                        </div>
                      </div>
                      <div className="text-right font-semibold text-gray-800">
                        R$ {item.total_cost.toFixed(2)}
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 border-t-2">
                    <span className="font-semibold text-gray-700">Subtotal Materiais Auxiliares:</span>
                    <span className="font-bold text-blue-600">
                      R$ {costMemory.accessories.reduce((sum, item) => sum + item.total_cost, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold mb-1">CUSTO TOTAL DE MATERIAIS</div>
                    {costMemory.totalWeight > 0 && (
                      <div className="text-xs opacity-90">Peso total: {costMemory.totalWeight.toFixed(2)} kg</div>
                    )}
                  </div>
                  <div className="text-3xl font-bold">
                    R$ {costMemory.totalCost.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!formData.is_simple_registration && (
            <div className="md:col-span-2 bg-green-50 border-2 border-green-200 rounded-lg p-4 space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                💰 Precificação do Produto
              </h3>

            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Composição do Custo</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Custo de Material (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.material_cost}
                    onChange={(e) => setFormData({ ...formData, material_cost: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Custo de Mão de Obra (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.labor_cost}
                    onChange={(e) => setFormData({ ...formData, labor_cost: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="Ex: 15"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Percentual sobre o custo do material
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Custos Fixos (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.fixed_cost}
                    onChange={(e) => setFormData({ ...formData, fixed_cost: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="Ex: 10"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Percentual sobre o custo do material
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Custo de Transporte (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.transport_cost}
                    onChange={(e) => setFormData({ ...formData, transport_cost: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Perdas (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.loss_cost}
                    onChange={(e) => setFormData({ ...formData, loss_cost: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="Ex: 5"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Percentual sobre o custo do material
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <label className="block text-sm font-semibold text-gray-800 mb-1">
                    Custo de Produção Total
                  </label>
                  <div className="text-xl font-bold text-blue-600">
                    R$ {parseFloat(formData.production_cost || '0').toFixed(2)}
                  </div>
                </div>
              </div>

              {parseFloat(formData.material_cost || '0') > 0 && (
                <div className="bg-gray-50 p-3 rounded border border-gray-200 mt-3">
                  <h5 className="text-xs font-semibold text-gray-700 mb-2">Detalhamento dos Custos:</h5>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Custo de Material:</span>
                      <span className="font-medium">R$ {parseFloat(formData.material_cost || '0').toFixed(2)}</span>
                    </div>
                    {parseFloat(formData.labor_cost || '0') > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Mão de Obra ({formData.labor_cost}%):</span>
                        <span className="font-medium">R$ {(parseFloat(formData.material_cost || '0') * parseFloat(formData.labor_cost || '0') / 100).toFixed(2)}</span>
                      </div>
                    )}
                    {parseFloat(formData.fixed_cost || '0') > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Custos Fixos ({formData.fixed_cost}%):</span>
                        <span className="font-medium">R$ {(parseFloat(formData.material_cost || '0') * parseFloat(formData.fixed_cost || '0') / 100).toFixed(2)}</span>
                      </div>
                    )}
                    {parseFloat(formData.transport_cost || '0') > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Transporte:</span>
                        <span className="font-medium">R$ {parseFloat(formData.transport_cost || '0').toFixed(2)}</span>
                      </div>
                    )}
                    {parseFloat(formData.loss_cost || '0') > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Perdas ({formData.loss_cost}%):</span>
                        <span className="font-medium">R$ {(parseFloat(formData.material_cost || '0') * parseFloat(formData.loss_cost || '0') / 100).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Definir Preço de Venda</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Margem de Lucro (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.margin_percentage}
                    onChange={(e) => setFormData({ ...formData, margin_percentage: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="Ex: 30"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Percentual sobre o custo de produção
                  </p>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <label className="block text-sm font-semibold text-gray-800 mb-1">
                    Preço de Venda (sem impostos)
                  </label>
                  <div className="text-xl font-bold text-purple-600">
                    R$ {parseFloat(formData.sale_price || '0').toFixed(2)}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Impostos (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.tax_percentage}
                    onChange={(e) => setFormData({ ...formData, tax_percentage: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="Ex: 8"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Percentual sobre o preço de venda
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-4 text-white">
              <label className="block text-sm font-semibold mb-2">
                💰 PREÇO FINAL DE VENDA
              </label>
              <div className="text-3xl font-bold">
                R$ {parseFloat(formData.final_sale_price || '0').toFixed(2)}
              </div>
            </div>

            <div className="bg-white rounded-lg p-3 border border-orange-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                Controles de Preço
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preço Mínimo (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.minimum_price}
                    onChange={(e) => setFormData({ ...formData, minimum_price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="Ex: 45.00"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Valor mínimo permitido na venda (opcional)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Desconto Máximo (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.maximum_discount_percent}
                    onChange={(e) => setFormData({ ...formData, maximum_discount_percent: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="Ex: 15"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Desconto máximo permitido (opcional)
                  </p>
                </div>
              </div>
              {(formData.minimum_price || formData.maximum_discount_percent) && (
                <div className="mt-3 p-2 bg-orange-50 rounded text-xs text-gray-600">
                  <p className="font-medium text-orange-800 mb-1">ℹ️ Estes controles são opcionais:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {formData.minimum_price && (
                      <li>Sistema alertará se venda for abaixo de R$ {parseFloat(formData.minimum_price).toFixed(2)}</li>
                    )}
                    {formData.maximum_discount_percent && (
                      <li>Sistema alertará se desconto exceder {formData.maximum_discount_percent}%</li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            {parseFloat(formData.production_cost || '0') > 0 && parseFloat(formData.margin_percentage || '0') > 0 && (
              <div className="md:col-span-2 bg-green-50 p-3 rounded border border-green-200">
                <h5 className="text-xs font-semibold text-gray-700 mb-2">Resumo da Precificação:</h5>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Custo de Produção Total:</span>
                    <span className="font-medium">R$ {parseFloat(formData.production_cost || '0').toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">+ Margem de Lucro ({formData.margin_percentage}%):</span>
                    <span className="font-medium">R$ {(parseFloat(formData.production_cost || '0') * parseFloat(formData.margin_percentage || '0') / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-green-300 pt-1 mt-1">
                    <span className="text-gray-700 font-medium">= Preço de Venda (sem impostos):</span>
                    <span className="font-bold">R$ {parseFloat(formData.sale_price || '0').toFixed(2)}</span>
                  </div>
                  {parseFloat(formData.tax_percentage || '0') > 0 && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600">+ Impostos ({formData.tax_percentage}%):</span>
                        <span className="font-medium">R$ {(parseFloat(formData.sale_price || '0') * parseFloat(formData.tax_percentage || '0') / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between border-t border-green-300 pt-1 mt-1">
                        <span className="text-gray-700 font-medium">= Preço Final de Venda:</span>
                        <span className="font-bold text-green-700">R$ {parseFloat(formData.final_sale_price || '0').toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
            </div>
          )}

          {!formData.is_simple_registration && costBreakdown.length > 0 && (
            <div className="md:col-span-2 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-800 mb-3">
                Detalhamento do Custo de Materiais
              </h4>
              <div className="space-y-2">
                {costBreakdown.map((item, index) => (
                  <div key={index} className="bg-white p-3 rounded border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{item.material_name}</div>
                        <div className="text-xs text-gray-600">
                          Consumo: {item.product_consumption.toFixed(4)} {item.unit} × R$ {item.unit_cost.toFixed(2)}/{item.unit}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sm text-green-600">
                          R$ {item.total_cost.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="bg-blue-100 p-3 rounded border-2 border-blue-300 flex items-center justify-between">
                  <div className="font-semibold">Total de Materiais:</div>
                  <div className="text-lg font-bold text-blue-700">
                    R$ {costBreakdown.reduce((sum, item) => sum + item.total_cost, 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            {editingId ? 'Atualizar' : 'Salvar'} Produto
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                resetFormWithNewCode(false);
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="bg-white p-4 rounded-lg shadow-md mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Pesquisar produtos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ações
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Código
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nome
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tipo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Unidade
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Traço
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Preço Final
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estoque Mín.
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredProducts.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleClone(product)}
                      className="text-green-600 hover:text-green-900"
                      title="Clonar produto"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleEdit(product)}
                      className="text-blue-600 hover:text-blue-900"
                      title="Editar produto"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {(product as any).code || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-gray-900">{product.name}</div>
                    {product.description && (
                      <div className="text-xs text-gray-500">({product.description})</div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    product.product_type === 'premolded' ? 'bg-purple-100 text-purple-800' :
                    product.product_type === 'ferragens_diversas' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {product.product_type === 'premolded' ? 'Pré-Moldado' :
                     product.product_type === 'ferragens_diversas' ? 'Ferragens Diversas' :
                     'Artefato'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {product.unit}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {product.recipes?.name || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                  {(product as any).final_sale_price ? `R$ ${parseFloat((product as any).final_sale_price.toString()).toFixed(2)}` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {product.minimum_stock || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {hasMoreProducts && !searchTerm && (
          <div className="flex items-center justify-center px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={loadMoreProducts}
              disabled={loadingMoreProducts}
              className="px-6 py-2 bg-[#0A7EC2] text-white rounded-lg hover:bg-[#0968A8] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loadingMoreProducts ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Carregando...
                </>
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4 rotate-90" />
                  Carregar Mais Produtos
                </>
              )}
            </button>
          </div>
        )}

        {!hasMoreProducts && filteredProducts.length > 0 && (
          <div className="flex items-center justify-center px-6 py-4 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-600">Todos os produtos foram carregados</p>
          </div>
        )}
      </div>
    </div>
  );
}
