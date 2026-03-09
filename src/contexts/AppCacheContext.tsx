import React, { createContext, useContext, useCallback, useRef, useEffect, useMemo } from 'react';

interface CachedData<T> {
  data: T | null;
  timestamp: number;
  loading: boolean;
}

interface AppCacheContextType {
  getCache: <T>(key: string) => CachedData<T>;
  setCache: <T>(key: string, data: T) => void;
  clearCache: (key?: string) => void;
  clearAllCache: () => void;
  isLoading: (key: string) => boolean;
  setLoading: (key: string, loading: boolean) => void;
}

const AppCacheContext = createContext<AppCacheContextType | undefined>(undefined);

const CACHE_DURATION = 5 * 60 * 1000;

export function AppCacheProvider({ children }: { children: React.ReactNode }) {
  const cacheRef = useRef<Map<string, CachedData<any>>>(new Map());

  const getCache = useCallback(<T,>(key: string): CachedData<T> => {
    const cached = cacheRef.current.get(key);

    if (!cached) {
      return { data: null, timestamp: 0, loading: false };
    }

    const isExpired = Date.now() - cached.timestamp > CACHE_DURATION;

    if (isExpired) {
      cacheRef.current.delete(key);
      return { data: null, timestamp: 0, loading: false };
    }

    return cached;
  }, []);

  const setCache = useCallback(<T,>(key: string, data: T) => {
    cacheRef.current.set(key, {
      data,
      timestamp: Date.now(),
      loading: false,
    });
  }, []);

  const setLoading = useCallback((key: string, loading: boolean) => {
    const existing = cacheRef.current.get(key);
    cacheRef.current.set(key, {
      data: existing?.data || null,
      timestamp: existing?.timestamp || Date.now(),
      loading,
    });
  }, []);

  const clearCache = useCallback((key?: string) => {
    if (key) {
      cacheRef.current.delete(key);
    }
  }, []);

  const clearAllCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  const isLoading = useCallback((key: string): boolean => {
    return cacheRef.current.get(key)?.loading || false;
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];

      cacheRef.current.forEach((value, key) => {
        if (now - value.timestamp > CACHE_DURATION) {
          keysToDelete.push(key);
        }
      });

      keysToDelete.forEach(key => cacheRef.current.delete(key));
    }, 120000);

    return () => clearInterval(interval);
  }, []);

  const value = useMemo<AppCacheContextType>(() => ({
    getCache,
    setCache,
    clearCache,
    clearAllCache,
    isLoading,
    setLoading,
  }), [getCache, setCache, clearCache, clearAllCache, isLoading, setLoading]);

  return (
    <AppCacheContext.Provider value={value}>
      {children}
    </AppCacheContext.Provider>
  );
}

export function useAppCache() {
  const context = useContext(AppCacheContext);
  if (!context) {
    throw new Error('useAppCache must be used within AppCacheProvider');
  }
  return context;
}
