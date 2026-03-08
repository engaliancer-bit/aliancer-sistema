import { supabase } from './supabase';

export interface MaterialCost {
  material_id: string;
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
}

export interface ProductionCosts {
  materials: Record<string, MaterialCost>;
  total_cost: number;
  calculated_at: string;
}

export async function calculateProductionCosts(
  productId: string,
  recipeId: string | null,
  quantity: number,
  productType?: string,
  totalWeight?: number
): Promise<ProductionCosts> {
  const costs: ProductionCosts = {
    materials: {},
    total_cost: 0,
    calculated_at: new Date().toISOString()
  };

  const materialMap = new Map<string, { quantity: number; unit: string; unit_price: number; name: string }>();

  const addMaterial = async (materialId: string, quantity: number) => {
    if (materialMap.has(materialId)) {
      const existing = materialMap.get(materialId)!;
      existing.quantity += quantity;
    } else {
      const { data: material } = await supabase
        .from('materials')
        .select('name, unit, unit_cost')
        .eq('id', materialId)
        .maybeSingle();

      if (material) {
        materialMap.set(materialId, {
          quantity,
          unit: material.unit,
          unit_price: material.unit_cost || 0,
          name: material.name
        });
      }
    }
  };

  // 1. RECEITA - CÁLCULO PROPORCIONAL POR PESO
  if (recipeId && totalWeight) {
    const { data: recipeItems } = await supabase
      .from('recipe_items')
      .select('material_id, quantity')
      .eq('recipe_id', recipeId);

    if (recipeItems && recipeItems.length > 0) {
      const totalRecipeWeight = recipeItems.reduce((sum, item) => sum + parseFloat(item.quantity), 0);
      const multiplier = totalWeight / totalRecipeWeight;

      for (const item of recipeItems) {
        const itemQuantity = parseFloat(item.quantity);
        const consumo = multiplier * itemQuantity * quantity;
        await addMaterial(item.material_id, consumo);
      }
    }
  } else if (recipeId && !totalWeight) {
    // Fallback: se não tem peso, usar cálculo direto
    const { data: recipeItems } = await supabase
      .from('recipe_items')
      .select('material_id, quantity')
      .eq('recipe_id', recipeId);

    if (recipeItems && recipeItems.length > 0) {
      for (const item of recipeItems) {
        await addMaterial(item.material_id, item.quantity * quantity);
      }
    }
  }

  // 2. PESOS DE MATERIAIS (se não tem receita)
  if (!recipeId) {
    const { data: materialWeights } = await supabase
      .from('product_material_weights')
      .select('material_id, weight_per_unit')
      .eq('product_id', productId);

    if (materialWeights && materialWeights.length > 0) {
      for (const weight of materialWeights) {
        await addMaterial(weight.material_id, weight.weight_per_unit * quantity);
      }
    }
  }

  // 3. ACESSÓRIOS/MATERIAIS (para ferragens diversas)
  const { data: accessories } = await supabase
    .from('product_accessories')
    .select('material_id, quantity, item_type')
    .eq('product_id', productId);

  if (accessories && accessories.length > 0) {
    const materialAccessories = accessories.filter(
      acc => acc.item_type === 'material' && acc.material_id
    );

    for (const acc of materialAccessories) {
      await addMaterial(acc.material_id, acc.quantity * quantity);
    }
  }

  // 4. ARMADURAS (para produtos premoldados, artefatos e ferragens diversas)
  if (productType === 'premolded' || productType === 'artifact' || productType === 'ferragens_diversas' || !recipeId) {
    const { data: reinforcements } = await supabase
      .from('product_reinforcements')
      .select('material_id, total_length_meters')
      .eq('product_id', productId);

    if (reinforcements && reinforcements.length > 0) {
      for (const reinforcement of reinforcements) {
        await addMaterial(reinforcement.material_id, reinforcement.total_length_meters * quantity);
      }
    }
  }

  // Converter mapa para objeto de custos
  let totalCost = 0;
  materialMap.forEach((data, materialId) => {
    const materialTotal = data.quantity * data.unit_price;
    costs.materials[materialId] = {
      material_id: materialId,
      name: data.name,
      quantity: data.quantity,
      unit: data.unit,
      unit_price: data.unit_price,
      total: materialTotal
    };
    totalCost += materialTotal;
  });

  costs.total_cost = totalCost;

  return costs;
}

export function materialCostsToMovements(
  costs: ProductionCosts,
  productionDate: string,
  productName: string,
  quantity: number,
  unit: string
): Array<{
  material_id: string;
  movement_type: string;
  quantity: number;
  notes: string;
}> {
  return Object.values(costs.materials).map(material => ({
    material_id: material.material_id,
    movement_type: 'saida',
    quantity: material.quantity,
    notes: `Consumo para produção de ${quantity} ${unit} de ${productName}`
  }));
}
