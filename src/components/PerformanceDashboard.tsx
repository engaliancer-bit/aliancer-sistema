import { useState, useEffect } from 'react';
import { Activity, TrendingDown, AlertCircle, X } from 'lucide-react';
import { getQueryStats, getSlowQueries, clearQueryLogs } from '../lib/queryLogger';

/**
 * Dashboard de Performance - Apenas Desenvolvimento
 *
 * Mini dashboard fixo no canto da tela mostrando métricas em tempo real:
 * - Total de queries
 * - Duração média
 * - Queries lentas
 * - Alertas visuais
 */
export default function PerformanceDashboard() {
  const [stats, setStats] = useState(getQueryStats());
  const [slowQueries, setSlowQueries] = useState(getSlowQueries());
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(getQueryStats());
      setSlowQueries(getSlowQueries());
    }, 1000); // Atualiza a cada 1 segundo

    return () => clearInterval(interval);
  }, []);

  // Apenas em desenvolvimento
  if (!import.meta.env.DEV) {
    return null;
  }

  // Nenhuma query executada ainda
  if (stats.totalQueries === 0 && !isExpanded) {
    return (
      <div className="fixed bottom-4 left-4 bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg text-xs z-40">
        <div className="flex items-center gap-2">
          <Activity className="w-3 h-3 text-gray-400" />
          <span className="text-gray-400">Aguardando queries...</span>
        </div>
      </div>
    );
  }

  // Versão compacta
  if (!isExpanded) {
    return (
      <div
        onClick={() => setIsExpanded(true)}
        className="fixed bottom-4 left-4 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg cursor-pointer hover:bg-gray-800 transition-colors z-40"
      >
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <Activity className="w-3 h-3 text-blue-400" />
            <span className="text-gray-300">Queries:</span>
            <span className="font-bold text-white">{stats.totalQueries}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-300">Média:</span>
            <span
              className={`font-bold ${
                stats.averageDuration > 1000
                  ? 'text-red-400'
                  : stats.averageDuration > 500
                  ? 'text-yellow-400'
                  : 'text-green-400'
              }`}
            >
              {stats.averageDuration.toFixed(0)}ms
            </span>
          </div>

          {slowQueries.length > 0 && (
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3 h-3 text-red-400 animate-pulse" />
              <span className="font-bold text-red-400">{slowQueries.length}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Versão expandida
  return (
    <div className="fixed bottom-4 left-4 bg-gray-900 text-white rounded-lg shadow-2xl border border-gray-700 w-80 z-40">
      {/* Header */}
      <div className="bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400" />
          <h3 className="font-semibold text-sm">Performance Analytics</h3>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="p-1 hover:bg-gray-700 rounded transition-colors"
          title="Minimizar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Métricas */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-800 rounded-lg p-2 border border-gray-700">
            <div className="text-xs text-gray-400 mb-1">Total Queries</div>
            <div className="text-xl font-bold text-white">{stats.totalQueries}</div>
          </div>

          <div className="bg-gray-800 rounded-lg p-2 border border-gray-700">
            <div className="text-xs text-gray-400 mb-1">Success Rate</div>
            <div
              className={`text-xl font-bold ${
                stats.successRate > 95 ? 'text-green-400' : 'text-yellow-400'
              }`}
            >
              {stats.successRate.toFixed(1)}%
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-2 border border-gray-700">
            <div className="text-xs text-gray-400 mb-1">Avg Duration</div>
            <div
              className={`text-xl font-bold ${
                stats.averageDuration > 1000
                  ? 'text-red-400'
                  : stats.averageDuration > 500
                  ? 'text-yellow-400'
                  : 'text-green-400'
              }`}
            >
              {stats.averageDuration.toFixed(0)}ms
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-2 border border-gray-700">
            <div className="text-xs text-gray-400 mb-1">Slow Queries</div>
            <div
              className={`text-xl font-bold ${
                slowQueries.length > 0 ? 'text-red-400' : 'text-green-400'
              }`}
            >
              {slowQueries.length}
            </div>
          </div>
        </div>

        {/* Queries Lentas Alert */}
        {slowQueries.length > 0 && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5 animate-pulse" />
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-red-400 text-xs mb-1">
                  {slowQueries.length} {slowQueries.length === 1 ? 'Query Lenta' : 'Queries Lentas'}
                </h4>
                <div className="text-xs text-red-300 space-y-1 max-h-20 overflow-y-auto">
                  {slowQueries.slice(0, 3).map((log, i) => (
                    <div key={i} className="truncate">
                      <strong>{log.queryName}:</strong> {log.duration}ms
                    </div>
                  ))}
                  {slowQueries.length > 3 && (
                    <div className="text-red-400">+{slowQueries.length - 3} mais...</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Velocidade Visual */}
        <div>
          <div className="text-xs text-gray-400 mb-2">Performance Status</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  stats.averageDuration < 200
                    ? 'bg-green-400'
                    : stats.averageDuration < 500
                    ? 'bg-blue-400'
                    : stats.averageDuration < 1000
                    ? 'bg-yellow-400'
                    : 'bg-red-400'
                }`}
                style={{
                  width: `${Math.min(100, (stats.averageDuration / 2000) * 100)}%`,
                }}
              />
            </div>
            {stats.averageDuration < 200 ? (
              <TrendingDown className="w-4 h-4 text-green-400" />
            ) : stats.averageDuration > 1000 ? (
              <AlertCircle className="w-4 h-4 text-red-400" />
            ) : (
              <div className="w-4 h-4" />
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-700">
          <button
            onClick={() => {
              clearQueryLogs();
              setStats(getQueryStats());
              setSlowQueries(getSlowQueries());
            }}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Limpar logs
          </button>
          <div className="text-xs text-gray-500">Auto-update: 1s</div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-800 px-4 py-2 border-t border-gray-700 text-xs text-gray-400">
        Development mode only
      </div>
    </div>
  );
}
