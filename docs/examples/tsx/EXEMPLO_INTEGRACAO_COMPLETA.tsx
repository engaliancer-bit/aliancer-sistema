/**
 * EXEMPLO DE INTEGRAÇÃO COMPLETA
 *
 * Este arquivo mostra como integrar todos os sistemas de performance
 * em um componente real de produção.
 *
 * Features demonstradas:
 * 1. Query Performance Tracking
 * 2. Rate Limiting
 * 3. Logging automático
 * 4. Performance Dashboard
 */

import { useState, useEffect } from 'react';
import { Search, AlertCircle } from 'lucide-react';
import { supabase } from './lib/supabase';
import { useQueryPerformance } from './hooks/useQueryPerformance';
import { useRateLimitWithFeedback } from './hooks/useRateLimit';

interface Product {
  id: string;
  name: string;
  product_type: string;
  sale_price: number;
}

/**
 * Componente exemplo: Lista de Produtos
 *
 * Integra:
 * - Query performance tracking
 * - Rate limiting
 * - Feedback visual
 * - Busca otimizada
 */
export default function ProductListExample() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  // 1. Hook de Performance Tracking
  const { trackQuery } = useQueryPerformance('ProductList');

  // 2. Hook de Rate Limiting (10 buscas por minuto)
  const { checkLimit, remaining } = useRateLimitWithFeedback(10, 60000);

  // Carrega produtos iniciais
  useEffect(() => {
    loadProducts();
  }, []);

  /**
   * Carrega lista de produtos com tracking
   */
  const loadProducts = async () => {
    setLoading(true);
    setError('');

    try {
      // trackQuery loga automaticamente a performance
      const { data, error } = await trackQuery('Carregar lista', async () => {
        return await supabase
          .from('products')
          .select('id, name, product_type, sale_price')
          .order('created_at', { ascending: false })
          .limit(50);
      });

      if (error) throw error;

      setProducts(data || []);
    } catch (err: any) {
      console.error('Erro ao carregar produtos:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Busca produtos com rate limiting e tracking
   */
  const searchProducts = async (term: string) => {
    // Validação básica
    if (!term || term.length < 2) {
      loadProducts();
      return;
    }

    // Rate limiting
    const { allowed, message } = checkLimit();
    if (!allowed) {
      setError(message || 'Muitas buscas. Aguarde um momento.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Busca com tracking (ILIKE usa índice trigram)
      const { data, error } = await trackQuery(
        `Buscar: "${term}"`,
        async () => {
          return await supabase
            .from('products')
            .select('id, name, product_type, sale_price')
            .ilike('name', `%${term}%`) // Usa idx_products_name_trgm
            .limit(50);
        }
      );

      if (error) throw error;

      setProducts(data || []);
    } catch (err: any) {
      console.error('Erro ao buscar produtos:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Filtra por tipo com tracking
   */
  const filterByType = async (type: string | null) => {
    setLoading(true);
    setError('');

    try {
      const { data, error } = await trackQuery(
        type ? `Filtrar por: ${type}` : 'Remover filtro',
        async () => {
          let query = supabase
            .from('products')
            .select('id, name, product_type, sale_price')
            .order('created_at', { ascending: false })
            .limit(50);

          if (type) {
            query = query.eq('product_type', type); // Usa índice se existir
          }

          return await query;
        }
      );

      if (error) throw error;

      setProducts(data || []);
    } catch (err: any) {
      console.error('Erro ao filtrar produtos:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Produtos (Exemplo Completo)
        </h1>
        <p className="text-gray-600 text-sm">
          Integração: Query Tracking + Rate Limiting + Performance Dashboard
        </p>
      </div>

      {/* Busca com Rate Limiting */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                searchProducts(e.target.value);
              }}
              placeholder="Buscar produtos... (max 10/min)"
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="text-sm text-gray-600">
            Buscas restantes: <strong>{remaining()}</strong>
          </div>
        </div>

        {/* Erro ou Rate Limit */}
        {error && (
          <div className="mt-3 flex items-center gap-2 text-red-600 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Tipo:</span>
          <button
            onClick={() => filterByType(null)}
            className="px-3 py-1 rounded text-sm hover:bg-gray-100"
          >
            Todos
          </button>
          <button
            onClick={() => filterByType('premoldado')}
            className="px-3 py-1 rounded text-sm hover:bg-gray-100"
          >
            Premoldado
          </button>
          <button
            onClick={() => filterByType('molde')}
            className="px-3 py-1 rounded text-sm hover:bg-gray-100"
          >
            Molde
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-gray-600">Carregando...</p>
        </div>
      )}

      {/* Lista de Produtos */}
      {!loading && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Tipo
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Preço
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                    Nenhum produto encontrado
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{product.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                        {product.product_type || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-900">
                      R$ {product.sale_price?.toFixed(2) || '0.00'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Info sobre Performance */}
      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">
          Monitoramento de Performance Ativo
        </h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>✅ Todas as queries são logadas automaticamente</li>
          <li>✅ Queries lentas (> 1s) aparecem em vermelho no console</li>
          <li>✅ Rate limiting protege contra abuso (10 buscas/min)</li>
          <li>✅ Dashboard no canto mostra estatísticas em tempo real</li>
        </ul>
        <p className="text-xs text-blue-600 mt-2">
          Abra o console do navegador para ver logs de performance
        </p>
      </div>
    </div>
  );
}

/**
 * NOTAS DE IMPLEMENTAÇÃO
 *
 * 1. PERFORMANCE TRACKING
 *    - useQueryPerformance('ComponentName') cria prefixo automático
 *    - trackQuery('Nome', async () => ...) loga automaticamente
 *    - Console mostra: "ComponentName: Nome (123ms)"
 *
 * 2. RATE LIMITING
 *    - useRateLimitWithFeedback(10, 60000) = 10 operações/minuto
 *    - checkLimit() retorna { allowed, message }
 *    - remaining() mostra quantas operações restam
 *
 * 3. ÍNDICES NECESSÁRIOS
 *    Execute no Supabase SQL Editor:
 *
 *    CREATE EXTENSION IF NOT EXISTS pg_trgm;
 *
 *    CREATE INDEX IF NOT EXISTS idx_products_name_trgm
 *    ON products USING gin (name gin_trgm_ops);
 *
 *    CREATE INDEX IF NOT EXISTS idx_products_type
 *    ON products(product_type);
 *
 * 4. CONSOLE OUTPUT ESPERADO
 *    ✅ Query: ProductList: Carregar lista (145ms)
 *    ✅ Query: ProductList: Buscar: "cadeira" (234ms)
 *    ⚡ Query: ProductList: Filtrar por: premoldado (623ms)
 *    ⚠️ Query LENTA: ProductList: Buscar: "x" (1234ms)
 *
 * 5. DASHBOARD
 *    Adicione <PerformanceDashboard /> no App.tsx
 *    Aparecerá no canto inferior esquerdo mostrando:
 *    - Total de queries
 *    - Duração média
 *    - Queries lentas
 *    - Alertas visuais
 *
 * 6. DEBUGGING
 *    import { debugQuery } from '../lib/queryExplain';
 *
 *    await debugQuery('products', (q) =>
 *      q.select('*').ilike('name', '%cadeira%')
 *    );
 *
 *    Mostra:
 *    - Execution time
 *    - Se usa Seq Scan ou Index Scan
 *    - Sugestões de otimização
 *
 * 7. ESTATÍSTICAS
 *    import { getQueryStats, getSlowQueries } from '../lib/queryLogger';
 *
 *    console.log('Stats:', getQueryStats());
 *    console.table(getSlowQueries());
 */
