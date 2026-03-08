import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { registerRequest, unregisterRequest, createRequestKey } from '../lib/requestCancellation';

interface OptimizedQueryConfig {
  select?: string;
  limit?: number;
  offset?: number;
  filters?: Array<{ column: string; operator: string; value: any }>;
  orderBy?: { column: string; ascending?: boolean };
  enabled?: boolean;
  staleTime?: number;
}

const queryCache = new Map<string, { data: any; timestamp: number }>();

export function useOptimizedSupabaseQuery<T>(
  table: string,
  config: OptimizedQueryConfig = {}
) {
  const {
    select = '*',
    limit = 100,
    offset = 0,
    filters = [],
    orderBy,
    enabled = true,
    staleTime = 5 * 60 * 1000
  } = config;

  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const cacheKeyRef = useRef<string>('');

  const buildCacheKey = useCallback(() => {
    const filterStr = filters.map(f => `${f.column}${f.operator}${f.value}`).join('&');
    return `${table}:${select}:${limit}:${offset}:${filterStr}`;
  }, [table, select, limit, offset, filters]);

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const cacheKey = buildCacheKey();
    cacheKeyRef.current = cacheKey;

    const cached = queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < staleTime) {
      setData(cached.data);
      setLoading(false);
      return;
    }

    const requestKey = createRequestKey('supabase-query', table, { select, limit, offset });
    const controller = registerRequest(requestKey);

    try {
      setLoading(true);

      let query = supabase
        .from(table)
        .select(select, { count: 'exact' });

      filters.forEach(filter => {
        if (filter.operator === 'eq') {
          query = query.eq(filter.column, filter.value);
        } else if (filter.operator === 'gt') {
          query = query.gt(filter.column, filter.value);
        } else if (filter.operator === 'lt') {
          query = query.lt(filter.column, filter.value);
        } else if (filter.operator === 'gte') {
          query = query.gte(filter.column, filter.value);
        } else if (filter.operator === 'lte') {
          query = query.lte(filter.column, filter.value);
        } else if (filter.operator === 'like') {
          query = query.like(filter.column, filter.value);
        } else if (filter.operator === 'in') {
          query = query.in(filter.column, filter.value);
        }
      });

      if (orderBy) {
        query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
      }

      query = query
        .range(offset, offset + limit - 1);

      const { data: result, error: err } = await query;

      if (err) throw err;

      queryCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      setData(result as T[]);
      setError(null);
    } catch (err) {
      if (!(err instanceof Error && err.message?.includes('aborted'))) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      setLoading(false);
      unregisterRequest(requestKey);
    }
  }, [enabled, buildCacheKey, table, select, limit, offset, filters, orderBy, staleTime]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    if (cacheKeyRef.current) {
      queryCache.delete(cacheKeyRef.current);
    }
    fetchData();
  }, [fetchData]);

  const invalidate = useCallback(() => {
    queryCache.clear();
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch, invalidate };
}

export function useOptimizedSupabaseSingle<T>(
  table: string,
  config: OptimizedQueryConfig = {}
) {
  const { data, loading, error, refetch, invalidate } = useOptimizedSupabaseQuery<T>(table, config);

  return {
    data: data?.[0] || null,
    loading,
    error,
    refetch,
    invalidate
  };
}

export function clearSupabaseQueryCache(pattern?: string) {
  if (!pattern) {
    queryCache.clear();
  } else {
    const keysToDelete: string[] = [];
    queryCache.forEach((_, key) => {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => queryCache.delete(key));
  }
}
