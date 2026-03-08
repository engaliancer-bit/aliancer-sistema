import { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, Database, Clock, TrendingUp, AlertTriangle, RefreshCw, X } from 'lucide-react';
import { getQueryMetrics, getQueryStats, clearQueryMetrics } from '../hooks/useQueryCache';

export default function QueryPerformanceMonitor() {
  const [metrics, setMetrics] = useState(getQueryMetrics());
  const [stats, setStats] = useState(getQueryStats());
  const [isOpen, setIsOpen] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout>();

  const refreshData = useCallback(() => {
    setMetrics(getQueryMetrics());
    setStats(getQueryStats());
  }, []);

  useEffect(() => {
    if (!isOpen) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
      return;
    }

    refreshData();
    intervalRef.current = setInterval(refreshData, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    };
  }, [isOpen, refreshData]);

  const handleClear = () => {
    clearQueryMetrics();
    setMetrics([]);
    setStats(getQueryStats());
  };

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors z-50"
        title="Abrir Monitor de Performance"
      >
        <Activity className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-2xl border border-gray-200 w-96 max-h-[600px] overflow-hidden z-50 flex flex-col">
      <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          <h3 className="font-semibold">Query Performance</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshData}
            className="p-1 hover:bg-blue-700 rounded"
            title="Atualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleClear}
            className="p-1 hover:bg-blue-700 rounded text-xs"
            title="Limpar metricas"
          >
            Limpar
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-blue-700 rounded"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto flex-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-gray-600 text-xs mb-1">
              <Database className="w-3 h-3" />
              <span>Total Queries</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalQueries}</div>
          </div>

          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-600 text-xs mb-1">
              <TrendingUp className="w-3 h-3" />
              <span>Success Rate</span>
            </div>
            <div className="text-2xl font-bold text-green-700">
              {stats.successRate.toFixed(1)}%
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-blue-600 text-xs mb-1">
              <Database className="w-3 h-3" />
              <span>Cache Hit Rate</span>
            </div>
            <div className="text-2xl font-bold text-blue-700">
              {stats.cacheHitRate.toFixed(1)}%
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-purple-600 text-xs mb-1">
              <Clock className="w-3 h-3" />
              <span>Avg Duration</span>
            </div>
            <div className="text-2xl font-bold text-purple-700">
              {stats.averageDuration.toFixed(0)}ms
            </div>
          </div>
        </div>

        {stats.slowQueries.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-red-600 font-semibold text-sm mb-2">
              <AlertTriangle className="w-4 h-4" />
              <span>Slow Queries (&gt; 1s)</span>
            </div>
            <div className="space-y-2">
              {stats.slowQueries.map((query, index) => (
                <div
                  key={index}
                  className="bg-red-50 border border-red-200 rounded p-2 text-xs"
                >
                  <div className="font-medium text-red-900 truncate">{query.queryKey}</div>
                  <div className="text-red-600 mt-1">
                    Duration: {query.duration.toFixed(2)}ms
                  </div>
                  {query.dataSize && (
                    <div className="text-red-500 text-xs mt-0.5">
                      Size: {(query.dataSize / 1024).toFixed(2)} KB
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="font-semibold text-sm mb-2 text-gray-700">Recent Queries</div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {metrics.slice(-10).reverse().map((metric, index) => (
              <div
                key={index}
                className={`rounded p-2 text-xs border ${
                  metric.success
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium truncate flex-1 mr-2">
                    {metric.queryKey.split('_')[0]}
                  </div>
                  <div
                    className={`font-mono ${
                      metric.duration > 1000
                        ? 'text-red-600 font-bold'
                        : metric.duration > 500
                        ? 'text-yellow-600'
                        : 'text-green-600'
                    }`}
                  >
                    {metric.duration.toFixed(0)}ms
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1 text-gray-500">
                  {metric.fromCache && (
                    <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs">
                      CACHE
                    </span>
                  )}
                  {metric.dataSize && (
                    <span className="text-xs">
                      {(metric.dataSize / 1024).toFixed(1)} KB
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-gray-50 px-4 py-2 border-t border-gray-200 text-xs text-gray-600">
        Development only - Updates every 5s when open
      </div>
    </div>
  );
}
