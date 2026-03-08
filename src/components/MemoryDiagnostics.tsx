import { useState, useEffect } from 'react';
import { Activity, AlertTriangle, TrendingUp, X } from 'lucide-react';

interface MemorySnapshot {
  timestamp: number;
  used: number;
  total: number;
  components: Map<string, number>;
}

interface ComponentMemoryInfo {
  name: string;
  mountCount: number;
  unmountCount: number;
  lastMemory: number;
  leakSuspect: boolean;
}

class MemoryTracker {
  private static instance: MemoryTracker;
  private snapshots: MemorySnapshot[] = [];
  private components = new Map<string, ComponentMemoryInfo>();
  private listeners = new Set<() => void>();

  static getInstance() {
    if (!MemoryTracker.instance) {
      MemoryTracker.instance = new MemoryTracker();
    }
    return MemoryTracker.instance;
  }

  registerComponent(name: string) {
    const existing = this.components.get(name) || {
      name,
      mountCount: 0,
      unmountCount: 0,
      lastMemory: 0,
      leakSuspect: false
    };

    existing.mountCount++;
    this.components.set(name, existing);
    this.notifyListeners();
  }

  unregisterComponent(name: string) {
    const existing = this.components.get(name);
    if (existing) {
      existing.unmountCount++;

      // Detectar possível leak: mais montagens que desmontagens
      if (existing.mountCount - existing.unmountCount > 5) {
        existing.leakSuspect = true;
      }

      this.components.set(name, existing);
      this.notifyListeners();
    }
  }

  takeSnapshot() {
    const perf = performance as any;
    if (perf.memory) {
      const snapshot: MemorySnapshot = {
        timestamp: Date.now(),
        used: Math.round(perf.memory.usedJSHeapSize / 1048576),
        total: Math.round(perf.memory.totalJSHeapSize / 1048576),
        components: new Map(this.components)
      };

      this.snapshots.push(snapshot);

      // Manter apenas últimos 50 snapshots
      if (this.snapshots.length > 50) {
        this.snapshots.shift();
      }

      this.notifyListeners();
    }
  }

  getSnapshots() {
    return this.snapshots;
  }

  getComponents() {
    return Array.from(this.components.values());
  }

  detectLeaks() {
    const leaks: string[] = [];

    // Verificar crescimento de memória
    if (this.snapshots.length >= 10) {
      const first = this.snapshots[0];
      const last = this.snapshots[this.snapshots.length - 1];
      const growth = last.used - first.used;
      const growthPercent = (growth / first.used) * 100;

      if (growthPercent > 50) {
        leaks.push(`Crescimento de memória: ${growth}MB (${growthPercent.toFixed(1)}%)`);
      }
    }

    // Verificar componentes suspeitos
    this.components.forEach((info) => {
      if (info.leakSuspect) {
        leaks.push(`${info.name}: ${info.mountCount} montagens, ${info.unmountCount} desmontagens`);
      }
    });

    return leaks;
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  reset() {
    this.snapshots = [];
    this.components.clear();
    this.notifyListeners();
  }
}

export const useMemoryTracking = (componentName: string) => {
  useEffect(() => {
    const tracker = MemoryTracker.getInstance();
    tracker.registerComponent(componentName);

    return () => {
      tracker.unregisterComponent(componentName);
    };
  }, [componentName]);
};

export default function MemoryDiagnostics() {
  const [isOpen, setIsOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<MemorySnapshot[]>([]);
  const [components, setComponents] = useState<ComponentMemoryInfo[]>([]);
  const [leaks, setLeaks] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    const tracker = MemoryTracker.getInstance();

    const update = () => {
      setSnapshots(tracker.getSnapshots());
      setComponents(tracker.getComponents());
      setLeaks(tracker.detectLeaks());
    };

    tracker.takeSnapshot();
    update();

    const interval = setInterval(() => {
      tracker.takeSnapshot();
      update();
    }, 5000);

    const unsubscribe = tracker.subscribe(update);

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [isOpen]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 z-50"
        title="Abrir diagnóstico de memória"
      >
        <Activity className="w-6 h-6" />
      </button>
    );
  }

  const latestSnapshot = snapshots[snapshots.length - 1];
  const firstSnapshot = snapshots[0];
  const memoryGrowth = latestSnapshot && firstSnapshot
    ? latestSnapshot.used - firstSnapshot.used
    : 0;

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-2xl border-2 border-blue-500 z-50 w-96 max-h-96 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-blue-600 text-white p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          <h3 className="font-bold">Diagnóstico de Memória</h3>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="hover:bg-blue-700 rounded p-1"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 overflow-y-auto flex-1">
        {/* Memória Atual */}
        {latestSnapshot && (
          <div className="mb-4">
            <h4 className="font-semibold text-gray-700 mb-2">Memória Atual</h4>
            <div className="bg-gray-50 p-3 rounded">
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600">Usado:</span>
                <span className="font-mono font-bold">{latestSnapshot.used}MB</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600">Total:</span>
                <span className="font-mono">{latestSnapshot.total}MB</span>
              </div>
              {memoryGrowth !== 0 && (
                <div className="flex justify-between items-center mt-2 pt-2 border-t">
                  <span className="text-sm text-gray-600">Crescimento:</span>
                  <span className={`font-mono font-bold flex items-center gap-1 ${
                    memoryGrowth > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {memoryGrowth > 0 && <TrendingUp className="w-4 h-4" />}
                    {memoryGrowth > 0 ? '+' : ''}{memoryGrowth}MB
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Alertas de Memory Leak */}
        {leaks.length > 0 && (
          <div className="mb-4">
            <h4 className="font-semibold text-red-600 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Possíveis Memory Leaks
            </h4>
            <div className="bg-red-50 border border-red-200 rounded p-3">
              {leaks.map((leak, index) => (
                <div key={index} className="text-sm text-red-700 mb-1">
                  • {leak}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Componentes Montados */}
        {components.length > 0 && (
          <div className="mb-4">
            <h4 className="font-semibold text-gray-700 mb-2">
              Componentes Ativos ({components.length})
            </h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {components
                .sort((a, b) => (b.mountCount - b.unmountCount) - (a.mountCount - a.unmountCount))
                .slice(0, 10)
                .map((comp) => {
                  const active = comp.mountCount - comp.unmountCount;
                  return (
                    <div
                      key={comp.name}
                      className={`bg-gray-50 p-2 rounded text-xs ${
                        comp.leakSuspect ? 'border-2 border-red-300' : ''
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium truncate flex-1">{comp.name}</span>
                        <span className={`font-mono ml-2 ${
                          active > 1 ? 'text-red-600 font-bold' : 'text-gray-600'
                        }`}>
                          {active > 0 ? `${active} ativo${active > 1 ? 's' : ''}` : 'OK'}
                        </span>
                      </div>
                      <div className="text-gray-500 mt-1">
                        Mount: {comp.mountCount} | Unmount: {comp.unmountCount}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Botão Reset */}
        <button
          onClick={() => {
            MemoryTracker.getInstance().reset();
            setSnapshots([]);
            setComponents([]);
            setLeaks([]);
          }}
          className="w-full bg-gray-200 text-gray-700 py-2 rounded hover:bg-gray-300 text-sm font-medium"
        >
          Resetar Dados
        </button>
      </div>
    </div>
  );
}

export { MemoryTracker };
