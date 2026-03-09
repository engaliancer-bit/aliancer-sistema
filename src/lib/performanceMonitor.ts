export interface PerformanceMetric {
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

// ─── Re-render counter ────────────────────────────────────────────────────────
const renderCounts = new Map<string, number>();

export function incrementRenderCount(componentName: string) {
  renderCounts.set(componentName, (renderCounts.get(componentName) ?? 0) + 1);
}

export function getRenderCount(componentName: string): number {
  return renderCounts.get(componentName) ?? 0;
}

export function getRenderCounts(): Record<string, number> {
  return Object.fromEntries(renderCounts);
}

export function resetRenderCount(componentName: string) {
  renderCounts.delete(componentName);
}

// ─── Realtime event rate tracker ──────────────────────────────────────────────
interface RealtimeEventEntry {
  channel: string;
  timestamp: number;
}

const realtimeEvents: RealtimeEventEntry[] = [];

export function recordRealtimeEvent(channel: string) {
  realtimeEvents.push({ channel, timestamp: Date.now() });
  // Keep last 5 minutes only (300_000 ms)
  const cutoff = Date.now() - 300_000;
  while (realtimeEvents.length > 0 && realtimeEvents[0].timestamp < cutoff) {
    realtimeEvents.shift();
  }
}

export function getRealtimeEventsPerMinute(channel?: string): number {
  const cutoff = Date.now() - 60_000;
  const recent = channel
    ? realtimeEvents.filter(e => e.channel === channel && e.timestamp >= cutoff)
    : realtimeEvents.filter(e => e.timestamp >= cutoff);
  return recent.length;
}

export function getRealtimeStats(): Record<string, number> {
  const cutoff = Date.now() - 60_000;
  const byChannel: Record<string, number> = {};
  for (const ev of realtimeEvents) {
    if (ev.timestamp >= cutoff) {
      byChannel[ev.channel] = (byChannel[ev.channel] ?? 0) + 1;
    }
  }
  return byChannel;
}

// ─── Core metric recording ────────────────────────────────────────────────────
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

  if (metrics.length > 1000) {
    metrics.shift();
  }

  listeners.forEach(listener => listener([metric]));
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
  if (!name) return [...metrics];
  return metrics.filter(m => m.name === name);
}

export function getMetricStats(name: string) {
  const values = metrics
    .filter(m => m.name === name)
    .map(m => m.value);

  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;

  return {
    avg: Math.round(avg * 10) / 10,
    min: Math.round(sorted[0] * 10) / 10,
    max: Math.round(sorted[sorted.length - 1] * 10) / 10,
    p50: Math.round((sorted[Math.floor(values.length * 0.5)] ?? 0) * 10) / 10,
    p95: Math.round((sorted[Math.floor(values.length * 0.95)] ?? 0) * 10) / 10,
    p99: Math.round((sorted[Math.floor(values.length * 0.99)] ?? 0) * 10) / 10,
    count: values.length,
    last: Math.round((sorted[values.length - 1] ?? 0) * 10) / 10,
  };
}

export function clearMetrics() {
  metrics.length = 0;
  renderCounts.clear();
  realtimeEvents.length = 0;
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
      recordMetric(name, performance.now() - start, 'ms', tags);
      return result;
    })
    .catch(error => {
      recordMetric(`${name}_error`, performance.now() - start, 'ms', { ...tags, error: 'true' });
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
    recordMetric(name, performance.now() - start, 'ms', tags);
    return result;
  } catch (error) {
    recordMetric(`${name}_error`, performance.now() - start, 'ms', { ...tags, error: 'true' });
    throw error;
  }
}

export function getMemoryUsage() {
  const perf = performance as any;
  if (!perf.memory) return null;
  return {
    usedMB: Math.round(perf.memory.usedJSHeapSize / 1024 / 1024),
    totalMB: Math.round(perf.memory.totalJSHeapSize / 1024 / 1024),
    limitMB: Math.round(perf.memory.jsHeapSizeLimit / 1024 / 1024),
    used: perf.memory.usedJSHeapSize,
    limit: perf.memory.jsHeapSizeLimit,
    total: perf.memory.totalJSHeapSize,
    percentage: Math.round((perf.memory.usedJSHeapSize / perf.memory.jsHeapSizeLimit) * 1000) / 10,
  };
}

// ─── Domain-specific metric names (use these constants when recording) ─────────
export const METRIC = {
  // Insumos/Compras (Materials)
  MATERIALS_LIST_LOAD: 'materials.list_load',
  MATERIALS_MOVEMENTS_LOAD: 'materials.movements_load',
  MATERIALS_FILTER_APPLY: 'materials.filter_apply',
  MATERIALS_INITIAL_RENDER: 'materials.initial_render',
  MATERIALS_REALTIME: 'materials.realtime',

  // Receitas/Despesas – Fábrica
  FACTORY_FINANCE_LOAD: 'factory_finance.load',
  FACTORY_FINANCE_ENTRIES_LOAD: 'factory_finance.entries_load',
  FACTORY_FINANCE_FILTER_APPLY: 'factory_finance.filter_apply',
  FACTORY_FINANCE_INITIAL_RENDER: 'factory_finance.initial_render',
  FACTORY_FINANCE_REALTIME: 'factory_finance.realtime',

  // Receitas/Despesas – Engenharia
  ENG_FINANCE_LOAD: 'eng_finance.load',
  ENG_FINANCE_ENTRIES_LOAD: 'eng_finance.entries_load',
  ENG_FINANCE_FILTER_APPLY: 'eng_finance.filter_apply',
  ENG_FINANCE_INITIAL_RENDER: 'eng_finance.initial_render',
  ENG_FINANCE_REALTIME: 'eng_finance.realtime',
} as const;

// ─── Formatted report ─────────────────────────────────────────────────────────
export interface DiagnosticsReport {
  generatedAt: string;
  uptimeSeconds: number;
  memory: ReturnType<typeof getMemoryUsage>;
  metrics: Record<string, ReturnType<typeof getMetricStats>>;
  renderCounts: Record<string, number>;
  realtimeEventsPerMinute: Record<string, number>;
  totalMetricsRecorded: number;
  thresholdViolations: Array<{ metric: string; value: number; threshold: number }>;
}

const _startTime = Date.now();

export function generateReport(): DiagnosticsReport {
  const uniqueNames = [...new Set(metrics.map(m => m.name))];
  const metricsReport: Record<string, ReturnType<typeof getMetricStats>> = {};

  for (const name of uniqueNames) {
    metricsReport[name] = getMetricStats(name);
  }

  const violations: DiagnosticsReport['thresholdViolations'] = [];
  for (const m of metrics) {
    if (m.name.includes('load') && m.value > (thresholds.queryTime ?? 1000)) {
      violations.push({ metric: m.name, value: Math.round(m.value), threshold: thresholds.queryTime ?? 1000 });
    }
  }
  const uniqueViolations = violations.filter(
    (v, i, arr) => arr.findIndex(x => x.metric === v.metric && x.value === v.value) === i
  ).slice(0, 20);

  return {
    generatedAt: new Date().toISOString(),
    uptimeSeconds: Math.round((Date.now() - _startTime) / 1000),
    memory: getMemoryUsage(),
    metrics: metricsReport,
    renderCounts: getRenderCounts(),
    realtimeEventsPerMinute: getRealtimeStats(),
    totalMetricsRecorded: metrics.length,
    thresholdViolations: uniqueViolations,
  };
}

export function formatReportAsText(report: DiagnosticsReport): string {
  const lines: string[] = [];

  lines.push('=== DIAGNÓSTICO DE PERFORMANCE ===');
  lines.push(`Gerado em: ${new Date(report.generatedAt).toLocaleString('pt-BR')}`);
  lines.push(`Uptime: ${report.uptimeSeconds}s | Total de métricas: ${report.totalMetricsRecorded}`);
  lines.push('');

  if (report.memory) {
    lines.push('── MEMÓRIA ──────────────────────────');
    lines.push(`  Usado: ${report.memory.usedMB}MB / ${report.memory.limitMB}MB (${report.memory.percentage}%)`);
    lines.push('');
  }

  const domainGroups: Record<string, string[]> = {};
  for (const [name, stats] of Object.entries(report.metrics)) {
    if (!stats) continue;
    const prefix = name.split('.')[0];
    if (!domainGroups[prefix]) domainGroups[prefix] = [];
    const line = `  ${name.padEnd(40)} avg:${String(stats.avg).padStart(8)}ms  p95:${String(stats.p95).padStart(8)}ms  max:${String(stats.max).padStart(8)}ms  n:${stats.count}`;
    domainGroups[prefix].push(line);
  }

  for (const [group, groupLines] of Object.entries(domainGroups)) {
    lines.push(`── ${group.toUpperCase()} ${'─'.repeat(Math.max(0, 35 - group.length))}`);
    lines.push(...groupLines);
    lines.push('');
  }

  const renderEntries = Object.entries(report.renderCounts).sort((a, b) => b[1] - a[1]);
  if (renderEntries.length > 0) {
    lines.push('── RE-RENDERS ───────────────────────');
    for (const [name, count] of renderEntries) {
      lines.push(`  ${name.padEnd(40)} ${count}x`);
    }
    lines.push('');
  }

  const rtEntries = Object.entries(report.realtimeEventsPerMinute).sort((a, b) => b[1] - a[1]);
  if (rtEntries.length > 0) {
    lines.push('── EVENTOS REALTIME (último minuto) ─');
    for (const [channel, count] of rtEntries) {
      lines.push(`  ${channel.padEnd(40)} ${count}/min`);
    }
    lines.push('');
  }

  if (report.thresholdViolations.length > 0) {
    lines.push('── VIOLAÇÕES DE THRESHOLD ───────────');
    for (const v of report.thresholdViolations) {
      lines.push(`  ${v.metric}: ${v.value}ms (threshold: ${v.threshold}ms)`);
    }
    lines.push('');
  }

  lines.push('='.repeat(40));
  return lines.join('\n');
}
