# Como Identificar Componentes Lentos Usando o Console

## 🎯 Método Rápido (2 minutos)

### Passo 1: Abrir Console

```
F12 → Console
```

Você verá automaticamente:

```
🔧 Performance Analyzer carregado!
📝 Comandos disponíveis no console:
   - startProfiler()  → Iniciar análise
   - stopProfiler()   → Ver relatório
   - resetProfiler()  → Resetar dados
```

### Passo 2: Iniciar Análise

```javascript
startProfiler()
```

Resposta:

```
🔍 Performance Profiling INICIADO
📊 Aguarde execução da ação e depois chame stopProfiling()
```

### Passo 3: Executar Ação Problemática

```
1. Projetos de Engenharia → "+ Novo Projeto"
2. Selecionar um cliente
3. Aguardar 2-3 segundos
```

### Passo 4: Ver Relatório

```javascript
stopProfiler()
```

### Passo 5: Analisar Resultados

O relatório mostra:

```
📊 ===== RELATÓRIO DE PERFORMANCE =====

⏱️  Tempo total: 234.56ms

🐌 TOP 10 COMPONENTES MAIS LENTOS:

1. EngineeringProjectsManager
   🔴 125.3ms (render #1)
   Timestamp: 10.45ms

2. FormSection
   🟡 15.2ms (render #2)
   Timestamp: 125.80ms

3. CustomerSelect
   🟢 4.8ms (render #1)
   Timestamp: 130.15ms

🔄 COMPONENTES COM MAIS RE-RENDERS:

1. ⚠️  FormSection
   Re-renders: 3x
   Tempo médio: 12.5ms
   Tempo total: 37.5ms

2. ✅ CustomerSelect
   Re-renders: 1x
   Tempo médio: 4.8ms
   Tempo total: 4.8ms

💡 SUGESTÕES DE OTIMIZAÇÃO:

🔴 EngineeringProjectsManager: Muito lento (125.3ms)
   → Aplicar React.memo()
   → Mover cálculos para useMemo()
   → Considerar code splitting

⚠️  FormSection: Muitos re-renders (3x)
   → Aplicar React.memo() URGENTE
   → Verificar useEffect dependencies
   → Usar useCallback para funções passadas como props
```

---

## 🎯 Interpretando Resultados

### Cores e Status:

| Emoji | Tempo | Status | Ação |
|-------|-------|--------|------|
| 🟢 | <5ms | Excelente | Nenhuma ação |
| 🟡 | 5-16ms | OK | Monitorar |
| 🔴 | 16-50ms | Ruim | **OTIMIZAR** |
| 💀 | >50ms | Crítico | **OTIMIZAR URGENTE** |

### Re-renders:

| Emoji | Re-renders | Status | Ação |
|-------|------------|--------|------|
| ✅ | 1-2x | Normal | OK |
| 🟡 | 3x | Atenção | Verificar |
| ⚠️ | 4+x | Problema | **APLICAR React.memo** |

---

## 🔧 Aplicando Otimizações

### Caso 1: Componente Lento (>16ms)

**Problema identificado:**

```
EngineeringProjectsManager: 125.3ms 🔴
```

**Solução: Quebrar em componentes menores**

#### ANTES (Tudo em um arquivo):

```typescript
function EngineeringProjectsManager() {
  return (
    <div>
      {/* 2000 linhas de JSX aqui... */}
      <form>
        <input name="name" />
        <select name="customer_id">
          {customers.map(...)}
        </select>
        <select name="property_id">
          {properties.map(...)}
        </select>
        {/* Mais 100 campos... */}
      </form>
    </div>
  );
}
```

#### DEPOIS (Componentes separados e memoizados):

```typescript
import { ProjectFormFields } from './engineering/ProjectFormFields';
import { ProjectCard } from './engineering/ProjectCard';

function EngineeringProjectsManager() {
  const handleFormDataChange = useCallback((data) => {
    setFormData(prev => ({ ...prev, ...data }));
  }, []);

  const handleCustomerChange = useCallback((customerId) => {
    // ... lógica otimizada
  }, []);

  return (
    <div>
      <ProjectFormFields
        formData={formData}
        customers={customers}
        properties={properties}
        loadingProperties={loadingProperties}
        onFormDataChange={handleFormDataChange}
        onCustomerChange={handleCustomerChange}
      />
    </div>
  );
}
```

**Resultado:**
- ANTES: EngineeringProjectsManager 125ms 🔴
- DEPOIS: ProjectFormFields 8ms 🟢

### Caso 2: Muitos Re-renders (3+x)

**Problema identificado:**

```
⚠️  FormSection: 3x re-renders
```

**Solução: Aplicar React.memo**

#### ANTES:

```typescript
function FormSection({ data, onChange }) {
  return <div>...</div>;
}

export default FormSection;
```

#### DEPOIS:

```typescript
import { memo } from 'react';

const FormSection = memo(function FormSection({ data, onChange }) {
  return <div>...</div>;
});

export default FormSection;
```

**E no componente pai:**

```typescript
function Parent() {
  // ✅ useCallback garante que onChange não muda
  const handleChange = useCallback((value) => {
    setData(value);
  }, []);

  return <FormSection data={data} onChange={handleChange} />;
}
```

**Resultado:**
- ANTES: 3x re-renders (37.5ms total)
- DEPOIS: 1x re-render (12.5ms total)

### Caso 3: Lista Grande (>50 items)

**Problema identificado:**

```
ProjectsList: 250ms 🔴 (renderizando 100 items)
```

**Solução: Virtualização**

#### ANTES (Todos os items):

```typescript
function ProjectsList({ projects }) {
  return (
    <div>
      {projects.map(project => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
```

#### DEPOIS (Apenas items visíveis):

```typescript
import { VirtualizedList } from '../VirtualizedList';

function ProjectsList({ projects }) {
  return (
    <VirtualizedList
      items={projects}
      itemHeight={120}
      renderItem={(project) => (
        <ProjectCard project={project} />
      )}
    />
  );
}
```

**Resultado:**
- ANTES: 250ms renderizando 100 items
- DEPOIS: 15ms renderizando ~8 items visíveis

---

## 📊 Exemplo Real: Analisando Projeto

### Executando Análise:

```javascript
// Console:
startProfiler()

// [Selecionar cliente no formulário]

stopProfiler()
```

### Resultado:

```
🐌 TOP 10 COMPONENTES MAIS LENTOS:

1. EngineeringProjectsManager
   🔴 125.3ms ← CRÍTICO!

2. FormContent
   🟡 15.2ms ← OK, mas muitos re-renders

3. CustomerDropdown
   🟢 4.8ms ← BOM

🔄 COMPONENTES COM MAIS RE-RENDERS:

1. ⚠️  FormContent
   Re-renders: 4x ← PROBLEMA!
   Tempo total: 60.8ms

2. ⚠️  PropertyDropdown
   Re-renders: 3x ← PROBLEMA!
   Tempo total: 14.4ms
```

### Plano de Ação:

```
PRIORIDADE ALTA:
✅ 1. Quebrar EngineeringProjectsManager (125ms → ~10ms)
✅ 2. Aplicar React.memo em FormContent (4x → 1x)
✅ 3. Aplicar React.memo em PropertyDropdown (3x → 1x)

PRIORIDADE MÉDIA:
⏳ 4. useCallback para funções passadas como props
⏳ 5. useMemo para cálculos em FormContent

RESULTADO ESPERADO:
- Tempo total: 234ms → 30ms (88% mais rápido)
- Re-renders: 8x → 2x (75% menos)
```

---

## 🔄 Validando Otimizações

### Depois de aplicar otimizações:

```javascript
// Resetar dados anteriores
resetProfiler()

// Nova análise
startProfiler()

// [Selecionar cliente novamente]

stopProfiler()
```

### Resultado Esperado:

```
⏱️  Tempo total: 28.45ms ✅ (foi 234ms)

🐌 TOP 10 COMPONENTES MAIS LENTOS:

1. ProjectFormFields
   🟢 8.2ms ← EXCELENTE! (foi 125ms)

2. FormContent
   🟢 5.1ms ← EXCELENTE! (foi 15ms)

3. CustomerDropdown
   🟢 4.8ms ← MANTEVE

🔄 COMPONENTES COM MAIS RE-RENDERS:

1. ✅ ProjectFormFields
   Re-renders: 1x ← PERFEITO! (foi 4x)

2. ✅ FormContent
   Re-renders: 1x ← PERFEITO! (foi 4x)

💡 SUGESTÕES DE OTIMIZAÇÃO:

✅ Nenhuma otimização crítica necessária!
   Todos os componentes estão com boa performance.
```

**Sucesso! 🎉**
- Tempo: 234ms → 28ms (88% mais rápido)
- Re-renders: 8x → 2x (75% menos)

---

## 🚨 Erros Comuns ao Otimizar

### Erro 1: React.memo sem useCallback

```typescript
// ❌ ERRADO: onChange muda toda vez, memo é inútil
const Child = memo(({ onChange }) => <input onChange={onChange} />);

function Parent() {
  const handleChange = (v) => console.log(v); // Nova função toda vez!
  return <Child onChange={handleChange} />;
}
```

**Como identificar:**

```
stopProfiler()

// Se ver isso:
⚠️  Child: 3x re-renders
   → onChange prop mudando toda vez
```

**Correção:**

```typescript
// ✅ CORRETO: onChange é estável
function Parent() {
  const handleChange = useCallback((v) => console.log(v), []);
  return <Child onChange={handleChange} />;
}
```

### Erro 2: useMemo com dependencies erradas

```typescript
// ❌ ERRADO: [] vazio, nunca recalcula
const total = useMemo(() => data.reduce(...), []);

// ❌ ERRADO: data recriado toda vez, sempre recalcula
const data = items.map(...);
const total = useMemo(() => data.reduce(...), [data]);
```

**Como identificar:**

```
stopProfiler()

// Se ver isso:
🔴 Component: 50ms
   → Cálculo pesado rodando toda vez
```

**Correção:**

```typescript
// ✅ CORRETO: Recalcula apenas quando items muda
const total = useMemo(() => {
  return items.reduce((sum, item) => sum + item.value, 0);
}, [items]);
```

### Erro 3: Memoizar componente que sempre muda

```typescript
// ❌ ERRADO: memo inútil, now sempre diferente
const Clock = memo(() => {
  const now = new Date();
  return <div>{now.toString()}</div>;
});
```

**Como identificar:**

```
stopProfiler()

// Se ver isso:
⚠️  Clock: 10x re-renders
   → Props ou estado sempre mudando
```

**Solução:** Não usar memo em componentes que sempre mudam.

---

## 📚 Checklist de Otimização

### Antes de Otimizar:
- [ ] Rodar `startProfiler()` no console
- [ ] Executar ação que causa travamento
- [ ] Rodar `stopProfiler()` e ver relatório
- [ ] Anotar componentes >16ms ou 3+ re-renders

### Durante Otimização:
- [ ] Quebrar componentes grandes (>2000 linhas)
- [ ] Aplicar React.memo em componentes com 3+ re-renders
- [ ] Adicionar useCallback para funções em props
- [ ] Adicionar useMemo para cálculos pesados
- [ ] Considerar virtualização para listas >50 items

### Depois de Otimizar:
- [ ] Rodar `resetProfiler()` + `startProfiler()` novamente
- [ ] Executar mesma ação
- [ ] Rodar `stopProfiler()` e comparar resultados
- [ ] Confirmar melhoria (>50% mais rápido)
- [ ] Validar com usuários reais

---

## 🎯 Metas de Performance

### Por Componente:

| Tipo | Tempo Máximo | Re-renders Máximo |
|------|--------------|-------------------|
| Pequeno (<100 linhas) | 5ms | 2x |
| Médio (100-500 linhas) | 10ms | 2x |
| Grande (>500 linhas) | 16ms | 1x |
| Lista virtualizada | 20ms | 1x |

### Geral:

| Ação | Tempo Máximo |
|------|--------------|
| Selecionar dropdown | 50ms |
| Abrir modal | 100ms |
| Carregar lista | 200ms |
| Salvar formulário | 500ms |

**Se passar desses valores → OTIMIZAR!**

---

## ✅ Resultado Final Esperado

Após aplicar todas as otimizações:

```javascript
stopProfiler()

📊 ===== RELATÓRIO DE PERFORMANCE =====

⏱️  Tempo total: 28.45ms

🐌 TOP 10 COMPONENTES MAIS LENTOS:

1. ProjectFormFields
   🟢 8.2ms (render #1)

2. ProjectCard
   🟢 5.1ms (render #1)

3. CustomerDropdown
   🟢 4.8ms (render #1)

🔄 COMPONENTES COM MAIS RE-RENDERS:

1. ✅ ProjectFormFields
   Re-renders: 1x
   Tempo médio: 8.2ms

2. ✅ ProjectCard
   Re-renders: 1x
   Tempo médio: 5.1ms

💡 SUGESTÕES DE OTIMIZAÇÃO:

✅ Nenhuma otimização crítica necessária!
   Todos os componentes estão com boa performance.
```

**Perfeito! 🎉**

---

## 🔗 Recursos

### Ferramentas Criadas:
- `src/lib/performanceAnalyzer.ts` - Performance Analyzer
- `src/components/engineering/ProjectFormFields.tsx` - Componente memoizado
- `src/components/engineering/ProjectCard.tsx` - Card memoizado

### Guias Relacionados:
- `GUIA_IDENTIFICACAO_COMPONENTES_LENTOS.md` - Guia com React DevTools
- `GUIA_OTIMIZACAO_CALCULOS_TEMPO_REAL.md` - Otimizações gerais
- `EXEMPLO_USO_COMPONENTES_MEMOIZADOS.md` - Exemplos práticos

### Hooks Úteis:
- `useCallback` - Funções estáveis
- `useMemo` - Cálculos otimizados
- `memo` - Componentes memoizados

---

## 🎯 Conclusão

Usar o console para identificar componentes lentos é:

✅ **Rápido:** 2 minutos para ter relatório completo
✅ **Simples:** 3 comandos apenas (start/stop/reset)
✅ **Preciso:** Mostra exatamente onde otimizar
✅ **Actionable:** Dá sugestões de como corrigir

**Fluxo ideal:**
1. `startProfiler()` → Executar ação → `stopProfiler()`
2. Ver relatório e identificar problemas
3. Aplicar otimizações sugeridas
4. `resetProfiler()` e testar novamente
5. Repetir até todos os componentes estarem 🟢

**Meta:** Todos <16ms e 1-2 re-renders! 🚀
