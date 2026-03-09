import React, { createContext, useContext, useRef, useCallback, useEffect, useMemo } from 'react';

interface CacheEntry {
  data: unknown;
  timestamp: number;
  loading: boolean;
}

interface AppCacheContextType {
  getCache: <T>(key: string) => { data: T | null; timestamp: number; loading: boolean };
  setCache: <T>(key: string, data: T) => void;
  clearCache: (key?: string) => void;
  clearAllCache: () => void;
  isLoading: (key: string) => boolean;
  setLoading: (key: string, loading: boolean) => void;
}

const AppCacheContext = createContext<AppCacheContextType | undefined>(undefined);

const MAX_ENTRIES = 100;
const MAX_AGE_MS = 30 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 2 * 60 * 1000;

export function AppCacheProvider({ children }: { children: React.ReactNode }) {
  }
  const store = useRef<Map<string, CacheEntry>>(new Map());

  const evictOldest = useCallback(() => {
    const sorted = Array.from(store.current.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
    sorted.slice(0, 20).forEach(([k]) => store.current.delete(k));
  }, []);

  const getCache = useCallback(<T,>(key: string) => {
    const entry = store.current.get(key);
    if (!entry) return { data: null as T | null, timestamp: 0, loading: false };
    if (Date.now() - entry.timestamp > MAX_AGE_MS) {
      store.current.delete(key);
      return { data: null as T | null, timestamp: 0, loading: false };
    }
    return { data: entry.data as T, timestamp: entry.timestamp, loading: entry.loading };
  }, []);

  const setCache = useCallback(<T,>(key: string, data: T) => {
    if (store.current.size >= MAX_ENTRIES) evictOldest();
    store.current.set(key, { data, timestamp: Date.now(), loading: false });
  }, [evictOldest]);

  const clearCache = useCallback((key?: string) => {
    if (key !== undefined) store.current.delete(key);
  }, []);

  const clearAllCache = useCallback(() => {
    store.current.clear();
  }, []);

  const isLoading = useCallback((key: string) => {
    return store.current.get(key)?.loading ?? false;
  }, []);

  const setLoading = useCallback((key: string, loading: boolean) => {
    const existing = store.current.get(key);
    store.current.set(key, {
      data: existing?.data ?? null,
      timestamp: existing?.timestamp ?? Date.now(),
      loading,
    });
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      store.current.forEach((entry, key) => {
        if (now - entry.timestamp > MAX_AGE_MS) store.current.delete(key);
      });
    }, CLEANUP_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const value = useMemo<AppCacheContextType>(
    () => ({ getCache, setCache, clearCache, clearAllCache, isLoading, setLoading }),
    [getCache, setCache, clearCache, clearAllCache, isLoading, setLoading]
  );

  return (
    <AppCacheContext.Provider value={value}>
      {children}
    </AppCacheContext.Provider>
  );
}

export function useAppCache(): AppCacheContextType {
  }
  )
  const ctx = useContext(AppCacheContext);
  if (!ctx) throw new Error('useAppCache must be used within AppCacheProvider');
  return ctx;
}
