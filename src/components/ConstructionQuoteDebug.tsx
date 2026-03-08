import React, { useState } from 'react';
import { Bug, Search, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DebugResult {
  step: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  data?: any;
}

export default function ConstructionQuoteDebug() {
  const [quoteId, setQuoteId] = useState('');
  const [quoteType, setQuoteType] = useState<'quote' | 'ribbed_slab'>('quote');
  const [constructionProjectId, setConstructionProjectId] = useState('');
  const [debugging, setDebugging] = useState(false);
  const [results, setResults] = useState<DebugResult[]>([]);

  const addResult = (step: string, status: 'success' | 'error' | 'warning', message: string, data?: any) => {
    setResults(prev => [...prev, { step, status, message, data }]);
  };

  const debugProcess = async () => {
    setDebugging(true);
    setResults([]);

    try {
      // 1. Verificar se o orçamento existe
      addResult('1. Verificando orçamento', 'success', `Buscando ${quoteType} com ID: ${quoteId}`);

      if (quoteType === 'quote') {
        const { data: quote, error: quoteError } = await supabase
          .from('quotes')
          .select('*')
          .eq('id', quoteId)
          .maybeSingle();

        if (quoteError) {
          addResult('1. Verificando orçamento', 'error', `Erro: ${quoteError.message}`);
          return;
        }

        if (!quote) {
          addResult('1. Verificando orçamento', 'error', 'Orçamento não encontrado');
          return;
        }

        addResult('1. Verificando orçamento', 'success', 'Orçamento encontrado', quote);

        // 2. Buscar items do orçamento
        const { data: quoteItems, error: itemsError } = await supabase
          .from('quote_items')
          .select('*')
          .eq('quote_id', quoteId);

        if (itemsError) {
          addResult('2. Buscando items', 'error', `Erro: ${itemsError.message}`);
          return;
        }

        addResult('2. Buscando items', 'success', `${quoteItems?.length || 0} items encontrados`, quoteItems);

        // 3. Verificar composições
        const itemsWithComposition = quoteItems?.filter(item => item.composition_id) || [];

        if (itemsWithComposition.length === 0) {
          addResult('3. Verificando composições', 'warning', 'Nenhum item tem composição vinculada');
        } else {
          addResult('3. Verificando composições', 'success', `${itemsWithComposition.length} items com composição`);

          // 4. Verificar produtos nas composições
          for (const item of itemsWithComposition) {
            const { data: compositionItems } = await supabase
              .from('composition_items')
              .select('*, products(name)')
              .eq('composition_id', item.composition_id)
              .eq('item_type', 'product');

            const productCount = compositionItems?.filter(ci => ci.product_id)?.length || 0;

            if (productCount === 0) {
              addResult('4. Produtos na composição', 'warning',
                `Composição ${item.composition_id} não tem produtos cadastrados`);
            } else {
              addResult('4. Produtos na composição', 'success',
                `${productCount} produto(s) encontrado(s) na composição`);

              // Verificar estoque de cada produto
              for (const ci of compositionItems || []) {
                if (ci.product_id) {
                  const { data: stock } = await supabase.rpc('get_product_stock', {
                    product_id_param: ci.product_id
                  });

                  const quantityNeeded = ci.quantity * item.quantity;
                  const needsProduction = stock < quantityNeeded;

                  addResult('5. Verificando estoque',
                    needsProduction ? 'warning' : 'success',
                    `${ci.products?.name}: Estoque=${stock}, Necessário=${quantityNeeded}${needsProduction ? ' → PRECISA PRODUZIR' : ' → OK'}`
                  );
                }
              }
            }
          }
        }

      } else if (quoteType === 'ribbed_slab') {
        const { data: quote, error: quoteError } = await supabase
          .from('ribbed_slab_quotes')
          .select('*')
          .eq('id', quoteId)
          .maybeSingle();

        if (quoteError) {
          addResult('1. Verificando orçamento', 'error', `Erro: ${quoteError.message}`);
          return;
        }

        if (!quote) {
          addResult('1. Verificando orçamento', 'error', 'Orçamento de laje não encontrado');
          return;
        }

        addResult('1. Verificando orçamento', 'success', 'Orçamento de laje encontrado', quote);

        // Buscar floors e rooms
        const { data: floors } = await supabase
          .from('ribbed_slab_floors')
          .select(`
            *,
            ribbed_slab_rooms(*)
          `)
          .eq('quote_id', quoteId);

        const totalRooms = floors?.reduce((sum, floor) => sum + (floor.ribbed_slab_rooms?.length || 0), 0) || 0;
        addResult('2. Buscando ambientes', 'success', `${totalRooms} ambiente(s) encontrado(s)`, floors);

        // Verificar composições
        const roomsWithComposition = floors?.flatMap(f =>
          f.ribbed_slab_rooms?.filter((r: any) => r.composition_id) || []
        ) || [];

        if (roomsWithComposition.length === 0) {
          addResult('3. Verificando composições', 'warning', 'Nenhum ambiente tem composição vinculada');
        } else {
          addResult('3. Verificando composições', 'success', `${roomsWithComposition.length} ambiente(s) com composição`);
        }
      }

      // 6. Verificar obra
      const { data: project } = await supabase
        .from('construction_projects')
        .select('*')
        .eq('id', constructionProjectId)
        .maybeSingle();

      if (!project) {
        addResult('6. Verificando obra', 'error', 'Obra não encontrada');
        return;
      }

      addResult('6. Verificando obra', 'success', 'Obra encontrada', project);

      // 7. Executar processamento
      addResult('7. Processando vinculação', 'success', 'Iniciando processamento...');

      const { data: processResult, error: processError } = await supabase.rpc(
        'process_quote_approval_for_construction',
        {
          quote_id_param: quoteId,
          quote_type_param: quoteType,
          construction_project_id_param: constructionProjectId
        }
      );

      if (processError) {
        addResult('7. Processando vinculação', 'error', `Erro: ${processError.message}`, processError);
        return;
      }

      if (processResult?.success) {
        addResult('7. Processando vinculação', 'success', processResult.message, processResult);

        // Verificar ordens criadas
        const { data: orders } = await supabase
          .from('production_orders')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);

        addResult('8. Ordens de produção', 'success',
          `Últimas ${orders?.length || 0} ordens criadas`, orders);

      } else {
        addResult('7. Processando vinculação', 'error',
          processResult?.error || 'Erro desconhecido', processResult);
      }

    } catch (error: any) {
      addResult('Erro Geral', 'error', error.message, error);
    } finally {
      setDebugging(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Bug className="w-5 h-5 text-orange-600" />
          Debug: Integração Orçamento-Obra
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Orçamento
            </label>
            <select
              value={quoteType}
              onChange={(e) => setQuoteType(e.target.value as 'quote' | 'ribbed_slab')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="quote">Orçamento Padrão</option>
              <option value="ribbed_slab">Laje Treliçada</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ID do Orçamento
            </label>
            <input
              type="text"
              value={quoteId}
              onChange={(e) => setQuoteId(e.target.value)}
              placeholder="UUID do orçamento"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ID da Obra
            </label>
            <input
              type="text"
              value={constructionProjectId}
              onChange={(e) => setConstructionProjectId(e.target.value)}
              placeholder="UUID da obra"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono text-sm"
            />
          </div>
        </div>

        <button
          onClick={debugProcess}
          disabled={debugging || !quoteId || !constructionProjectId}
          className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {debugging ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Executando Debug...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Executar Debug Completo
            </>
          )}
        </button>
      </div>

      {results.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Resultados do Debug
            </h3>
          </div>

          <div className="divide-y divide-gray-200">
            {results.map((result, index) => (
              <div key={index} className="p-4">
                <div className="flex items-start gap-3">
                  {getStatusIcon(result.status)}
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">
                      {result.step}
                    </h4>
                    <p className={`text-sm ${
                      result.status === 'error' ? 'text-red-700' :
                      result.status === 'warning' ? 'text-yellow-700' :
                      'text-gray-600'
                    }`}>
                      {result.message}
                    </p>
                    {result.data && (
                      <details className="mt-2">
                        <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                          Ver dados completos
                        </summary>
                        <pre className="mt-2 p-3 bg-gray-50 rounded-lg text-xs overflow-x-auto">
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
