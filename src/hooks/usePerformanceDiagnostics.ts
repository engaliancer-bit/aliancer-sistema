import { useEffect, useRef, useState } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  renderCount: number;
  slowRenderThreshold: number;
  slowRenders: number;
}

export function usePerformanceDiagnostics(componentName: string, slowRenderThreshold = 50) {
  const renderStartRef = useRef<number>(0);
  const renderCountRef = useRef<number>(0);
  const slowRendersRef = useRef<number>(0);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    renderCount: 0,
    slowRenderThreshold,
    slowRenders: 0,
  });

  renderStartRef.current = performance.now();
  renderCountRef.current += 1;

  useEffect(() => {
    const renderEndTime = performance.now();
    const renderTime = renderEndTime - renderStartRef.current;

    if (renderTime > slowRenderThreshold) {
      slowRendersRef.current += 1;
      console.warn(
        `[Performance] ${componentName} renderizou lentamente: ${renderTime.toFixed(2)}ms (contagem: ${slowRendersRef.current})`
      );
    }

    setMetrics({
      renderTime,
      renderCount: renderCountRef.current,
      slowRenderThreshold,
      slowRenders: slowRendersRef.current,
    });
  });

  return metrics;
}

export function useRequestDiagnostics() {
  const requestsRef = useRef<Map<string, number>>(new Map());

  const trackRequest = (requestKey: string) => {
    const count = requestsRef.current.get(requestKey) || 0;
    const newCount = count + 1;
    requestsRef.current.set(requestKey, newCount);

    if (newCount > 1) {
      console.warn(
        `[Performance] Request duplicado detectado: "${requestKey}" (${newCount}x)`
      );
    }

    return newCount;
  };

  const resetTracking = () => {
    requestsRef.current.clear();
  };

  return { trackRequest, resetTracking };
}
