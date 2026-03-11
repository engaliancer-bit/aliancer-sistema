import { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, TrendingUp, AlertTriangle, CheckCircle, X, RefreshCw, Zap } from 'lucide-react';

interface MemorySnapshot {
  timestamp: number;
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface MemoryStats {
  current: number;
  max: number;
  min: number;
  average: number;
  trend: 'stable' | 'increasing' | 'decreasing' | 'leak';
  growthRate: number;
}

export default function MemoryLeakMonitor() {
  const [isOpen, setIsOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<MemorySnapshot[]>([]);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [hasLeak, setHasLeak] = useState(false);
  const [leakWarning, setLeakWarning] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const snapshotsRef = useRef<MemorySnapshot[]>([]);

  const analyzeSnapshots = useCallback((currentSnapshots: MemorySnapshot[]) => {
    if (currentSnapshots.length < 10) return;

    const usedMemoryMB = currentSnapshots.map(s => s.usedJSHeapSize / 1048576);
    const currentMB = usedMemoryMB[usedMemoryMB.length - 1];
    const maxMB = Math.max(...usedMemoryMB);
    const minMB = Math.min(...usedMemoryMB);
    const avgMB = usedMemoryMB.reduce((a, b) => a + b, 0) / usedMemoryMB.length;

    const timeSpanMinutes = (currentSnapshots[currentSnapshots.length - 1].timestamp - currentSnapshots[0].timestamp) / 60000;
    const memoryGrowthMB = currentMB - usedMemoryMB[0];
    const growthRate = timeSpanMinutes > 0 ? memoryGrowthMB / timeSpanMinutes : 0;

    let trend: 'stable' | 'increasing' | 'decreasing' | 'leak' = 'stable';

    if (currentSnapshots.length >= 20) {
      const recentAvg = usedMemoryMB.slice(-10).reduce((a, b) => a + b, 0) / 10;
      const olderAvg = usedMemoryMB.slice(-20, -10).reduce((a, b) => a + b, 0) / 10;
      const diff = recentAvg - olderAvg;

      if (diff > 10) {
        trend = 'leak';
        setHasLeak(true);
        setLeakWarning(`Memory leak detectado! Crescimento de ${diff.toFixed(1)}MB`);
      } else if (diff > 3) {
        trend = 'increasing';
        if (growthRate > 10) {
          setHasLeak(true);
          setLeakWarning(`Crescimento rapido: ${growthRate.toFixed(1)}MB/min`);
        } else {
          setHasLeak(false);
        }
      } else if (diff < -3) {
        trend = 'decreasing';
        setHasLeak(false);
      } else {
        trend = 'stable';
        setHasLeak(false);
      }
    }

    setStats({ current: currentMB, max: maxMB, min: minMB, average: avgMB, trend, growthRate });
  }, []);

  const checkMemory = useCallback(() => {
    if (!(performance as any).memory) return;

    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
      totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
      jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
    };

    snapshotsRef.current.push(snapshot);
    if (snapshotsRef.current.length > 100) {
      snapshotsRef.current.shift();
    }

    setSnapshots([...snapshotsRef.current]);
    analyzeSnapshots(snapshotsRef.current);
  }, [analyzeSnapshots]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    if (!isOpen) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    checkMemory();
    intervalRef.current = setInterval(checkMemory, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isOpen, checkMemory]);

  const handleForceGC = () => {
    if ((window as any).gc) {
      console.log('Forcando Garbage Collection...');
      (window as any).gc();
      console.log('GC executado');
    } else {
      alert('Garbage Collection nao disponivel. Inicie Chrome com --js-flags="--expose-gc"');
    }
  };

  const handleClearSnapshots = () => {
    snapshotsRef.current = [];
    setSnapshots([]);
    setHasLeak(false);
    setLeakWarning('');
    setStats(null);
  };

  if (!import.meta.env.DEV) {
    return null;
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-36 right-4 text-white p-3 rounded-full shadow-lg hover:opacity-90 transition-all z-50 ${
          hasLeak ? 'bg-red-600 animate-pulse' : 'bg-green-600'
        }`}
        title="Abrir Monitor de Memory Leak"
      >
        <Activity className="w-5 h-5" />
      </button>
    );
  }

  const maxMemory = Math.max(...snapshots.map(s => s.usedJSHeapSize), 1);
  const limitMB = snapshots[0]?.jsHeapSizeLimit / 1048576 || 2048;

  return (
    <div className="fixed bottom-36 right-4 bg-white rounded-lg shadow-2xl border-2 border-gray-200 w-[420px] max-h-[600px] overflow-hidden z-50 flex flex-col">
      <div className={`text-white px-4 py-3 flex items-center justify-between ${
        hasLeak ? 'bg-red-600' : stats?.trend === 'increasing' ? 'bg-yellow-600' : 'bg-green-600'
      }`}>
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          <h3 className="font-semibold">Memory Leak Monitor</h3>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 hover:bg-white/20 rounded"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto flex-1">
        {stats && (
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-lg p-3 ${
              hasLeak ? 'bg-red-50 border-2 border-red-200' : 'bg-gray-50 border border-gray-200'
            }`}>
              <div className="flex items-center gap-2 text-gray-600 text-xs mb-1">
                <Activity className="w-3 h-3" />
                <span>Atual</span>
              </div>
              <div className={`text-2xl font-bold ${hasLeak ? 'text-red-600' : 'text-gray-900'}`}>
                {stats.current.toFixed(1)}
                <span className="text-sm ml-1">MB</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                de {limitMB.toFixed(0)}MB limite
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-blue-600 text-xs mb-1">
                <TrendingUp className="w-3 h-3" />
                <span>Taxa Crescimento</span>
              </div>
              <div className={`text-2xl font-bold ${
                stats.growthRate > 10 ? 'text-red-600' : stats.growthRate > 3 ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {stats.growthRate > 0 ? '+' : ''}{stats.growthRate.toFixed(1)}
                <span className="text-sm ml-1">MB/min</span>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">Media</div>
              <div className="text-xl font-bold text-gray-700">
                {stats.average.toFixed(1)} MB
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="text-xs text-orange-600 mb-1">Maximo</div>
              <div className="text-xl font-bold text-orange-700">
                {stats.max.toFixed(1)} MB
              </div>
            </div>
          </div>
        )}

        {hasLeak && (
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-700 font-bold mb-2">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
              <span>MEMORY LEAK DETECTADO!</span>
            </div>
            <p className="text-sm text-red-600 mb-3">
              {leakWarning}
            </p>
            <div className="bg-red-100 rounded p-3 text-xs text-red-800 space-y-1">
              <div className="font-semibold">Possiveis causas:</div>
              <div>- Event listeners nao removidos</div>
              <div>- setInterval/setTimeout sem cleanup</div>
              <div>- Closures mantendo referencias</div>
              <div>- useEffect sem funcao de cleanup</div>
            </div>
          </div>
        )}

        {stats && !hasLeak && (
          <div className={`rounded-lg p-3 border-2 flex items-center gap-3 ${
            stats.trend === 'stable' ? 'bg-green-50 border-green-200' :
            stats.trend === 'decreasing' ? 'bg-blue-50 border-blue-200' :
            'bg-yellow-50 border-yellow-200'
          }`}>
            {stats.trend === 'stable' && <CheckCircle className="w-5 h-5 text-green-600" />}
            {stats.trend === 'decreasing' && <TrendingUp className="w-5 h-5 text-blue-600 transform rotate-180" />}
            {stats.trend === 'increasing' && <TrendingUp className="w-5 h-5 text-yellow-600" />}
            <div className="flex-1">
              <div className="font-semibold text-sm">
                {stats.trend === 'stable' && 'Memoria Estavel'}
                {stats.trend === 'decreasing' && 'Memoria Decrescendo'}
                {stats.trend === 'increasing' && 'Memoria Crescendo'}
              </div>
              <div className="text-xs text-gray-600 mt-0.5">
                {stats.trend === 'stable' && 'Sistema funcionando corretamente'}
                {stats.trend === 'decreasing' && 'Garbage collector funcionando'}
                {stats.trend === 'increasing' && 'Monitorar continuamente'}
              </div>
            </div>
          </div>
        )}

        {snapshots.length > 1 && (
          <div>
            <h4 className="font-semibold text-sm mb-2 text-gray-700">
              Historico ({Math.floor(snapshots.length * 5 / 60)}min {snapshots.length * 5 % 60}s)
            </h4>
            <div className="bg-gray-50 rounded-lg p-4 h-40 relative border border-gray-200">
              <svg className="w-full h-full">
                <line
                  x1="0"
                  y1="10%"
                  x2="100%"
                  y2="10%"
                  stroke="#ef4444"
                  strokeWidth="1"
                  strokeDasharray="4"
                  opacity="0.3"
                />
                <polyline
                  fill="none"
                  stroke={hasLeak ? '#dc2626' : stats?.trend === 'increasing' ? '#eab308' : '#10b981'}
                  strokeWidth="2"
                  points={snapshots.map((snapshot, index) => {
                    const x = (index / (snapshots.length - 1)) * 100;
                    const y = 100 - ((snapshot.usedJSHeapSize / maxMemory) * 80 + 10);
                    return `${x}%,${y}%`;
                  }).join(' ')}
                />
              </svg>
              <div className="absolute top-1 right-2 text-xs text-red-500 opacity-60">
                Limite: {limitMB.toFixed(0)}MB
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {typeof (window as any).gc === 'function' && (
            <button
              onClick={handleForceGC}
              className="w-full bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 transition-colors font-medium text-sm flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Forcar Garbage Collection
            </button>
          )}
          <button
            onClick={handleClearSnapshots}
            className="w-full bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Resetar Historico
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
          <div className="font-semibold mb-1">Dicas:</div>
          <div>- Memoria estavel: 50-70MB e normal</div>
          <div>- Taxa crescimento: &lt;3MB/min e aceitavel</div>
          <div>- Crescimento &gt;10MB/min indica leak</div>
        </div>
      </div>

      <div className="bg-gray-50 px-4 py-2 border-t border-gray-200 text-xs text-gray-600">
        Development only - Updates every 5s when open - {snapshots.length} snapshots
      </div>
    </div>
  );
}
