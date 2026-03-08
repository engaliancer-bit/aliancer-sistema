import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Download, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react';

interface Sale {
  id: string;
  origem_tipo: string;
  origem_id: string;
  customer_id: string;
  total_value: number;
  created_at: string;
}

interface Customer {
  id: string;
  name: string;
  cpf_cnpj: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  person_type: string;
}

interface Product {
  id: string;
  name: string;
  unit: string;
  ncm: string;
  cfop: string;
  cst_icms: string;
  aliquota_icms: number;
  aliquota_pis: number;
  aliquota_cofins: number;
  aliquota_ipi: number;
  origem_produto: string;
  unidade_tributavel: string;
}

interface QuoteItem {
  id: string;
  quote_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface CompanySettings {
  company_name: string;
  cnpj: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  regime_tributario: string;
  inscricao_estadual: string;
  inscricao_municipal: string;
  cnae_principal: string;
  crt: string;
}

export default function FiscalExporter() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    loadSales();
  }, []);

  async function loadSales() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('unified_sales')
        .select('*')
        .eq('origem_tipo', 'fabrica')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setSales(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar vendas:', error);
      setExportStatus({ type: 'error', message: 'Erro ao carregar vendas: ' + error.message });
    } finally {
      setLoading(false);
    }
  }

  async function exportToXML(sale: Sale) {
    try {
      setExporting(true);
      setExportStatus(null);

      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', sale.customer_id)
        .single();

      if (customerError) throw customerError;

      const { data: companySettings, error: companyError } = await supabase
        .from('company_settings')
        .select('*')
        .single();

      if (companyError) throw companyError;

      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', sale.origem_id)
        .maybeSingle();

      if (quoteError) throw quoteError;

      if (!quote) {
        throw new Error('Orçamento não encontrado');
      }

      const { data: quoteItems, error: itemsError } = await supabase
        .from('quote_items')
        .select(`
          *,
          product:products(*)
        `)
        .eq('quote_id', quote.id);

      if (itemsError) throw itemsError;

      const xml = generateNFeXML(companySettings, customer, quote, quoteItems, sale);
      downloadFile(xml, `nfe_${sale.id}.xml`, 'text/xml');

      setExportStatus({ type: 'success', message: 'XML exportado com sucesso!' });
    } catch (error: any) {
      console.error('Erro ao exportar XML:', error);
      setExportStatus({ type: 'error', message: 'Erro ao exportar XML: ' + error.message });
    } finally {
      setExporting(false);
    }
  }

  async function exportToCSV(sale: Sale) {
    try {
      setExporting(true);
      setExportStatus(null);

      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', sale.customer_id)
        .single();

      if (customerError) throw customerError;

      const { data: companySettings, error: companyError } = await supabase
        .from('company_settings')
        .select('*')
        .single();

      if (companyError) throw companyError;

      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', sale.origem_id)
        .maybeSingle();

      if (quoteError) throw quoteError;

      if (!quote) {
        throw new Error('Orçamento não encontrado');
      }

      const { data: quoteItems, error: itemsError } = await supabase
        .from('quote_items')
        .select(`
          *,
          product:products(*)
        `)
        .eq('quote_id', quote.id);

      if (itemsError) throw itemsError;

      const csv = generateCSV(companySettings, customer, quote, quoteItems, sale);
      downloadFile(csv, `nfe_${sale.id}.csv`, 'text/csv');

      setExportStatus({ type: 'success', message: 'CSV exportado com sucesso!' });
    } catch (error: any) {
      console.error('Erro ao exportar CSV:', error);
      setExportStatus({ type: 'error', message: 'Erro ao exportar CSV: ' + error.message });
    } finally {
      setExporting(false);
    }
  }

  function generateNFeXML(company: CompanySettings, customer: Customer, quote: any, items: any[], sale: Sale): string {
    const dataEmissao = new Date(sale.created_at).toISOString().split('T')[0];
    const horaEmissao = new Date(sale.created_at).toISOString().split('T')[1].split('.')[0];

    let itemsXML = '';
    items.forEach((item, index) => {
      const product = item.product || {};
      const nItem = index + 1;

      itemsXML += `
    <det nItem="${nItem}">
      <prod>
        <cProd>${product.id || ''}</cProd>
        <cEAN></cEAN>
        <xProd>${item.product_name || ''}</xProd>
        <NCM>${product.ncm || ''}</NCM>
        <CFOP>${product.cfop || '5102'}</CFOP>
        <uCom>${product.unidade_tributavel || 'UN'}</uCom>
        <qCom>${item.quantity || 0}</qCom>
        <vUnCom>${(item.unit_price || 0).toFixed(2)}</vUnCom>
        <vProd>${(item.total_price || 0).toFixed(2)}</vProd>
        <cEANTrib></cEANTrib>
        <uTrib>${product.unidade_tributavel || 'UN'}</uTrib>
        <qTrib>${item.quantity || 0}</qTrib>
        <vUnTrib>${(item.unit_price || 0).toFixed(2)}</vUnTrib>
      </prod>
      <imposto>
        <ICMS>
          <ICMS${product.cst_icms || '00'}>
            <orig>${product.origem_produto || '0'}</orig>
            <CST>${product.cst_icms || '00'}</CST>
            <pICMS>${product.aliquota_icms || 0}</pICMS>
          </ICMS${product.cst_icms || '00'}>
        </ICMS>
        <PIS>
          <PISAliq>
            <CST>01</CST>
            <vBC>${(item.total_price || 0).toFixed(2)}</vBC>
            <pPIS>${product.aliquota_pis || 0}</pPIS>
          </PISAliq>
        </PIS>
        <COFINS>
          <COFINSAliq>
            <CST>01</CST>
            <vBC>${(item.total_price || 0).toFixed(2)}</vBC>
            <pCOFINS>${product.aliquota_cofins || 0}</pCOFINS>
          </COFINSAliq>
        </COFINS>
      </imposto>
    </det>`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe versao="4.00">
      <ide>
        <cUF>${getUFCode(company.state)}</cUF>
        <natOp>Venda de produção do estabelecimento</natOp>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>${sale.id.substring(0, 9)}</nNF>
        <dhEmi>${dataEmissao}T${horaEmissao}-03:00</dhEmi>
        <tpNF>1</tpNF>
        <idDest>1</idDest>
        <cMunFG>${company.city || ''}</cMunFG>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
        <finNFe>1</finNFe>
        <indFinal>1</indFinal>
        <indPres>1</indPres>
        <procEmi>0</procEmi>
      </ide>
      <emit>
        <CNPJ>${company.cnpj || ''}</CNPJ>
        <xNome>${company.company_name || ''}</xNome>
        <xFant>${company.company_name || ''}</xFant>
        <enderEmit>
          <xLgr>${company.address || ''}</xLgr>
          <xBairro></xBairro>
          <cMun></cMun>
          <xMun>${company.city || ''}</xMun>
          <UF>${company.state || ''}</UF>
          <CEP>${(company.zip_code || '').replace(/\D/g, '')}</CEP>
          <fone>${(company.phone || '').replace(/\D/g, '')}</fone>
        </enderEmit>
        <IE>${company.inscricao_estadual || ''}</IE>
        <CRT>${company.crt || '1'}</CRT>
      </emit>
      <dest>
        <${customer.person_type === 'legal' ? 'CNPJ' : 'CPF'}>${customer.cpf_cnpj || ''}</${customer.person_type === 'legal' ? 'CNPJ' : 'CPF'}>
        <xNome>${customer.name || ''}</xNome>
        <enderDest>
          <xLgr>${customer.address || ''}</xLgr>
          <xBairro></xBairro>
          <cMun></cMun>
          <xMun>${customer.city || ''}</xMun>
          <UF>${customer.state || ''}</UF>
          <CEP>${(customer.zip_code || '').replace(/\D/g, '')}</CEP>
          <fone>${(customer.phone || '').replace(/\D/g, '')}</fone>
        </enderDest>
        <indIEDest>9</indIEDest>
        <email>${customer.email || ''}</email>
      </dest>
      ${itemsXML}
      <total>
        <ICMSTot>
          <vBC>0.00</vBC>
          <vICMS>0.00</vICMS>
          <vICMSDeson>0.00</vICMSDeson>
          <vFCP>0.00</vFCP>
          <vBCST>0.00</vBCST>
          <vST>0.00</vST>
          <vFCPST>0.00</vFCPST>
          <vFCPSTRet>0.00</vFCPSTRet>
          <vProd>${sale.total_value.toFixed(2)}</vProd>
          <vFrete>0.00</vFrete>
          <vSeg>0.00</vSeg>
          <vDesc>0.00</vDesc>
          <vII>0.00</vII>
          <vIPI>0.00</vIPI>
          <vIPIDevol>0.00</vIPIDevol>
          <vPIS>0.00</vPIS>
          <vCOFINS>0.00</vCOFINS>
          <vOutro>0.00</vOutro>
          <vNF>${sale.total_value.toFixed(2)}</vNF>
        </ICMSTot>
      </total>
      <transp>
        <modFrete>9</modFrete>
      </transp>
      <pag>
        <detPag>
          <tPag>01</tPag>
          <vPag>${sale.total_value.toFixed(2)}</vPag>
        </detPag>
      </pag>
      <infAdic>
        <infCpl>Documento gerado pelo Sistema de Gestão - ID: ${sale.id}</infCpl>
      </infAdic>
    </infNFe>
  </NFe>
</nfeProc>`;
  }

  function generateCSV(company: CompanySettings, customer: Customer, quote: any, items: any[], sale: Sale): string {
    let csv = 'Emitente CNPJ;Emitente Nome;Cliente CPF/CNPJ;Cliente Nome;Item;Código Produto;Produto;NCM;CFOP;Unidade;Quantidade;Valor Unitário;Valor Total;ICMS %;PIS %;COFINS %;IPI %\n';

    items.forEach((item) => {
      const product = item.product || {};
      csv += `${company.cnpj || ''};`;
      csv += `${company.company_name || ''};`;
      csv += `${customer.cpf_cnpj || ''};`;
      csv += `${customer.name || ''};`;
      csv += `${product.id || ''};`;
      csv += `${product.id || ''};`;
      csv += `${item.product_name || ''};`;
      csv += `${product.ncm || ''};`;
      csv += `${product.cfop || '5102'};`;
      csv += `${product.unidade_tributavel || 'UN'};`;
      csv += `${item.quantity || 0};`;
      csv += `${(item.unit_price || 0).toFixed(2)};`;
      csv += `${(item.total_price || 0).toFixed(2)};`;
      csv += `${product.aliquota_icms || 0};`;
      csv += `${product.aliquota_pis || 0};`;
      csv += `${product.aliquota_cofins || 0};`;
      csv += `${product.aliquota_ipi || 0}\n`;
    });

    return csv;
  }

  function getUFCode(uf: string): string {
    const codes: { [key: string]: string } = {
      'AC': '12', 'AL': '27', 'AP': '16', 'AM': '13', 'BA': '29', 'CE': '23',
      'DF': '53', 'ES': '32', 'GO': '52', 'MA': '21', 'MT': '51', 'MS': '50',
      'MG': '31', 'PA': '15', 'PB': '25', 'PR': '41', 'PE': '26', 'PI': '22',
      'RJ': '33', 'RN': '24', 'RS': '43', 'RO': '11', 'RR': '14', 'SC': '42',
      'SP': '35', 'SE': '28', 'TO': '17'
    };
    return codes[uf] || '35';
  }

  function downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-8 h-8 text-blue-600" />
          Exportador Fiscal
        </h2>
        <p className="text-gray-600 mt-1">
          Exporte vendas em formato XML ou CSV para sistemas de emissão de NF-e
        </p>
      </div>

      {exportStatus && (
        <div
          className={`p-4 rounded-lg flex items-start gap-3 ${
            exportStatus.type === 'success'
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {exportStatus.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p
              className={`font-medium ${
                exportStatus.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}
            >
              {exportStatus.message}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Vendas Disponíveis para Exportação
        </h3>

        {loading ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Carregando vendas...</p>
          </div>
        ) : sales.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Nenhuma venda disponível</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Data
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Origem
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Valor Total
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sales.map((sale) => (
                  <tr key={sale.id}>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(sale.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                        Fábrica
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      R$ {sale.total_value.toFixed(2)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => exportToXML(sale)}
                          disabled={exporting}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          XML
                        </button>
                        <button
                          onClick={() => exportToCSV(sale)}
                          disabled={exporting}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                          CSV
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">
          Informações Importantes
        </h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span>
              <strong>XML:</strong> Formato compatível com estrutura de NF-e. Pode ser usado como
              referência para sistemas de emissão.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span>
              <strong>CSV:</strong> Formato de planilha para importação em sistemas de gestão fiscal
              ou ERPs.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span>
              Configure os campos fiscais dos produtos (NCM, CFOP, alíquotas) no cadastro de
              produtos para gerar arquivos completos.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span>
              Configure as informações fiscais da empresa (IE, CNAE, Regime Tributário) nas
              Configurações da Empresa.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
