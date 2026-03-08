import { BudgetGlobalParam, BudgetFoundationParam, RecipeItemWithMaterial } from './types';

export interface LineItemDraft {
  description: string;
  unit: string;
  quantity: number;
  source_param_key: string;
  material_id: string | null;
  product_id: string | null;
  is_auto_calculated: boolean;
  unit_price?: number;
}

function concreteVolume(elementType: string, params: Record<string, number>): number {
  const b = params['largura'] || 0;
  const l = params['comprimento'] || 0;
  const h = params['altura'] || 0;
  const e = params['espessura'] || 0;
  const d = params['diametro'] || 0;
  const qtd = params['quantidade'] || 1;

  switch (elementType) {
    case 'sapata':
    case 'bloco_fundacao':
    case 'baldrame':
    case 'pilar':
    case 'pilar_fundacao':
    case 'viga':
      return b * l * h * qtd;
    case 'radier':
    case 'laje':
      return b * l * e;
    case 'estaca':
    case 'tubulao':
      return Math.PI * Math.pow(d / 2, 2) * h * qtd;
    default:
      return 0;
  }
}

const BAG_UNITS = new Set(['saco', 'sc', 'bag', 'Saco', 'SC', 'BAG']);

export function effectivePkgSize(unit: string | undefined, pkgSize: number | null | undefined, materialName?: string): number {
  const raw = pkgSize ?? 0;
  if (raw > 1) return raw;
  if (unit && BAG_UNITS.has(unit) && raw <= 1) {
    const match = (materialName || '').match(/(\d+)\s*kg/i);
    if (match) return parseFloat(match[1]);
    return 50;
  }
  return raw > 0 ? raw : 1;
}

const CONCRETE_ELEMENT_TYPES = new Set([
  'sapata', 'bloco_fundacao', 'baldrame', 'pilar', 'pilar_fundacao',
  'viga', 'radier', 'laje', 'estaca', 'tubulao',
]);

const CONCRETE_PARAM_KEY_MAP: Record<string, string> = {
  sapata: 'traco_concreto_sapata',
  bloco_fundacao: 'traco_concreto_sapata',
  baldrame: 'traco_concreto_baldrame',
  pilar: 'traco_concreto_pilar',
  pilar_fundacao: 'traco_concreto_pilar',
  viga: 'traco_concreto_viga',
  radier: 'traco_concreto_laje',
  laje: 'traco_concreto_laje',
  estaca: 'traco_concreto_pilar',
  tubulao: 'traco_concreto_pilar',
};

function paramByKey(params: BudgetGlobalParam[], key: string): BudgetGlobalParam | undefined {
  return params.find(p => p.param_key === key);
}

function calcConcreteFromRecipe(
  recipeItems: RecipeItemWithMaterial[],
  volumeM3: number,
  specificWeight: number,
  sourceParamKey: string,
  concreteLabel: string,
): LineItemDraft[] {
  const totalKg = volumeM3 * specificWeight;
  const result: LineItemDraft[] = [];

  result.push({
    description: `${concreteLabel} — volume`,
    unit: 'm3',
    quantity: parseFloat(volumeM3.toFixed(4)),
    source_param_key: sourceParamKey,
    material_id: null,
    product_id: null,
    is_auto_calculated: true,
    unit_price: 0,
  });

  const validItems = recipeItems.filter(ri => ri.material_id && ri.quantity > 0);
  const totalRecipeWeight = validItems.reduce((sum, ri) => sum + Number(ri.quantity), 0);

  if (totalRecipeWeight <= 0) return result;

  const materialItems = validItems
    .map(ri => {
      const mat = ri.materials;
      const proportion = Number(ri.quantity) / totalRecipeWeight;
      const consumptionKg = proportion * totalKg;
      const unit = mat?.unit || 'kg';
      const pkgSize = effectivePkgSize(unit, mat?.package_size, mat?.name);
      const quantityFinal = consumptionKg / pkgSize;

      return {
        description: mat?.name || `Insumo`,
        unit,
        quantity: parseFloat(quantityFinal.toFixed(4)),
        source_param_key: sourceParamKey,
        material_id: ri.material_id,
        product_id: null,
        is_auto_calculated: true,
        unit_price: mat?.resale_price ?? mat?.unit_cost ?? 0,
      } as LineItemDraft;
    })
    .filter(d => d.quantity > 0);

  result.push(...materialItems);
  return result;
}

export function calcElementMaterials(
  elementType: string,
  params: Record<string, number>,
  globalParams: BudgetGlobalParam[],
  foundationParam: BudgetFoundationParam | null,
  recipeItemsMap?: Record<string, RecipeItemWithMaterial[]>,
): LineItemDraft[] {
  const items: LineItemDraft[] = [];
  const qtd = params['quantidade'] || 1;

  if (CONCRETE_ELEMENT_TYPES.has(elementType)) {
    const vol = concreteVolume(elementType, params);
    if (vol > 0) {
      const concreteParamKey = CONCRETE_PARAM_KEY_MAP[elementType];

      const perModelRecipeId = (foundationParam as any)?.recipe_id as string | null | undefined;
      const effectiveRecipeId = perModelRecipeId || undefined;

      if (effectiveRecipeId && recipeItemsMap) {
        const recipeItems = recipeItemsMap[effectiveRecipeId] || [];
        const fpRecipe = (foundationParam as any)?.recipes;
        const specificWeight = fpRecipe?.specific_weight ?? 2400;
        const label = fpRecipe?.name || 'Concreto';
        if (recipeItems.length > 0) {
          items.push(...calcConcreteFromRecipe(recipeItems, vol, specificWeight, concreteParamKey, label));
        } else {
          items.push({
            description: label,
            unit: 'm3',
            quantity: parseFloat(vol.toFixed(4)),
            source_param_key: concreteParamKey,
            material_id: null,
            product_id: null,
            is_auto_calculated: true,
            unit_price: 0,
          });
        }
      } else {
        const concreteParam = paramByKey(globalParams, concreteParamKey);
        if (concreteParam?.recipe_id && recipeItemsMap) {
          const recipeItems = recipeItemsMap[concreteParam.recipe_id] || [];
          const specificWeight = concreteParam.recipes?.specific_weight ?? 2400;
          const label = concreteParam.param_label || concreteParam.recipes?.name || 'Concreto';
          if (recipeItems.length > 0) {
            items.push(...calcConcreteFromRecipe(recipeItems, vol, specificWeight, concreteParamKey, label));
          } else {
            items.push({
              description: label,
              unit: 'm3',
              quantity: parseFloat(vol.toFixed(4)),
              source_param_key: concreteParamKey,
              material_id: concreteParam.material_id || null,
              product_id: null,
              is_auto_calculated: true,
              unit_price: concreteParam.unit_price || 0,
            });
          }
        } else if (concreteParam) {
          items.push({
            description: concreteParam.param_label || 'Concreto',
            unit: 'm3',
            quantity: parseFloat(vol.toFixed(4)),
            source_param_key: concreteParamKey,
            material_id: concreteParam.material_id || null,
            product_id: null,
            is_auto_calculated: true,
            unit_price: concreteParam.unit_price || 0,
          });
        }
      }
    }

    const reinforcementBars = (foundationParam?.dimensions as any)?.reinforcement_bars;
    if (Array.isArray(reinforcementBars) && reinforcementBars.length > 0) {
      const dims = foundationParam?.dimensions as any;
      const b = dims?.largura || 0;
      const l = dims?.comprimento || 0;
      const cob = dims?.cobrimento || 0;

      reinforcementBars.forEach((bar: any, idx: number) => {
        const rtype = bar.reinforcement_type || 'malha';
        const hook = (bar.hook_length_cm || 5) / 100;

        if (rtype === 'malha') {
          const spX = (bar.spacing_x || 20) / 100;
          const spY = (bar.spacing_y || 20) / 100;
          const netB = Math.max(0, b - 2 * cob);
          const netL = Math.max(0, l - 2 * cob);
          const barsX = spX > 0 ? Math.ceil(netB / spX) + 1 : 0;
          const barsY = spY > 0 ? Math.ceil(netL / spY) + 1 : 0;
          const lenBarX = netL + 2 * hook;
          const lenBarY = netB + 2 * hook;
          const totalMeters = barsX * lenBarX + barsY * lenBarY;
          const nodes = barsX * barsY;

          if (bar.material_id && totalMeters > 0) {
            const pkgSize = bar.package_size || 1;
            const qty = parseFloat(((totalMeters * qtd) / pkgSize).toFixed(4));
            if (qty > 0) {
              items.push({
                description: bar.material_name || `Ferro Malha ${idx + 1}`,
                unit: bar.unit || 'BR',
                quantity: qty,
                source_param_key: 'reinforcement_bars',
                material_id: bar.material_id,
                product_id: null,
                is_auto_calculated: true,
                unit_price: bar.resale_price || 0,
              });
            }
          }

          if (bar.wire_material_id && nodes > 0 && (bar.wire_per_node_m || 0) > 0) {
            const wireMeters = nodes * (bar.wire_per_node_m || 0.08);
            const wirePkg = bar.wire_material_pkg || 1;
            const wireQty = parseFloat(((wireMeters * qtd) / wirePkg).toFixed(4));
            if (wireQty > 0) {
              items.push({
                description: bar.wire_material_name || 'Arame Recozido',
                unit: bar.wire_material_unit || 'kg',
                quantity: wireQty,
                source_param_key: 'reinforcement_bars_wire',
                material_id: bar.wire_material_id,
                product_id: null,
                is_auto_calculated: true,
                unit_price: bar.wire_material_price || 0,
              });
            }
          }
        } else if (rtype === 'viga' || rtype === 'coluna') {
          const elementLen = (dims?.comprimento || dims?.altura || 0);

          if (bar.long_material_id && (bar.long_bars_qty || 0) > 0 && elementLen > 0) {
            const longLen = elementLen + 2 * hook;
            const longMeters = (bar.long_bars_qty || 0) * longLen;
            const longPkg = bar.long_material_pkg || 12;
            const longQty = parseFloat(((longMeters * qtd) / longPkg).toFixed(4));
            if (longQty > 0) {
              items.push({
                description: bar.long_material_name || `Ferro Longitudinal ${idx + 1}`,
                unit: bar.long_material_unit || 'BR',
                quantity: longQty,
                source_param_key: 'reinforcement_bars_long',
                material_id: bar.long_material_id,
                product_id: null,
                is_auto_calculated: true,
                unit_price: bar.long_material_price || 0,
              });
            }
          }

          if (bar.trans_material_id && (bar.trans_spacing_cm || 0) > 0 && elementLen > 0) {
            const transSpacing = (bar.trans_spacing_cm || 20) / 100;
            const transCount = transSpacing > 0 ? Math.ceil(elementLen / transSpacing) + 1 : 0;
            const transPerimeter = rtype === 'viga'
              ? 2 * (Math.max(0, b - 2 * cob) + Math.max(0, (dims?.altura || 0) - 2 * cob)) + 4 * hook
              : 2 * (Math.max(0, b - 2 * cob) + Math.max(0, (dims?.comprimento || 0) - 2 * cob)) + 4 * hook;
            const transMeters = transCount * transPerimeter;
            const transPkg = bar.trans_material_pkg || 12;
            const transQty = parseFloat(((transMeters * qtd) / transPkg).toFixed(4));
            if (transQty > 0) {
              items.push({
                description: bar.trans_material_name || `Estribo ${idx + 1}`,
                unit: bar.trans_material_unit || 'BR',
                quantity: transQty,
                source_param_key: 'reinforcement_bars_trans',
                material_id: bar.trans_material_id,
                product_id: null,
                is_auto_calculated: true,
                unit_price: bar.trans_material_price || 0,
              });
            }
          }
        } else {
          if (!bar.material_id || !(bar.meters_used > 0)) return;
          const packageSize = bar.package_size || 1;
          const qty = parseFloat(((bar.meters_used * qtd) / packageSize).toFixed(4));
          if (qty <= 0) return;
          items.push({
            description: bar.material_name || `Ferro/Aco ${idx + 1}`,
            unit: bar.unit || 'BR',
            quantity: qty,
            source_param_key: 'reinforcement_bars',
            material_id: bar.material_id,
            product_id: null,
            is_auto_calculated: true,
            unit_price: bar.resale_price || 0,
          });
        }
      });
    }

    const caixariaItems = (foundationParam?.dimensions as any)?.caixaria_items;
    if (Array.isArray(caixariaItems) && caixariaItems.length > 0) {
      caixariaItems.forEach((cx: any, idx: number) => {
        if (!cx.material_id || !(cx.quantity_per_unit > 0)) return;
        const packageSize = cx.package_size || 1;
        const qty = parseFloat(((cx.quantity_per_unit * qtd) / packageSize).toFixed(4));
        if (qty <= 0) return;
        items.push({
          description: cx.material_name || `Caixaria ${idx + 1}`,
          unit: cx.unit || 'un',
          quantity: qty,
          source_param_key: 'caixaria_items',
          material_id: cx.material_id,
          product_id: null,
          is_auto_calculated: true,
          unit_price: cx.resale_price || 0,
        });
      });
    }
  }

  return items.filter(i => i.quantity > 0);
}
