import React, { useState, useEffect } from 'react';
import { X, FileText, Download, Calendar, DollarSign, TrendingUp, TrendingDown, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Work {
  id: string;
  customer_id: string;
  work_name: string;
  contract_type: 'pacote_fechado' | 'administracao';
  total_contract_value: number;
  status: string;
  customers?: {
    name: string;
    person_type: string;
    cpf?: string;
    cnpj?: string;
    phone?: string;
    email?: string;
  };
}

interface Payment {
  id: string;
  payment_date: string;
  payment_amount: number;
  payment_method: string;
  notes: string;
  origin_description: string;
}

interface WorkItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  added_date: string;
  item_type: string;
  unit?: string;
}

interface StatementProps {
  work: Work;
  onClose: () => void;
}

export default function ConstructionWorkStatement({ work, onClose }: StatementProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalItemsCost, setTotalItemsCost] = useState(0);

  useEffect(() => {
    loadStatementData();
  }, [work.id]);

  async function loadStatementData() {
    setLoading(true);
    try {
      if (work.contract_type === 'pacote_fechado') {
        await Promise.all([loadPayments(), loadWorkItems()]);
      } else {
        await Promise.all([loadPayments(), loadWorkItems()]);
      }
    } catch (error) {
      console.error('Erro ao carregar dados do extrato:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadPayments() {
    try {
      const [revenueResult, cashFlowResult] = await Promise.all([
        supabase
          .from('customer_revenue')
          .select('id, payment_date, payment_amount, payment_method, notes, origin_description, receipt_number')
          .eq('origin_type', 'construction_work')
          .eq('origin_id', work.id)
          .order('payment_date', { ascending: true }),
        supabase
          .from('cash_flow')
          .select('id, date, amount, description, notes, payment_method_id')
          .eq('type', 'income')
          .eq('construction_work_id', work.id)
          .is('customer_revenue_id', null)
          .order('date', { ascending: true }),
      ]);

      if (revenueResult.error) throw revenueResult.error;
      if (cashFlowResult.error) throw cashFlowResult.error;

      const revenuePayments: Payment[] = (revenueResult.data || []).map((p) => ({
        id: p.id,
        payment_date: p.payment_date,
        payment_amount: p.payment_amount,
        payment_method: p.payment_method || '',
        notes: p.notes || '',
        origin_description: p.origin_description || '',
      }));

      const cashFlowPayments: Payment[] = (cashFlowResult.data || []).map((p) => ({
        id: `cf-${p.id}`,
        payment_date: p.date,
        payment_amount: p.amount,
        payment_method: p.payment_method_id || '',
        notes: p.notes || p.description || '',
        origin_description: p.description || 'Recebimento via Receitas/Despesas',
      }));

      const allPayments = [...revenuePayments, ...cashFlowPayments].sort(
        (a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime()
      );

      setPayments(allPayments);

      const total = allPayments.reduce((sum, p) => sum + (p.payment_amount || 0), 0);
      setTotalPaid(total);
    } catch (error) {
      console.error('Erro ao carregar pagamentos:', error);
    }
  }

  async function loadWorkItems() {
    try {
      const { data, error } = await supabase
        .from('construction_work_items')
        .select('*')
        .eq('work_id', work.id)
        .order('added_date', { ascending: true });

      if (error) throw error;

      const itemsData = data || [];
      setWorkItems(itemsData);

      const total = itemsData.reduce((sum, item) => sum + (item.total_price || 0), 0);
      setTotalItemsCost(total);
    } catch (error) {
      console.error('Erro ao carregar itens da obra:', error);
    }
  }

  function formatCurrency(value: number): string {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatDate(date: string): string {
    return new Date(date).toLocaleDateString('pt-BR');
  }

  function getPaymentMethodLabel(method: string): string {
    const methods: { [key: string]: string } = {
      pix: 'PIX',
      dinheiro: 'Dinheiro',
      cartao_credito: 'Cartão de Crédito',
      cartao_debito: 'Cartão de Débito',
      transferencia: 'Transferência',
      boleto: 'Boleto',
      cheque: 'Cheque',
    };
    return methods[method] || method;
  }

  function handlePrint() {
    window.print();
  }

  const balance = work.contract_type === 'pacote_fechado'
    ? work.total_contract_value - totalPaid
    : totalPaid - totalItemsCost;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 print:relative print:bg-white print:p-0">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto print:max-h-full print:shadow-none">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between print:static print:border-0 print:pb-6">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Extrato da Obra</h2>
              <p className="text-sm text-gray-600">{work.work_name}</p>
            </div>
          </div>
          <div className="flex gap-2 print:hidden">
            <button
              onClick={handlePrint}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Imprimir
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Carregando extrato...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Informações da Obra */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Informações da Obra</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Obra:</span>
                    <p className="font-medium">{work.work_name}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Cliente:</span>
                    <p className="font-medium">{work.customers?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Tipo de Contrato:</span>
                    <p className="font-medium">
                      {work.contract_type === 'pacote_fechado' ? 'Pacote Fechado' : 'Por Administração'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Status:</span>
                    <p className="font-medium capitalize">{work.status.replace('_', ' ')}</p>
                  </div>
                </div>
              </div>

              {/* Extrato Financeiro para Pacote Fechado */}
              {work.contract_type === 'pacote_fechado' && (
                <>
                  {/* Resumo Financeiro */}
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Resumo Financeiro</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                          <FileText className="w-4 h-4" />
                          Valor do Contrato
                        </div>
                        <p className="text-xl font-bold text-blue-600">
                          R$ {formatCurrency(work.total_contract_value)}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                          <TrendingUp className="w-4 h-4" />
                          Total Recebido
                        </div>
                        <p className="text-xl font-bold text-green-600">
                          R$ {formatCurrency(totalPaid)}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                          <DollarSign className="w-4 h-4" />
                          Saldo Devedor
                        </div>
                        <p className={`text-xl font-bold ${balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                          R$ {formatCurrency(balance)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Extrato de Pagamentos */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Pagamentos Recebidos</h3>
                    {payments.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                        <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-600">Nenhum pagamento registrado</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Data</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Descrição</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Forma Pgto.</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Valor</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {payments.map((payment) => (
                              <tr key={payment.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                  {formatDate(payment.payment_date)}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {payment.notes || payment.origin_description || 'Pagamento da obra'}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                  {getPaymentMethodLabel(payment.payment_method)}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-green-600">
                                  R$ {formatCurrency(payment.payment_amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50">
                            <tr>
                              <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                                Total Recebido:
                              </td>
                              <td className="px-4 py-3 text-sm font-bold text-green-600 text-right">
                                R$ {formatCurrency(totalPaid)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Extrato Interno de Itens Entregues */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Itens Entregues (Custo Interno)</h3>
                    {workItems.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                        <Package className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-600">Nenhum item entregue</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Data</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Item</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Tipo</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Qtd.</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Preço Unit.</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Total</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {workItems.map((item) => (
                              <tr key={item.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                  {formatDate(item.added_date)}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {item.item_name}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 capitalize">
                                  {item.item_type}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                                  {item.quantity} {item.unit || ''}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                                  R$ {formatCurrency(item.unit_price)}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-blue-600">
                                  R$ {formatCurrency(item.total_price)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50">
                            <tr>
                              <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                                Custo Total dos Itens:
                              </td>
                              <td className="px-4 py-3 text-sm font-bold text-blue-600 text-right">
                                R$ {formatCurrency(totalItemsCost)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Extrato para Por Administração */}
              {work.contract_type === 'administracao' && (
                <>
                  {/* Resumo Financeiro */}
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Resumo Financeiro</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                          <TrendingUp className="w-4 h-4" />
                          Total Recebido
                        </div>
                        <p className="text-xl font-bold text-green-600">
                          R$ {formatCurrency(totalPaid)}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                          <TrendingDown className="w-4 h-4" />
                          Total em Itens
                        </div>
                        <p className="text-xl font-bold text-red-600">
                          R$ {formatCurrency(totalItemsCost)}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                          <DollarSign className="w-4 h-4" />
                          Saldo
                        </div>
                        <p className={`text-xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          R$ {formatCurrency(balance)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Movimentação Completa */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Movimentação da Obra</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Data</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Descrição</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Tipo</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Entrada</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Saída</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {/* Merge payments and items chronologically */}
                          {[
                            ...payments.map(p => ({
                              type: 'payment' as const,
                              date: p.payment_date,
                              data: p
                            })),
                            ...workItems.map(i => ({
                              type: 'item' as const,
                              date: i.added_date,
                              data: i
                            }))
                          ]
                            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                            .map((transaction, index) => (
                              <tr key={`${transaction.type}-${index}`} className="hover:bg-gray-50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                  {formatDate(transaction.date)}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {transaction.type === 'payment'
                                    ? (transaction.data as Payment).notes || 'Pagamento recebido'
                                    : (transaction.data as WorkItem).item_name
                                  }
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                  {transaction.type === 'payment'
                                    ? getPaymentMethodLabel((transaction.data as Payment).payment_method)
                                    : `Entrega - ${(transaction.data as WorkItem).item_type}`
                                  }
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-green-600">
                                  {transaction.type === 'payment'
                                    ? `R$ ${formatCurrency((transaction.data as Payment).payment_amount)}`
                                    : '-'
                                  }
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-red-600">
                                  {transaction.type === 'item'
                                    ? `R$ ${formatCurrency((transaction.data as WorkItem).total_price)}`
                                    : '-'
                                  }
                                </td>
                              </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-50">
                          <tr>
                            <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                              Totais:
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-green-600 text-right">
                              R$ {formatCurrency(totalPaid)}
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-red-600 text-right">
                              R$ {formatCurrency(totalItemsCost)}
                            </td>
                          </tr>
                          <tr className="bg-blue-50">
                            <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                              Saldo Final:
                            </td>
                            <td className={`px-4 py-3 text-sm font-bold text-right ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              R$ {formatCurrency(balance)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @media print {
          @page {
            margin: 1cm;
          }
        }
      `}</style>
    </div>
  );
}
