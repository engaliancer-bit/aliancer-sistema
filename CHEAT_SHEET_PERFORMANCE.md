# Cheat Sheet: Otimização de Performance React

## 🚀 Análise Rápida (2 minutos)

### Console:

```javascript
startProfiler()       // Iniciar
// [Executar ação]
stopProfiler()        // Ver relatório
resetProfiler()       // Resetar
```

### React DevTools:

```
F12 → ⚛️ Profiler → ● RECORD → [Ação] → ■ STOP
```

---

## 🎯 Identificação

### Cores:

| Emoji | Tempo | Status | Ação |
|-------|-------|--------|------|
| 🟢 | <5ms | OK | Nada |
| 🟡 | 5-16ms | Monitorar | Opcional |
| 🔴 | 16-50ms | Ruim | **OTIMIZAR** |
| 💀 | >50ms | Crítico | **URGENTE** |

### Re-renders:

| Emoji | Vezes | Ação |
|-------|-------|------|
| ✅ | 1-2x | OK |
| 🟡 | 3x | Verificar |
| ⚠️ | 4+x | **React.memo** |

---

## 🔧 Soluções Rápidas

### 1. Componente Lento (>16ms)

```typescript
// ANTES
function MyComponent() {
  return <div>{/* Muito código */}</div>;
}

// DEPOIS
import { memo } from 'react';

const MyComponent = memo(function MyComponent() {
  return <div>{/* Muito código */}</div>;
});
```

---

### 2. Muitos Re-renders (3+x)

```typescript
// FILHO
const Child = memo(function Child({ onChange }) {
  return <input onChange={onChange} />;
});

// PAI
import { useCallback } from 'react';

function Parent() {
  const handleChange = useCallback((value) => {
    console.log(value);
  }, []);

  return <Child onChange={handleChange} />;
}
```

---

### 3. Cálculo Pesado

```typescript
import { useMemo } from 'react';

function MyComponent({ data }) {
  // ✅ Só recalcula quando data muda
  const total = useMemo(
    () => data.reduce((sum, item) => sum + item.value, 0),
    [data]
  );

  return <div>Total: {total}</div>;
}
```

---

### 4. Lista Grande (>50 items)

```typescript
import { VirtualizedList } from './VirtualizedList';

function BigList({ items }) {
  return (
    <VirtualizedList
      items={items}
      itemHeight={50}
      renderItem={(item) => <ItemCard item={item} />}
    />
  );
}
```

---

## 📦 Componentes Prontos

### ProjectFormFields

```typescript
import { ProjectFormFields } from './engineering/ProjectFormFields';
import { useCallback } from 'react';

const handleFormChange = useCallback((data) => {
  setFormData(prev => ({ ...prev, ...data }));
}, []);

<ProjectFormFields
  formData={formData}
  customers={customers}
  onFormDataChange={handleFormChange}
/>
```

### ProjectCard

```typescript
import { ProjectCard } from './engineering/ProjectCard';

<ProjectCard
  project={project}
  progress={progress}
  onView={handleView}
  onEdit={handleEdit}
/>
```

---

## 🎯 Hooks Essenciais

### useCallback

```typescript
// Função estável para props
const handleClick = useCallback(() => {
  console.log('clicked');
}, []);
```

### useMemo

```typescript
// Valor calculado estável
const total = useMemo(
  () => items.reduce((sum, item) => sum + item.value, 0),
  [items]
);
```

### memo

```typescript
// Componente memoizado
const MyComponent = memo(function MyComponent(props) {
  return <div>...</div>;
});
```

---

## 🚨 Erros Comuns

### ❌ memo sem useCallback

```typescript
// ERRADO
const Child = memo(({ onClick }) => <button onClick={onClick} />);

function Parent() {
  const handleClick = () => {}; // Nova função toda vez!
  return <Child onClick={handleClick} />;
}

// CERTO
function Parent() {
  const handleClick = useCallback(() => {}, []);
  return <Child onClick={handleClick} />;
}
```

### ❌ useMemo sem dependencies

```typescript
// ERRADO
const total = useMemo(() => data.reduce(...), []); // Nunca recalcula!

// CERTO
const total = useMemo(() => data.reduce(...), [data]);
```

### ❌ memo em componente que sempre muda

```typescript
// ERRADO - memo inútil
const Clock = memo(() => {
  const now = new Date(); // Sempre diferente!
  return <div>{now.toString()}</div>;
});
```

---

## 📊 Metas

| Tipo | Tempo | Re-renders |
|------|-------|------------|
| Campo | 5ms | 1x |
| Card | 5ms | 1x |
| Form | 10ms | 1x |
| Lista | 20ms | 1x |
| Modal | 15ms | 2x |
| Página | 50ms | 2x |

---

## ✅ Checklist

### Análise:
- [ ] `startProfiler()` → ação → `stopProfiler()`
- [ ] Anotar componentes >16ms
- [ ] Anotar componentes com 3+ re-renders

### Otimização:
- [ ] Aplicar `memo` nos identificados
- [ ] `useCallback` para funções em props
- [ ] `useMemo` para cálculos pesados
- [ ] Virtualização para listas >50

### Validação:
- [ ] `resetProfiler()` + nova análise
- [ ] Confirmar >50% melhoria
- [ ] Todos <16ms e 1-2 re-renders

---

## 🔗 Arquivos

### Ferramentas:
- `src/lib/performanceAnalyzer.ts`
- `src/components/PerformanceProfiler.tsx`
- `src/components/engineering/ProjectFormFields.tsx`
- `src/components/engineering/ProjectCard.tsx`

### Guias:
- `GUIA_IDENTIFICACAO_COMPONENTES_LENTOS.md`
- `COMO_IDENTIFICAR_COMPONENTES_LENTOS_CONSOLE.md`
- `GUIA_INTEGRACAO_PERFORMANCE_ANALYZER.md`
- `RESUMO_FERRAMENTAS_IDENTIFICACAO_COMPONENTES_LENTOS.md`

---

## 🎯 Fluxo Rápido

```
1. startProfiler()
2. Executar ação
3. stopProfiler()
4. Ver relatório
5. Aplicar otimizações
6. Validar com nova análise
7. Repetir até todos 🟢
```

---

## 💡 Dicas

### Performance:
- Menos é mais: não otimizar demais
- Medir antes de otimizar
- Focar no que importa (>16ms)
- Validar com usuários reais

### Código:
- Componentes pequenos e focados
- Props estáveis com useCallback
- Cálculos memoizados com useMemo
- Listas virtualizadas quando grande

### Experiência:
- Feedback visual durante loading
- Interface sempre responsiva
- Sem travamentos visíveis
- Transições suaves

---

## 🚀 Meta Final

```
✅ Todos os componentes <16ms
✅ 1-2 re-renders máximo
✅ Interface sempre fluida
✅ Experiência profissional
```

**Pronto para otimizar! 🎯**
