import { useEffect, useState, useRef, useCallback } from 'react';
import { AlertTriangle, Activity, Zap, X } from 'lucide-react';

interface PerformanceMetrics {
  memoryUsageMB: number;
  memoryPercentage: number;
  fps: number;
  apiCalls: number;
  isHealthy: boolean;
  alerts: string[];
}

export default function CriticalPerformanceMonitor() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    memoryUsageMB: 0,
    memoryPercentage: 0,
    fps: 60,
    apiCalls: 0,
    isHealthy: true,
    alerts: []
  });

  const fpsRef = useRef<number[]>([]);
  const lastFrameTimeRef = useRef(performance.now());
  const apiCallsRef = useRef(0);
  const frameRequestRef = useRef<number>();
  const intervalRef = useRef<NodeJS.Timeout>();
  const originalFetchRef = useRef<typeof window.fetch>();

  const startMonitoring = useCallback(() => {
    if (isMonitoring) return;

    originalFetchRef.current = window.fetch;
    window.fetch = (async (...args) => {
      apiCallsRef.current++;
      return originalFetchRef.current!(...args);
    }) as typeof window.fetch;

    const measureFPS = () => {
      if (!isMonitoring) return;

      const now = performance.now();
      const delta = now - lastFrameTimeRef.current;
      const fps = Math.min(1000 / delta, 120);

      fpsRef.current.push(fps);
      if (fpsRef.current.length > 30) {
        fpsRef.current.shift();
      }

      lastFrameTimeRef.current = now;
      frameRequestRef.current = requestAnimationFrame(measureFPS);
    };

    frameRequestRef.current = requestAnimationFrame(measureFPS);

    intervalRef.current = setInterval(() => {
      const perf = performance as any;
      const alerts: string[] = [];
      let isHealthy = true;

      let memoryUsageMB = 0;
      let memoryPercentage = 0;

      if (perf.memory) {
        const usedMB = perf.memory.usedJSHeapSize / 1048576;
        const limitMB = perf.memory.jsHeapSizeLimit / 1048576;
        memoryUsageMB = Math.round(usedMB);
        memoryPercentage = (usedMB / limitMB) * 100;

        if (memoryPercentage > 70) {
          isHealthy = false;
          alerts.push(`Memoria em ${memoryPercentage.toFixed(1)}% - RISCO`);
        } else if (memoryPercentage > 50) {
          alerts.push(`Memoria em ${memoryPercentage.toFixed(1)}%`);
        }
      }

      const avgFps = fpsRef.current.length > 0
        ? Math.round(fpsRef.current.reduce((a, b) => a + b, 0) / fpsRef.current.length)
        : 60;

      if (avgFps < 30) {
        isHealthy = false;
        alerts.push(`FPS baixo (${avgFps})`);
      }

      if (apiCallsRef.current > 100) {
        alerts.push(`${apiCallsRef.current} chamadas API`);
      }

      setMetrics({
        memoryUsageMB,
        memoryPercentage,
        fps: avgFps,
        apiCalls: apiCallsRef.current,
        isHealthy,
        alerts
      });
    }, 3000);

    setIsMonitoring(true);
  }, [isMonitoring]);

  const stopMonitoring = useCallback(() => {
    if (originalFetchRef.current) {
      window.fetch = originalFetchRef.current;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }

    if (frameRequestRef.current) {
      cancelAnimationFrame(frameRequestRef.current);
      frameRequestRef.current = undefined;
    }

    fpsRef.current = [];
    apiCallsRef.current = 0;
    setIsMonitoring(false);
    setMetrics({
      memoryUsageMB: 0,
      memoryPercentage: 0,
      fps: 60,
      apiCalls: 0,
      isHealthy: true,
      alerts: []
    });
  }, []);

  useEffect(() => {
    return () => {
      if (originalFetchRef.current) {
        window.fetch = originalFetchRef.current;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (frameRequestRef.current) {
        cancelAnimationFrame(frameRequestRef.current);
      }
    };
  }, []);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  if (!isMonitoring) {
    return (
      <button
        onClick={startMonitoring}
        className="fixed bottom-52 right-4 bg-gray-600 text-white p-3 rounded-full shadow-lg hover:bg-gray-700 transition-colors z-50"
        title="Iniciar Monitor de Performance"
      >
        <Activity className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-52 right-4 z-50">
      <div className={`bg-white rounded-lg shadow-lg px-4 py-3 ${
        metrics.isHealthy ? 'border-2 border-green-500' : 'border-2 border-red-500'
      }`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1">
              {metrics.isHealthy ? (
                <Zap className="w-4 h-4 text-green-500" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-500" />
              )}
              <span className={`font-medium ${metrics.isHealthy ? 'text-green-600' : 'text-red-600'}`}>
                {metrics.isHealthy ? 'OK' : 'Alerta'}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-gray-600">
              <div>
                <span className="font-medium">RAM:</span> {metrics.memoryUsageMB}MB
                <span className={`ml-1 ${
                  metrics.memoryPercentage > 70 ? 'text-red-600 font-bold' :
                  metrics.memoryPercentage > 50 ? 'text-orange-600' :
                  'text-green-600'
                }`}>
                  ({metrics.memoryPercentage.toFixed(0)}%)
                </span>
              </div>

              <div>
                <span className="font-medium">FPS:</span>
                <span className={`ml-1 ${
                  metrics.fps < 30 ? 'text-red-600 font-bold' :
                  metrics.fps < 45 ? 'text-orange-600' :
                  'text-green-600'
                }`}>
                  {metrics.fps}
                </span>
              </div>

              <div>
                <span className="font-medium">API:</span> {metrics.apiCalls}
              </div>
            </div>
          </div>

          <button
            onClick={stopMonitoring}
            className="p-1 hover:bg-gray-100 rounded"
            title="Parar monitoramento"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {metrics.alerts.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            {metrics.alerts.map((alert, i) => (
              <p key={i} className="text-xs text-orange-600">{alert}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
