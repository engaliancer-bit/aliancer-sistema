import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus, Save, Trash2, Edit2, ChevronDown, ChevronUp,
  Layers, Box, Columns, LayoutGrid, Hammer, Settings2, AlertCircle,
  CheckCircle, X, Search, Zap, FlaskConical, Package, Grid, AlignJustify, Copy,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  Budget, BudgetFoundationParam, BudgetCaixariaSettings, BudgetGlobalParam,
  FoundationParamType, FoundationDimensions, CaixariaRule, ReinforcementBar,
  ReinforcementType, CaixariaItem, RecipeItemWithMaterial, FOUNDATION_TYPES,
  fmtBRL,
} from './types';
import { effectivePkgSize } from './calcElementMaterials';

interface Props {
  budget: Budget;
  globalParams?: BudgetGlobalParam[];
}

interface RecipeOption {
  id: string;
  name: string;
  concrete_type: string | null;
  specific_weight: number | null;
}

interface MaterialSearchResult {
  id: string;
  name: string;
  unit: string;
  resale_price: number | null;
  package_size: number | null;
}

interface FormState {
  id?: string;
  param_type: FoundationParamType;
  code: string;
  label: string;
  dimensions: FoundationDimensions;
  recipe_id: string;
  notes: string;
}

const ACO_PARAM_KEY_FOR_TYPE: Record<FoundationParamType, string> = {
  sapata: 'aco_sapatas',
  baldrame: 'aco_vigas',
  pilar: 'aco_pilares',
  pilar_fundacao: 'aco_pilares',
  alicerce: 'aco_pilares',
  estaca: 'aco_pilares',
  tubulao: 'aco_pilares',
  viga_cinta: 'aco_vigas',
  verga: 'aco_vigas',
};

const PARAM_TYPE_CONFIG: Record<FoundationParamType, {
  label: string;
  icon: typeof Layers;
  color: string;
  bg: string;
  border: string;
  codePrefix: string;
}> = {
  sapata:        { label: 'Sapatas Isoladas',        icon: Box,         color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',  codePrefix: 'SP' },
  baldrame:      { label: 'Vigas Baldrame',           icon: LayoutGrid,  color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200',   codePrefix: 'VB' },
  pilar_fundacao:{ label: 'Pilares de Fundacao',     icon: Columns,     color: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200', codePrefix: 'PF' },
  alicerce:      { label: 'Alicerces (Alvenaria)',   icon: Layers,      color: 'text-stone-700',   bg: 'bg-stone-50',   border: 'border-stone-200',  codePrefix: 'AL' },
  estaca:        { label: 'Estacas',                 icon: Hammer,      color: 'text-teal-700',    bg: 'bg-teal-50',    border: 'border-teal-200',   codePrefix: 'ES' },
  tubulao:       { label: 'Tubuloes',                icon: Layers,      color: 'text-cyan-700',    bg: 'bg-cyan-50',    border: 'border-cyan-200',   codePrefix: 'TB' },
  pilar:         { label: 'Pilares Estruturais',     icon: Columns,     color: 'text-slate-700',   bg: 'bg-slate-50',   border: 'border-slate-200',  codePrefix: 'PC' },
  viga_cinta:    { label: 'Viga Cinta',              icon: AlignJustify,color: 'text-indigo-700',  bg: 'bg-indigo-50',  border: 'border-indigo-200', codePrefix: 'VC' },
  verga:         { label: 'Verga / Contraverga',     icon: LayoutGrid,  color: 'text-rose-700',    bg: 'bg-rose-50',    border: 'border-rose-200',   codePrefix: 'VG' },
};

const DEFAULT_DIMS: Record<FoundationParamType, FoundationDimensions> = {
  sapata:         { largura: 0.7, comprimento: 0.7, altura: 0.2, cobrimento: 0.05, reinforcement_bars: [], caixaria_items: [] },
  baldrame:       { largura: 0.14, altura: 0.3, cobrimento: 0.03, reinforcement_bars: [], caixaria_items: [] },
  pilar:          { largura: 0.14, comprimento: 0.14, cobrimento: 0.025, reinforcement_bars: [], caixaria_items: [] },
  pilar_fundacao: { largura: 0.2, comprimento: 0.2, cobrimento: 0.04, reinforcement_bars: [], caixaria_items: [] },
  alicerce:       { largura: 0.5, altura: 0.4, espessura_parede: 0.14, tipo_material: 'pedra', reinforcement_bars: [], caixaria_items: [] },
  estaca:         { diametro: 0.3, altura: 6, cobrimento: 0.05, reinforcement_bars: [], caixaria_items: [] },
  tubulao:        { diametro: 0.5, altura: 8, cobrimento: 0.05, reinforcement_bars: [], caixaria_items: [] },
  viga_cinta:     { largura: 0.14, altura: 0.2, cobrimento: 0.03, reinforcement_bars: [], caixaria_items: [] },
  verga:          { largura: 0.12, altura: 0.1, cobrimento: 0.025, reinforcement_bars: [], caixaria_items: [] },
};

const GEOMETRY_FIELDS: Record<FoundationParamType, { key: keyof FoundationDimensions; label: string; unit: string; step: number; isText?: boolean; options?: string[] }[]> = {
  sapata: [
    { key: 'largura',     label: 'Largura (b)',     unit: 'm',  step: 0.05 },
    { key: 'comprimento', label: 'Comprimento (l)', unit: 'm',  step: 0.05 },
    { key: 'altura',      label: 'Altura (h)',       unit: 'm',  step: 0.05 },
    { key: 'cobrimento',  label: 'Cobrimento (c)',   unit: 'm',  step: 0.005 },
  ],
  baldrame: [
    { key: 'largura',           label: 'Largura (b)',           unit: 'm', step: 0.01 },
    { key: 'altura',            label: 'Altura (h)',            unit: 'm', step: 0.01 },
    { key: 'cobrimento',        label: 'Cobrimento',            unit: 'm', step: 0.005 },
    { key: 'comprimento_total', label: 'Comprimento do trecho', unit: 'm', step: 0.1 },
  ],
  pilar: [
    { key: 'largura',           label: 'Largura (b)',           unit: 'm', step: 0.01 },
    { key: 'comprimento',       label: 'Profundidade (l)',      unit: 'm', step: 0.01 },
    { key: 'cobrimento',        label: 'Cobrimento',            unit: 'm', step: 0.005 },
    { key: 'comprimento_total', label: 'Comprimento/Altura',    unit: 'm', step: 0.05 },
  ],
  pilar_fundacao: [
    { key: 'largura',           label: 'Largura (b)',           unit: 'm', step: 0.01 },
    { key: 'comprimento',       label: 'Profundidade (l)',      unit: 'm', step: 0.01 },
    { key: 'cobrimento',        label: 'Cobrimento',            unit: 'm', step: 0.005 },
    { key: 'comprimento_total', label: 'Comprimento/Altura',    unit: 'm', step: 0.05 },
  ],
  alicerce: [
    { key: 'largura',         label: 'Largura da base (b)',     unit: 'm', step: 0.05 },
    { key: 'altura',          label: 'Altura/Profundidade (h)', unit: 'm', step: 0.05 },
    { key: 'espessura_parede',label: 'Espessura parede',        unit: 'm', step: 0.01 },
    { key: 'tipo_material',   label: 'Material', unit: '', step: 0, isText: true,
      options: ['pedra', 'bloco_concreto', 'tijolo', 'bloco_ceramico'] },
  ],
  estaca: [
    { key: 'diametro', label: 'Diametro (d)', unit: 'm', step: 0.05 },
    { key: 'altura',   label: 'Comprimento (h)', unit: 'm', step: 0.5 },
    { key: 'cobrimento', label: 'Cobrimento (c)', unit: 'm', step: 0.005 },
  ],
  tubulao: [
    { key: 'diametro', label: 'Diametro do fuste (d)', unit: 'm', step: 0.05 },
    { key: 'altura',   label: 'Comprimento total (h)', unit: 'm', step: 0.5 },
    { key: 'cobrimento', label: 'Cobrimento (c)', unit: 'm', step: 0.005 },
  ],
  viga_cinta: [
    { key: 'largura',           label: 'Largura (b)',           unit: 'm', step: 0.01 },
    { key: 'altura',            label: 'Altura (h)',            unit: 'm', step: 0.01 },
    { key: 'cobrimento',        label: 'Cobrimento',            unit: 'm', step: 0.005 },
    { key: 'comprimento_total', label: 'Comprimento do trecho', unit: 'm', step: 0.1 },
  ],
  verga: [
    { key: 'largura',           label: 'Largura (b)',           unit: 'm', step: 0.01 },
    { key: 'altura',            label: 'Altura (h)',            unit: 'm', step: 0.01 },
    { key: 'cobrimento',        label: 'Cobrimento',            unit: 'm', step: 0.005 },
    { key: 'comprimento_total', label: 'Comprimento do vao',    unit: 'm', step: 0.05 },
  ],
};

const DEFAULT_CAIXARIA: Omit<BudgetCaixariaSettings, 'id' | 'budget_id'> = {
  board_length_m: 2.20,
  board_width_rule: [
    { min_height: 0.25, board_width_cm: 30 },
    { min_height: 0.20, board_width_cm: 25 },
    { min_height: 0.00, board_width_cm: 20 },
  ],
  waste_percent: 15,
  nail_kg_per_m2: 0.3,
  wire_gravateamento_m_per_ml: 0.5,
  nail_price_per_kg: 0,
  board_price_per_unit: 0,
  notes: null,
};

const MATERIAL_OPTIONS: Record<string, string> = {
  pedra: 'Pedra',
  bloco_concreto: 'Bloco de Concreto',
  tijolo: 'Tijolo',
  bloco_ceramico: 'Bloco Ceramico',
};

const CONCRETE_TYPE_LABELS: Record<string, string> = {
  dry: 'Concreto Seco (TCS)',
  plastic: 'Concreto Plastico (TCP)',
  argamassa_assentamento: 'Argamassa de Assentamento',
  argamassa_reboco: 'Argamassa de Reboco',
  argamassa_emboco: 'Argamassa de Emboco',
  argamassa_chapisco: 'Argamassa de Chapisco',
  argamassa_contrapiso: 'Argamassa de Contrapiso',
};

const emptyForm = (type: FoundationParamType = 'sapata'): FormState => ({
  param_type: type,
  code: '',
  label: '',
  dimensions: { ...DEFAULT_DIMS[type], reinforcement_bars: [], caixaria_items: [] },
  recipe_id: '',
  notes: '',
});

function dimsLabel(dims: FoundationDimensions): string {
  const parts: string[] = [];
  if (dims.largura) parts.push(`b=${dims.largura}m`);
  if (dims.comprimento) parts.push(`l=${dims.comprimento}m`);
  if (dims.altura) parts.push(`h=${dims.altura}m`);
  if (dims.comprimento_total) parts.push(`L=${dims.comprimento_total}m`);
  const bars = dims.reinforcement_bars;
  if (Array.isArray(bars) && bars.length > 0) parts.push(`${bars.length} armadura(s)`);
  const cix = dims.caixaria_items;
  if (Array.isArray(cix) && cix.length > 0) parts.push(`${cix.length} caixaria`);
  return parts.join(', ');
}

interface CostBreakdown {
  concreteCost: number;
  armaturaCost: number;
  arameCost: number;
  caixariaCost: number;
  total: number;
}

function calcItemCost(
  item: BudgetFoundationParam,
  recipeItemsMap: Record<string, RecipeItemWithMaterial[]>,
  recipes: { id: string; specific_weight: number | null }[],
): CostBreakdown {
  let concreteCost = 0;
  if (item.recipe_id) {
    const riList = recipeItemsMap[item.recipe_id];
    if (riList && riList.length > 0) {
      const rec = recipes.find(r => r.id === item.recipe_id);
      const specificWeight = rec?.specific_weight ?? 2400;
      const vol = concreteVolumeForForm(item.dimensions, item.param_type);
      if (vol > 0) {
        const totalKg = vol * specificWeight;
        const valid = riList.filter(ri => ri.material_id && ri.quantity > 0);
        const totalRecipeWeight = valid.reduce((s, ri) => s + Number(ri.quantity), 0);
        if (totalRecipeWeight > 0) {
          for (const ri of valid) {
            const mat = ri.materials;
            const unit = mat?.unit || 'kg';
            const pkgSize = effectivePkgSize(unit, mat?.package_size, mat?.name);
            const proportion = Number(ri.quantity) / totalRecipeWeight;
            const consumptionKg = proportion * totalKg;
            const qty = pkgSize > 0 ? consumptionKg / pkgSize : 0;
            const price = mat?.resale_price ?? mat?.unit_cost ?? 0;
            concreteCost += qty * price;
          }
        }
      }
    }
  }

  let armaturaCost = 0;
  let arameCost = 0;
  const bars = Array.isArray(item.dimensions.reinforcement_bars) ? item.dimensions.reinforcement_bars : [];
  for (const bar of bars) {
    const rt = bar.reinforcement_type || 'malha';
    const dims = item.dimensions;
    const cob = dims.cobrimento || 0;
    const hook = ((bar.hook_length_cm ?? 5)) / 100;
    if (rt === 'malha') {
      const b = dims.largura || 0;
      const l = dims.comprimento || 0;
      const spX = ((bar.spacing_x ?? 20)) / 100;
      const spY = ((bar.spacing_y ?? 20)) / 100;
      const netB = Math.max(0, b - 2 * cob);
      const netL = Math.max(0, l - 2 * cob);
      const bX = spX > 0 ? Math.ceil(netB / spX) + 1 : 0;
      const bY = spY > 0 ? Math.ceil(netL / spY) + 1 : 0;
      const totalM = bX * (netL + 2 * hook) + bY * (netB + 2 * hook);
      const pkg = bar.package_size || 12;
      const embs = pkg > 0 ? totalM / pkg : 0;
      armaturaCost += embs * (bar.resale_price || 0);
      const nodes = bX * bY;
      const wirePkg = bar.wire_material_pkg || 1;
      const wireTotal = nodes * (bar.wire_per_node_m ?? 0.08);
      const wireEmbs = wirePkg > 0 ? wireTotal / wirePkg : 0;
      arameCost += wireEmbs * (bar.wire_material_price || 0);
    } else if (rt === 'viga' || rt === 'coluna') {
      const elementLen = dims.comprimento_total || dims.altura || 0;
      const longBars = bar.long_bars_qty || 0;
      const longLen = elementLen + 2 * hook;
      const longMeters = longBars * longLen;
      const longPkg = bar.long_material_pkg || 12;
      const longEmbs = longPkg > 0 ? longMeters / longPkg : 0;
      armaturaCost += longEmbs * (bar.long_material_price || 0);
      const transSpacing = (bar.trans_spacing_cm || 20) / 100;
      const transCount = transSpacing > 0 && elementLen > 0 ? Math.ceil(elementLen / transSpacing) + 1 : 0;
      const transPerimeter = rt === 'viga'
        ? 2 * (Math.max(0, (dims.largura || 0) - 2 * cob) + Math.max(0, (dims.altura || 0) - 2 * cob)) + 4 * hook
        : 2 * (Math.max(0, (dims.largura || 0) - 2 * cob) + Math.max(0, (dims.comprimento || 0) - 2 * cob)) + 4 * hook;
      const transMeters = transCount * transPerimeter;
      const transPkg = bar.trans_material_pkg || 12;
      const transEmbs = transPkg > 0 ? transMeters / transPkg : 0;
      armaturaCost += transEmbs * (bar.trans_material_price || 0);
      if (bar.wire_material_id) {
        const wireNodes = transCount * longBars;
        const wireQty = wireNodes * (bar.wire_per_node_m ?? 0.08);
        const wirePkg = bar.wire_material_pkg || 1;
        const wireEmbs = wirePkg > 0 ? wireQty / wirePkg : 0;
        arameCost += wireEmbs * (bar.wire_material_price || 0);
      }
    }
  }

  let caixariaCost = 0;
  const caixItems = Array.isArray(item.dimensions.caixaria_items) ? item.dimensions.caixaria_items : [];
  for (const cx of caixItems) {
    caixariaCost += cx.quantity_per_unit * (cx.resale_price || 0);
  }

  const total = concreteCost + armaturaCost + arameCost + caixariaCost;
  return { concreteCost, armaturaCost, arameCost, caixariaCost, total };
}

function concreteVolumeForForm(dims: FoundationDimensions, type: FoundationParamType): number {
  const b = dims.largura || 0;
  const l = dims.comprimento || 0;
  const h = dims.altura || 0;
  const e = dims.espessura || 0;
  const d = dims.diametro || 0;
  switch (type) {
    case 'sapata': case 'pilar': case 'pilar_fundacao':
      return b * l * h;
    case 'baldrame':
      return b * h;
    case 'estaca': case 'tubulao':
      return Math.PI * Math.pow(d / 2, 2) * h;
    case 'alicerce':
      return b * h;
    default:
      return b * l * (h || e);
  }
}

export default function BudgetFoundationParamsPanel({ budget, globalParams = [] }: Props) {
  const [params, setParams] = useState<BudgetFoundationParam[]>([]);
  const [caixaria, setCaixaria] = useState<BudgetCaixariaSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<FoundationParamType>>(new Set(['sapata', 'baldrame', 'pilar']));
  const [expandedCaixaria, setExpandedCaixaria] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [caixariaForm, setCaixariaForm] = useState<Omit<BudgetCaixariaSettings, 'id' | 'budget_id'>>(DEFAULT_CAIXARIA);
  const [savingCaixaria, setSavingCaixaria] = useState(false);

  const [recipes, setRecipes] = useState<RecipeOption[]>([]);
  const [recipeItemsMap, setRecipeItemsMap] = useState<Record<string, RecipeItemWithMaterial[]>>({});

  const [barSearches, setBarSearches] = useState<Record<number, string>>({});
  const [barResults, setBarResults] = useState<Record<number, MaterialSearchResult[]>>({});
  const [barSearching, setBarSearching] = useState<Record<number, boolean>>({});
  const [barDropdownOpen, setBarDropdownOpen] = useState<Record<number, boolean>>({});

  const [longSearches, setLongSearches] = useState<Record<number, string>>({});
  const [longResults, setLongResults] = useState<Record<number, MaterialSearchResult[]>>({});
  const [longSearching, setLongSearching] = useState<Record<number, boolean>>({});
  const [longDropdownOpen, setLongDropdownOpen] = useState<Record<number, boolean>>({});

  const [transSearches, setTransSearches] = useState<Record<number, string>>({});
  const [transResults, setTransResults] = useState<Record<number, MaterialSearchResult[]>>({});
  const [transSearching, setTransSearching] = useState<Record<number, boolean>>({});
  const [transDropdownOpen, setTransDropdownOpen] = useState<Record<number, boolean>>({});

  const [wireSearches, setWireSearches] = useState<Record<number, string>>({});
  const [wireResults, setWireResults] = useState<Record<number, MaterialSearchResult[]>>({});
  const [wireSearching, setWireSearching] = useState<Record<number, boolean>>({});
  const [wireDropdownOpen, setWireDropdownOpen] = useState<Record<number, boolean>>({});

  const [caixSearches, setCaixSearches] = useState<Record<number, string>>({});
  const [caixResults, setCaixResults] = useState<Record<number, MaterialSearchResult[]>>({});
  const [caixSearching, setCaixSearching] = useState<Record<number, boolean>>({});
  const [caixDropdownOpen, setCaixDropdownOpen] = useState<Record<number, boolean>>({});

  const materialSearchCache = useRef<Record<string, MaterialSearchResult[]>>({});
  const allMaterialsRef = useRef<MaterialSearchResult[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: fp }, { data: cx }, { data: recData }, { data: allMats }] = await Promise.all([
      supabase.from('budget_foundation_params').select('*').eq('budget_id', budget.id).order('param_type').order('sort_order'),
      supabase.from('budget_caixaria_settings').select('*').eq('budget_id', budget.id).maybeSingle(),
      supabase.from('recipes').select('id, name, concrete_type, specific_weight').order('name'),
      supabase.from('materials').select('id, name, unit, resale_price, package_size').order('name').limit(500),
    ]);
    const loadedParams = fp || [];
    setParams(loadedParams);
    setRecipes(recData || []);
    if (allMats && allMats.length > 0) {
      allMaterialsRef.current = allMats;
      materialSearchCache.current['__all__'] = allMats;
    }
    const recipeIds = [...new Set(loadedParams.map(p => p.recipe_id).filter(Boolean) as string[])];
    if (recipeIds.length > 0) {
      const { data: riData } = await supabase
        .from('recipe_items')
        .select('id, recipe_id, material_id, quantity, materials(id, name, unit, resale_price, unit_cost, package_size)')
        .in('recipe_id', recipeIds);
      if (riData && riData.length > 0) {
        const grouped: Record<string, RecipeItemWithMaterial[]> = {};
        for (const ri of riData as RecipeItemWithMaterial[]) {
          if (!grouped[ri.recipe_id]) grouped[ri.recipe_id] = [];
          grouped[ri.recipe_id].push(ri);
        }
        setRecipeItemsMap(grouped);
      }
    }
    if (cx) {
      setCaixaria(cx);
      setCaixariaForm({
        board_length_m: cx.board_length_m,
        board_width_rule: cx.board_width_rule,
        waste_percent: cx.waste_percent,
        nail_kg_per_m2: cx.nail_kg_per_m2,
        wire_gravateamento_m_per_ml: cx.wire_gravateamento_m_per_ml,
        nail_price_per_kg: cx.nail_price_per_kg,
        board_price_per_unit: cx.board_price_per_unit,
        notes: cx.notes,
      });
    }
    setLoading(false);
  }, [budget.id]);

  useEffect(() => { load(); }, [load]);

  const fetchRecipeItems = useCallback(async (recipeId: string) => {
    if (!recipeId || recipeItemsMap[recipeId]) return;
    const { data } = await supabase
      .from('recipe_items')
      .select('id, recipe_id, material_id, quantity, materials(id, name, unit, resale_price, unit_cost, package_size)')
      .eq('recipe_id', recipeId);
    setRecipeItemsMap(prev => ({ ...prev, [recipeId]: (data || []) as RecipeItemWithMaterial[] }));
  }, [recipeItemsMap]);

  useEffect(() => {
    if (form.recipe_id) fetchRecipeItems(form.recipe_id);
  }, [form.recipe_id, fetchRecipeItems]);

  const previewItems = useMemo(() => {
    if (!form.recipe_id) return [];
    const items = recipeItemsMap[form.recipe_id];
    if (!items || items.length === 0) return [];
    const rec = recipes.find(r => r.id === form.recipe_id);
    const specificWeight = rec?.specific_weight ?? 2400;
    const vol = concreteVolumeForForm(form.dimensions, form.param_type);
    if (vol <= 0) return [];
    const totalKg = vol * specificWeight;
    const validItems = items.filter(ri => ri.material_id && ri.quantity > 0);
    const totalRecipeWeight = validItems.reduce((sum, ri) => sum + Number(ri.quantity), 0);
    if (totalRecipeWeight <= 0) return [];
    return validItems.map(ri => {
      const mat = ri.materials;
      const proportion = Number(ri.quantity) / totalRecipeWeight;
      const consumptionKg = proportion * totalKg;
      const unit = mat?.unit || 'kg';
      const pkgSize = effectivePkgSize(unit, mat?.package_size, mat?.name);
      const qty = consumptionKg / pkgSize;
      const price = (mat?.resale_price ?? mat?.unit_cost ?? 0);
      return {
        name: mat?.name || 'Insumo',
        unit,
        qty: parseFloat(qty.toFixed(4)),
        price,
        total: parseFloat((qty * price).toFixed(2)),
        consumptionKg: parseFloat(consumptionKg.toFixed(2)),
        embs: parseFloat(qty.toFixed(3)),
        pkgSize,
      };
    });
  }, [form.recipe_id, form.dimensions, form.param_type, recipeItemsMap, recipes]);

  const searchMaterialsFor = useCallback(async (
    query: string,
    idx: number,
    setSearches: React.Dispatch<React.SetStateAction<Record<number, string>>>,
    setResults: React.Dispatch<React.SetStateAction<Record<number, MaterialSearchResult[]>>>,
    setSearching: React.Dispatch<React.SetStateAction<Record<number, boolean>>>,
  ) => {
    const trimmed = query.trim();
    const cacheKey = trimmed.toLowerCase();

    if (allMaterialsRef.current.length > 0) {
      const filtered = trimmed.length === 0
        ? allMaterialsRef.current
        : allMaterialsRef.current.filter(m => m.name.toLowerCase().includes(cacheKey));
      setResults(prev => ({ ...prev, [idx]: filtered }));
      return;
    }

    if (trimmed.length < 2) { setResults(prev => ({ ...prev, [idx]: [] })); return; }
    if (materialSearchCache.current[cacheKey]) {
      setResults(prev => ({ ...prev, [idx]: materialSearchCache.current[cacheKey] }));
      return;
    }
    setSearching(prev => ({ ...prev, [idx]: true }));
    const { data } = await supabase
      .from('materials')
      .select('id, name, unit, resale_price, package_size')
      .ilike('name', `%${trimmed}%`)
      .order('name')
      .limit(50);
    const results = data || [];
    materialSearchCache.current[cacheKey] = results;
    setResults(prev => ({ ...prev, [idx]: results }));
    setSearching(prev => ({ ...prev, [idx]: false }));
  }, []);

  const resetAllSearchStates = () => {
    setBarSearches({}); setBarResults({}); setBarSearching({}); setBarDropdownOpen({});
    setLongSearches({}); setLongResults({}); setLongSearching({}); setLongDropdownOpen({});
    setTransSearches({}); setTransResults({}); setTransSearching({}); setTransDropdownOpen({});
    setWireSearches({}); setWireResults({}); setWireSearching({}); setWireDropdownOpen({});
    setCaixSearches({}); setCaixResults({}); setCaixSearching({}); setCaixDropdownOpen({});
  };

  const openCreate = (type: FoundationParamType) => {
    setEditingId(null);
    const existing = params.filter(p => p.param_type === type);
    const cfg = PARAM_TYPE_CONFIG[type];
    const nextNum = existing.length + 1;
    setForm({ ...emptyForm(type), code: `${cfg.codePrefix}-${String(nextNum).padStart(2, '0')}` });
    resetAllSearchStates();
    setShowForm(true);
    setError(null);
  };

  const openEdit = (p: BudgetFoundationParam) => {
    setEditingId(p.id);
    const dims = { ...p.dimensions };
    if (!Array.isArray(dims.reinforcement_bars)) dims.reinforcement_bars = [];
    if (!Array.isArray(dims.caixaria_items)) dims.caixaria_items = [];
    setForm({ id: p.id, param_type: p.param_type, code: p.code, label: p.label, dimensions: dims, recipe_id: p.recipe_id || '', notes: p.notes || '' });
    resetAllSearchStates();
    setShowForm(true);
    setError(null);
    if (p.recipe_id) fetchRecipeItems(p.recipe_id);
  };

  const saveParam = async () => {
    if (!form.code.trim()) { setError('Informe o codigo (ex: SP-01)'); return; }
    if (!form.label.trim()) { setError('Informe o descritivo'); return; }
    setSaving(true); setError(null);
    const payload = {
      budget_id: budget.id,
      param_type: form.param_type,
      code: form.code.trim().toUpperCase(),
      label: form.label.trim(),
      dimensions: form.dimensions,
      recipe_id: form.recipe_id || null,
      notes: form.notes.trim() || null,
      sort_order: params.filter(p => p.param_type === form.param_type).length,
    };
    const { error: err } = editingId
      ? await supabase.from('budget_foundation_params').update(payload).eq('id', editingId)
      : await supabase.from('budget_foundation_params').insert(payload);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setShowForm(false);
    setSuccess('Modelo salvo com sucesso!');
    setTimeout(() => setSuccess(null), 3000);
    await load();
  };

  const deleteParam = async (id: string) => {
    if (!confirm('Excluir este modelo? Elementos vinculados a ele nao serao afetados.')) return;
    await supabase.from('budget_foundation_params').delete().eq('id', id);
    await load();
  };

  const cloneParam = (p: BudgetFoundationParam) => {
    const existing = params.filter(pp => pp.param_type === p.param_type);
    const cfg = PARAM_TYPE_CONFIG[p.param_type];
    const nextNum = existing.length + 1;
    const dims = JSON.parse(JSON.stringify(p.dimensions));
    if (!Array.isArray(dims.reinforcement_bars)) dims.reinforcement_bars = [];
    if (!Array.isArray(dims.caixaria_items)) dims.caixaria_items = [];
    setEditingId(null);
    setForm({
      param_type: p.param_type,
      code: `${cfg.codePrefix}-${String(nextNum).padStart(2, '0')}`,
      label: `${p.label} (copia)`,
      dimensions: dims,
      recipe_id: p.recipe_id || '',
      notes: p.notes || '',
    });
    resetAllSearchStates();
    setShowForm(true);
    setError(null);
    if (p.recipe_id) fetchRecipeItems(p.recipe_id);
  };

  const saveCaixaria = async () => {
    setSavingCaixaria(true);
    const payload = { ...caixariaForm, budget_id: budget.id };
    const { error: err } = caixaria
      ? await supabase.from('budget_caixaria_settings').update(payload).eq('id', caixaria.id)
      : await supabase.from('budget_caixaria_settings').insert(payload);
    setSavingCaixaria(false);
    if (err) { setError(err.message); return; }
    setSuccess('Configuracao de caixaria salva!');
    setTimeout(() => setSuccess(null), 3000);
    await load();
  };

  const toggleExpand = (type: FoundationParamType) => {
    setExpanded(prev => { const next = new Set(prev); next.has(type) ? next.delete(type) : next.add(type); return next; });
  };

  const updateDim = (key: keyof FoundationDimensions, value: string | number) => {
    setForm(f => ({ ...f, dimensions: { ...f.dimensions, [key]: value } }));
  };

  const bars = (): ReinforcementBar[] =>
    Array.isArray(form.dimensions.reinforcement_bars) ? form.dimensions.reinforcement_bars : [];

  const caixItems = (): CaixariaItem[] =>
    Array.isArray(form.dimensions.caixaria_items) ? form.dimensions.caixaria_items : [];

  const addBar = () => {
    setForm(f => ({
      ...f,
      dimensions: {
        ...f.dimensions,
        reinforcement_bars: [...bars(), {
          material_id: '', material_name: '', unit: 'BR', package_size: 12, resale_price: 0, meters_used: 0,
          reinforcement_type: 'malha' as ReinforcementType,
          spacing_x: 20, spacing_y: 20, hook_length_cm: 5,
          wire_per_node_m: 0.4,
        }],
      },
    }));
  };

  const addBarFromGlobalParam = (gp: BudgetGlobalParam) => {
    if (!gp.materials) return;
    const mat = gp.materials;
    setForm(f => ({
      ...f,
      dimensions: {
        ...f.dimensions,
        reinforcement_bars: [...bars(), {
          material_id: mat.id, material_name: mat.name, unit: mat.unit,
          package_size: 12, resale_price: mat.resale_price ?? mat.unit_cost ?? 0, meters_used: 0,
          reinforcement_type: 'malha' as ReinforcementType,
          spacing_x: 20, spacing_y: 20, hook_length_cm: 5,
          wire_per_node_m: 0.4,
        }],
      },
    }));
  };

  const updateBar = (idx: number, patch: Partial<ReinforcementBar>) => {
    setForm(f => ({ ...f, dimensions: { ...f.dimensions, reinforcement_bars: bars().map((b, i) => i === idx ? { ...b, ...patch } : b) } }));
  };

  const removeBar = (idx: number) => {
    setForm(f => ({ ...f, dimensions: { ...f.dimensions, reinforcement_bars: bars().filter((_, i) => i !== idx) } }));
    setBarSearches(prev => { const n = { ...prev }; delete n[idx]; return n; });
    setBarResults(prev => { const n = { ...prev }; delete n[idx]; return n; });
    setBarDropdownOpen(prev => { const n = { ...prev }; delete n[idx]; return n; });
    setLongSearches(prev => { const n = { ...prev }; delete n[idx]; return n; });
    setLongResults(prev => { const n = { ...prev }; delete n[idx]; return n; });
    setLongDropdownOpen(prev => { const n = { ...prev }; delete n[idx]; return n; });
    setTransSearches(prev => { const n = { ...prev }; delete n[idx]; return n; });
    setTransResults(prev => { const n = { ...prev }; delete n[idx]; return n; });
    setTransDropdownOpen(prev => { const n = { ...prev }; delete n[idx]; return n; });
    setWireSearches(prev => { const n = { ...prev }; delete n[idx]; return n; });
    setWireResults(prev => { const n = { ...prev }; delete n[idx]; return n; });
    setWireDropdownOpen(prev => { const n = { ...prev }; delete n[idx]; return n; });
  };

  const addCaixItem = () => {
    setForm(f => ({
      ...f,
      dimensions: {
        ...f.dimensions,
        caixaria_items: [...caixItems(), { material_id: '', material_name: '', unit: 'un', package_size: 1, resale_price: 0, quantity_per_unit: 1 }],
      },
    }));
  };

  const updateCaixItem = (idx: number, patch: Partial<CaixariaItem>) => {
    setForm(f => ({ ...f, dimensions: { ...f.dimensions, caixaria_items: caixItems().map((c, i) => i === idx ? { ...c, ...patch } : c) } }));
  };

  const removeCaixItem = (idx: number) => {
    setForm(f => ({ ...f, dimensions: { ...f.dimensions, caixaria_items: caixItems().filter((_, i) => i !== idx) } }));
    setCaixSearches(prev => { const n = { ...prev }; delete n[idx]; return n; });
    setCaixResults(prev => { const n = { ...prev }; delete n[idx]; return n; });
    setCaixDropdownOpen(prev => { const n = { ...prev }; delete n[idx]; return n; });
  };

  const updateCaixariaRule = (idx: number, key: keyof CaixariaRule, value: number) => {
    const rules = [...caixariaForm.board_width_rule];
    rules[idx] = { ...rules[idx], [key]: value };
    setCaixariaForm(f => ({ ...f, board_width_rule: rules }));
  };

  const addCaixariaRule = () => {
    setCaixariaForm(f => ({ ...f, board_width_rule: [...f.board_width_rule, { min_height: 0, board_width_cm: 15 }] }));
  };

  const removeCaixariaRule = (idx: number) => {
    if (caixariaForm.board_width_rule.length <= 1) return;
    setCaixariaForm(f => ({ ...f, board_width_rule: f.board_width_rule.filter((_, i) => i !== idx) }));
  };

  const paramsByType = (type: FoundationParamType) => params.filter(p => p.param_type === type);

  const selectedRecipe = recipes.find(r => r.id === form.recipe_id) || null;
  const vol = concreteVolumeForForm(form.dimensions, form.param_type);

  if (loading) return (
    <div className="flex items-center justify-center py-10 text-gray-400">
      <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mr-2" />
      Carregando parametros de fundacao...
    </div>
  );

  return (
    <div className="space-y-4">
      {(success || error) && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm ${success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {success ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          {success || error}
        </div>
      )}

      {(Object.keys(PARAM_TYPE_CONFIG) as FoundationParamType[]).map(type => {
        const cfg = PARAM_TYPE_CONFIG[type];
        const Icon = cfg.icon;
        const items = paramsByType(type);
        const isOpen = expanded.has(type);
        return (
          <div key={type} className={`border rounded-lg overflow-hidden ${cfg.border}`}>
            <button
              onClick={() => toggleExpand(type)}
              className={`w-full flex items-center justify-between px-4 py-3 ${cfg.bg} hover:brightness-95 transition-all`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${cfg.color}`} />
                <span className={`font-semibold text-sm ${cfg.color}`}>{cfg.label}</span>
                <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full border">
                  {items.length} modelo{items.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={e => { e.stopPropagation(); openCreate(type); }}
                  className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md bg-white border ${cfg.border} ${cfg.color} hover:shadow-sm transition-all`}
                >
                  <Plus className="w-3 h-3" /> Adicionar
                </button>
                {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </button>

            {isOpen && (
              <div className="p-3 space-y-2 bg-white">
                {items.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">
                    Nenhum modelo cadastrado. Clique em "Adicionar" para criar.
                  </p>
                ) : items.map(item => {
                    const cost = calcItemCost(item, recipeItemsMap, recipes);
                    const itemDims = item.dimensions;
                    const itemCaixPerim = item.param_type === 'sapata'
                      ? 2 * ((itemDims.largura || 0) + (itemDims.comprimento || 0))
                      : (item.param_type === 'baldrame' || item.param_type === 'viga_cinta' || item.param_type === 'verga')
                        ? (itemDims.comprimento_total || 0)
                        : 0;
                    return (
                    <div key={item.id} className={`rounded-lg border ${cfg.border} overflow-hidden`}>
                      <div className={`flex items-center justify-between px-3 py-2 ${cfg.bg}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-xs font-bold uppercase tracking-wide ${cfg.color} bg-white px-2 py-0.5 rounded border ${cfg.border} shrink-0`}>
                            {item.code}
                          </span>
                          <span className="text-sm font-semibold text-gray-800 truncate">{item.label}</span>
                          {item.recipe_id && (
                            <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded shrink-0">
                              <FlaskConical className="w-3 h-3" />
                              Traco
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <button onClick={() => cloneParam(item)} title="Clonar modelo" className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"><Copy className="w-3.5 h-3.5" /></button>
                          <button onClick={() => openEdit(item)} title="Editar modelo" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => deleteParam(item.id)} title="Excluir modelo" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>

                      <div className="bg-white divide-y divide-gray-100">
                        <div className="px-3 py-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                          {itemDims.largura ? <span className="text-xs font-mono text-gray-600">b={itemDims.largura}m</span> : null}
                          {itemDims.comprimento ? <span className="text-xs font-mono text-gray-600">l={itemDims.comprimento}m</span> : null}
                          {itemDims.altura ? <span className="text-xs font-mono text-gray-600">h={itemDims.altura}m</span> : null}
                          {itemDims.comprimento_total ? <span className="text-xs font-mono text-gray-700 font-semibold">L={itemDims.comprimento_total}m</span> : null}
                          {itemDims.cobrimento ? <span className="text-xs font-mono text-gray-400">cob={itemDims.cobrimento}m</span> : null}
                          {itemDims.diametro ? <span className="text-xs font-mono text-gray-600">d={itemDims.diametro}m</span> : null}
                          {(() => {
                            const vol = concreteVolumeForForm(itemDims, item.param_type);
                            return vol > 0 ? <span className="text-xs font-mono text-emerald-700 font-medium">Vol={vol.toFixed(4)}m³</span> : null;
                          })()}
                        </div>

                        {item.recipe_id && (() => {
                          const riList = recipeItemsMap[item.recipe_id!];
                          const rec = recipes.find(r => r.id === item.recipe_id);
                          const vol = concreteVolumeForForm(itemDims, item.param_type);
                          if (!riList || riList.length === 0 || vol <= 0) return null;
                          const specificWeight = rec?.specific_weight ?? 2400;
                          const totalKg = vol * specificWeight;
                          const validItems = riList.filter(ri => ri.material_id && ri.quantity > 0);
                          const totalRecipeWeight = validItems.reduce((s, ri) => s + Number(ri.quantity), 0);
                          if (totalRecipeWeight === 0) return null;
                          return (
                            <div className="divide-y divide-emerald-50">
                              <div className="px-3 py-1 bg-emerald-50 flex items-center gap-2">
                                <FlaskConical className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span className="text-xs font-semibold text-emerald-700">Concreto — {rec?.name || 'Traco'}</span>
                                <span className="text-xs text-emerald-500 ml-auto">{totalKg.toFixed(1)} kg</span>
                              </div>
                              {validItems.map((ri, i) => {
                                const mat = ri.materials;
                                const unit = mat?.unit || 'kg';
                                const pkgSize = effectivePkgSize(unit, mat?.package_size, mat?.name);
                                const proportion = Number(ri.quantity) / totalRecipeWeight;
                                const consumptionKg = proportion * totalKg;
                                const qty = pkgSize > 0 ? consumptionKg / pkgSize : 0;
                                const price = mat?.resale_price ?? mat?.unit_cost ?? 0;
                                const tot = qty * price;
                                return (
                                  <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-emerald-50/40">
                                    <span className="text-gray-800 font-medium flex-1 min-w-0 truncate">{mat?.name || 'Insumo'}</span>
                                    <div className="flex items-center gap-3 ml-2 shrink-0 font-mono text-right text-emerald-700">
                                      <span><strong>{qty.toFixed(3)}</strong> {unit}</span>
                                      {price > 0 && <span className="w-20 text-right">R$ {price.toFixed(2)}/{unit}</span>}
                                      {tot > 0 && <span className="font-semibold w-16 text-right">{fmtBRL(tot)}</span>}
                                    </div>
                                  </div>
                                );
                              })}
                              {cost.concreteCost > 0 && (
                                <div className="flex justify-end px-3 py-1 bg-emerald-50/60 text-xs font-semibold text-emerald-700">
                                  Subtotal concreto: {fmtBRL(cost.concreteCost)}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {Array.isArray(itemDims.reinforcement_bars) && itemDims.reinforcement_bars.length > 0 && (() => {
                          const mainBars = itemDims.reinforcement_bars!.filter(b => (b.reinforcement_type || 'malha') === 'malha' && b.material_id);
                          const vigaBars = itemDims.reinforcement_bars!.filter(b => (b.reinforcement_type === 'viga' || b.reinforcement_type === 'coluna'));
                          const hasAny = mainBars.length > 0 || vigaBars.some(b => b.long_material_id || b.trans_material_id);
                          if (!hasAny) return null;
                          return (
                            <div className="divide-y divide-amber-50">
                              <div className="px-3 py-1 bg-amber-50 flex items-center gap-2">
                                <Grid className="w-3 h-3 text-amber-600 shrink-0" />
                                <span className="text-xs font-semibold text-amber-700">Armadura</span>
                              </div>
                              {itemDims.reinforcement_bars!.map((bar, i) => {
                                const rt = bar.reinforcement_type || 'malha';
                                const cob = itemDims.cobrimento || 0;
                                const hook = ((bar.hook_length_cm ?? 5)) / 100;
                                if (rt === 'malha') {
                                  const b = itemDims.largura || 0;
                                  const l = itemDims.comprimento || 0;
                                  const spX = ((bar.spacing_x ?? 20)) / 100;
                                  const spY = ((bar.spacing_y ?? 20)) / 100;
                                  const netB = Math.max(0, b - 2 * cob);
                                  const netL = Math.max(0, l - 2 * cob);
                                  const bX = spX > 0 ? Math.ceil(netB / spX) + 1 : 0;
                                  const bY = spY > 0 ? Math.ceil(netL / spY) + 1 : 0;
                                  const totalM = bX * (netL + 2 * hook) + bY * (netB + 2 * hook);
                                  const pkg = bar.package_size || 12;
                                  const embs = pkg > 0 ? totalM / pkg : 0;
                                  const price = bar.resale_price || 0;
                                  const tot = embs * price;
                                  if (!bar.material_id) return null;
                                  return (
                                    <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-amber-50/40">
                                      <span className="text-gray-800 font-medium flex-1 min-w-0 truncate">{bar.material_name || 'Ferro Malha'}</span>
                                      <div className="flex items-center gap-3 ml-2 shrink-0 font-mono text-right text-amber-700">
                                        <span><strong>{embs.toFixed(3)}</strong> emb</span>
                                        {price > 0 && <span className="w-20 text-right">R$ {price.toFixed(2)}/emb</span>}
                                        {tot > 0 && <span className="font-semibold w-16 text-right">{fmtBRL(tot)}</span>}
                                      </div>
                                    </div>
                                  );
                                }
                                const elementLen = itemDims.comprimento_total || itemDims.altura || 0;
                                const longBars = bar.long_bars_qty || 0;
                                const longLen = elementLen + 2 * hook;
                                const longMeters = longBars * longLen;
                                const longPkg = bar.long_material_pkg || 12;
                                const longEmbs = longPkg > 0 ? longMeters / longPkg : 0;
                                const longPrice = bar.long_material_price || 0;
                                const longTot = longEmbs * longPrice;
                                const transSpacing = (bar.trans_spacing_cm || 20) / 100;
                                const transCount = transSpacing > 0 && elementLen > 0 ? Math.ceil(elementLen / transSpacing) + 1 : 0;
                                const transPerimeter = rt === 'viga'
                                  ? 2 * (Math.max(0, (itemDims.largura || 0) - 2 * cob) + Math.max(0, (itemDims.altura || 0) - 2 * cob)) + 4 * hook
                                  : 2 * (Math.max(0, (itemDims.largura || 0) - 2 * cob) + Math.max(0, (itemDims.comprimento || 0) - 2 * cob)) + 4 * hook;
                                const transMeters = transCount * transPerimeter;
                                const transPkg = bar.trans_material_pkg || 12;
                                const transEmbs = transPkg > 0 ? transMeters / transPkg : 0;
                                const transPrice = bar.trans_material_price || 0;
                                const transTot = transEmbs * transPrice;
                                const wireNodes = transCount * (bar.long_bars_qty || 0);
                                const wireQty = wireNodes * (bar.wire_per_node_m ?? 0.08);
                                const wirePkg = bar.wire_material_pkg || 1;
                                const wireEmbs = wirePkg > 0 ? wireQty / wirePkg : 0;
                                const wirePrice = bar.wire_material_price || 0;
                                const wireTot = wireEmbs * wirePrice;
                                return (
                                  <div key={i} className="divide-y divide-amber-50">
                                    {bar.long_material_id && (
                                      <div className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-amber-50/40">
                                        <span className="text-gray-800 font-medium flex-1 min-w-0 truncate">{bar.long_material_name || 'Ferro Longitudinal'}</span>
                                        <div className="flex items-center gap-3 ml-2 shrink-0 font-mono text-right text-amber-700">
                                          <span><strong>{longEmbs.toFixed(3)}</strong> emb</span>
                                          {longPrice > 0 && <span className="w-20 text-right">R$ {longPrice.toFixed(2)}/emb</span>}
                                          {longTot > 0 && <span className="font-semibold w-16 text-right">{fmtBRL(longTot)}</span>}
                                        </div>
                                      </div>
                                    )}
                                    {bar.trans_material_id && (
                                      <div className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-orange-50/40">
                                        <span className="text-gray-800 font-medium flex-1 min-w-0 truncate">{bar.trans_material_name || 'Estribo'}</span>
                                        <div className="flex items-center gap-3 ml-2 shrink-0 font-mono text-right text-orange-700">
                                          <span><strong>{transEmbs.toFixed(3)}</strong> emb</span>
                                          {transPrice > 0 && <span className="w-20 text-right">R$ {transPrice.toFixed(2)}/emb</span>}
                                          {transTot > 0 && <span className="font-semibold w-16 text-right">{fmtBRL(transTot)}</span>}
                                        </div>
                                      </div>
                                    )}
                                    {bar.wire_material_id && (
                                      <div className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-blue-50/40">
                                        <span className="text-gray-800 font-medium flex-1 min-w-0 truncate">{bar.wire_material_name || 'Arame Recozido'}</span>
                                        <div className="flex items-center gap-3 ml-2 shrink-0 font-mono text-right text-blue-700">
                                          <span><strong>{wireEmbs.toFixed(3)}</strong> emb</span>
                                          {wirePrice > 0 && <span className="w-20 text-right">R$ {wirePrice.toFixed(2)}/emb</span>}
                                          {wireTot > 0 && <span className="font-semibold w-16 text-right">{fmtBRL(wireTot)}</span>}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}

                        {(Array.isArray(itemDims.caixaria_items) && itemDims.caixaria_items.length > 0 || itemCaixPerim > 0) && (
                          <div className="divide-y divide-orange-50">
                            <div className="px-3 py-1 bg-orange-50 flex items-center gap-2">
                              <Package className="w-3 h-3 text-orange-600 shrink-0" />
                              <span className="text-xs font-semibold text-orange-700">Caixaria / Formas</span>
                              {itemCaixPerim > 0 && (
                                <span className="text-xs text-orange-500 ml-auto font-mono">Perimetro: {itemCaixPerim.toFixed(2)}m lineares</span>
                              )}
                            </div>
                            {Array.isArray(itemDims.caixaria_items) && itemDims.caixaria_items.length > 0
                              ? itemDims.caixaria_items.map((cx, i) => {
                                  const qty = cx.quantity_per_unit;
                                  const unitPrice = cx.resale_price || 0;
                                  const tot = qty * unitPrice;
                                  return (
                                    <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-orange-50/40">
                                      <span className="text-gray-800 font-medium flex-1 min-w-0 truncate">{cx.material_name || 'Caixaria'}</span>
                                      <div className="flex items-center gap-3 ml-2 shrink-0 font-mono text-right text-orange-700">
                                        <span><strong>{qty.toFixed(3)}</strong> {cx.unit}</span>
                                        {unitPrice > 0 && <span className="w-20 text-right">R$ {unitPrice.toFixed(2)}/{cx.unit}</span>}
                                        {tot > 0 && <span className="font-semibold w-16 text-right">{fmtBRL(tot)}</span>}
                                      </div>
                                    </div>
                                  );
                                })
                              : itemCaixPerim > 0 && (
                                <div className="px-3 py-2 text-xs text-orange-400 italic flex items-center gap-1.5">
                                  <Edit2 className="w-3 h-3" />
                                  Clique em editar para adicionar os insumos de caixaria
                                </div>
                              )
                            }
                          </div>
                        )}

                        {cost.total > 0 && (
                          <div className="px-3 py-2 bg-gray-50 flex items-center justify-between">
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              {cost.concreteCost > 0 && <span>Concreto: <span className="text-emerald-700 font-medium">{fmtBRL(cost.concreteCost)}</span></span>}
                              {cost.armaturaCost > 0 && <span>Armadura: <span className="text-amber-700 font-medium">{fmtBRL(cost.armaturaCost)}</span></span>}
                              {cost.arameCost > 0 && <span>Arame: <span className="text-blue-700 font-medium">{fmtBRL(cost.arameCost)}</span></span>}
                              {cost.caixariaCost > 0 && <span>Caixaria: <span className="text-orange-700 font-medium">{fmtBRL(cost.caixariaCost)}</span></span>}
                            </div>
                            <span className="text-sm font-bold text-gray-900 ml-4 shrink-0">Total: {fmtBRL(cost.total)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })}
              </div>
            )}
          </div>
        );
      })}

      <div className="border border-orange-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setExpandedCaixaria(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-orange-50 hover:brightness-95 transition-all"
        >
          <div className="flex items-center gap-2">
            <Hammer className="w-4 h-4 text-orange-700" />
            <span className="font-semibold text-sm text-orange-700">Padroes de Caixaria (Formas)</span>
            {caixaria && <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">Configurado</span>}
          </div>
          {expandedCaixaria ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {expandedCaixaria && (
          <div className="p-4 bg-white space-y-4">
            <p className="text-xs text-gray-500">
              Defina os padroes de tabuas, pregos e arame para calculo automatico de caixaria de sapatas, baldrames e pilares.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Comprimento da tabua (m)</label>
                <input type="number" step="0.1" value={caixariaForm.board_length_m}
                  onChange={e => setCaixariaForm(f => ({ ...f, board_length_m: parseFloat(e.target.value) || 0 }))}
                  className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-300" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Perda/Desperdicio (%)</label>
                <input type="number" step="1" value={caixariaForm.waste_percent}
                  onChange={e => setCaixariaForm(f => ({ ...f, waste_percent: parseFloat(e.target.value) || 0 }))}
                  className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-300" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Pregos (kg/m² de forma)</label>
                <input type="number" step="0.01" value={caixariaForm.nail_kg_per_m2}
                  onChange={e => setCaixariaForm(f => ({ ...f, nail_kg_per_m2: parseFloat(e.target.value) || 0 }))}
                  className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-300" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Arame gravateamento (m/ml de viga)</label>
                <input type="number" step="0.1" value={caixariaForm.wire_gravateamento_m_per_ml}
                  onChange={e => setCaixariaForm(f => ({ ...f, wire_gravateamento_m_per_ml: parseFloat(e.target.value) || 0 }))}
                  className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-300" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Preco do prego (R$/kg)</label>
                <input type="number" step="0.01" value={caixariaForm.nail_price_per_kg}
                  onChange={e => setCaixariaForm(f => ({ ...f, nail_price_per_kg: parseFloat(e.target.value) || 0 }))}
                  className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-300" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Preco da tabua (R$/peca)</label>
                <input type="number" step="0.01" value={caixariaForm.board_price_per_unit}
                  onChange={e => setCaixariaForm(f => ({ ...f, board_price_per_unit: parseFloat(e.target.value) || 0 }))}
                  className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-300" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-700">Regras: Altura da forma → Largura da tabua</label>
                <button onClick={addCaixariaRule} className="text-xs text-orange-600 hover:text-orange-700 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Adicionar regra
                </button>
              </div>
              <div className="space-y-2">
                {caixariaForm.board_width_rule.map((rule, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-orange-50 rounded px-3 py-2">
                    <span className="text-xs text-gray-500 whitespace-nowrap">h &ge;</span>
                    <input type="number" step="0.01" value={rule.min_height}
                      onChange={e => updateCaixariaRule(idx, 'min_height', parseFloat(e.target.value) || 0)}
                      className="w-20 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-300" />
                    <span className="text-xs text-gray-500">m → tabua</span>
                    <input type="number" step="1" value={rule.board_width_cm}
                      onChange={e => updateCaixariaRule(idx, 'board_width_cm', parseFloat(e.target.value) || 0)}
                      className="w-20 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-300" />
                    <span className="text-xs text-gray-500">cm</span>
                    <button onClick={() => removeCaixariaRule(idx)} className="ml-auto p-1 text-gray-300 hover:text-red-500 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={saveCaixaria} disabled={savingCaixaria}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50 transition-colors">
              {savingCaixaria ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Caixaria
            </button>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-auto">
            <div className={`flex items-center justify-between px-5 py-4 border-b ${PARAM_TYPE_CONFIG[form.param_type].border} ${PARAM_TYPE_CONFIG[form.param_type].bg} rounded-t-xl`}>
              <div className="flex items-center gap-2">
                <Settings2 className={`w-4 h-4 ${PARAM_TYPE_CONFIG[form.param_type].color}`} />
                <h3 className={`text-base font-bold ${PARAM_TYPE_CONFIG[form.param_type].color}`}>
                  {editingId ? 'Editar' : 'Novo'} Modelo — {PARAM_TYPE_CONFIG[form.param_type].label}
                </h3>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
              {error && (
                <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Codigo *</label>
                  <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder={`${PARAM_TYPE_CONFIG[form.param_type].codePrefix}-01`}
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Descritivo *</label>
                  <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                    placeholder="Ex: Sapata 70x70cm"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Dimensoes Geometricas</p>
                <div className="grid grid-cols-2 gap-2">
                  {GEOMETRY_FIELDS[form.param_type].map(field => (
                    <div key={field.key}>
                      <label className="block text-xs text-gray-500 mb-0.5">
                        {field.label} {field.unit && <span className="text-gray-400">({field.unit})</span>}
                      </label>
                      {field.isText && field.options ? (
                        <select value={(form.dimensions[field.key] as string) || ''}
                          onChange={e => updateDim(field.key, e.target.value)}
                          className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400">
                          {field.options.map(opt => <option key={opt} value={opt}>{MATERIAL_OPTIONS[opt] || opt}</option>)}
                        </select>
                      ) : (
                        <input type="number" step={field.step}
                          value={(form.dimensions[field.key] as number) ?? ''}
                          onChange={e => updateDim(field.key, parseFloat(e.target.value) || 0)}
                          className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400" />
                      )}
                    </div>
                  ))}
                </div>
                {vol > 0 && (
                  <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1">
                    Volume calculado: <strong>{vol.toFixed(4)} m³</strong> por unidade
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FlaskConical className="w-3.5 h-3.5 text-emerald-600" />
                  <p className="text-xs font-semibold text-gray-600">Traco de Concreto</p>
                  {form.recipe_id && (
                    <span className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      substituindo parametro global
                    </span>
                  )}
                </div>
                <select
                  value={form.recipe_id}
                  onChange={e => setForm(f => ({ ...f, recipe_id: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  <option value="">-- Usar traco do parametro global (padrao) --</option>
                  {recipes.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name}{r.concrete_type ? ` (${CONCRETE_TYPE_LABELS[r.concrete_type] || r.concrete_type})` : ''}{r.specific_weight ? ` · ${r.specific_weight} kg/m³` : ''}
                    </option>
                  ))}
                </select>
                {recipes.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">Nenhum traco cadastrado. Cadastre tracos no modulo de Industria de Artefatos.</p>
                )}

                {selectedRecipe && previewItems.length > 0 && (
                  <div className="mt-3 border border-emerald-200 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-700">
                        Preview de Insumos — {selectedRecipe.name} · {vol.toFixed(3)} m³/un
                      </span>
                      <span className="text-xs text-emerald-600">
                        {selectedRecipe.specific_weight ?? 2400} kg/m³ → {(vol * (selectedRecipe.specific_weight ?? 2400)).toFixed(1)} kg
                      </span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {previewItems.map((item, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-gray-50">
                          <span className="text-gray-800 font-medium flex-1 min-w-0 truncate">{item.name}</span>
                          <div className="flex items-center gap-3 ml-2 flex-shrink-0 text-gray-500">
                            <span className="font-mono">
                              {item.consumptionKg} kg ÷ {item.pkgSize}{item.unit} = <strong className="text-emerald-700">{item.qty} {item.unit}</strong>
                            </span>
                            {item.total > 0 && (
                              <span className="text-emerald-600 font-semibold">{fmtBRL(item.total)}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="px-3 py-1.5 bg-emerald-50 border-t border-emerald-200 text-right">
                      <span className="text-xs font-bold text-emerald-800">
                        Subtotal concreto: {fmtBRL(previewItems.reduce((s, i) => s + i.total, 0))}/un
                      </span>
                    </div>
                  </div>
                )}

                {selectedRecipe && previewItems.length === 0 && vol > 0 && (
                  <div className="mt-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    Este traco nao possui insumos cadastrados. Adicione insumos ao traco no modulo de Industria de Artefatos.
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <p className="text-xs font-semibold text-gray-600">Armaduras</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {(() => {
                      const acoKey = ACO_PARAM_KEY_FOR_TYPE[form.param_type];
                      const acoParam = globalParams.find(gp => gp.param_key === acoKey && gp.materials);
                      if (!acoParam || !acoParam.materials) return null;
                      const alreadyAdded = bars().some(b => b.material_id === acoParam.materials!.id);
                      if (alreadyAdded) return null;
                      return (
                        <button
                          onClick={() => addBarFromGlobalParam(acoParam)}
                          className="flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-md transition-colors"
                        >
                          <Zap className="w-3 h-3" />
                          Usar: {acoParam.materials.name.length > 30 ? acoParam.materials.name.substring(0, 30) + '...' : acoParam.materials.name}
                        </button>
                      );
                    })()}
                    <button
                      onClick={addBar}
                      className="flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-800 border border-amber-200 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-md transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Adicionar Armadura
                    </button>
                  </div>
                </div>
                {bars().length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3 border border-dashed border-gray-200 rounded-lg">
                    Nenhuma armadura cadastrada. Clique em "Adicionar Armadura".
                  </p>
                ) : (
                  <div className="space-y-3">
                    {bars().map((bar, idx) => {
                      const rtype = bar.reinforcement_type || 'malha';
                      const dims = form.dimensions;
                      const b = dims.largura || 0;
                      const l = dims.comprimento || 0;
                      const cob = dims.cobrimento || 0;
                      const spX = (bar.spacing_x || 20) / 100;
                      const spY = (bar.spacing_y || 20) / 100;
                      const hook = (bar.hook_length_cm || 5) / 100;
                      const netB = Math.max(0, b - 2 * cob);
                      const netL = Math.max(0, l - 2 * cob);
                      const barsX = spX > 0 ? Math.ceil(netB / spX) + 1 : 0;
                      const barsY = spY > 0 ? Math.ceil(netL / spY) + 1 : 0;
                      const lenBarX = netL + 2 * hook;
                      const lenBarY = netB + 2 * hook;
                      const totalMeters = rtype === 'malha'
                        ? barsX * lenBarX + barsY * lenBarY
                        : bar.meters_used;
                      const nodes = rtype === 'malha' ? barsX * barsY : 0;
                      const wireQtyM = nodes * (bar.wire_per_node_m || 0.4);
                      const wirePkg = bar.wire_material_pkg || 1;
                      const wireEmbs = wirePkg > 0 ? wireQtyM / wirePkg : 0;
                      const wireTot = wireEmbs * (bar.wire_material_price || 0);
                      const pkgSize = bar.package_size || 12;
                      const embs = pkgSize > 0 ? totalMeters / pkgSize : 0;
                      const mainTot = embs * (bar.resale_price || 0);

                      const transSpacing = (bar.trans_spacing_cm || 20) / 100;
                      const elementLen = (dims.comprimento_total || dims.altura || 0);
                      const longBars = bar.long_bars_qty || 0;
                      const longLen = rtype !== 'malha' ? elementLen + 2 * hook : 0;
                      const longMeters = longBars * longLen;
                      const longPkg = bar.long_material_pkg || 12;
                      const longEmbs = longPkg > 0 ? longMeters / longPkg : 0;
                      const longTot = longEmbs * (bar.long_material_price || 0);
                      const transCount = transSpacing > 0 && elementLen > 0 ? Math.ceil(elementLen / transSpacing) + 1 : 0;
                      const transPerimeter = rtype === 'viga'
                        ? 2 * (Math.max(0, (dims.largura || 0) - 2 * cob) + Math.max(0, (dims.altura || 0) - 2 * cob)) + 4 * hook
                        : rtype === 'coluna'
                          ? 2 * (Math.max(0, (dims.largura || 0) - 2 * cob) + Math.max(0, (dims.comprimento || 0) - 2 * cob)) + 4 * hook
                          : 0;
                      const transMeters = transCount * transPerimeter;
                      const transPkg = bar.trans_material_pkg || 12;
                      const transEmbs = transPkg > 0 ? transMeters / transPkg : 0;
                      const transTot = transEmbs * (bar.trans_material_price || 0);

                      const makeMaterialInput = (
                        label: string,
                        matId: string | undefined,
                        matName: string | undefined,
                        matUnit: string | undefined,
                        searches: Record<number, string>,
                        setSearches: React.Dispatch<React.SetStateAction<Record<number, string>>>,
                        results: Record<number, MaterialSearchResult[]>,
                        setResults: React.Dispatch<React.SetStateAction<Record<number, MaterialSearchResult[]>>>,
                        searching: Record<number, boolean>,
                        setSearching: React.Dispatch<React.SetStateAction<Record<number, boolean>>>,
                        dropOpen: Record<number, boolean>,
                        setDropOpen: React.Dispatch<React.SetStateAction<Record<number, boolean>>>,
                        onSelect: (mat: MaterialSearchResult) => void,
                        onClear: () => void,
                        placeholder: string,
                      ) => (
                        <div className="relative">
                          <label className="block text-xs text-gray-500 mb-0.5">{label}</label>
                          {matId ? (
                            <div className="flex items-center gap-2 px-2 py-1.5 bg-white border border-emerald-200 rounded-lg">
                              <span className="text-xs text-gray-800 flex-1 truncate">{matName}</span>
                              <span className="text-xs text-gray-400 shrink-0">{matUnit}</span>
                              <button onClick={onClear} className="text-gray-300 hover:text-gray-500 shrink-0"><X className="w-3 h-3" /></button>
                            </div>
                          ) : (
                            <div className="relative">
                              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                              <input
                                type="text"
                                placeholder={placeholder}
                                value={searches[idx] || ''}
                                onFocus={() => {
                                  setDropOpen(prev => ({ ...prev, [idx]: true }));
                                  searchMaterialsFor(searches[idx] || '', idx, setSearches, setResults, setSearching);
                                }}
                                onChange={e => {
                                  const val = e.target.value;
                                  setSearches(prev => ({ ...prev, [idx]: val }));
                                  setDropOpen(prev => ({ ...prev, [idx]: true }));
                                  const t = setTimeout(() => {
                                    searchMaterialsFor(val, idx, setSearches, setResults, setSearching);
                                  }, 200);
                                  return () => clearTimeout(t);
                                }}
                                className="w-full pl-6 pr-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400"
                              />
                              {dropOpen[idx] && ((results[idx] || []).length > 0 || searching[idx]) && (
                                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                                  {searching[idx] ? (
                                    <div className="px-3 py-2 text-xs text-gray-400 flex items-center gap-2">
                                      <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                                      Buscando...
                                    </div>
                                  ) : (results[idx] || []).length === 0 ? (
                                    <div className="px-3 py-2 text-xs text-gray-400">Nenhum insumo encontrado para "{searches[idx]}".</div>
                                  ) : (
                                    (results[idx] || []).map(mat => (
                                      <button
                                        key={mat.id}
                                        onClick={() => {
                                          onSelect(mat);
                                          setDropOpen(prev => ({ ...prev, [idx]: false }));
                                          setSearches(prev => ({ ...prev, [idx]: '' }));
                                        }}
                                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-amber-50 transition-colors border-b border-gray-50 last:border-0"
                                      >
                                        <div className="font-medium text-gray-800">{mat.name}</div>
                                        <div className="text-gray-400">{mat.unit}{mat.resale_price ? ` · R$ ${mat.resale_price.toFixed(2)}` : ''}</div>
                                      </button>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );

                      return (
                        <div key={idx} className="border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-700">Armadura {idx + 1}</span>
                            <button onClick={() => removeBar(idx)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tipo de Armadura</label>
                            <div className="flex gap-2">
                              {([
                                { val: 'malha', label: 'Malha', Icon: Grid },
                                { val: 'viga', label: 'Viga', Icon: AlignJustify },
                                { val: 'coluna', label: 'Coluna', Icon: Columns },
                              ] as { val: ReinforcementType; label: string; Icon: typeof Columns }[]).map(({ val, label: tl, Icon }) => (
                                <button
                                  key={val}
                                  onClick={() => updateBar(idx, { reinforcement_type: val })}
                                  className={`flex-1 flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg border text-xs font-medium transition-all ${rtype === val ? 'bg-amber-500 border-amber-500 text-white shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:border-amber-300 hover:bg-amber-50'}`}
                                >
                                  <Icon className="w-3.5 h-3.5" />
                                  {tl}
                                </button>
                              ))}
                            </div>
                          </div>

                          {rtype === 'malha' && (
                            <div className="space-y-2">
                              <div className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                                <Grid className="w-3.5 h-3.5 text-amber-600" />
                                Bitola da Malha
                              </div>
                              {makeMaterialInput(
                                'Insumo (ferro/bitola)',
                                bar.material_id, bar.material_name, bar.unit,
                                barSearches, setBarSearches, barResults, setBarResults, barSearching, setBarSearching, barDropdownOpen, setBarDropdownOpen,
                                mat => updateBar(idx, { material_id: mat.id, material_name: mat.name, unit: mat.unit, package_size: mat.package_size || 12, resale_price: mat.resale_price || 0 }),
                                () => { updateBar(idx, { material_id: '', material_name: '' }); setBarDropdownOpen(p => ({ ...p, [idx]: true })); setBarSearches(p => ({ ...p, [idx]: '' })); },
                                'Buscar ferro (ex: CA-50 10mm)...',
                              )}
                              {bar.material_id && (
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-0.5">Embalagem (m)</label>
                                    <input type="number" min="0.1" step="0.5" value={bar.package_size}
                                      onChange={e => updateBar(idx, { package_size: parseFloat(e.target.value) || 1 })}
                                      className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400" />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-0.5">Preco unit. (R$)</label>
                                    <input type="number" min="0" step="0.01" value={bar.resale_price}
                                      onChange={e => updateBar(idx, { resale_price: parseFloat(e.target.value) || 0 })}
                                      className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400" />
                                  </div>
                                </div>
                              )}
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <label className="block text-xs text-gray-500 mb-0.5">Espacamento X (cm)</label>
                                  <input type="number" min="1" step="1" value={bar.spacing_x ?? 20}
                                    onChange={e => updateBar(idx, { spacing_x: parseFloat(e.target.value) || 20 })}
                                    className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400" />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-500 mb-0.5">Espacamento Y (cm)</label>
                                  <input type="number" min="1" step="1" value={bar.spacing_y ?? 20}
                                    onChange={e => updateBar(idx, { spacing_y: parseFloat(e.target.value) || 20 })}
                                    className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400" />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-500 mb-0.5">Gancho (cm)</label>
                                  <input type="number" min="0" step="1" value={bar.hook_length_cm ?? 5}
                                    onChange={e => updateBar(idx, { hook_length_cm: parseFloat(e.target.value) || 0 })}
                                    className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400" />
                                </div>
                              </div>

                              {b > 0 && l > 0 && (
                                <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs space-y-0.5">
                                  <div className="font-semibold text-amber-800 mb-1">Calculo Automatico — Malha</div>
                                  <div className="text-amber-700">Barras sentido X (paralelas a L): <strong>{barsX}</strong> barras × {lenBarX.toFixed(2)}m = <strong>{(barsX * lenBarX).toFixed(2)}m</strong></div>
                                  <div className="text-amber-700">Barras sentido Y (paralelas a B): <strong>{barsY}</strong> barras × {lenBarY.toFixed(2)}m = <strong>{(barsY * lenBarY).toFixed(2)}m</strong></div>
                                  <div className="text-amber-700">Total de nos de amarracao: <strong>{nodes}</strong></div>
                                  <div className="text-amber-700 font-semibold border-t border-amber-200 mt-1 pt-1">
                                    Total ferro: <strong>{totalMeters.toFixed(2)}m</strong>
                                    {pkgSize > 0 && <> → <strong>{embs.toFixed(3)}</strong> emb ({pkgSize}m/emb)</>}
                                    {bar.resale_price > 0 && <> · <strong>{fmtBRL(mainTot)}</strong></>}
                                  </div>
                                </div>
                              )}

                              <div className="border border-gray-200 rounded-lg p-2.5 bg-white space-y-2">
                                <div className="text-xs font-semibold text-gray-600">Arame Recozido</div>
                                {makeMaterialInput(
                                  'Insumo (arame recozido)',
                                  bar.wire_material_id, bar.wire_material_name, bar.wire_material_unit,
                                  wireSearches, setWireSearches, wireResults, setWireResults, wireSearching, setWireSearching, wireDropdownOpen, setWireDropdownOpen,
                                  mat => updateBar(idx, { wire_material_id: mat.id, wire_material_name: mat.name, wire_material_unit: mat.unit, wire_material_pkg: mat.package_size || 1, wire_material_price: mat.resale_price || 0 }),
                                  () => { updateBar(idx, { wire_material_id: '', wire_material_name: '' }); setWireDropdownOpen(p => ({ ...p, [idx]: true })); setWireSearches(p => ({ ...p, [idx]: '' })); },
                                  'Buscar arame recozido...',
                                )}
                                {bar.wire_material_id && (
                                  <div className="grid grid-cols-3 gap-2">
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-0.5">Consumo por no ({bar.wire_material_unit || 'kg'})</label>
                                      <input type="number" min="0" step="0.01" value={bar.wire_per_node_m ?? 0.08}
                                        onChange={e => updateBar(idx, { wire_per_node_m: parseFloat(e.target.value) || 0 })}
                                        className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400" />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-0.5">Embalagem ({bar.wire_material_unit || 'kg'})</label>
                                      <input type="number" min="0.1" step="0.1" value={bar.wire_material_pkg ?? 1}
                                        onChange={e => updateBar(idx, { wire_material_pkg: parseFloat(e.target.value) || 1 })}
                                        className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400" />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-0.5">Preco unit. (R$/{bar.wire_material_unit || 'kg'})</label>
                                      <input type="number" min="0" step="0.01" value={bar.wire_material_price ?? 0}
                                        onChange={e => updateBar(idx, { wire_material_price: parseFloat(e.target.value) || 0 })}
                                        className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400" />
                                    </div>
                                  </div>
                                )}
                                {bar.wire_material_id && nodes > 0 && (
                                  <div className="bg-blue-50 border border-blue-100 rounded px-2 py-1.5 text-xs text-blue-700">
                                    {nodes} nos × {bar.wire_per_node_m ?? 0.08}{bar.wire_material_unit || 'kg'}/no = <strong>{wireQtyM.toFixed(3)} {bar.wire_material_unit || 'kg'}</strong>
                                    {wirePkg > 0 && <> ÷ {wirePkg}{bar.wire_material_unit || 'kg'}/emb = <strong>{wireEmbs.toFixed(3)}</strong> emb</>}
                                    {(bar.wire_material_price || 0) > 0 && <> · <strong>{fmtBRL(wireTot)}</strong></>}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {(rtype === 'viga' || rtype === 'coluna') && (
                            <div className="space-y-3">
                              <div className="border border-gray-200 rounded-lg p-2.5 bg-white space-y-2">
                                <div className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                                  <AlignJustify className="w-3.5 h-3.5 text-blue-600" />
                                  Armadura Longitudinal
                                </div>
                                {makeMaterialInput(
                                  'Insumo (ferro longitudinal)',
                                  bar.long_material_id, bar.long_material_name, bar.long_material_unit,
                                  longSearches, setLongSearches, longResults, setLongResults, longSearching, setLongSearching, longDropdownOpen, setLongDropdownOpen,
                                  mat => updateBar(idx, { long_material_id: mat.id, long_material_name: mat.name, long_material_unit: mat.unit, long_material_pkg: mat.package_size || 12, long_material_price: mat.resale_price || 0 }),
                                  () => { updateBar(idx, { long_material_id: '', long_material_name: '' }); setLongDropdownOpen(p => ({ ...p, [idx]: true })); setLongSearches(p => ({ ...p, [idx]: '' })); },
                                  'Buscar ferro longitudinal (ex: CA-50 12.5mm)...',
                                )}
                                {bar.long_material_id && (
                                  <div className="grid grid-cols-3 gap-2">
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-0.5">Qtd. barras</label>
                                      <input type="number" min="0" step="1" value={bar.long_bars_qty ?? 0}
                                        onChange={e => updateBar(idx, { long_bars_qty: parseInt(e.target.value) || 0 })}
                                        className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-0.5">Embalagem (m)</label>
                                      <input type="number" min="0.1" step="0.5" value={bar.long_material_pkg ?? 12}
                                        onChange={e => updateBar(idx, { long_material_pkg: parseFloat(e.target.value) || 1 })}
                                        className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-0.5">Preco unit. (R$)</label>
                                      <input type="number" min="0" step="0.01" value={bar.long_material_price ?? 0}
                                        onChange={e => updateBar(idx, { long_material_price: parseFloat(e.target.value) || 0 })}
                                        className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                                    </div>
                                  </div>
                                )}
                                {bar.long_material_id && longBars > 0 && elementLen > 0 && (
                                  <div className="bg-blue-50 border border-blue-100 rounded px-2 py-1.5 text-xs text-blue-700">
                                    {longBars} barras × {longLen.toFixed(2)}m = <strong>{longMeters.toFixed(2)}m</strong>
                                    {longPkg > 0 && <> → <strong>{longEmbs.toFixed(3)}</strong> emb</>}
                                    {(bar.long_material_price || 0) > 0 && <> · <strong>{fmtBRL(longTot)}</strong></>}
                                  </div>
                                )}
                              </div>

                              <div className="border border-gray-200 rounded-lg p-2.5 bg-white space-y-2">
                                <div className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                                  <Grid className="w-3.5 h-3.5 text-orange-600" />
                                  Armadura Transversal (Estribo)
                                </div>
                                {makeMaterialInput(
                                  'Insumo (ferro estribo)',
                                  bar.trans_material_id, bar.trans_material_name, bar.trans_material_unit,
                                  transSearches, setTransSearches, transResults, setTransResults, transSearching, setTransSearching, transDropdownOpen, setTransDropdownOpen,
                                  mat => updateBar(idx, { trans_material_id: mat.id, trans_material_name: mat.name, trans_material_unit: mat.unit, trans_material_pkg: mat.package_size || 12, trans_material_price: mat.resale_price || 0 }),
                                  () => { updateBar(idx, { trans_material_id: '', trans_material_name: '' }); setTransDropdownOpen(p => ({ ...p, [idx]: true })); setTransSearches(p => ({ ...p, [idx]: '' })); },
                                  'Buscar ferro estribo (ex: CA-60 6.3mm)...',
                                )}
                                {bar.trans_material_id && (
                                  <div className="grid grid-cols-3 gap-2">
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-0.5">Espacamento (cm)</label>
                                      <input type="number" min="1" step="1" value={bar.trans_spacing_cm ?? 20}
                                        onChange={e => updateBar(idx, { trans_spacing_cm: parseFloat(e.target.value) || 20 })}
                                        className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400" />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-0.5">Embalagem (m)</label>
                                      <input type="number" min="0.1" step="0.5" value={bar.trans_material_pkg ?? 12}
                                        onChange={e => updateBar(idx, { trans_material_pkg: parseFloat(e.target.value) || 1 })}
                                        className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400" />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-0.5">Preco unit. (R$)</label>
                                      <input type="number" min="0" step="0.01" value={bar.trans_material_price ?? 0}
                                        onChange={e => updateBar(idx, { trans_material_price: parseFloat(e.target.value) || 0 })}
                                        className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400" />
                                    </div>
                                  </div>
                                )}
                                {bar.trans_material_id && transCount > 0 && transPerimeter > 0 && (
                                  <div className="bg-orange-50 border border-orange-100 rounded px-2 py-1.5 text-xs text-orange-700">
                                    {transCount} estribos × {transPerimeter.toFixed(2)}m/estribo = <strong>{transMeters.toFixed(2)}m</strong>
                                    {transPkg > 0 && <> → <strong>{transEmbs.toFixed(3)}</strong> emb</>}
                                    {(bar.trans_material_price || 0) > 0 && <> · <strong>{fmtBRL(transTot)}</strong></>}
                                  </div>
                                )}
                              </div>

                              <div className="border border-gray-200 rounded-lg p-2.5 bg-white space-y-2">
                                <div className="text-xs font-semibold text-gray-600">Arame Recozido (amarração)</div>
                                {makeMaterialInput(
                                  'Insumo (arame recozido)',
                                  bar.wire_material_id, bar.wire_material_name, bar.wire_material_unit,
                                  wireSearches, setWireSearches, wireResults, setWireResults, wireSearching, setWireSearching, wireDropdownOpen, setWireDropdownOpen,
                                  mat => updateBar(idx, { wire_material_id: mat.id, wire_material_name: mat.name, wire_material_unit: mat.unit, wire_material_pkg: mat.package_size || 1, wire_material_price: mat.resale_price || 0 }),
                                  () => { updateBar(idx, { wire_material_id: '', wire_material_name: '' }); setWireDropdownOpen(p => ({ ...p, [idx]: true })); setWireSearches(p => ({ ...p, [idx]: '' })); },
                                  'Buscar arame recozido...',
                                )}
                                {bar.wire_material_id && (
                                  <div className="grid grid-cols-3 gap-2">
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-0.5">Consumo por no ({bar.wire_material_unit || 'kg'})</label>
                                      <input type="number" min="0" step="0.01" value={bar.wire_per_node_m ?? 0.08}
                                        onChange={e => updateBar(idx, { wire_per_node_m: parseFloat(e.target.value) || 0 })}
                                        className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400" />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-0.5">Embalagem ({bar.wire_material_unit || 'kg'})</label>
                                      <input type="number" min="0.1" step="0.1" value={bar.wire_material_pkg ?? 1}
                                        onChange={e => updateBar(idx, { wire_material_pkg: parseFloat(e.target.value) || 1 })}
                                        className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400" />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-0.5">Preco unit. (R$/{bar.wire_material_unit || 'kg'})</label>
                                      <input type="number" min="0" step="0.01" value={bar.wire_material_price ?? 0}
                                        onChange={e => updateBar(idx, { wire_material_price: parseFloat(e.target.value) || 0 })}
                                        className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400" />
                                    </div>
                                  </div>
                                )}
                                {bar.wire_material_id && transCount > 0 && longBars > 0 && (() => {
                                  const viColNodes = transCount * longBars;
                                  const viColWireQty = viColNodes * (bar.wire_per_node_m ?? 0.08);
                                  const viColWirePkg = bar.wire_material_pkg || 1;
                                  const viColWireEmbs = viColWirePkg > 0 ? viColWireQty / viColWirePkg : 0;
                                  const viColWireTot = viColWireEmbs * (bar.wire_material_price || 0);
                                  return (
                                    <div className="bg-blue-50 border border-blue-100 rounded px-2 py-1.5 text-xs text-blue-700">
                                      {viColNodes} nos × {bar.wire_per_node_m ?? 0.08}{bar.wire_material_unit || 'kg'}/no = <strong>{viColWireQty.toFixed(3)} {bar.wire_material_unit || 'kg'}</strong>
                                      {viColWirePkg > 0 && <> ÷ {viColWirePkg}{bar.wire_material_unit || 'kg'}/emb = <strong>{viColWireEmbs.toFixed(3)}</strong> emb</>}
                                      {(bar.wire_material_price || 0) > 0 && <> · <strong>{fmtBRL(viColWireTot)}</strong></>}
                                    </div>
                                  );
                                })()}
                              </div>

                              {(bar.long_material_id || bar.trans_material_id) && (
                                <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700">
                                  <span className="font-semibold">Total armadura:</span>
                                  {bar.long_material_id && longMeters > 0 && <span className="ml-2">Long: {fmtBRL(longTot)}</span>}
                                  {bar.trans_material_id && transMeters > 0 && <span className="ml-2">Estribo: {fmtBRL(transTot)}</span>}
                                  {(longTot + transTot) > 0 && <span className="ml-2 font-bold text-slate-800">= {fmtBRL(longTot + transTot)}</span>}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Package className="w-3.5 h-3.5 text-orange-600" />
                    <p className="text-xs font-semibold text-gray-600">Caixaria / Formas e Outros Insumos</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const dims = form.dimensions;
                      const perim = form.param_type === 'sapata'
                        ? 2 * ((dims.largura || 0) + (dims.comprimento || 0))
                        : (form.param_type === 'baldrame' || form.param_type === 'viga_cinta' || form.param_type === 'verga')
                          ? (dims.comprimento_total || 0)
                          : 0;
                      if (perim <= 0) return null;
                      return (
                        <span className="text-xs text-orange-600 bg-orange-50 border border-orange-200 px-2 py-1 rounded font-mono">
                          Perimetro tabua: {perim.toFixed(2)}m
                        </span>
                      );
                    })()}
                    <button
                      onClick={addCaixItem}
                      className="flex items-center gap-1 text-xs font-medium text-orange-700 hover:text-orange-800 border border-orange-200 bg-orange-50 hover:bg-orange-100 px-2.5 py-1 rounded-md transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Adicionar Item
                    </button>
                  </div>
                </div>
                {caixItems().length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3 border border-dashed border-gray-200 rounded-lg">
                    Nenhum item de caixaria. Adicione tabuas, pregos, espaçadores ou outros insumos por unidade.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {caixItems().map((cx, idx) => {
                      const autoPerim = form.param_type === 'sapata'
                        ? 2 * ((form.dimensions.largura || 0) + (form.dimensions.comprimento || 0))
                        : (form.param_type === 'baldrame' || form.param_type === 'viga_cinta' || form.param_type === 'verga')
                          ? (form.dimensions.comprimento_total || 0)
                          : 0;
                      return (
                      <div key={idx} className="border border-orange-200 rounded-lg p-3 bg-orange-50/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-orange-700">Item {idx + 1}</span>
                          <div className="flex items-center gap-2">
                            {autoPerim > 0 && (
                              <button
                                onClick={() => updateCaixItem(idx, { quantity_per_unit: parseFloat(autoPerim.toFixed(3)) })}
                                className="text-xs text-orange-600 hover:text-orange-800 border border-orange-200 bg-white hover:bg-orange-50 px-2 py-0.5 rounded transition-colors"
                                title="Preencher com o perimetro calculado automaticamente"
                              >
                                Usar {autoPerim.toFixed(2)}m
                              </button>
                            )}
                            <button onClick={() => removeCaixItem(idx)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="relative">
                          <label className="block text-xs text-gray-500 mb-0.5">Insumo (buscar por nome)</label>
                          {cx.material_id ? (
                            <div className="flex items-center gap-2 px-3 py-2 bg-white border border-orange-200 rounded-lg">
                              <span className="text-sm text-gray-800 flex-1">{cx.material_name}</span>
                              <span className="text-xs text-gray-400">{cx.unit}</span>
                              <button
                                onClick={() => {
                                  updateCaixItem(idx, { material_id: '', material_name: '' });
                                  setCaixDropdownOpen(prev => ({ ...prev, [idx]: true }));
                                  setCaixSearches(prev => ({ ...prev, [idx]: '' }));
                                }}
                                className="text-gray-300 hover:text-gray-500"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                              <input
                                type="text"
                                placeholder="Digite o nome do insumo (ex: tabua, prego)..."
                                value={caixSearches[idx] || ''}
                                onFocus={() => {
                                  setCaixDropdownOpen(prev => ({ ...prev, [idx]: true }));
                                  searchMaterialsFor(caixSearches[idx] || '', idx, setCaixSearches, setCaixResults, setCaixSearching);
                                }}
                                onChange={e => {
                                  const val = e.target.value;
                                  setCaixSearches(prev => ({ ...prev, [idx]: val }));
                                  setCaixDropdownOpen(prev => ({ ...prev, [idx]: true }));
                                  const t = setTimeout(() => {
                                    searchMaterialsFor(val, idx, setCaixSearches, setCaixResults, setCaixSearching);
                                  }, 200);
                                  return () => clearTimeout(t);
                                }}
                                className="w-full pl-8 pr-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400"
                              />
                              {caixDropdownOpen[idx] && ((caixResults[idx] || []).length > 0 || caixSearching[idx]) && (
                                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                  {caixSearching[idx] ? (
                                    <div className="px-3 py-3 text-xs text-gray-400 flex items-center gap-2">
                                      <div className="w-3 h-3 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                                      Buscando insumos...
                                    </div>
                                  ) : (caixResults[idx] || []).length === 0 ? (
                                    <div className="px-3 py-3 text-xs text-gray-400">
                                      Nenhum insumo encontrado para "{caixSearches[idx]}". Verifique o cadastro de insumos.
                                    </div>
                                  ) : (
                                    (caixResults[idx] || []).map(mat => (
                                      <button
                                        key={mat.id}
                                        onClick={() => {
                                          updateCaixItem(idx, { material_id: mat.id, material_name: mat.name, unit: mat.unit, package_size: mat.package_size || 1, resale_price: mat.resale_price || 0 });
                                          setCaixDropdownOpen(prev => ({ ...prev, [idx]: false }));
                                          setCaixSearches(prev => ({ ...prev, [idx]: '' }));
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 transition-colors border-b border-gray-50 last:border-0"
                                      >
                                        <div className="font-medium text-gray-800">{mat.name}</div>
                                        <div className="text-xs text-gray-400">
                                          {mat.unit} · embalagem: {mat.package_size ?? '?'}
                                          {mat.resale_price ? ` · R$ ${mat.resale_price.toFixed(2)}` : ''}
                                        </div>
                                      </button>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs text-gray-500 mb-0.5">Qtd. por unidade</label>
                            <input type="number" min="0" step="0.1" value={cx.quantity_per_unit}
                              onChange={e => updateCaixItem(idx, { quantity_per_unit: parseFloat(e.target.value) || 0 })}
                              className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-0.5">Tam. embalagem</label>
                            <input type="number" min="0.01" step="0.1" value={cx.package_size}
                              onChange={e => updateCaixItem(idx, { package_size: parseFloat(e.target.value) || 1 })}
                              className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-0.5">Preco unit. (R$)</label>
                            <input type="number" min="0" step="0.01" value={cx.resale_price}
                              onChange={e => updateCaixItem(idx, { resale_price: parseFloat(e.target.value) || 0 })}
                              className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400" />
                          </div>
                        </div>

                        {cx.quantity_per_unit > 0 && (
                          <div className="text-xs text-orange-700 bg-orange-50 border border-orange-100 rounded px-2 py-1.5">
                            {cx.quantity_per_unit} {cx.unit}/un
                            {cx.package_size > 0 && <> ÷ {cx.package_size}{cx.unit}/emb = <strong>{(cx.quantity_per_unit / cx.package_size).toFixed(3)}</strong> emb</>}
                            {cx.resale_price > 0 && <> · Total: <strong>R$ {(cx.quantity_per_unit * cx.resale_price).toFixed(2)}</strong></>}
                          </div>
                        )}
                      </div>
                    );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Observacoes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Observacoes opcionais..."
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-5 py-4 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border rounded-lg hover:bg-white transition-colors">
                Cancelar
              </button>
              <button onClick={saveParam} disabled={saving}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-5 py-2 rounded-lg disabled:opacity-50 transition-colors">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                {editingId ? 'Salvar Alteracoes' : 'Criar Modelo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
