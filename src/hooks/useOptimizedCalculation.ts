import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { useThrottle } from './useThrottle';
import { useCalculationWorker } from './useCalculationWorker';

interface CalculationOptions {
  throttleDelay?: number;
  useWorker?: boolean;
  skipIfUnchanged?: boolean;
}

interface CalculationResult<T> {
  data: T | null;
  isCalculating: boolean;
  error: string | null;
}

/**
 * Hook otimizado para cálculos pesados em tempo real
 *
 * Combina:
 * - useMemo para cache de resultados
 * - useThrottle para limitar frequência de cálculo
 * - Web Worker para cálculos em background
 *
 * @example
 * const { data: consumption, isCalculating } = useOptimizedCalculation(
 *   () => calculateConsumption(recipe, weight),
 *   [recipe, weight],
 *   { throttleDelay: 100, useWorker: true }
 * );
 */
export function useOptimizedCalculation<T>(
  calculation: () => T | Promise<T>,
  dependencies: any[],
  options: CalculationOptions = {}
): CalculationResult<T> {
  const {
    throttleDelay = 100,
    useWorker = false,
    skipIfUnchanged = true
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const throttledDeps = useThrottle(
    JSON.stringify(dependencies),
    throttleDelay
  );

  const previousDepsRef = useRef<string>('');

  useEffect(() => {
    const depsString = JSON.stringify(dependencies);

    if (skipIfUnchanged && depsString === previousDepsRef.current) {
      return;
    }

    previousDepsRef.current = depsString;

    const performCalculation = async () => {
      setIsCalculating(true);
      setError(null);

      try {
        const result = await calculation();
        setData(result);
      } catch (err: any) {
        console.error('Calculation error:', err);
        setError(err.message || 'Calculation failed');
        setData(null);
      } finally {
        setIsCalculating(false);
      }
    };

    performCalculation();
  }, [throttledDeps]);

  return { data, isCalculating, error };
}

/**
 * Hook específico para cálculo de consumo de materiais
 * Otimizado com Web Worker e throttle
 */
export function useConsumptionCalculation(
  recipeMaterials: any[],
  weight: number,
  specificWeight?: number
) {
  const worker = useCalculationWorker();

  const throttledWeight = useThrottle(weight, 100);
  const throttledSpecificWeight = useThrottle(specificWeight || 0, 100);

  const [result, setResult] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const calculate = useCallback(() => {
    if (!recipeMaterials || recipeMaterials.length === 0 || !weight) {
      setResult(null);
      return;
    }

    setIsCalculating(true);

    if (worker.isReady) {
      const cementMaterial = recipeMaterials.find((m: any) => m.is_cement);
      if (!cementMaterial) {
        setIsCalculating(false);
        return;
      }

      const cementQuantity = parseFloat(cementMaterial.quantity) || 0;
      if (cementQuantity === 0) {
        setIsCalculating(false);
        return;
      }

      const multiplier = weight / cementQuantity;

      worker.calculateMaterialConsumption(
        recipeMaterials,
        multiplier,
        throttledSpecificWeight,
        (data: any) => {
          setResult(data);
          setIsCalculating(false);
        }
      );
    } else {
      const calcResult = calculateConsumptionSync(
        recipeMaterials,
        weight,
        throttledSpecificWeight
      );
      setResult(calcResult);
      setIsCalculating(false);
    }
  }, [
    recipeMaterials,
    throttledWeight,
    throttledSpecificWeight,
    worker.isReady
  ]);

  useEffect(() => {
    calculate();
  }, [calculate]);

  return { result, isCalculating };
}

/**
 * Hook para cálculo de peso de armaduras
 * Usa Web Worker se disponível
 */
export function useReinforcementWeightCalculation(reinforcements: any[]) {
  const worker = useCalculationWorker();

  const throttledReinforcements = useThrottle(
    JSON.stringify(reinforcements),
    100
  );

  return useMemo(() => {
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
  }, [throttledReinforcements]);
}

/**
 * Hook para cálculo de custo total
 * Combina materiais, armaduras e acessórios
 */
export function useTotalCostCalculation(
  materialCost: number,
  reinforcementCost: number,
  accessoryCost: number
) {
  const throttledMaterialCost = useThrottle(materialCost, 100);
  const throttledReinforcementCost = useThrottle(reinforcementCost, 100);
  const throttledAccessoryCost = useThrottle(accessoryCost, 100);

  return useMemo(() => {
    return {
      total: throttledMaterialCost + throttledReinforcementCost + throttledAccessoryCost,
      breakdown: {
        materials: throttledMaterialCost,
        reinforcements: throttledReinforcementCost,
        accessories: throttledAccessoryCost
      }
    };
  }, [throttledMaterialCost, throttledReinforcementCost, throttledAccessoryCost]);
}

function calculateConsumptionSync(
  recipeMaterials: any[],
  weight: number,
  specificWeight: number
) {
  if (!recipeMaterials || recipeMaterials.length === 0) {
    return { materials: [], totalCost: 0, totalWeight: 0 };
  }

  const cementMaterial = recipeMaterials.find((m: any) => m.is_cement);
  if (!cementMaterial) {
    return { materials: [], totalCost: 0, totalWeight: 0 };
  }

  const cementQuantity = parseFloat(cementMaterial.quantity) || 0;
  if (cementQuantity === 0) {
    return { materials: [], totalCost: 0, totalWeight: 0 };
  }

  const multiplier = weight / cementQuantity;

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
