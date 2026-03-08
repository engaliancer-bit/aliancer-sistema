import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  X,
  DollarSign,
  Calendar,
  User,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit2,
  Save
} from 'lucide-react';
import { format } from 'date-fns';

interface PayrollSchedule {
  schedule_id: string;
  year: number;
  month: number;
  employee_id: string;
  employee_name: string;
  employee_role: string;
  base_salary: number;
  benefits: number;
  total_amount: number;
  expected_payment_date: string;
  is_overdue: boolean;
}

interface PayrollConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function PayrollConfirmationModal({
  isOpen,
  onClose,
  onConfirm
}: PayrollConfirmationModalProps) {
  const [pendingPayrolls, setPendingPayrolls] = useState<PayrollSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [editingBenefits, setEditingBenefits] = useState<{ [key: string]: number }>({});
  const [selectedPayrolls, setSelectedPayrolls] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      loadPendingPayrolls();
    }
  }, [isOpen]);

  async function loadPendingPayrolls() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('v_pending_payroll_current_month')
        .select('*');

      if (error) throw error;

      if (data && data.length > 0) {
        setPendingPayrolls(data);
        // Inicializar benefícios editáveis com valores atuais
        const initialBenefits: { [key: string]: number } = {};
        data.forEach(p => {
          initialBenefits[p.schedule_id] = p.benefits || 0;
        });
        setEditingBenefits(initialBenefits);
      } else {
        setPendingPayrolls([]);
      }
    } catch (error) {
      console.error('Erro ao carregar folha de pagamento:', error);
    } finally {
      setLoading(false);
    }
  }

  async function confirmPayroll(scheduleId: string, benefits: number) {
    try {
      const { data, error } = await supabase.rpc('confirm_payroll_payment', {
        p_schedule_id: scheduleId,
        p_benefits: benefits,
        p_payment_date: format(new Date(), 'yyyy-MM-dd'),
        p_payment_method: 'transferencia'
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Erro ao confirmar pagamento:', error);
      return false;
    }
  }

  async function skipPayroll(scheduleId: string) {
    try {
      const { error } = await supabase.rpc('skip_payroll_payment', {
        p_schedule_id: scheduleId,
        p_reason: 'Pulado pelo usuário'
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Erro ao pular pagamento:', error);
      return false;
    }
  }

  async function handleConfirmSelected() {
    if (selectedPayrolls.size === 0) {
      alert('Selecione pelo menos um colaborador');
      return;
    }

    if (!confirm(`Confirmar pagamento de ${selectedPayrolls.size} colaborador(es)?`)) {
      return;
    }

    setProcessing(true);
    let successCount = 0;
    let errorCount = 0;

    for (const scheduleId of Array.from(selectedPayrolls)) {
      const benefits = editingBenefits[scheduleId] || 0;
      const success = await confirmPayroll(scheduleId, benefits);
      if (success) {
        successCount++;
      } else {
        errorCount++;
      }
    }

    setProcessing(false);

    if (errorCount === 0) {
      alert(`${successCount} pagamento(s) confirmado(s) com sucesso!`);
      setSelectedPayrolls(new Set());
      await loadPendingPayrolls();
      onConfirm();
    } else {
      alert(`${successCount} confirmado(s), ${errorCount} erro(s)`);
      await loadPendingPayrolls();
    }
  }

  async function handleSkipSelected() {
    if (selectedPayrolls.size === 0) {
      alert('Selecione pelo menos um colaborador');
      return;
    }

    if (!confirm(`Pular pagamento de ${selectedPayrolls.size} colaborador(es)?`)) {
      return;
    }

    setProcessing(true);
    let successCount = 0;

    for (const scheduleId of Array.from(selectedPayrolls)) {
      const success = await skipPayroll(scheduleId);
      if (success) successCount++;
    }

    setProcessing(false);
    alert(`${successCount} pagamento(s) pulado(s)`);
    setSelectedPayrolls(new Set());
    await loadPendingPayrolls();
  }

  function toggleSelection(scheduleId: string) {
    const newSelected = new Set(selectedPayrolls);
    if (newSelected.has(scheduleId)) {
      newSelected.delete(scheduleId);
    } else {
      newSelected.add(scheduleId);
    }
    setSelectedPayrolls(newSelected);
  }

  function toggleSelectAll() {
    if (selectedPayrolls.size === pendingPayrolls.length) {
      setSelectedPayrolls(new Set());
    } else {
      setSelectedPayrolls(new Set(pendingPayrolls.map(p => p.schedule_id)));
    }
  }

  function updateBenefits(scheduleId: string, value: number) {
    setEditingBenefits(prev => ({
      ...prev,
      [scheduleId]: value
    }));
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-blue-600" />
              Pagamento de Salários - {format(new Date(), 'MMMM/yyyy')}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Confirme os pagamentos mensais dos colaboradores CLT
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : pendingPayrolls.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">
                Não há salários pendentes para este mês
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Todos os pagamentos foram processados ou não há colaboradores CLT cadastrados
              </p>
            </div>
          ) : (
            <>
              {/* Alertas */}
              {pendingPayrolls.some(p => p.is_overdue) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-900">Pagamentos Atrasados</p>
                    <p className="text-sm text-red-700 mt-1">
                      Há {pendingPayrolls.filter(p => p.is_overdue).length} pagamento(s) com data vencida
                    </p>
                  </div>
                </div>
              )}

              {/* Ações em lote */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedPayrolls.size === pendingPayrolls.length && pendingPayrolls.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">
                    {selectedPayrolls.size} de {pendingPayrolls.length} selecionado(s)
                  </span>
                </div>
                {selectedPayrolls.size > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSkipSelected}
                      disabled={processing}
                      className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4 inline mr-1" />
                      Pular Selecionados
                    </button>
                    <button
                      onClick={handleConfirmSelected}
                      disabled={processing}
                      className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4 inline mr-1" />
                      Confirmar Selecionados
                    </button>
                  </div>
                )}
              </div>

              {/* Lista de colaboradores */}
              <div className="space-y-3">
                {pendingPayrolls.map((payroll) => {
                  const benefits = editingBenefits[payroll.schedule_id] || 0;
                  const total = payroll.base_salary + benefits;

                  return (
                    <div
                      key={payroll.schedule_id}
                      className={`border rounded-lg p-4 transition-all ${
                        selectedPayrolls.has(payroll.schedule_id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      } ${payroll.is_overdue ? 'border-l-4 border-l-red-500' : ''}`}
                    >
                      <div className="flex items-start gap-4">
                        <input
                          type="checkbox"
                          checked={selectedPayrolls.has(payroll.schedule_id)}
                          onChange={() => toggleSelection(payroll.schedule_id)}
                          className="mt-1 w-4 h-4 text-blue-600 rounded"
                        />

                        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                          {/* Colaborador */}
                          <div className="md:col-span-2">
                            <div className="flex items-center gap-2 mb-1">
                              <User className="w-4 h-4 text-gray-400" />
                              <span className="font-medium text-gray-900">
                                {payroll.employee_name}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">{payroll.employee_role}</p>
                            <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                              <Calendar className="w-3 h-3" />
                              Previsto: {format(new Date(payroll.expected_payment_date), 'dd/MM/yyyy')}
                              {payroll.is_overdue && (
                                <span className="ml-2 text-red-600 font-medium">ATRASADO</span>
                              )}
                            </div>
                          </div>

                          {/* Valores */}
                          <div>
                            <div className="text-sm text-gray-600 mb-2">
                              Salário Base
                            </div>
                            <div className="text-lg font-bold text-gray-900">
                              R$ {payroll.base_salary.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                          </div>

                          {/* Benefícios Editável */}
                          <div>
                            <div className="text-sm text-gray-600 mb-2 flex items-center gap-1">
                              Benefícios
                              <Edit2 className="w-3 h-3 text-blue-600" />
                            </div>
                            <input
                              type="number"
                              value={benefits}
                              onChange={(e) => updateBenefits(payroll.schedule_id, parseFloat(e.target.value) || 0)}
                              step="0.01"
                              min="0"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="0,00"
                            />
                          </div>
                        </div>

                        {/* Total */}
                        <div className="text-right">
                          <div className="text-sm text-gray-600 mb-1">Total</div>
                          <div className="text-xl font-bold text-green-600">
                            R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Resumo */}
              <div className="mt-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Selecionado:</span>
                  <span className="text-2xl font-bold text-gray-900">
                    R$ {pendingPayrolls
                      .filter(p => selectedPayrolls.has(p.schedule_id))
                      .reduce((sum, p) => sum + p.base_salary + (editingBenefits[p.schedule_id] || 0), 0)
                      .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && pendingPayrolls.length > 0 && (
          <div className="border-t p-6 bg-gray-50 flex justify-between items-center">
            <button
              onClick={onClose}
              className="px-6 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Fechar
            </button>
            <div className="flex gap-3">
              <button
                onClick={handleSkipSelected}
                disabled={processing || selectedPayrolls.size === 0}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Pular Selecionados
              </button>
              <button
                onClick={handleConfirmSelected}
                disabled={processing || selectedPayrolls.size === 0}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Processando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Confirmar Pagamentos
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
