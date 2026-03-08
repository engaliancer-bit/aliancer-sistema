import { useState, useEffect, useRef, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
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

  // Se lista pequena, renderizar normalmente
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

  // Determinar se item está carregado
  const isItemLoaded = (index: number) => !hasNextPage || index < items.length;

  // Total de itens (incluindo placeholder para próxima página)
  const itemCount = hasNextPage ? items.length + 1 : items.length;

  // Carregar mais itens quando chegar perto do fim
  const loadMoreItems = useCallback(async (startIndex: number, stopIndex: number) => {
    if (isNextPageLoading || !loadNextPage || isLoading) return;

    setIsLoading(true);
    try {
      await loadNextPage();
    } catch (error) {
      console.error('Erro ao carregar mais itens:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isNextPageLoading, loadNextPage, isLoading]);

  // Renderizar cada linha
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    if (!isItemLoaded(index)) {
      return (
        <div style={style} className="flex items-center justify-center p-4">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <span className="ml-2 text-sm text-gray-600">{loadingMessage}</span>
        </div>
      );
    }

    const item = items[index];
    if (!item) return null;

    return renderItem(item, index, style);
  };

  if (loadNextPage && hasNextPage) {
    // Com infinite scroll
    return (
      <InfiniteLoader
        isItemLoaded={isItemLoaded}
        itemCount={itemCount}
        loadMoreItems={loadMoreItems}
      >
        {({ onItemsRendered, ref }) => (
          <List
            ref={(list) => {
              ref(list);
              if (list) {
                (listRef as any).current = list;
              }
            }}
            height={height}
            itemCount={itemCount}
            itemSize={itemHeight}
            width="100%"
            className={className}
            onItemsRendered={onItemsRendered}
          >
            {Row}
          </List>
        )}
      </InfiniteLoader>
    );
  }

  // Sem infinite scroll
  return (
    <List
      ref={listRef}
      height={height}
      itemCount={items.length}
      itemSize={itemHeight}
      width="100%"
      className={className}
    >
      {Row}
    </List>
  );
}

// Hook personalizado para gerenciar paginação
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

// Hook para calcular altura dinâmica do container
export function useVirtualizedHeight(maxHeight: number = 600, itemHeight: number = 60, itemCount: number = 0) {
  const calculatedHeight = Math.min(itemCount * itemHeight, maxHeight);
  return Math.max(calculatedHeight, 200); // Mínimo 200px
}
