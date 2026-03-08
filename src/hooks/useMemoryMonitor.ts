import { useEffect, useRef } from 'react';

interface MemoryInfo {
  used: number;
  total: number;
  limit: number;
  timestamp: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

export const useMemoryMonitor = (componentName: string, enabled = true) => {
  const memoryHistory = useRef<MemoryInfo[]>([]);
  const mountTime = useRef(Date.now());

  useEffect(() => {
    if (!enabled) return;

    const perf = performance as PerformanceWithMemory;

    const checkMemory = () => {
      if (perf.memory) {
        const info: MemoryInfo = {
          used: Math.round(perf.memory.usedJSHeapSize / 1048576),
          total: Math.round(perf.memory.totalJSHeapSize / 1048576),
          limit: Math.round(perf.memory.jsHeapSizeLimit / 1048576),
          timestamp: Date.now()
        };

        memoryHistory.current.push(info);

        // Manter apenas últimos 20 registros
        if (memoryHistory.current.length > 20) {
          memoryHistory.current.shift();
        }

        // Detectar possível memory leak
        if (memoryHistory.current.length >= 10) {
          const first = memoryHistory.current[0];
          const last = memoryHistory.current[memoryHistory.current.length - 1];
          const growth = last.used - first.used;
          const growthPercent = (growth / first.used) * 100;

          if (growthPercent > 50) {
            console.warn(`⚠️ [${componentName}] Possível memory leak detectado!`, {
              crescimento: `${growth}MB (${growthPercent.toFixed(1)}%)`,
              usado: `${last.used}MB`,
              total: `${last.total}MB`,
              limite: `${last.limit}MB`
            });
          }
        }

        console.log(`🔍 [${componentName}] Memory:`, {
          usado: `${info.used}MB`,
          total: `${info.total}MB`,
          limite: `${info.limit}MB`,
          tempoMontado: `${Math.round((Date.now() - mountTime.current) / 1000)}s`
        });
      }
    };

    // Check inicial
    checkMemory();

    // Check periódico
    const interval = setInterval(checkMemory, 5000);

    return () => {
      clearInterval(interval);

      // Log ao desmontar
      if (perf.memory) {
        const finalMemory = Math.round(perf.memory.usedJSHeapSize / 1048576);
        const duration = Math.round((Date.now() - mountTime.current) / 1000);

        console.log(`✅ [${componentName}] Desmontado após ${duration}s - Memory final: ${finalMemory}MB`);
      }
    };
  }, [componentName, enabled]);

  return memoryHistory.current;
};

export const useComponentLifecycle = (componentName: string, enabled = true) => {
  useEffect(() => {
    if (!enabled) return;

    const mountTime = Date.now();
    console.log(`🟢 [${componentName}] Montado às ${new Date().toLocaleTimeString()}`);

    return () => {
      const duration = Date.now() - mountTime;
      console.log(`🔴 [${componentName}] Desmontado após ${(duration / 1000).toFixed(1)}s`);
    };
  }, [componentName, enabled]);
};

export const useSubscriptionCleanup = (componentName: string) => {
  const subscriptions = useRef<Array<() => void>>([]);

  const addCleanup = (cleanup: () => void) => {
    subscriptions.current.push(cleanup);
  };

  useEffect(() => {
    return () => {
      console.log(`🧹 [${componentName}] Limpando ${subscriptions.current.length} subscriptions`);
      subscriptions.current.forEach(cleanup => {
        try {
          cleanup();
        } catch (error) {
          console.error(`❌ [${componentName}] Erro ao limpar subscription:`, error);
        }
      });
      subscriptions.current = [];
    };
  }, [componentName]);

  return { addCleanup };
};
