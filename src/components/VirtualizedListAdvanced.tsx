import { useState, useEffect, useRef, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Loader2 } from 'lucide-react';

interface VirtualizedListAdvancedProps<T> {
  items: T[];
  height: number;
  itemHeight: number;
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  threshold?: number;
  className?: string;
  hasNextPage?: boolean;
  isNextPageLoading?: boolean;
  loadNextPage?: () => Promise<void>;
  emptyMessage?: string;
  loadingMessage?: string;
}

export default function VirtualizedListAdvanced<T>({
  items,
  height,
  itemHeight,
  renderItem,
  threshold = 50,
  className = '',
  hasNextPage = false,
  isNextPageLoading = false,
  loadNextPage,
  emptyMessage = 'Nenhum item encontrado',
  loadingMessage = 'Carregando...',
}: VirtualizedListAdvancedProps<T>) {
  const listRef = useRef<List>(null);
  const [isLoading, setIsLoading] = useState(false);

  const itemCount = hasNextPage ? items.length + 1 : items.length;

  const handleItemsRendered = useCallback(async ({
    visibleStopIndex,
  }: {
    overscanStartIndex: number;
    overscanStopIndex: number;
    visibleStartIndex: number;
    visibleStopIndex: number;
  }) => {
    if (!hasNextPage || !loadNextPage || isLoading || isNextPageLoading) return;
    if (visibleStopIndex >= items.length - 5) {
      setIsLoading(true);
      try {
        await loadNextPage();
      } catch (error) {
        console.error('Erro ao carregar mais itens:', error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [hasNextPage, loadNextPage, isLoading, isNextPageLoading, items.length]);

  if (items.length < threshold) {
    if (items.length === 0) {
      return (
        <div className={`flex items-center justify-center p-8 text-gray-500 ${className}`}>
          {emptyMessage}
        </div>
      );
    }

    return (
      <div className={className}>
        {items.map((item, index) => (
          <div key={index}>
            {renderItem(item, index, {})}
          </div>
        ))}
      </div>
    );
  }

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    if (index >= items.length) {
      return (
        <div style={style} className="flex items-center justify-center p-4">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <span className="ml-2 text-sm text-gray-600">{loadingMessage}</span>
        </div>
      );
    }

    const item = items[index];
    if (!item) return null;

    return <>{renderItem(item, index, style)}</>;
  };

  return (
    <List
      ref={listRef}
      height={height}
      itemCount={itemCount}
      itemSize={itemHeight}
      width="100%"
      className={className}
      onItemsRendered={handleItemsRendered}
    >
      {Row}
    </List>
  );
}

export function useVirtualizedPagination<T>(
  fetchFunction: (offset: number, limit: number) => Promise<T[]>,
  pageSize: number = 50
) {
  const [items, setItems] = useState<T[]>([]);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [currentOffset, setCurrentOffset] = useState(0);

  const loadInitial = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchFunction(0, pageSize);
      setItems(data);
      setCurrentOffset(pageSize);
      setHasNextPage(data.length === pageSize);
    } catch (error) {
      console.error('Erro ao carregar dados iniciais:', error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchFunction, pageSize]);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasNextPage) return;

    setIsLoading(true);
    try {
      const data = await fetchFunction(currentOffset, pageSize);
      setItems((prev) => [...prev, ...data]);
      setCurrentOffset((prev) => prev + pageSize);
      setHasNextPage(data.length === pageSize);
    } catch (error) {
      console.error('Erro ao carregar mais dados:', error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchFunction, pageSize, currentOffset, isLoading, hasNextPage]);

  const reset = useCallback(() => {
    setItems([]);
    setCurrentOffset(0);
    setHasNextPage(true);
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  return {
    items,
    hasNextPage,
    isLoading,
    loadMore,
    reset,
  };
}

export function useVirtualizedHeight(maxHeight: number = 600, itemHeight: number = 60, itemCount: number = 0) {
  const calculatedHeight = Math.min(itemCount * itemHeight, maxHeight);
  return Math.max(calculatedHeight, 200);
}
