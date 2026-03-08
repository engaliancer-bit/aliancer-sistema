import { useEffect, useRef, useCallback, useState } from 'react';
import { memoryCleanup } from '../lib/memoryCleanup';

interface UseOptimizedQueryOptions {
  enabled?: boolean;
  staleTime?: number;
  cacheTime?: number;
  refetchOnMount?: boolean;
}

export function useOptimizedQuery<T>(
  queryKey: string,
  queryFn: (signal: AbortSignal) => Promise<T>,
  options: UseOptimizedQueryOptions = {}
) {
  const {
    enabled = true,
    staleTime = 5 * 60 * 1000,
    cacheTime = 10 * 60 * 1000,
    refetchOnMount = false,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFetching, setIsFetching] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<{ data: T; timestamp: number } | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    if (cacheRef.current) {
      const age = Date.now() - cacheRef.current.timestamp;
      if (age < staleTime) {
        setData(cacheRef.current.data);
        return;
      }
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    memoryCleanup.registerAbortController(abortControllerRef.current);

    try {
      setIsFetching(true);
      if (!cacheRef.current) {
        setIsLoading(true);
      }

      const result = await queryFn(abortControllerRef.current.signal);

      if (mountedRef.current) {
        cacheRef.current = {
          data: result,
          timestamp: Date.now(),
        };
        setData(result);
        setError(null);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError' && mountedRef.current) {
        console.error(`[useOptimizedQuery] Error in ${queryKey}:`, err);
        setError(err as Error);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsFetching(false);
      }
      if (abortControllerRef.current) {
        memoryCleanup.unregisterAbortController(abortControllerRef.current);
      }
    }
  }, [enabled, queryFn, queryKey, staleTime]);

  useEffect(() => {
    mountedRef.current = true;

    if (refetchOnMount || !cacheRef.current) {
      fetchData();
    } else if (cacheRef.current) {
      setData(cacheRef.current.data);
    }

    const cacheCleanupTimeout = setTimeout(() => {
      if (cacheRef.current) {
        const age = Date.now() - cacheRef.current.timestamp;
        if (age > cacheTime) {
          cacheRef.current = null;
        }
      }
    }, cacheTime);

    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        memoryCleanup.unregisterAbortController(abortControllerRef.current);
      }
      clearTimeout(cacheCleanupTimeout);
    };
  }, [fetchData, cacheTime, refetchOnMount]);

  const refetch = useCallback(() => {
    cacheRef.current = null;
    return fetchData();
  }, [fetchData]);

  const invalidate = useCallback(() => {
    cacheRef.current = null;
  }, []);

  return {
    data,
    error,
    isLoading,
    isFetching,
    refetch,
    invalidate,
  };
}

export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const timeoutRef = useRef<number>();

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay]);

  return debouncedValue;
}

export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): T {
  const lastRun = useRef(Date.now());
  const timeoutRef = useRef<number>();

  return useCallback(
    ((...args: any[]) => {
      const now = Date.now();

      if (now - lastRun.current >= delay) {
        callback(...args);
        lastRun.current = now;
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = window.setTimeout(() => {
          callback(...args);
          lastRun.current = Date.now();
        }, delay - (now - lastRun.current));
      }
    }) as T,
    [callback, delay]
  );
}
