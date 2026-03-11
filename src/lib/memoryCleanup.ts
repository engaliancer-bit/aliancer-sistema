import { cacheManager } from './cacheManager';
import { cleanupStaleRequests } from './requestCancellation';

const MIN_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

interface CleanupStats {
  registeredCallbacks: number;
  lastCleanupDuration: number;
  lastCleanupAt: number | null;
  cleanupCount: number;
  cacheSize: number;
}

class GlobalMemoryCleanup {
  private callbacks: Map<string, () => void> = new Map();
  private lastRunAt: number = 0;
  private stats: CleanupStats = {
    registeredCallbacks: 0,
    lastCleanupDuration: 0,
    lastCleanupAt: null,
    cleanupCount: 0,
    cacheSize: 0,
  };

  register(key: string, callback: () => void): () => void {
    this.callbacks.set(key, callback);
    this.stats.registeredCallbacks = this.callbacks.size;
    return () => {
      this.callbacks.delete(key);
      this.stats.registeredCallbacks = this.callbacks.size;
    };
  }

  runCleanup(force = false): void {
    const now = Date.now();
    if (!force && now - this.lastRunAt < MIN_CLEANUP_INTERVAL_MS) return;

    const run = () => {
      const start = performance.now();
      try {
        cacheManager.cleanup();
        cleanupStaleRequests();
        this.callbacks.forEach((cb, key) => {
          try {
            cb();
          } catch (e) {
            console.warn(`[MemoryCleanup] Erro no callback "${key}":`, e);
          }
        });
      } catch (e) {
        console.warn('[MemoryCleanup] Erro durante cleanup:', e);
      }

      const duration = performance.now() - start;
      this.lastRunAt = Date.now();
      this.stats.lastCleanupDuration = duration;
      this.stats.lastCleanupAt = this.lastRunAt;
      this.stats.cleanupCount += 1;
      this.stats.registeredCallbacks = this.callbacks.size;
      this.stats.cacheSize = cacheManager.getStats().size;

      if (import.meta.env.DEV) {
        console.debug(
          `[MemoryCleanup] #${this.stats.cleanupCount} | callbacks: ${this.stats.registeredCallbacks} | duração: ${duration.toFixed(1)}ms | cache: ${this.stats.cacheSize} entradas`
        );
      }
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(run, { timeout: 2000 });
    } else {
      setTimeout(run, 0);
    }
  }

  getStats(): Readonly<CleanupStats> {
    return { ...this.stats };
  }

  cleanupAll(): Promise<void> {
    this.runCleanup(true);
    return Promise.resolve();
  }

  cleanupOnLogout(): Promise<void> {
    return this.cleanupAll();
  }
}

export const globalMemoryCleanup = new GlobalMemoryCleanup();

export function setupMemoryCleanup(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeunload', () => {
    globalMemoryCleanup.runCleanup(true);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      globalMemoryCleanup.runCleanup();
    }
  });
}
