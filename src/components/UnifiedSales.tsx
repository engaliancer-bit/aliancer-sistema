import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  Search, DollarSign, Calendar, Building2, FileText, Check, X,
  AlertCircle, CreditCard, Banknote, Plus, Edit, Paperclip, Eye,
  Clock, CheckCircle, XCircle, ChevronRight, Package2,
  RotateCcw, Trash2, User, Receipt, Printer, Download
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import FiscalExporter from './FiscalExporter';
import { generateFactoryPaymentReceipt } from './factory/FactoryPaymentReceiptGenerator';

interface Receivable {
  id: string;
  venda_id: string;
  parcela_numero: number;
  descricao: string;
  valor_parcela: number;
  valor_recebido: number | null;
  data_vencimento: string | null;
  data_recebimento: string | null;
  forma_pagamento: string | null;
  status: 'sem_definicao' | 'pendente' | 'em_compensacao' | 'pago' | 'cancelado';
  unidade_negocio: string | null;
  conta_caixa_id: string | null;
  recebido_por: string | null;
  observacoes: string | null;
  cash_flow_id: string | null;
  unified_sales?: {
    id: string;
    sale_number: string | null;
    origem_tipo: string;
    origem_id: string;
    customer_id: string | null;
    customer_name_snapshot: string | null;
    data_venda: string;
    valor_total: number;
    unidade_negocio: string | null;
  };
  cheque_details?: {
    id: string;
    numero_cheque: string | null;
    banco_nome: string | null;
    titular: string | null;
    status_cheque: string | null;
    data_bom_para: string | null;
  }[];
  contas_caixa?: {
    nome: string;
  };
  payments?: ReceivablePayment[];
}

interface ReceivablePayment {
  id: string;
  receivable_id: string;
  valor_pago: number;
  data_pagamento: string;
  forma_pagamento: string | null;
  conta_caixa_id: string | null;
  recebido_por: string | null;
  observacoes: string | null;
  estornado: boolean;
  data_estorno: string | null;
  motivo_estorno: string | null;
  created_at: string;
  contas_caixa?: {
    nome: string;
  };
}

interface ContaCaixa {
  id: string;
  nome: string;
  unidade: string;
  ativo: boolean;
}

interface Bank {
  id: string;
  nome: string;
  banco_codigo: string;
  banco_nome: string;
  agencia: string;
  conta: string;
  tipo_conta: string;
  unidade_negocio: string;
  ativo: boolean;
}

type MainTabType = 'receivables' | 'fiscal-exporter' | 'customer-statement';
type ReceivableTabType = 'sem_definicao' | 'pendente' | 'pago';

interface UnifiedSalesProps {
  onNavigateToQuote?: (quoteId: string, receivableId: string) => void;
  onNavigateToRibbedSlab?: (quoteId: string, receivableId: string) => void;
  highlightReceivableId?: string | null;
  onReceivableOpened?: () => void;
}

export default function UnifiedSales({
  onNavigateToQuote,
  onNavigateToRibbedSlab,
  highlightReceivableId,
  onReceivableOpened
}: UnifiedSalesProps = {}) {
  const [mainTab, setMainTab] = useState<MainTabType>('receivables');
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [filteredReceivables, setFilteredReceivables] = useState<Receivable[]>([]);
  const [activeTab, setActiveTab] = useState<ReceivableTabType>('sem_definicao');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const highlightedReceivableRef = useRef<HTMLDivElement>(null);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showChequeModal, setShowChequeModal] = useState(false);
  const [showAttachmentsModal, setShowAttachmentsModal] = useState(false);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [selectedReceivable, setSelectedReceivable] = useState<Receivable | null>(null);
  const [quoteItems, setQuoteItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const [contasCaixa, setContasCaixa] = useState<ContaCaixa[]>([]);

  const [paymentForm, setPaymentForm] = useState({
    forma_pagamento: 'pix',
    entrada_valor: '',
    num_parcelas: '1',
    intervalo_dias: '30',
    data_primeira_parcela: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  const [receiveForm, setReceiveForm] = useState({
    data_recebimento: new Date().toISOString().split('T')[0],
    valor_recebido: '',
    conta_caixa_id: '',
    recebido_por: '',
    observacoes: '',
  });

  const [chequeForm, setChequeForm] = useState({
    numero_cheque: '',
    banco_nome: '',
    banco_codigo: '',
    agencia: '',
    conta: '',
    titular: '',
    cpf_cnpj_titular: '',
    data_emissao: new Date().toISOString().split('T')[0],
    data_bom_para: '',
    observacoes: '',
  });

  const [payDebtForm, setPayDebtForm] = useState({
    data_recebimento: new Date().toISOString().split('T')[0],
    valor_pagar: '',
    forma_pagamento: 'pix',
    conta_caixa_id: '',
    recebido_por: '',
    observacoes: '',
    pagar_total: true,
  });

  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerSales, setCustomerSales] = useState<any[]>([]);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [statementStartDate, setStatementStartDate] = useState('');
  const [statementEndDate, setStatementEndDate] = useState('');
  const [statementStatusFilter, setStatementStatusFilter] = useState<'todas' | 'pago' | 'pendente'>('todas');
  const [customersWithDebts, setCustomersWithDebts] = useState<any[]>([]);
  const [customerReceivables, setCustomerReceivables] = useState<Receivable[]>([]);
  const [loadingCustomerDebts, setLoadingCustomerDebts] = useState(false);
  const [showPayCustomerDebtModal, setShowPayCustomerDebtModal] = useState(false);
  const [selectedCustomerReceivable, setSelectedCustomerReceivable] = useState<Receivable | null>(null);
  const [companySettings, setCompanySettings] = useState<any>({});

  useEffect(() => {
    loadReceivables();
    loadContasCaixa();
    loadCustomers();
    loadCompanySettings();
  }, []);

  useEffect(() => {
    filterReceivables();
  }, [receivables, activeTab, searchTerm]);

  useEffect(() => {
    if (selectedCustomerId) {
      loadCustomerStatement(selectedCustomerId);
    }
  }, [selectedCustomerId, statementStartDate, statementEndDate, statementStatusFilter]);

  useEffect(() => {
    if (highlightReceivableId && receivables.length > 0) {
      const receivable = receivables.find(r => r.id === highlightReceivableId);
      if (receivable) {
        const tab = receivable.status_pagamento as ReceivableTabType;
        setActiveTab(tab);

        setTimeout(() => {
          if (highlightedReceivableRef.current) {
            highlightedReceivableRef.current.scrollIntoView({
              behavior: 'smooth',
              block: 'center'
            });
          }

          if (onReceivableOpened) {
            onReceivableOpened();
          }
        }, 300);
      }
    }
  }, [highlightReceivableId, receivables, onReceivableOpened]);

  async function loadReceivables() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('receivables')
        .select(`
          *,
          unified_sales (
            id,
            sale_number,
            origem_tipo,
            origem_id,
            customer_id,
            customer_name_snapshot,
            data_venda,
            valor_total,
            unidade_negocio
          ),
          cheque_details (
            id,
            numero_cheque,
            banco_nome,
            titular,
            status_cheque,
            data_bom_para
          ),
          contas_caixa (
            nome
          ),
          payments:receivable_payments (
            id,
            valor_pago,
            data_pagamento,
            forma_pagamento,
            conta_caixa_id,
            recebido_por,
            observacoes,
            estornado,
            data_estorno,
            motivo_estorno,
            created_at,
            contas_caixa (
              nome
            )
          )
        `)
        .neq('status', 'cancelado')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReceivables(data || []);
    } catch (error) {
      console.error('Erro ao carregar recebíveis:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadContasCaixa() {
    const { data, error } = await supabase
      .from('contas_caixa')
      .select('*')
      .eq('ativo', true)
      .order('unidade', { ascending: true });

    if (error) {
      console.error('Erro ao carregar contas:', error);
      return;
    }

    setContasCaixa(data || []);
  }

  async function loadCustomers() {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, cpf, person_type')
        .order('name', { ascending: true });

      if (error) {
        console.error('Erro ao carregar clientes:', error);
        setCustomers([]);
        return;
      }

      console.log('Total de clientes cadastrados:', (data || []).length);
      setCustomers(data || []);
      await loadCustomersWithDebts();
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      setCustomers([]);
    }
  }

  async function loadCustomersWithDebts() {
    try {
      const { data: receivablesData, error } = await supabase
        .from('receivables')
        .select(`
          id,
          venda_id,
          valor_parcela,
          valor_recebido,
          status,
          unified_sales (
            customer_id,
            customer_name_snapshot
          )
        `)
        .in('status', ['sem_definicao', 'pendente', 'em_compensacao']);

      if (error) throw error;

      const customerDebtsMap = new Map<string, { name: string; cpf: string; totalDebt: number; count: number }>();

      for (const receivable of receivablesData || []) {
        const customerId = receivable.unified_sales?.customer_id;
        if (!customerId) continue;

        const debtAmount = receivable.valor_parcela - (receivable.valor_recebido || 0);

        if (customerDebtsMap.has(customerId)) {
          const existing = customerDebtsMap.get(customerId)!;
          existing.totalDebt += debtAmount;
          existing.count += 1;
        } else {
          const { data: customerData } = await supabase
            .from('customers')
            .select('name, cpf')
            .eq('id', customerId)
            .maybeSingle();

          if (customerData) {
            customerDebtsMap.set(customerId, {
              name: customerData.name,
              cpf: customerData.cpf || '',
              totalDebt: debtAmount,
              count: 1
            });
          }
        }
      }

      const customersWithDebtsArray = Array.from(customerDebtsMap.entries())
        .map(([id, data]) => ({
          id,
          name: data.name,
          cpf: data.cpf,
          totalDebt: data.totalDebt,
          receivableCount: data.count
        }))
        .sort((a, b) => b.totalDebt - a.totalDebt);

      setCustomersWithDebts(customersWithDebtsArray);
    } catch (error) {
      console.error('Erro ao carregar clientes com débitos:', error);
      setCustomersWithDebts([]);
    }
  }

  async function loadCustomerReceivables(customerId: string) {
    if (!customerId) {
      setCustomerReceivables([]);
      return;
    }

    setLoadingCustomerDebts(true);
    try {
      const { data: sales, error: salesError } = await supabase
        .from('unified_sales')
        .select('id')
        .eq('customer_id', customerId);

      if (salesError) throw salesError;

      const saleIds = (sales || []).map(s => s.id);

      if (saleIds.length === 0) {
        setCustomerReceivables([]);
        setLoadingCustomerDebts(false);
        return;
      }

      const { data: receivablesData, error: receivablesError } = await supabase
        .from('receivables')
        .select(`
          *,
          unified_sales (
            id,
            sale_number,
            origem_tipo,
            origem_id,
            customer_id,
            customer_name_snapshot,
            data_venda,
            valor_total,
            unidade_negocio
          ),
          contas_caixa (nome),
          payments:receivable_payments (
            id,
            valor_pago,
            data_pagamento,
            forma_pagamento,
            conta_caixa_id,
            recebido_por,
            observacoes,
            estornado,
            data_estorno,
            motivo_estorno,
            created_at,
            contas_caixa (
              nome
            )
          )
        `)
        .in('venda_id', saleIds)
        .in('status', ['sem_definicao', 'pendente', 'em_compensacao'])
        .order('data_vencimento', { ascending: true });

      if (receivablesError) throw receivablesError;

      setCustomerReceivables(receivablesData || []);
    } catch (error) {
      console.error('Erro ao carregar recebíveis do cliente:', error);
      setCustomerReceivables([]);
    } finally {
      setLoadingCustomerDebts(false);
    }
  }

  async function handlePayCustomerDebt() {
    if (!selectedCustomerReceivable) return;

    if (!payDebtForm.conta_caixa_id) {
      alert('Por favor, selecione uma conta de caixa');
      return;
    }

    if (!payDebtForm.data_recebimento) {
      alert('Por favor, informe a data do recebimento');
      return;
    }

    try {
      const valorPendente = selectedCustomerReceivable.valor_parcela - (selectedCustomerReceivable.valor_recebido || 0);
      const valorPagar = payDebtForm.pagar_total
        ? valorPendente
        : parseFloat(payDebtForm.valor_pagar) || 0;

      if (valorPagar <= 0) {
        alert('O valor a pagar deve ser maior que zero');
        return;
      }

      if (valorPagar > valorPendente) {
        alert('O valor a pagar não pode ser maior que o valor pendente');
        return;
      }

      const businessUnit = selectedCustomerReceivable.unidade_negocio === 'Fábrica' || selectedCustomerReceivable.unidade_negocio === 'Fábrica - Laje'
        ? 'factory'
        : selectedCustomerReceivable.unidade_negocio === 'Escritório de Engenharia'
        ? 'engineering'
        : selectedCustomerReceivable.unidade_negocio === 'Construtora'
        ? 'construction'
        : 'factory';

      const { data: cashFlowData, error: cashFlowError } = await supabase
        .from('cash_flow')
        .insert({
          date: payDebtForm.data_recebimento,
          type: 'income',
          category: 'Venda',
          description: `Recebimento Venda ${selectedCustomerReceivable.unified_sales?.sale_number || 'S/N'} - Parcela ${selectedCustomerReceivable.parcela_numero}${payDebtForm.forma_pagamento ? ` (${payDebtForm.forma_pagamento})` : ''} - ${selectedCustomerReceivable.unified_sales?.customer_name_snapshot || 'Cliente'} [${selectedCustomerReceivable.unidade_negocio || 'N/A'}]`,
          amount: valorPagar,
          business_unit: businessUnit,
          conta_caixa_id: payDebtForm.conta_caixa_id,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (cashFlowError) {
        console.error('Erro ao criar entrada no fluxo de caixa:', cashFlowError);
        throw new Error('Erro ao criar entrada no fluxo de caixa: ' + cashFlowError.message);
      }

      const { error: paymentError } = await supabase
        .from('receivable_payments')
        .insert({
          receivable_id: selectedCustomerReceivable.id,
          valor_pago: valorPagar,
          data_pagamento: payDebtForm.data_recebimento,
          forma_pagamento: payDebtForm.forma_pagamento,
          conta_caixa_id: payDebtForm.conta_caixa_id,
          recebido_por: payDebtForm.recebido_por || null,
          observacoes: payDebtForm.observacoes || null,
          estornado: false
        });

      if (paymentError) throw paymentError;

      const { data: updatedReceivableData } = await supabase
        .from('receivables')
        .select('*')
        .eq('id', selectedCustomerReceivable.id)
        .single();

      const updatedReceivable = updatedReceivableData || {
        ...selectedCustomerReceivable,
        valor_recebido: (selectedCustomerReceivable.valor_recebido || 0) + valorPagar
      };

      setShowPayCustomerDebtModal(false);
      setSelectedCustomerReceivable(null);

      if (selectedCustomerId) {
        await loadCustomerReceivables(selectedCustomerId);
        await loadCustomersWithDebts();
      }

      setPayDebtForm({
        data_recebimento: new Date().toISOString().split('T')[0],
        valor_pagar: '',
        forma_pagamento: 'pix',
        conta_caixa_id: '',
        recebido_por: '',
        observacoes: '',
        pagar_total: true,
      });

      const isPago = updatedReceivable.status === 'pago';
      const shouldPrint = window.confirm(
        `${isPago ? 'Pagamento total confirmado!' : 'Pagamento parcial registrado com sucesso!'}\n\nDeseja gerar e imprimir o recibo de pagamento?`
      );

      if (shouldPrint) {
        await generatePaymentReceipt(updatedReceivable as Receivable, valorPagar);
      }

      await loadReceivables();
    } catch (error: any) {
      console.error('Erro ao registrar pagamento:', error);
      alert('Erro ao registrar pagamento: ' + error.message);
    }
  }

  function openPayCustomerDebtModal(receivable: Receivable) {
    setSelectedCustomerReceivable(receivable);
    const valorPendente = receivable.valor_parcela - (receivable.valor_recebido || 0);
    setPayDebtForm({
      data_recebimento: new Date().toISOString().split('T')[0],
      valor_pagar: valorPendente.toFixed(2),
      forma_pagamento: 'pix',
      conta_caixa_id: '',
      recebido_por: '',
      observacoes: '',
      pagar_total: true,
    });
    setShowPayCustomerDebtModal(true);
  }

  function closePayCustomerDebtModal() {
    setShowPayCustomerDebtModal(false);
    setSelectedCustomerReceivable(null);
    setPayDebtForm({
      data_recebimento: new Date().toISOString().split('T')[0],
      valor_pagar: '',
      forma_pagamento: 'pix',
      conta_caixa_id: '',
      recebido_por: '',
      observacoes: '',
      pagar_total: true,
    });
  }

  async function loadCompanySettings() {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('setting_key, setting_value');

      if (error) throw error;

      if (data) {
        const settingsMap: Record<string, string> = {};
        data.forEach((row: { setting_key: string; setting_value: string }) => {
          if (row.setting_key && row.setting_value !== null) {
            settingsMap[row.setting_key] = row.setting_value;
          }
        });
        setCompanySettings(settingsMap);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  }

  async function addPDFHeader(doc: jsPDF, title: string) {
    let currentY = 14;

    const headerTitle = companySettings.report_header_title || title;
    const headerSubtitle = companySettings.report_header_subtitle || 'Sistema de Gestão';
    const showCompanyInfo = companySettings.report_show_company_info === 'true';
    const showLogo = companySettings.report_show_logo === 'true';
    const companyName = companySettings.company_trade_name || companySettings.company_name || '';
    const logoUrl = companySettings.company_logo_url;

    const pageWidth = doc.internal.pageSize.width;
    const rightMargin = pageWidth - 14;
    const logoWidth = 40;
    const logoHeight = 20;
    let logoStartY = currentY;

    if (showLogo && logoUrl) {
      try {
        const response = await fetch(logoUrl);
        const blob = await response.blob();
        const reader = new FileReader();

        await new Promise((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        const logoData = reader.result as string;
        doc.addImage(logoData, 'PNG', rightMargin - logoWidth, logoStartY, logoWidth, logoHeight);
      } catch (error) {
        console.error('Erro ao carregar logo:', error);
      }
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(headerTitle, 14, currentY, { maxWidth: pageWidth - logoWidth - 24 });
    currentY += 6;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(headerSubtitle, 14, currentY);
    currentY += 8;

    if (companyName) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(companyName, 14, currentY);
      currentY += 6;
    }

    if (showCompanyInfo) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');

      const companyInfo = [];
      const address = [
        companySettings.company_address_street,
        companySettings.company_address_number,
        companySettings.company_address_neighborhood,
        companySettings.company_address_city,
        companySettings.company_address_state
      ].filter(Boolean).join(', ');

      if (address) companyInfo.push(address);
      if (companySettings.company_phone) companyInfo.push(`Tel: ${companySettings.company_phone}`);
      if (companySettings.company_email) companyInfo.push(`Email: ${companySettings.company_email}`);

      companyInfo.forEach(info => {
        doc.text(info, 14, currentY, { maxWidth: pageWidth - logoWidth - 24 });
        currentY += 4;
      });
      currentY += 2;
    }

    if (showLogo && logoUrl && currentY < (logoStartY + logoHeight)) {
      currentY = logoStartY + logoHeight + 4;
    }

    doc.setDrawColor(10, 126, 194);
    doc.setLineWidth(0.5);
    doc.line(14, currentY, 196, currentY);
    currentY += 8;

    return currentY;
  }

  async function generatePaymentReceipt(receivable: Receivable, valorPagamentoAtual?: number) {
    try {
      const customer = customers.find(c => c.id === receivable.unified_sales?.customer_id);
      const valorPago = valorPagamentoAtual || receivable.valor_recebido || receivable.valor_parcela;
      const valorTotalRecebido = receivable.valor_recebido || 0;
      const saldoPendente = Math.max(0, receivable.valor_parcela - valorTotalRecebido);
      const sale = receivable.unified_sales;

      await generateFactoryPaymentReceipt(
        {
          paymentId: receivable.id,
          paymentDate: receivable.data_recebimento || new Date().toISOString().split('T')[0],
          value: valorPago,
          paymentMethod: receivable.forma_pagamento || '',
          accountName: receivable.contas_caixa?.nome || 'Nao informado',
          notes: receivable.observacoes || undefined,
          saleNumber: sale?.sale_number || 'S/N',
          customerName: customer?.name || sale?.customer_name_snapshot || 'Cliente',
          originType: sale?.origem_tipo || 'VENDA',
          originReference: sale?.sale_number || sale?.origem_id || '-',
          installmentNumber: receivable.parcela_numero,
          installmentDescription: receivable.descricao,
          grandTotal: receivable.valor_parcela,
          totalReceived: valorTotalRecebido,
          balance: saldoPendente,
        },
        {
          logo_url: companySettings.company_logo_url,
          company_name: companySettings.company_trade_name || companySettings.company_name,
          company_address: companySettings.company_address,
          company_phone: companySettings.company_phone,
          company_email: companySettings.company_email,
          company_cnpj: companySettings.company_cnpj,
        }
      );
    } catch (error) {
      console.error('Erro ao gerar recibo:', error);
      alert('Erro ao gerar recibo de pagamento');
    }
  }

  async function exportCustomerStatement() {
    if (!selectedCustomerId || customerSales.length === 0) {
      alert('Nenhuma venda para exportar');
      return;
    }

    try {
      const doc = new jsPDF();
      let currentY = await addPDFHeader(doc, 'EXTRATO DO CLIENTE');

      const customer = customers.find(c => c.id === selectedCustomerId);

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('EXTRATO DE VENDAS E PAGAMENTOS', 14, currentY);
      currentY += 10;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('DADOS DO CLIENTE', 14, currentY);
      currentY += 7;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Cliente: ${customer?.name || 'N/A'}`, 14, currentY);
      currentY += 5;
      doc.text(`CPF/CNPJ: ${customer?.cpf_cnpj || 'N/A'}`, 14, currentY);
      currentY += 5;

      const periodo = statementStartDate && statementEndDate
        ? `${new Date(statementStartDate).toLocaleDateString('pt-BR')} a ${new Date(statementEndDate).toLocaleDateString('pt-BR')}`
        : 'Todos os períodos';
      doc.text(`Período: ${periodo}`, 14, currentY);
      currentY += 5;
      doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, currentY);
      currentY += 10;

      const totalVendas = customerSales.reduce((sum, sale) => sum + (sale.valor_total || 0), 0);
      const totalRecebido = customerReceivables
        .filter(r => r.status === 'pago')
        .reduce((sum, r) => sum + (r.valor_recebido || r.valor_parcela), 0);
      const saldoDevedor = customerReceivables
        .filter(r => r.status !== 'pago' && r.status !== 'cancelado')
        .reduce((sum, r) => sum + (r.valor_parcela - (r.valor_recebido || 0)), 0);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('RESUMO FINANCEIRO', 14, currentY);
      currentY += 7;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Total em Vendas: R$ ${totalVendas.toFixed(2)}`, 14, currentY);
      currentY += 5;
      doc.setTextColor(34, 197, 94);
      doc.text(`Total Recebido: R$ ${totalRecebido.toFixed(2)}`, 14, currentY);
      currentY += 5;
      doc.setTextColor(239, 68, 68);
      doc.text(`Saldo Devedor: R$ ${saldoDevedor.toFixed(2)}`, 14, currentY);
      doc.setTextColor(0, 0, 0);
      currentY += 10;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('VENDAS REALIZADAS', 14, currentY);
      currentY += 7;

      const salesData = customerSales.map(sale => [
        sale.sale_number || 'S/N',
        new Date(sale.data_venda).toLocaleDateString('pt-BR'),
        sale.unidade_negocio || 'N/A',
        `R$ ${(sale.valor_total || 0).toFixed(2)}`,
        sale.payment_status === 'pago' ? 'Pago' : 'Pendente'
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Nº Venda', 'Data', 'Unidade', 'Valor', 'Status']],
        body: salesData,
        theme: 'striped',
        headStyles: { fillColor: [10, 126, 194], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9 },
        columnStyles: {
          3: { halign: 'right' },
          4: { halign: 'center' }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 10;

      if (customerReceivables.length > 0) {
        if (currentY > 240) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('PARCELAS A RECEBER', 14, currentY);
        currentY += 7;

        const receivablesData = customerReceivables
          .filter(r => r.status !== 'pago' && r.status !== 'cancelado')
          .map(r => [
            r.unified_sales?.sale_number || 'S/N',
            `Parcela ${r.parcela_numero}`,
            r.data_vencimento ? new Date(r.data_vencimento).toLocaleDateString('pt-BR') : 'Sem data',
            `R$ ${r.valor_parcela.toFixed(2)}`,
            r.valor_recebido ? `R$ ${r.valor_recebido.toFixed(2)}` : 'R$ 0,00',
            `R$ ${(r.valor_parcela - (r.valor_recebido || 0)).toFixed(2)}`
          ]);

        if (receivablesData.length > 0) {
          autoTable(doc, {
            startY: currentY,
            head: [['Venda', 'Parcela', 'Vencimento', 'Valor', 'Recebido', 'Saldo']],
            body: receivablesData,
            theme: 'striped',
            headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 9 },
            columnStyles: {
              3: { halign: 'right' },
              4: { halign: 'right' },
              5: { halign: 'right' }
            }
          });

          currentY = (doc as any).lastAutoTable.finalY + 5;
        }
      }

      const pageHeight = doc.internal.pageSize.height;
      if (currentY > pageHeight - 20) {
        doc.addPage();
        currentY = 20;
      }

      currentY += 5;
      doc.setDrawColor(200, 200, 200);
      doc.line(14, currentY, 196, currentY);
      currentY += 7;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      const footerText = companySettings.report_footer_text || 'Documento gerado automaticamente pelo sistema';
      doc.text(footerText, 14, currentY);

      const fileName = `Extrato_${customer?.name || 'Cliente'}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error('Erro ao exportar extrato:', error);
      alert('Erro ao exportar extrato');
    }
  }

  async function loadCustomerStatement(customerId: string) {
    if (!customerId) {
      setCustomerSales([]);
      return;
    }

    setLoadingStatement(true);
    try {
      let query = supabase
        .from('unified_sales')
        .select('*')
        .eq('customer_id', customerId);

      if (statementStartDate) {
        query = query.gte('data_venda', statementStartDate);
      }

      if (statementEndDate) {
        query = query.lte('data_venda', statementEndDate);
      }

      query = query.order('data_venda', { ascending: false });

      const { data: sales, error: salesError } = await query;

      if (salesError) {
        console.error('Erro ao carregar vendas do cliente:', salesError);
        setCustomerSales([]);
        setLoadingStatement(false);
        return;
      }

      const salesWithItems = await Promise.all(
        (sales || []).map(async (sale) => {
          const { data: receivables } = await supabase
            .from('receivables')
            .select('status')
            .eq('venda_id', sale.id);

          const allPaid = receivables && receivables.length > 0 && receivables.every(r => r.status === 'pago');
          const hasPending = receivables && receivables.length > 0 && receivables.some(r => r.status === 'pendente' || r.status === 'sem_definicao' || r.status === 'em_compensacao');

          const paymentStatus = allPaid ? 'pago' : hasPending ? 'pendente' : 'pago';

          let items: any[] = [];

          if (sale.origem_tipo === 'fabrica') {
            const { data: quoteData } = await supabase
              .from('quotes')
              .select('id')
              .eq('id', sale.origem_id)
              .maybeSingle();

            if (quoteData) {
              const { data: itemsData } = await supabase
                .from('quote_items')
                .select(`
                  id,
                  product_id,
                  quantity,
                  unit_price,
                  total_price,
                  products (
                    name,
                    code
                  )
                `)
                .eq('quote_id', quoteData.id)
                .order('id', { ascending: true });

              items = (itemsData || []).map(item => ({
                descricao: item.products?.name || 'Produto',
                codigo: item.products?.code || '',
                quantidade: item.quantity,
                unidade: 'un',
                valor_unitario: item.unit_price,
                valor_total: item.total_price
              }));
            }
          } else if (sale.origem_tipo === 'laje') {
            const { data: quoteData } = await supabase
              .from('ribbed_slab_quotes')
              .select('id, total_value')
              .eq('id', sale.origem_id)
              .maybeSingle();

            if (quoteData) {
              items = [{
                descricao: 'Orçamento de Laje Treliçada',
                codigo: '',
                quantidade: 1,
                unidade: 'un',
                valor_unitario: quoteData.total_value || 0,
                valor_total: quoteData.total_value || 0
              }];
            }
          } else if (sale.origem_tipo === 'escritorio') {
            const { data: projectData } = await supabase
              .from('engineering_projects')
              .select('id, name, grand_total')
              .eq('id', sale.origem_id)
              .maybeSingle();

            if (projectData) {
              items = [{
                descricao: projectData.name || 'Projeto de Engenharia',
                codigo: '',
                quantidade: 1,
                unidade: 'un',
                valor_unitario: projectData.grand_total || 0,
                valor_total: projectData.grand_total || 0
              }];
            }
          }

          return {
            ...sale,
            items,
            paymentStatus
          };
        })
      );

      const filteredSales = statementStatusFilter === 'todas'
        ? salesWithItems
        : salesWithItems.filter(sale => sale.paymentStatus === statementStatusFilter);

      setCustomerSales(filteredSales);
    } catch (error) {
      console.error('Erro ao gerar extrato:', error);
      alert('Erro ao gerar extrato do cliente');
      setCustomerSales([]);
    } finally {
      setLoadingStatement(false);
    }
  }

  async function loadQuoteItems(receivable: Receivable) {
    if (!receivable.unified_sales) return;

    setLoadingItems(true);
    try {
      const origem = receivable.unified_sales.origem_tipo;
      const origemId = receivable.unified_sales.origem_id;

      if (!origemId) {
        setQuoteItems([]);
        return;
      }

      if (origem === 'fabrica') {
        const { data, error } = await supabase
          .from('quote_items')
          .select(`
            *,
            products (name, code),
            materials (name),
            compositions (name)
          `)
          .eq('quote_id', origemId)
          .order('created_at', { ascending: true });

        if (error) throw error;

        const items = (data || []).map(item => ({
          descricao: item.item_type === 'product' ? item.products?.name :
                     item.item_type === 'material' ? item.materials?.name :
                     item.compositions?.name || 'Item',
          codigo: item.item_type === 'product' ? item.products?.code : null,
          quantidade: item.quantity,
          valor_unitario: item.proposed_price,
          valor_total: item.quantity * item.proposed_price
        }));

        setQuoteItems(items);

      } else if (origem === 'laje') {
        const { data: quoteData, error: quoteError } = await supabase
          .from('ribbed_slab_quotes')
          .select('total_value')
          .eq('id', origemId)
          .single();

        if (quoteError) throw quoteError;

        const { data, error } = await supabase
          .from('ribbed_slab_rooms')
          .select('*')
          .eq('quote_id', origemId)
          .order('created_at', { ascending: true });

        if (error) throw error;

        const items = (data || []).map(room => {
          const area = room.side_a * room.side_b;
          const totalLinearMeters = room.joist_count * room.joist_length;
          const unitPrice = room.material_unit_price || 0;
          const totalValue = totalLinearMeters * unitPrice;

          return {
            descricao: `${room.name} - ${room.joist_count} vigotas x ${room.joist_length}m`,
            codigo: null,
            quantidade: totalLinearMeters,
            valor_unitario: unitPrice,
            valor_total: totalValue,
            unidade: 'm'
          };
        });

        if (quoteData?.total_value && items.length > 0) {
          const somaItens = items.reduce((sum, item) => sum + item.valor_total, 0);
          if (Math.abs(somaItens - quoteData.total_value) > 1) {
            items.push({
              descricao: 'Outros itens / Ajustes',
              codigo: null,
              quantidade: 1,
              valor_unitario: quoteData.total_value - somaItens,
              valor_total: quoteData.total_value - somaItens,
              unidade: 'un'
            });
          }
        }

        setQuoteItems(items);

      } else if (origem === 'escritorio') {
        const { data, error } = await supabase
          .from('engineering_projects')
          .select(`
            *,
            engineering_services (name)
          `)
          .eq('id', origemId)
          .single();

        if (error) throw error;

        if (data) {
          setQuoteItems([{
            descricao: data.engineering_services?.name || 'Serviço de Engenharia',
            codigo: null,
            quantidade: 1,
            valor_unitario: data.proposed_price || 0,
            valor_total: data.proposed_price || 0,
            unidade: 'un'
          }]);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar itens do orçamento:', error);
      setQuoteItems([]);
    } finally {
      setLoadingItems(false);
    }
  }

  function filterReceivables() {
    let filtered: Receivable[] = [];

    if (activeTab === 'pendente') {
      filtered = receivables.filter(r => r.status === 'pendente' || r.status === 'em_compensacao');
    } else {
      filtered = receivables.filter(r => r.status === activeTab);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        r.unified_sales?.sale_number?.toLowerCase().includes(term) ||
        r.unified_sales?.customer_name_snapshot?.toLowerCase().includes(term) ||
        r.descricao?.toLowerCase().includes(term)
      );
    }

    setFilteredReceivables(filtered);
  }

  function closeActionsModal() {
    setShowActionsModal(false);
    setQuoteItems([]);
  }

  function getVencimentoIndicator(dataVencimento: string | null): { color: string; text: string } {
    if (!dataVencimento) return { color: 'bg-gray-100 text-gray-600', text: 'Sem vencimento' };

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const venc = new Date(dataVencimento + 'T00:00:00');

    const diffDays = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { color: 'bg-red-100 text-red-700', text: `Vencido há ${Math.abs(diffDays)} dia(s)` };
    if (diffDays === 0) return { color: 'bg-orange-100 text-orange-700', text: 'Vence hoje' };
    if (diffDays <= 7) return { color: 'bg-yellow-100 text-yellow-700', text: `Vence em ${diffDays} dia(s)` };
    return { color: 'bg-green-100 text-green-700', text: `Vence em ${diffDays} dia(s)` };
  }

  function getOrigemBadge(origem_tipo: string): { icon: React.ReactNode; text: string; color: string } {
    switch (origem_tipo) {
      case 'fabrica':
        return { icon: <Building2 className="w-3 h-3" />, text: 'Orç. Fábrica', color: 'bg-blue-100 text-blue-700' };
      case 'laje':
        return { icon: <Building2 className="w-3 h-3" />, text: 'Orç. Laje', color: 'bg-cyan-100 text-cyan-700' };
      case 'escritorio':
        return { icon: <FileText className="w-3 h-3" />, text: 'Orç. Escritório', color: 'bg-green-100 text-green-700' };
      default:
        return { icon: <FileText className="w-3 h-3" />, text: 'Desconhecido', color: 'bg-gray-100 text-gray-700' };
    }
  }

  async function handleDefinirPagamento() {
    if (!selectedReceivable) return;

    try {
      const venda = selectedReceivable.unified_sales;
      if (!venda) return;

      const valorTotal = venda.valor_total;
      const valorEntrada = parseFloat(paymentForm.entrada_valor) || 0;
      const valorParcelado = valorTotal - valorEntrada;
      const numParcelas = parseInt(paymentForm.num_parcelas) || 1;
      const valorParcela = valorParcelado / numParcelas;

      const newReceivables = [];

      // Entrada (se houver)
      if (valorEntrada > 0) {
        newReceivables.push({
          parcela_numero: 0,
          descricao: 'Entrada',
          valor_parcela: valorEntrada,
          data_vencimento: new Date().toISOString().split('T')[0],
          forma_pagamento: paymentForm.forma_pagamento,
          status: 'pendente',
          unidade_negocio: venda.unidade_negocio
        });
      }

      // Parcelas
      for (let i = 1; i <= numParcelas; i++) {
        const dataVenc = new Date(paymentForm.data_primeira_parcela);
        dataVenc.setDate(dataVenc.getDate() + (i - 1) * parseInt(paymentForm.intervalo_dias));

        newReceivables.push({
          parcela_numero: i,
          descricao: numParcelas === 1 ? 'Parcela única' : `Parcela ${i}/${numParcelas}`,
          valor_parcela: valorParcela,
          data_vencimento: dataVenc.toISOString().split('T')[0],
          forma_pagamento: paymentForm.forma_pagamento,
          status: 'pendente',
          unidade_negocio: venda.unidade_negocio
        });
      }

      // Chamar função de replanejamento
      const { data, error } = await supabase.rpc('replan_receivables', {
        p_venda_id: venda.id,
        p_new_receivables: newReceivables
      });

      if (error) throw error;

      alert('Pagamento definido com sucesso!');
      setShowPaymentModal(false);
      loadReceivables();
    } catch (error: any) {
      console.error('Erro ao definir pagamento:', error);
      alert('Erro ao definir pagamento: ' + error.message);
    }
  }

  async function handleConfirmarRecebimento() {
    if (!selectedReceivable) return;

    if (!receiveForm.conta_caixa_id) {
      alert('Por favor, selecione uma conta de caixa');
      return;
    }

    if (!receiveForm.data_recebimento) {
      alert('Por favor, informe a data do recebimento');
      return;
    }

    try {
      const valorRecebido = parseFloat(receiveForm.valor_recebido) || selectedReceivable.valor_parcela;

      const { error } = await supabase
        .from('receivables')
        .update({
          status: 'pago',
          data_recebimento: new Date(receiveForm.data_recebimento).toISOString(),
          valor_recebido: valorRecebido,
          conta_caixa_id: receiveForm.conta_caixa_id,
          recebido_por: receiveForm.recebido_por,
          observacoes: receiveForm.observacoes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedReceivable.id);

      if (error) throw error;

      alert('Recebimento confirmado com sucesso!');
      setShowReceiveModal(false);
      loadReceivables();
    } catch (error: any) {
      console.error('Erro ao confirmar recebimento:', error);
      alert('Erro ao confirmar recebimento: ' + error.message);
    }
  }

  async function handleInformarCheque() {
    if (!selectedReceivable) return;

    try {
      // Inserir dados do cheque
      const { data: chequeData, error: chequeError } = await supabase
        .from('cheque_details')
        .insert({
          receivable_id: selectedReceivable.id,
          numero_cheque: chequeForm.numero_cheque,
          banco_nome: chequeForm.banco_nome,
          banco_codigo: chequeForm.banco_codigo || null,
          agencia: chequeForm.agencia || null,
          conta: chequeForm.conta || null,
          titular: chequeForm.titular,
          cpf_cnpj_titular: chequeForm.cpf_cnpj_titular || null,
          data_emissao: chequeForm.data_emissao,
          data_bom_para: chequeForm.data_bom_para || null,
          status_cheque: 'a_depositar',
          observacoes: chequeForm.observacoes || null
        })
        .select()
        .single();

      if (chequeError) throw chequeError;

      // Atualizar recebível para 'em_compensacao'
      const { error: updateError } = await supabase
        .from('receivables')
        .update({
          status: 'em_compensacao',
          forma_pagamento: 'cheque',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedReceivable.id);

      if (updateError) throw updateError;

      alert('Cheque informado com sucesso!');
      setShowChequeModal(false);
      loadReceivables();
    } catch (error: any) {
      console.error('Erro ao informar cheque:', error);
      alert('Erro ao informar cheque: ' + error.message);
    }
  }

  function openPaymentModal(receivable: Receivable) {
    setSelectedReceivable(receivable);
    setPaymentForm({
      forma_pagamento: 'pix',
      entrada_valor: '',
      num_parcelas: '1',
      intervalo_dias: '30',
      data_primeira_parcela: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
    setShowPaymentModal(true);
  }

  function openReceiveModal(receivable: Receivable) {
    setSelectedReceivable(receivable);
    setReceiveForm({
      data_recebimento: new Date().toISOString().split('T')[0],
      valor_recebido: receivable.valor_parcela.toString(),
      conta_caixa_id: '',
      recebido_por: '',
      observacoes: '',
    });
    setShowReceiveModal(true);
  }

  function openChequeModal(receivable: Receivable) {
    setSelectedReceivable(receivable);
    setChequeForm({
      numero_cheque: '',
      banco_nome: '',
      banco_codigo: '',
      agencia: '',
      conta: '',
      titular: receivable.unified_sales?.customer_name_snapshot || '',
      cpf_cnpj_titular: '',
      data_emissao: new Date().toISOString().split('T')[0],
      data_bom_para: '',
      observacoes: '',
    });
    setShowChequeModal(true);
  }

  async function handleEstornarPagamentoIndividual(payment: ReceivablePayment) {
    const motivo = prompt('Informe o motivo do estorno:');

    if (!motivo || motivo.trim() === '') {
      alert('É necessário informar o motivo do estorno.');
      return;
    }

    if (!confirm(`Tem certeza que deseja estornar este pagamento de R$ ${payment.valor_pago.toFixed(2)}?`)) {
      return;
    }

    try {
      const { error: paymentError } = await supabase
        .from('receivable_payments')
        .update({
          estornado: true,
          data_estorno: new Date().toISOString(),
          motivo_estorno: motivo
        })
        .eq('id', payment.id);

      if (paymentError) throw paymentError;

      const { error: cashFlowError } = await supabase
        .from('cash_flow')
        .delete()
        .eq('date', payment.data_pagamento)
        .eq('amount', payment.valor_pago)
        .eq('conta_caixa_id', payment.conta_caixa_id);

      if (cashFlowError) {
        console.error('Erro ao deletar fluxo de caixa:', cashFlowError);
      }

      alert('Pagamento estornado com sucesso!');
      await loadReceivables();

      if (selectedCustomerId) {
        await loadCustomerReceivables(selectedCustomerId);
      }
    } catch (error: any) {
      console.error('Erro ao estornar pagamento:', error);
      alert('Erro ao estornar pagamento: ' + error.message);
    }
  }

  async function handleEstornarPagamento(receivable: Receivable) {
    if (!receivable.payments || receivable.payments.length === 0) {
      alert('Não há pagamentos para estornar.');
      return;
    }

    const paymentsAtivos = receivable.payments.filter(p => !p.estornado);

    if (paymentsAtivos.length === 0) {
      alert('Todos os pagamentos já foram estornados.');
      return;
    }

    const motivo = prompt('Informe o motivo do estorno de todos os pagamentos:');

    if (!motivo || motivo.trim() === '') {
      alert('É necessário informar o motivo do estorno.');
      return;
    }

    if (!confirm(`Tem certeza que deseja estornar TODOS os ${paymentsAtivos.length} pagamento(s) deste recebível? O recebível voltará para o status "Pendente".`)) {
      return;
    }

    try {
      const { error: paymentError } = await supabase
        .from('receivable_payments')
        .update({
          estornado: true,
          data_estorno: new Date().toISOString(),
          motivo_estorno: motivo
        })
        .eq('receivable_id', receivable.id)
        .eq('estornado', false);

      if (paymentError) throw paymentError;

      for (const payment of paymentsAtivos) {
        const { error: cashFlowError } = await supabase
          .from('cash_flow')
          .delete()
          .eq('date', payment.data_pagamento)
          .eq('amount', payment.valor_pago)
          .eq('conta_caixa_id', payment.conta_caixa_id);

        if (cashFlowError) {
          console.error('Erro ao deletar fluxo de caixa:', cashFlowError);
        }
      }

      alert('Todos os pagamentos foram estornados com sucesso!');
      await loadReceivables();

      if (selectedCustomerId) {
        await loadCustomerReceivables(selectedCustomerId);
      }
    } catch (error: any) {
      console.error('Erro ao estornar pagamentos:', error);
      alert('Erro ao estornar pagamentos: ' + error.message);
    }
  }

  async function handleExcluirVenda(receivable: Receivable) {
    if (!receivable.unified_sales) {
      alert('Venda não encontrada.');
      return;
    }

    const venda = receivable.unified_sales;

    if (!confirm(
      `ATENÇÃO: Tem certeza que deseja EXCLUIR PERMANENTEMENTE esta venda?\n\n` +
      `Venda: ${venda.sale_number}\n` +
      `Cliente: ${venda.customer_name_snapshot}\n` +
      `Valor: R$ ${venda.valor_total.toFixed(2)}\n\n` +
      `Esta ação NÃO pode ser desfeita e irá excluir:\n` +
      `- Todos os recebíveis desta venda\n` +
      `- Todos os dados de pagamento\n` +
      `- Todos os cheques vinculados\n\n` +
      `Digite "CONFIRMAR" para prosseguir:`
    )) {
      return;
    }

    const confirmacao = prompt('Digite "CONFIRMAR" em letras maiúsculas para excluir esta venda:');

    if (confirmacao !== 'CONFIRMAR') {
      alert('Exclusão cancelada. A confirmação não foi digitada corretamente.');
      return;
    }

    try {
      console.log('Iniciando exclusão da venda:', venda.id);

      // 1. Deletar cheques vinculados aos recebíveis
      console.log('Deletando cheques...');
      const { error: deleteChequesError } = await supabase
        .from('cheque_details')
        .delete()
        .in('receivable_id',
          receivables
            .filter(r => r.venda_id === venda.id)
            .map(r => r.id)
        );

      if (deleteChequesError) {
        console.error('Erro ao deletar cheques:', deleteChequesError);
        throw deleteChequesError;
      }

      // 2. Deletar lançamentos do fluxo de caixa vinculados
      console.log('Deletando lançamentos do fluxo de caixa...');
      const { error: deleteCashFlowError } = await supabase
        .from('cash_flow')
        .delete()
        .in('id',
          receivables
            .filter(r => r.venda_id === venda.id && r.cash_flow_id)
            .map(r => r.cash_flow_id)
        );

      if (deleteCashFlowError) {
        console.error('Erro ao deletar cash_flow:', deleteCashFlowError);
        // Não lançar erro, pode não existir
      }

      // 3. Deletar recebíveis
      console.log('Deletando recebíveis...');
      const { error: deleteReceivablesError } = await supabase
        .from('receivables')
        .delete()
        .eq('venda_id', venda.id);

      if (deleteReceivablesError) {
        console.error('Erro ao deletar recebíveis:', deleteReceivablesError);
        throw deleteReceivablesError;
      }

      // 4. Atualizar quote se houver (para permitir recriar venda)
      if (venda.quote_id) {
        console.log('Atualizando quote...');
        const { error: updateQuoteError } = await supabase
          .from('quotes')
          .update({
            sale_created: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', venda.quote_id);

        if (updateQuoteError) {
          console.error('Erro ao atualizar quote:', updateQuoteError);
          // Não lançar erro, continuar com a exclusão
        }
      }

      // 5. Deletar venda
      console.log('Deletando venda...');
      const { error: deleteSaleError } = await supabase
        .from('unified_sales')
        .delete()
        .eq('id', venda.id);

      if (deleteSaleError) {
        console.error('Erro ao deletar venda:', deleteSaleError);
        throw deleteSaleError;
      }

      console.log('Venda excluída com sucesso!');

      // Recarregar dados
      await loadReceivables();

      // Usar setTimeout para garantir que o estado seja atualizado antes de mostrar mensagem
      setTimeout(() => {
        alert('Venda excluída com sucesso!');
      }, 100);
    } catch (error: any) {
      console.error('Erro ao excluir venda:', error);
      alert('Erro ao excluir venda: ' + (error.message || JSON.stringify(error)));
    }
  }

  const mainTabs = [
    { id: 'receivables' as MainTabType, label: 'Recebíveis', icon: DollarSign },
    { id: 'customer-statement' as MainTabType, label: 'Extrato de Cliente', icon: Receipt },
    { id: 'fiscal-exporter' as MainTabType, label: 'Exportar NF-e', icon: FileText },
  ];

  const receivableTabs = [
    { id: 'sem_definicao' as ReceivableTabType, label: 'Sem Definição', icon: AlertCircle, color: 'text-gray-600', count: receivables.filter(r => r.status === 'sem_definicao').length },
    { id: 'pendente' as ReceivableTabType, label: 'A Receber', icon: Clock, color: 'text-yellow-600', count: receivables.filter(r => r.status === 'pendente' || r.status === 'em_compensacao').length },
    { id: 'pago' as ReceivableTabType, label: 'Recebido', icon: CheckCircle, color: 'text-green-600', count: receivables.filter(r => r.status === 'pago').length },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-4">
          <DollarSign className="w-8 h-8 text-green-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Financeiro de Vendas</h2>
            <p className="text-gray-600">Gestão completa do financeiro de vendas</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex overflow-x-auto">
            {mainTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setMainTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 font-medium border-b-2 transition-colors whitespace-nowrap ${
                    mainTab === tab.id
                      ? 'border-green-500 text-green-600 bg-green-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6">
          {mainTab === 'receivables' && (
            <div className="space-y-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Buscar por número da venda, cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div className="border-b border-gray-200">
                <div className="flex overflow-x-auto">
                  {receivableTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                      activeTab === tab.id ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              <p className="mt-2 text-gray-600">Carregando recebíveis...</p>
            </div>
          ) : filteredReceivables.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Nenhum recebível nesta categoria</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReceivables.map((receivable) => {
                const venda = receivable.unified_sales;
                const origem = venda ? getOrigemBadge(venda.origem_tipo) : null;
                const vencIndicator = getVencimentoIndicator(receivable.data_vencimento);
                const cheque = receivable.cheque_details && receivable.cheque_details.length > 0 ? receivable.cheque_details[0] : null;

                return (
                  <div
                    key={receivable.id}
                    ref={receivable.id === highlightReceivableId ? highlightedReceivableRef : null}
                    className={`border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all ${
                      receivable.id === highlightReceivableId ? 'bg-yellow-50 border-yellow-500 border-l-4 shadow-lg' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-bold text-lg text-gray-900">
                            {venda?.sale_number || 'S/N'}
                          </span>
                          {origem && (
                            <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${origem.color}`}>
                              {origem.icon}
                              {origem.text}
                            </span>
                          )}
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                            {receivable.unidade_negocio || 'N/A'}
                          </span>
                        </div>

                        <p className="text-gray-700 font-medium">{venda?.customer_name_snapshot || 'Cliente não identificado'}</p>
                        <p className="text-sm text-gray-600">{receivable.descricao}</p>

                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <div>
                            <span className="text-gray-500">Valor:</span>
                            <span className="font-bold text-gray-900 ml-1">
                              R$ {receivable.valor_parcela.toFixed(2)}
                            </span>
                          </div>

                          {receivable.data_vencimento && activeTab === 'pendente' && (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${vencIndicator.color}`}>
                              <Calendar className="w-3 h-3 inline mr-1" />
                              {vencIndicator.text}
                            </span>
                          )}

                          {receivable.forma_pagamento && (
                            <span className="text-gray-600">
                              <CreditCard className="w-3 h-3 inline mr-1" />
                              {receivable.forma_pagamento.toUpperCase()}
                            </span>
                          )}

                          {cheque && (
                            <span className="text-blue-600 text-xs">
                              Cheque {cheque.numero_cheque} - {cheque.banco_nome}
                            </span>
                          )}

                          {receivable.status === 'pago' && receivable.data_recebimento && (
                            <span className="text-green-600 text-xs">
                              Recebido em {new Date(receivable.data_recebimento).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 ml-4">
                        {activeTab === 'sem_definicao' && (
                          <button
                            onClick={() => openPaymentModal(receivable)}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                          >
                            <Plus className="w-4 h-4" />
                            Definir Pagamento
                          </button>
                        )}

                        {activeTab === 'pendente' && (
                          <>
                            <button
                              onClick={() => openReceiveModal(receivable)}
                              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                            >
                              <Check className="w-4 h-4" />
                              Confirmar
                            </button>
                            {receivable.forma_pagamento !== 'cheque' && (
                              <button
                                onClick={() => openChequeModal(receivable)}
                                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                              >
                                <CreditCard className="w-4 h-4" />
                                Informar Cheque
                              </button>
                            )}
                          </>
                        )}

                        {activeTab === 'pago' && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleEstornarPagamento(receivable);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Estornar
                          </button>
                        )}

                        {activeTab !== 'pago' && (
                          <button
                            onClick={() => openPaymentModal(receivable)}
                            className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                          >
                            <Edit className="w-4 h-4" />
                            Replanejar
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setSelectedReceivable(receivable);
                            setShowActionsModal(true);
                            loadQuoteItems(receivable);
                          }}
                          className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
                        >
                          <Eye className="w-4 h-4" />
                          Ver Venda
                        </button>

                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleExcluirVenda(receivable);
                          }}
                          className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                        >
                          <Trash2 className="w-4 h-4" />
                          Excluir Venda
                        </button>
                      </div>
                    </div>

                    {/* Lista de Pagamentos */}
                    {(activeTab === 'pago' || (receivable.payments && receivable.payments.length > 0)) && receivable.payments && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          Histórico de Pagamentos ({receivable.payments.filter(p => !p.estornado).length} ativo{receivable.payments.filter(p => !p.estornado).length !== 1 ? 's' : ''})
                        </h4>

                        <div className="space-y-2">
                          {receivable.payments.map((payment) => (
                            <div
                              key={payment.id}
                              className={`flex items-start justify-between p-3 rounded-lg ${
                                payment.estornado ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
                              }`}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  {payment.estornado ? (
                                    <XCircle className="w-4 h-4 text-red-600" />
                                  ) : (
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                  )}
                                  <span className={`font-bold ${payment.estornado ? 'text-red-900 line-through' : 'text-green-900'}`}>
                                    R$ {payment.valor_pago.toFixed(2)}
                                  </span>
                                  <span className="text-xs text-gray-600">
                                    {new Date(payment.data_pagamento).toLocaleDateString('pt-BR')}
                                  </span>
                                  {payment.forma_pagamento && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                      {payment.forma_pagamento.toUpperCase()}
                                    </span>
                                  )}
                                </div>

                                <div className="text-xs text-gray-600 space-y-1">
                                  {payment.conta_caixa_id && payment.contas_caixa?.nome && (
                                    <div>Conta: {payment.contas_caixa.nome}</div>
                                  )}
                                  {payment.recebido_por && (
                                    <div>Recebido por: {payment.recebido_por}</div>
                                  )}
                                  {payment.observacoes && (
                                    <div>Obs: {payment.observacoes}</div>
                                  )}
                                  {payment.estornado && payment.motivo_estorno && (
                                    <div className="text-red-700 font-medium mt-1">
                                      Estornado: {payment.motivo_estorno}
                                      {payment.data_estorno && ` (${new Date(payment.data_estorno).toLocaleDateString('pt-BR')})`}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {!payment.estornado && activeTab === 'pago' && (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleEstornarPagamentoIndividual(payment);
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-xs font-medium ml-2"
                                  title="Estornar este pagamento"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  Estornar
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        {receivable.payments.filter(p => !p.estornado).length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-300 flex justify-between items-center">
                            <span className="text-sm font-semibold text-gray-700">Total Recebido:</span>
                            <span className="text-lg font-bold text-green-600">
                              R$ {receivable.payments.filter(p => !p.estornado).reduce((sum, p) => sum + p.valor_pago, 0).toFixed(2)}
                            </span>
                          </div>
                        )}

                        {receivable.payments.filter(p => p.estornado).length > 0 && (
                          <div className="mt-2 text-xs text-red-600">
                            {receivable.payments.filter(p => p.estornado).length} pagamento(s) estornado(s)
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
            </div>
          )}

          {mainTab === 'customer-statement' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <Receipt className="w-8 h-8 text-red-600 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Consulta de Débitos e Recebimentos</h3>
                    <p className="text-gray-700 mb-4">
                      Selecione um cliente na lista abaixo para visualizar seus débitos pendentes e registrar recebimentos de pagamentos.
                    </p>
                    <div className="mb-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        <User className="inline w-4 h-4 mr-1" />
                        Selecionar Cliente:
                      </label>
                      <select
                        value={selectedCustomerId}
                        onChange={(e) => {
                          const customerId = e.target.value;
                          setSelectedCustomerId(customerId);
                          if (customerId) {
                            loadCustomerReceivables(customerId);
                          } else {
                            setCustomerReceivables([]);
                          }
                        }}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-lg"
                      >
                        <option value="">Selecione um cliente...</option>
                        {customers.map((customer) => {
                          const customerDebt = customersWithDebts.find(cd => cd.id === customer.id);
                          const hasDebt = !!customerDebt;
                          const debtInfo = hasDebt ? ` - DÉBITO: R$ ${customerDebt.totalDebt.toFixed(2)}` : ' - Em dia';

                          return (
                            <option key={customer.id} value={customer.id}>
                              {customer.name} - {customer.cpf || 'Sem CPF/CNPJ'}{debtInfo}
                            </option>
                          );
                        })}
                      </select>
                      {customers.length === 0 && (
                        <p className="text-sm text-gray-500 mt-2">
                          Nenhum cliente cadastrado no sistema
                        </p>
                      )}
                      {customers.length > 0 && (
                        <p className="text-sm text-gray-600 mt-2">
                          Total: {customers.length} cliente{customers.length !== 1 ? 's' : ''} cadastrado{customers.length !== 1 ? 's' : ''}
                          {customersWithDebts.length > 0 && ` • ${customersWithDebts.length} com débitos pendentes`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {!selectedCustomerId && customers.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                  <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-700 mb-2">
                    Selecione um Cliente
                  </h4>
                  <p className="text-gray-600">
                    Use a lista acima para selecionar um cliente e visualizar seus débitos e recebimentos
                  </p>
                </div>
              )}

              {!selectedCustomerId && customers.length === 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                  <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-700 mb-2">
                    Nenhum Cliente Cadastrado
                  </h4>
                  <p className="text-gray-600">
                    Cadastre clientes no módulo "Cadastro de Clientes" para poder visualizar seus débitos aqui
                  </p>
                </div>
              )}

              {selectedCustomerId && loadingCustomerDebts ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                  <p className="mt-2 text-gray-600">Carregando débitos do cliente...</p>
                </div>
              ) : selectedCustomerId && customerReceivables.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <button
                    onClick={() => {
                      setSelectedCustomerId('');
                      setCustomerReceivables([]);
                    }}
                    className="mb-4 text-red-600 hover:text-red-800 font-medium flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Limpar Seleção
                  </button>
                  <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      <User className="w-6 h-6 text-green-600" />
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">
                          {customers.find(c => c.id === selectedCustomerId)?.name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {customers.find(c => c.id === selectedCustomerId)?.cpf || 'CPF/CNPJ não informado'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-center py-12">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                    <p className="text-lg font-medium text-gray-900 mb-2">Cliente em Dia!</p>
                    <p className="text-gray-600">Este cliente não possui débitos pendentes</p>
                  </div>
                </div>
              ) : selectedCustomerId && customerReceivables.length > 0 ? (
                <div className="space-y-6">
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <button
                      onClick={() => {
                        setSelectedCustomerId('');
                        setCustomerReceivables([]);
                      }}
                      className="mb-4 text-red-600 hover:text-red-800 font-medium flex items-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Limpar Seleção
                    </button>

                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <User className="w-6 h-6 text-red-600" />
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">
                            {customers.find(c => c.id === selectedCustomerId)?.name}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {customers.find(c => c.id === selectedCustomerId)?.cpf || 'CPF/CNPJ não informado'}
                          </p>
                          <p className="text-sm font-medium text-orange-600 mt-1">
                            {customerReceivables.length} recebíve{customerReceivables.length !== 1 ? 'is' : 'l'} pendente{customerReceivables.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        <button
                          onClick={exportCustomerStatement}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                          <Download className="w-4 h-4" />
                          Exportar Extrato
                        </button>
                        <div className="text-right">
                          <p className="text-sm text-gray-600 mb-1">Saldo Devedor Total</p>
                          <p className="text-3xl font-bold text-red-600">
                            R$ {customerReceivables.reduce((sum, r) => sum + (r.valor_parcela - (r.valor_recebido || 0)), 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Venda</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Descrição</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">Vencimento</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">Valor Total</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">Pago</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">Saldo</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">Status</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {customerReceivables.map((receivable) => {
                            const valorPago = receivable.valor_recebido || 0;
                            const saldoDevedor = receivable.valor_parcela - valorPago;
                            const isVencido = receivable.data_vencimento && new Date(receivable.data_vencimento) < new Date();
                            const hasPayment = receivable.data_recebimento || receivable.forma_pagamento || receivable.recebido_por;

                            return (
                              <>
                                <tr key={receivable.id} className="hover:bg-gray-50">
                                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                    #{receivable.unified_sales?.sale_number || receivable.venda_id.substring(0, 8)}
                                  </td>
                                  <td className="px-6 py-4 text-sm text-gray-600">
                                    {receivable.descricao}
                                  </td>
                                  <td className="px-6 py-4 text-sm text-center">
                                    {receivable.data_vencimento ? (
                                      <div className={`inline-flex items-center gap-1 ${isVencido ? 'text-red-600 font-semibold' : 'text-gray-700'}`}>
                                        <Calendar className="w-4 h-4" />
                                        {new Date(receivable.data_vencimento).toLocaleDateString('pt-BR')}
                                      </div>
                                    ) : '-'}
                                  </td>
                                  <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">
                                    R$ {receivable.valor_parcela.toFixed(2)}
                                  </td>
                                  <td className="px-6 py-4 text-sm text-right text-green-600 font-medium">
                                    R$ {valorPago.toFixed(2)}
                                  </td>
                                  <td className="px-6 py-4 text-sm text-right text-red-600 font-bold">
                                    R$ {saldoDevedor.toFixed(2)}
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      receivable.status === 'pendente' ? 'bg-yellow-100 text-yellow-800' :
                                      receivable.status === 'em_compensacao' ? 'bg-blue-100 text-blue-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {receivable.status === 'pendente' ? 'Pendente' :
                                       receivable.status === 'em_compensacao' ? 'Em Compensação' :
                                       'Sem Definição'}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <button
                                      onClick={() => openPayCustomerDebtModal(receivable)}
                                      className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                                    >
                                      <DollarSign className="w-4 h-4" />
                                      Receber
                                    </button>
                                  </td>
                                </tr>
                                {hasPayment && (
                                  <tr key={`${receivable.id}-payment`} className="bg-green-50 border-l-4 border-green-500">
                                    <td colSpan={8} className="px-6 py-3">
                                      <div className="flex items-start justify-between gap-6">
                                        <div className="flex-1">
                                          <div className="flex items-start gap-6">
                                            <div className="flex items-center gap-2 text-green-700 font-semibold">
                                              <CheckCircle className="w-5 h-5" />
                                              <span className="text-sm">Detalhes do Pagamento:</span>
                                            </div>
                                            <div className="flex flex-wrap gap-6 text-sm">
                                              {receivable.forma_pagamento && (
                                                <div className="flex items-center gap-2">
                                                  <CreditCard className="w-4 h-4 text-gray-600" />
                                                  <span className="text-gray-600">Forma:</span>
                                                  <span className="font-medium text-gray-900">
                                                    {receivable.forma_pagamento === 'pix' ? 'PIX' :
                                                     receivable.forma_pagamento === 'dinheiro' ? 'Dinheiro' :
                                                     receivable.forma_pagamento === 'transferencia' ? 'Transferência' :
                                                     receivable.forma_pagamento === 'boleto' ? 'Boleto' :
                                                     receivable.forma_pagamento === 'cheque' ? 'Cheque' :
                                                     receivable.forma_pagamento === 'cartao_credito' ? 'Cartão de Crédito' :
                                                     receivable.forma_pagamento === 'cartao_debito' ? 'Cartão de Débito' :
                                                     receivable.forma_pagamento}
                                                  </span>
                                                </div>
                                              )}
                                              {receivable.data_recebimento && (
                                                <div className="flex items-center gap-2">
                                                  <Clock className="w-4 h-4 text-gray-600" />
                                                  <span className="text-gray-600">Data:</span>
                                                  <span className="font-medium text-gray-900">
                                                    {new Date(receivable.data_recebimento).toLocaleDateString('pt-BR')} às {new Date(receivable.data_recebimento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                  </span>
                                                </div>
                                              )}
                                              {receivable.valor_recebido && (
                                                <div className="flex items-center gap-2">
                                                  <DollarSign className="w-4 h-4 text-gray-600" />
                                                  <span className="text-gray-600">Valor Pago:</span>
                                                  <span className="font-medium text-green-700">R$ {receivable.valor_recebido.toFixed(2)}</span>
                                                </div>
                                              )}
                                              {receivable.recebido_por && (
                                                <div className="flex items-center gap-2">
                                                  <User className="w-4 h-4 text-gray-600" />
                                                  <span className="text-gray-600">Recebido por:</span>
                                                  <span className="font-medium text-gray-900">{receivable.recebido_por}</span>
                                                </div>
                                              )}
                                              {receivable.contas_caixa?.nome && (
                                                <div className="flex items-center gap-2">
                                                  <Banknote className="w-4 h-4 text-gray-600" />
                                                  <span className="text-gray-600">Conta/Caixa:</span>
                                                  <span className="font-medium text-gray-900">{receivable.contas_caixa.nome}</span>
                                                </div>
                                              )}
                                              {receivable.observacoes && (
                                                <div className="flex items-start gap-2 w-full">
                                                  <FileText className="w-4 h-4 text-gray-600 mt-0.5" />
                                                  <span className="text-gray-600">Obs:</span>
                                                  <span className="font-medium text-gray-900 flex-1">{receivable.observacoes}</span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        <button
                                          onClick={() => generatePaymentReceipt(receivable)}
                                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-green-600 text-green-600 rounded-lg hover:bg-green-50 transition-colors text-sm font-medium whitespace-nowrap"
                                          title="Gerar Recibo de Pagamento"
                                        >
                                          <Printer className="w-4 h-4" />
                                          Recibo
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-red-50">
                          <tr>
                            <td colSpan={5} className="px-6 py-4 text-right text-sm font-bold text-gray-900">
                              Saldo Devedor Total:
                            </td>
                            <td className="px-6 py-4 text-right text-lg font-bold text-red-600">
                              R$ {customerReceivables.reduce((sum, r) => sum + (r.valor_parcela - (r.valor_recebido || 0)), 0).toFixed(2)}
                            </td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {mainTab === 'fiscal-exporter' && <FiscalExporter />}
        </div>
      </div>

      {/* Modal Definir Pagamento */}
      {showPaymentModal && selectedReceivable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Definir Condição de Pagamento</h3>
              <p className="text-sm text-gray-600 mt-1">
                Venda: {selectedReceivable.unified_sales?.sale_number} - Valor Total: R$ {selectedReceivable.unified_sales?.valor_total.toFixed(2)}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Forma de Pagamento</label>
                <select
                  value={paymentForm.forma_pagamento}
                  onChange={(e) => setPaymentForm({ ...paymentForm, forma_pagamento: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="pix">PIX</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="transferencia">Transferência</option>
                  <option value="boleto">Boleto</option>
                  <option value="cheque">Cheque</option>
                  <option value="cartao_credito">Cartão de Crédito</option>
                  <option value="cartao_debito">Cartão de Débito</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Entrada (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={paymentForm.entrada_valor}
                    onChange={(e) => setPaymentForm({ ...paymentForm, entrada_valor: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número de Parcelas</label>
                  <input
                    type="number"
                    min="1"
                    value={paymentForm.num_parcelas}
                    onChange={(e) => setPaymentForm({ ...paymentForm, num_parcelas: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data 1ª Parcela</label>
                  <input
                    type="date"
                    value={paymentForm.data_primeira_parcela}
                    onChange={(e) => setPaymentForm({ ...paymentForm, data_primeira_parcela: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Intervalo (dias)</label>
                  <input
                    type="number"
                    min="1"
                    value={paymentForm.intervalo_dias}
                    onChange={(e) => setPaymentForm({ ...paymentForm, intervalo_dias: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Resumo:</strong> {paymentForm.entrada_valor ? `Entrada de R$ ${parseFloat(paymentForm.entrada_valor).toFixed(2)} + ` : ''}
                  {paymentForm.num_parcelas}x de R$ {(
                    ((selectedReceivable.unified_sales?.valor_total || 0) - (parseFloat(paymentForm.entrada_valor) || 0)) /
                    (parseInt(paymentForm.num_parcelas) || 1)
                  ).toFixed(2)}
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDefinirPagamento}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Recebimento */}
      {showReceiveModal && selectedReceivable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Confirmar Recebimento</h3>
              <p className="text-sm text-gray-600 mt-1">
                {selectedReceivable.descricao} - R$ {selectedReceivable.valor_parcela.toFixed(2)}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data do Recebimento *</label>
                <input
                  type="date"
                  value={receiveForm.data_recebimento}
                  onChange={(e) => setReceiveForm({ ...receiveForm, data_recebimento: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor Recebido (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={receiveForm.valor_recebido}
                  onChange={(e) => setReceiveForm({ ...receiveForm, valor_recebido: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Conta de Caixa *</label>
                <select
                  value={receiveForm.conta_caixa_id}
                  onChange={(e) => setReceiveForm({ ...receiveForm, conta_caixa_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                >
                  <option value="">Selecione a conta de caixa</option>
                  {contasCaixa.map(conta => (
                    <option key={conta.id} value={conta.id}>
                      {conta.nome} ({conta.unidade})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Selecione a conta onde o valor foi recebido
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recebido por</label>
                <input
                  type="text"
                  value={receiveForm.recebido_por}
                  onChange={(e) => setReceiveForm({ ...receiveForm, recebido_por: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Nome do responsável"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  value={receiveForm.observacoes}
                  onChange={(e) => setReceiveForm({ ...receiveForm, observacoes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  rows={3}
                  placeholder="Informações adicionais..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowReceiveModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarRecebimento}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Confirmar Recebimento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Informar Cheque */}
      {showChequeModal && selectedReceivable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Informar Dados do Cheque</h3>
              <p className="text-sm text-gray-600 mt-1">
                {selectedReceivable.descricao} - R$ {selectedReceivable.valor_parcela.toFixed(2)}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número do Cheque *</label>
                  <input
                    type="text"
                    value={chequeForm.numero_cheque}
                    onChange={(e) => setChequeForm({ ...chequeForm, numero_cheque: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Banco *</label>
                  <input
                    type="text"
                    value={chequeForm.banco_nome}
                    onChange={(e) => setChequeForm({ ...chequeForm, banco_nome: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código Banco</label>
                  <input
                    type="text"
                    value={chequeForm.banco_codigo}
                    onChange={(e) => setChequeForm({ ...chequeForm, banco_codigo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Agência</label>
                  <input
                    type="text"
                    value={chequeForm.agencia}
                    onChange={(e) => setChequeForm({ ...chequeForm, agencia: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Conta</label>
                  <input
                    type="text"
                    value={chequeForm.conta}
                    onChange={(e) => setChequeForm({ ...chequeForm, conta: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titular *</label>
                <input
                  type="text"
                  value={chequeForm.titular}
                  onChange={(e) => setChequeForm({ ...chequeForm, titular: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CPF/CNPJ do Titular</label>
                <input
                  type="text"
                  value={chequeForm.cpf_cnpj_titular}
                  onChange={(e) => setChequeForm({ ...chequeForm, cpf_cnpj_titular: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data de Emissão *</label>
                  <input
                    type="date"
                    value={chequeForm.data_emissao}
                    onChange={(e) => setChequeForm({ ...chequeForm, data_emissao: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bom Para (Pré-datado)</label>
                  <input
                    type="date"
                    value={chequeForm.data_bom_para}
                    onChange={(e) => setChequeForm({ ...chequeForm, data_bom_para: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  value={chequeForm.observacoes}
                  onChange={(e) => setChequeForm({ ...chequeForm, observacoes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowChequeModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleInformarCheque}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Salvar Cheque
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ações da Venda */}
      {showActionsModal && selectedReceivable && selectedReceivable.unified_sales && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-6 h-6 text-blue-600" />
                Informações da Venda
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Venda #{selectedReceivable.unified_sales.sale_number}
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* Informações Gerais */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Dados da Venda
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Número da Venda:</span>
                    <p className="font-semibold text-gray-900">
                      {selectedReceivable.unified_sales.sale_number}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Data da Venda:</span>
                    <p className="font-semibold text-gray-900">
                      {new Date(selectedReceivable.unified_sales.data_venda).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Cliente:</span>
                    <p className="font-semibold text-gray-900">
                      {selectedReceivable.unified_sales.customer_name_snapshot}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Valor Total:</span>
                    <p className="font-semibold text-green-700">
                      R$ {quoteItems.length > 0 ? quoteItems.reduce((sum, item) => sum + item.valor_total, 0).toFixed(2) : selectedReceivable.unified_sales.valor_total.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Unidade de Negócio:</span>
                    <p className="font-semibold text-gray-900">
                      {selectedReceivable.unified_sales.unidade_negocio}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Tipo de Origem:</span>
                    <p className="font-semibold text-gray-900">
                      {selectedReceivable.unified_sales.origem_tipo === 'fabrica' ? 'Fábrica' :
                       selectedReceivable.unified_sales.origem_tipo === 'laje' ? 'Laje Treliçada' :
                       selectedReceivable.unified_sales.origem_tipo === 'escritorio' ? 'Escritório de Engenharia' :
                       'Outro'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Itens do Orçamento */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                  <Package2 className="w-5 h-5" />
                  Itens do Orçamento
                </h4>
                {loadingItems ? (
                  <div className="text-center py-4">
                    <div className="text-gray-500">Carregando itens...</div>
                  </div>
                ) : quoteItems.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-green-100 text-green-900 border-b-2 border-green-300">
                          <th className="text-left py-2 px-3 font-semibold">Descrição</th>
                          <th className="text-center py-2 px-3 font-semibold">Qtd</th>
                          <th className="text-right py-2 px-3 font-semibold">Valor Unit.</th>
                          <th className="text-right py-2 px-3 font-semibold">Valor Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quoteItems.map((item, index) => (
                          <tr key={index} className="border-b border-green-200 hover:bg-green-50">
                            <td className="py-2 px-3">
                              <div className="font-medium text-gray-900">{item.descricao}</div>
                              {item.codigo && (
                                <div className="text-xs text-gray-500">Cód: {item.codigo}</div>
                              )}
                            </td>
                            <td className="text-center py-2 px-3 text-gray-700">
                              {item.quantidade.toFixed(2)} {item.unidade || 'un'}
                            </td>
                            <td className="text-right py-2 px-3 text-gray-700">
                              R$ {item.valor_unitario.toFixed(2)}
                            </td>
                            <td className="text-right py-2 px-3 font-semibold text-gray-900">
                              R$ {item.valor_total.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-green-100 font-bold text-green-900">
                          <td colSpan={3} className="text-right py-2 px-3">Total:</td>
                          <td className="text-right py-2 px-3">
                            R$ {quoteItems.reduce((sum, item) => sum + item.valor_total, 0).toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    Nenhum item encontrado no orçamento.
                  </div>
                )}
              </div>

              {/* Atalhos para Orçamento */}
              <div className="bg-gradient-to-r from-blue-50 to-teal-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <ChevronRight className="w-5 h-5" />
                  Atalhos
                </h4>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      const origem = selectedReceivable.unified_sales?.origem_tipo;
                      const origemId = selectedReceivable.unified_sales?.origem_id;

                      if (!origemId) {
                        alert('ID do orçamento não encontrado.');
                        return;
                      }

                      if (origem === 'fabrica' && onNavigateToQuote) {
                        onNavigateToQuote(origemId, selectedReceivable.id);
                        closeActionsModal();
                      } else if (origem === 'laje' && onNavigateToRibbedSlab) {
                        onNavigateToRibbedSlab(origemId, selectedReceivable.id);
                        closeActionsModal();
                      } else {
                        alert('Navegação não configurada para este tipo de orçamento.');
                      }
                    }}
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-white border-2 border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors font-medium"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      <span>Abrir Orçamento Original</span>
                    </div>
                    <ChevronRight className="w-5 h-5" />
                  </button>

                  {selectedReceivable.unified_sales.origem_tipo === 'laje' && (
                    <p className="text-xs text-gray-600 ml-2">
                      Este orçamento está no módulo de <strong>Laje Treliçada</strong>
                    </p>
                  )}
                  {selectedReceivable.unified_sales.origem_tipo === 'fabrica' && (
                    <p className="text-xs text-gray-600 ml-2">
                      Este orçamento está no módulo de <strong>Orçamentos de Fábrica</strong>
                    </p>
                  )}
                  {selectedReceivable.unified_sales.origem_tipo === 'escritorio' && (
                    <p className="text-xs text-gray-600 ml-2">
                      Este orçamento está no módulo de <strong>Projetos de Engenharia</strong>
                    </p>
                  )}
                </div>
              </div>

              {/* Informações do Recebível Atual */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Recebível Selecionado
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Descrição:</span>
                    <p className="font-semibold text-gray-900">{selectedReceivable.descricao}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Valor:</span>
                    <p className="font-semibold text-green-700">
                      R$ {quoteItems.length > 0 ? quoteItems.reduce((sum, item) => sum + item.valor_total, 0).toFixed(2) : selectedReceivable.valor_parcela.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Status:</span>
                    <p className="font-semibold text-gray-900">
                      {selectedReceivable.status === 'sem_definicao' ? 'Sem Definição' :
                       selectedReceivable.status === 'pendente' ? 'Pendente' :
                       selectedReceivable.status === 'em_compensacao' ? 'Em Compensação' :
                       selectedReceivable.status === 'pago' ? 'Pago' : 'Cancelado'}
                    </p>
                  </div>
                  {selectedReceivable.forma_pagamento && (
                    <div>
                      <span className="text-gray-600">Forma de Pagamento:</span>
                      <p className="font-semibold text-gray-900">
                        {selectedReceivable.forma_pagamento.toUpperCase()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={closeActionsModal}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Receber Pagamento de Débito */}
      {showPayCustomerDebtModal && selectedCustomerReceivable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-green-50 to-teal-50 border-b border-green-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-green-600 rounded-full p-2">
                    <DollarSign className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Receber Pagamento</h3>
                    <p className="text-sm text-gray-600">
                      {selectedCustomerReceivable.descricao}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closePayCustomerDebtModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Valor Total</p>
                    <p className="text-lg font-bold text-gray-900">
                      R$ {selectedCustomerReceivable.valor_parcela.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Já Recebido</p>
                    <p className="text-lg font-bold text-green-600">
                      R$ {(selectedCustomerReceivable.valor_recebido || 0).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Saldo Devedor</p>
                    <p className="text-lg font-bold text-red-600">
                      R$ {(selectedCustomerReceivable.valor_parcela - (selectedCustomerReceivable.valor_recebido || 0)).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      checked={payDebtForm.pagar_total}
                      onChange={(e) => {
                        const valorPendente = selectedCustomerReceivable.valor_parcela - (selectedCustomerReceivable.valor_recebido || 0);
                        setPayDebtForm({
                          ...payDebtForm,
                          pagar_total: e.target.checked,
                          valor_pagar: e.target.checked ? valorPendente.toFixed(2) : ''
                        });
                      }}
                      className="w-4 h-4 text-green-600 focus:ring-green-500 rounded"
                    />
                    <span className="font-medium text-gray-900">Pagar valor total (quitar débito)</span>
                  </label>
                </div>

                {!payDebtForm.pagar_total && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Valor a Pagar (R$) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={payDebtForm.valor_pagar}
                      onChange={(e) => setPayDebtForm({...payDebtForm, valor_pagar: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data do Recebimento *
                  </label>
                  <input
                    type="date"
                    value={payDebtForm.data_recebimento}
                    onChange={(e) => setPayDebtForm({...payDebtForm, data_recebimento: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Forma de Pagamento *
                  </label>
                  <select
                    value={payDebtForm.forma_pagamento}
                    onChange={(e) => setPayDebtForm({...payDebtForm, forma_pagamento: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="pix">PIX</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="transferencia">Transferência</option>
                    <option value="boleto">Boleto</option>
                    <option value="cheque">Cheque</option>
                    <option value="cartao_credito">Cartão de Crédito</option>
                    <option value="cartao_debito">Cartão de Débito</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Conta de Caixa *
                  </label>
                  <select
                    value={payDebtForm.conta_caixa_id}
                    onChange={(e) => setPayDebtForm({...payDebtForm, conta_caixa_id: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">Selecione uma conta</option>
                    {contasCaixa.map(conta => (
                      <option key={conta.id} value={conta.id}>{conta.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Recebido por
                  </label>
                  <input
                    type="text"
                    value={payDebtForm.recebido_por}
                    onChange={(e) => setPayDebtForm({...payDebtForm, recebido_por: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Nome de quem recebeu o pagamento"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observações
                  </label>
                  <textarea
                    value={payDebtForm.observacoes}
                    onChange={(e) => setPayDebtForm({...payDebtForm, observacoes: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    rows={3}
                    placeholder="Observações sobre o recebimento..."
                  />
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={closePayCustomerDebtModal}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handlePayCustomerDebt}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
              >
                Confirmar Recebimento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
