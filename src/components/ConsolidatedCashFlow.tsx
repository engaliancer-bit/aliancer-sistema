import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DollarSign, TrendingUp, TrendingDown, Calendar, Download, Building2, HardHat, Briefcase, Landmark } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Banks from './Banks';

interface CashFlowTransaction {
  date: string;
  description: string;
  category: string;
  type: 'receita' | 'despesa';
  amount: number;
  businessUnit: string;
  businessUnitName: string;
  source: string;
}

type TabType = 'cashflow' | 'banks';

export default function ConsolidatedCashFlow() {
  const [activeTab, setActiveTab] = useState<TabType>('cashflow');
  const [transactions, setTransactions] = useState<CashFlowTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadTransactions();
  }, [startDate, endDate]);

  const businessUnitNames: Record<string, string> = {
    factory: 'Indústria de Artefatos',
    engineering: 'Escritório de Engenharia',
    construction: 'Construtora',
  };

  async function loadTransactions() {
    try {
      setLoading(true);
      const allTransactions: CashFlowTransaction[] = [];

      const { data: cashFlowEntries, error: cashFlowError } = await supabase
        .from('cash_flow')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (cashFlowError) {
        console.error('Error loading cash flow:', cashFlowError);
      }

      (cashFlowEntries || []).forEach((entry: any) => {
        allTransactions.push({
          date: entry.date,
          description: entry.description,
          category: entry.category,
          type: entry.type === 'income' ? 'receita' : 'despesa',
          amount: parseFloat(entry.amount || '0'),
          businessUnit: entry.business_unit,
          businessUnitName: businessUnitNames[entry.business_unit] || entry.business_unit,
          source: 'manual'
        });
      });

      const { data: purchases, error: purchasesError } = await supabase
        .from('purchases')
        .select(`
          id,
          invoice_number,
          invoice_date,
          total_amount,
          suppliers(name)
        `)
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate)
        .order('invoice_date', { ascending: false });

      if (purchasesError) {
        console.error('Error loading purchases:', purchasesError);
      }

      (purchases || []).forEach((purchase: any) => {
        allTransactions.push({
          date: purchase.invoice_date,
          description: `NF ${purchase.invoice_number} - ${purchase.suppliers?.name || 'Fornecedor'}`,
          category: 'Compra de Materiais (XML)',
          type: 'despesa',
          amount: parseFloat(purchase.total_amount || '0'),
          businessUnit: 'factory',
          businessUnitName: 'Indústria de Artefatos',
          source: 'xml'
        });
      });

      const businessUnits = ['factory', 'engineering', 'construction'];

      for (const unit of businessUnits) {
        const { data: employees, error: empError } = await supabase
          .from('employees')
          .select('id, name, base_salary, employment_type')
          .eq('business_unit', unit)
          .eq('active', true);

        if (empError) {
          console.error(`Error loading employees for ${unit}:`, empError);
          continue;
        }

        const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

        const salaryDate = new Date(new Date().getFullYear(), new Date().getMonth(), 5).toISOString().split('T')[0];

        if (salaryDate >= startDate && salaryDate <= endDate) {
          (employees || []).forEach(employee => {
            allTransactions.push({
              date: salaryDate,
              description: `Salário - ${employee.name} (${employee.employment_type === 'clt' ? 'CLT' : 'Temporário'})`,
              category: 'Salários e Encargos',
              type: 'despesa',
              amount: parseFloat(employee.base_salary || '0'),
              businessUnit: unit,
              businessUnitName: businessUnitNames[unit],
              source: 'payroll'
            });
          });
        }

        const { data: extraPayments, error: extraError } = await supabase
          .from('monthly_extra_payments')
          .select(`
            id,
            employee_id,
            month,
            payment_type,
            amount,
            employees(name, business_unit)
          `)
          .eq('month', currentMonth);

        if (extraError) {
          console.error('Error loading extra payments:', extraError);
        }

        const paymentDate = new Date(new Date().getFullYear(), new Date().getMonth(), 10).toISOString().split('T')[0];

        if (paymentDate >= startDate && paymentDate <= endDate) {
          (extraPayments || []).forEach(payment => {
            const employee = Array.isArray(payment.employees) ? payment.employees[0] : payment.employees;
            if (employee?.business_unit === unit) {
              allTransactions.push({
                date: paymentDate,
                description: `${payment.payment_type === 'ferias' ? 'Férias' : payment.payment_type === 'decimo_terceiro' ? '13º Salário' : 'Pagamento Extra'} - ${employee?.name || 'Funcionário'}`,
                category: payment.payment_type === 'ferias' ? 'Férias' : payment.payment_type === 'decimo_terceiro' ? '13º Salário' : 'Outros Pagamentos',
                type: 'despesa',
                amount: parseFloat(payment.amount || '0'),
                businessUnit: unit,
                businessUnitName: businessUnitNames[unit],
                source: 'payroll'
              });
            }
          });
        }
      }

      allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setTransactions(allTransactions);
    } catch (error) {
      console.error('Erro ao carregar fluxo de caixa:', error);
    } finally {
      setLoading(false);
    }
  }

  const totals = transactions.reduce(
    (acc, item) => ({
      receitas: acc.receitas + (item.type === 'receita' ? item.amount : 0),
      despesas: acc.despesas + (item.type === 'despesa' ? item.amount : 0),
    }),
    { receitas: 0, despesas: 0 }
  );

  const saldo = totals.receitas - totals.despesas;

  const totalsByUnit = {
    factory: transactions
      .filter(t => t.businessUnit === 'factory')
      .reduce(
        (acc, item) => ({
          receitas: acc.receitas + (item.type === 'receita' ? item.amount : 0),
          despesas: acc.despesas + (item.type === 'despesa' ? item.amount : 0),
        }),
        { receitas: 0, despesas: 0 }
      ),
    engineering: transactions
      .filter(t => t.businessUnit === 'engineering')
      .reduce(
        (acc, item) => ({
          receitas: acc.receitas + (item.type === 'receita' ? item.amount : 0),
          despesas: acc.despesas + (item.type === 'despesa' ? item.amount : 0),
        }),
        { receitas: 0, despesas: 0 }
      ),
    construction: transactions
      .filter(t => t.businessUnit === 'construction')
      .reduce(
        (acc, item) => ({
          receitas: acc.receitas + (item.type === 'receita' ? item.amount : 0),
          despesas: acc.despesas + (item.type === 'despesa' ? item.amount : 0),
        }),
        { receitas: 0, despesas: 0 }
      ),
  };

  const saldoByUnit = {
    factory: totalsByUnit.factory.receitas - totalsByUnit.factory.despesas,
    engineering: totalsByUnit.engineering.receitas - totalsByUnit.engineering.despesas,
    construction: totalsByUnit.construction.receitas - totalsByUnit.construction.despesas,
  };

  function exportToPDF() {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório de Fluxo de Caixa Consolidado', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${new Date(startDate).toLocaleDateString('pt-BR')} a ${new Date(endDate).toLocaleDateString('pt-BR')}`, pageWidth / 2, 28, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo Geral', 14, 38);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total de Receitas: ${totals.receitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 14, 46);
    doc.text(`Total de Despesas: ${totals.despesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 14, 53);

    doc.setFont('helvetica', 'bold');
    const balanceColor = saldo >= 0 ? [0, 100, 0] : [200, 0, 0];
    doc.setTextColor(balanceColor[0], balanceColor[1], balanceColor[2]);
    doc.text(`Saldo Consolidado: ${saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 14, 60);
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo por Unidade de Negócio', 14, 70);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    let yPos = 78;
    Object.entries(businessUnitNames).forEach(([unit, name]) => {
      const unitSaldo = saldoByUnit[unit as keyof typeof saldoByUnit];
      const unitTotals = totalsByUnit[unit as keyof typeof totalsByUnit];
      doc.text(`${name}:`, 14, yPos);
      doc.text(`Receitas: ${unitTotals.receitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | Despesas: ${unitTotals.despesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | Saldo: ${unitSaldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 14, yPos + 5);
      yPos += 12;
    });

    const tableData = transactions.map(item => [
      new Date(item.date).toLocaleDateString('pt-BR'),
      item.businessUnitName,
      item.description,
      item.category,
      item.type === 'receita' ? 'Receita' : 'Despesa',
      item.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    ]);

    autoTable(doc, {
      startY: yPos + 5,
      head: [['Data', 'Unidade', 'Descrição', 'Categoria', 'Tipo', 'Valor']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [66, 66, 66],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 7
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 20 },
        1: { halign: 'left', cellWidth: 30 },
        2: { halign: 'left', cellWidth: 45 },
        3: { halign: 'left', cellWidth: 30 },
        4: { halign: 'center', cellWidth: 20 },
        5: { halign: 'right', cellWidth: 25 }
      },
      styles: {
        fontSize: 7,
        cellPadding: 2
      },
    });

    const fileName = `fluxo_caixa_consolidado_${startDate}_${endDate}.pdf`;
    doc.save(fileName);
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#0A7EC2]"></div>
        <p className="ml-3 text-lg text-gray-600">Carregando dados...</p>
      </div>
    );
  }

  const tabs = [
    { id: 'cashflow' as TabType, label: 'Fluxo de Caixa', icon: DollarSign },
    { id: 'banks' as TabType, label: 'Contas Bancárias', icon: Landmark },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Relatório Geral de Fluxo de Caixa</h2>
        <p className="text-gray-600">Relatório consolidado com todas as despesas e receitas do sistema</p>
      </div>

      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors
                    ${activeTab === tab.id
                      ? 'border-b-2 border-[#0A7EC2] text-[#0A7EC2]'
                      : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {activeTab === 'cashflow' && (
        <>
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline-block w-4 h-4 mr-2" />
              Data Inicial
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
              <Calendar className="inline-block w-4 h-4 mr-2" />
              Data Final
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={exportToPDF}
              className="w-full flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#0A7EC2] to-[#0968A8] text-white font-medium rounded-lg hover:from-[#0968A8] hover:to-[#075a8a] transition-all shadow-md hover:shadow-lg"
            >
              <Download className="w-5 h-5" />
              Exportar PDF
            </button>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Resumo Geral</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Total de Receitas</h3>
              <TrendingUp className="w-8 h-8 opacity-80" />
            </div>
            <p className="text-3xl font-bold">
              {totals.receitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            <p className="text-sm mt-2 opacity-90">
              {transactions.filter(t => t.type === 'receita').length} transações
            </p>
          </div>

          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Total de Despesas</h3>
              <TrendingDown className="w-8 h-8 opacity-80" />
            </div>
            <p className="text-3xl font-bold">
              {totals.despesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            <p className="text-sm mt-2 opacity-90">
              {transactions.filter(t => t.type === 'despesa').length} transações
            </p>
          </div>

          <div className={`bg-gradient-to-br ${saldo >= 0 ? 'from-blue-500 to-blue-600' : 'from-orange-500 to-orange-600'} rounded-lg shadow-lg p-6 text-white`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Saldo Consolidado</h3>
              <DollarSign className="w-8 h-8 opacity-80" />
            </div>
            <p className="text-3xl font-bold">
              {saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            <p className="text-sm mt-2 opacity-90">
              {saldo >= 0 ? 'Resultado positivo' : 'Resultado negativo'}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Resumo por Unidade de Negócio</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-[#0A7EC2]">
            <div className="flex items-center gap-3 mb-4">
              <Building2 className="w-8 h-8 text-[#0A7EC2]" />
              <h4 className="text-lg font-bold text-gray-900">Indústria de Artefatos</h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Receitas:</span>
                <span className="text-sm font-semibold text-green-600">
                  {totalsByUnit.factory.receitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Despesas:</span>
                <span className="text-sm font-semibold text-red-600">
                  {totalsByUnit.factory.despesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="text-sm font-bold text-gray-900">Saldo:</span>
                <span className={`text-sm font-bold ${saldoByUnit.factory >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  {saldoByUnit.factory.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-[#0A7EC2]">
            <div className="flex items-center gap-3 mb-4">
              <Briefcase className="w-8 h-8 text-[#0A7EC2]" />
              <h4 className="text-lg font-bold text-gray-900">Escritório de Engenharia</h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Receitas:</span>
                <span className="text-sm font-semibold text-green-600">
                  {totalsByUnit.engineering.receitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Despesas:</span>
                <span className="text-sm font-semibold text-red-600">
                  {totalsByUnit.engineering.despesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="text-sm font-bold text-gray-900">Saldo:</span>
                <span className={`text-sm font-bold ${saldoByUnit.engineering >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  {saldoByUnit.engineering.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-[#0A7EC2]">
            <div className="flex items-center gap-3 mb-4">
              <HardHat className="w-8 h-8 text-[#0A7EC2]" />
              <h4 className="text-lg font-bold text-gray-900">Construtora</h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Receitas:</span>
                <span className="text-sm font-semibold text-green-600">
                  {totalsByUnit.construction.receitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Despesas:</span>
                <span className="text-sm font-semibold text-red-600">
                  {totalsByUnit.construction.despesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="text-sm font-bold text-gray-900">Saldo:</span>
                <span className={`text-sm font-bold ${saldoByUnit.construction >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  {saldoByUnit.construction.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-900">Todas as Transações</h3>
          <p className="text-sm text-gray-600 mt-1">
            {transactions.length} transações no período selecionado (incluindo despesas manuais, XML e folha)
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unidade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Descrição
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Categoria
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Origem
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(item.date).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {item.businessUnitName}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {item.description}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {item.category}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      item.type === 'receita'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {item.type === 'receita' ? 'Receita' : 'Despesa'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      item.source === 'manual' ? 'bg-blue-100 text-blue-800' :
                      item.source === 'xml' ? 'bg-purple-100 text-purple-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {item.source === 'manual' ? 'Manual' : item.source === 'xml' ? 'XML' : 'Folha'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className={`text-sm font-bold ${
                      item.type === 'receita' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {item.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </td>
                </tr>
              ))}

              {transactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Nenhuma transação encontrada para o período selecionado
                  </td>
                </tr>
              )}
            </tbody>
            {transactions.length > 0 && (
              <tfoot className="bg-gray-50 font-bold border-t-2 border-gray-300">
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-sm text-gray-900 text-right">
                    TOTAL GERAL:
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`text-sm font-bold ${saldo >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                      {saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">Informações sobre o Relatório Consolidado</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Este relatório consolida TODAS as receitas e despesas das 3 unidades de negócio</li>
          <li>• <strong>Despesas Manuais:</strong> Lançamentos diretos no fluxo de caixa</li>
          <li>• <strong>Despesas de XML:</strong> Notas fiscais importadas automaticamente</li>
          <li>• <strong>Despesas de Folha:</strong> Salários e pagamentos extras dos funcionários</li>
          <li>• <strong>Indústria de Artefatos:</strong> Receitas e despesas da produção de artefatos de concreto</li>
          <li>• <strong>Escritório de Engenharia:</strong> Receitas e despesas de serviços de engenharia e topografia</li>
          <li>• <strong>Construtora:</strong> Receitas e despesas de obras e construções</li>
          <li>• O saldo consolidado representa a diferença entre todas as receitas e despesas no período</li>
        </ul>
      </div>
        </>
      )}

      {activeTab === 'banks' && <Banks />}
    </div>
  );
}
