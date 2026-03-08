import { supabase } from './supabase';
import { logger, logApiCall, logApiSuccess, logApiError } from './logger';

export interface DbOperationResult<T> {
  data: T | null;
  error: Error | null;
  success: boolean;
  duration: number;
}

export class DatabaseError extends Error {
  constructor(
    message: string,
    public originalError?: any,
    public operation?: string,
    public table?: string
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export async function safeDbOperation<T>(
  component: string,
  operation: string,
  dbCall: () => Promise<{ data: T | null; error: any }>
): Promise<DbOperationResult<T>> {
  const startTime = performance.now();

  logApiCall(component, operation);

  try {
    const { data, error } = await dbCall();
    const duration = performance.now() - startTime;

    if (error) {
      const dbError = new DatabaseError(
        error.message || 'Database operation failed',
        error,
        operation
      );

      logApiError(component, operation, dbError, { duration });

      return {
        data: null,
        error: dbError,
        success: false,
        duration,
      };
    }

    logApiSuccess(component, operation, { recordCount: Array.isArray(data) ? data.length : 1, duration });

    return {
      data,
      error: null,
      success: true,
      duration,
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    const dbError = new DatabaseError(
      'Unexpected error during database operation',
      error,
      operation
    );

    logApiError(component, operation, dbError, { duration });

    return {
      data: null,
      error: dbError,
      success: false,
      duration,
    };
  }
}

export async function safeSelect<T>(
  component: string,
  table: string,
  query: any,
  options?: { single?: boolean; operation?: string }
): Promise<DbOperationResult<T>> {
  const operation = options?.operation || `select_${table}`;

  return safeDbOperation<T>(component, operation, async () => {
    let queryBuilder = supabase.from(table).select(query);

    if (options?.single) {
      return queryBuilder.maybeSingle();
    }

    return queryBuilder;
  });
}

export async function safeInsert<T>(
  component: string,
  table: string,
  data: any,
  options?: { operation?: string }
): Promise<DbOperationResult<T>> {
  const operation = options?.operation || `insert_${table}`;

  logger.info(component, operation, 'Inserting data', {
    table,
    recordCount: Array.isArray(data) ? data.length : 1,
  });

  return safeDbOperation<T>(component, operation, async () => {
    return supabase.from(table).insert(data).select();
  });
}

export async function safeUpdate<T>(
  component: string,
  table: string,
  data: any,
  match: Record<string, any>,
  options?: { operation?: string }
): Promise<DbOperationResult<T>> {
  const operation = options?.operation || `update_${table}`;

  logger.info(component, operation, 'Updating data', {
    table,
    match,
  });

  return safeDbOperation<T>(component, operation, async () => {
    return supabase.from(table).update(data).match(match).select();
  });
}

export async function safeDelete<T>(
  component: string,
  table: string,
  match: Record<string, any>,
  options?: { operation?: string }
): Promise<DbOperationResult<T>> {
  const operation = options?.operation || `delete_${table}`;

  logger.warn(component, operation, 'Deleting data', {
    table,
    match,
  });

  return safeDbOperation<T>(component, operation, async () => {
    return supabase.from(table).delete().match(match).select();
  });
}

export async function safeRpc<T>(
  component: string,
  functionName: string,
  params?: any
): Promise<DbOperationResult<T>> {
  const operation = `rpc_${functionName}`;

  logger.info(component, operation, 'Calling RPC function', {
    functionName,
    params,
  });

  return safeDbOperation<T>(component, operation, async () => {
    return supabase.rpc(functionName, params);
  });
}

export function handleDbError(
  component: string,
  error: DatabaseError | Error,
  userMessage?: string
): void {
  console.error(`[${component}] Database error:`, error);

  if (error instanceof DatabaseError && error.originalError) {
    console.error('Original error:', error.originalError);
  }

  const message = userMessage || 'Erro ao processar operação. Tente novamente.';
  alert(message);
}

export async function retryDbOperation<T>(
  operation: () => Promise<DbOperationResult<T>>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<DbOperationResult<T>> {
  let lastResult: DbOperationResult<T> | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    lastResult = await operation();

    if (lastResult.success) {
      return lastResult;
    }

    if (attempt < maxRetries) {
      logger.warn('DbHelper', 'retry', `Attempt ${attempt} failed, retrying in ${delayMs}ms`, {
        attempt,
        maxRetries,
      });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs *= 2;
    }
  }

  logger.error('DbHelper', 'retry', `All ${maxRetries} attempts failed`, lastResult?.error);
  return lastResult!;
}

export async function batchDbOperation<T>(
  component: string,
  operations: Array<() => Promise<DbOperationResult<T>>>,
  options?: { stopOnError?: boolean }
): Promise<DbOperationResult<T[]>> {
  const startTime = performance.now();
  const results: T[] = [];
  const errors: Error[] = [];

  logger.info(component, 'batch_operation', `Starting batch of ${operations.length} operations`);

  for (let i = 0; i < operations.length; i++) {
    const result = await operations[i]();

    if (result.success && result.data) {
      results.push(result.data);
    } else if (result.error) {
      errors.push(result.error);

      if (options?.stopOnError) {
        logger.error(
          component,
          'batch_operation',
          `Batch stopped at operation ${i + 1} due to error`,
          result.error
        );
        break;
      }
    }
  }

  const duration = performance.now() - startTime;
  const hasErrors = errors.length > 0;

  if (hasErrors) {
    logger.warn(component, 'batch_operation', `Batch completed with ${errors.length} errors`, {
      successCount: results.length,
      errorCount: errors.length,
      duration,
    });
  } else {
    logger.info(component, 'batch_operation', `Batch completed successfully`, {
      successCount: results.length,
      duration,
    });
  }

  return {
    data: results,
    error: hasErrors ? new Error(`${errors.length} operations failed`) : null,
    success: !hasErrors,
    duration,
  };
}

export function validateData<T>(
  component: string,
  data: T,
  validations: Record<keyof T, (value: any) => string | null>
): { valid: boolean; errors: Partial<Record<keyof T, string>> } {
  const errors: Partial<Record<keyof T, string>> = {};

  for (const [field, validator] of Object.entries(validations)) {
    const error = validator((data as any)[field]);
    if (error) {
      errors[field as keyof T] = error;
      logger.warn(component, 'validation', `Field ${String(field)} failed validation`, {
        field,
        error,
        value: (data as any)[field],
      });
    }
  }

  const valid = Object.keys(errors).length === 0;

  if (valid) {
    logger.debug(component, 'validation', 'All validations passed');
  } else {
    logger.warn(component, 'validation', `Validation failed for ${Object.keys(errors).length} fields`, errors);
  }

  return { valid, errors };
}
