# Exemplos Práticos de Integração das Otimizações

## 1. Componente de Produtos Otimizado

```typescript
import React, { useState, useMemo } from 'react';
import { useOptimizedSupabaseQuery } from '@/hooks/useOptimizedSupabaseQuery';
import { usePagination } from '@/hooks/useVirtualizedList';
import { useDebounce } from '@/hooks/useAdvancedDebounceThrottle';
import { prefetchCustomersList } from '@/lib/prefetchManager';

export function ProductsOptimized() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({});

  // Prefetch customers ao montar
  React.useEffect(() => {
    prefetchCustomersList();
  }, []);

  // Query otimizada com select específico
  const { data: allProducts, loading, error } = useOptimizedSupabaseQuery('products', {
    select: 'id, name, code, price, status',
    limit: 1000,
    filters: [
      ...(searchTerm ? [{ column: 'name', operator: 'like', value: `%${searchTerm}%` }] : []),
      ...Object.entries(filters).map(([col, val]) => ({
        column: col,
        operator: 'eq',
        value: val
      }))
    ],
    orderBy: { column: 'name' }
  });

  // Debounce de busca
  const debouncedSearch = useDebounce(
    (term: string) => setSearchTerm(term),
    500
  );

  // Pagination
  const { currentItems, currentPage, nextPage, prevPage, totalPages } = usePagination(
    allProducts || [],
    50
  );

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(e.target.value);
  };

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Buscar produtos..."
        onChange={handleSearch}
        className="w-full px-4 py-2 border rounded-lg"
      />

      {loading && <div>Carregando...</div>}
      {error && <div>Erro: {error.message}</div>}

      <div className="space-y-2">
        {currentItems.map(product => (
          <div key={product.id} className="p-4 border rounded">
            <h3>{product.name}</h3>
            <p className="text-gray-600">{product.code}</p>
            <p className="font-bold">R$ {product.price}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 justify-center">
        <button onClick={prevPage} disabled={currentPage === 1}>Anterior</button>
        <span>Página {currentPage} de {totalPages}</span>
        <button onClick={nextPage} disabled={currentPage === totalPages}>Próxima</button>
      </div>
    </div>
  );
}
```

---

## 2. Lista Virtualizada de Materiais

```typescript
import React from 'react';
import { useOptimizedSupabaseQuery } from '@/hooks/useOptimizedSupabaseQuery';
import { useVirtualizedList } from '@/hooks/useVirtualizedList';

export function MaterialsVirtualized() {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = React.useState(600);

  // Query otimizada
  const { data: materials = [] } = useOptimizedSupabaseQuery('materials', {
    select: 'id, name, unit, current_stock',
    limit: 10000
  });

  // Virtualization
  const { visibleItems, offsetY, totalHeight, handleScroll } = useVirtualizedList(
    materials,
    containerHeight,
    { itemHeight: 60, bufferItems: 5 }
  );

  React.useEffect(() => {
    if (containerRef.current) {
      setContainerHeight(containerRef.current.clientHeight);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{ height: '600px', overflow: 'auto', position: 'relative' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            width: '100%'
          }}
        >
          {visibleItems.map(material => (
            <div
              key={material.id}
              style={{ height: '60px', padding: '8px', borderBottom: '1px solid #eee' }}
            >
              <p className="font-semibold">{material.name}</p>
              <p className="text-sm text-gray-600">
                Estoque: {material.current_stock} {material.unit}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## 3. Formulário com Throttle em Eventos

```typescript
import React, { useState } from 'react';
import { useThrottle } from '@/hooks/useAdvancedDebounceThrottle';
import { recordMetric } from '@/lib/performanceMonitor';

export function FormWithThrottle() {
  const [values, setValues] = useState({ name: '', email: '', phone: '' });
  const [metrics, setMetrics] = useState<Record<string, any>>({});

  // Throttle de scroll
  const handleScroll = useThrottle((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    recordMetric('scroll_position', target.scrollTop, 'px');
  }, 100);

  // Throttle de input (atualizar a cada 300ms)
  const handleInputChange = useThrottle((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setValues(prev => ({ ...prev, [name]: value }));
  }, 300);

  // Throttle de salvar
  const handleSave = useThrottle(async () => {
    recordMetric('form_save', 1, 'events');
    try {
      // Salvar no banco
      console.log('Salvando:', values);
    } catch (error) {
      console.error('Erro ao salvar:', error);
    }
  }, 1000, { leading: true });

  return (
    <div onScroll={handleScroll} style={{ height: '400px', overflow: 'auto' }}>
      <form className="space-y-4 p-4">
        <div>
          <label>Nome:</label>
          <input
            type="text"
            name="name"
            onChange={handleInputChange}
            className="w-full px-4 py-2 border rounded"
          />
        </div>

        <div>
          <label>Email:</label>
          <input
            type="email"
            name="email"
            onChange={handleInputChange}
            className="w-full px-4 py-2 border rounded"
          />
        </div>

        <div>
          <label>Telefone:</label>
          <input
            type="tel"
            name="phone"
            onChange={handleInputChange}
            className="w-full px-4 py-2 border rounded"
          />
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Salvar
        </button>

        <div className="mt-4 p-4 bg-gray-100 rounded">
          <p className="text-sm">
            Events registrados: {metrics.eventCount || 0}
          </p>
        </div>
      </form>
    </div>
  );
}
```

---

## 4. Dashboard com Cache React Query

```typescript
import React from 'react';
import { useQuery, useInfiniteQuery, invalidateQueries } from '@/hooks/useReactQuery';
import { supabase } from '@/lib/supabase';

export function Dashboard() {
  // Query com cache de 5 minutos
  const { data: stats, refetch: refetchStats } = useQuery(
    'dashboard-stats',
    async () => {
      const [products, orders, deliveries] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact' }),
        supabase.from('production_orders').select('id', { count: 'exact' }),
        supabase.from('deliveries').select('id', { count: 'exact' })
      ]);
      return {
        products: products.count || 0,
        orders: orders.count || 0,
        deliveries: deliveries.count || 0
      };
    },
    { staleTime: 5 * 60 * 1000 }
  );

  // Query infinita para recentes
  const {
    data: recentSales,
    hasMore,
    fetchNextPage
  } = useInfiniteQuery(
    'recent-sales',
    (page) =>
      supabase
        .from('sales')
        .select('id, customer_id, amount, created_at')
        .order('created_at', { ascending: false })
        .range(page * 20, (page + 1) * 20 - 1)
  );

  const handleRefresh = () => {
    invalidateQueries('dashboard');
    refetchStats();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded shadow">
          <p className="text-gray-600">Produtos</p>
          <p className="text-3xl font-bold">{stats?.products || 0}</p>
        </div>
        <div className="p-4 bg-white rounded shadow">
          <p className="text-gray-600">Ordens</p>
          <p className="text-3xl font-bold">{stats?.orders || 0}</p>
        </div>
        <div className="p-4 bg-white rounded shadow">
          <p className="text-gray-600">Entregas</p>
          <p className="text-3xl font-bold">{stats?.deliveries || 0}</p>
        </div>
      </div>

      <div className="bg-white rounded shadow p-4">
        <h2 className="text-xl font-bold mb-4">Vendas Recentes</h2>
        <div className="space-y-2 max-h-96 overflow-auto">
          {recentSales?.map(sale => (
            <div
              key={sale.id}
              className="p-2 border rounded flex justify-between items-center hover:bg-gray-50"
            >
              <span>Customer ID: {sale.customer_id}</span>
              <span className="font-bold">R$ {sale.amount}</span>
              <span className="text-sm text-gray-600">
                {new Date(sale.created_at).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
        {hasMore && (
          <button
            onClick={fetchNextPage}
            className="mt-4 w-full px-4 py-2 bg-gray-100 rounded hover:bg-gray-200"
          >
            Carregar mais
          </button>
        )}
      </div>
    </div>
  );
}
```

---

## 5. Monitoramento de Performance em Tempo Real

```typescript
import React, { useState, useEffect } from 'react';
import { subscribeToMetrics, getMetricStats, generateReport } from '@/lib/performanceMonitor';

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<Record<string, any>>({});
  const [report, setReport] = useState<Record<string, any>>({});

  useEffect(() => {
    // Escutar métricas em tempo real
    const unsubscribe = subscribeToMetrics((newMetrics) => {
      setMetrics(prev => ({
        ...prev,
        [newMetrics[0].name]: {
          value: newMetrics[0].value,
          timestamp: newMetrics[0].timestamp
        }
      }));
    });

    // Gerar relatório a cada 10 segundos
    const reportInterval = setInterval(() => {
      setReport(generateReport());
    }, 10000);

    return () => {
      unsubscribe();
      clearInterval(reportInterval);
    };
  }, []);

  return (
    <div className="bg-white rounded shadow p-6 space-y-4">
      <h2 className="text-2xl font-bold">Performance Monitor</h2>

      <div className="grid grid-cols-2 gap-4">
        {Object.entries(report).map(([key, stats]: [string, any]) => (
          <div key={key} className="p-4 bg-gray-50 rounded">
            <h3 className="font-semibold text-sm text-gray-600">{key}</h3>
            {typeof stats === 'object' && stats.avg ? (
              <div className="space-y-1 text-sm mt-2">
                <p>Média: {stats.avg?.toFixed(2)}ms</p>
                <p>Min: {stats.min?.toFixed(2)}ms</p>
                <p>Max: {stats.max?.toFixed(2)}ms</p>
                <p>P95: {stats.p95?.toFixed(2)}ms</p>
                <p>Chamadas: {stats.count}</p>
              </div>
            ) : (
              <p className="text-2xl font-bold">{stats}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 p-4 bg-blue-50 rounded border border-blue-200 text-sm">
        <p className="font-semibold mb-2">Dicas de Otimização:</p>
        <ul className="space-y-1 list-disc list-inside">
          {report.query_time?.avg > 1000 && (
            <li>Query time acima de 1s - considere adicionar índices</li>
          )}
          {report.render_time?.avg > 16 && (
            <li>Render time acima de 16ms - considere usar memoização</li>
          )}
          {report.memory_usage?.percentage > 80 && (
            <li>Memória acima de 80% - limpe caches antigos</li>
          )}
        </ul>
      </div>
    </div>
  );
}
```

---

## 6. Componente com Memoização Estratégica

```typescript
import React from 'react';
import { useMemoComponent, getMemoComponentStats } from '@/hooks/useMemoComponent';
import { useOptimizedSupabaseQuery } from '@/hooks/useOptimizedSupabaseQuery';

export function CompaniesListMemoized() {
  const { data: companies = [] } = useOptimizedSupabaseQuery('customers', {
    select: 'id, name, person_type'
  });

  const [filterType, setFilterType] = React.useState<string | null>(null);
  const [stats, setStats] = React.useState<any>(null);

  // Memoizar a lista filtrada
  const filteredList = useMemoComponent(
    'companies-filtered-list',
    () => {
      if (!filterType) return companies;
      return companies.filter(c => c.person_type === filterType);
    },
    [companies, filterType],
    { debug: true }
  );

  // Memoizar o componente renderizado
  const renderedList = useMemoComponent(
    'companies-rendered',
    () => (
      <div className="space-y-2">
        {filteredList.map(company => (
          <div
            key={company.id}
            className="p-4 border rounded hover:bg-gray-50 cursor-pointer"
          >
            <h3 className="font-semibold">{company.name}</h3>
            <p className="text-sm text-gray-600">{company.person_type}</p>
          </div>
        ))}
      </div>
    ),
    [filteredList],
    { debug: true }
  );

  const checkStats = () => {
    setStats(getMemoComponentStats());
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <button
          onClick={() => setFilterType(null)}
          className={`px-4 py-2 rounded ${!filterType ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          Todos
        </button>
        <button
          onClick={() => setFilterType('PF')}
          className={`px-4 py-2 rounded ${filterType === 'PF' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          Pessoa Física
        </button>
        <button
          onClick={() => setFilterType('PJ')}
          className={`px-4 py-2 rounded ${filterType === 'PJ' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          Pessoa Jurídica
        </button>
        <button
          onClick={checkStats}
          className="px-4 py-2 bg-gray-300 rounded ml-auto"
        >
          Ver Estatísticas
        </button>
      </div>

      {renderedList}

      {stats && (
        <div className="p-4 bg-gray-50 rounded text-sm font-mono">
          <pre>{JSON.stringify(stats, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
```

---

## 7. Busca Otimizada com Debounce

```typescript
import React, { useState } from 'react';
import { useSearchDebounce } from '@/hooks/useAdvancedDebounceThrottle';
import { supabase } from '@/lib/supabase';
import { measureAsync } from '@/lib/performanceMonitor';

export function OptimizedSearch() {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<any[]>([]);

  const { searching } = useSearchDebounce(
    term,
    async (searchTerm) => {
      await measureAsync(
        'search_query',
        async () => {
          const { data } = await supabase
            .from('products')
            .select('id, name, code')
            .like('name', `%${searchTerm}%`)
            .limit(10);

          setResults(data || []);
        },
        { search_term: searchTerm }
      );
    },
    500
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <input
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Digite para buscar..."
          className="w-full px-4 py-2 border rounded-lg"
        />
        {searching && (
          <div className="absolute right-3 top-3">
            <div className="animate-spin">⏳</div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {results.map(result => (
          <div
            key={result.id}
            className="p-3 border rounded hover:bg-gray-50 cursor-pointer"
          >
            <p className="font-semibold">{result.name}</p>
            <p className="text-sm text-gray-600">{result.code}</p>
          </div>
        ))}
        {term && results.length === 0 && !searching && (
          <p className="text-gray-500 text-center py-8">Nenhum resultado encontrado</p>
        )}
      </div>
    </div>
  );
}
```

---

## Conclusão

Estes exemplos demonstram como integrar as otimizações de forma prática. Cada exemplo pode ser adaptado conforme suas necessidades específicas.

Para mais detalhes sobre cada hook e lib, consulte:
- `GUIA_OTIMIZACOES_IMPLEMENTADAS_FEV2026.md`
- Documentação específica em cada arquivo de hook

