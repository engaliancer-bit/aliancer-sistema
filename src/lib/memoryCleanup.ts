import { cacheManager } from './cacheManager';
import { cleanupStaleRequests } from './requestCancellation';

class GlobalMemoryCleanup {
  private cleanupCallbacks: Array<() => void> = [];

  register(callback: () => void): () => void {
    this.cleanupCallbacks.push(callback);
    return () => {
      this.cleanupCallbacks = this.cleanupCallbacks.filter(cb => cb !== callback);
    };
  }

  runCleanup(): void {
    try {
      cacheManager.cleanup();
      cleanupStaleRequests();
      this.cleanupCallbacks.forEach(cb => {
        try {
          cb();
        } catch {
        }
      });
    } catch {
    }
  }
}

export const globalMemoryCleanup = new GlobalMemoryCleanup();

export function setupMemoryCleanup(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeunload', () => {
    globalMemoryCleanup.runCleanup();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      globalMemoryCleanup.runCleanup();
    }
  });
}
