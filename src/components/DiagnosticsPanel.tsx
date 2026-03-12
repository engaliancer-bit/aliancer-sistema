import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Activity,
  X,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Cpu,
  BarChart2,
  Repeat,
  Radio,
  Wifi,
  Clock,
  List,
  Loader,
  Timer,
  Zap,
} from 'lucide-react';
import {
  generateReport,
  formatReportAsText,
  clearMetrics,
  getMetricStats,
  DiagnosticsReport,
  METRIC,
} from '../lib/performanceMonitor';

const DOMAIN_LABELS: Record<string, string> = {
  materials: 'Insumos/Compras',
  factory_finance: 'Receitas/Despesas (Fábrica)',
  eng_finance: 'Receitas/Despesas (Engenharia)',
};

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function metricColor(value: number, warn = 500, danger = 1000) {
  if (value >= danger) return 'text-red-600 font-bold';
  if (value >= warn) return 'text-yellow-600 font-semibold';
  return 'text-green-700';
}

function StatRow({ label, stats }: { label: string; stats: ReturnType<typeof getMetricStats> }) {
  if (!stats) return null;
  return (
    <div className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-600 truncate flex-1 pr-2">{label}</span>
      <div className="flex gap-3 text-xs font-mono flex-shrink-0">
        <span className={metricColor(stats.avg)}>avg {stats.avg}ms</span>
        <span className={metricColor(stats.p95, 800, 1500)}>p95 {stats.p95}ms</span>
        <span className={metricColor(stats.max, 1000, 2000)}>max {stats.max}ms</span>
        <span className="text-gray-400">n={stats.count}</span>
      </div>
    </div>
  );
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}

function Section({ title, icon, defaultOpen = true, badge, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-semibold text-gray-700"
      >
        <div className="flex items-center gap-2">
          {icon}
          {title}
          {badge}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-4 py-3 bg-white">{children}</div>}
    </div>
  );
}

function KV({ label, value, valueClass = 'text-gray-800' }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-mono font-medium ${valueClass}`}>{value}</span>
    </div>
  );
}

export default function DiagnosticsPanel({ onClose }: { onClose: () => void }) {
  const [report, setReport] = useState<DiagnosticsReport>(() => generateReport());
  const [copied, setCopied] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(() => {
    setReport(generateReport());
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(refresh, 3000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, refresh]);

  const handleCopy = useCallback(async () => {
    const text = formatReportAsText(report);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [report]);

  const handleClear = useCallback(() => {
    clearMetrics();
    setReport(generateReport());
  }, []);

  const domainMetrics: Record<string, Record<string, ReturnType<typeof getMetricStats>>> = {};
  for (const [name, stats] of Object.entries(report.metrics)) {
    if (!stats) continue;
    const prefix = name.split('.')[0];
    if (!domainMetrics[prefix]) domainMetrics[prefix] = {};
    domainMetrics[prefix][name] = stats;
  }

  const renderEntries = Object.entries(report.renderCounts).sort((a, b) => b[1] - a[1]);
  const rtEntries = Object.entries(report.realtimeEventsPerMinute).sort((a, b) => b[1] - a[1]);
  const listSizeEntries = Object.entries(report.listSizes).sort((a, b) => b[1].size - a[1].size);
  const cleanupEntries = Object.entries(report.cleanupCallbacks).sort((a, b) => b[1] - a[1]);
  const pendingReqs = [...report.pendingRequests].sort((a, b) => b.ageMs - a.ageMs);

  const hasHints = report.degradationHints.length > 0;
  const hasAnyData =
    report.totalMetricsRecorded > 0 ||
    renderEntries.length > 0 ||
    rtEntries.length > 0 ||
    report.activeChannels.length > 0;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-sm">Diagnóstico de Performance</h2>
              <p className="text-xs text-gray-500">
                Uptime: {report.uptimeSeconds}s · {report.totalMetricsRecorded} métricas
                {report.memory && ` · RAM: ${report.memory.usedMB}MB/${report.memory.limitMB}MB (${report.memory.percentage}%)`}
                {report.activeChannels.length > 0 && ` · ${report.activeChannels.length} canais`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(a => !a)}
              title={autoRefresh ? 'Pausar atualização automática' : 'Ativar atualização automática'}
              className={`p-1.5 rounded-lg transition-colors text-xs flex items-center gap-1 ${autoRefresh ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin' : ''}`} />
              {autoRefresh ? 'Auto' : 'Parado'}
            </button>
            <button onClick={refresh} title="Atualizar agora" className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleCopy} title="Copiar relatório" className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex items-center gap-1 text-xs font-medium">
              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
            <button onClick={handleClear} title="Limpar métricas" className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4 space-y-3">

          {/* ── Degradation hints ── */}
          {hasHints && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <p className="text-xs font-bold text-amber-800">
                  {report.degradationHints.length} alerta{report.degradationHints.length > 1 ? 's' : ''} de degradação detectado{report.degradationHints.length > 1 ? 's' : ''}
                </p>
              </div>
              {report.degradationHints.map((hint, i) => (
                <div key={i} className="flex items-start gap-2 bg-amber-100/60 rounded px-2.5 py-1.5">
                  <span className="text-amber-500 flex-shrink-0 text-xs mt-0.5">⚠</span>
                  <p className="text-xs text-amber-900 leading-relaxed">{hint}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── Threshold violations ── */}
          {report.thresholdViolations.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-red-700 mb-1">Violações de threshold (load &gt; 1000ms)</p>
                  <div className="space-y-0.5">
                    {report.thresholdViolations.slice(0, 5).map((v, i) => (
                      <p key={i} className="text-xs text-red-600 font-mono">{v.metric}: {v.value}ms</p>
                    ))}
                    {report.thresholdViolations.length > 5 && (
                      <p className="text-xs text-red-400">+{report.thresholdViolations.length - 5} mais</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Active realtime channels ── */}
          <Section
            title="Canais Realtime Ativos"
            icon={<Wifi className="w-4 h-4 text-blue-500" />}
            defaultOpen={true}
            badge={
              report.activeChannels.length > 0 ? (
                <Badge
                  label={`${report.activeChannels.length}`}
                  color={report.activeChannels.length > 10 ? 'bg-red-100 text-red-700 ml-1' : 'bg-blue-100 text-blue-700 ml-1'}
                />
              ) : undefined
            }
          >
            {report.activeChannels.length === 0 ? (
              <p className="text-xs text-gray-400 py-1">Nenhum canal subscrito no momento.</p>
            ) : (
              <div className="space-y-0">
                {report.activeChannels.map((ch) => {
                  const proc = report.realtimeProcessing[ch.name];
                  const evPerMin = report.realtimeEventsPerMinute[ch.name] ?? 0;
                  return (
                    <div key={ch.name} className="py-1.5 border-b border-gray-100 last:border-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-700 font-medium truncate flex-1">{ch.name}</span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Badge
                            label={`${evPerMin}/min`}
                            color={evPerMin > 60 ? 'bg-red-100 text-red-700' : evPerMin > 20 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}
                          />
                          <span className="text-xs text-gray-400 font-mono">{ch.ageSeconds}s</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-gray-400">tabelas: {ch.tables.join(', ')}</span>
                        {proc && (
                          <span className={`text-xs font-mono ${proc.avgMs > 100 ? 'text-red-600' : proc.avgMs > 50 ? 'text-yellow-600' : 'text-gray-400'}`}>
                            proc avg {proc.avgMs}ms / max {proc.maxMs}ms
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* ── Re-renders + rate ── */}
          {renderEntries.length > 0 && (
            <Section
              title="Re-renders por Componente"
              icon={<Repeat className="w-4 h-4 text-orange-500" />}
              defaultOpen={false}
            >
              <div className="space-y-0">
                {renderEntries.map(([name, count]) => {
                  const rpm = report.rendersPerMinute[name] ?? 0;
                  return (
                    <div key={name} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
                      <span className="text-xs text-gray-600 truncate flex-1">{name}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-400 font-mono">{rpm}/min</span>
                        <span className={`text-xs font-mono font-semibold ${count > 100 ? 'text-red-600' : count > 50 ? 'text-yellow-600' : count > 20 ? 'text-orange-500' : 'text-gray-500'}`}>
                          {count}x total
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* ── Realtime events (existing channel with processing) ── */}
          {rtEntries.length > 0 && (
            <Section
              title="Eventos Realtime (último minuto)"
              icon={<Radio className="w-4 h-4 text-green-500" />}
              defaultOpen={false}
            >
              <div className="space-y-0">
                {rtEntries.map(([channel, count]) => {
                  const proc = report.realtimeProcessing[channel];
                  return (
                    <div key={channel} className="py-1.5 border-b border-gray-100 last:border-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600 truncate flex-1">{channel}</span>
                        <Badge
                          label={`${count}/min`}
                          color={count > 60 ? 'bg-red-100 text-red-700' : count > 20 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}
                        />
                      </div>
                      {proc && (
                        <p className={`text-xs font-mono mt-0.5 ${proc.avgMs > 100 ? 'text-red-600' : proc.avgMs > 50 ? 'text-yellow-600' : 'text-gray-400'}`}>
                          processamento: avg {proc.avgMs}ms / max {proc.maxMs}ms / {proc.samples} amostras
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* ── Pending requests ── */}
          {pendingReqs.length > 0 && (
            <Section
              title="Requests Pendentes"
              icon={<Loader className="w-4 h-4 text-sky-500" />}
              defaultOpen={true}
              badge={
                <Badge
                  label={`${pendingReqs.length}`}
                  color={pendingReqs.length > 5 ? 'bg-red-100 text-red-700 ml-1' : 'bg-sky-100 text-sky-700 ml-1'}
                />
              }
            >
              <div className="space-y-0">
                {pendingReqs.map((r, i) => {
                  const ageS = (r.ageMs / 1000).toFixed(1);
                  const isStale = r.ageMs > 10000;
                  return (
                    <div key={i} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
                      <span className="text-xs text-gray-600 truncate flex-1 font-mono">{r.key}</span>
                      <Badge
                        label={`${ageS}s`}
                        color={isStale ? 'bg-red-100 text-red-700 ml-2' : 'bg-gray-100 text-gray-600 ml-2'}
                      />
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* ── List sizes ── */}
          {listSizeEntries.length > 0 && (
            <Section
              title="Tamanho das Listas Carregadas"
              icon={<List className="w-4 h-4 text-teal-500" />}
              defaultOpen={false}
            >
              <div className="space-y-0">
                {listSizeEntries.map(([name, info]) => (
                  <div key={name} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
                    <span className="text-xs text-gray-600 truncate flex-1">{name}</span>
                    <Badge
                      label={`${info.size} itens`}
                      color={info.size > 500 ? 'bg-red-100 text-red-700' : info.size > 200 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}
                    />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── Cleanup callbacks ── */}
          {cleanupEntries.length > 0 && (
            <Section
              title="Cleanup Callbacks Registrados"
              icon={<Zap className="w-4 h-4 text-violet-500" />}
              defaultOpen={false}
              badge={
                report.totalCleanupCallbacks > 30 ? (
                  <Badge label={`total: ${report.totalCleanupCallbacks}`} color="bg-red-100 text-red-700 ml-1" />
                ) : (
                  <Badge label={`total: ${report.totalCleanupCallbacks}`} color="bg-gray-100 text-gray-600 ml-1" />
                )
              }
            >
              <div className="space-y-0">
                {cleanupEntries.map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
                    <span className="text-xs text-gray-600 truncate flex-1">{name}</span>
                    <Badge
                      label={`${count}x`}
                      color={count > 5 ? 'bg-red-100 text-red-700' : count > 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}
                    />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── Timers & listeners (leak detector) ── */}
          {report.leakStats && (
            <Section
              title="Timers & Event Listeners"
              icon={<Timer className="w-4 h-4 text-gray-500" />}
              defaultOpen={false}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <KV
                    label="setInterval ativos"
                    value={report.leakStats.intervals}
                    valueClass={report.leakStats.intervals > 15 ? 'text-red-600' : report.leakStats.intervals > 8 ? 'text-yellow-600' : 'text-green-700'}
                  />
                  <KV
                    label="setTimeout pendentes"
                    value={report.leakStats.timeouts}
                    valueClass={report.leakStats.timeouts > 40 ? 'text-red-600' : report.leakStats.timeouts > 20 ? 'text-yellow-600' : 'text-green-700'}
                  />
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <KV
                    label="Event listeners (window)"
                    value={report.leakStats.totalListeners}
                    valueClass={report.leakStats.totalListeners > 80 ? 'text-red-600' : report.leakStats.totalListeners > 40 ? 'text-yellow-600' : 'text-green-700'}
                  />
                  <KV
                    label="Canais RT rastreados"
                    value={report.leakStats.realtimeChannelsTracked}
                    valueClass="text-gray-700"
                  />
                </div>
              </div>
            </Section>
          )}

          {/* ── Per-domain timing metrics ── */}
          {Object.entries(domainMetrics).map(([prefix, stats]) => (
            <Section
              key={prefix}
              title={DOMAIN_LABELS[prefix] ?? prefix}
              icon={<BarChart2 className="w-4 h-4 text-blue-500" />}
              defaultOpen={false}
            >
              <div className="space-y-0">
                {Object.entries(stats).map(([name, s]) => (
                  <StatRow key={name} label={name.split('.').slice(1).join('.')} stats={s} />
                ))}
              </div>
            </Section>
          ))}

          {/* ── Memory ── */}
          {report.memory && (
            <Section title="Memória" icon={<Cpu className="w-4 h-4 text-gray-500" />} defaultOpen={false}>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Usado</p>
                  <p className={`text-lg font-bold font-mono ${report.memory.percentage > 80 ? 'text-red-600' : report.memory.percentage > 60 ? 'text-yellow-600' : 'text-gray-900'}`}>
                    {report.memory.usedMB}MB
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Total</p>
                  <p className="text-lg font-bold font-mono text-gray-900">{report.memory.totalMB}MB</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Utilização</p>
                  <p className={`text-lg font-bold font-mono ${report.memory.percentage > 80 ? 'text-red-600' : report.memory.percentage > 60 ? 'text-yellow-600' : 'text-green-700'}`}>
                    {report.memory.percentage}%
                  </p>
                </div>
              </div>
              <div className="mt-3 bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${report.memory.percentage > 80 ? 'bg-red-500' : report.memory.percentage > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${Math.min(report.memory.percentage, 100)}%` }}
                />
              </div>
            </Section>
          )}

          {/* ── Empty state ── */}
          {!hasAnyData && (
            <div className="text-center py-12 text-gray-400">
              <Activity className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhuma métrica registrada ainda.</p>
              <p className="text-xs mt-1">Navegue pelas telas de Insumos/Compras e Receitas/Despesas para coletar dados.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Gerado em: {new Date(report.generatedAt).toLocaleTimeString('pt-BR')}
            {hasHints && (
              <span className="ml-2 text-amber-600 font-medium">
                {report.degradationHints.length} alerta{report.degradationHints.length > 1 ? 's' : ''}
              </span>
            )}
          </p>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copiado!' : 'Copiar Relatório Completo'}
          </button>
        </div>
      </div>
    </div>
  );
}
