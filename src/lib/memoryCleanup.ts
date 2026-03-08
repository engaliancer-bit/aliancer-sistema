import { supabase } from './supabase';

class MemoryCleanupManager {
  private static instance: MemoryCleanupManager;
  private abortControllers: Set<AbortController> = new Set();
  private timeouts: Set<number> = new Set();
  private intervals: Set<number> = new Set();
  private listeners: Map<string, (() => void)[]> = new Map();

  private constructor() {}

  static getInstance(): MemoryCleanupManager {
    if (!MemoryCleanupManager.instance) {
      MemoryCleanupManager.instance = new MemoryCleanupManager();
    }
    return MemoryCleanupManager.instance;
  }

  registerAbortController(controller: AbortController): void {
    this.abortControllers.add(controller);
  }

  unregisterAbortController(controller: AbortController): void {
    this.abortControllers.delete(controller);
  }

  registerTimeout(timeoutId: number): void {
    this.timeouts.add(timeoutId);
  }

  unregisterTimeout(timeoutId: number): void {
    this.timeouts.delete(timeoutId);
  }

  registerInterval(intervalId: number): void {
    this.intervals.add(intervalId);
  }

  unregisterInterval(intervalId: number): void {
    this.intervals.delete(intervalId);
  }

  addEventListener(event: string, callback: () => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  removeEventListener(event: string, callback: () => void): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  async cleanupAll(): Promise<void> {
    console.log('[MemoryCleanup] Starting complete memory cleanup...');

    this.abortControllers.forEach(controller => {
      try {
        controller.abort();
      } catch (error) {
        console.error('[MemoryCleanup] Error aborting controller:', error);
      }
    });
    this.abortControllers.clear();

    this.timeouts.forEach(timeoutId => {
      try {
        clearTimeout(timeoutId);
      } catch (error) {
        console.error('[MemoryCleanup] Error clearing timeout:', error);
      }
    });
    this.timeouts.clear();

    this.intervals.forEach(intervalId => {
      try {
        clearInterval(intervalId);
      } catch (error) {
        console.error('[MemoryCleanup] Error clearing interval:', error);
      }
    });
    this.intervals.clear();

    try {
      const channel = supabase.getChannels();
      if (channel && channel.length > 0) {
        await supabase.removeAllChannels();
        console.log('[MemoryCleanup] Removed all Supabase channels');
      }
    } catch (error) {
      console.error('[MemoryCleanup] Error removing Supabase channels:', error);
    }

    this.listeners.clear();

    if (typeof window !== 'undefined') {
      try {
        sessionStorage.clear();
        console.log('[MemoryCleanup] Cleared sessionStorage');
      } catch (error) {
        console.error('[MemoryCleanup] Error clearing sessionStorage:', error);
      }
    }

    if (typeof global !== 'undefined' && global.gc) {
      try {
        global.gc();
        console.log('[MemoryCleanup] Triggered garbage collection');
      } catch (error) {
        console.error('[MemoryCleanup] Error triggering garbage collection:', error);
      }
    }

    console.log('[MemoryCleanup] Memory cleanup completed');
  }

  async cleanupOnLogout(): Promise<void> {
    console.log('[MemoryCleanup] Cleanup on logout initiated...');

    await this.cleanupAll();

    try {
      await supabase.auth.signOut();
      console.log('[MemoryCleanup] User signed out');
    } catch (error) {
      console.error('[MemoryCleanup] Error during sign out:', error);
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('supabase.auth.token');
        console.log('[MemoryCleanup] Cleared auth token from localStorage');
      } catch (error) {
        console.error('[MemoryCleanup] Error clearing localStorage:', error);
      }
    }

    console.log('[MemoryCleanup] Logout cleanup completed');
  }

  getStats(): {
    abortControllers: number;
    timeouts: number;
    intervals: number;
    listeners: number;
  } {
    return {
      abortControllers: this.abortControllers.size,
      timeouts: this.timeouts.size,
      intervals: this.intervals.size,
      listeners: Array.from(this.listeners.values()).reduce(
        (sum, arr) => sum + arr.length,
        0
      ),
    };
  }
}

export const memoryCleanup = MemoryCleanupManager.getInstance();

export function setupMemoryCleanup() {
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      memoryCleanup.cleanupAll();
    });

    const originalSetTimeout = window.setTimeout;
    window.setTimeout = function(callback: any, delay?: number, ...args: any[]) {
      const timeoutId = originalSetTimeout(callback, delay, ...args);
      memoryCleanup.registerTimeout(timeoutId);
      return timeoutId;
    } as typeof setTimeout;

    const originalClearTimeout = window.clearTimeout;
    window.clearTimeout = function(timeoutId: number) {
      memoryCleanup.unregisterTimeout(timeoutId);
      originalClearTimeout(timeoutId);
    };

    const originalSetInterval = window.setInterval;
    window.setInterval = function(callback: any, delay?: number, ...args: any[]) {
      const intervalId = originalSetInterval(callback, delay, ...args);
      memoryCleanup.registerInterval(intervalId);
      return intervalId;
    } as typeof setInterval;

    const originalClearInterval = window.clearInterval;
    window.clearInterval = function(intervalId: number) {
      memoryCleanup.unregisterInterval(intervalId);
      originalClearInterval(intervalId);
    };

    console.log('[MemoryCleanup] Memory cleanup system initialized');
  }
}

export function useMemoryCleanup() {
  return {
    cleanup: () => memoryCleanup.cleanupAll(),
    cleanupOnLogout: () => memoryCleanup.cleanupOnLogout(),
    getStats: () => memoryCleanup.getStats(),
  };
}

export const globalMemoryCleanup = {
  runCleanup: async () => {
    try {
      const stats = memoryCleanup.getStats();

      if (stats.abortControllers > 10 || stats.timeouts > 20 || stats.intervals > 5) {
        console.log('[GlobalCleanup] High resource usage detected, running cleanup...', stats);
        await memoryCleanup.cleanupAll();
      } else {
        console.log('[GlobalCleanup] Periodic light cleanup', stats);

        if (typeof window !== 'undefined' && 'caches' in window) {
          try {
            const cacheNames = await caches.keys();
            for (const cacheName of cacheNames) {
              if (cacheName.includes('temp') || cacheName.includes('runtime')) {
                await caches.delete(cacheName);
              }
            }
          } catch (e) {
            // Silent fail for cache cleanup
          }
        }
      }

      if (typeof window !== 'undefined' && 'performance' in window && 'memory' in (performance as any)) {
        const memory = (performance as any).memory;
        const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
        const limitMB = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);

        if (usedMB > limitMB * 0.7) {
          console.warn('[GlobalCleanup] High memory usage:', usedMB, 'MB of', limitMB, 'MB');
          await memoryCleanup.cleanupAll();
        }
      }
    } catch (error) {
      console.error('[GlobalCleanup] Error during cleanup:', error);
    }
  },

  forceCleanup: async () => {
    console.log('[GlobalCleanup] Force cleanup initiated');
    await memoryCleanup.cleanupAll();
  },

  getMemoryInfo: () => {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in (performance as any)) {
      const memory = (performance as any).memory;
      return {
        usedMB: Math.round(memory.usedJSHeapSize / 1024 / 1024),
        totalMB: Math.round(memory.totalJSHeapSize / 1024 / 1024),
        limitMB: Math.round(memory.jsHeapSizeLimit / 1024 / 1024),
        usagePercent: Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100)
      };
    }
    return null;
  }
};
