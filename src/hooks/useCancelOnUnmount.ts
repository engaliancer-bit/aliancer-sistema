import { useEffect } from 'react';
import { useAbortController } from './useAbortController';

/**
 * Hook simplificado para cancelar requests ao desmontar componente
 *
 * Versão simplificada do useAbortController que cancela automaticamente
 * todos os requests quando o componente é desmontado.
 *
 * Útil para componentes que fazem múltiplas requisições e querem
 * garantir que nenhuma delas continue após a desmontagem.
 *
 * @returns signal - AbortSignal para passar às requisições
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const signal = useCancelOnUnmount();
 *   const [data, setData] = useState([]);
 *
 *   useEffect(() => {
 *     loadData(signal);
 *   }, []);
 *
 *   const loadData = async (signal: AbortSignal) => {
 *     if (signal.aborted) return;
 *
 *     const { data } = await supabase.from('table').select('*');
 *
 *     if (signal.aborted) return;
 *     setData(data || []);
 *   };
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useCancelOnUnmount(): AbortSignal {
  const { signal, abort } = useAbortController();

  useEffect(() => {
    return () => {
      abort();
    };
  }, [abort]);

  return signal;
}
