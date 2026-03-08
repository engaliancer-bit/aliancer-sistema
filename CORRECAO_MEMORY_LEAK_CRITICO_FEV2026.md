# Correção Memory Leak Crítico - Fevereiro 2026

## Data: 02/02/2026
## Problema: JS Heap sobe 40MB em 3 minutos
## Status: 🔧 EM CORREÇÃO

---

## 🚨 SITUAÇÃO CRÍTICA

**Sintoma:** JS Heap Memory cresce 40MB em 3 minutos e não estabiliza

**Meta:**
- ✅ Heap deve estabilizar em 50-70MB
- ✅ Taxa de crescimento < 3MB/minuto
- ✅ Cleanup 100% implementado

---

## 🔍 DIAGNÓSTICO RÁPIDO

### Passo 1: Identificar Componentes Problemáticos

Execute no Chrome DevTools Console:

```javascript
// 1. Take Heap Snapshot inicial
// DevTools > Memory > Take snapshot

// 2. Use sistema por 1 minuto

// 3. Take Heap Snapshot final

// 4. Compare (Comparison view)
// Procure por objetos com "+" (retained size alto)
```

### Passo 2: Componentes Mais Suspeitos

Baseado no código auditado, estes são os componentes CRÍTICOS para verificar:

**🔴 PRIORIDADE MÁXIMA:**
1. Dashboard.tsx - Usa setInterval para atualizar métricas
2. DeadlineAlerts.tsx - Polling de alertas
3. PayableAccountAlerts.tsx - Polling de contas
4. PerformanceDashboard.tsx - Metrics polling

**🟡 PRIORIDADE ALTA:**
5. SupabaseConnectionMonitor.tsx - Monitoring connection
6. QueryPerformanceMonitor.tsx - Performance tracking
7. OptimizedSelect components - Event listeners em dropdowns
8. Listas grandes (Materials, Customers, Quotes, etc)

---

## ✅ CORREÇÕES OBRIGATÓRIAS

### CORREÇÃO 1: Dashboard.tsx

**Verificar:**
```tsx
// ❌ SE ESTIVER ASSIM:
useEffect(() => {
  setInterval(() => {
    fetchMetrics();
  }, 5000);
}, []);
```

**Corrigir para:**
```tsx
// ✅ DEVE ESTAR ASSIM:
useEffect(() => {
  const interval = setInterval(() => {
    fetchMetrics();
  }, 5000);

  return () => clearInterval(interval);
}, []);
```

### CORREÇÃO 2: DeadlineAlerts.tsx

**Verificar:**
```tsx
// ❌ SE ESTIVER ASSIM:
useEffect(() => {
  const checkDeadlines = setInterval(() => {
    loadDeadlines();
  }, 30000);
}, []);
```

**Corrigir para:**
```tsx
// ✅ DEVE ESTAR ASSIM:
useEffect(() => {
  const checkDeadlines = setInterval(() => {
    loadDeadlines();
  }, 30000);

  return () => clearInterval(checkDeadlines);
}, []);
```

### CORREÇÃO 3: Event Listeners Globais

**Padrão Universal:**
```tsx
useEffect(() => {
  const handler = (e: Event) => {
    // Handler logic
  };

  // Adicionar listener
  window.addEventListener('resize', handler);
  document.addEventListener('click', handler);

  // ✅ CLEANUP OBRIGATÓRIO
  return () => {
    window.removeEventListener('resize', handler);
    document.removeEventListener('click', handler);
  };
}, []);
```

### CORREÇÃO 4: AbortController para Fetches

**Adicionar em todos componentes com fetch/supabase queries:**
```tsx
useEffect(() => {
  const abortController = new AbortController();

  async function loadData() {
    try {
      const { data, error } = await supabase
        .from('table')
        .select('*')
        .abortSignal(abortController.signal);

      if (error) throw error;
      setData(data);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(err);
      }
    }
  }

  loadData();

  // ✅ CANCELAR REQUEST AO DESMONTAR
  return () => {
    abortController.abort();
  };
}, []);
```

---

## 🎯 PLANO DE AÇÃO IMEDIATO

### Fase 1: Monitoramento (10 min)

1. **Adicionar MemoryLeakMonitor ao App.tsx:**

```tsx
// src/App.tsx
import MemoryLeakMonitor from './components/MemoryLeakMonitor';

function App() {
  return (
    <>
      {/* Seu app aqui */}

      {/* Monitor de Memory Leak (apenas development) */}
      {process.env.NODE_ENV === 'development' && <MemoryLeakMonitor />}
    </>
  );
}
```

2. **Rodar aplicação e observar:**
   - Abrir app
   - Usar por 3 minutos
   - Verificar se aparece alerta vermelho de leak
   - Anotar taxa de crescimento (MB/min)

### Fase 2: Correção Dashboard (15 min)

1. Abrir `src/components/Dashboard.tsx`
2. Procurar por `setInterval` e `setTimeout`
3. Adicionar cleanup em todos
4. Testar componente isolado

### Fase 3: Correção Alerts (15 min)

1. `DeadlineAlerts.tsx` - Adicionar cleanup
2. `PayableAccountAlerts.tsx` - Adicionar cleanup
3. `StockAlerts.tsx` - Adicionar cleanup (se existir)

### Fase 4: Correção Monitors (15 min)

1. `SupabaseConnectionMonitor.tsx` - Verificar cleanup
2. `QueryPerformanceMonitor.tsx` - Verificar cleanup
3. `PerformanceDashboard.tsx` - Verificar cleanup

### Fase 5: Validação (10 min)

1. Rodar app com MemoryLeakMonitor
2. Usar sistema por 5 minutos
3. Verificar:
   - Taxa de crescimento < 3MB/min
   - Memória estabiliza em 50-70MB
   - Nenhum alerta vermelho

---

## 🧪 SCRIPT DE TESTE AUTOMATIZADO

Cole no Console do Chrome:

```javascript
// ============================================================
// TESTE RÁPIDO DE MEMORY LEAK (3 MINUTOS)
// ============================================================

class QuickLeakTest {
  async run() {
    console.log('🧪 TESTE DE MEMORY LEAK - 3 MINUTOS\n');
    console.log('⚠️  NÃO FECHE ESTE CONSOLE!\n');

    if (!performance.memory) {
      console.error('❌ performance.memory não disponível');
      console.log('Inicie Chrome com: --enable-precise-memory-info');
      return;
    }

    const snapshots = [];
    const startTime = Date.now();

    // Snapshot a cada 20 segundos por 3 minutos
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;

      if (elapsed >= 180) {
        clearInterval(interval);
        this.analyze(snapshots);
        return;
      }

      const snapshot = {
        time: Math.floor(elapsed),
        mb: Math.round(performance.memory.usedJSHeapSize / 1048576),
      };

      snapshots.push(snapshot);
      console.log(`[${snapshot.time}s] ${snapshot.mb}MB`);
    }, 20000);

    // Snapshot inicial
    const initial = {
      time: 0,
      mb: Math.round(performance.memory.usedJSHeapSize / 1048576),
    };
    snapshots.push(initial);
    console.log(`[0s] ${initial.mb}MB (inicial)`);

    console.log('\n⏳ Teste em andamento...');
    console.log('💡 Use o sistema normalmente\n');
  }

  analyze(snapshots) {
    console.log('\n' + '═'.repeat(50));
    console.log('📊 RESULTADO DO TESTE');
    console.log('═'.repeat(50) + '\n');

    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];

    const growth = last.mb - first.mb;
    const timeMinutes = last.time / 60;
    const growthRate = growth / timeMinutes;

    console.log(`⏱️  Duração: ${timeMinutes.toFixed(1)} minutos`);
    console.log(`📈 Memória inicial: ${first.mb}MB`);
    console.log(`📈 Memória final: ${last.mb}MB`);
    console.log(`📈 Crescimento: ${growth > 0 ? '+' : ''}${growth}MB`);
    console.log(`📈 Taxa: ${growthRate > 0 ? '+' : ''}${growthRate.toFixed(2)}MB/min\n`);

    console.log('═'.repeat(50) + '\n');

    // Veredicto
    if (growthRate > 10) {
      console.error('🔴 MEMORY LEAK CRÍTICO!');
      console.error(`   Taxa: ${growthRate.toFixed(2)}MB/min (>10MB/min)`);
      console.log('\n❌ FALHOU - Correção urgente necessária\n');
    } else if (growthRate > 3) {
      console.warn('🟡 Possível memory leak');
      console.warn(`   Taxa: ${growthRate.toFixed(2)}MB/min (>3MB/min)`);
      console.log('\n⚠️  ATENÇÃO - Investigar componentes\n');
    } else {
      console.log('✅ PASSOU - Memória estável!');
      console.log(`   Taxa: ${growthRate.toFixed(2)}MB/min (<3MB/min)`);
      console.log('\n🎉 Sistema saudável\n');
    }

    console.log('═'.repeat(50));

    // Gráfico ASCII
    console.log('\n📊 Evolução da Memória:\n');

    const max = Math.max(...snapshots.map(s => s.mb));
    snapshots.forEach(s => {
      const bars = Math.round((s.mb / max) * 30);
      const bar = '█'.repeat(bars);
      console.log(`${String(s.time).padStart(3)}s │${bar} ${s.mb}MB`);
    });

    console.log('\n═'.repeat(50));
  }
}

window.quickTest = new QuickLeakTest();
console.log('✅ Teste carregado!');
console.log('\n📝 EXECUTAR: quickTest.run()\n');
```

**Uso:**
```javascript
quickTest.run(); // Aguardar 3 minutos
```

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

### Antes de Commitar

- [ ] MemoryLeakMonitor adicionado ao App.tsx
- [ ] Todos setInterval têm clearInterval
- [ ] Todos setTimeout têm clearTimeout
- [ ] Todos addEventListener têm removeEventListener
- [ ] Todos useEffect com timers têm cleanup
- [ ] AbortController em requests async
- [ ] Teste de 3 minutos passou (< 3MB/min)
- [ ] Nenhum alerta vermelho no monitor
- [ ] Build passou sem erros

### Validação Final

- [ ] Rodar `npm run build`
- [ ] Testar em produção (preview)
- [ ] Monitorar por 5 minutos
- [ ] Verificar taxa de crescimento
- [ ] Confirmar estabilização

---

## 🎯 EXEMPLO COMPLETO DE COMPONENTE CORRETO

```tsx
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function CorrectComponent() {
  const [data, setData] = useState([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // ✅ AbortController para fetch
    abortControllerRef.current = new AbortController();

    async function loadData() {
      try {
        const { data, error } = await supabase
          .from('table')
          .select('*')
          .abortSignal(abortControllerRef.current!.signal);

        if (error) throw error;
        setData(data || []);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Error loading data:', err);
        }
      }
    }

    // Carregar inicial
    loadData();

    // ✅ Polling com cleanup
    intervalRef.current = setInterval(() => {
      loadData();
    }, 30000);

    // ✅ CLEANUP OBRIGATÓRIO
    return () => {
      // Limpar interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // Cancelar requests pendentes
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []); // Empty deps - só monta/desmonta

  useEffect(() => {
    // ✅ Event listener com cleanup
    const handleResize = () => {
      console.log('Window resized');
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div>
      {/* Render data */}
    </div>
  );
}
```

---

## 📞 SUPORTE

Se após implementar todas as correções o leak persistir:

1. **Chrome DevTools:**
   - Memory > Take Heap Snapshot (antes)
   - Usar sistema 2 minutos
   - Take Heap Snapshot (depois)
   - Compare > Procurar objetos crescendo

2. **React DevTools Profiler:**
   - Identificar componentes re-renderizando excessivamente
   - Verificar memoization

3. **Console Logs:**
   - Verificar logs de erro não tratados
   - Procurar warnings de React

---

**PRÓXIMO PASSO: Adicionar MemoryLeakMonitor ao App.tsx e começar auditoria dos componentes listados**
