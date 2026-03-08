
import { CheckCircle, AlertCircle } from 'lucide-react';

interface DeliveryItem {
  id: string;
  item_type: string;
  quantity: number;
  loaded_quantity: number;
  item_name?: string;
  is_from_composition?: boolean;
  parent_composition_name?: string;
  products?: { name: string; code?: string; unit?: string };
  materials?: { name: string; unit?: string };
  compositions?: { name: string };
}

interface DeliveryItemsLoaderProps {
  deliveryId: string;
  items: DeliveryItem[];
  onToggleItem: (itemId: string, currentLoadedQty: number, totalQuantity: number) => void;
  onUpdateQuantity: (itemId: string, loadedQuantity: number) => void;
}

export default function DeliveryItemsLoader({
  deliveryId,
  items,
  onToggleItem,
  onUpdateQuantity
}: DeliveryItemsLoaderProps) {
  const loadedCount = items.filter(item => item.loaded_quantity >= item.quantity).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-900">Itens para Carregar</h4>
        <div className="text-sm text-gray-600">
          {loadedCount} de {items.length} carregados
        </div>
      </div>
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {items.length > 0 ? (
          items.map((item) => {
            const itemName = item.item_name ||
                             (item.products?.name) ||
                             (item.materials?.name) ||
                             (item.compositions?.name) ||
                             'Item sem nome';
            const itemCode = item.products?.code || '';
            const itemUnit = item.materials?.unit || item.products?.unit || 'un';
            const isFullyLoaded = item.loaded_quantity >= item.quantity;
            const isPartiallyLoaded = item.loaded_quantity > 0 && item.loaded_quantity < item.quantity;

            // Determinar cor de fundo e borda
            let bgColor = 'bg-white';
            let borderColor = 'border-gray-300';

            if (isFullyLoaded) {
              bgColor = 'bg-green-50';
              borderColor = 'border-green-400';
            } else if (isPartiallyLoaded) {
              bgColor = 'bg-yellow-50';
              borderColor = 'border-yellow-400';
            }

            return (
              <div key={item.id} className={`${bgColor} border ${borderColor} rounded-lg p-4 hover:shadow-md transition-all`}>
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => onToggleItem(item.id, item.loaded_quantity, item.quantity)}
                    className="mt-1 flex-shrink-0"
                  >
                    <div className={`w-6 h-6 border-2 ${borderColor} rounded flex items-center justify-center ${isFullyLoaded ? 'bg-green-600' : 'bg-white'} hover:opacity-80 transition-all`}>
                      {isFullyLoaded && (
                        <CheckCircle className="h-5 w-5 text-white" />
                      )}
                    </div>
                  </button>

                  {/* Informações do item */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-medium text-gray-900">
                        {itemName}
                        {itemCode && <span className="text-gray-500 text-sm ml-2">({itemCode})</span>}
                      </div>
                      {item.is_from_composition && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                          Composição: {item.parent_composition_name}
                        </span>
                      )}
                      {isFullyLoaded && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                          Carregado
                        </span>
                      )}
                      {isPartiallyLoaded && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">
                          Parcial
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Tipo: {item.item_type === 'product' ? 'Produto' :
                             item.item_type === 'material' ? 'Insumo' :
                             item.item_type === 'equipment' ? 'Equipamento' :
                             item.item_type === 'service' ? 'Serviço' :
                             item.item_type === 'labor' ? 'Mão de Obra' : 'Composição'}
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="text-sm">
                        <span className="text-gray-600">Necessário:</span>
                        <span className="font-semibold text-gray-900 ml-1">{item.quantity} {itemUnit}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-600">Carregado:</span>
                        <span className={`font-semibold ml-1 ${isFullyLoaded ? 'text-green-600' : isPartiallyLoaded ? 'text-yellow-600' : 'text-gray-400'}`}>
                          {item.loaded_quantity || 0} {itemUnit}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Input de quantidade personalizada */}
                  {!isFullyLoaded && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <input
                        type="number"
                        min="0"
                        max={item.quantity}
                        step="0.01"
                        value={item.loaded_quantity || 0}
                        onChange={(e) => {
                          const newQty = parseFloat(e.target.value) || 0;
                          if (newQty <= item.quantity) {
                            onUpdateQuantity(item.id, newQty);
                          }
                        }}
                        className="w-20 px-2 py-1 border rounded text-sm text-center"
                        placeholder="Qtd"
                      />
                      <button
                        onClick={() => onUpdateQuantity(item.id, item.quantity)}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs whitespace-nowrap"
                        title="Carregar tudo"
                      >
                        Tudo
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 p-6 rounded flex flex-col items-center gap-2">
            <AlertCircle className="h-8 w-8 text-yellow-600" />
            <p className="text-yellow-800 font-medium">Aguardando criação dos itens...</p>
          </div>
        )}
      </div>
    </div>
  );
}
