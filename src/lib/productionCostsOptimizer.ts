import { supabase } from './supabase';
import { logger } from './logger';
import { recordMetric } from './performanceMonitor';

interface BatchUpsertPayload {
  production_id: string;
  material_cost: number;
  labor_cost: number;
  indirect_cost: number;
  depreciation_cost: number;
  total_cost: number;
  cost_per_unit: number;
}

interface BatchUpsertResult {
  success: boolean;
  processedRecords: number;
  failedRecords: number;
  duration: number;
  error?: string;
}

const BATCH_SIZE = 50;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

export async function batchUpsertWithRetry(
  costs: BatchUpsertPayload[]
): Promise<BatchUpsertResult> {
  const startTime = performance.now();
  let processedRecords = 0;
  let failedRecords = 0;

  if (costs.length === 0) {
    return {
      success: true,
      processedRecords: 0,
      failedRecords: 0,
      duration: 0
    };
  }

  const batches = [];
  for (let i = 0; i < costs.length; i += BATCH_SIZE) {
    batches.push(costs.slice(i, i + BATCH_SIZE));
  }

  logger.info('ProductionCostsOptimizer', 'batchUpsertWithRetry',
    `Starting batch upsert: ${batches.length} batches, ${costs.length} total records`);

  const batchResults = await Promise.all(
    batches.map((batch, index) =>
      upsertBatchWithRetry(batch, index)
    )
  );

  for (const result of batchResults) {
    if (result.success) {
      processedRecords += result.processedRecords;
    } else {
      failedRecords += result.failedRecords;
    }
  }

  const duration = performance.now() - startTime;

  const finalResult: BatchUpsertResult = {
    success: failedRecords === 0,
    processedRecords,
    failedRecords,
    duration
  };

  recordMetric('production_costs_batch_upsert', duration, 'ms', {
    batchCount: String(batches.length),
    totalRecords: String(costs.length),
    successCount: String(processedRecords),
    failureCount: String(failedRecords)
  });

  logger.info('ProductionCostsOptimizer', 'batchUpsertWithRetry',
    `Batch upsert completed: ${duration.toFixed(2)}ms`, finalResult);

  return finalResult;
}

async function upsertBatchWithRetry(
  batch: BatchUpsertPayload[],
  batchIndex: number,
  attempt: number = 1
): Promise<{ success: boolean; processedRecords: number; failedRecords: number }> {
  try {
    const { error } = await supabase
      .from('production_costs')
      .upsert(batch);

    if (error) {
      if (attempt < MAX_RETRIES) {
        logger.warn('ProductionCostsOptimizer', 'upsertBatchWithRetry',
          `Batch ${batchIndex} attempt ${attempt} failed, retrying...`, error);

        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        return upsertBatchWithRetry(batch, batchIndex, attempt + 1);
      } else {
        logger.error('ProductionCostsOptimizer', 'upsertBatchWithRetry',
          `Batch ${batchIndex} failed after ${MAX_RETRIES} attempts`, error);

        return {
          success: false,
          processedRecords: 0,
          failedRecords: batch.length
        };
      }
    }

    return {
      success: true,
      processedRecords: batch.length,
      failedRecords: 0
    };
  } catch (err) {
    logger.error('ProductionCostsOptimizer', 'upsertBatchWithRetry',
      `Unexpected error in batch ${batchIndex}`, err);

    return {
      success: false,
      processedRecords: 0,
      failedRecords: batch.length
    };
  }
}

export async function validateProductionCostsData(
  costs: BatchUpsertPayload[]
): Promise<{ valid: boolean; invalidCount: number; errors: string[] }> {
  const errors: string[] = [];
  let invalidCount = 0;

  for (let i = 0; i < costs.length; i++) {
    const cost = costs[i];

    if (!cost.production_id) {
      errors.push(`Record ${i}: Missing production_id`);
      invalidCount++;
      continue;
    }

    if (typeof cost.material_cost !== 'number' || cost.material_cost < 0) {
      errors.push(`Record ${i}: Invalid material_cost`);
      invalidCount++;
    }

    if (typeof cost.labor_cost !== 'number' || cost.labor_cost < 0) {
      errors.push(`Record ${i}: Invalid labor_cost`);
      invalidCount++;
    }

    if (typeof cost.indirect_cost !== 'number' || cost.indirect_cost < 0) {
      errors.push(`Record ${i}: Invalid indirect_cost`);
      invalidCount++;
    }

    if (typeof cost.depreciation_cost !== 'number' || cost.depreciation_cost < 0) {
      errors.push(`Record ${i}: Invalid depreciation_cost`);
      invalidCount++;
    }

    if (typeof cost.total_cost !== 'number' || cost.total_cost < 0) {
      errors.push(`Record ${i}: Invalid total_cost`);
      invalidCount++;
    }

    if (typeof cost.cost_per_unit !== 'number' || cost.cost_per_unit < 0) {
      errors.push(`Record ${i}: Invalid cost_per_unit`);
      invalidCount++;
    }
  }

  if (errors.length > 0) {
    logger.warn('ProductionCostsOptimizer', 'validateProductionCostsData',
      `Validation found ${errors.length} errors`, { errors: errors.slice(0, 10) });
  }

  return {
    valid: invalidCount === 0,
    invalidCount,
    errors
  };
}

export function createLookupMap<T, K extends keyof T>(
  items: T[],
  keyField: K
): Map<string | number, T> {
  const map = new Map<string | number, T>();
  for (const item of items) {
    const key = item[keyField];
    if (key !== null && key !== undefined) {
      map.set(String(key), item);
    }
  }
  return map;
}

export function createGroupedMap<T, K extends keyof T>(
  items: T[],
  keyField: K
): Map<string | number, T[]> {
  const map = new Map<string | number, T[]>();
  for (const item of items) {
    const key = item[keyField];
    if (key !== null && key !== undefined) {
      const keyStr = String(key);
      if (!map.has(keyStr)) {
        map.set(keyStr, []);
      }
      map.get(keyStr)?.push(item);
    }
  }
  return map;
}
