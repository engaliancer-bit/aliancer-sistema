import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, Receipt, DollarSign, FileText, X, Search, AlertCircle, ArrowLeft, Clock, CheckCircle, List } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Customer {
  id: string;
  name: string;
  cpf: string;
}

interface DebtSource {
  type: 'quote' | 'ribbed_slab_quote' | 'construction_work';
  id: string;
  description: string;
  total_amount: number;
  paid_amount: number;
  balance: number;
}

interface Revenue {
  id: string;
  customer_id: string;
  origin_type: string;
  origin_id: string;
  origin_description: string;
  total_amount: number;
  paid_amount: number;
  balance: number;
  payment_date: string;
  payment_amount: number;
  payment_method: string;
  notes: string;
  receipt_number: string;
  created_at: string;
  customers?: {
    name: string;
    cpf: string;
  };
}

interface PendingDebt {
  type: 'quote' | 'ribbed_slab_quote' | 'construction_work';
  id: string;
  description: string;
  total_amount: number;
  paid_amount: number;
  balance: number;
  customer_id: string;
  customer_name: string;
  customer_cpf: string;
  status: string;
}

interface StatementEntry {
  id: string;
  transaction_date: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
  balance: number;
}

interface CompanySettings {
  company_name: string;
  company_cnpj: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_responsible_name: string;
  logo_url: string;
}

interface CustomerRevenueProps {
  onBack?: () => void;
}

type ActiveTab = 'lancamentos' | 'pendentes';

export default function CustomerRevenue({ onBack }: CustomerRevenueProps = {}) {
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pendingDebts, setPendingDebts] = useState<PendingDebt[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [debtSources, setDebtSources] = useState<DebtSource[]>([]);
  const [selectedDebt, setSelectedDebt] = useState<DebtSource | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showStatement, setShowStatement] = useState(false);
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);
  const [statementEntries, setStatementEntries] = useState<StatementEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingRevenue, setEditingRevenue] = useState<Revenue | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('lancamentos');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStartDate, setFilterStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [filterEndDate, setFilterEndDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
  );
  const [totalExpenses, setTotalExpenses] = useState(0);

  const submittingRef = useRef(false);

  const customersMap = useMemo(
    () => new Map(customers.map((c) => [c.id, c])),
    [customers]
  );

  const [paymentForm, setPaymentForm] = useState({
    payment_amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'dinheiro',
    notes: ''
  });

  const paymentMethods = [
    { value: 'dinheiro', label: 'Dinheiro' },
    { value: 'pix', label: 'PIX' },
    { value: 'cartao_credito', label: 'Cartao de Credito' },
    { value: 'cartao_debito', label: 'Cartao de Debito' },
    { value: 'boleto', label: 'Boleto' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'transferencia', label: 'Transferencia Bancaria' }
  ];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadRevenues();
    }
  }, [filterStartDate, filterEndDate]);

  async function loadData() {
    setLoading(true);
    await Promise.all([
      loadRevenues(),
      loadCustomers(),
      loadCompanySettings()
    ]);
    setLoading(false);
  }

  async function loadRevenues() {
    const t0 = performance.now();
    const { data, error } = await supabase
      .from('customer_revenue')
      .select(
        'id, customer_id, origin_type, origin_id, origin_description, total_amount, paid_amount, balance, ' +
        'payment_date, payment_amount, payment_method, notes, receipt_number, created_at'
      )
      .gte('payment_date', filterStartDate)
      .lte('payment_date', filterEndDate)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRevenues(data as Revenue[]);
    }
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[receitas:load_list] queryTime=${(performance.now() - t0).toFixed(1)}ms rowCount=${data?.length ?? 0}`);
    }
  }

  async function loadCustomers() {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, cpf')
      .order('name');

    if (!error && data) {
      setCustomers(data);
    }
  }

  async function loadCompanySettings() {
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      setCompanySettings(data);
    }
  }

  async function loadAllPendingDebts() {
    const debts: PendingDebt[] = [];

    const [quotesRes, ribbedRes, worksRes] = await Promise.all([
      supabase
        .from('quotes')
        .select('id, customer_id, structure_description, total_value, status')
        .eq('status', 'approved'),
      supabase
        .from('ribbed_slab_quotes')
        .select('id, customer_id, name, total_value, status')
        .eq('status', 'approved'),
      supabase
        .from('construction_works')
        .select('id, customer_id, work_name, contract_type, total_contract_value, status')
        .in('status', ['em_andamento', 'concluido', 'planejamento']),
    ]);

    const quoteIds = (quotesRes.data || []).map((q: any) => q.id);
    const ribbedIds = (ribbedRes.data || []).map((q: any) => q.id);
    const workIds = (worksRes.data || [])
      .filter((w: any) => w.contract_type === 'pacote_fechado')
      .map((w: any) => w.id);

    const [quotePaysRes, ribbedPaysRes, workPaysRes] = await Promise.all([
      quoteIds.length > 0
        ? supabase
            .from('customer_revenue')
            .select('origin_id, payment_amount')
            .eq('origin_type', 'quote')
            .in('origin_id', quoteIds)
        : Promise.resolve({ data: [] }),
      ribbedIds.length > 0
        ? supabase
            .from('customer_revenue')
            .select('origin_id, payment_amount')
            .eq('origin_type', 'ribbed_slab_quote')
            .in('origin_id', ribbedIds)
        : Promise.resolve({ data: [] }),
      workIds.length > 0
        ? supabase
            .from('customer_revenue')
            .select('origin_id, payment_amount')
            .eq('origin_type', 'construction_work')
            .in('origin_id', workIds)
        : Promise.resolve({ data: [] }),
    ]);

    const sumByOrigin = (rows: any[]) => {
      const map: Record<string, number> = {};
      for (const r of rows || []) {
        map[r.origin_id] = (map[r.origin_id] || 0) + Number(r.payment_amount);
      }
      return map;
    };

    const quotePaidMap = sumByOrigin(quotePaysRes.data || []);
    const ribbedPaidMap = sumByOrigin(ribbedPaysRes.data || []);
    const workPaidMap = sumByOrigin(workPaysRes.data || []);

    for (const quote of quotesRes.data || []) {
      const paidAmount = quotePaidMap[quote.id] || 0;
      const balance = Number(quote.total_value) - paidAmount;
      if (balance > 0) {
        const customer = customersMap.get(quote.customer_id);
        debts.push({
          type: 'quote',
          id: quote.id,
          description: `Orcamento - ${(quote as any).structure_description || 'Sem descricao'}`,
          total_amount: Number(quote.total_value),
          paid_amount: paidAmount,
          balance,
          customer_id: quote.customer_id,
          customer_name: customer?.name || '',
          customer_cpf: customer?.cpf || '',
          status: quote.status,
        });
      }
    }

    for (const quote of ribbedRes.data || []) {
      const paidAmount = ribbedPaidMap[quote.id] || 0;
      const balance = Number(quote.total_value) - paidAmount;
      if (balance > 0) {
        const customer = customersMap.get(quote.customer_id);
        debts.push({
          type: 'ribbed_slab_quote',
          id: quote.id,
          description: `Orcamento Laje Trelicada - ${(quote as any).name || 'Sem nome'}`,
          total_amount: Number(quote.total_value),
          paid_amount: paidAmount,
          balance,
          customer_id: quote.customer_id,
          customer_name: customer?.name || '',
          customer_cpf: customer?.cpf || '',
          status: quote.status,
        });
      }
    }

    for (const work of worksRes.data || []) {
      if ((work as any).contract_type !== 'pacote_fechado') continue;
      const paidAmount = workPaidMap[work.id] || 0;
      const balance = Number((work as any).total_contract_value) - paidAmount;
      if (balance > 0) {
        const customer = customersMap.get(work.customer_id);
        debts.push({
          type: 'construction_work',
          id: work.id,
          description: `Obra (Pacote Fechado) - ${(work as any).work_name}`,
          total_amount: Number((work as any).total_contract_value),
          paid_amount: paidAmount,
          balance,
          customer_id: work.customer_id,
          customer_name: customer?.name || '',
          customer_cpf: customer?.cpf || '',
          status: work.status,
        });
      }
    }

    setPendingDebts(debts);
  }

  async function searchCustomerDebts(customerId: string) {
    const [quotesRes, ribbedRes, worksRes] = await Promise.all([
      supabase
        .from('quotes')
        .select('id, structure_description, total_value, status')
        .eq('customer_id', customerId)
        .eq('status', 'approved'),
      supabase
        .from('ribbed_slab_quotes')
        .select('id, name, total_value, status')
        .eq('customer_id', customerId)
        .eq('status', 'approved'),
      supabase
        .from('construction_works')
        .select('id, work_name, contract_type, total_contract_value, status')
        .eq('customer_id', customerId)
        .in('status', ['em_andamento', 'concluido', 'planejamento']),
    ]);

    const quoteIds = (quotesRes.data || []).map((q: any) => q.id);
    const ribbedIds = (ribbedRes.data || []).map((q: any) => q.id);
    const workIds = (worksRes.data || [])
      .filter((w: any) => w.contract_type === 'pacote_fechado')
      .map((w: any) => w.id);

    const [quotePaysRes, ribbedPaysRes, workPaysRes] = await Promise.all([
      quoteIds.length > 0
        ? supabase
            .from('customer_revenue')
            .select('origin_id, payment_amount')
            .eq('origin_type', 'quote')
            .in('origin_id', quoteIds)
        : Promise.resolve({ data: [] }),
      ribbedIds.length > 0
        ? supabase
            .from('customer_revenue')
            .select('origin_id, payment_amount')
            .eq('origin_type', 'ribbed_slab_quote')
            .in('origin_id', ribbedIds)
        : Promise.resolve({ data: [] }),
      workIds.length > 0
        ? supabase
            .from('customer_revenue')
            .select('origin_id, payment_amount')
            .eq('origin_type', 'construction_work')
            .in('origin_id', workIds)
        : Promise.resolve({ data: [] }),
    ]);

    const sumByOrigin = (rows: any[]) => {
      const map: Record<string, number> = {};
      for (const r of rows || []) {
        map[r.origin_id] = (map[r.origin_id] || 0) + Number(r.payment_amount);
      }
      return map;
    };

    const quotePaidMap = sumByOrigin(quotePaysRes.data || []);
    const ribbedPaidMap = sumByOrigin(ribbedPaysRes.data || []);
    const workPaidMap = sumByOrigin(workPaysRes.data || []);

    const sources: DebtSource[] = [];

    for (const quote of quotesRes.data || []) {
      const paidAmount = quotePaidMap[quote.id] || 0;
      const balance = Number(quote.total_value) - paidAmount;
      if (balance > 0) {
        sources.push({
          type: 'quote',
          id: quote.id,
          description: `Orcamento - ${(quote as any).structure_description || 'Sem descricao'}`,
          total_amount: Number(quote.total_value),
          paid_amount: paidAmount,
          balance,
        });
      }
    }

    for (const quote of ribbedRes.data || []) {
      const paidAmount = ribbedPaidMap[quote.id] || 0;
      const balance = Number(quote.total_value) - paidAmount;
      if (balance > 0) {
        sources.push({
          type: 'ribbed_slab_quote',
          id: quote.id,
          description: `Orcamento Laje Trelicada - ${(quote as any).name || 'Sem nome'}`,
          total_amount: Number(quote.total_value),
          paid_amount: paidAmount,
          balance,
        });
      }
    }

    for (const work of worksRes.data || []) {
      if ((work as any).contract_type !== 'pacote_fechado') continue;
      const paidAmount = workPaidMap[work.id] || 0;
      const balance = Number((work as any).total_contract_value) - paidAmount;
      if (balance > 0) {
        sources.push({
          type: 'construction_work',
          id: work.id,
          description: `Obra (Pacote Fechado) - ${(work as any).work_name}`,
          total_amount: Number((work as any).total_contract_value),
          paid_amount: paidAmount,
          balance,
        });
      }
    }

    setDebtSources(sources);
  }

  const totalRevenue = useMemo(
    () => revenues.reduce((sum, r) => sum + Number(r.payment_amount), 0),
    [revenues]
  );

  function calculateTotalExpenses(): number {
    return 0;
  }

  async function handleCustomerSelect(customerId: string) {
    const customer = customers.find(c => c.id === customerId);
    setSelectedCustomer(customer || null);
    setSelectedDebt(null);

    if (customer) {
      await searchCustomerDebts(customerId);
    } else {
      setDebtSources([]);
    }
  }

  function openNewPaymentForm(prefilledDebt?: PendingDebt) {
    setEditingRevenue(null);
    setPaymentForm({
      payment_amount: '',
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'dinheiro',
      notes: ''
    });

    if (prefilledDebt) {
      const customer = customers.find(c => c.id === prefilledDebt.customer_id);
      setSelectedCustomer(customer || null);
      setSelectedDebt({
        type: prefilledDebt.type,
        id: prefilledDebt.id,
        description: prefilledDebt.description,
        total_amount: prefilledDebt.total_amount,
        paid_amount: prefilledDebt.paid_amount,
        balance: prefilledDebt.balance
      });
      setDebtSources([]);
    } else {
      setSelectedCustomer(null);
      setSelectedDebt(null);
      setDebtSources([]);
    }

    setShowForm(true);
  }

  async function handleSavePayment() {
    if (submittingRef.current || submitting) return;

    if (!selectedCustomer || !selectedDebt) {
      alert('Selecione um cliente e uma origem de debito');
      return;
    }

    if (!paymentForm.payment_amount || Number(paymentForm.payment_amount) <= 0) {
      alert('Informe um valor valido para o pagamento');
      return;
    }

    const paymentAmount = Number(paymentForm.payment_amount);

    if (!editingRevenue && paymentAmount > selectedDebt.balance) {
      alert('O valor do pagamento nao pode ser maior que o saldo devedor');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      if (editingRevenue) {
        const { error } = await supabase
          .from('customer_revenue')
          .update({
            payment_date: paymentForm.payment_date,
            payment_amount: paymentAmount,
            payment_method: paymentForm.payment_method,
            notes: paymentForm.notes
          })
          .eq('id', editingRevenue.id);

        if (error) throw error;

        await supabase
          .from('cash_flow')
          .update({
            amount: paymentAmount,
            date: paymentForm.payment_date,
            payment_method: paymentForm.payment_method
          })
          .eq('customer_revenue_id', editingRevenue.id);

        alert('Pagamento atualizado com sucesso!');
      } else {
        const receiptNumber = `REC-${Date.now()}`;

        const { data: existingRevenue } = await supabase
          .from('customer_revenue')
          .select('id, paid_amount, payment_amount')
          .eq('customer_id', selectedCustomer.id)
          .eq('origin_type', selectedDebt.type)
          .eq('origin_id', selectedDebt.id)
          .maybeSingle();

        let insertedRevenue: any = null;
        let error: any = null;

        if (existingRevenue) {
          const newPaidAmount = Number(existingRevenue.paid_amount) + paymentAmount;
          const newBalance = Number(selectedDebt.total_amount) - newPaidAmount;
          const newPaymentAmount = Number(existingRevenue.payment_amount) + paymentAmount;

          const { data, error: updateError } = await supabase
            .from('customer_revenue')
            .update({
              paid_amount: newPaidAmount,
              balance: newBalance,
              payment_amount: newPaymentAmount,
              payment_date: paymentForm.payment_date,
              payment_method: paymentForm.payment_method,
              notes: paymentForm.notes,
              receipt_number: receiptNumber
            })
            .eq('id', existingRevenue.id)
            .select()
            .single();

          insertedRevenue = data;
          error = updateError;
        } else {
          const { data, error: insertError } = await supabase
            .from('customer_revenue')
            .insert({
              customer_id: selectedCustomer.id,
              origin_type: selectedDebt.type,
              origin_id: selectedDebt.id,
              origin_description: selectedDebt.description,
              total_amount: selectedDebt.total_amount,
              paid_amount: selectedDebt.paid_amount + paymentAmount,
              balance: selectedDebt.balance - paymentAmount,
              payment_date: paymentForm.payment_date,
              payment_amount: paymentAmount,
              payment_method: paymentForm.payment_method,
              notes: paymentForm.notes,
              receipt_number: receiptNumber
            })
            .select()
            .single();

          insertedRevenue = data;
          error = insertError;
        }

        if (error) throw error;

        alert('Pagamento registrado com sucesso!');

        await generateReceipt({
          customer_name: selectedCustomer.name,
          customer_cpf_cnpj: selectedCustomer.cpf,
          payment_amount: paymentAmount,
          payment_date: paymentForm.payment_date,
          payment_method: paymentForm.payment_method,
          origin_type: selectedDebt.type,
          origin_description: selectedDebt.description,
          receipt_number: receiptNumber,
          balance: selectedDebt.balance - paymentAmount
        });
      }

      setShowForm(false);
      setEditingRevenue(null);
      setSelectedCustomer(null);
      setSelectedDebt(null);
      setDebtSources([]);
      await loadRevenues();
      if (activeTab === 'pendentes') {
        await loadAllPendingDebts();
      }
    } catch (error: any) {
      console.error('Erro ao salvar pagamento:', error);
      alert('Erro ao salvar pagamento: ' + (error?.message || 'Erro desconhecido'));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function handleEditRevenue(revenue: Revenue) {
    setEditingRevenue(revenue);

    const customer = customers.find(c => c.id === revenue.customer_id);
    setSelectedCustomer(customer || null);

    setSelectedDebt({
      type: revenue.origin_type as any,
      id: revenue.origin_id,
      description: revenue.origin_description,
      total_amount: revenue.total_amount,
      paid_amount: revenue.paid_amount - revenue.payment_amount,
      balance: revenue.balance + revenue.payment_amount
    });

    setPaymentForm({
      payment_amount: revenue.payment_amount.toString(),
      payment_date: revenue.payment_date,
      payment_method: revenue.payment_method,
      notes: revenue.notes || ''
    });

    setShowForm(true);
  }

  async function handleDeleteRevenue(revenue: Revenue) {
    if (!confirm('Deseja realmente excluir este recebimento? Esta acao nao pode ser desfeita.')) {
      return;
    }

    try {
      await supabase
        .from('cash_flow')
        .delete()
        .eq('customer_revenue_id', revenue.id);

      const { error } = await supabase
        .from('customer_revenue')
        .delete()
        .eq('id', revenue.id);

      if (error) throw error;

      alert('Recebimento excluido com sucesso!');
      await loadRevenues();
    } catch (error: any) {
      console.error('Erro ao excluir recebimento:', error);
      alert('Erro ao excluir recebimento: ' + (error?.message || 'Erro desconhecido'));
    }
  }

  async function generateReceipt(data: any) {
    const doc = new jsPDF();

    if (companySettings?.logo_url) {
      try {
        doc.addImage(companySettings.logo_url, 'PNG', 15, 10, 30, 30);
      } catch (e) {
        console.error('Erro ao carregar logo:', e);
      }
    }

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('RECIBO DE PAGAMENTO', 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (companySettings) {
      doc.text(companySettings.company_name || '', 105, 28, { align: 'center' });
      doc.text(`CNPJ: ${companySettings.company_cnpj || ''}`, 105, 33, { align: 'center' });
      doc.text(companySettings.company_address || '', 105, 38, { align: 'center' });
      doc.text(`Tel: ${companySettings.company_phone || ''} | Email: ${companySettings.company_email || ''}`, 105, 43, { align: 'center' });
    }

    doc.setDrawColor(200);
    doc.line(15, 48, 195, 48);

    let yPos = 58;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Recibo No: ${data.receipt_number}`, 15, yPos);
    yPos += 7;

    doc.setFont('helvetica', 'normal');
    doc.text(`Data: ${new Date(data.payment_date + 'T00:00:00').toLocaleDateString('pt-BR')}`, 15, yPos);
    yPos += 10;

    doc.setFont('helvetica', 'bold');
    doc.text('DADOS DO PAGADOR:', 15, yPos);
    yPos += 7;

    doc.setFont('helvetica', 'normal');
    doc.text(`Nome: ${data.customer_name}`, 15, yPos);
    yPos += 5;
    doc.text(`CPF/CNPJ: ${data.customer_cpf_cnpj}`, 15, yPos);
    yPos += 10;

    doc.setFont('helvetica', 'bold');
    doc.text('DESCRICAO:', 15, yPos);
    yPos += 7;

    doc.setFont('helvetica', 'normal');
    let description = '';
    if (data.origin_type === 'quote' || data.origin_type === 'ribbed_slab_quote') {
      description = 'Pagamento relacionado a compras de produtos ou materiais de construcao.';
    } else if (data.origin_type === 'construction_work') {
      const paymentType = data.balance === 0 ? 'de quitacao' : 'parcial';
      description = `Pagamento ${paymentType} da ${data.origin_description}.`;
    }

    const splitDescription = doc.splitTextToSize(description, 180);
    doc.text(splitDescription, 15, yPos);
    yPos += splitDescription.length * 5 + 5;

    doc.setFont('helvetica', 'bold');
    doc.text('VALOR PAGO:', 15, yPos);
    doc.setFontSize(14);
    doc.text(`R$ ${data.payment_amount.toFixed(2)}`, 150, yPos, { align: 'right' });
    yPos += 10;

    doc.setFontSize(11);
    doc.text('FORMA DE PAGAMENTO:', 15, yPos);
    doc.setFont('helvetica', 'normal');
    const method = paymentMethods.find(m => m.value === data.payment_method);
    doc.text(method?.label || data.payment_method, 70, yPos);
    yPos += 10;

    if (data.balance > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('SALDO DEVEDOR:', 15, yPos);
      doc.setFontSize(12);
      doc.setTextColor(200, 0, 0);
      doc.text(`R$ ${data.balance.toFixed(2)}`, 150, yPos, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      yPos += 10;
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 150, 0);
      doc.text('*** QUITADO ***', 105, yPos, { align: 'center' });
      doc.setTextColor(0, 0, 0);
      yPos += 10;
    }

    yPos += 20;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.line(60, yPos, 150, yPos);
    yPos += 5;
    doc.text(companySettings?.company_responsible_name || 'Responsavel', 105, yPos, { align: 'center' });
    doc.text(companySettings?.company_name || '', 105, yPos + 5, { align: 'center' });

    doc.save(`Recibo_${data.receipt_number}.pdf`);
  }

  async function loadCustomerStatement(customerId: string) {
    const { data, error } = await supabase
      .from('customer_statement')
      .select('*')
      .eq('customer_id', customerId)
      .order('transaction_date', { ascending: false });

    if (!error && data) {
      let runningBalance = 0;
      const entriesWithBalance = data.map(entry => {
        runningBalance += Number(entry.credit_amount) - Number(entry.debit_amount);
        return {
          ...entry,
          balance: runningBalance
        };
      }).reverse();

      setStatementEntries(entriesWithBalance);
    }
  }

  async function showCustomerStatement(customerId: string) {
    const customer = customers.find(c => c.id === customerId);
    setStatementCustomer(customer || null);
    await loadCustomerStatement(customerId);
    setShowStatement(true);
  }

  async function openPaymentFormFromStatement(customerId: string) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    setEditingRevenue(null);
    setPaymentForm({
      payment_amount: '',
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'dinheiro',
      notes: ''
    });
    setSelectedDebt(null);
    await handleCustomerSelect(customerId);
    setShowStatement(false);
    setShowForm(true);
  }

  async function generateStatementPDF(customerId: string) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    await loadCustomerStatement(customerId);

    const doc = new jsPDF();

    if (companySettings?.logo_url) {
      try {
        doc.addImage(companySettings.logo_url, 'PNG', 15, 10, 30, 30);
      } catch (e) {
        console.error('Erro ao carregar logo:', e);
      }
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('EXTRATO DO CLIENTE', 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (companySettings) {
      doc.text(companySettings.company_name || '', 105, 28, { align: 'center' });
    }

    doc.setFontSize(11);
    doc.text(`Cliente: ${customer.name}`, 15, 45);
    doc.text(`CPF/CNPJ: ${customer.cpf}`, 15, 52);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 15, 59);

    const tableData = statementEntries.map(entry => [
      new Date(entry.transaction_date).toLocaleDateString('pt-BR'),
      entry.description,
      entry.debit_amount > 0 ? `R$ ${entry.debit_amount.toFixed(2)}` : '-',
      entry.credit_amount > 0 ? `R$ ${entry.credit_amount.toFixed(2)}` : '-',
      `R$ ${entry.balance.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 65,
      head: [['Data', 'Descricao', 'Debito', 'Credito', 'Saldo']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 9 }
    });

    doc.save(`Extrato_${customer.name.replace(/\s+/g, '_')}.pdf`);
  }

  function formatDateTime(isoString: string) {
    const d = new Date(isoString);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('pt-BR');
  }

  const filteredRevenues = useMemo(() => revenues.filter(r => {
    const term = searchTerm.toLowerCase();
    if (!term) return true;
    const customerName = customersMap.get(r.customer_id)?.name || '';
    return (
      customerName.toLowerCase().includes(term) ||
      r.origin_description?.toLowerCase().includes(term) ||
      r.receipt_number?.toLowerCase().includes(term)
    );
  }), [revenues, searchTerm, customersMap]);

  const filteredPendingDebts = pendingDebts.filter(d => {
    const term = searchTerm.toLowerCase();
    return !term ||
      d.customer_name.toLowerCase().includes(term) ||
      d.description.toLowerCase().includes(term);
  });

  const balance = totalRevenue - totalExpenses;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              Voltar
            </button>
          )}
          <h2 className="text-2xl font-bold text-gray-800">Receitas de Clientes</h2>
        </div>
        <button
          onClick={() => openNewPaymentForm()}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Recebimento
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4 items-center mb-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Periodo:</label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1 text-sm"
            />
            <span className="text-gray-500">ate</span>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Receitas do Periodo</p>
                <p className="text-2xl font-bold text-green-700 mt-1">
                  R$ {totalRevenue.toFixed(2)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium">Despesas do Periodo</p>
                <p className="text-2xl font-bold text-red-700 mt-1">
                  R$ {totalExpenses.toFixed(2)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-red-600" />
            </div>
          </div>

          <div className={`${balance >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'} rounded-lg p-4 border`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  Saldo do Periodo
                </p>
                <p className={`text-2xl font-bold mt-1 ${balance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                  R$ {balance.toFixed(2)}
                </p>
              </div>
              <DollarSign className={`h-8 w-8 ${balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <div className="flex items-center justify-between px-6 pt-4">
            <div className="flex gap-0">
              <button
                onClick={() => setActiveTab('lancamentos')}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'lancamentos'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <List className="h-4 w-4" />
                Lancamentos
                <span className="ml-1 bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                  {revenues.length}
                </span>
              </button>
              <button
                onClick={async () => {
                  setActiveTab('pendentes');
                  if (pendingDebts.length === 0) {
                    await loadAllPendingDebts();
                  }
                }}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'pendentes'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Clock className="h-4 w-4" />
                Pagamentos Pendentes
                {pendingDebts.length > 0 && (
                  <span className="ml-1 bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">
                    {pendingDebts.length}
                  </span>
                )}
              </button>
            </div>

            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar cliente ou origem..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-64"
              />
            </div>
          </div>
        </div>

        {activeTab === 'lancamentos' && (
          <div className="overflow-x-auto">
            {filteredRevenues.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Receipt className="h-12 w-12 mb-3 opacity-40" />
                <p className="text-sm">Nenhum lancamento encontrado</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data Pgto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Registrado em</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Origem</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor Pago</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Saldo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Forma</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acoes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRevenues.map((revenue) => (
                    <tr key={revenue.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(revenue.payment_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                        {formatDateTime(revenue.created_at)}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {customersMap.get(revenue.customer_id)?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                        {revenue.origin_description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                        R$ {Number(revenue.payment_amount).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={revenue.balance === 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                          R$ {Number(revenue.balance).toFixed(2)}
                          {revenue.balance === 0 && (
                            <span className="ml-1 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Quitado</span>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {paymentMethods.find(m => m.value === revenue.payment_method)?.label || revenue.payment_method}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => showCustomerStatement(revenue.customer_id)}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                            title="Ver Extrato"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleEditRevenue(revenue)}
                            className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded transition-colors"
                            title="Editar Recebimento"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRevenue(revenue)}
                            className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                            title="Excluir Recebimento"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'pendentes' && (
          <div className="overflow-x-auto">
            {filteredPendingDebts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <CheckCircle className="h-12 w-12 mb-3 opacity-40" />
                <p className="text-sm font-medium">Nenhum pagamento pendente</p>
                <p className="text-xs mt-1">Todos os clientes estao em dia!</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-orange-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Origem</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ja Pago</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Saldo Devedor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acoes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPendingDebts.map((debt, idx) => (
                    <tr key={`${debt.type}-${debt.id}-${idx}`} className="hover:bg-orange-50 transition-colors">
                      <td className="px-6 py-4 text-sm">
                        <div className="font-medium text-gray-900">{debt.customer_name}</div>
                        <div className="text-xs text-gray-500">{debt.customer_cpf}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                        {debt.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        R$ {debt.total_amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                        R$ {debt.paid_amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="text-red-600 font-semibold">
                          R$ {debt.balance.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => openNewPaymentForm(debt)}
                          className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors text-xs font-medium"
                        >
                          <DollarSign className="h-3.5 w-3.5" />
                          Registrar Pagamento
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {editingRevenue ? 'Editar Recebimento' : 'Registrar Recebimento'}
                </h3>
                {!editingRevenue && (
                  <p className="text-sm text-gray-500 mt-0.5">Data padrao: hoje. Altere se necessario.</p>
                )}
              </div>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingRevenue(null);
                }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                {editingRevenue ? (
                  <input
                    type="text"
                    value={selectedCustomer?.name || ''}
                    disabled
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100 text-gray-700"
                  />
                ) : selectedDebt ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={selectedCustomer?.name || ''}
                      disabled
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-700"
                    />
                    <button
                      onClick={() => {
                        setSelectedCustomer(null);
                        setSelectedDebt(null);
                        setDebtSources([]);
                      }}
                      className="text-gray-400 hover:text-gray-600 p-2"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <select
                    value={selectedCustomer?.id || ''}
                    onChange={(e) => handleCustomerSelect(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Selecione um cliente</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} - {customer.cpf}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {editingRevenue ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Origem do Debito</label>
                  <input
                    type="text"
                    value={selectedDebt?.description || ''}
                    disabled
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100 text-gray-700"
                  />
                </div>
              ) : selectedDebt ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Origem do Debito</label>
                  <input
                    type="text"
                    value={selectedDebt.description}
                    disabled
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-700"
                  />
                </div>
              ) : debtSources.length > 0 ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Origem do Debito *</label>
                  <select
                    value={selectedDebt?.id || ''}
                    onChange={(e) => {
                      const debt = debtSources.find(d => d.id === e.target.value);
                      setSelectedDebt(debt || null);
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Selecione a origem</option>
                    {debtSources.map((debt) => (
                      <option key={debt.id} value={debt.id}>
                        {debt.description} - Saldo: R$ {debt.balance.toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : selectedCustomer ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    Este cliente nao possui orcamentos aprovados ou obras pendentes de pagamento.
                  </div>
                </div>
              ) : null}

              {selectedDebt && (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Valor Total:</span>
                        <p className="font-semibold text-gray-900">R$ {selectedDebt.total_amount.toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Ja Pago:</span>
                        <p className="font-semibold text-green-600">R$ {selectedDebt.paid_amount.toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Saldo Devedor:</span>
                        <p className="font-semibold text-red-600">R$ {selectedDebt.balance.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valor do Pagamento *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={paymentForm.payment_amount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, payment_amount: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data do Pagamento *
                      <span className="ml-2 text-xs text-blue-600 font-normal">(padrao: hoje)</span>
                    </label>
                    <input
                      type="date"
                      value={paymentForm.payment_date}
                      onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Forma de Pagamento *</label>
                    <select
                      value={paymentForm.payment_method}
                      onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      {paymentMethods.map((method) => (
                        <option key={method.value} value={method.value}>
                          {method.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {paymentForm.payment_amount && Number(paymentForm.payment_amount) > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Saldo apos este pagamento:</p>
                      <p className="text-xl font-bold text-green-600">
                        R$ {Math.max(0, selectedDebt.balance - Number(paymentForm.payment_amount)).toFixed(2)}
                      </p>
                      {Number(paymentForm.payment_amount) >= selectedDebt.balance && (
                        <p className="text-sm text-green-700 font-medium mt-1">Debito quitado!</p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Observacoes</label>
                    <textarea
                      value={paymentForm.notes}
                      onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 p-6 border-t bg-gray-50 rounded-b-xl">
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingRevenue(null);
                }}
                disabled={submitting}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePayment}
                disabled={submitting || !selectedCustomer || !selectedDebt || !paymentForm.payment_amount}
                className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Salvando...
                  </>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4" />
                    {editingRevenue ? 'Atualizar Recebimento' : 'Registrar Pagamento'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showStatement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Extrato do Cliente</h3>
                {statementCustomer && (
                  <p className="text-sm text-gray-500 mt-0.5">{statementCustomer.name}</p>
                )}
              </div>
              <button onClick={() => setShowStatement(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descricao</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Debito</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credito</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {statementEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {new Date(entry.transaction_date).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 text-sm">{entry.description}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-red-600">
                          {entry.debit_amount > 0 ? `R$ ${entry.debit_amount.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-green-600">
                          {entry.credit_amount > 0 ? `R$ ${entry.credit_amount.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium">
                          R$ {entry.balance.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between gap-3 p-6 border-t bg-gray-50 rounded-b-xl">
              <div className="flex gap-2">
                <button
                  onClick={() => statementCustomer && openPaymentFormFromStatement(statementCustomer.id)}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Registrar Recebimento
                </button>
                <button
                  onClick={() => statementCustomer && generateStatementPDF(statementCustomer.id)}
                  className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  Exportar PDF
                </button>
              </div>
              <button
                onClick={() => setShowStatement(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
