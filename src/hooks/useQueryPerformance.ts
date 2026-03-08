import { useCallback } from 'react';
import { logQueryPerformance } from '../lib/queryLogger';

/**
 * Hook para monitorar performance de queries
 *
 * Facilita o uso do queryLogger com nome de componente automático
 *
 * @param componentName - Nome do componente para prefixar queries
 * @returns Função para executar queries com logging
 *
 * @example
 * ```tsx
 * function Products() {
 *   const { trackQuery } = useQueryPerformance('Products');
 *
 *   const loadProducts = async () => {
 *     const { data } = await trackQuery(
 *       'Carregar lista',
 *       () => supabase.from('products').select('*')
 *     );
 *     setProducts(data);
 *   };
 *
 *   // ...
 * }
 * ```
 */
export function useQueryPerformance(componentName: string) {
  /**
   * Executa uma query com tracking automático de performance
   */
  const trackQuery = useCallback(
    async <T,>(queryName: string, queryFn: () => Promise<T>): Promise<T> => {
      const fullName = `${componentName}: ${queryName}`;
      return logQueryPerformance(fullName, queryFn);
    },
    [componentName]
  );

  return {
    trackQuery,
  };
}
