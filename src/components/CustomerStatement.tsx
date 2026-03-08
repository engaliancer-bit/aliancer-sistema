import React, { useState, useEffect, useRef } from 'react';
import { Search, Calendar, Printer, FileText, DollarSign, Package, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PaymentRegistrationModal } from './PaymentRegistrationModal';

interface Customer {
  id: string;
  name: string;
  cpf_cnpj?: string;
  person_type?: string;
}

interface StatementEntry {
  id: string;
  date: string;
  type: 'debit' | 'credit';
  origin: 'venda' | 'orcamento' | 'laje_nervurada' | 'obra';
  description: string;
  reference: string;
  debit_amount: number;
  credit_amount: number;
  balance: number;
  payment_status?: 'unpaid' | 'partial' | 'paid';
  quote_id?: string;
  paid_amount?: number;
  total_amount?: number;
}

const CustomerStatement: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<StatementEntry[]>([]);
  const [summary, setSummary] = useState({
    totalDebits: 0,
    totalCredits: 0,
    balance: 0,
  });
  const [companySettings, setCompanySettings] = useState<any>({});
  const printRef = useRef<HTMLDivElement>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedEntryForPayment, setSelectedEntryForPayment] = useState<StatementEntry | null>(null);

  useEffect(() => {
    loadCustomers();
    loadCompanySettings();
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    setStartDate(firstDay.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  }, []);

  const loadCompanySettings = async () => {
    try {
      const { data } = await supabase
        .from('company_settings')
        .select('*')
        .single();

      if (data) {
        setCompanySettings(data);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações da empresa:', error);
    }
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');

      if (error) throw error;
      if (data) setCustomers(data);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      alert('Erro ao carregar clientes');
    }
  };

  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const customer = customers.find(c => c.id === customerId);
    setSelectedCustomer(customer || null);
    setEntries([]);
    setSummary({ totalDebits: 0, totalCredits: 0, balance: 0 });
  };

  const loadStatement = async () => {
    if (!selectedCustomerId) {
      alert('Selecione um cliente');
      return;
    }

    if (!startDate || !endDate) {
      alert('Selecione o período');
      return;
    }

    setLoading(true);

    try {
      const statementEntries: StatementEntry[] = [];

      const { data: quotesLinkedToWorks } = await supabase
        .from('construction_work_items')
        .select('quote_id', { count: 'exact' })
        .not('quote_id', 'is', null)
        .limit(10000);

      const excludedQuoteIds = new Set(
        (quotesLinkedToWorks || [])
          .map((item: any) => item.quote_id)
          .filter(Boolean)
      );

      const { data: quotes, error: quotesError } = await supabase
        .from('quotes')
        .select(`
          id,
          created_at,
          status,
          total_value,
          payment_status,
          paid_amount,
          quote_items (
            id,
            quantity,
            proposed_price,
            item_type,
            products (name, unit),
            materials (name, unit),
            compositions (name)
          )
        `)
        .eq('customer_id', selectedCustomerId)
        .eq('status', 'approved')
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`)
        .order('created_at', { ascending: true })
        .limit(500);

      if (quotesError) throw quotesError;

      if (quotes) {
        for (const quote of quotes) {
          if (excludedQuoteIds.has(quote.id)) {
            continue;
          }

          const items = quote.quote_items || [];

          const itemsDescription = items.length > 0
            ? items.slice(0, 5).map((item: any) => {
              let itemName = 'Item';
              let unit = 'un';

              if (item.item_type === 'product' && item.products) {
                itemName = item.products.name;
                unit = item.products.unit || 'un';
              } else if (item.item_type === 'material' && item.materials) {
                itemName = item.materials.name;
                unit = item.materials.unit || 'un';
              } else if (item.item_type === 'composition' && item.compositions) {
                itemName = item.compositions.name;
              }

              return `${itemName} (${item.quantity} ${unit})`;
            }).join('; ') + (items.length > 5 ? ` e mais ${items.length - 5} itens` : '')
            : 'Sem itens';

          const totalQuote = items.reduce((sum: number, item: any) =>
            sum + (item.quantity * item.proposed_price), 0
          );

          const paymentStatus = quote.payment_status || 'unpaid';
          const paidAmount = Number(quote.paid_amount) || 0;

          statementEntries.push({
            id: `quote-${quote.id}`,
            date: quote.created_at.split('T')[0],
            type: 'debit',
            origin: 'orcamento',
            description: `Orçamento Aprovado: ${itemsDescription || 'Sem itens'}`,
            reference: `Orç. #${quote.id.substring(0, 8)}`,
            debit_amount: totalQuote,
            credit_amount: paidAmount,
            balance: 0,
            payment_status: paymentStatus,
            quote_id: quote.id,
            paid_amount: paidAmount,
            total_amount: totalQuote,
          });
        }
      }

      const { data: constructionWorks, error: worksError } = await supabase
        .from('construction_works')
        .select('id, work_name, contract_type, total_contract_value, start_date, created_at')
        .eq('customer_id', selectedCustomerId)
        .eq('contract_type', 'pacote_fechado')
        .in('status', ['em_andamento', 'concluido', 'planejamento'])
        .order('created_at', { ascending: true });

      if (worksError) {
        console.error('Erro ao buscar obras:', worksError);
      } else if (constructionWorks) {
        for (const work of constructionWorks) {
          const workDate = work.start_date || work.created_at;
          const dateOnly = workDate.split('T')[0];

          if (dateOnly >= startDate && dateOnly <= endDate) {
            statementEntries.push({
              id: `work-${work.id}`,
              date: dateOnly,
              type: 'debit',
              origin: 'obra',
              description: `Obra Pacote Fechado: ${work.work_name}`,
              reference: `Obra #${work.id.substring(0, 8)}`,
              debit_amount: Number(work.total_contract_value),
              credit_amount: 0,
              balance: 0,
            });
          }
        }
      }

      statementEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let runningBalance = 0;
      const entriesWithBalance = statementEntries.map(entry => {
        const debitValue = entry.debit_amount || 0;
        const creditValue = entry.credit_amount || 0;
        runningBalance += debitValue - creditValue;
        return { ...entry, balance: runningBalance };
      });

      const totalDebits = statementEntries
        .reduce((sum, e) => sum + (e.debit_amount || 0), 0);

      const totalCredits = statementEntries
        .reduce((sum, e) => sum + (e.credit_amount || 0), 0);

      setSummary({
        totalDebits,
        totalCredits,
        balance: totalDebits - totalCredits,
      });

      setEntries(entriesWithBalance);
    } catch (error) {
      console.error('Erro ao carregar extrato:', error);
      alert('Erro ao carregar extrato');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    try {
      const doc = new jsPDF();
      let currentY = 14;

      const headerTitle = companySettings.report_header_title || 'EXTRATO DO CLIENTE';
      const headerSubtitle = companySettings.report_header_subtitle || 'Sistema de Gestão';
      const footerText = companySettings.report_footer_text || 'Documento gerado automaticamente pelo sistema';
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

      if (showCompanyInfo && companyName) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.text(companyName, 14, currentY);
        currentY += 5;
      }

      doc.setDrawColor(10, 126, 194);
      doc.setLineWidth(0.5);
      doc.line(14, currentY, rightMargin, currentY);
      currentY += 8;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Cliente: ${selectedCustomer?.name || ''}`, 14, currentY);
      currentY += 6;

      if (selectedCustomer?.cpf_cnpj) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const docType = selectedCustomer.person_type === 'pf' ? 'CPF' : 'CNPJ';
        doc.text(`${docType}: ${selectedCustomer.cpf_cnpj}`, 14, currentY);
        currentY += 6;
      }

      doc.setFontSize(10);
      doc.text(`Período: ${new Date(startDate).toLocaleDateString('pt-BR')} a ${new Date(endDate).toLocaleDateString('pt-BR')}`, 14, currentY);
      currentY += 10;

      const tableData = entries.map(entry => [
        new Date(entry.date).toLocaleDateString('pt-BR'),
        getOriginLabel(entry.origin),
        entry.description,
        entry.reference,
        entry.type === 'debit' ? `R$ ${entry.debit_amount.toFixed(2)}` : '',
        entry.type === 'credit' ? `R$ ${entry.credit_amount.toFixed(2)}` : '',
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Data', 'Origem', 'Descrição', 'Referência', 'Débito', 'Crédito']],
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [10, 126, 194],
          textColor: 255,
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 25 },
          2: { cellWidth: 60 },
          3: { cellWidth: 30 },
          4: { cellWidth: 25, halign: 'right' },
          5: { cellWidth: 25, halign: 'right' },
        },
      });

      const finalY = (doc as any).lastAutoTable.finalY + 10;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Total a Receber: R$ ${summary.totalDebits.toFixed(2)}`, 14, finalY);
      doc.text(`Total Recebido: R$ ${summary.totalCredits.toFixed(2)}`, 14, finalY + 6);

      const balanceColor = summary.balance > 0 ? [220, 38, 38] : summary.balance < 0 ? [22, 163, 74] : [0, 0, 0];
      doc.setTextColor(balanceColor[0], balanceColor[1], balanceColor[2]);
      const balanceLabel = summary.balance > 0 ? 'Saldo a Receber' : summary.balance < 0 ? 'Saldo Credor' : 'Saldo Quitado';
      doc.text(`${balanceLabel}: R$ ${Math.abs(summary.balance).toFixed(2)}`, 14, finalY + 12);
      doc.setTextColor(0, 0, 0);

      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });

      doc.save(`extrato_${selectedCustomer?.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF. Por favor, tente novamente.');
    }
  };

  const getOriginLabel = (origin: string) => {
    switch (origin) {
      case 'venda': return 'Venda';
      case 'orcamento': return 'Orçamento';
      case 'laje_nervurada': return 'Laje Nervurada';
      default: return origin;
    }
  };

  const getOriginColor = (origin: string) => {
    switch (origin) {
      case 'venda': return 'bg-blue-100 text-blue-800';
      case 'orcamento': return 'bg-yellow-100 text-yellow-800';
      case 'laje_nervurada': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusBadge = (status: string | undefined) => {
    if (!status) return null;
    switch (status) {
      case 'paid':
        return { label: 'Pago', color: 'bg-green-100 text-green-800' };
      case 'partial':
        return { label: 'Parcial', color: 'bg-amber-100 text-amber-800' };
      case 'unpaid':
        return { label: 'Não Pago', color: 'bg-red-100 text-red-800' };
      default:
        return null;
    }
  };

  const handlePaymentClick = (entry: StatementEntry) => {
    if (entry.payment_status !== 'paid' && entry.quote_id) {
      setSelectedEntryForPayment(entry);
      setPaymentModalOpen(true);
    }
  };

  const handlePaymentSuccess = () => {
    setPaymentModalOpen(false);
    setSelectedEntryForPayment(null);
    loadStatement();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="text-[#0A7EC2]" size={32} />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Extrato do Cliente</h1>
            <p className="text-sm text-gray-600">Orçamentos aprovados e pagamentos realizados da fábrica</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Search className="inline mr-2" size={16} />
              Cliente *
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => handleCustomerChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
            >
              <option value="">Selecione um cliente</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} {customer.cpf_cnpj ? `- ${customer.cpf_cnpj}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline mr-2" size={16} />
              Data Início *
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline mr-2" size={16} />
              Data Fim *
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={loadStatement}
            disabled={loading || !selectedCustomerId}
            className="px-6 py-2 bg-[#0A7EC2] text-white rounded-lg hover:bg-[#095a8a] transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Search size={20} />
            {loading ? 'Carregando...' : 'Gerar Extrato'}
          </button>

          {entries.length > 0 && (
            <button
              onClick={handlePrint}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Printer size={20} />
              Imprimir
            </button>
          )}
        </div>
      </div>

      {entries.length > 0 && (
        <div ref={printRef}>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="mb-6 border-b pb-4">
              <h2 className="text-xl font-bold text-gray-900">
                Extrato - {selectedCustomer?.name}
              </h2>
              <p className="text-sm text-gray-600">
                {selectedCustomer?.cpf_cnpj && `${selectedCustomer.person_type === 'pf' ? 'CPF' : 'CNPJ'}: ${selectedCustomer.cpf_cnpj}`}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Período: {new Date(startDate).toLocaleDateString('pt-BR')} a {new Date(endDate).toLocaleDateString('pt-BR')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-red-600 font-medium">Total a Receber</p>
                    <p className="text-xs text-red-500 mb-1">Orçamentos Aprovados</p>
                    <p className="text-2xl font-bold text-red-700">
                      R$ {summary.totalDebits.toFixed(2)}
                    </p>
                  </div>
                  <TrendingUp className="text-red-600" size={32} />
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600 font-medium">Total Recebido</p>
                    <p className="text-xs text-green-500 mb-1">Pagamentos Realizados</p>
                    <p className="text-2xl font-bold text-green-700">
                      R$ {summary.totalCredits.toFixed(2)}
                    </p>
                  </div>
                  <TrendingDown className="text-green-600" size={32} />
                </div>
              </div>

              <div className={`border rounded-lg p-4 ${summary.balance > 0 ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-medium ${summary.balance > 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                      Saldo {summary.balance > 0 ? 'a Receber' : summary.balance < 0 ? 'Credor' : 'Quitado'}
                    </p>
                    <p className="text-xs text-gray-500 mb-1">
                      {summary.balance > 0 ? 'Cliente deve' : summary.balance < 0 ? 'Crédito do cliente' : 'Sem pendências'}
                    </p>
                    <p className={`text-2xl font-bold ${summary.balance > 0 ? 'text-orange-700' : 'text-blue-700'}`}>
                      R$ {Math.abs(summary.balance).toFixed(2)}
                    </p>
                  </div>
                  <DollarSign className={summary.balance > 0 ? 'text-orange-600' : 'text-blue-600'} size={32} />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#0A7EC2] text-white">
                    <th className="px-4 py-3 text-left text-sm font-semibold">Data</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Origem</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Descrição</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Referência</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">Débito</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">Crédito</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">Saldo</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => {
                    const statusBadge = getPaymentStatusBadge(entry.payment_status);
                    const isPaid = entry.payment_status === 'paid';
                    const rowClass = isPaid ? 'opacity-60' : index % 2 === 0 ? 'bg-gray-50' : 'bg-white';

                    return (
                    <tr key={entry.id} className={rowClass}>
                      <td className="px-4 py-3 text-sm">
                        {new Date(entry.date).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getOriginColor(entry.origin)}`}>
                          {getOriginLabel(entry.origin)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{entry.description}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{entry.reference}</td>
                      <td className="px-4 py-3 text-sm">
                        {statusBadge && (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${statusBadge.color}`}>
                            {statusBadge.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">
                        {entry.debit_amount > 0 ? `R$ ${entry.debit_amount.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">
                        {entry.credit_amount > 0 ? `R$ ${entry.credit_amount.toFixed(2)}` : '-'}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-bold ${entry.balance > 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                        R$ {entry.balance.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {entry.payment_status !== 'paid' && entry.quote_id && (
                            <button
                              onClick={() => handlePaymentClick(entry)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
                              title="Registrar pagamento"
                            >
                              <CheckCircle2 className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-bold">
                    <td colSpan={5} className="px-4 py-3 text-sm text-right">TOTAIS:</td>
                    <td className="px-4 py-3 text-sm text-right text-red-700">
                      R$ {summary.totalDebits.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-green-700">
                      R$ {summary.totalCredits.toFixed(2)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right ${summary.balance > 0 ? 'text-orange-700' : 'text-blue-700'}`}>
                      R$ {summary.balance.toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                Nota: Os valores pagos aparecem na coluna Credito da mesma linha do orcamento correspondente.
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && entries.length === 0 && selectedCustomerId && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Package className="mx-auto text-gray-400 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            Nenhuma movimentação encontrada
          </h3>
          <p className="text-gray-600">
            Não há registros para o cliente selecionado no período informado.
          </p>
        </div>
      )}

      {selectedEntryForPayment && (
        <PaymentRegistrationModal
          isOpen={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          onSuccess={handlePaymentSuccess}
          quoteId={selectedEntryForPayment.quote_id || ''}
          customerName={selectedCustomer?.name || ''}
          reference={selectedEntryForPayment.reference}
          totalAmount={selectedEntryForPayment.total_amount || 0}
          paidAmount={selectedEntryForPayment.paid_amount || 0}
          description={selectedEntryForPayment.description}
        />
      )}
    </div>
  );
};

export default CustomerStatement;
