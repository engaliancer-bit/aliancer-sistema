import { useState, useCallback } from 'react';
import { useMultipleRequests, RequestsMap, RequestOptions } from './useMultipleRequests';

export interface RetryOptions extends RequestOptions {
  maxRetries?: number; // Máximo de tentativas (padrão: 3)
  retryDelay?: number; // Delay entre tentativas em ms (padrão: 1000)
  retryOnlyOnTimeout?: boolean; // Retry apenas em timeout (padrão: false)
}

/**
 * Hook avançado para múltiplos requests com retry automático
 *
 * Adiciona capacidade de retry automático ao useMultipleRequests.
 *
 * @example
 * ```tsx
 * const { executeWithRetry, loading, retryCount } = useMultipleRequestsWithRetry();
 *
 * const result = await executeWithRetry(requests, {
 *   maxRetries: 3,
 *   retryDelay: 1000,
 *   timeout: 5000,
 *   retryOnlyOnTimeout: true
 * });
 * ```
 */
export function useMultipleRequestsWithRetry() {
  const [retryCount, setRetryCount] = useState<Record<string, number>>({});
  const multipleRequests = useMultipleRequests();

  /**
   * Aguarda um delay
   */
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  /**
   * Verifica se deve fazer retry do erro
   */
  const shouldRetry = useCallback(
    (error: Error, retryOnlyOnTimeout: boolean): boolean => {
      // Se deve fazer retry apenas em timeout
      if (retryOnlyOnTimeout) {
        return error.message.includes('timeout');
      }

      // Não faz retry de AbortError
      if (error.name === 'AbortError') {
        return false;
      }

      return true;
    },
    []
  );

  /**
   * Cria um wrapper que adiciona retry a um request
   */
  const withRetry = useCallback(
    (
      key: string,
      requestFn: (signal: AbortSignal) => Promise<any>,
      maxRetries: number,
      retryDelay: number,
      retryOnlyOnTimeout: boolean
    ) => {
      return async (signal: AbortSignal): Promise<any> => {
        let lastError: Error | null = null;
        let attempt = 0;

        while (attempt <= maxRetries) {
          try {
            if (signal.aborted) throw new Error('AbortError');

            // Atualiza contagem de tentativas
            setRetryCount((prev) => ({ ...prev, [key]: attempt }));

            const result = await requestFn(signal);

            // Limpa contagem ao sucesso
            setRetryCount((prev) => {
              const newCount = { ...prev };
              delete newCount[key];
              return newCount;
            });

            return result;
          } catch (error: any) {
            lastError = error;

            // Se não deve fazer retry, lança o erro
            if (!shouldRetry(error, retryOnlyOnTimeout)) {
              throw error;
            }

            // Se atingiu máximo de tentativas, lança o erro
            if (attempt >= maxRetries) {
              throw error;
            }

            // Aguarda antes de tentar novamente
            attempt++;
            console.log(
              `[${key}] Tentativa ${attempt}/${maxRetries} falhou. Tentando novamente em ${retryDelay}ms...`
            );

            await delay(retryDelay);
          }
        }

        throw lastError || new Error('Request failed after retries');
      };
    },
    [shouldRetry]
  );

  /**
   * Executa múltiplos requests com retry
   */
  const executeWithRetry = useCallback(
    async (requests: RequestsMap, options: RetryOptions = {}) => {
      const {
        maxRetries = 3,
        retryDelay = 1000,
        retryOnlyOnTimeout = false,
        ...otherOptions
      } = options;

      // Limpa contagem de retry anterior
      setRetryCount({});

      // Adiciona retry a cada request
      const requestsWithRetry = Object.entries(requests).reduce(
        (acc, [key, requestFn]) => {
          acc[key] = withRetry(
            key,
            requestFn,
            maxRetries,
            retryDelay,
            retryOnlyOnTimeout
          );
          return acc;
        },
        {} as RequestsMap
      );

      // Executa os requests
      return multipleRequests.executeRequests(requestsWithRetry, otherOptions);
    },
    [multipleRequests, withRetry]
  );

  return {
    executeWithRetry,
    loading: multipleRequests.loading,
    errors: multipleRequests.errors,
    progress: multipleRequests.progress,
    retryCount,
    cancel: multipleRequests.cancel,
  };
}
