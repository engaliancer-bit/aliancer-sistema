import { useEffect, useRef, useCallback, useState } from 'react';

interface WorkerMessage {
  type: string;
  data?: any;
}

interface WorkerResponse {
  type: string;
  result?: any;
  error?: string;
}

type CalculationCallback = (result: any) => void;
type ErrorCallback = (error: string) => void;

export function useCalculationWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const callbacksRef = useRef<Map<string, CalculationCallback>>(new Map());
  const errorCallbackRef = useRef<ErrorCallback | null>(null);

  useEffect(() => {
    if (typeof Worker === 'undefined') {
      console.warn('Web Workers not supported in this browser');
      return;
    }

    try {
      const worker = new Worker('/calculation.worker.js');

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const { type, result, error } = event.data;

        if (type === 'WORKER_READY') {
          console.log('✅ Calculation Worker ready');
          setIsReady(true);
          return;
        }

        if (type === 'CALCULATION_ERROR') {
          console.error('❌ Worker error:', error);
          if (errorCallbackRef.current) {
            errorCallbackRef.current(error || 'Unknown error');
          }
          return;
        }

        const callback = callbacksRef.current.get(type);
        if (callback && result !== undefined) {
          callback(result);
        }
      };

      worker.onerror = (error) => {
        console.error('❌ Worker error:', error);
        if (errorCallbackRef.current) {
          errorCallbackRef.current(error.message);
        }
      };

      workerRef.current = worker;

      return () => {
        worker.terminate();
        workerRef.current = null;
        setIsReady(false);
      };
    } catch (error) {
      console.error('Failed to create worker:', error);
      setIsReady(false);
    }
  }, []);

  const calculateReinforcementWeight = useCallback(
    (reinforcements: any[], callback: CalculationCallback) => {
      if (!workerRef.current || !isReady) {
        console.warn('Worker not ready, falling back to sync calculation');
        const result = calculateReinforcementWeightSync(reinforcements);
        callback(result);
        return;
      }

      callbacksRef.current.set('REINFORCEMENT_WEIGHT_RESULT', callback);
      workerRef.current.postMessage({
        type: 'CALCULATE_REINFORCEMENT_WEIGHT',
        data: { reinforcements }
      });
    },
    [isReady]
  );

  const calculateMaterialConsumption = useCallback(
    (
      recipeMaterials: any[],
      multiplier: number,
      specificWeight: number,
      callback: CalculationCallback
    ) => {
      if (!workerRef.current || !isReady) {
        console.warn('Worker not ready, falling back to sync calculation');
        const result = calculateMaterialConsumptionSync(recipeMaterials, multiplier, specificWeight);
        callback(result);
        return;
      }

      callbacksRef.current.set('MATERIAL_CONSUMPTION_RESULT', callback);
      workerRef.current.postMessage({
        type: 'CALCULATE_MATERIAL_CONSUMPTION',
        data: { recipeMaterials, multiplier, specificWeight }
      });
    },
    [isReady]
  );

  const calculateTraceMaterials = useCallback(
    (
      recipeMaterials: any[],
      cementWeight: number,
      pesoArtefato: number,
      callback: CalculationCallback
    ) => {
      if (!workerRef.current || !isReady) {
        console.warn('Worker not ready, falling back to sync calculation');
        const result = calculateTraceMaterialsSync(recipeMaterials, cementWeight, pesoArtefato);
        callback(result);
        return;
      }

      callbacksRef.current.set('TRACE_MATERIALS_RESULT', callback);
      workerRef.current.postMessage({
        type: 'CALCULATE_TRACE_MATERIALS',
        data: { recipeMaterials, cementWeight, pesoArtefato }
      });
    },
    [isReady]
  );

  const calculateCompleteCost = useCallback(
    (
      traceMaterials: any,
      reinforcements: any,
      accessories: any[],
      callback: CalculationCallback
    ) => {
      if (!workerRef.current || !isReady) {
        console.warn('Worker not ready, falling back to sync calculation');
        const result = calculateCompleteCostSync(traceMaterials, reinforcements, accessories);
        callback(result);
        return;
      }

      callbacksRef.current.set('COMPLETE_COST_RESULT', callback);
      workerRef.current.postMessage({
        type: 'CALCULATE_COMPLETE_COST',
        data: { traceMaterials, reinforcements, accessories }
      });
    },
    [isReady]
  );

  const onError = useCallback((callback: ErrorCallback) => {
    errorCallbackRef.current = callback;
  }, []);

  return {
    isReady,
    calculateReinforcementWeight,
    calculateMaterialConsumption,
    calculateTraceMaterials,
    calculateCompleteCost,
    onError
  };
}

function calculateReinforcementWeightSync(reinforcements: any[]) {
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

function calculateMaterialConsumptionSync(
  recipeMaterials: any[],
  multiplier: number,
  specificWeight: number
) {
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

function calculateTraceMaterialsSync(
  recipeMaterials: any[],
  cementWeight: number,
  pesoArtefato: number
) {
  if (!recipeMaterials || recipeMaterials.length === 0) {
    return { materials: [], totalCost: 0, totalWeight: 0 };
  }

  const cementMaterial = recipeMaterials.find((m: any) => m.is_cement);
  if (!cementMaterial) {
    return { materials: [], totalCost: 0, totalWeight: 0 };
  }

  const cementRecipeQuantity = parseFloat(cementMaterial.quantity) || 0;
  if (cementRecipeQuantity === 0) {
    return { materials: [], totalCost: 0, totalWeight: 0 };
  }

  const weight = cementWeight || pesoArtefato || 0;
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

function calculateCompleteCostSync(traceMaterials: any, reinforcements: any, accessories: any[]) {
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

  return { totalCost, totalWeight };
}
