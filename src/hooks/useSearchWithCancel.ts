import { useState, useEffect, useCallback } from 'react';
import { useAbortController } from './useAbortController';

/**
 * Hook para buscas com cancelamento automático de requests
 *
 * Funcionalidades:
 * - Cancela busca anterior quando nova busca é iniciada
 * - Debounce automático (300ms) para evitar muitas requests
 * - Cancela automaticamente ao desmontar componente
 * - Gerencia estado de loading
 *
 * @param searchFunction - Função que executa a busca (recebe termo e signal)
 * @param initialTerm - Termo inicial de busca (opcional)
 * @param debounceMs - Tempo de debounce em ms (padrão: 300ms)
 *
 * Exemplo de uso:
 * ```typescript
 * const searchProducts = async (term: string, signal?: AbortSignal) => {
 *   const { data } = await supabase
 *     .from('products')
 *     .select('*')
 *     .ilike('name', `%${term}%`);
 *   return data;
 * };
 *
 * const { searchTerm, setSearchTerm, results, loading } = useSearchWithCancel(
 *   searchProducts
 * );
 * ```
 */
export function useSearchWithCancel<T = any>(
  searchFunction: (term: string, signal?: AbortSignal) => Promise<T[] | null>,
  initialTerm = '',
  debounceMs = 300
) {
  const [searchTerm, setSearchTerm] = useState(initialTerm);
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { getController, abort } = useAbortController();

  useEffect(() => {
    if (!searchTerm.trim()) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    abort();
    const controller = getController();
    setLoading(true);
    setError(null);

    const search = async () => {
      try {
        if (controller.signal.aborted) return;

        const data = await searchFunction(searchTerm, controller.signal);

        if (controller.signal.aborted) return;

        if (data) {
          setResults(data);
        } else {
          setResults([]);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return;
        }
        console.error('Erro na busca:', err);
        setError(err);
        setResults([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    const timeoutId = setTimeout(search, debounceMs);

    return () => {
      clearTimeout(timeoutId);
      abort();
    };
  }, [searchTerm, debounceMs]);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setResults([]);
    setError(null);
    abort();
  }, [abort]);

  return {
    searchTerm,
    setSearchTerm,
    results,
    loading,
    error,
    clearSearch,
  };
}
