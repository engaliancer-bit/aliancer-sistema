# Guia Rápido - Otimizações de Performance

## TL;DR - Copy & Paste

### 1. Cache Automático de Dados

```typescript
// Antes
const [materials, setMaterials] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const fetchData = async () => {
    const { data } = await supabase.from('materials').select('*');
    setMaterials(data);
    setLoading(false);
  };
  fetchData();
}, []);

// Depois
import { useCachedMaterials } from '../hooks/useCachedQuery';

const { data, loading, refetch } = useCachedMaterials();
```

**Economia: 90% de queries**

---

### 2. Tabela Virtualizada

```typescript
// Antes
<table>
  <tbody>
    {materials.map(material => (
      <tr key={material.id}>
        <td>{material.name}</td>
      </tr>
    ))}
  </tbody>
</table>

// Depois
import { VirtualizedTableOptimized } from '../components/VirtualizedTableOptimized';

const columns = [
  { key: 'name', header: 'Nome', render: (m) => <span>{m.name}</span> },
];

<VirtualizedTableOptimized data={materials} columns={columns} rowHeight={56} height={600} />
```

**Economia: 95% de memória**

---

## Hooks Disponíveis

```typescript
// Cache
useCachedMaterials()
useCachedProducts()
useCachedRecipes()

// Otimização
useDebouncedValue(value, 300)
useCallback(fn, deps)

// Cleanup
useLogoutCleanup()
useIdleCleanup(300000)
```

---

## Quando Usar

- **Cache**: Dados que mudam pouco
- **Virtualização**: Listas com 50+ itens
- **React.memo**: Componentes que re-renderizam muito
- **Debounce**: Inputs de busca
- **Cleanup**: Sempre no App principal

