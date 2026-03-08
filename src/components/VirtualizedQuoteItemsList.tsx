import { memo } from 'react';
import * as ReactWindow from 'react-window';
import { Trash2 } from 'lucide-react';

const { FixedSizeList } = ReactWindow;

interface QuoteItem {
  id?: string;
  tempId?: string;
  item_type: 'product' | 'material' | 'composition';
  item_name?: string;
  quantity: number;
  proposed_price: number;
  notes?: string;
}

interface VirtualizedQuoteItemsListProps {
  items: QuoteItem[];
  onRemoveItem: (tempId: string) => void;
}

interface ItemRowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    items: QuoteItem[];
    onRemoveItem: (tempId: string) => void;
  };
}

const ItemRow = memo(({ index, style, data }: ItemRowProps) => {
  const { items, onRemoveItem } = data;
  const item = items[index];

  const itemTypeLabel =
    item.item_type === 'product' ? 'Produto' :
    item.item_type === 'material' ? 'Insumo' : 'Composição';

  const subtotal = Number(item.quantity) * item.proposed_price;

  return (
    <div style={style} className="px-2">
      <div className="bg-white p-3 rounded border border-gray-200 flex justify-between items-center h-full">
        <div className="flex-1">
          <div className="font-medium text-sm text-gray-900">
            {item.item_name} - {Number(item.quantity).toFixed(2)} un. x R$ {item.proposed_price.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">
            Tipo: {itemTypeLabel}
            {item.notes && ` | ${item.notes}`}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-semibold text-[#0A7EC2]">
            R$ {subtotal.toFixed(2)}
          </span>
          <button
            type="button"
            onClick={() => onRemoveItem(item.tempId!)}
            className="text-red-600 hover:text-red-800"
            aria-label="Remover item"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
});

ItemRow.displayName = 'ItemRow';

export const VirtualizedQuoteItemsList = memo(({ items, onRemoveItem }: VirtualizedQuoteItemsListProps) => {
  const itemData = {
    items,
    onRemoveItem,
  };

  return (
    <FixedSizeList
      height={Math.min(items.length * 80, 480)}
      itemCount={items.length}
      itemSize={80}
      width="100%"
      itemData={itemData}
    >
      {ItemRow}
    </FixedSizeList>
  );
});

VirtualizedQuoteItemsList.displayName = 'VirtualizedQuoteItemsList';

interface SimpleQuoteItemRowProps {
  item: QuoteItem;
  onRemoveItem: (tempId: string) => void;
}

const SimpleQuoteItemRow = memo(({ item, onRemoveItem }: SimpleQuoteItemRowProps) => {
  const itemTypeLabel =
    item.item_type === 'product' ? 'Produto' :
    item.item_type === 'material' ? 'Insumo' : 'Composição';

  const subtotal = Number(item.quantity) * item.proposed_price;

  return (
    <div className="bg-white p-3 rounded border border-gray-200 flex justify-between items-center">
      <div className="flex-1">
        <div className="font-medium text-sm text-gray-900">
          {item.item_name} - {Number(item.quantity).toFixed(2)} un. x R$ {item.proposed_price.toFixed(2)}
        </div>
        <div className="text-xs text-gray-500">
          Tipo: {itemTypeLabel}
          {item.notes && ` | ${item.notes}`}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-semibold text-[#0A7EC2]">
          R$ {subtotal.toFixed(2)}
        </span>
        <button
          type="button"
          onClick={() => onRemoveItem(item.tempId!)}
          className="text-red-600 hover:text-red-800"
          aria-label="Remover item"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.item.tempId === nextProps.item.tempId &&
    prevProps.item.quantity === nextProps.item.quantity &&
    prevProps.item.proposed_price === nextProps.item.proposed_price &&
    prevProps.item.item_name === nextProps.item.item_name &&
    prevProps.item.notes === nextProps.item.notes
  );
});

SimpleQuoteItemRow.displayName = 'SimpleQuoteItemRow';

interface SimpleQuoteItemsListProps {
  items: QuoteItem[];
  onRemoveItem: (tempId: string) => void;
}

export const SimpleQuoteItemsList = memo(({ items, onRemoveItem }: SimpleQuoteItemsListProps) => {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <SimpleQuoteItemRow
          key={item.tempId}
          item={item}
          onRemoveItem={onRemoveItem}
        />
      ))}
    </div>
  );
});

SimpleQuoteItemsList.displayName = 'SimpleQuoteItemsList';
