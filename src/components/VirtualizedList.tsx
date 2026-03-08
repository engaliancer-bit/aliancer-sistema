import { CSSProperties, ReactElement, useRef, useEffect } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';

interface VirtualizedListProps<T> {
  items: T[];
  height?: number;
  itemHeight?: number;
  width?: string | number;
  className?: string;
  renderItem: (item: T, index: number) => ReactElement;
  onScroll?: (scrollOffset: number) => void;
  overscanCount?: number;
  initialScrollOffset?: number;
}

export function VirtualizedList<T>({
  items,
  height = 600,
  itemHeight = 60,
  width = '100%',
  className = '',
  renderItem,
  onScroll,
  overscanCount = 5,
  initialScrollOffset = 0,
}: VirtualizedListProps<T>) {
  const listRef = useRef<List>(null);

  useEffect(() => {
    if (initialScrollOffset && listRef.current) {
      listRef.current.scrollTo(initialScrollOffset);
    }
  }, [initialScrollOffset]);

  const Row = ({ index, style }: ListChildComponentProps) => {
    const item = items[index];

    return (
      <div style={style} className={className}>
        {renderItem(item, index)}
      </div>
    );
  };

  const handleScroll = ({ scrollOffset }: { scrollOffset: number }) => {
    if (onScroll) {
      onScroll(scrollOffset);
    }
  };

  return (
    <List
      ref={listRef}
      height={height}
      itemCount={items.length}
      itemSize={itemHeight}
      width={width}
      onScroll={handleScroll}
      overscanCount={overscanCount}
      className="virtualized-list"
    >
      {Row}
    </List>
  );
}

interface VirtualizedTableProps<T> {
  items: T[];
  columns: Array<{
    key: string;
    label: string;
    width: string;
    render?: (item: T) => ReactElement | string;
  }>;
  height?: number;
  rowHeight?: number;
  onRowClick?: (item: T, index: number) => void;
  selectedIndex?: number;
  className?: string;
}

export function VirtualizedTable<T extends Record<string, any>>({
  items,
  columns,
  height = 600,
  rowHeight = 60,
  onRowClick,
  selectedIndex,
  className = '',
}: VirtualizedTableProps<T>) {
  const Row = ({ index, style }: ListChildComponentProps) => {
    const item = items[index];
    const isSelected = selectedIndex === index;

    return (
      <div
        style={style}
        className={`flex border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors ${
          isSelected ? 'bg-blue-50' : ''
        } ${className}`}
        onClick={() => onRowClick?.(item, index)}
      >
        {columns.map((column) => (
          <div
            key={column.key}
            className="flex items-center px-4 py-3 overflow-hidden"
            style={{ width: column.width }}
          >
            {column.render ? column.render(item) : item[column.key]}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex bg-gray-100 border-b border-gray-200 font-semibold text-sm text-gray-700">
        {columns.map((column) => (
          <div
            key={column.key}
            className="px-4 py-3"
            style={{ width: column.width }}
          >
            {column.label}
          </div>
        ))}
      </div>

      <List
        height={height}
        itemCount={items.length}
        itemSize={rowHeight}
        width="100%"
        overscanCount={3}
      >
        {Row}
      </List>
    </div>
  );
}

interface VirtualizedGridProps<T> {
  items: T[];
  height?: number;
  itemWidth?: number;
  itemHeight?: number;
  gap?: number;
  renderItem: (item: T, index: number) => ReactElement;
  containerWidth?: number;
}

export function VirtualizedGrid<T>({
  items,
  height = 600,
  itemWidth = 250,
  itemHeight = 200,
  gap = 16,
  renderItem,
  containerWidth = 1200,
}: VirtualizedGridProps<T>) {
  const itemsPerRow = Math.floor(containerWidth / (itemWidth + gap));
  const rowCount = Math.ceil(items.length / itemsPerRow);

  const Row = ({ index, style }: ListChildComponentProps) => {
    const fromIndex = index * itemsPerRow;
    const toIndex = Math.min(fromIndex + itemsPerRow, items.length);

    return (
      <div style={style} className="flex gap-4 px-4">
        {items.slice(fromIndex, toIndex).map((item, i) => (
          <div key={fromIndex + i} style={{ width: itemWidth }}>
            {renderItem(item, fromIndex + i)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <List
      height={height}
      itemCount={rowCount}
      itemSize={itemHeight + gap}
      width={containerWidth}
      overscanCount={2}
    >
      {Row}
    </List>
  );
}

export function useVirtualScrollPosition() {
  const scrollPositions = useRef<Map<string, number>>(new Map());

  const saveScrollPosition = (key: string, offset: number) => {
    scrollPositions.current.set(key, offset);
  };

  const getScrollPosition = (key: string): number => {
    return scrollPositions.current.get(key) || 0;
  };

  const clearScrollPosition = (key: string) => {
    scrollPositions.current.delete(key);
  };

  return {
    saveScrollPosition,
    getScrollPosition,
    clearScrollPosition,
  };
}
