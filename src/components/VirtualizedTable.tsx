import { useState, useCallback, useMemo, useEffect } from 'react';
import VirtualizedListAdvanced from './VirtualizedListAdvanced';

export interface Column<T> {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (item: T, index: number) => React.ReactNode;
  sortable?: boolean;
}

interface VirtualizedTableProps<T> {
  data: T[];
  columns: Column<T>[];
  itemHeight?: number;
  maxHeight?: number;
  searchTerm?: string;
  searchFields?: (keyof T)[];
  onRowClick?: (item: T, index: number) => void;
  emptyMessage?: string;
  className?: string;
  showHeader?: boolean;
  striped?: boolean;
  hoverable?: boolean;
}

export default function VirtualizedTable<T extends Record<string, any>>({
  data,
  columns,
  itemHeight = 60,
  maxHeight = 600,
  searchTerm = '',
  searchFields = [],
  onRowClick,
  emptyMessage = 'Nenhum registro encontrado',
  className = '',
  showHeader = true,
  striped = false,
  hoverable = true,
}: VirtualizedTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Filtrar dados baseado na busca
  const filteredData = useMemo(() => {
    if (!searchTerm || searchFields.length === 0) {
      return data;
    }

    const lowerSearch = searchTerm.toLowerCase();
    return data.filter((item) => {
      return searchFields.some((field) => {
        const value = item[field];
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(lowerSearch);
      });
    });
  }, [data, searchTerm, searchFields]);

  // Ordenar dados
  const sortedData = useMemo(() => {
    if (!sortColumn) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      if (aValue === bValue) return 0;

      const comparison = aValue > bValue ? 1 : -1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortColumn, sortDirection]);

  // Calcular altura do container
  const containerHeight = useMemo(() => {
    const calculatedHeight = Math.min(sortedData.length * itemHeight, maxHeight);
    return Math.max(calculatedHeight, 200);
  }, [sortedData.length, itemHeight, maxHeight]);

  // Função para alternar ordenação
  const handleSort = (columnKey: string) => {
    const column = columns.find((col) => col.key === columnKey);
    if (!column?.sortable) return;

    if (sortColumn === columnKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  // Renderizar cada linha
  const renderRow = useCallback(
    (item: T, index: number, style: React.CSSProperties) => {
      const isEven = index % 2 === 0;
      const bgClass = striped && isEven ? 'bg-gray-50' : 'bg-white';
      const hoverClass = hoverable ? 'hover:bg-blue-50' : '';
      const cursorClass = onRowClick ? 'cursor-pointer' : '';

      return (
        <div
          style={style}
          className={`flex items-center border-b border-gray-200 ${bgClass} ${hoverClass} ${cursorClass} transition-colors`}
          onClick={() => onRowClick?.(item, index)}
        >
          {columns.map((column) => {
            const content = column.render
              ? column.render(item, index)
              : item[column.key];

            return (
              <div
                key={column.key}
                className={`px-4 py-3 text-sm ${
                  column.align === 'center'
                    ? 'text-center'
                    : column.align === 'right'
                    ? 'text-right'
                    : 'text-left'
                }`}
                style={{ width: column.width || 'auto', flex: column.width ? undefined : 1 }}
              >
                {content}
              </div>
            );
          })}
        </div>
      );
    },
    [columns, striped, hoverable, onRowClick]
  );

  return (
    <div className={`bg-white rounded-lg shadow overflow-hidden ${className}`}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center bg-gray-100 border-b border-gray-200 font-medium text-sm text-gray-700">
          {columns.map((column) => (
            <div
              key={column.key}
              className={`px-4 py-3 ${
                column.sortable ? 'cursor-pointer hover:bg-gray-200' : ''
              } ${
                column.align === 'center'
                  ? 'text-center'
                  : column.align === 'right'
                  ? 'text-right'
                  : 'text-left'
              }`}
              style={{ width: column.width || 'auto', flex: column.width ? undefined : 1 }}
              onClick={() => handleSort(column.key)}
            >
              <div className="flex items-center justify-between gap-2">
                <span>{column.label}</span>
                {column.sortable && sortColumn === column.key && (
                  <span className="text-blue-600">
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Body */}
      {sortedData.length === 0 ? (
        <div className="flex items-center justify-center p-8 text-gray-500">
          {emptyMessage}
        </div>
      ) : (
        <VirtualizedListAdvanced
          items={sortedData}
          height={containerHeight}
          itemHeight={itemHeight}
          renderItem={renderRow}
          emptyMessage={emptyMessage}
          threshold={20}
        />
      )}

      {/* Footer */}
      {sortedData.length > 0 && (
        <div className="bg-gray-50 px-4 py-2 border-t border-gray-200 text-xs text-gray-600">
          <div className="flex items-center justify-between">
            <span>
              Exibindo {sortedData.length}{' '}
              {sortedData.length === 1 ? 'registro' : 'registros'}
              {searchTerm && ` (filtrados)`}
            </span>
            <span>Lista virtualizada para melhor performance</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Hook para usar VirtualizedTable com paginação no backend
export function useVirtualizedTableData<T>(
  fetchFunction: (offset: number, limit: number) => Promise<T[]>,
  pageSize: number = 100
) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const loadInitial = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetchFunction(0, pageSize);
      setData(result);
      setOffset(pageSize);
      setHasMore(result.length === pageSize);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [fetchFunction, pageSize]);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    try {
      const result = await fetchFunction(offset, pageSize);
      setData((prev) => [...prev, ...result]);
      setOffset((prev) => prev + pageSize);
      setHasMore(result.length === pageSize);
    } catch (error) {
      console.error('Erro ao carregar mais dados:', error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchFunction, pageSize, offset, isLoading, hasMore]);

  const reset = useCallback(() => {
    setData([]);
    setOffset(0);
    setHasMore(true);
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  return {
    data,
    isLoading,
    hasMore,
    loadMore,
    reset,
  };
}
