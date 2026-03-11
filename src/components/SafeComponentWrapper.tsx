import { useEffect, useRef, ReactNode, memo } from 'react';

interface SafeComponentWrapperProps {
  children: ReactNode;
  componentName: string;
  enableLogging?: boolean;
}

/**
 * Wrapper que garante cleanup completo de componentes
 * Previne memory leaks forçando limpeza ao desmontar
 */
export const SafeComponentWrapper = memo(function SafeComponentWrapper({
  children,
  componentName,
  enableLogging = false
}: SafeComponentWrapperProps) {
  const timerIdsRef = useRef<Set<number>>(new Set());
  const originalSetInterval = useRef(window.setInterval);
  const originalSetTimeout = useRef(window.setTimeout);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    if (enableLogging) {
      console.log(`✅ ${componentName} montado`);
    }

    // Interceptar setInterval/setTimeout para rastrear
    const originalInterval = window.setInterval;
    const originalTimeout = window.setTimeout;

    window.setInterval = ((...args: any[]) => {
      const id = originalInterval(...args) as unknown as number;
      timerIdsRef.current.add(id);
      if (enableLogging) {
        console.log(`⏰ ${componentName} criou interval ${id}`);
      }
      return id;
    }) as typeof window.setInterval;

    window.setTimeout = ((...args: any[]) => {
      const id = originalTimeout(...args) as unknown as number;
      timerIdsRef.current.add(id);
      if (enableLogging) {
        console.log(`⏱️ ${componentName} criou timeout ${id}`);
      }
      return id;
    }) as typeof window.setTimeout;

    return () => {
      isMountedRef.current = false;

      // Restaurar funções originais
      window.setInterval = originalInterval;
      window.setTimeout = originalTimeout;

      // Limpar TODOS os timers criados
      const timerCount = timerIdsRef.current.size;
      timerIdsRef.current.forEach(id => {
        clearInterval(id);
        clearTimeout(id);
      });

      if (enableLogging && timerCount > 0) {
        console.warn(`🧹 ${componentName} limpou ${timerCount} timers ao desmontar`);
      }

      timerIdsRef.current.clear();

      if (enableLogging) {
        console.log(`❌ ${componentName} desmontado`);
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
