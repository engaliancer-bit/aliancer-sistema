/**
 * Memory Leak Detector - DEV ONLY
 * Detecta vazamentos de timers, listeners e channels em tempo real
 */

interface LeakStats {
  intervals: Set<number>;
  timeouts: Set<number>;
  listeners: Map<string, number>;
  realtimeChannels: Set<string>;
  lastCheck: number;
  requestCount: number;
}

class LeakDetector {
  private stats: LeakStats = {
    intervals: new Set(),
    timeouts: new Set(),
    listeners: new Map(),
    realtimeChannels: new Set(),
    lastCheck: Date.now(),
    requestCount: 0
  };

  private originalSetInterval = window.setInterval;
  private originalSetTimeout = window.setTimeout;
  private originalClearInterval = window.clearInterval;
  private originalClearTimeout = window.clearTimeout;
  private originalAddEventListener = window.addEventListener.bind(window);
  private originalRemoveEventListener = window.removeEventListener.bind(window);
  private monitorInterval?: number;

  constructor() {
    if (import.meta.env.PROD) return;
    this.instrumentTimers();
    this.instrumentListeners();
    this.startMonitoring();
  }

  private instrumentTimers() {
    // Interceptar setInterval
    window.setInterval = ((fn: any, delay?: number) => {
      const id = this.originalSetInterval(fn, delay);
      this.stats.intervals.add(id);
      return id;
    }) as any;

    // Interceptar setTimeout
    window.setTimeout = ((fn: any, delay?: number) => {
      const id = this.originalSetTimeout(fn, delay);
      this.stats.timeouts.add(id);
      return id;
    }) as any;

    // Interceptar clearInterval
    window.clearInterval = (id?: number) => {
      if (id) this.stats.intervals.delete(id);
      this.originalClearInterval(id);
    };

    // Interceptar clearTimeout
    window.clearTimeout = (id?: number) => {
      if (id) this.stats.timeouts.delete(id);
      this.originalClearTimeout(id);
    };
  }

  private instrumentListeners() {
    // Interceptar addEventListener
    window.addEventListener = ((
      type: string,
      listener: any,
      options?: any
    ) => {
      const count = this.stats.listeners.get(type) || 0;
      this.stats.listeners.set(type, count + 1);
      this.originalAddEventListener(type, listener, options);
    }) as any;

    // Interceptar removeEventListener
    window.removeEventListener = ((
      type: string,
      listener: any,
      options?: any
    ) => {
      const count = this.stats.listeners.get(type) || 0;
      if (count > 0) {
        this.stats.listeners.set(type, count - 1);
      }
      this.originalRemoveEventListener(type, listener, options);
    }) as any;
  }

  private startMonitoring() {
    // Log a cada 10 segundos
    this.monitorInterval = this.originalSetInterval(() => {
      const now = Date.now();
      const elapsed = (now - this.stats.lastCheck) / 1000;

      console.group('🔍 Memory Leak Detector');

      // Timers ativos
      console.log('⏰ Active Intervals:', this.stats.intervals.size);
      console.log('⏱️  Active Timeouts:', this.stats.timeouts.size);

      // Listeners ativos
      const totalListeners = Array.from(this.stats.listeners.values())
        .reduce((sum, count) => sum + count, 0);
      console.log('👂 Active Listeners:', totalListeners);
      if (totalListeners > 0) {
        console.table(Object.fromEntries(this.stats.listeners));
      }

      // Alertas
      if (this.stats.intervals.size > 10) {
        console.warn('⚠️  ALERTA: Muitos intervals ativos! Possível memory leak.');
      }
      if (totalListeners > 50) {
        console.warn('⚠️  ALERTA: Muitos listeners ativos! Possível memory leak.');
      }

      console.log(`📊 Elapsed: ${elapsed.toFixed(1)}s`);
      console.groupEnd();

      this.stats.lastCheck = now;
    }, 10000);
  }

  public get realtimeChannels(): Set<string> {
    return this.stats.realtimeChannels;
  }

  public getStats() {
    return {
      intervals: this.stats.intervals.size,
      timeouts: this.stats.timeouts.size,
      listeners: Object.fromEntries(this.stats.listeners),
      totalListeners: Array.from(this.stats.listeners.values())
        .reduce((sum, count) => sum + count, 0)
    };
  }

  public destroy() {
    if (this.monitorInterval) {
      this.originalClearInterval(this.monitorInterval);
    }
  }
}

// Instância global (apenas em DEV)
export const leakDetector = import.meta.env.PROD ? null : new LeakDetector();

// Expor no console
if (!import.meta.env.PROD) {
  (window as any).__leakDetector = leakDetector;
}

// Wire leak stats into performanceMonitor so generateReport() can include them.
// Import is deferred to avoid circular-dependency issues at module load time.
if (!import.meta.env.PROD && leakDetector) {
  import('./performanceMonitor').then(({ setLeakStatsProvider }) => {
    setLeakStatsProvider(() => {
      const s = leakDetector!.getStats();
      return {
        intervals: s.intervals,
        timeouts: s.timeouts,
        totalListeners: s.totalListeners,
        realtimeChannelsTracked: leakDetector!.realtimeChannels?.size ?? 0,
      };
    });
  });
}
