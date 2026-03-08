interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  tags?: Record<string, string>;
}

interface PerformanceThresholds {
  queryTime?: number;
  renderTime?: number;
  memoryUsage?: number;
}

const metrics: PerformanceMetric[] = [];
const thresholds: PerformanceThresholds = {
  queryTime: 1000,
  renderTime: 16,
  memoryUsage: 100 * 1024 * 1024
};

const listeners = new Set<(metrics: PerformanceMetric[]) => void>();

export function recordMetric(
  name: string,
  value: number,
  unit: string = 'ms',
  tags?: Record<string, string>
) {
  const metric: PerformanceMetric = {
    name,
    value,
    unit,
    timestamp: Date.now(),
    tags
  };

  metrics.push(metric);

  // Manter apenas últimas 1000 métricas
  if (metrics.length > 1000) {
    metrics.shift();
  }

  // Notificar listeners
  listeners.forEach(listener => listener([metric]));

  // Verificar thresholds
  checkThresholds(metric);
}

function checkThresholds(metric: PerformanceMetric) {
  if (metric.name === 'query_time' && metric.value > (thresholds.queryTime || 1000)) {
    console.warn(`Query time exceeded threshold: ${metric.value}ms`);
  }

  if (metric.name === 'render_time' && metric.value > (thresholds.renderTime || 16)) {
    console.warn(`Render time exceeded threshold: ${metric.value}ms`);
  }

  if (metric.name === 'memory_usage' && metric.value > (thresholds.memoryUsage || 100 * 1024 * 1024)) {
    console.warn(`Memory usage exceeded threshold: ${Math.round(metric.value / 1024 / 1024)}MB`);
  }
}

export function subscribeToMetrics(listener: (metrics: PerformanceMetric[]) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getMetrics(name?: string): PerformanceMetric[] {
  if (!name) return metrics;
  return metrics.filter(m => m.name === name);
}

export function getMetricStats(name: string) {
  const values = metrics
    .filter(m => m.name === name)
    .map(m => m.value);

  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const p50 = sorted[Math.floor(values.length * 0.5)];
  const p95 = sorted[Math.floor(values.length * 0.95)];
  const p99 = sorted[Math.floor(values.length * 0.99)];

  return { avg, min, max, p50, p95, p99, count: values.length };
}

export function clearMetrics() {
  metrics.length = 0;
}

export function setThresholds(newThresholds: Partial<PerformanceThresholds>) {
  Object.assign(thresholds, newThresholds);
}

export function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  tags?: Record<string, string>
): Promise<T> {
  const start = performance.now();

  return fn()
    .then(result => {
      const duration = performance.now() - start;
      recordMetric(name, duration, 'ms', tags);
      return result;
    })
    .catch(error => {
      const duration = performance.now() - start;
      recordMetric(`${name}_error`, duration, 'ms', { ...tags, error: 'true' });
      throw error;
    });
}

export function measureSync<T>(
  name: string,
  fn: () => T,
  tags?: Record<string, string>
): T {
  const start = performance.now();

  try {
    const result = fn();
    const duration = performance.now() - start;
    recordMetric(name, duration, 'ms', tags);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    recordMetric(`${name}_error`, duration, 'ms', { ...tags, error: 'true' });
    throw error;
  }
}

export function getMemoryUsage() {
  const perf = performance as any;
  if (!perf.memory) return null;

  return {
    used: perf.memory.usedJSHeapSize,
    limit: perf.memory.jsHeapSizeLimit,
    total: perf.memory.totalJSHeapSize,
    percentage: (perf.memory.usedJSHeapSize / perf.memory.jsHeapSizeLimit) * 100
  };
}

export function generateReport() {
  const report: Record<string, any> = {};

  const uniqueNames = [...new Set(metrics.map(m => m.name))];

  for (const name of uniqueNames) {
    const stats = getMetricStats(name);
    if (stats) {
      report[name] = stats;
    }
  }

  const memory = getMemoryUsage();
  if (memory) {
    report.memory = memory;
  }

  return report;
}
