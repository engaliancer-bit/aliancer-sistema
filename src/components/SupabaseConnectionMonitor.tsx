import { useState, useEffect, useRef, useCallback } from 'react';
import { Database, AlertTriangle, CheckCircle, X, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ConnectionStats {
  activeChannels: number;
  timestamp: number;
}

export default function SupabaseConnectionMonitor() {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState<ConnectionStats>({ activeChannels: 0, timestamp: Date.now() });
  const [history, setHistory] = useState<ConnectionStats[]>([]);
  const [hasLeak, setHasLeak] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout>();

  const updateStats = useCallback(() => {
    const channels = supabase.getChannels();
    const newStat = {
      activeChannels: channels.length,
      timestamp: Date.now()
    };

    setStats(newStat);

    setHistory(prev => {
      const updated = [...prev, newStat];
      if (updated.length > 50) {
        updated.shift();
      }

      if (updated.length >= 10) {
        const first = updated[0];
        const last = updated[updated.length - 1];

        if (last.activeChannels - first.activeChannels > 5) {
          setHasLeak(true);
        } else {
          setHasLeak(false);
        }
      }

      return updated;
    });
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    if (!isOpen) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
      return;
    }

    updateStats();
    intervalRef.current = setInterval(updateStats, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    };
  }, [isOpen, updateStats]);

  const handleClearChannels = async () => {
    const channels = supabase.getChannels();
    for (const channel of channels) {
      await supabase.removeChannel(channel);
    }

    setHistory([]);
    setHasLeak(false);
    updateStats();
  };

  if (!import.meta.env.DEV) {
    return null;
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-20 right-4 text-white p-3 rounded-full shadow-lg hover:opacity-90 transition-colors z-50 ${
          hasLeak ? 'bg-red-600 animate-pulse' : 'bg-gray-600'
        }`}
        title="Abrir Monitor de Conexoes Supabase"
      >
        <Database className="w-5 h-5" />
      </button>
    );
  }

  const maxChannels = Math.max(...history.map(h => h.activeChannels), 1);

  return (
    <div className="fixed bottom-20 right-4 bg-white rounded-lg shadow-2xl border border-gray-200 w-96 max-h-[500px] overflow-hidden z-50 flex flex-col">
      <div className={`text-white px-4 py-3 flex items-center justify-between ${
        hasLeak ? 'bg-red-600' : 'bg-gray-600'
      }`}>
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5" />
          <h3 className="font-semibold">Supabase Connections</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={updateStats}
            className="p-1 hover:bg-white/20 rounded"
            title="Atualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-white/20 rounded"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto flex-1">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Channels Ativos</span>
            {hasLeak ? (
              <AlertTriangle className="w-5 h-5 text-red-600" />
            ) : (
              <CheckCircle className="w-5 h-5 text-green-600" />
            )}
          </div>
          <div className={`text-3xl font-bold ${
            hasLeak ? 'text-red-600' : stats.activeChannels > 0 ? 'text-yellow-600' : 'text-green-600'
          }`}>
            {stats.activeChannels}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {stats.activeChannels === 0 ? 'Nenhuma conexao ativa' : `${stats.activeChannels} conexao${stats.activeChannels > 1 ? 'es' : ''} ativa${stats.activeChannels > 1 ? 's' : ''}`}
          </div>
        </div>

        {hasLeak && (
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-red-700 font-semibold mb-2">
              <AlertTriangle className="w-5 h-5" />
              <span>Memory Leak Detectado!</span>
            </div>
            <p className="text-sm text-red-600">
              O numero de channels cresceu significativamente. Verifique se ha subscriptions sem cleanup adequado.
            </p>
          </div>
        )}

        {history.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-2 text-gray-700">
              Historico (ultimas {history.length} medicoes)
            </h4>
            <div className="bg-gray-50 rounded p-3 h-32 overflow-hidden relative">
              <svg className="w-full h-full">
                <polyline
                  fill="none"
                  stroke={hasLeak ? '#dc2626' : '#4b5563'}
                  strokeWidth="2"
                  points={history.map((stat, index) => {
                    const x = (index / Math.max(history.length - 1, 1)) * 100;
                    const y = 100 - (stat.activeChannels / maxChannels) * 90;
                    return `${x}%,${y}%`;
                  }).join(' ')}
                />
              </svg>
            </div>
          </div>
        )}

        {stats.activeChannels > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-2 text-gray-700">
              Channels Detalhados
            </h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {supabase.getChannels().map((channel, index) => (
                <div key={index} className="bg-gray-50 border border-gray-200 rounded p-2 text-xs">
                  <div className="font-medium text-gray-900">
                    {channel.topic || 'Unknown'}
                  </div>
                  <div className="text-gray-600 mt-1">
                    Estado: {channel.state}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <button
            onClick={handleClearChannels}
            disabled={stats.activeChannels === 0}
            className={`w-full py-2 rounded font-medium text-sm transition-colors ${
              stats.activeChannels === 0
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            Limpar Todos os Channels ({stats.activeChannels})
          </button>
          <button
            onClick={() => {
              setHistory([]);
              setHasLeak(false);
            }}
            className="w-full bg-gray-200 text-gray-700 py-2 rounded hover:bg-gray-300 text-sm font-medium"
          >
            Resetar Historico
          </button>
        </div>
      </div>

      <div className="bg-gray-50 px-4 py-2 border-t border-gray-200 text-xs text-gray-600">
        Development only - Updates every 5s when open
      </div>
    </div>
  );
}
