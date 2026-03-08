import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useDebounce } from './useDebounce';

interface UseOptimizedSelectOptions<T> {
  items: T[];
  searchFields: (keyof T)[];
  initialPageSize?: number;
  loadMoreThreshold?: number;
}

export function useOptimizedSelect<T extends Record<string, any>>({
  items,
  searchFields,
  initialPageSize = 20,
  loadMoreThreshold = 100,
}: UseOptimizedSelectOptions<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(initialPageSize);
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Filtrar itens baseado na busca
  const filteredItems = useMemo(() => {
    if (!debouncedSearch) return items;

    const lowerSearch = debouncedSearch.toLowerCase();
    return items.filter((item) => {
      return searchFields.some((field) => {
        const value = item[field];
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(lowerSearch);
      });
    });
  }, [items, debouncedSearch, searchFields]);

  // Itens visíveis (com lazy loading)
  const visibleItems = useMemo(() => {
    if (filteredItems.length <= loadMoreThreshold) {
      return filteredItems;
    }
    return filteredItems.slice(0, visibleCount);
  }, [filteredItems, visibleCount, loadMoreThreshold]);

  // Resetar visibleCount quando busca mudar
  useEffect(() => {
    setVisibleCount(initialPageSize);
  }, [debouncedSearch, initialPageSize]);

  // Função para carregar mais
  const loadMore = useCallback(() => {
    setVisibleCount((prev) =>
      Math.min(prev + initialPageSize, filteredItems.length)
    );
  }, [initialPageSize, filteredItems.length]);

  // Verificar se tem mais itens para carregar
  const hasMore = visibleCount < filteredItems.length;

  return {
    searchTerm,
    setSearchTerm,
    filteredItems,
    visibleItems,
    loadMore,
    hasMore,
    totalCount: filteredItems.length,
    visibleCount,
  };
}

// Hook para detectar scroll próximo ao fim
export function useScrollNearEnd(
  threshold: number = 100,
  enabled: boolean = true
) {
  const [isNearEnd, setIsNearEnd] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleScroll = () => {
      if (!scrollRef.current) return;

      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      setIsNearEnd(distanceFromBottom < threshold);
    };

    const element = scrollRef.current;
    if (element) {
      element.addEventListener('scroll', handleScroll, { passive: true });

      return () => {
        element.removeEventListener('scroll', handleScroll);
      };
    }
  }, [threshold, enabled]);

  return { isNearEnd, scrollRef };
}

// Hook para gerenciar estado de select com suporte a assíncrono
interface UseAsyncSelectOptions<T> {
  fetchOptions: (search: string) => Promise<T[]>;
  debounceMs?: number;
  minSearchLength?: number;
}

export function useAsyncSelect<T>({
  fetchOptions,
  debounceMs = 300,
  minSearchLength = 2,
}: UseAsyncSelectOptions<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [options, setOptions] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debouncedSearch = useDebounce(searchTerm, debounceMs);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cancelar requisição anterior
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Não buscar se o termo for muito curto
    if (debouncedSearch.length < minSearchLength) {
      setOptions([]);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const data = await fetchOptions(debouncedSearch);
        if (!controller.signal.aborted) {
          setOptions(data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Erro ao buscar opções');
          setOptions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [debouncedSearch, fetchOptions, minSearchLength]);

  const reset = useCallback(() => {
    setSearchTerm('');
    setOptions([]);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    options,
    isLoading,
    error,
    reset,
  };
}

// Hook para multi-select otimizado
export function useMultiSelect<T extends { id: string | number }>(
  initialSelected: T[] = []
) {
  const [selected, setSelected] = useState<T[]>(initialSelected);
  const selectedIds = useMemo(() => new Set(selected.map((item) => item.id)), [selected]);

  const isSelected = useCallback(
    (item: T) => selectedIds.has(item.id),
    [selectedIds]
  );

  const toggle = useCallback((item: T) => {
    setSelected((prev) => {
      const isCurrentlySelected = prev.some((s) => s.id === item.id);
      if (isCurrentlySelected) {
        return prev.filter((s) => s.id !== item.id);
      } else {
        return [...prev, item];
      }
    });
  }, []);

  const add = useCallback((item: T) => {
    setSelected((prev) => {
      if (prev.some((s) => s.id === item.id)) return prev;
      return [...prev, item];
    });
  }, []);

  const remove = useCallback((item: T) => {
    setSelected((prev) => prev.filter((s) => s.id !== item.id));
  }, []);

  const clear = useCallback(() => {
    setSelected([]);
  }, []);

  const selectAll = useCallback((items: T[]) => {
    setSelected(items);
  }, []);

  return {
    selected,
    selectedIds,
    isSelected,
    toggle,
    add,
    remove,
    clear,
    selectAll,
    count: selected.length,
  };
}

// Hook para gerenciar focus trap em dropdown
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const container = containerRef.current;
      if (!container) return;

      const focusableElements = container.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive]);

  return containerRef;
}
