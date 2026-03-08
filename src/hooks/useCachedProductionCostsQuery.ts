import { useCallback, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

const CACHE_TTL = 5 * 60 * 1000;

interface CachedQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: any;
  isCached: boolean;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const queryCache = new Map<string, CacheEntry<any>>();

export function useCachedProductionCostsQuery<T>(
  queryKey: string,
  queryFn: () => Promise<{ data: T | null; error: any }>,
  ttl: number = CACHE_TTL
): CachedQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isCached, setIsCached] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchWithCache = useCallback(async () => {
    const now = Date.now();
    const cachedEntry = queryCache.get(queryKey);

    if (cachedEntry && now - cachedEntry.timestamp < ttl) {
      logger.debug('CachedQuery', 'fetch', `Cache hit for key: ${queryKey}`);
      setData(cachedEntry.data);
      setIsCached(true);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setIsCached(false);
    abortControllerRef.current = new AbortController();

    try {
      const { data: result, error: queryError } = await queryFn();

      if (queryError) {
        logger.error('CachedQuery', 'fetch', `Query failed for key: ${queryKey}`, queryError);
        setError(queryError);
        setData(null);
      } else {
        logger.debug('CachedQuery', 'fetch', `Cache miss, fetched for key: ${queryKey}`);
        setData(result);
        setError(null);

        if (result) {
          queryCache.set(queryKey, {
            data: result,
            timestamp: now
          });
        }
      }
    } catch (err) {
      logger.error('CachedQuery', 'fetch', 'Unexpected error', err);
      setError(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [queryKey, queryFn, ttl]);

  return {
    data,
    loading,
    error,
    isCached
  };
}

export function clearProductionCostsCache() {
  queryCache.clear();
  logger.info('CachedQuery', 'clear', 'All cached queries cleared');
}

export function invalidateProductionCostsCache(pattern: string) {
  for (const key of queryCache.keys()) {
    if (key.includes(pattern)) {
      queryCache.delete(key);
    }
  }
  logger.info('CachedQuery', 'invalidate', `Invalidated cache for pattern: ${pattern}`);
}
