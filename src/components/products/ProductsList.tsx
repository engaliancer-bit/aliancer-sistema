import { memo, useCallback } from 'react';
import { FixedSizeList } from 'react-window';
import { Edit2, Trash2, Copy } from 'lucide-react';

export interface ProductListItem {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  unit: string;
  product_type: 'artifact' | 'premolded' | 'ferragens_diversas';
  final_sale_price: number | null;
  minimum_stock: number | null;
  recipe_name: string | null;
  updated_at: string;
}

interface ProductsListProps {
  products: ProductListItem[];
  onEdit: (product: ProductListItem) => void;
  onDelete: (id: string) => void;
  onClone: (product: ProductListItem) => void;
  loading?: boolean;
}

interface RowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    products: ProductListItem[];
    onEdit: (product: ProductListItem) => void;
    onDelete: (id: string) => void;
    onClone: (product: ProductListItem) => void;
  };
}

const ProductRow = memo(({ index, style, data }: RowProps) => {
  const { products, onEdit, onDelete, onClone } = data;
  const product = products[index];

  const productTypeLabel =
    product.product_type === 'premolded'
      ? 'Pré-Moldado'
      : product.product_type === 'ferragens_diversas'
      ? 'Ferragens Diversas'
      : 'Artefato';

  const productTypeColor =
    product.product_type === 'premolded'
      ? 'bg-purple-100 text-purple-800'
      : product.product_type === 'ferragens_diversas'
      ? 'bg-blue-100 text-blue-800'
      : 'bg-gray-100 text-gray-800';

  return (
    <div style={style} className="px-2">
      <div className="bg-white hover:bg-gray-50 border-b border-gray-200 px-6 py-4 grid grid-cols-8 gap-4 items-center">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onClone(product)}
            className="text-green-600 hover:text-green-900"
            title="Clonar produto"
            aria-label="Clonar produto"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(product)}
            className="text-blue-600 hover:text-blue-900"
            title="Editar produto"
            aria-label="Editar produto"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(product.id)}
            className="text-red-600 hover:text-red-900"
            title="Deletar produto"
            aria-label="Deletar produto"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <div className="text-sm text-gray-500">{product.code || '-'}</div>
        <div className="col-span-2">
          <div className="text-sm font-medium text-gray-900 truncate">{product.name}</div>
          {product.description && (
            <div className="text-xs text-gray-500 truncate">{product.description}</div>
          )}
        </div>
        <div>
          <span
            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${productTypeColor}`}
          >
            {productTypeLabel}
          </span>
        </div>
        <div className="text-sm text-gray-500">{product.unit}</div>
        <div className="text-sm text-gray-500">{product.recipe_name || '-'}</div>
        <div className="text-right">
          <div className="text-sm font-medium text-green-600">
            {product.final_sale_price
              ? `R$ ${parseFloat(product.final_sale_price.toString()).toFixed(2)}`
              : '-'}
          </div>
          {product.minimum_stock && (
            <div className="text-xs text-gray-500">Mín: {product.minimum_stock}</div>
          )}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  const prevProduct = prevProps.data.products[prevProps.index];
  const nextProduct = nextProps.data.products[nextProps.index];

  return (
    prevProduct?.id === nextProduct?.id &&
    prevProduct?.name === nextProduct?.name &&
    prevProduct?.final_sale_price === nextProduct?.final_sale_price &&
    prevProduct?.updated_at === nextProduct?.updated_at
  );
});

ProductRow.displayName = 'ProductRow';

export const ProductsList = memo(({ products, onEdit, onDelete, onClone, loading }: ProductsListProps) => {
  const itemData = useCallback(() => ({
    products,
    onEdit,
    onDelete,
    onClone,
  }), [products, onEdit, onDelete, onClone]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-blue-600"></div>
        <p className="mt-2 text-gray-600">Carregando produtos...</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <p className="text-gray-600">Nenhum produto encontrado</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 grid grid-cols-8 gap-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
        <div>Ações</div>
        <div>Código</div>
        <div className="col-span-2">Nome</div>
        <div>Tipo</div>
        <div>Unidade</div>
        <div>Traço</div>
        <div className="text-right">Preço / Est. Mín.</div>
      </div>
      <FixedSizeList
        height={Math.min(products.length * 80, 600)}
        itemCount={products.length}
        itemSize={80}
        width="100%"
        itemData={itemData()}
      >
        {ProductRow}
      </FixedSizeList>
    </div>
  );
});

ProductsList.displayName = 'ProductsList';
