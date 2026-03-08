import { useState, useCallback } from 'react';
import { useAbortController } from './useAbortController';

export interface RequestDefinition {
  (signal: AbortSignal): Promise<any>;
}

export interface RequestsMap {
  [key: string]: RequestDefinition;
}

export interface RequestOptions {
  timeout?: number; // Timeout em ms (padrão: sem timeout)
  onProgress?: (completed: number, total: number) => void;
  continueOnError?: boolean; // Continua mesmo se algum request falhar (padrão: true)
}

export interface MultipleRequestsResult {
  data: Record<string, any>;
  errors: Record<string, Error>;
  hasErrors: boolean;
  completedCount: number;
  totalCount: number;
}

/**
 * Hook para executar múltiplos requests em paralelo com cancelamento
 *
 * Features:
 * - Executa requests em paralelo
 * - Cancela todos os requests juntos
 * - Timeout opcional por request
 * - Gerencia erros individuais
 * - Callback de progresso
 * - Continua mesmo com erros (opcional)
 *
 * @example
 * ```tsx
 * const { executeRequests, loading, cancel } = useMultipleRequests();
 *
 * const loadData = async () => {
 *   const result = await executeRequests({
 *     produtos: async (signal) => {
 *       const { data } = await supabase.from('produtos').select('*');
 *       return data;
 *     },
 *     clientes: async (signal) => {
 *       const { data } = await supabase.from('clientes').select('*');
 *       return data;
 *     }
 *   }, {
 *     timeout: 5000,
 *     onProgress: (completed, total) => {
 *       console.log(`${completed}/${total} requests completados`);
 *     }
 *   });
 *
 *   console.log(result.data); // { produtos: [...], clientes: [...] }
 * };
 * ```
 */
export function useMultipleRequests() {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, Error>>({});
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const { getController, abort } = useAbortController();

  /**
   * Cria um wrapper que adiciona timeout a um request
   */
  const withTimeout = useCallback(
    (requestFn: RequestDefinition, timeoutMs: number): RequestDefinition => {
      return async (signal: AbortSignal) => {
        return Promise.race([
          requestFn(signal),
          new Promise((_, reject) => {
            const timeoutId = setTimeout(() => {
              reject(new Error(`Request timeout after ${timeoutMs}ms`));
            }, timeoutMs);

            // Limpa timeout se o signal for abortado
            if (signal) {
              const abortHandler = () => {
                clearTimeout(timeoutId);
              };
              signal.addEventListener('abort', abortHandler);
            }
          }),
        ]);
      };
    },
    []
  );

  /**
   * Executa múltiplos requests em paralelo
   */
  const executeRequests = useCallback(
    async (
      requests: RequestsMap,
      options: RequestOptions = {}
    ): Promise<MultipleRequestsResult> => {
      const {
        timeout,
        onProgress,
        continueOnError = true,
      } = options;

      const controller = getController();
      const signal = controller.signal;

      setLoading(true);
      setErrors({});

      const totalCount = Object.keys(requests).length;
      setProgress({ completed: 0, total: totalCount });

      try {
        if (signal.aborted) {
          return {
            data: {},
            errors: {},
            hasErrors: false,
            completedCount: 0,
            totalCount,
          };
        }

        const results: Record<string, any> = {};
        const requestErrors: Record<string, Error> = {};
        let completedCount = 0;

        // Prepara os requests (adiciona timeout se especificado)
        const requestsWithTimeout = Object.entries(requests).reduce(
          (acc, [key, requestFn]) => {
            acc[key] = timeout ? withTimeout(requestFn, timeout) : requestFn;
            return acc;
          },
          {} as RequestsMap
        );

        // Executa todos os requests em paralelo
        const promises = Object.entries(requestsWithTimeout).map(
          async ([key, requestFn]) => {
            try {
              if (signal.aborted) return;

              const result = await requestFn(signal);

              if (signal.aborted) return;

              results[key] = result;
              completedCount++;

              // Atualiza progresso
              setProgress({ completed: completedCount, total: totalCount });
              onProgress?.(completedCount, totalCount);
            } catch (error: any) {
              // Ignora AbortError
              if (error.name === 'AbortError' || signal.aborted) return;

              requestErrors[key] = error;
              completedCount++;

              // Atualiza progresso mesmo com erro
              setProgress({ completed: completedCount, total: totalCount });
              onProgress?.(completedCount, totalCount);

              // Se não deve continuar com erros, aborta tudo
              if (!continueOnError) {
                abort();
              }
            }
          }
        );

        await Promise.all(promises);

        if (signal.aborted) {
          return {
            data: {},
            errors: {},
            hasErrors: false,
            completedCount: 0,
            totalCount,
          };
        }

        // Atualiza erros no estado
        if (Object.keys(requestErrors).length > 0) {
          setErrors(requestErrors);
        }

        return {
          data: results,
          errors: requestErrors,
          hasErrors: Object.keys(requestErrors).length > 0,
          completedCount,
          totalCount,
        };
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [getController, abort, withTimeout]
  );

  return {
    executeRequests,
    loading,
    errors,
    progress,
    cancel: abort,
  };
}
