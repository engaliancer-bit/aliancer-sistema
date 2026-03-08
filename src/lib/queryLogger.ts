/**
 * Utilit ário para logging e monitoramento de performance de queries
 */

export interface QueryPerformanceLog {
  queryName: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  error?: Error;
}

// Armazena logs em memória (últimos 100)
const queryLogs: QueryPerformanceLog[] = [];
const MAX_LOGS = 100;

// Thresholds de performance
const PERFORMANCE_THRESHOLDS = {
  SLOW: 1000,      // > 1s é considerado lento
  WARNING: 500,    // > 500ms merece atenção
  GOOD: 200,       // < 200ms é bom
} as const;

/**
 * Executa uma query com logging automático de performance
 *
 * @param queryName - Nome descritivo da query para logging
 * @param queryFn - Função que executa a query
 * @returns Resultado da query
 *
 * @example
 * ```typescript
 * const { data } = await logQueryPerformance(
 *   'Buscar produtos',
 *   () => supabase.from('products').select('*').limit(50)
 * );
 * ```
 */
export async function logQueryPerformance<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  const timestamp = new Date();

  try {
    const result = await queryFn();
    const duration = Date.now() - startTime;

    // Registra log
    addLog({
      queryName,
      duration,
      timestamp,
      success: true,
    });

    // Console logging baseado em performance
    if (duration > PERFORMANCE_THRESHOLDS.SLOW) {
      console.warn(
        `%c⚠️ Query LENTA: ${queryName}`,
        'color: #ff6b6b; font-weight: bold',
        `${duration}ms`
      );
    } else if (duration > PERFORMANCE_THRESHOLDS.WARNING) {
      console.log(
        `%c⚡ Query: ${queryName}`,
        'color: #ffa500; font-weight: bold',
        `${duration}ms`
      );
    } else {
      console.log(
        `%c✅ Query: ${queryName}`,
        'color: #51cf66',
        `${duration}ms`
      );
    }

    return result;
  } catch (error: any) {
    const duration = Date.now() - startTime;

    // Registra erro
    addLog({
      queryName,
      duration,
      timestamp,
      success: false,
      error,
    });

    console.error(
      `%c❌ Query FALHOU: ${queryName}`,
      'color: #ff0000; font-weight: bold',
      `${duration}ms`,
      error
    );

    throw error;
  }
}

/**
 * Adiciona log ao histórico (mantém apenas últimos 100)
 */
function addLog(log: QueryPerformanceLog): void {
  queryLogs.push(log);

  // Mantém apenas os últimos logs
  if (queryLogs.length > MAX_LOGS) {
    queryLogs.shift();
  }
}

/**
 * Retorna todos os logs de performance
 */
export function getQueryLogs(): QueryPerformanceLog[] {
  return [...queryLogs];
}

/**
 * Retorna apenas queries lentas (> 1s)
 */
export function getSlowQueries(): QueryPerformanceLog[] {
  return queryLogs.filter((log) => log.duration > PERFORMANCE_THRESHOLDS.SLOW);
}

/**
 * Retorna estatísticas agregadas de performance
 */
export function getQueryStats() {
  if (queryLogs.length === 0) {
    return {
      totalQueries: 0,
      successRate: 0,
      averageDuration: 0,
      slowQueries: 0,
      fastQueries: 0,
    };
  }

  const successful = queryLogs.filter((log) => log.success).length;
  const slow = queryLogs.filter((log) => log.duration > PERFORMANCE_THRESHOLDS.SLOW).length;
  const fast = queryLogs.filter((log) => log.duration < PERFORMANCE_THRESHOLDS.GOOD).length;
  const totalDuration = queryLogs.reduce((sum, log) => sum + log.duration, 0);

  return {
    totalQueries: queryLogs.length,
    successRate: (successful / queryLogs.length) * 100,
    averageDuration: totalDuration / queryLogs.length,
    slowQueries: slow,
    fastQueries: fast,
  };
}

/**
 * Agrupa queries por nome e calcula estatísticas
 */
export function getQueryStatsByName() {
  const statsByName = new Map<
    string,
    {
      count: number;
      totalDuration: number;
      avgDuration: number;
      minDuration: number;
      maxDuration: number;
      failures: number;
    }
  >();

  queryLogs.forEach((log) => {
    const existing = statsByName.get(log.queryName);

    if (!existing) {
      statsByName.set(log.queryName, {
        count: 1,
        totalDuration: log.duration,
        avgDuration: log.duration,
        minDuration: log.duration,
        maxDuration: log.duration,
        failures: log.success ? 0 : 1,
      });
    } else {
      existing.count++;
      existing.totalDuration += log.duration;
      existing.avgDuration = existing.totalDuration / existing.count;
      existing.minDuration = Math.min(existing.minDuration, log.duration);
      existing.maxDuration = Math.max(existing.maxDuration, log.duration);
      if (!log.success) existing.failures++;
    }
  });

  return Array.from(statsByName.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.avgDuration - a.avgDuration); // Ordena por avg duration (pior primeiro)
}

/**
 * Limpa todos os logs
 */
export function clearQueryLogs(): void {
  queryLogs.length = 0;
}

/**
 * Exporta logs como JSON para análise externa
 */
export function exportLogsAsJSON(): string {
  return JSON.stringify(
    {
      exportDate: new Date().toISOString(),
      stats: getQueryStats(),
      statsByName: getQueryStatsByName(),
      logs: queryLogs,
    },
    null,
    2
  );
}

/**
 * Exporta logs como CSV para análise em Excel/Sheets
 */
export function exportLogsAsCSV(): string {
  const headers = ['Query Name', 'Duration (ms)', 'Timestamp', 'Success', 'Error'];
  const rows = queryLogs.map((log) => [
    log.queryName,
    log.duration.toString(),
    log.timestamp.toISOString(),
    log.success.toString(),
    log.error?.message || '',
  ]);

  return [headers, ...rows].map((row) => row.join(',')).join('\n');
}

/**
 * Monitora performance de uma função/componente específico
 */
export function createPerformanceMonitor(componentName: string) {
  return {
    async query<T>(operationName: string, queryFn: () => Promise<T>): Promise<T> {
      return logQueryPerformance(`${componentName}: ${operationName}`, queryFn);
    },
  };
}
