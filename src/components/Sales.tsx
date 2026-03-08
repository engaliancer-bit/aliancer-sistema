import { useState, useEffect } from 'react';
import {
  Plus, Save, X, Search, CheckCircle, Clock, AlertCircle,
  FileText, DollarSign, Eye, CreditCard, Upload, Download
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Customer {
  id: string;
  name: string;
  cpf_cnpj?: string;
  phone?: string;
}

interface Sale {
  id: string;
  sale_number: string;
  sale_date: string;
  customer_id: string;
  customer?: { name: string };
  total: number;
  payment_status: string;
  payment_confirmation_status: 'pendente' | 'parcial' | 'confirmado';
  is_from_quote: boolean;
  is_standalone_sale: boolean;
  quote_id?: string;
  status: string;
  notes?: string;
}

interface PaymentInstallment {
  id: string;
  sale_id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  is_received: boolean;
  received_at?: string;
  received_by?: string;
  notes?: string;
  payment_method?: string;
  cheque_id?: string;
}

interface Cheque {
  id?: string;
  sale_id: string;
  installment_id?: string;
  cheque_number: string;
  bank_name: string;
  bank_code?: string;
  agency?: string;
  account?: string;
  cheque_holder: string;
  issue_date: string;
  due_date: string;
  amount: number;
  status: 'a_depositar' | 'depositado' | 'compensado' | 'devolvido';
  attachment_url?: string;
  attachment_type?: 'photo' | 'pdf';
  notes?: string;
}

interface Quote {
  id: string;
  created_at: string;
  customer_id: string;
  customer?: { name: string };
  total_value?: number;
  approval_status: 'pendente' | 'aprovado' | 'rejeitado';
  approved_at?: string;
  sale_created: boolean;
}

export default function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [installments, setInstallments] = useState<PaymentInstallment[]>([]);
  const [cheques, setCheques] = useState<Cheque[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [paymentTab, setPaymentTab] = useState<'pendente' | 'parcial' | 'confirmado'>('pendente');
  const [viewMode, setViewMode] = useState<'list' | 'installments'>('list');

  const [showChequeModal, setShowChequeModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<PaymentInstallment | null>(null);

  const [chequeFormData, setChequeFormData] = useState<Cheque>({
    sale_id: '',
    cheque_number: '',
    bank_name: '',
    bank_code: '',
    agency: '',
    account: '',
    cheque_holder: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: new Date().toISOString().split('T')[0],
    amount: 0,
    status: 'a_depositar',
    notes: ''
  });

  const [receiveFormData, setReceiveFormData] = useState({
    received_by: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [
      { data: salesData },
      { data: quotesData },
      { data: customersData }
    ] = await Promise.all([
      supabase
        .from('sales')
        .select('*, customer:customer_id(name)')
        .order('sale_date', { ascending: false }),
      supabase
        .from('quotes')
        .select('*, customer:customer_id(name)')
        .eq('approval_status', 'aprovado')
        .order('approved_at', { ascending: false }),
      supabase
        .from('customers')
        .select('*')
        .order('name')
    ]);

    if (salesData) setSales(salesData);
    if (quotesData) setQuotes(quotesData);
    if (customersData) setCustomers(customersData);
  }

  async function handleApproveQuote(quoteId: string) {
    if (!confirm('Deseja aprovar este orçamento e criar uma venda?')) return;

    const { error } = await supabase
      .from('quotes')
      .update({
        approval_status: 'aprovado',
        approved_at: new Date().toISOString(),
        approved_by: 'Sistema'
      })
      .eq('id', quoteId);

    if (error) {
      alert('Erro ao aprovar orçamento: ' + error.message);
      return;
    }

    alert('Orçamento aprovado! A venda será criada automaticamente.');
    loadData();
  }

  async function handleViewSaleDetails(sale: Sale) {
    setSelectedSale(sale);
    setViewMode('installments');

    const { data: installmentsData } = await supabase
      .from('sale_payment_installments')
      .select('*')
      .eq('sale_id', sale.id)
      .order('installment_number');

    const { data: chequesData } = await supabase
      .from('sale_cheques')
      .select('*')
      .eq('sale_id', sale.id);

    if (installmentsData) setInstallments(installmentsData);
    if (chequesData) setCheques(chequesData);
  }

  async function handleReceiveInstallment(installment: PaymentInstallment) {
    const { data: paymentMethod } = await supabase
      .from('sale_payments')
      .select('payment_method')
      .eq('sale_id', installment.sale_id)
      .single();

    if (paymentMethod?.payment_method === 'cheque') {
      const existingCheque = cheques.find(c => c.installment_id === installment.id);

      if (!existingCheque) {
        setChequeFormData({
          ...chequeFormData,
          sale_id: installment.sale_id,
          installment_id: installment.id,
          amount: installment.amount,
          due_date: installment.due_date
        });
        setSelectedInstallment(installment);
        setShowChequeModal(true);
        return;
      }
    }

    setSelectedInstallment(installment);
    setShowReceiveModal(true);
  }

  async function handleConfirmReceive() {
    if (!selectedInstallment) return;

    const { error } = await supabase
      .from('sale_payment_installments')
      .update({
        is_received: true,
        received_at: new Date().toISOString(),
        received_by: receiveFormData.received_by || 'Sistema',
        notes: receiveFormData.notes
      })
      .eq('id', selectedInstallment.id);

    if (error) {
      alert('Erro ao confirmar recebimento: ' + error.message);
      return;
    }

    alert('Recebimento confirmado! Entrada criada no fluxo de caixa.');
    setShowReceiveModal(false);
    setReceiveFormData({ received_by: '', notes: '' });

    if (selectedSale) {
      handleViewSaleDetails(selectedSale);
    }
    loadData();
  }

  async function handleSaveCheque() {
    if (!chequeFormData.cheque_number || !chequeFormData.bank_name || !chequeFormData.cheque_holder) {
      alert('Preencha todos os campos obrigatórios do cheque');
      return;
    }

    const { data: chequeData, error } = await supabase
      .from('sale_cheques')
      .insert(chequeFormData)
      .select()
      .single();

    if (error) {
      alert('Erro ao salvar cheque: ' + error.message);
      return;
    }

    if (selectedInstallment) {
      await supabase
        .from('sale_payment_installments')
        .update({ cheque_id: chequeData.id })
        .eq('id', selectedInstallment.id);
    }

    alert('Cheque cadastrado com sucesso!');
    setShowChequeModal(false);
    setChequeFormData({
      sale_id: '',
      cheque_number: '',
      bank_name: '',
      bank_code: '',
      agency: '',
      account: '',
      cheque_holder: '',
      issue_date: new Date().toISOString().split('T')[0],
      due_date: new Date().toISOString().split('T')[0],
      amount: 0,
      status: 'a_depositar',
      notes: ''
    });

    setSelectedInstallment(null);
    setShowReceiveModal(true);
  }

  async function handleUploadChequeFile(installmentId: string, file: File) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${installmentId}_${Date.now()}.${fileExt}`;
    const filePath = `cheques/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('attachments')
      .upload(filePath, file);

    if (uploadError) {
      alert('Erro ao fazer upload do arquivo: ' + uploadError.message);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('attachments')
      .getPublicUrl(filePath);

    const cheque = cheques.find(c => c.installment_id === installmentId);
    if (cheque) {
      await supabase
        .from('sale_cheques')
        .update({
          attachment_url: publicUrl,
          attachment_type: fileExt === 'pdf' ? 'pdf' : 'photo'
        })
        .eq('id', cheque.id);

      alert('Arquivo anexado com sucesso!');
      if (selectedSale) handleViewSaleDetails(selectedSale);
    }
  }

  const filteredSales = sales.filter(sale => {
    const matchSearch = !searchTerm ||
      sale.sale_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchPaymentStatus = sale.payment_confirmation_status === paymentTab;

    return matchSearch && matchPaymentStatus;
  });

  const filteredQuotes = quotes.filter(quote => {
    return !quote.sale_created;
  });

  function getStatusColor(status: string) {
    switch (status) {
      case 'pendente': return 'bg-yellow-100 text-yellow-800';
      case 'parcial': return 'bg-blue-100 text-blue-800';
      case 'confirmado': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case 'pendente': return 'Pendente';
      case 'parcial': return 'Parcialmente Pago';
      case 'confirmado': return 'Pago';
      default: return status;
    }
  }

  function getChequeStatusColor(status: string) {
    switch (status) {
      case 'a_depositar': return 'bg-yellow-100 text-yellow-800';
      case 'depositado': return 'bg-blue-100 text-blue-800';
      case 'compensado': return 'bg-green-100 text-green-800';
      case 'devolvido': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  if (viewMode === 'installments' && selectedSale) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => {
                setViewMode('list');
                setSelectedSale(null);
              }}
              className="text-blue-600 hover:text-blue-800 mb-2 flex items-center space-x-1"
            >
              <X className="h-4 w-4" />
              <span>Voltar para lista</span>
            </button>
            <h2 className="text-2xl font-bold text-gray-900">
              Venda {selectedSale.sale_number}
            </h2>
            <p className="text-sm text-gray-600">
              Cliente: {selectedSale.customer?.name} | Total: R$ {selectedSale.total.toFixed(2)}
            </p>
          </div>
          <div className="text-right">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(selectedSale.payment_confirmation_status)}`}>
              {getStatusLabel(selectedSale.payment_confirmation_status)}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Parcelas do Pagamento</h3>

            <div className="space-y-3">
              {installments.map((installment) => {
                const cheque = cheques.find(c => c.installment_id === installment.id);
                const isOverdue = !installment.is_received && new Date(installment.due_date) < new Date();

                return (
                  <div
                    key={installment.id}
                    className={`border rounded-lg p-4 ${installment.is_received ? 'bg-green-50 border-green-200' : isOverdue ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <span className="font-semibold text-lg">
                            Parcela {installment.installment_number}
                          </span>
                          {installment.is_received ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : isOverdue ? (
                            <AlertCircle className="h-5 w-5 text-red-600" />
                          ) : (
                            <Clock className="h-5 w-5 text-yellow-600" />
                          )}
                        </div>

                        <div className="mt-2 space-y-1 text-sm text-gray-600">
                          <p>
                            <span className="font-medium">Vencimento:</span>{' '}
                            {new Date(installment.due_date).toLocaleDateString('pt-BR')}
                          </p>
                          <p>
                            <span className="font-medium">Valor:</span>{' '}
                            <span className="text-lg font-semibold text-gray-900">
                              R$ {installment.amount.toFixed(2)}
                            </span>
                          </p>

                          {installment.is_received && (
                            <>
                              <p>
                                <span className="font-medium text-green-700">Recebido em:</span>{' '}
                                {new Date(installment.received_at!).toLocaleDateString('pt-BR')} às{' '}
                                {new Date(installment.received_at!).toLocaleTimeString('pt-BR')}
                              </p>
                              {installment.received_by && (
                                <p>
                                  <span className="font-medium">Confirmado por:</span> {installment.received_by}
                                </p>
                              )}
                            </>
                          )}

                          {cheque && (
                            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded">
                              <p className="font-medium text-blue-900 mb-1 flex items-center">
                                <CreditCard className="h-4 w-4 mr-1" />
                                Cheque #{cheque.cheque_number}
                              </p>
                              <div className="text-xs space-y-1">
                                <p>Banco: {cheque.bank_name} {cheque.bank_code ? `(${cheque.bank_code})` : ''}</p>
                                <p>Titular: {cheque.cheque_holder}</p>
                                <p>Data Emissão: {new Date(cheque.issue_date).toLocaleDateString('pt-BR')}</p>
                                <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold mt-1 ${getChequeStatusColor(cheque.status)}`}>
                                  {cheque.status.replace('_', ' ').toUpperCase()}
                                </span>
                                {cheque.attachment_url && (
                                  <a
                                    href={cheque.attachment_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 mt-2"
                                  >
                                    <Download className="h-3 w-3" />
                                    <span>Ver anexo</span>
                                  </a>
                                )}
                              </div>
                            </div>
                          )}

                          {installment.notes && (
                            <p className="text-xs italic mt-2">Obs: {installment.notes}</p>
                          )}
                        </div>
                      </div>

                      {!installment.is_received && (
                        <button
                          onClick={() => handleReceiveInstallment(installment)}
                          className="ml-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
                        >
                          <CheckCircle className="h-4 w-4" />
                          <span>Confirmar Recebimento</span>
                        </button>
                      )}

                      {!installment.is_received && cheque && !cheque.attachment_url && (
                        <label className="ml-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer flex items-center space-x-2">
                          <Upload className="h-4 w-4" />
                          <span>Anexar Cheque</span>
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadChequeFile(installment.id, file);
                            }}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {installments.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <FileText className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                <p>Nenhuma parcela encontrada para esta venda.</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal de Cadastro de Cheque */}
        {showChequeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-screen overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Informações do Cheque</h3>
                <button onClick={() => setShowChequeModal(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Número do Cheque *
                    </label>
                    <input
                      type="text"
                      value={chequeFormData.cheque_number}
                      onChange={(e) => setChequeFormData({ ...chequeFormData, cheque_number: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Banco *
                    </label>
                    <input
                      type="text"
                      value={chequeFormData.bank_name}
                      onChange={(e) => setChequeFormData({ ...chequeFormData, bank_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Código do Banco
                    </label>
                    <input
                      type="text"
                      value={chequeFormData.bank_code}
                      onChange={(e) => setChequeFormData({ ...chequeFormData, bank_code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Agência
                    </label>
                    <input
                      type="text"
                      value={chequeFormData.agency}
                      onChange={(e) => setChequeFormData({ ...chequeFormData, agency: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Conta
                    </label>
                    <input
                      type="text"
                      value={chequeFormData.account}
                      onChange={(e) => setChequeFormData({ ...chequeFormData, account: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Titular *
                    </label>
                    <input
                      type="text"
                      value={chequeFormData.cheque_holder}
                      onChange={(e) => setChequeFormData({ ...chequeFormData, cheque_holder: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Data de Emissão *
                    </label>
                    <input
                      type="date"
                      value={chequeFormData.issue_date}
                      onChange={(e) => setChequeFormData({ ...chequeFormData, issue_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Data de Vencimento *
                    </label>
                    <input
                      type="date"
                      value={chequeFormData.due_date}
                      onChange={(e) => setChequeFormData({ ...chequeFormData, due_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Valor *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={chequeFormData.amount}
                      onChange={(e) => setChequeFormData({ ...chequeFormData, amount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={chequeFormData.status}
                      onChange={(e) => setChequeFormData({ ...chequeFormData, status: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="a_depositar">A Depositar</option>
                      <option value="depositado">Depositado</option>
                      <option value="compensado">Compensado</option>
                      <option value="devolvido">Devolvido</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observações
                  </label>
                  <textarea
                    value={chequeFormData.notes}
                    onChange={(e) => setChequeFormData({ ...chequeFormData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex justify-end space-x-4">
                  <button
                    onClick={() => setShowChequeModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveCheque}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Salvar Cheque
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Confirmação de Recebimento */}
        {showReceiveModal && selectedInstallment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Confirmar Recebimento</h3>
                <button onClick={() => setShowReceiveModal(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Parcela: {selectedInstallment.installment_number}
                </p>
                <p className="text-lg font-semibold text-gray-900">
                  Valor: R$ {selectedInstallment.amount.toFixed(2)}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Vencimento: {new Date(selectedInstallment.due_date).toLocaleDateString('pt-BR')}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirmado por
                  </label>
                  <input
                    type="text"
                    value={receiveFormData.received_by}
                    onChange={(e) => setReceiveFormData({ ...receiveFormData, received_by: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Nome de quem confirma"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observações
                  </label>
                  <textarea
                    value={receiveFormData.notes}
                    onChange={(e) => setReceiveFormData({ ...receiveFormData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Observações sobre o recebimento"
                  />
                </div>

                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                  <p className="text-sm text-yellow-700">
                    <AlertCircle className="inline h-4 w-4 mr-1" />
                    Ao confirmar, será criada automaticamente uma entrada no fluxo de caixa.
                  </p>
                </div>

                <div className="flex justify-end space-x-4">
                  <button
                    onClick={() => setShowReceiveModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmReceive}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>Confirmar Recebimento</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Vendas</h2>
          <p className="text-sm text-gray-600 mt-1">
            Gestão de vendas com controle de recebimentos
          </p>
        </div>
      </div>

      {/* Orçamentos Pendentes de Aprovação */}
      {filteredQuotes.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            Orçamentos Aguardando Aprovação ({filteredQuotes.length})
          </h3>
          <div className="space-y-2">
            {filteredQuotes.slice(0, 3).map((quote) => (
              <div key={quote.id} className="flex items-center justify-between bg-white p-3 rounded border border-blue-100">
                <div>
                  <p className="font-medium text-gray-900">
                    {quote.customer?.name}
                  </p>
                  <p className="text-sm text-gray-600">
                    Total: R$ {quote.total_value?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <button
                  onClick={() => handleApproveQuote(quote.id)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                >
                  Aprovar e Criar Venda
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Abas de Filtro por Status de Pagamento */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setPaymentTab('pendente')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                paymentTab === 'pendente'
                  ? 'border-yellow-500 text-yellow-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Clock className="h-5 w-5" />
              <span>A Pagar</span>
              <span className="ml-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
                {sales.filter(s => s.payment_confirmation_status === 'pendente').length}
              </span>
            </button>

            <button
              onClick={() => setPaymentTab('parcial')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                paymentTab === 'parcial'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <AlertCircle className="h-5 w-5" />
              <span>Parcialmente Pago</span>
              <span className="ml-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                {sales.filter(s => s.payment_confirmation_status === 'parcial').length}
              </span>
            </button>

            <button
              onClick={() => setPaymentTab('confirmado')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                paymentTab === 'confirmado'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <CheckCircle className="h-5 w-5" />
              <span>Pago</span>
              <span className="ml-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                {sales.filter(s => s.payment_confirmation_status === 'confirmado').length}
              </span>
            </button>
          </nav>
        </div>

        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Buscar por número da venda ou cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Lista de Vendas */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Número
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Origem
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {sale.sale_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(sale.sale_date).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {sale.customer?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      sale.is_from_quote ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {sale.is_from_quote ? 'Orçamento' : 'Venda Avulsa'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    R$ {sale.total.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(sale.payment_confirmation_status)}`}>
                      {getStatusLabel(sale.payment_confirmation_status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button
                      onClick={() => handleViewSaleDetails(sale)}
                      className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                    >
                      <Eye className="h-4 w-4" />
                      <span>Ver Parcelas</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredSales.length === 0 && (
          <div className="text-center py-12">
            <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma venda encontrada</h3>
            <p className="mt-1 text-sm text-gray-500">
              {paymentTab === 'pendente' && 'Não há vendas pendentes de pagamento.'}
              {paymentTab === 'parcial' && 'Não há vendas parcialmente pagas.'}
              {paymentTab === 'confirmado' && 'Não há vendas com pagamento confirmado.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
