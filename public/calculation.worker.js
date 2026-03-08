// Web Worker para Cálculos Pesados de Consumo
// Executa cálculos em background sem travar a UI

self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  try {
    switch (type) {
      case 'CALCULATE_REINFORCEMENT_WEIGHT':
        const reinforcementResult = calculateReinforcementWeight(data);
        self.postMessage({ type: 'REINFORCEMENT_WEIGHT_RESULT', result: reinforcementResult });
        break;

      case 'CALCULATE_MATERIAL_CONSUMPTION':
        const consumptionResult = calculateMaterialConsumption(data);
        self.postMessage({ type: 'MATERIAL_CONSUMPTION_RESULT', result: consumptionResult });
        break;

      case 'CALCULATE_TRACE_MATERIALS':
        const traceMaterialsResult = calculateTraceMaterials(data);
        self.postMessage({ type: 'TRACE_MATERIALS_RESULT', result: traceMaterialsResult });
        break;

      case 'CALCULATE_COMPLETE_COST':
        const completeCostResult = calculateCompleteCost(data);
        self.postMessage({ type: 'COMPLETE_COST_RESULT', result: completeCostResult });
        break;

      default:
        throw new Error(`Unknown calculation type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      type: 'CALCULATION_ERROR',
      error: error.message
    });
  }
});

function calculateReinforcementWeight({ reinforcements }) {
  if (!reinforcements || reinforcements.length === 0) {
    return { totalWeight: 0, items: [] };
  }

  const STEEL_DENSITY = 7850;
  const items = [];
  let totalWeight = 0;

  for (const reinforcement of reinforcements) {
    const barCount = parseFloat(reinforcement.bar_count) || 0;
    const lengthMeters = parseFloat(reinforcement.bar_length_meters) || 0;
    const diameterMm = parseFloat(reinforcement.bar_diameter_mm) || 0;

    if (barCount > 0 && lengthMeters > 0 && diameterMm > 0) {
      const radiusMeters = (diameterMm / 1000) / 2;
      const volumeM3 = Math.PI * Math.pow(radiusMeters, 2) * lengthMeters * barCount;
      const weight = volumeM3 * STEEL_DENSITY;

      items.push({
        id: reinforcement.tempId || reinforcement.id,
        weight,
        barCount,
        lengthMeters,
        diameterMm
      });

      totalWeight += weight;
    }
  }

  return { totalWeight, items };
}

function calculateMaterialConsumption({ recipeMaterials, multiplier, specificWeight }) {
  if (!recipeMaterials || recipeMaterials.length === 0) {
    return { materials: [], totalCost: 0, totalWeight: 0 };
  }

  const materials = [];
  let totalCost = 0;
  let totalWeight = 0;

  for (const material of recipeMaterials) {
    const recipeQuantity = parseFloat(material.quantity) || 0;
    const unitCost = parseFloat(material.unit_cost) || 0;
    const consumption = recipeQuantity * multiplier;
    const cost = consumption * unitCost;

    const materialWeight = consumption * (parseFloat(material.weight_per_unit) || 0);

    materials.push({
      material_id: material.material_id,
      material_name: material.material_name,
      recipe_quantity: recipeQuantity,
      consumption,
      unit_cost: unitCost,
      total_cost: cost,
      weight: materialWeight,
      unit: material.unit
    });

    totalCost += cost;
    totalWeight += materialWeight;
  }

  if (specificWeight && multiplier) {
    const concreteWeight = multiplier * specificWeight;
    totalWeight += concreteWeight;
  }

  return { materials, totalCost, totalWeight };
}

function calculateTraceMaterials({ recipeMaterials, cementWeight, pesoArtefato }) {
  if (!recipeMaterials || recipeMaterials.length === 0) {
    return { materials: [], totalCost: 0, totalWeight: 0 };
  }

  const cementMaterial = recipeMaterials.find(m => m.is_cement);
  if (!cementMaterial) {
    return { materials: [], totalCost: 0, totalWeight: 0 };
  }

  const cementRecipeQuantity = parseFloat(cementMaterial.quantity) || 0;
  if (cementRecipeQuantity === 0) {
    return { materials: [], totalCost: 0, totalWeight: 0 };
  }

  const weight = parseFloat(cementWeight) || parseFloat(pesoArtefato) || 0;
  if (weight === 0) {
    return { materials: [], totalCost: 0, totalWeight: 0 };
  }

  const proportionalMultiplier = weight / cementRecipeQuantity;

  const materials = [];
  let totalCost = 0;
  let totalWeight = 0;

  for (const material of recipeMaterials) {
    const recipeQuantity = parseFloat(material.quantity) || 0;
    const unitCost = parseFloat(material.unit_cost) || 0;
    const consumption = recipeQuantity * proportionalMultiplier;
    const cost = consumption * unitCost;

    const materialWeight = consumption * (parseFloat(material.weight_per_unit) || 1);

    materials.push({
      material_id: material.material_id,
      material_name: material.material_name,
      recipe_quantity: recipeQuantity,
      consumption,
      unit_cost: unitCost,
      total_cost: cost,
      weight: materialWeight,
      unit: material.unit
    });

    totalCost += cost;
    totalWeight += materialWeight;
  }

  return { materials, totalCost, totalWeight };
}

function calculateCompleteCost({ traceMaterials, reinforcements, accessories }) {
  let totalCost = 0;
  let totalWeight = 0;

  if (traceMaterials?.materials) {
    for (const material of traceMaterials.materials) {
      totalCost += parseFloat(material.total_cost) || 0;
      totalWeight += parseFloat(material.weight) || 0;
    }
  }

  if (reinforcements?.items) {
    for (const item of reinforcements.items) {
      totalWeight += parseFloat(item.weight) || 0;
      totalCost += parseFloat(item.cost) || 0;
    }
  }

  if (accessories) {
    for (const accessory of accessories) {
      totalCost += parseFloat(accessory.total_cost) || 0;
    }
  }

  return {
    totalCost,
    totalWeight
  };
}

self.postMessage({ type: 'WORKER_READY' });
