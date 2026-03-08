import React from 'react';

interface OptimizedTableRowProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const OptimizedTableRow = React.memo(function OptimizedTableRow({
  children,
  onClick,
  className = '',
  style,
}: OptimizedTableRowProps) {
  return (
    <tr
      onClick={onClick}
      className={className}
      style={{
        contentVisibility: 'auto',
        containIntrinsicSize: 'auto 48px',
        ...style,
      }}
    >
      {children}
    </tr>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.className === nextProps.className &&
    prevProps.onClick === nextProps.onClick &&
    JSON.stringify(prevProps.children) === JSON.stringify(nextProps.children)
  );
});

interface OptimizedTableCellProps {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
  onClick?: (e: React.MouseEvent) => void;
}

export const OptimizedTableCell = React.memo(function OptimizedTableCell({
  children,
  className = '',
  colSpan,
  onClick,
}: OptimizedTableCellProps) {
  return (
    <td className={className} colSpan={colSpan} onClick={onClick}>
      {children}
    </td>
  );
});

interface OptimizedCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const OptimizedCard = React.memo(function OptimizedCard({
  children,
  className = '',
  onClick,
}: OptimizedCardProps) {
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        contentVisibility: 'auto',
        containIntrinsicSize: 'auto 200px',
      }}
    >
      {children}
    </div>
  );
});

interface VirtualizedTableProps {
  data: any[];
  renderRow: (item: any, index: number) => React.ReactNode;
  headers: React.ReactNode;
  className?: string;
  emptyMessage?: string;
}

export const VirtualizedTable = React.memo(function VirtualizedTable({
  data,
  renderRow,
  headers,
  className = '',
  emptyMessage = 'Nenhum registro encontrado',
}: VirtualizedTableProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className={className}>
        <thead>{headers}</thead>
        <tbody
          style={{
            contentVisibility: 'auto',
          }}
        >
          {data.map((item, index) => renderRow(item, index))}
        </tbody>
      </table>
    </div>
  );
});
