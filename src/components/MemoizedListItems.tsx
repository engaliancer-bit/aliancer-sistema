import React from 'react';
import { Edit2, Trash2, Package, Droplet, FileText, User } from 'lucide-react';

// ============================================
// PRODUCT LIST ITEM
// ============================================
interface ProductRowProps {
  product: {
    id: string;
    code?: string;
    name: string;
    description?: string;
    unit?: string;
    sale_price?: number;
    material_cost?: number;
    recipes?: { name: string };
  };
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export const ProductRow = React.memo(
  function ProductRow({ product, onEdit, onDelete }: ProductRowProps) {
    return (
      <tr className="hover:bg-gray-50" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 48px' }}>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {product.code || '-'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
          {product.name}
        </td>
        <td className="px-6 py-4 text-sm text-gray-500">
          {product.description || '-'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {product.unit || '-'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {product.recipes?.name || '-'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {product.sale_price ? `R$ ${product.sale_price.toFixed(2)}` : '-'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {product.material_cost ? `R$ ${product.material_cost.toFixed(2)}` : '-'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <button
            onClick={() => onEdit(product.id)}
            className="text-blue-600 hover:text-blue-900 mr-3"
            aria-label="Editar"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(product.id)}
            className="text-red-600 hover:text-red-900"
            aria-label="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </td>
      </tr>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.product.id === nextProps.product.id &&
      prevProps.product.name === nextProps.product.name &&
      prevProps.product.sale_price === nextProps.product.sale_price &&
      prevProps.product.material_cost === nextProps.product.material_cost
    );
  }
);

// ============================================
// MATERIAL LIST ITEM
// ============================================
interface MaterialRowProps {
  material: {
    id: string;
    name: string;
    description?: string;
    unit?: string;
    brand?: string;
    unit_cost?: number;
    suppliers?: { name: string };
  };
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onViewStock?: (material: any) => void;
}

export const MaterialRow = React.memo(
  function MaterialRow({ material, onEdit, onDelete, onViewStock }: MaterialRowProps) {
    return (
      <tr className="hover:bg-gray-50" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 48px' }}>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
          {material.name}
        </td>
        <td className="px-6 py-4 text-sm text-gray-500">
          {material.description || '-'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {material.unit || '-'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {material.brand || '-'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {material.unit_cost ? `R$ ${material.unit_cost.toFixed(2)}` : '-'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {material.suppliers?.name || '-'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <button
            onClick={() => onEdit(material.id)}
            className="text-blue-600 hover:text-blue-900 mr-3"
            aria-label="Editar"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(material.id)}
            className="text-red-600 hover:text-red-900 mr-3"
            aria-label="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {onViewStock && (
            <button
              onClick={() => onViewStock(material)}
              className="text-green-600 hover:text-green-900"
              aria-label="Ver Estoque"
            >
              <Package className="h-4 w-4" />
            </button>
          )}
        </td>
      </tr>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.material.id === nextProps.material.id &&
      prevProps.material.name === nextProps.material.name &&
      prevProps.material.unit_cost === nextProps.material.unit_cost
    );
  }
);

// ============================================
// QUOTE CARD
// ============================================
interface QuoteCardProps {
  quote: {
    id: string;
    status: string;
    created_at: string;
    total_value?: number;
    customers?: { name: string };
  };
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onApprove?: (id: string) => void;
}

export const QuoteCard = React.memo(
  function QuoteCard({ quote, onEdit, onDelete, onApprove }: QuoteCardProps) {
    const statusColors = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };

    return (
      <div
        className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
        style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 200px' }}
      >
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-medium text-gray-900">
              {quote.customers?.name || 'Cliente não informado'}
            </h3>
            <p className="text-sm text-gray-500">
              {new Date(quote.created_at).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <span
            className={`px-2 py-1 text-xs rounded-full ${
              statusColors[quote.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'
            }`}
          >
            {quote.status === 'pending' ? 'Pendente' : quote.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
          </span>
        </div>

        <div className="mb-3">
          <p className="text-2xl font-bold text-gray-900">
            {quote.total_value ? `R$ ${quote.total_value.toFixed(2)}` : 'Valor não calculado'}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onEdit(quote.id)}
            className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700"
          >
            Editar
          </button>
          {onApprove && quote.status === 'pending' && (
            <button
              onClick={() => onApprove(quote.id)}
              className="flex-1 bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700"
            >
              Aprovar
            </button>
          )}
          <button
            onClick={() => onDelete(quote.id)}
            className="bg-red-600 text-white px-3 py-2 rounded text-sm hover:bg-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.quote.id === nextProps.quote.id &&
      prevProps.quote.status === nextProps.quote.status &&
      prevProps.quote.total_value === nextProps.quote.total_value
    );
  }
);

// ============================================
// CUSTOMER ROW
// ============================================
interface CustomerRowProps {
  customer: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    cpf?: string;
    cnpj?: string;
    person_type?: string;
  };
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export const CustomerRow = React.memo(
  function CustomerRow({ customer, onEdit, onDelete }: CustomerRowProps) {
    return (
      <tr className="hover:bg-gray-50" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 48px' }}>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
          {customer.name}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {customer.person_type === 'legal' ? 'Jurídica' : 'Física'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {customer.cpf || customer.cnpj || '-'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {customer.phone || '-'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {customer.email || '-'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <button
            onClick={() => onEdit(customer.id)}
            className="text-blue-600 hover:text-blue-900 mr-3"
            aria-label="Editar"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(customer.id)}
            className="text-red-600 hover:text-red-900"
            aria-label="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </td>
      </tr>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.customer.id === nextProps.customer.id &&
      prevProps.customer.name === nextProps.customer.name &&
      prevProps.customer.email === nextProps.customer.email &&
      prevProps.customer.phone === nextProps.customer.phone
    );
  }
);

// ============================================
// PRODUCTION ORDER ROW
// ============================================
interface ProductionOrderRowProps {
  order: {
    id: string;
    order_number?: number;
    status?: string;
    created_at: string;
    total_quantity?: number;
    produced_quantity?: number;
    products?: { name: string };
    customers?: { name: string };
  };
  onEdit: (id: string) => void;
  onView?: (id: string) => void;
}

export const ProductionOrderRow = React.memo(
  function ProductionOrderRow({ order, onEdit, onView }: ProductionOrderRowProps) {
    const progress =
      order.total_quantity && order.produced_quantity
        ? (order.produced_quantity / order.total_quantity) * 100
        : 0;

    return (
      <tr className="hover:bg-gray-50" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 48px' }}>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
          #{order.order_number || order.id.slice(0, 8)}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {order.customers?.name || '-'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {order.products?.name || '-'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {order.produced_quantity || 0} / {order.total_quantity || 0}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <span className="text-xs">{progress.toFixed(0)}%</span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {new Date(order.created_at).toLocaleDateString('pt-BR')}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <button
            onClick={() => onEdit(order.id)}
            className="text-blue-600 hover:text-blue-900 mr-3"
            aria-label="Editar"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          {onView && (
            <button
              onClick={() => onView(order.id)}
              className="text-green-600 hover:text-green-900"
              aria-label="Ver Detalhes"
            >
              <FileText className="h-4 w-4" />
            </button>
          )}
        </td>
      </tr>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.order.id === nextProps.order.id &&
      prevProps.order.status === nextProps.order.status &&
      prevProps.order.produced_quantity === nextProps.order.produced_quantity &&
      prevProps.order.total_quantity === nextProps.order.total_quantity
    );
  }
);

// ============================================
// DELIVERY ROW
// ============================================
interface DeliveryRowProps {
  delivery: {
    id: string;
    delivery_date: string;
    status?: string;
    customers?: { name: string };
    quote_id?: string;
  };
  onEdit: (id: string) => void;
  onComplete?: (id: string) => void;
}

export const DeliveryRow = React.memo(
  function DeliveryRow({ delivery, onEdit, onComplete }: DeliveryRowProps) {
    const statusColors = {
      open: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      closed: 'bg-green-100 text-green-800',
    };

    return (
      <tr className="hover:bg-gray-50" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 48px' }}>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {new Date(delivery.delivery_date).toLocaleDateString('pt-BR')}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {delivery.customers?.name || '-'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm">
          <span
            className={`px-2 py-1 text-xs rounded-full ${
              statusColors[delivery.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'
            }`}
          >
            {delivery.status === 'open'
              ? 'Aberta'
              : delivery.status === 'in_progress'
              ? 'Em Andamento'
              : 'Finalizada'}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <button
            onClick={() => onEdit(delivery.id)}
            className="text-blue-600 hover:text-blue-900 mr-3"
            aria-label="Editar"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          {onComplete && delivery.status !== 'closed' && (
            <button
              onClick={() => onComplete(delivery.id)}
              className="text-green-600 hover:text-green-900"
              aria-label="Finalizar"
            >
              <Package className="h-4 w-4" />
            </button>
          )}
        </td>
      </tr>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.delivery.id === nextProps.delivery.id &&
      prevProps.delivery.status === nextProps.delivery.status
    );
  }
);
