import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useDebounce } from './useDebounce';
import type { ProductListItem } from '../components/products/ProductsList';

interface UseProductsDataOptions {
  pageSize?: number;
  staleTime?: number;
}

interface UseProductsDataResult {
  products: ProductListItem[];
  loading: boolean;
  error: Error | null;
  totalCount: number;
  currentPage: number;
  totalPages: number;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  refetch: () => Promise<void>;
  invalidateCache: () => void;
}

interface CacheEntry {
  data: ProductListItem[];
  totalCount: number;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

export function useProductsData(options: UseProductsDataOptions = {}): UseProductsDataResult {
  const { pageSize = 50, staleTime = 600000 } = options;

  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const abortControllerRef = useRef<AbortController | null>(null);

  const getCacheKey = useCallback((page: number, search: string) => {
    return `products_${page}_${search}_${pageSize}`;
  }, [pageSize]);

  const invalidateCache = useCallback(() => {
    cache.clear();
  }, []);

  const fetchProducts = useCallback(async (page: number, search: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    const cacheKey = getCacheKey(page, search);
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < staleTime) {
      setProducts(cached.data);
      setTotalCount(cached.totalCount);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('products')
        .select(`
          id,
          name,
          code,
          description,
          unit,
          product_type,
          final_sale_price,
          minimum_stock,
          updated_at,
          recipes:recipe_id (
            name
          )
        `, { count: 'exact' })
        .order('name', { ascending: true })
        .range(from, to);

      if (search) {
        query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%,description.ilike.%${search}%`);
      }

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;

      const formattedProducts: ProductListItem[] = (data || []).map(product => ({
        id: product.id,
        name: product.name,
        code: product.code,
        description: product.description,
        unit: product.unit,
        product_type: product.product_type,
        final_sale_price: product.final_sale_price,
        minimum_stock: product.minimum_stock,
        recipe_name: (product.recipes as any)?.name || null,
        updated_at: product.updated_at,
      }));

      cache.set(cacheKey, {
        data: formattedProducts,
        totalCount: count || 0,
        timestamp: Date.now(),
      });

      setProducts(formattedProducts);
      setTotalCount(count || 0);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Erro ao carregar produtos:', err);
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [pageSize, staleTime, getCacheKey]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);

  useEffect(() => {
    fetchProducts(currentPage, debouncedSearchTerm);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [currentPage, debouncedSearchTerm, fetchProducts]);

  const totalPages = Math.ceil(totalCount / pageSize);

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [totalPages]);

  const nextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const prevPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  const refetch = useCallback(async () => {
    invalidateCache();
    await fetchProducts(currentPage, debouncedSearchTerm);
  }, [currentPage, debouncedSearchTerm, fetchProducts, invalidateCache]);

  return {
    products,
    loading,
    error,
    totalCount,
    currentPage,
    totalPages,
    searchTerm,
    setSearchTerm,
    goToPage,
    nextPage,
    prevPage,
    refetch,
    invalidateCache,
  };
}
