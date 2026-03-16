import React, { useEffect, useRef, ReactNode, memo } from 'react';

interface SafeComponentWrapperProps {
  children: ReactNode;
  componentName: string;
  enableLogging?: boolean;
}

/**
 * Wrapper que garante cleanup completo de componentes
 * Previne memory leaks forçando limpeza ao desmontar
 * Usa rastreamento local de IDs sem substituir window.setInterval globalmente
 */
export const SafeComponentWrapper = memo(function SafeComponentWrapper({
  children,
  componentName,
  enableLogging = false
}: SafeComponentWrapperProps) {
  const intervalIdsRef = useRef<Set<number>>(new Set());
  const timeoutIdsRef = useRef<Set<number>>(new Set());
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    if (enableLogging) {
      console.log(`[${componentName}] montado`);
    }

    return () => {
      isMountedRef.current = false;

      const intervalCount = intervalIdsRef.current.size;
      const timeoutCount = timeoutIdsRef.current.size;

      intervalIdsRef.current.forEach(id => clearInterval(id));
      timeoutIdsRef.current.forEach(id => clearTimeout(id));

      if (enableLogging && (intervalCount + timeoutCount) > 0) {
        console.warn(`[${componentName}] limpou ${intervalCount} intervals e ${timeoutCount} timeouts ao desmontar`);
      }

      intervalIdsRef.current.clear();
      timeoutIdsRef.current.clear();

      if (enableLogging) {
        console.log(`[${componentName}] desmontado`);
      }
    };
  }, [componentName, enableLogging]);

  return <>{children}</>;
});

/**
 * Hook para verificar se componente ainda está montado
 * Previne setState em componente desmontado
 */
export function useIsMounted() {
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return isMountedRef;
}

/**
 * Hook que cancela promises pendentes ao desmontar
 */
export function useSafeAsync<T>() {
  const isMountedRef = useIsMounted();
  const pendingPromisesRef = useRef<Set<Promise<any>>>(new Set());

  useEffect(() => {
    return () => {
      // Cancelar todas as promises pendentes
      pendingPromisesRef.current.clear();
    };
  }, []);

  const safeAsync = async <R,>(promise: Promise<R>): Promise<R | null> => {
    pendingPromisesRef.current.add(promise);

    try {
      const result = await promise;

      // Se componente foi desmontado, ignorar resultado
      if (!isMountedRef.current) {
        return null;
      }

      pendingPromisesRef.current.delete(promise);
      return result;
    } catch (error) {
      pendingPromisesRef.current.delete(promise);

      // Se componente foi desmontado, não propagar erro
      if (!isMountedRef.current) {
        return null;
      }

      throw error;
    }
  };

  return { safeAsync, isMounted: isMountedRef };
}

/**
 * HOC que envolve componente com proteção contra memory leak
 */
export function withSafeCleanup<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) {
  return memo(function SafeComponent(props: P) {
    return (
      <SafeComponentWrapper
        componentName={componentName || Component.displayName || Component.name || 'Component'}
        enableLogging={import.meta.env.DEV}
      >
        <Component {...props} />
      </SafeComponentWrapper>
    );
  });
}
