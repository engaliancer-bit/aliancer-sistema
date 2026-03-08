import React, { useMemo, useCallback } from 'react';
import { FixedSizeList } from 'react-window';

interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  width?: string;
}

interface VirtualizedTableOptimizedProps<T> {
  data: T[];
  columns: Column<T>[];
  rowHeight?: number;
  height?: number;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  className?: string;
}

const TableRow = React.memo(function TableRow<T>({
  item,
  columns,
  onClick,
  style,
}: {
  item: T;
  columns: Column<T>[];
  onClick?: () => void;
  style: React.CSSProperties;
}) {
  return (
    <div
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid #e5e7eb',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
      className="hover:bg-gray-50"
    >
      {columns.map((column, index) => (
        <div
          key={`${column.key}-${index}`}
          style={{
            flex: column.width || '1',
            padding: '0.75rem 1rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {column.render(item)}
        </div>
      ))}
    </div>
  );
});

export function VirtualizedTableOptimized<T>({
  data,
  columns,
  rowHeight = 56,
  height = 600,
  onRowClick,
  emptyMessage = 'Nenhum registro encontrado',
  className = '',
}: VirtualizedTableOptimizedProps<T>) {
  const Row = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const item = data[index];
      const handleClick = onRowClick ? () => onRowClick(item) : undefined;

      return (
        <TableRow
          item={item}
          columns={columns}
          onClick={handleClick}
          style={style}
        />
      );
    },
    [data, columns, onRowClick]
  );

  const tableHeight = useMemo(() => {
    return Math.min(height, data.length * rowHeight + 50);
  }, [height, data.length, rowHeight]);

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={`border border-gray-200 rounded-lg overflow-hidden ${className}`}>
      <div
        style={{
          display: 'flex',
          backgroundColor: '#f9fafb',
          borderBottom: '2px solid #e5e7eb',
          fontWeight: '600',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        {columns.map((column, index) => (
          <div
            key={`header-${column.key}-${index}`}
            style={{
              flex: column.width || '1',
              padding: '0.75rem 1rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {column.header}
          </div>
        ))}
      </div>

      <FixedSizeList
        height={tableHeight}
        itemCount={data.length}
        itemSize={rowHeight}
        width="100%"
        overscanCount={5}
      >
        {Row}
      </FixedSizeList>
    </div>
  );
}

interface SimpleVirtualizedListProps<T> {
  data: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight?: number;
  height?: number;
  emptyMessage?: string;
  className?: string;
}

export function SimpleVirtualizedList<T>({
  data,
  renderItem,
  itemHeight = 80,
  height = 600,
  emptyMessage = 'Nenhum registro encontrado',
  className = '',
}: SimpleVirtualizedListProps<T>) {
  const Row = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      return (
        <div style={style}>
          {renderItem(data[index], index)}
        </div>
      );
    },
    [data, renderItem]
  );

  const listHeight = useMemo(() => {
    return Math.min(height, data.length * itemHeight);
  }, [height, data.length, itemHeight]);

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={className}>
      <FixedSizeList
        height={listHeight}
        itemCount={data.length}
        itemSize={itemHeight}
        width="100%"
        overscanCount={3}
      >
        {Row}
      </FixedSizeList>
    </div>
  );
}
