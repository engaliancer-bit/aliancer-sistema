import { useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface RefCache<T extends { id: string }> {
  map: Map<string, T>;
  loadedAt: number;
}

const globalCache = new Map<string, RefCache<any>>();

const DEFAULT_TTL_MS = 10 * 60 * 1000;

interface UseNormalizedRefTableOptions<T extends { id: string }> {
  tableName: string;
  selectFields: string;
  ttlMs?: number;
  onLoaded?: (map: Map<string, T>) => void;
}

export function useNormalizedRefTable<T extends { id: string }>({
  tableName,
  selectFields,
  ttlMs = DEFAULT_TTL_MS,
  onLoaded,
}: UseNormalizedRefTableOptions<T>) {
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  const getById = useCallback(
    (id: string): T | undefined => {
      return globalCache.get(tableName)?.map.get(id);
    },
    [tableName]
  );

  const populate = useCallback(
    (records: T[]) => {
      const map = new Map<string, T>(records.map((r) => [r.id, r]));
      globalCache.set(tableName, { map, loadedAt: Date.now() });
      onLoadedRef.current?.(map);
    },
    [tableName]
  );

  const refresh = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select(selectFields)
        .order('id');
      if (error) throw error;
      populate((data ?? []) as T[]);
    } catch (err) {
      console.error(`useNormalizedRefTable: failed to refresh ${tableName}`, err);
    }
  }, [tableName, selectFields, populate]);

  const isStale = useCallback((): boolean => {
    const cached = globalCache.get(tableName);
    if (!cached) return true;
    return Date.now() - cached.loadedAt > ttlMs;
  }, [tableName, ttlMs]);

  const getMap = useCallback((): Map<string, T> => {
    return globalCache.get(tableName)?.map ?? new Map();
  }, [tableName]);

  return { getById, getMap, populate, refresh, isStale };
}
