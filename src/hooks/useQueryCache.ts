import { useState, useEffect, useRef, useCallback } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface QueryMetrics {
  queryKey: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  fromCache: boolean;
  dataSize?: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();
const queryMetrics: QueryMetrics[] = [];
const MAX_METRICS = 100;
const MAX_CACHE_ENTRIES = 60;

const DEFAULT_CACHE_TIME = 5 * 60 * 1000;
const DEFAULT_STALE_TIME = 30 * 1000;

function evictOldestCacheEntries(): void {
  if (memoryCache.size <= MAX_CACHE_ENTRIES) return;

  const entries = Array.from(memoryCache.entries())
    .sort((a, b) => a[1].timestamp - b[1].timestamp);

  const toRemove = entries.slice(0, memoryCache.size - MAX_CACHE_ENTRIES);
  toRemove.forEach(([key]) => memoryCache.delete(key));
}

function getLocalStorageCache<T>(key: string): CacheEntry<T> | null {
  try {
    const item = localStorage.getItem(`cache_${key}`);
    if (item) {
      const parsed = JSON.parse(item);
      if (parsed.expiresAt > Date.now()) {
        return parsed;
      }
      localStorage.removeItem(`cache_${key}`);
    }
  } catch (error) {
    console.error('Error reading from localStorage cache:', error);
  }
  return null;
}

function setLocalStorageCache<T>(key: string, entry: CacheEntry<T>): void {
  try {
    localStorage.setItem(`cache_${key}`, JSON.stringify(entry));
  } catch (error) {
    console.error('Error writing to localStorage cache:', error);
  }
}

function removeLocalStorageCache(key: string): void {
  try {
    localStorage.removeItem(`cache_${key}`);
  } catch (error) {
    console.error('Error removing from localStorage cache:', error);
  }
}

function addMetric(metric: QueryMetrics): void {
  queryMetrics.push(metric);
  if (queryMetrics.length > MAX_METRICS) {
    queryMetrics.shift();
  }

  if (process.env.NODE_ENV === 'development' && metric.duration > 1000) {
    console.warn(
      `[Query Performance] Slow query detected: ${metric.queryKey} took ${metric.duration}ms`,
      metric
    );
  }
}

export interface UseQueryCacheOptions {
  cacheTime?: number;
  staleTime?: number;
  enabled?: boolean;
  persistToLocalStorage?: boolean;
  refetchOnMount?: boolean;
  refetchOnWindowFocus?: boolean;
  retry?: number;
  retryDelay?: number;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

export function useQueryCache<T>(
  queryKey: string,
  queryFn: () => Promise<T>,
  options: UseQueryCacheOptions = {}
) {
  const {
    cacheTime = DEFAULT_CACHE_TIME,
    staleTime = DEFAULT_STALE_TIME,
    enabled = true,
    persistToLocalStorage = false,
    refetchOnMount = false,
    refetchOnWindowFocus = false,
    retry = 0,
    retryDelay = 1000,
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const getCachedData = useCallback((): CacheEntry<T> | null => {
    const memoryCached = memoryCache.get(queryKey);
    const now = Date.now();

    if (memoryCached && memoryCached.expiresAt > now) {
      return memoryCached;
    }

    if (persistToLocalStorage) {
      const localCached = getLocalStorageCache<T>(queryKey);
      if (localCached) {
        memoryCache.set(queryKey, localCached);
        return localCached;
      }
    }

    return null;
  }, [queryKey, persistToLocalStorage]);

  const fetchData = useCallback(async (forceRefetch = false) => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const cached = getCachedData();
    const now = Date.now();
    const isStale = cached ? now - cached.timestamp > staleTime : true;

    if (cached && !forceRefetch && !isStale) {
      if (mountedRef.current) {
        setData(cached.data);
        setIsLoading(false);
        setIsFetching(false);
      }
      return;
    }

    if (cached && !forceRefetch) {
      if (mountedRef.current) {
        setData(cached.data);
        setIsLoading(false);
      }
    }

    abortControllerRef.current = new AbortController();
    const startTime = performance.now();

    try {
      setIsFetching(true);
      if (!cached) {
        setIsLoading(true);
      }
      setError(null);

      const result = await queryFn();

      if (mountedRef.current) {
        const endTime = performance.now();
        const duration = endTime - startTime;

        setData(result);
        setIsLoading(false);
        setIsFetching(false);

        const cacheEntry: CacheEntry<T> = {
          data: result,
          timestamp: now,
          expiresAt: now + cacheTime,
        };

        memoryCache.set(queryKey, cacheEntry);
        evictOldestCacheEntries();

        if (persistToLocalStorage) {
          setLocalStorageCache(queryKey, cacheEntry);
        }

        addMetric({
          queryKey,
          startTime,
          endTime,
          duration,
          success: true,
          fromCache: false,
          dataSize: JSON.stringify(result).length,
        });

        onSuccess?.(result);
        retryCountRef.current = 0;
      }
    } catch (err) {
      if (mountedRef.current && err instanceof Error && err.name !== 'AbortError') {
        const endTime = performance.now();
        const duration = endTime - startTime;

        setError(err);
        setIsLoading(false);
        setIsFetching(false);

        addMetric({
          queryKey,
          startTime,
          endTime,
          duration,
          success: false,
          fromCache: false,
        });

        onError?.(err);

        if (retryCountRef.current < retry) {
          retryCountRef.current++;
          setTimeout(() => {
            if (mountedRef.current) {
              fetchData(forceRefetch);
            }
          }, retryDelay * retryCountRef.current);
        }
      }
    }
  }, [
    enabled,
    queryKey,
    queryFn,
    cacheTime,
    staleTime,
    persistToLocalStorage,
    getCachedData,
    onSuccess,
    onError,
    retry,
    retryDelay,
  ]);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchData(refetchOnMount);
    }, 300);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [queryKey, enabled]);

  useEffect(() => {
    if (!refetchOnWindowFocus) return;

    const handleFocus = () => {
      if (mountedRef.current) {
        fetchData(true);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchOnWindowFocus, fetchData]);

  const refetch = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  const invalidate = useCallback(() => {
    memoryCache.delete(queryKey);
    if (persistToLocalStorage) {
      removeLocalStorageCache(queryKey);
    }
  }, [queryKey, persistToLocalStorage]);

  return {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
    invalidate,
    isStale: data ? Date.now() - (getCachedData()?.timestamp || 0) > staleTime : false,
  };
}

export function invalidateCache(queryKey: string) {
  memoryCache.delete(queryKey);
  removeLocalStorageCache(queryKey);
}

export function clearAllCache() {
  memoryCache.clear();
  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith('cache_')) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Error clearing localStorage cache:', error);
  }
}

export function getQueryMetrics(): QueryMetrics[] {
  return [...queryMetrics];
}

export function getQueryStats() {
  if (queryMetrics.length === 0) {
    return {
      totalQueries: 0,
      successRate: 0,
      cacheHitRate: 0,
      averageDuration: 0,
      slowQueries: [],
    };
  }

  const total = queryMetrics.length;
  const successful = queryMetrics.filter((m) => m.success).length;
  const cached = queryMetrics.filter((m) => m.fromCache).length;
  const totalDuration = queryMetrics.reduce((sum, m) => sum + m.duration, 0);
  const slowQueries = queryMetrics
    .filter((m) => m.duration > 1000)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 10);

  return {
    totalQueries: total,
    successRate: (successful / total) * 100,
    cacheHitRate: (cached / total) * 100,
    averageDuration: totalDuration / total,
    slowQueries,
  };
}

export function clearQueryMetrics() {
  queryMetrics.length = 0;
}
