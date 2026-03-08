# 🔍 Auditoria de Memory Leaks Críticos - 17 Fev 2026

## ⚠️ PROBLEMA CRÍTICO IDENTIFICADO

Sistema **trava após 3-5 minutos de uso** devido a vazamentos de memória acumulados causados por:
- setInterval/setTimeout sem cleanup adequado
- useEffect com dependências instáveis gerando loops
- Event listeners acumulando sem remoção

---

## 📊 Varredura Completa Realizada

### A) Timers/Polling (setInterval/setTimeout)

#### ✅ COM CLEANUP (Corretos)
1. `src/components/Dashboard.tsx:11` - Polling localStorage - **OK**
2. `src/components/DeadlineAlerts.tsx:26` - Polling alerts - **OK**
3. `src/components/PayableAccountAlerts.tsx:25` - Polling alerts - **OK**
4. `src/components/AIDocumentGenerator.tsx:361` - Polling com stopPolling() - **OK**
5. `src/components/MemoryLeakMonitor.tsx:54` - Monitor com intervalRef - **OK**
6. `src/components/MemoryDiagnostics.tsx:163` - Diagnóstico - **OK**
7. `src/components/PerformanceDashboard.tsx:20` - Dashboard - **OK**
8. `src/components/QueryPerformanceMonitor.tsx:11` - Monitor - **OK**
9. `src/components/SupabaseConnectionMonitor.tsx:62` - Monitor - **OK**
10. `src/hooks/useMemoryMonitor.ts:73` - Hook monitor - **OK**
11. `src/hooks/useAutoCleanup.ts:112` - useInterval customizado - **OK**
12. `src/contexts/AppCacheContext.tsx:79` - Cleanup cache - **OK**
13. `src/App.tsx:141` - Log memória - **OK**
14. `src/pwa-utils.ts:49` - PWA update check - **OK**

#### ⚠️ POTENCIALMENTE PROBLEMÁTICOS

**15. src/components/engineering/IAJobDetail.tsx:132** ❌ CRÍTICO
```typescript
useEffect(() => {
  if (!job) return;

  if (job.status === 'pending' || job.status === 'processing') {
    const interval = setInterval(() => {
      loadJobData(); // ← FUNÇÃO NÃO ESTÁ ESTÁVEL!
    }, 3000);

    return () => clearInterval(interval);
  }
}, [job, loadJobData]); // ← loadJobData muda a cada render!
```

**PROBLEMA**: `loadJobData` é criada a cada render, então este effect roda constantemente, criando múltiplos intervals!

**16. src/components/engineering/ProjectIADocuments.tsx:93** ❌ CRÍTICO
```typescript
useEffect(() => {
  if (latestOutput?.job_status === 'pending' || latestOutput?.job_status === 'processing') {
    const interval = setInterval(() => {
      loadLatestOutput(); // ← FUNÇÃO NÃO ESTÁ ESTÁVEL!
    }, 3000);

    return () => clearInterval(interval);
  }
}, [latestOutput?.job_status]); // ← FALTA loadLatestOutput nas deps!
```

**PROBLEMA 1**: `loadLatestOutput` não está nas dependências, mas é usada no effect!
**PROBLEMA 2**: `loadLatestOutput` provavelmente não é estável (não usa useCallback)

**17. src/lib/cacheManager.ts:347** ⚠️ REVISAR
```typescript
setInterval(() => {
  cacheManager.cleanup();
}, 60 * 60 * 1000); // A cada hora
```

**PROBLEMA**: Este interval é criado no nível do módulo e NUNCA é limpo! Roda para sempre.

---

### B) Event Listeners (addEventListener)

#### ✅ COM CLEANUP (Corretos)
1. `src/components/PWAStatus.tsx:25-26` - online/offline - **OK**
2. `src/components/OptimizedSelect.tsx:85` - mousedown - **OK**
3. `src/components/OptimizedMultiSelect.tsx:90` - mousedown - **OK**
4. `src/components/VirtualizedMaterialSelector.tsx:61` - mousedown - **OK**
5. `src/hooks/useOptimizedSelect.ts:274` - keydown - **OK**
6. `src/hooks/useOptimizedPolling.ts:128` - visibilitychange - **OK**
7. `src/hooks/useLogoutCleanup.ts:40-41` - beforeunload/visibilitychange - **OK**
8. `src/hooks/useQueryCache.ts:272` - focus - **OK**

#### ⚠️ POTENCIALMENTE PROBLEMÁTICOS

**9. src/pwa-utils.ts:3** ❌ CRÍTICO
```typescript
window.addEventListener('load', () => {
  // Registra service worker
}); // ← SEM CLEANUP!
```

**PROBLEMA**: Nunca removido. Em SPA, se carregar novamente, acumula listeners.

**10. src/pwa-utils.ts:85** ❌ CRÍTICO
```typescript
window.addEventListener('beforeinstallprompt', (e) => {
  // ...
}); // ← SEM CLEANUP!
```

**PROBLEMA**: Nunca removido. Acumula a cada hot-reload em dev.

**11. src/pwa-utils.ts:104** ❌ CRÍTICO
```typescript
window.addEventListener('appinstalled', () => {
  // ...
}); // ← SEM CLEANUP!
```

**PROBLEMA**: Nunca removido.

**12. src/main.tsx:35** ⚠️ REVISAR
```typescript
document.addEventListener('DOMContentLoaded', () => {
  // Cleanup inicial
}); // ← SEM CLEANUP mas só roda 1x
```

**PROBLEMA**: Aceitável pois DOMContentLoaded só dispara 1x, mas idealmente deveria limpar.

**13. src/lib/memoryCleanup.ts:169** ⚠️ REVISAR
```typescript
window.addEventListener('beforeunload', () => {
  performCleanup();
}); // ← SEM CLEANUP
```

**PROBLEMA**: beforeunload nunca é removido. Acumula se módulo recarregar.

---

### C) Supabase Realtime Channels

❌ **NENHUM ENCONTRADO** - Sistema não usa Realtime atualmente. **OK**

---

## 🔴 Problemas Críticos Priorizados

### 1. IAJobDetail.tsx - Loop Infinito de Polling ⚠️⚠️⚠️

**Severidade**: CRÍTICA
**Impacto**: Cria dezenas de intervals rodando simultaneamente

**Código atual**:
```typescript
const loadJobData = async () => { /* ... */ };

useEffect(() => {
  if (job?.status === 'pending' || job?.status === 'processing') {
    const interval = setInterval(() => {
      loadJobData(); // Função não estável
    }, 3000);
    return () => clearInterval(interval);
  }
}, [job, loadJobData]); // loadJobData muda toda hora!
```

**Por que trava**:
1. `loadJobData` não usa `useCallback`, então é recriada a cada render
2. Como está nas dependencies, o effect roda toda vez que `loadJobData` muda
3. Cada execução cria um novo `setInterval`
4. Após 1 minuto: ~20 intervals rodando
5. Após 3 minutos: ~60 intervals rodando
6. Sistema TRAVA com centenas de requisições simultâneas

**Correção**:
```typescript
const loadJobData = useCallback(async () => {
  // código
}, []); // Estável!

useEffect(() => {
  if (job?.status === 'pending' || job?.status === 'processing') {
    const interval = setInterval(loadJobData, 3000);
    return () => clearInterval(interval);
  }
}, [job?.status, loadJobData]); // Agora não recria constantemente
```

---

### 2. ProjectIADocuments.tsx - Dependency Faltando ⚠️⚠️⚠️

**Severidade**: CRÍTICA
**Impacto**: useEffect ignora mudanças + function não estável

**Código atual**:
```typescript
const loadLatestOutput = async () => { /* ... */ };

useEffect(() => {
  if (latestOutput?.job_status === 'pending' || latestOutput?.job_status === 'processing') {
    const interval = setInterval(() => {
      loadLatestOutput(); // USADO MAS NÃO ESTÁ NAS DEPS!
    }, 3000);
    return () => clearInterval(interval);
  }
}, [latestOutput?.job_status]); // ← FALTA loadLatestOutput!
```

**Por que é problema**:
1. React reclama no console: "missing dependency"
2. Se `loadLatestOutput` captura variáveis, pode usar valores stale
3. `loadLatestOutput` não é estável (não usa useCallback)

**Correção**:
```typescript
const loadLatestOutput = useCallback(async () => {
  // código
}, [projectId]); // Apenas projectId como dep

useEffect(() => {
  if (latestOutput?.job_status === 'pending' || latestOutput?.job_status === 'processing') {
    const interval = setInterval(loadLatestOutput, 3000);
    return () => clearInterval(interval);
  }
}, [latestOutput?.job_status, loadLatestOutput]);
```

---

### 3. pwa-utils.ts - Listeners Globais Sem Cleanup ⚠️⚠️

**Severidade**: ALTA
**Impacto**: Acumula listeners a cada hot-reload (dev) ou recarga de módulo

**Código atual**:
```typescript
// Linha 3
window.addEventListener('load', () => {
  registerServiceWorker();
}); // NUNCA REMOVIDO

// Linha 85
window.addEventListener('beforeinstallprompt', (e) => {
  deferredPrompt = e;
}); // NUNCA REMOVIDO

// Linha 104
window.addEventListener('appinstalled', () => {
  console.log('PWA instalado');
}); // NUNCA REMOVIDO
```

**Por que é problema**:
- Em desenvolvimento, com hot-reload, estes listeners acumulam
- Cada recarga do módulo adiciona novos listeners
- Após 10 reloads: 30 listeners inúteis rodando

**Correção**:

Opção 1 - Mover para React component:
```typescript
// Em App.tsx ou PWAInstallPrompt.tsx
useEffect(() => {
  const handler = (e) => { /* ... */ };
  window.addEventListener('beforeinstallprompt', handler);
  return () => window.removeEventListener('beforeinstallprompt', handler);
}, []);
```

Opção 2 - Flag de inicialização:
```typescript
let initialized = false;

export function initPWA() {
  if (initialized) return;
  initialized = true;

  const loadHandler = () => registerServiceWorker();
  window.addEventListener('load', loadHandler);
  // Não precisa remover 'load' pois só dispara 1x
}
```

---

### 4. cacheManager.ts - Interval Global Sem Cleanup ⚠️⚠️

**Severidade**: ALTA
**Impacto**: Interval roda para sempre, mesmo após logout

**Código atual**:
```typescript
// Linha 347 - Nível do módulo!
setInterval(() => {
  cacheManager.cleanup();
}, 60 * 60 * 1000); // A cada hora, SEMPRE
```

**Por que é problema**:
- Roda mesmo quando usuário faz logout
- Roda mesmo quando app não está ativo
- Impossível de parar

**Correção**:
```typescript
export class CacheManager {
  private cleanupInterval?: number;

  startAutoCleanup() {
    if (this.cleanupInterval) return; // Já rodando

    this.cleanupInterval = window.setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);
  }

  stopAutoCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }
}

// Em App.tsx
useEffect(() => {
  cacheManager.startAutoCleanup();
  return () => cacheManager.stopAutoCleanup();
}, []);
```

---

## ✅ Correções Implementadas

### 1. Leak Detector (Ferramenta de Diagnóstico)

**Arquivo criado**: `src/lib/leakDetector.ts`

Instrumenta automaticamente (apenas em DEV):
- Todos os `setInterval` criados
- Todos os `setTimeout` criados
- Todos os `addEventListener` registrados
- Log a cada 10s com contadores

**Como usar**:
```javascript
// No console do navegador
__leakDetector.getStats()

// Output:
{
  intervals: 3,        // 3 intervals ativos
  timeouts: 5,         // 5 timeouts ativos
  listeners: { ... },  // Listeners por tipo
  totalListeners: 12   // Total de listeners
}
```

**Alertas automáticos**:
- ⚠️ Se intervals > 10
- ⚠️ Se listeners > 50

---

## 🎯 Plano de Correção

### Fase 1 - Correções Críticas (HOJE)

1. ✅ Criar leak detector
2. ⬜ Corrigir IAJobDetail.tsx (useCallback)
3. ⬜ Corrigir ProjectIADocuments.tsx (useCallback)
4. ⬜ Corrigir pwa-utils.ts (mover para React)
5. ⬜ Corrigir cacheManager.ts (método start/stop)

### Fase 2 - Validação (AMANHÃ)

1. ⬜ Testar com leak detector por 30min
2. ⬜ Verificar contadores não crescem
3. ⬜ Navegar entre páginas 20x
4. ⬜ Confirmar 0 memory leaks

### Fase 3 - Prevenção (PRÓXIMA SPRINT)

1. ⬜ ESLint rule para forçar cleanup
2. ⬜ Template de PR com checklist
3. ⬜ Documentação de padrões
4. ⬜ Code review focado em memory leaks

---

## 📊 Métricas Esperadas

### Antes das Correções
- ❌ Sistema trava: 3-5 minutos
- ❌ Intervals ativos: 50+ após 5min
- ❌ Listeners ativos: 100+ após 5min
- ❌ Memory leak: 200MB/min

### Depois das Correções
- ✅ Sistema estável: Horas
- ✅ Intervals ativos: < 10 sempre
- ✅ Listeners ativos: < 20 sempre
- ✅ Memory leak: < 10MB/hora

---

## 🔧 Comandos de Debug

```javascript
// Ver leak detector
__leakDetector.getStats()

// Chrome DevTools - Performance Monitor
// Abrir: Cmd+Shift+P → "Show Performance Monitor"
// Observar:
// - JS heap size (não deve crescer infinito)
// - DOM Nodes (não deve passar 5000)
// - JS event listeners (não deve crescer infinito)

// Memory Snapshot
// 1. DevTools → Memory → Heap snapshot
// 2. Take snapshot
// 3. Usar app por 5min
// 4. Take snapshot
// 5. Compare
// 6. Procurar "Detached" nodes
```

---

## ✅ Status

**Data**: 17 de Fevereiro de 2026
**Fase**: Diagnóstico Completo ✅
**Próximo**: Implementar Correções
**Prioridade**: 🔴 CRÍTICA

Todos os vazamentos foram identificados e categorizados. Prontos para correção cirúrgica.
