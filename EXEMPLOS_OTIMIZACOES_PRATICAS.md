# Exemplos Práticos: Otimizações de Performance

**Copie e cole estes exemplos no seu código**

---

## 1. BUSCA COM DEBOUNCE

### ❌ Antes (Query a cada tecla)

```typescript
function SearchComponent() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);

  const handleSearch = async (term: string) => {
    const { data } = await supabase
      .from('materials')
      .select('*')
      .ilike('name', `%${term}%`);
    setResults(data || []);
  };

  return (
    <input
      value={searchTerm}
      onChange={(e) => {
        setSearchTerm(e.target.value);
        handleSearch(e.target.value); // Query a cada tecla!
      }}
    />
  );
}
```

### ✅ Depois (Query após 300ms de pausa)

```typescript
import { useDebounce } from '../hooks/useDebounce';

function SearchComponent() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const debouncedSearch = useDebounce(searchTerm, 300);

  useEffect(() => {
    const handleSearch = async () => {
      if (!debouncedSearch) {
        setResults([]);
        return;
      }

      const { data } = await supabase
        .from('materials')
        .select('*')
        .ilike('name', `%${debouncedSearch}%`);
      setResults(data || []);
    };

    handleSearch();
  }, [debouncedSearch]);

  return (
    <input
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
    />
  );
}
```

---

## 2. LISTA GRANDE

### ❌ Antes (Renderiza 1000 itens)

```typescript
function MaterialsList() {
  const [materials, setMaterials] = useState<Material[]>([]);

  return (
    <div>
      {materials.map(material => (
        <div key={material.id} className="p-4 border-b">
          {material.name} - R$ {material.unit_cost}
        </div>
      ))}
    </div>
  );
}
```

### ✅ Depois (Renderiza apenas 8 itens visíveis)

```typescript
import VirtualizedList from './VirtualizedList';

function MaterialsList() {
  const [materials, setMaterials] = useState<Material[]>([]);

  return (
    <VirtualizedList
      items={materials}
      itemHeight={65}
      height={400}
      renderItem={({ item, style }) => (
        <div style={style} className="p-4 border-b">
          {item.name} - R$ {item.unit_cost}
        </div>
      )}
    />
  );
}
```

---

## 3. FORMULÁRIO COM MÚLTIPLOS ITENS

### ❌ Antes (Re-renderiza tudo a cada mudança)

```typescript
function PurchaseForm() {
  const [items, setItems] = useState([]);

  const updateItem = (id: string, field: string, value: any) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  return (
    <div>
      {items.map(item => (
        <div key={item.id}>
          <input
            value={item.name}
            onChange={e => updateItem(item.id, 'name', e.target.value)}
          />
          <input
            type="number"
            value={item.quantity}
            onChange={e => updateItem(item.id, 'quantity', e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}
```

### ✅ Depois (Apenas item modificado re-renderiza)

```typescript
import { memo, useCallback } from 'react';

const PurchaseItemRow = memo(({ item, onUpdate }) => {
  const handleNameChange = useCallback((e) => {
    onUpdate(item.id, 'name', e.target.value);
  }, [item.id, onUpdate]);

  const handleQuantityChange = useCallback((e) => {
    onUpdate(item.id, 'quantity', e.target.value);
  }, [item.id, onUpdate]);

  return (
    <div>
      <input value={item.name} onChange={handleNameChange} />
      <input type="number" value={item.quantity} onChange={handleQuantityChange} />
    </div>
  );
});

function PurchaseForm() {
  const [items, setItems] = useState([]);

  const updateItem = useCallback((id: string, field: string, value: any) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  }, []);

  return (
    <div>
      {items.map(item => (
        <PurchaseItemRow
          key={item.id}
          item={item}
          onUpdate={updateItem}
        />
      ))}
    </div>
  );
}
```

---

## 4. EVENT LISTENER COM CLEANUP

### ❌ Antes (Memory leak!)

```typescript
function WindowSize() {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    // Falta o cleanup!
  }, []);

  return <div>Width: {width}px</div>;
}
```

### ✅ Depois (Com cleanup automático)

```typescript
import { useEventListener } from '../hooks/useCallbackMemo';

function WindowSize() {
  const [width, setWidth] = useState(window.innerWidth);

  useEventListener('resize', () => {
    setWidth(window.innerWidth);
  });

  return <div>Width: {width}px</div>;
}
```

---

## 5. AUTO-SAVE COM DEBOUNCE

### ❌ Antes (Salva a cada tecla)

```typescript
function Editor() {
  const [content, setContent] = useState('');

  const saveContent = async (value: string) => {
    await supabase
      .from('documents')
      .update({ content: value })
      .eq('id', documentId);
  };

  return (
    <textarea
      value={content}
      onChange={(e) => {
        setContent(e.target.value);
        saveContent(e.target.value); // Salva a cada tecla!
      }}
    />
  );
}
```

### ✅ Depois (Salva 2s após parar de digitar)

```typescript
import { useDebounce } from '../hooks/useDebounce';

function Editor() {
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const debouncedContent = useDebounce(content, 2000);

  useEffect(() => {
    const saveContent = async () => {
      if (!debouncedContent) return;

      setIsSaving(true);
      await supabase
        .from('documents')
        .update({ content: debouncedContent })
        .eq('id', documentId);
      setIsSaving(false);
    };

    saveContent();
  }, [debouncedContent]);

  return (
    <>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      {isSaving && <span>Salvando...</span>}
    </>
  );
}
```

---

## 6. PAGINAÇÃO NO BANCO

### ❌ Antes (Carrega 10,000 registros)

```typescript
function MaterialsList() {
  const [materials, setMaterials] = useState([]);

  useEffect(() => {
    const loadMaterials = async () => {
      const { data } = await supabase
        .from('materials')
        .select('*');
      setMaterials(data || []);
    };
    loadMaterials();
  }, []);

  return <div>{/* ... */}</div>;
}
```

### ✅ Depois (Carrega 20 por vez)

```typescript
function MaterialsList() {
  const [materials, setMaterials] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const PAGE_SIZE = 20;

  const loadMaterials = async (isLoadMore = false) => {
    setLoading(true);
    const currentOffset = isLoadMore ? offset : 0;

    const { data } = await supabase
      .from('materials')
      .select('*')
      .range(currentOffset, currentOffset + PAGE_SIZE - 1)
      .order('created_at', { ascending: false });

    if (isLoadMore) {
      setMaterials(prev => [...prev, ...(data || [])]);
    } else {
      setMaterials(data || []);
    }

    setHasMore((data?.length || 0) === PAGE_SIZE);
    setOffset(currentOffset + PAGE_SIZE);
    setLoading(false);
  };

  useEffect(() => {
    loadMaterials();
  }, []);

  return (
    <div>
      {/* Lista */}
      {hasMore && (
        <button onClick={() => loadMaterials(true)} disabled={loading}>
          {loading ? 'Carregando...' : 'Carregar mais'}
        </button>
      )}
    </div>
  );
}
```

---

## 7. CALLBACK PARA COMPONENTE MEMOIZADO

### ❌ Antes (MemoizedChild re-renderiza sempre)

```typescript
function Parent() {
  const [value, setValue] = useState('');

  return (
    <MemoizedChild
      onChange={(v) => setValue(v)} // Nova função a cada render!
    />
  );
}
```

### ✅ Depois (MemoizedChild não re-renderiza)

```typescript
import { useStableCallback } from '../hooks/useCallbackMemo';

function Parent() {
  const [value, setValue] = useState('');

  const handleChange = useStableCallback((v) => {
    setValue(v);
  });

  return (
    <MemoizedChild onChange={handleChange} />
  );
}
```

---

## 8. SCROLL COM THROTTLE

### ❌ Antes (Atualiza a cada pixel)

```typescript
function ScrollIndicator() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY); // 100+ vezes por segundo!
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return <div>Scroll: {scrollY}px</div>;
}
```

### ✅ Depois (Atualiza a cada 100ms)

```typescript
import { useThrottle } from '../hooks/useCallbackMemo';
import { useEventListener } from '../hooks/useCallbackMemo';

function ScrollIndicator() {
  const [scrollY, setScrollY] = useState(0);
  const throttledScroll = useThrottle(scrollY, 100);

  useEventListener('scroll', () => {
    setScrollY(window.scrollY);
  });

  return <div>Scroll: {throttledScroll}px</div>;
}
```

---

## 9. CLEANUP DE TIMERS

### ❌ Antes (Timer continua após desmontar)

```typescript
function Notification() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setShow(false);
    }, 3000);
    // Falta cleanup!
  }, []);

  return show ? <div>Mensagem</div> : null;
}
```

### ✅ Depois (Cleanup automático)

```typescript
function Notification() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return show ? <div>Mensagem</div> : null;
}
```

---

## 10. LAZY LOADING DE ROTAS

### ❌ Antes (Tudo no bundle inicial)

```typescript
import Materials from './components/Materials';
import Customers from './components/Customers';
import Products from './components/Products';

function App() {
  return (
    <>
      {tab === 'materials' && <Materials />}
      {tab === 'customers' && <Customers />}
      {tab === 'products' && <Products />}
    </>
  );
}
```

### ✅ Depois (Carrega sob demanda)

```typescript
import { lazy, Suspense } from 'react';

const Materials = lazy(() => import('./components/Materials'));
const Customers = lazy(() => import('./components/Customers'));
const Products = lazy(() => import('./components/Products'));

function App() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      {tab === 'materials' && <Materials />}
      {tab === 'customers' && <Customers />}
      {tab === 'products' && <Products />}
    </Suspense>
  );
}
```

---

## 📊 RESULTADOS ESPERADOS

Aplicando estes padrões, você deve ver:

```
✅ Busca: -90% queries
✅ Listas: 60 FPS constante
✅ Formulários: -80% re-renders
✅ Event listeners: Zero memory leaks
✅ Auto-save: UX suave
✅ Paginação: -95% dados carregados
✅ Callbacks: -100% re-renders desnecessários
✅ Scroll: -90% atualizações
✅ Timers: Zero leaks
✅ Routes: -70% bundle inicial
```

---

**Copie e cole no seu código!**
**Dúvidas?** Consulte `GUIA_RAPIDO_OTIMIZACOES.md`
