import { useState } from 'react';
import { RotateCcw, Package, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ProductReturnManagerProps {
  saleId: string;
  saleOriginType: string;
  saleOriginId: string;
  customerId: string | null;
  onReturnComplete?: () => void;
}

interface QuoteItem {
  id: string;
  product_id: string | null;
  material_id: string | null;
  quantity: number;
  proposed_price: number;
  delivered_quantity: number;
  product_name?: string;
  material_name?: string;
  item_type: string;
}

export default function ProductReturnManager({
  saleId,
  saleOriginType,
  saleOriginId,
  customerId,
  onReturnComplete
}: ProductReturnManagerProps) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Map<string, number>>(new Map());
  const [refundValue, setRefundValue] = useState(false);
  const [notes, setNotes] = useState('');

  const loadQuoteItems = async () => {
    try {
      setLoading(true);

      const { data: items, error } = await supabase
        .from('quote_items')
        .select(`
          id,
          product_id,
          material_id,
          quantity,
          proposed_price,
          delivered_quantity,
          item_type,
          products (name),
          materials (name)
        `)
        .eq('quote_id', saleOriginId);

      if (error) throw error;

      const formattedItems: QuoteItem[] = (items || []).map(item => ({
        id: item.id,
        product_id: item.product_id,
        material_id: item.material_id,
        quantity: item.quantity,
        proposed_price: item.proposed_price,
        delivered_quantity: item.delivered_quantity || 0,
        product_name: item.products?.name,
        material_name: item.materials?.name,
        item_type: item.item_type
      }));

      setQuoteItems(formattedItems.filter(item => item.delivered_quantity > 0));
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
      alert('Erro ao carregar itens da venda');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = async () => {
    if (saleOriginType !== 'quote') {
      alert('Estorno de produtos disponível apenas para orçamentos no momento');
      return;
    }

    setShowModal(true);
    await loadQuoteItems();
  };

  const handleQuantityChange = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      const newSelected = new Map(selectedItems);
      newSelected.delete(itemId);
      setSelectedItems(newSelected);
    } else {
      setSelectedItems(new Map(selectedItems.set(itemId, quantity)));
    }
  };

  const handleProcessReturn = async () => {
    if (selectedItems.size === 0) {
      alert('Selecione pelo menos um item para estornar');
      return;
    }

    const confirmMessage = refundValue
      ? 'Confirma o estorno dos produtos E o valor correspondente na conta do cliente?'
      : 'Confirma o estorno dos produtos SEM estornar o valor?';

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setLoading(true);

      for (const [itemId, returnQuantity] of selectedItems.entries()) {
        const item = quoteItems.find(i => i.id === itemId);
        if (!item) continue;

        const newDeliveredQuantity = item.delivered_quantity - returnQuantity;

        const { error: updateError } = await supabase
          .from('quote_items')
          .update({
            delivered_quantity: newDeliveredQuantity >= 0 ? newDeliveredQuantity : 0
          })
          .eq('id', itemId);

        if (updateError) throw updateError;

        if (item.product_id) {
          const { error: stockError } = await supabase
            .from('production')
            .insert({
              product_id: item.product_id,
              quantity: returnQuantity,
              production_date: new Date().toISOString().split('T')[0],
              notes: `Devolução de venda - ${notes || 'Produto devolvido ao estoque'}`,
              production_type: 'estoque'
            });

          if (stockError) throw stockError;
        } else if (item.material_id) {
          const { error: stockError } = await supabase
            .from('material_movements')
            .insert({
              material_id: item.material_id,
              quantity: returnQuantity,
              movement_type: 'entrada',
              movement_date: new Date().toISOString().split('T')[0],
              notes: `Devolução de venda - ${notes || 'Material devolvido ao estoque'}`
            });

          if (stockError) throw stockError;
        }

        if (refundValue && customerId) {
          const refundAmount = returnQuantity * item.proposed_price;

          const { error: receivableError } = await supabase
            .from('receivables')
            .insert({
              venda_id: saleId,
              parcela_numero: 999,
              descricao: `Estorno de produto - ${item.product_name || item.material_name}`,
              valor_parcela: -refundAmount,
              status: 'pendente',
              data_vencimento: new Date().toISOString().split('T')[0],
              observacoes: notes || 'Crédito por devolução de produto'
            });

          if (receivableError) throw receivableError;
        }
      }

      alert('Estorno realizado com sucesso!');
      setShowModal(false);
      setSelectedItems(new Map());
      setNotes('');
      setRefundValue(false);

      if (onReturnComplete) {
        onReturnComplete();
      }
    } catch (error) {
      console.error('Erro ao processar estorno:', error);
      alert('Erro ao processar estorno');
    } finally {
      setLoading(false);
    }
  };

  const getTotalReturnValue = () => {
    let total = 0;
    selectedItems.forEach((quantity, itemId) => {
      const item = quoteItems.find(i => i.id === itemId);
      if (item) {
        total += quantity * item.proposed_price;
      }
    });
    return total;
  };

  return (
    <>
      <button
        onClick={handleOpenModal}
        className="flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
        title="Estornar produtos"
      >
        <RotateCcw className="w-4 h-4" />
        Estornar Produtos
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <RotateCcw className="w-6 h-6 text-orange-600" />
                    Estornar Produtos
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Selecione os produtos que deseja devolver ao estoque
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setSelectedItems(new Map());
                    setNotes('');
                    setRefundValue(false);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="text-2xl">&times;</span>
                </button>
              </div>
            </div>

            <div className="p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-gray-500">Carregando itens...</div>
                </div>
              ) : quoteItems.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>Nenhum item entregue nesta venda</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Produto/Material
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Qtd. Entregue
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Preço Unit.
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Qtd. a Estornar
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Valor
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {quoteItems.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium text-gray-900">
                                {item.product_name || item.material_name}
                              </div>
                              <div className="text-xs text-gray-500">
                                {item.item_type === 'product' ? 'Produto' : 'Material'}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-gray-900">
                              {item.delivered_quantity}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-gray-900">
                              R$ {item.proposed_price.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <input
                                type="number"
                                min="0"
                                max={item.delivered_quantity}
                                value={selectedItems.get(item.id) || 0}
                                onChange={(e) => handleQuantityChange(item.id, parseFloat(e.target.value) || 0)}
                                className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                              />
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                              R$ {((selectedItems.get(item.id) || 0) * item.proposed_price).toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={4} className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                            Valor Total do Estorno:
                          </td>
                          <td className="px-4 py-3 text-right text-lg font-bold text-orange-600">
                            R$ {getTotalReturnValue().toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="border-t border-gray-200 pt-6 space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={refundValue}
                          onChange={(e) => setRefundValue(e.target.checked)}
                          className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                            <DollarSign className="w-4 h-4 text-blue-600" />
                            Estornar também o valor na conta do cliente
                          </div>
                          <p className="text-xs text-gray-600 mt-1">
                            Se marcado, será criado um crédito de{' '}
                            <span className="font-semibold">
                              R$ {getTotalReturnValue().toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>{' '}
                            para o cliente. Se desmarcado, apenas os produtos voltam ao estoque.
                          </p>
                        </div>
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Observações (motivo do estorno)
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Ex: Sobrou material na obra, produto com defeito, etc."
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                {selectedItems.size > 0 && (
                  <span>
                    {selectedItems.size} {selectedItems.size === 1 ? 'item selecionado' : 'itens selecionados'}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setSelectedItems(new Map());
                    setNotes('');
                    setRefundValue(false);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleProcessReturn}
                  disabled={loading || selectedItems.size === 0}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Processar Estorno
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
