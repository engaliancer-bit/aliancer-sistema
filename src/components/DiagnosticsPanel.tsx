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
  children: React.ReactNode;
}

function Section({ title, icon, defaultOpen = true, children }: SectionProps) {
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
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-4 py-3 bg-white">{children}</div>}
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
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

          {/* Threshold violations */}
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

          {/* Per-domain sections */}
          {Object.entries(domainMetrics).map(([prefix, stats]) => (
            <Section
              key={prefix}
              title={DOMAIN_LABELS[prefix] ?? prefix}
              icon={<BarChart2 className="w-4 h-4 text-blue-500" />}
            >
              <div className="space-y-0">
                {Object.entries(stats).map(([name, s]) => (
                  <StatRow key={name} label={name.split('.').slice(1).join('.')} stats={s} />
                ))}
              </div>
            </Section>
          ))}

          {/* Re-renders */}
          {renderEntries.length > 0 && (
            <Section title="Re-renders por Componente" icon={<Repeat className="w-4 h-4 text-orange-500" />} defaultOpen={false}>
              <div className="space-y-0">
                {renderEntries.map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
                    <span className="text-xs text-gray-600 truncate flex-1">{name}</span>
                    <span className={`text-xs font-mono ${count > 50 ? 'text-red-600 font-bold' : count > 20 ? 'text-yellow-600' : 'text-gray-500'}`}>
                      {count}x
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Realtime events */}
          {rtEntries.length > 0 && (
            <Section title="Eventos Realtime (último minuto)" icon={<Radio className="w-4 h-4 text-green-500" />} defaultOpen={false}>
              <div className="space-y-0">
                {rtEntries.map(([channel, count]) => (
                  <div key={channel} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
                    <span className="text-xs text-gray-600 truncate flex-1">{channel}</span>
                    <Badge
                      label={`${count}/min`}
                      color={count > 60 ? 'bg-red-100 text-red-700' : count > 20 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}
                    />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Memory */}
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

          {/* Empty state */}
          {report.totalMetricsRecorded === 0 && (
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
