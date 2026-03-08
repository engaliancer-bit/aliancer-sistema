import { useRef, useEffect } from 'react';

/**
 * Hook para gerenciar AbortController e cancelar requests automaticamente
 *
 * Funcionalidades:
 * - Cria AbortController automaticamente
 * - Cancela requests ao desmontar componente
 * - Permite cancelamento manual via abort()
 *
 * Exemplo de uso:
 * ```typescript
 * const { signal, abort } = useAbortController();
 *
 * useEffect(() => {
 *   fetchData(signal);
 * }, []);
 * ```
 */
export function useAbortController() {
  const abortControllerRef = useRef<AbortController | null>(null);

  const getController = () => {
    if (!abortControllerRef.current) {
      abortControllerRef.current = new AbortController();
    }
    return abortControllerRef.current;
  };

  const abort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      abort();
    };
  }, []);

  return {
    getController,
    abort,
    signal: getController().signal,
  };
}
