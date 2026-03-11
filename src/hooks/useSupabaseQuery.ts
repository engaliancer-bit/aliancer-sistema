import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useQueryCache, UseQueryCacheOptions } from './useQueryCache';

interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

interface UseSupabaseQueryOptions extends UseQueryCacheOptions {
  pagination?: PaginationOptions;
  orderBy?: { column: string; ascending?: boolean };
  filters?: Record<string, any>;
}

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

const createQueryKey = (table: string, pagination?: PaginationOptions, orderBy?: { column: string; ascending?: boolean }, filters?: Record<string, any>) => {
  const p = pagination || { page: 0, pageSize: 50 };
  const o = orderBy || { column: 'created_at', ascending: false };
  const f = filters || {};
  return `${table}_${p.page || 0}_${p.pageSize || 50}_${o.column}_${o.ascending ? 1 : 0}_${Object.keys(f).sort().map(k => `${k}=${f[k]}`).join('|')}`;
};

export function useSupabaseQuery<T = any>(
  table: string,
  options: UseSupabaseQueryOptions = {}
) {
  const {
    pagination = { page: 0, pageSize: 50 },
    orderBy = { column: 'created_at', ascending: false },
    filters = {},
    ...cacheOptions
  } = options;

  const queryKey = useMemo(() => createQueryKey(table, pagination, orderBy, filters), [table, pagination, orderBy, filters]);

  const queryFn = useCallback(async () => {
    const startTime = performance.now();
    const { page = 0, pageSize = 50 } = pagination;

    let query = supabase.from(table).select('*', { count: 'exact' });

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (typeof value === 'string' && value.includes('%')) {
          query = query.ilike(key, value);
        } else {
          query = query.eq(key, value);
        }
      }
    });

    if (orderBy) {
      query = query.order(orderBy.column, { ascending: orderBy.ascending ?? false });
    }

    const start = page * pageSize;
    const end = start + pageSize - 1;
    query = query.range(start, end);

    const { data, error, count } = await query;

    const duration = performance.now() - startTime;

    if (import.meta.env.DEV) {
      console.log(
        `[Supabase Query] ${table} - ${duration.toFixed(2)}ms - ${data?.length || 0} rows`,
        { pagination, orderBy, filters }
      );
    }

    if (error) throw error;

    return {
      data: data || [],
      total: count || 0,
      page,
      pageSize,
      hasMore: (count || 0) > (page + 1) * pageSize,
    } as PaginatedResult<T>;
  }, [table, pagination, orderBy, filters]);

  return useQueryCache<PaginatedResult<T>>(queryKey, queryFn, {
    cacheTime: 5 * 60 * 1000,
    staleTime: 30 * 1000,
    ...cacheOptions,
  });
}

export function useSupabaseSingleQuery<T = any>(
  table: string,
  id: string | null,
  options: UseQueryCacheOptions = {}
) {
  const queryKey = `${table}_${id}`;

  const queryFn = useCallback(async () => {
    if (!id) return null;

    const startTime = performance.now();

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    const duration = performance.now() - startTime;

    if (import.meta.env.DEV) {
      console.log(`[Supabase Query] ${table}/${id} - ${duration.toFixed(2)}ms`);
    }

    if (error) throw error;

    return data as T;
  }, [table, id]);

  return useQueryCache<T | null>(queryKey, queryFn, {
    enabled: !!id,
    cacheTime: 5 * 60 * 1000,
    staleTime: 30 * 1000,
    ...options,
  });
}

export function useSupabaseMutation<T = any>(
  table: string,
  options: {
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
  } = {}
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const insert = useCallback(
    async (values: Partial<T>) => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from(table)
          .insert(values)
          .select()
          .single();

        if (error) throw error;

        options.onSuccess?.(data as T);
        return data as T;
      } catch (err) {
        const error = err as Error;
        setError(error);
        options.onError?.(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [table, options]
  );

  const update = useCallback(
    async (id: string, values: Partial<T>) => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from(table)
          .update(values)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;

        options.onSuccess?.(data as T);
        return data as T;
      } catch (err) {
        const error = err as Error;
        setError(error);
        options.onError?.(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [table, options]
  );

  const remove = useCallback(
    async (id: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const { error } = await supabase.from(table).delete().eq('id', id);

        if (error) throw error;

        options.onSuccess?.(null as any);
        return true;
      } catch (err) {
        const error = err as Error;
        setError(error);
        options.onError?.(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [table, options]
  );

  return {
    insert,
    update,
    remove,
    isLoading,
    error,
  };
}

export function useInfiniteQuery<T = any>(
  table: string,
  options: Omit<UseSupabaseQueryOptions, 'pagination'> & {
    pageSize?: number;
  } = {}
) {
  const { pageSize = 50, ...restOptions } = options;
  const [pages, setPages] = useState<PaginatedResult<T>[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const {
    data: pageData,
    isLoading,
    error,
    refetch,
  } = useSupabaseQuery<T>(table, {
    ...restOptions,
    pagination: { page: currentPage, pageSize },
  });

  useEffect(() => {
    if (pageData) {
      setPages((prev) => {
        const newPages = [...prev];
        newPages[currentPage] = pageData;
        return newPages;
      });
    }
  }, [pageData, currentPage]);

  const loadMore = useCallback(async () => {
    if (!pageData?.hasMore || isLoadingMore) return;

    setIsLoadingMore(true);
    setCurrentPage((prev) => prev + 1);
    setIsLoadingMore(false);
  }, [pageData, isLoadingMore]);

  const allData = pages.flatMap((page) => page.data);

  const hasMore = pageData?.hasMore ?? false;
  const total = pageData?.total ?? 0;

  return {
    data: allData,
    total,
    isLoading: isLoading && currentPage === 0,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    refetch: () => {
      setPages([]);
      setCurrentPage(0);
      refetch();
    },
  };
}

export function useSupabaseSearch<T = any>(
  table: string,
  searchColumn: string,
  options: Omit<UseSupabaseQueryOptions, 'filters'> = {}
) {
  const [searchTerm, setSearchTerm] = useState('');
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  const filters = searchTerm ? { [searchColumn]: `%${searchTerm}%` } : {};

  const result = useSupabaseQuery<T>(table, {
    ...options,
    filters,
    enabled: options.enabled !== false && searchTerm.length > 0,
  });

  const setSearch = useCallback((term: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setSearchTerm(term);
    }, 300);
  }, []);

  return {
    ...result,
    searchTerm,
    setSearch,
  };
}

export function useSupabaseCount(
  table: string,
  filters: Record<string, any> = {},
  options: UseQueryCacheOptions = {}
) {
  const queryKey = useMemo(() => {
    const f = filters || {};
    return `${table}_count_${Object.keys(f).sort().map(k => `${k}=${f[k]}`).join('|')}`;
  }, [table, filters]);

  const queryFn = useCallback(async () => {
    let query = supabase.from(table).select('*', { count: 'exact', head: true });

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query = query.eq(key, value);
      }
    });

    const { count, error } = await query;

    if (error) throw error;

    return count || 0;
  }, [table, filters]);

  return useQueryCache<number>(queryKey, queryFn, {
    cacheTime: 2 * 60 * 1000,
    staleTime: 30 * 1000,
    ...options,
  });
}
