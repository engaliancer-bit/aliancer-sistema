import { ComponentType, useEffect } from 'react';
import { useMemoryTracking } from './MemoryDiagnostics';
import { useComponentLifecycle } from '../hooks/useMemoryMonitor';

/**
 * HOC para adicionar tracking automático de memória em componentes
 *
 * Uso:
 * export default withMemoryTracking(MyComponent, 'MyComponent');
 */
export function withMemoryTracking<P extends object>(
  Component: ComponentType<P>,
  componentName: string
) {
  const WrappedComponent = (props: P) => {
    // Tracking de memória
    useMemoryTracking(componentName);

    // Lifecycle logging
    useComponentLifecycle(componentName, process.env.NODE_ENV === 'development');

    // Cleanup de subscriptions
    useEffect(() => {
      const cleanupFunctions: Array<() => void> = [];

      return () => {
        // Limpar todas as subscriptions registradas
        cleanupFunctions.forEach(cleanup => {
          try {
            cleanup();
          } catch (error) {
            console.error(`[${componentName}] Erro ao limpar subscription:`, error);
          }
        });
      };
    }, []);

    return <Component {...props} />;
  };

  WrappedComponent.displayName = `withMemoryTracking(${componentName})`;

  return WrappedComponent;
}

/**
 * Hook para registrar manualmente cleanup functions
 * Útil para Supabase realtime subscriptions
 */
export function useCleanupRegistry() {
  const cleanupFunctions = new Set<() => void>();

  const registerCleanup = (cleanup: () => void) => {
    cleanupFunctions.add(cleanup);
  };

  useEffect(() => {
    return () => {
      cleanupFunctions.forEach(cleanup => {
        try {
          cleanup();
        } catch (error) {
          console.error('Erro ao executar cleanup:', error);
        }
      });
      cleanupFunctions.clear();
    };
  }, []);

  return { registerCleanup };
}
