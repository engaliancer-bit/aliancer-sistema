# Guia de Otimização - Módulo Products

## Componentes Criados

### 1. ProductsList.tsx (Virtualizado)
**Localização:** `src/components/products/ProductsList.tsx`

**Funcionalidades:**
- Lista virtualizada com `react-window` (renderiza apenas itens visíveis)
- Memoização completa com `React.memo` e comparação customizada
- Renderiza apenas campos essenciais da lista
- Performance otimizada para listas com 1000+ produtos

**Props:**
```typescript
{
  products: ProductListItem[];  // Lista mínima de produtos
  onEdit: (product) => void;
  onDelete: (id: string) => void;
  onClone: (product) => void;
  loading?: boolean;
}
```

### 2. useProductsData Hook (Cache + Paginação)
**Localização:** `src/hooks/useProductsData.ts`

**Funcionalidades:**
- Cache em memória com staleTime configurável (padrão: 10min)
- Paginação server-side (limit 50)
- Busca otimizada com debounce 300ms
- Select enxuto (apenas campos necessários)
- Abort controller para cancelar requests pendentes
- Cache por página + termo de busca

**Configuração:**
```typescript
const {
  products,      // Lista de produtos da página atual
  loading,       // Estado de carregamento
  totalCount,    // Total de produtos
  currentPage,   // Página atual
  totalPages,    // Total de páginas
  searchTerm,    // Termo de busca
  setSearchTerm, // Atualizar busca
  goToPage,      // Ir para página específica
  nextPage,      // Próxima página
  prevPage,      // Página anterior
  refetch,       // Recarregar dados
  invalidateCache // Limpar cache
} = useProductsData({
  pageSize: 50,      // Produtos por página
  staleTime: 600000  // Cache válido por 10min
});
```

### 3. ProductsPagination.tsx
**Localização:** `src/components/products/ProductsPagination.tsx`

Componente de paginação com:
- Navegação prev/next
- Navegação direta para páginas
- Indicador de página atual
- Contadores de registros

### 4. usePerformanceDiagnostics Hook
**Localização:** `src/hooks/usePerformanceDiagnostics.ts`

**Funcionalidades:**
- Mede tempo de render de cada componente
- Alerta no console quando render > 50ms
- Conta renders lentos
- Detecta requests duplicados

**Uso no formulário:**
```typescript
const metrics = usePerformanceDiagnostics('ProductForm', 50);

// Logs automáticos no console quando render demorado
```

### 5. ProductsContainer.tsx (Exemplo de Integração)
**Localização:** `src/components/products/ProductsContainer.tsx`

Exemplo de como integrar todos os componentes acima.

---

## Como Integrar no Products.tsx Existente

### Fase 1: Separar Lista de Edição

#### Passo 1.1: Modificar estrutura do componente principal
```typescript
// No Products.tsx
const [viewMode, setViewMode] = useState<'list' | 'edit'>('list');
const [editingId, setEditingId] = useState<string | null>(null);

// Ao clicar em editar:
const handleEdit = (product) => {
  setEditingId(product.id);
  setViewMode('edit');
  // NÃO re-renderizar a lista
};

// Ao salvar/cancelar:
const handleFormClose = () => {
  setViewMode('list');
  setEditingId(null);
  refetch(); // Apenas invalidar cache
};
```

#### Passo 1.2: Renderização condicional
```typescript
return (
  <div className="space-y-6">
    {viewMode === 'list' ? (
      <>
        <ProductsListView />
      </>
    ) : (
      <>
        <ProductFormView productId={editingId} onClose={handleFormClose} />
      </>
    )}
  </div>
);
```

### Fase 2: Substituir Lista Atual

#### Passo 2.1: Trocar fetch manual por useProductsData
```typescript
// ANTES:
const [products, setProducts] = useState([]);
const loadData = async () => {
  const { data } = await supabase.from('products').select('*');
  setProducts(data);
};

// DEPOIS:
const {
  products,
  loading,
  searchTerm,
  setSearchTerm,
  currentPage,
  totalPages,
  goToPage,
  nextPage,
  prevPage,
  refetch
} = useProductsData({ pageSize: 50, staleTime: 600000 });
```

#### Passo 2.2: Substituir tabela por ProductsList
```typescript
// ANTES:
<table>
  {products.map(product => (
    <tr key={product.id}>...</tr>
  ))}
</table>

// DEPOIS:
<ProductsList
  products={products}
  onEdit={handleEdit}
  onDelete={handleDelete}
  onClone={handleClone}
  loading={loading}
/>
```

### Fase 3: Otimizar Formulário de Edição

#### Passo 3.1: Adicionar debounce nos inputs críticos
```typescript
// ANTES:
<input
  value={formData.concrete_volume_m3}
  onChange={(e) => setFormData({ ...formData, concrete_volume_m3: e.target.value })}
/>

// DEPOIS:
const [localVolume, setLocalVolume] = useState('');
const debouncedVolume = useDebounce(localVolume, 300);

useEffect(() => {
  setFormData(prev => ({ ...prev, concrete_volume_m3: debouncedVolume }));
}, [debouncedVolume]);

<input
  value={localVolume}
  onChange={(e) => setLocalVolume(e.target.value)}
/>
```

#### Passo 3.2: Memoizar cálculos pesados
```typescript
// Cálculo de consumo/custo com useMemo
const materialCost = useMemo(() => {
  if (!formData.recipe_id || !formData.concrete_volume_m3) return 0;

  return recipeMaterialsData.reduce((total, material) => {
    const consumption = calculateMaterialConsumption(
      material,
      parseFloat(formData.concrete_volume_m3)
    );
    return total + (consumption * material.materials.unit_cost);
  }, 0);
}, [formData.recipe_id, formData.concrete_volume_m3, recipeMaterialsData]);

// Atualizar formData apenas quando o cálculo mudar
useEffect(() => {
  setFormData(prev => ({ ...prev, material_cost: materialCost.toFixed(2) }));
}, [materialCost]);
```

#### Passo 3.3: Throttle em vez de onChange direto
```typescript
const throttledVolumeUpdate = useThrottle((value: string) => {
  // Cálculos pesados aqui
  calculateAllCosts(value);
}, 300);

<input
  onChange={(e) => {
    setLocalVolume(e.target.value); // Update UI imediato
    throttledVolumeUpdate(e.target.value); // Cálculo throttled
  }}
/>
```

### Fase 4: Limpar useEffects

#### Passo 4.1: Adicionar abort controllers
```typescript
useEffect(() => {
  const abortController = new AbortController();

  const loadRecipeMaterials = async () => {
    try {
      const { data } = await supabase
        .from('recipe_materials')
        .select('*')
        .eq('recipe_id', formData.recipe_id)
        .abortSignal(abortController.signal);

      setRecipeMaterialsData(data || []);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error(error);
      }
    }
  };

  if (formData.recipe_id) {
    loadRecipeMaterials();
  }

  return () => {
    abortController.abort(); // Cleanup
  };
}, [formData.recipe_id]);
```

#### Passo 4.2: Revisar dependências dos useEffects
```typescript
// EVITAR:
useEffect(() => {
  calculateCosts();
}, [formData]); // Re-calcula para qualquer mudança em formData

// PREFERIR:
useEffect(() => {
  calculateCosts();
}, [formData.recipe_id, formData.concrete_volume_m3]); // Apenas deps necessárias
```

### Fase 5: Adicionar Diagnóstico

#### Passo 5.1: Adicionar no formulário
```typescript
function ProductForm({ productId, onClose }) {
  const metrics = usePerformanceDiagnostics('ProductForm', 50);
  const { trackRequest } = useRequestDiagnostics();

  const saveProduct = async () => {
    trackRequest('save_product');

    // ... resto do código
  };

  return (
    <div>
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 bg-yellow-100 p-2 rounded text-xs">
          Renders: {metrics.renderCount} | Slow: {metrics.slowRenders}
        </div>
      )}
      {/* Formulário */}
    </div>
  );
}
```

---

## Checklist de Implementação

### Alta Prioridade (Fazer primeiro)
- [ ] Separar lista de formulário (viewMode)
- [ ] Implementar useProductsData na lista
- [ ] Adicionar ProductsList virtualizada
- [ ] Adicionar paginação
- [ ] Adicionar debounce no campo de busca (já implementado no hook)

### Média Prioridade
- [ ] Adicionar debounce nos inputs de volume/peso
- [ ] Memoizar cálculos de custo
- [ ] Adicionar abort controllers em todos os useEffect com requests
- [ ] Revisar dependências de todos os useEffects

### Baixa Prioridade
- [ ] Adicionar diagnóstico de performance
- [ ] Otimizar renderização de armaduras/acessórios
- [ ] Implementar lazy loading de imagens (se houver)

---

## Resultados Esperados

### Antes da Otimização
- Lista renderiza 100% dos produtos (travamento com 200+ produtos)
- Formulário re-renderiza a cada tecla (travamento ao digitar)
- Busca sem debounce (múltiplos requests)
- Editar produto re-renderiza lista inteira
- Memory leaks em requests não cancelados
- Tempo de render > 100ms

### Depois da Otimização
- Lista virtualizada (renderiza apenas 10-15 itens visíveis)
- Formulário com debounce (renderiza após 300ms de inatividade)
- Busca com debounce + cache (1 request a cada 300ms, depois usa cache)
- Editar produto desmonta lista (0 re-renders)
- Todos os requests canceláveis (sem memory leaks)
- Tempo de render < 50ms
- Cache: primeira carga 500ms, próximas cargas instantâneas

---

## Teste de Performance

Execute este teste para validar as otimizações:

1. Abrir Products
2. Rolar lista (deve ser suave, sem travamentos)
3. Buscar produto (esperar 300ms, 1 request apenas)
4. Editar 5 produtos em sequência
5. Voltar para lista
6. Repetir por 10 minutos

**Métricas esperadas:**
- Memória estável (não deve crescer continuamente)
- Requests não duplicados
- Renders < 50ms
- UI responsiva durante toda operação
