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

// Per-component render timestamp for computing render-rate-per-minute
const renderTimestamps = new Map<string, number[]>();

export function incrementRenderCount(componentName: string) {
  renderCounts.set(componentName, (renderCounts.get(componentName) ?? 0) + 1);
  const now = Date.now();
  const ts = renderTimestamps.get(componentName) ?? [];
  ts.push(now);
  const cutoff = now - 60_000;
  const trimmed = ts.filter(t => t >= cutoff);
  renderTimestamps.set(componentName, trimmed);
}

export function getRenderCount(componentName: string): number {
  return renderCounts.get(componentName) ?? 0;
}

export function getRenderCounts(): Record<string, number> {
  return Object.fromEntries(renderCounts);
}

export function getRendersPerMinute(): Record<string, number> {
  const cutoff = Date.now() - 60_000;
  const result: Record<string, number> = {};
  for (const [name, ts] of renderTimestamps) {
    result[name] = ts.filter(t => t >= cutoff).length;
  }
  return result;
}

export function resetRenderCount(componentName: string) {
  renderCounts.delete(componentName);
  renderTimestamps.delete(componentName);
}

// ─── Realtime event rate tracker ──────────────────────────────────────────────
interface RealtimeEventEntry {
  channel: string;
  timestamp: number;
  processingMs?: number;
}

const realtimeEvents: RealtimeEventEntry[] = [];

// Track post-event processing time (time from event receipt to state update complete)
const realtimeProcessingTimes = new Map<string, number[]>();

export function recordRealtimeEvent(channel: string, processingMs?: number) {
  const now = Date.now();
  realtimeEvents.push({ channel, timestamp: now, processingMs });

  if (processingMs !== undefined) {
    const existing = realtimeProcessingTimes.get(channel) ?? [];
    existing.push(processingMs);
    if (existing.length > 100) existing.shift();
    realtimeProcessingTimes.set(channel, existing);
  }

  // Keep last 5 minutes only (300_000 ms)
  const cutoff = now - 300_000;
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

export function getRealtimeProcessingStats(): Record<string, { avgMs: number; maxMs: number; samples: number }> {
  const result: Record<string, { avgMs: number; maxMs: number; samples: number }> = {};
  for (const [channel, times] of realtimeProcessingTimes) {
    if (times.length === 0) continue;
    const sum = times.reduce((a, b) => a + b, 0);
    result[channel] = {
      avgMs: Math.round(sum / times.length),
      maxMs: Math.max(...times),
      samples: times.length,
    };
  }
  return result;
}

// ─── Active Realtime channels registry (owned by useRealtimeChannel) ──────────
const _activeChannelRegistry = new Map<string, { tables: string[]; subscribedAt: number }>();

export function registerActiveChannel(channelName: string, tables: string[]) {
  _activeChannelRegistry.set(channelName, { tables, subscribedAt: Date.now() });
}

export function unregisterActiveChannel(channelName: string) {
  _activeChannelRegistry.delete(channelName);
}

export function getActiveChannels(): Array<{ name: string; tables: string[]; ageSeconds: number }> {
  const now = Date.now();
  return Array.from(_activeChannelRegistry.entries()).map(([name, info]) => ({
    name,
    tables: info.tables,
    ageSeconds: Math.round((now - info.subscribedAt) / 1000),
  }));
}

export function getActiveChannelCount(): number {
  return _activeChannelRegistry.size;
}

// ─── Cleanup callback tracker ─────────────────────────────────────────────────
// Components call registerCleanupCallback on mount and unregisterCleanupCallback on unmount
const _cleanupCallbacks = new Map<string, number>();

export function registerCleanupCallback(componentName: string) {
  _cleanupCallbacks.set(componentName, (_cleanupCallbacks.get(componentName) ?? 0) + 1);
}

export function unregisterCleanupCallback(componentName: string) {
  const n = (_cleanupCallbacks.get(componentName) ?? 1) - 1;
  if (n <= 0) _cleanupCallbacks.delete(componentName);
  else _cleanupCallbacks.set(componentName, n);
}

export function getCleanupCallbackCounts(): Record<string, number> {
  return Object.fromEntries(_cleanupCallbacks);
}

export function getTotalCleanupCallbacks(): number {
  let total = 0;
  for (const v of _cleanupCallbacks.values()) total += v;
  return total;
}

// ─── List size tracker ────────────────────────────────────────────────────────
// Components call this when they set their main data array so we can detect
// oversized lists that force large reconciliations
const _listSizes = new Map<string, { size: number; updatedAt: number }>();

export function recordListSize(listName: string, size: number) {
  _listSizes.set(listName, { size, updatedAt: Date.now() });
}

export function getListSizes(): Record<string, { size: number; updatedAt: number }> {
  return Object.fromEntries(_listSizes);
}

// ─── Pending / concurrent request tracker ────────────────────────────────────
// requestCancellation.ts already owns getPendingRequestCount/getPendingRequests.
// We expose a snapshot function here so generateReport() can pull it in
// without creating a circular dependency (requestCancellation imports nothing from here).
type RequestSnapshotProvider = () => Array<{ key: string; ageMs: number }>;
let _requestSnapshotProvider: RequestSnapshotProvider | null = null;

export function setRequestSnapshotProvider(provider: RequestSnapshotProvider) {
  _requestSnapshotProvider = provider;
}

export function getPendingRequestsSnapshot(): Array<{ key: string; ageMs: number }> {
  return _requestSnapshotProvider ? _requestSnapshotProvider() : [];
}

// ─── Leak detector snapshot provider ─────────────────────────────────────────
type LeakStatsProvider = () => {
  intervals: number;
  timeouts: number;
  totalListeners: number;
  realtimeChannelsTracked: number;
};
let _leakStatsProvider: LeakStatsProvider | null = null;

export function setLeakStatsProvider(provider: LeakStatsProvider) {
  _leakStatsProvider = provider;
}

export function getLeakStats(): ReturnType<LeakStatsProvider> | null {
  return _leakStatsProvider ? _leakStatsProvider() : null;
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
    last: Math.round((values[values.length - 1] ?? 0) * 10) / 10,
  };
}

export function clearMetrics() {
  metrics.length = 0;
  renderCounts.clear();
  renderTimestamps.clear();
  realtimeEvents.length = 0;
  realtimeProcessingTimes.clear();
  _listSizes.clear();
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

// ─── Extended diagnostics report ──────────────────────────────────────────────
export interface DiagnosticsReport {
  generatedAt: string;
  uptimeSeconds: number;
  memory: ReturnType<typeof getMemoryUsage>;
  metrics: Record<string, ReturnType<typeof getMetricStats>>;
  renderCounts: Record<string, number>;
  rendersPerMinute: Record<string, number>;
  realtimeEventsPerMinute: Record<string, number>;
  realtimeProcessing: Record<string, { avgMs: number; maxMs: number; samples: number }>;
  activeChannels: Array<{ name: string; tables: string[]; ageSeconds: number }>;
  cleanupCallbacks: Record<string, number>;
  totalCleanupCallbacks: number;
  listSizes: Record<string, { size: number; updatedAt: number }>;
  pendingRequests: Array<{ key: string; ageMs: number }>;
  leakStats: ReturnType<typeof getLeakStats>;
  totalMetricsRecorded: number;
  thresholdViolations: Array<{ metric: string; value: number; threshold: number }>;
  degradationHints: string[];
}

const _startTime = Date.now();

function buildDegradationHints(
  report: Omit<DiagnosticsReport, 'degradationHints'>
): string[] {
  const hints: string[] = [];

  // Subscriptions duplicadas
  const channelCounts: Record<string, number> = {};
  for (const ch of report.activeChannels) {
    channelCounts[ch.name] = (channelCounts[ch.name] ?? 0) + 1;
  }
  const dupes = Object.entries(channelCounts).filter(([, n]) => n > 1);
  if (dupes.length > 0) {
    hints.push(`Possível subscrição duplicada: ${dupes.map(([n, c]) => `${n} (${c}x)`).join(', ')}`);
  }

  // Canais demais ativos
  if (report.activeChannels.length > 10) {
    hints.push(`${report.activeChannels.length} canais realtime ativos simultaneamente — verifique cleanup ao navegar entre telas.`);
  }

  // Flood de eventos
  for (const [channel, count] of Object.entries(report.realtimeEventsPerMinute)) {
    if (count > 60) {
      hints.push(`Flood de eventos no canal "${channel}": ${count}/min. Verifique triggers de banco ou loops de atualização.`);
    }
  }

  // Processamento lento pós-evento
  for (const [channel, stats] of Object.entries(report.realtimeProcessing)) {
    if (stats.avgMs > 100) {
      hints.push(`Processamento lento de eventos no canal "${channel}": avg ${stats.avgMs}ms. Verifique callbacks de estado.`);
    }
  }

  // Listas muito grandes
  for (const [name, info] of Object.entries(report.listSizes)) {
    if (info.size > 500) {
      hints.push(`Lista "${name}" com ${info.size} itens pode causar reconciliação lenta. Considere paginação.`);
    }
  }

  // Cleanup callbacks acumulados (possível mount/unmount imbalance)
  if (report.totalCleanupCallbacks > 30) {
    hints.push(`${report.totalCleanupCallbacks} cleanup callbacks registrados — possível vazamento de subscriptions ou effects.`);
  }

  // Requests pendentes demais
  if (report.pendingRequests.length > 5) {
    hints.push(`${report.pendingRequests.length} requests pendentes simultâneos — verifique cancelamento adequado.`);
  }

  // Requests muito velhos (não cancelados)
  const oldReqs = report.pendingRequests.filter(r => r.ageMs > 10000);
  if (oldReqs.length > 0) {
    hints.push(`${oldReqs.length} request(s) com mais de 10s sem retorno — possível vazamento de AbortController.`);
  }

  // Muitos re-renders
  for (const [comp, rCount] of Object.entries(report.renderCounts)) {
    if (rCount > 100) {
      hints.push(`Componente "${comp}" renderizou ${rCount} vezes — verifique dependências de hooks e estados desnecessários.`);
    }
  }

  // Alta frequência de renders recentes
  for (const [comp, rpm] of Object.entries(report.rendersPerMinute)) {
    if (rpm > 30) {
      hints.push(`Componente "${comp}" teve ${rpm} renders no último minuto — possível loop de re-render.`);
    }
  }

  // Timers acumulados (leak de interval/timeout)
  if (report.leakStats) {
    if (report.leakStats.intervals > 15) {
      hints.push(`${report.leakStats.intervals} setInterval ativos — verifique cleanup em useEffect.`);
    }
    if (report.leakStats.timeouts > 40) {
      hints.push(`${report.leakStats.timeouts} setTimeout pendentes — possível acúmulo de retry/debounce sem cancelamento.`);
    }
    if (report.leakStats.totalListeners > 80) {
      hints.push(`${report.leakStats.totalListeners} event listeners ativos na window — verifique removeEventListener nos cleanups.`);
    }
  }

  // Memória alta
  if (report.memory && report.memory.percentage > 75) {
    hints.push(`Uso de memória em ${report.memory.percentage}% (${report.memory.usedMB}MB). Risco de GC pausas que travam a UI.`);
  }

  return hints;
}

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

  const base: Omit<DiagnosticsReport, 'degradationHints'> = {
    generatedAt: new Date().toISOString(),
    uptimeSeconds: Math.round((Date.now() - _startTime) / 1000),
    memory: getMemoryUsage(),
    metrics: metricsReport,
    renderCounts: getRenderCounts(),
    rendersPerMinute: getRendersPerMinute(),
    realtimeEventsPerMinute: getRealtimeStats(),
    realtimeProcessing: getRealtimeProcessingStats(),
    activeChannels: getActiveChannels(),
    cleanupCallbacks: getCleanupCallbackCounts(),
    totalCleanupCallbacks: getTotalCleanupCallbacks(),
    listSizes: getListSizes(),
    pendingRequests: getPendingRequestsSnapshot(),
    leakStats: getLeakStats(),
    totalMetricsRecorded: metrics.length,
    thresholdViolations: uniqueViolations,
  };

  return {
    ...base,
    degradationHints: buildDegradationHints(base),
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

  if (report.leakStats) {
    lines.push('── TIMERS / LISTENERS ───────────────');
    lines.push(`  Intervals ativos:  ${report.leakStats.intervals}`);
    lines.push(`  Timeouts ativos:   ${report.leakStats.timeouts}`);
    lines.push(`  Event listeners:   ${report.leakStats.totalListeners}`);
    lines.push(`  Canais RT rastr.:  ${report.leakStats.realtimeChannelsTracked}`);
    lines.push('');
  }

  if (report.activeChannels.length > 0) {
    lines.push('── CANAIS REALTIME ATIVOS ────────────');
    for (const ch of report.activeChannels) {
      lines.push(`  ${ch.name.padEnd(40)} tables:${ch.tables.join(',')}  age:${ch.ageSeconds}s`);
    }
    lines.push('');
  }

  if (Object.keys(report.realtimeEventsPerMinute).length > 0) {
    lines.push('── EVENTOS REALTIME (último minuto) ─');
    for (const [channel, count] of Object.entries(report.realtimeEventsPerMinute).sort((a, b) => b[1] - a[1])) {
      const proc = report.realtimeProcessing[channel];
      const procStr = proc ? `  proc:avg${proc.avgMs}ms/max${proc.maxMs}ms` : '';
      lines.push(`  ${channel.padEnd(40)} ${count}/min${procStr}`);
    }
    lines.push('');
  }

  if (report.pendingRequests.length > 0) {
    lines.push('── REQUESTS PENDENTES ───────────────');
    for (const r of report.pendingRequests.sort((a, b) => b.ageMs - a.ageMs)) {
      const ageS = (r.ageMs / 1000).toFixed(1);
      lines.push(`  ${r.key.substring(0, 50).padEnd(52)} age:${ageS}s`);
    }
    lines.push('');
  }

  if (Object.keys(report.cleanupCallbacks).length > 0) {
    lines.push('── CLEANUP CALLBACKS REGISTRADOS ────');
    for (const [name, count] of Object.entries(report.cleanupCallbacks).sort((a, b) => b[1] - a[1])) {
      lines.push(`  ${name.padEnd(40)} ${count}x`);
    }
    lines.push(`  Total: ${report.totalCleanupCallbacks}`);
    lines.push('');
  }

  if (Object.keys(report.listSizes).length > 0) {
    lines.push('── TAMANHO DAS LISTAS ───────────────');
    for (const [name, info] of Object.entries(report.listSizes).sort((a, b) => b[1].size - a[1].size)) {
      lines.push(`  ${name.padEnd(40)} ${info.size} itens`);
    }
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
    lines.push('── RE-RENDERS (total / último min) ──');
    for (const [name, count] of renderEntries) {
      const rpm = report.rendersPerMinute[name] ?? 0;
      lines.push(`  ${name.padEnd(40)} total:${String(count).padStart(5)}x  rpm:${String(rpm).padStart(4)}`);
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

  if (report.degradationHints.length > 0) {
    lines.push('── DIAGNÓSTICO DE DEGRADAÇÃO ─────────');
    for (const hint of report.degradationHints) {
      lines.push(`  ⚠ ${hint}`);
    }
    lines.push('');
  }

  lines.push('='.repeat(40));
  return lines.join('\n');
}
