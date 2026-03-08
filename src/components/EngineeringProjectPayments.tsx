import React, { useState, useEffect } from 'react';
import { Plus, X, FileText, DollarSign, Calendar, Trash2, Download, Edit2, Receipt } from 'lucide-react';
import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { generateProjectPaymentReceipt } from './engineering/ProjectPaymentReceiptGenerator';

interface Payment {
  id: string;
  payment_date: string;
  value: number;
  payment_method: string;
  account_name: string;
  conta_caixa_id: string;
  notes: string;
}

interface Account {
  id: string;
  nome: string;
}

interface Project {
  id: string;
  name: string;
  customer_name: string;
  property_name: string;
  grand_total: number;
  total_received: number;
  balance: number;
  start_date: string;
}

interface EngineeringProjectPaymentsProps {
  projectId: string;
  onClose: () => void;
}

export default function EngineeringProjectPayments({ projectId, onClose }: EngineeringProjectPaymentsProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);

  const [paymentForm, setPaymentForm] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    value: '',
    payment_method: 'dinheiro',
    conta_caixa_id: '',
    notes: ''
  });

  const [generatingReceipt, setGeneratingReceipt] = useState<string | null>(null);

  const handleGenerateReceipt = async (payment: Payment) => {
    if (!project || generatingReceipt) return;
    setGeneratingReceipt(payment.id);
    try {
      const { data: settingsData } = await supabase
        .from('company_settings')
        .select('logo_url, company_name, company_address, company_phone, company_email, company_cnpj')
        .maybeSingle();

      await generateProjectPaymentReceipt(
        {
          paymentId: payment.id,
          paymentDate: payment.payment_date,
          value: payment.value,
          paymentMethod: payment.payment_method,
          accountName: payment.account_name,
          notes: payment.notes,
          projectName: project.name,
          customerName: project.customer_name,
          propertyName: project.property_name,
          grandTotal: project.grand_total,
          totalReceived: project.total_received,
          balance: project.balance,
        },
        settingsData || {}
      );
    } catch (error: any) {
      alert('Erro ao gerar recibo: ' + (error?.message || 'Erro desconhecido'));
    } finally {
      setGeneratingReceipt(null);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Carregar todos os dados em paralelo para melhor performance
      const [projectResult, paymentsResult, accountsResult] = await Promise.all([
        // Carregar dados do projeto
        supabase
          .from('engineering_projects')
          .select(`
            id,
            name,
            grand_total,
            total_received,
            balance,
            start_date,
            customer:customer_id (name),
            property:property_id (name)
          `)
          .eq('id', projectId)
          .single(),

        // Carregar pagamentos
        supabase
          .from('engineering_project_payments')
          .select(`
            id,
            payment_date,
            value,
            payment_method,
            conta_caixa_id,
            notes,
            conta_caixa:conta_caixa_id (nome)
          `)
          .eq('project_id', projectId)
          .order('payment_date', { ascending: false }),

        // Carregar contas de caixa
        supabase
          .from('contas_caixa')
          .select('id, nome')
          .order('nome')
      ]);

      // Processar resultado do projeto
      if (projectResult.error) throw projectResult.error;

      setProject({
        id: projectResult.data.id,
        name: projectResult.data.name,
        customer_name: projectResult.data.customer?.name || 'Não informado',
        property_name: projectResult.data.property?.name || 'Não informado',
        grand_total: projectResult.data.grand_total || 0,
        total_received: projectResult.data.total_received || 0,
        balance: projectResult.data.balance || 0,
        start_date: projectResult.data.start_date
      });

      // Processar resultado dos pagamentos
      if (paymentsResult.error) throw paymentsResult.error;

      setPayments((paymentsResult.data || []).map(p => ({
        id: p.id,
        payment_date: p.payment_date,
        value: p.value,
        payment_method: p.payment_method,
        account_name: p.conta_caixa?.nome || 'Não informado',
        conta_caixa_id: p.conta_caixa_id || '',
        notes: p.notes || ''
      })));

      // Processar resultado das contas
      if (accountsResult.error) throw accountsResult.error;

      setAccounts(accountsResult.data || []);

    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      alert('Erro ao carregar dados do projeto: ' + (error?.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevenir duplo clique
    if (submitting) {
      return;
    }

    if (!paymentForm.value || Number(paymentForm.value) <= 0) {
      alert('Por favor, informe um valor válido');
      return;
    }

    if (!paymentForm.conta_caixa_id) {
      alert('Por favor, selecione uma conta de caixa');
      return;
    }

    setSubmitting(true);

    try {
      if (editingPayment) {
        // Atualizar pagamento existente
        const { error } = await supabase
          .from('engineering_project_payments')
          .update({
            payment_date: paymentForm.payment_date,
            value: Number(paymentForm.value),
            payment_method: paymentForm.payment_method,
            conta_caixa_id: paymentForm.conta_caixa_id,
            notes: paymentForm.notes || null
          })
          .eq('id', editingPayment.id);

        if (error) throw error;

        alert('Pagamento atualizado com sucesso!');
      } else {
        // Criar novo pagamento
        const { error } = await supabase
          .from('engineering_project_payments')
          .insert([{
            project_id: projectId,
            payment_date: paymentForm.payment_date,
            value: Number(paymentForm.value),
            payment_method: paymentForm.payment_method,
            conta_caixa_id: paymentForm.conta_caixa_id,
            notes: paymentForm.notes || null
          }]);

        if (error) throw error;

        alert('Pagamento registrado com sucesso!');
      }

      setShowPaymentForm(false);
      setEditingPayment(null);
      setPaymentForm({
        payment_date: new Date().toISOString().split('T')[0],
        value: '',
        payment_method: 'dinheiro',
        conta_caixa_id: '',
        notes: ''
      });
      await loadData();
    } catch (error: any) {
      console.error('Erro ao salvar recebimento:', error);
      alert('Erro ao salvar recebimento: ' + (error?.message || 'Erro desconhecido'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditPayment = (payment: Payment) => {
    setEditingPayment(payment);
    setPaymentForm({
      payment_date: payment.payment_date,
      value: payment.value.toString(),
      payment_method: payment.payment_method,
      conta_caixa_id: payment.conta_caixa_id,
      notes: payment.notes || ''
    });
    setShowPaymentForm(true);
  };

  const handleCancelEdit = () => {
    setEditingPayment(null);
    setPaymentForm({
      payment_date: new Date().toISOString().split('T')[0],
      value: '',
      payment_method: 'dinheiro',
      conta_caixa_id: '',
      notes: ''
    });
    setShowPaymentForm(false);
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Deseja realmente excluir este pagamento?')) return;

    try {
      const { error } = await supabase
        .from('engineering_project_payments')
        .delete()
        .eq('id', paymentId);

      if (error) throw error;

      alert('Pagamento excluído com sucesso!');
      await loadData();
    } catch (error: any) {
      console.error('Erro ao excluir pagamento:', error);
      alert('Erro ao excluir pagamento: ' + (error?.message || 'Erro desconhecido'));
    }
  };

  const exportToPDF = () => {
    if (!project) return;

    const doc = new jsPDF();

    // Cabeçalho
    doc.setFontSize(18);
    doc.text('Extrato de Projeto - Engenharia', 14, 20);

    doc.setFontSize(10);
    doc.text(`Projeto: ${project.name}`, 14, 30);
    doc.text(`Cliente: ${project.customer_name}`, 14, 36);
    doc.text(`Propriedade: ${project.property_name}`, 14, 42);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 48);

    // Resumo Financeiro
    doc.setFontSize(12);
    doc.text('Resumo Financeiro', 14, 60);

    const summaryData = [
      ['Valor Total do Projeto', `R$ ${project.grand_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
      ['Total Recebido', `R$ ${project.total_received.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
      ['Saldo Pendente', `R$ ${project.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]
    ];

    (doc as any).autoTable({
      startY: 65,
      head: [['Descrição', 'Valor']],
      body: summaryData,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] }
    });

    // Histórico de Pagamentos
    if (payments.length > 0) {
      doc.setFontSize(12);
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.text('Histórico de Pagamentos', 14, finalY);

      const paymentData = payments.map(payment => [
        new Date(payment.payment_date).toLocaleDateString('pt-BR'),
        `R$ ${payment.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        payment.payment_method,
        payment.account_name,
        payment.notes || '-'
      ]);

      (doc as any).autoTable({
        startY: finalY + 5,
        head: [['Data', 'Valor', 'Método', 'Conta', 'Observações']],
        body: paymentData,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] }
      });
    }

    doc.save(`extrato_projeto_${project.name.replace(/\s+/g, '_')}.pdf`);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const paymentMethodLabels: Record<string, string> = {
    dinheiro: 'Dinheiro',
    pix: 'PIX',
    transferencia: 'Transferência',
    cartao_credito: 'Cartão de Crédito',
    cartao_debito: 'Cartão de Débito',
    cheque: 'Cheque',
    boleto: 'Boleto'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Cabeçalho */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex justify-between items-start">
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-2">Pagamentos do Projeto</h2>
            <p className="text-blue-100">{project.name}</p>
            <p className="text-sm text-blue-200 mt-1">Cliente: {project.customer_name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-blue-800 rounded-lg p-2 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Resumo Financeiro */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-blue-600 font-medium">Valor Total</span>
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-blue-900">
                R$ {project.grand_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-green-600 font-medium">Total Recebido</span>
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-green-900">
                R$ {project.total_received.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className={`rounded-lg p-4 border ${
              project.balance > 0 ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${
                  project.balance > 0 ? 'text-orange-600' : 'text-gray-600'
                }`}>
                  Saldo Pendente
                </span>
                <Calendar className={`h-5 w-5 ${
                  project.balance > 0 ? 'text-orange-600' : 'text-gray-600'
                }`} />
              </div>
              <p className={`text-2xl font-bold ${
                project.balance > 0 ? 'text-orange-900' : 'text-gray-900'
              }`}>
                R$ {project.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setShowPaymentForm(!showPaymentForm)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-5 w-5" />
              Adicionar Pagamento
            </button>
            <button
              onClick={exportToPDF}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="h-5 w-5" />
              Exportar Extrato (PDF)
            </button>
          </div>

          {/* Formulário de Novo Pagamento */}
          {showPaymentForm && (
            <div className="bg-blue-50 rounded-lg p-6 mb-6 border border-blue-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {editingPayment ? 'Editar Pagamento' : 'Novo Pagamento'}
              </h3>

              {accounts.length === 0 && (
                <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded-lg mb-4">
                  <p className="text-sm font-medium">Atenção: Nenhuma conta de caixa cadastrada</p>
                  <p className="text-xs mt-1">Para registrar pagamentos, você precisa primeiro cadastrar contas de caixa no módulo "Fluxo de Caixa".</p>
                </div>
              )}

              <form onSubmit={handleAddPayment} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data do Pagamento
                    </label>
                    <input
                      type="date"
                      value={paymentForm.payment_date}
                      onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Valor *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={paymentForm.value}
                      onChange={(e) => setPaymentForm({ ...paymentForm, value: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0.00"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Método de Pagamento
                    </label>
                    <select
                      value={paymentForm.payment_method}
                      onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="dinheiro">Dinheiro</option>
                      <option value="pix">PIX</option>
                      <option value="transferencia">Transferência</option>
                      <option value="cartao_credito">Cartão de Crédito</option>
                      <option value="cartao_debito">Cartão de Débito</option>
                      <option value="cheque">Cheque</option>
                      <option value="boleto">Boleto</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Conta de Caixa * {accounts.length === 0 && <span className="text-red-500 text-xs">(Nenhuma conta cadastrada)</span>}
                    </label>
                    <select
                      value={paymentForm.conta_caixa_id}
                      onChange={(e) => setPaymentForm({ ...paymentForm, conta_caixa_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                      disabled={accounts.length === 0}
                    >
                      <option value="">
                        {accounts.length === 0 ? 'Nenhuma conta disponível' : 'Selecione uma conta'}
                      </option>
                      {accounts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observações
                  </label>
                  <textarea
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Observações sobre o pagamento..."
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Salvando...
                      </>
                    ) : (
                      editingPayment ? 'Atualizar Pagamento' : 'Salvar Pagamento'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={submitting}
                    className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Lista de Pagamentos */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Histórico de Pagamentos ({payments.length})
            </h3>
            {payments.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">Nenhum pagamento registrado ainda</p>
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-lg font-semibold text-green-600">
                            R$ {payment.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            {paymentMethodLabels[payment.payment_method] || payment.payment_method}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p>
                            <span className="font-medium">Data:</span>{' '}
                            {new Date(payment.payment_date).toLocaleDateString('pt-BR')}
                          </p>
                          <p>
                            <span className="font-medium">Conta:</span> {payment.account_name}
                          </p>
                          {payment.notes && (
                            <p>
                              <span className="font-medium">Obs:</span> {payment.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleGenerateReceipt(payment)}
                          disabled={generatingReceipt === payment.id}
                          className="text-gray-600 hover:bg-gray-50 p-2 rounded-lg transition-colors disabled:opacity-50"
                          title="Gerar recibo PDF"
                        >
                          {generatingReceipt === payment.id ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-400 border-t-transparent" />
                          ) : (
                            <Receipt className="h-5 w-5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleEditPayment(payment)}
                          className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                          title="Editar pagamento"
                        >
                          <Edit2 className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDeletePayment(payment.id)}
                          className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                          title="Excluir pagamento"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
