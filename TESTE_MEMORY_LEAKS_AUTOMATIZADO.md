# 🧪 Teste Automatizado de Memory Leaks

## Como Executar

Copie e cole este script no console do Chrome DevTools:

```javascript
/**
 * Script de Teste Automatizado de Memory Leaks
 * Execute no console do Chrome após iniciar o app
 */

async function testMemoryLeaks() {
  console.clear();
  console.log('🧪 INICIANDO TESTE DE MEMORY LEAKS\n');

  const results = {
    passed: [],
    failed: [],
    warnings: []
  };

  // Teste 1: Verificar se leak detector está ativo
  console.log('1️⃣ Verificando Leak Detector...');
  if (window.__leakDetector) {
    results.passed.push('✅ Leak Detector ativo');
    console.log('   ✅ Leak Detector ativo');
  } else {
    results.failed.push('❌ Leak Detector não encontrado (apenas funciona em DEV)');
    console.log('   ⚠️  Leak Detector não encontrado (normal em produção)');
  }

  // Teste 2: Contadores iniciais
  console.log('\n2️⃣ Contadores Iniciais...');
  const initial = window.__leakDetector?.getStats() || {
    intervals: 'N/A',
    timeouts: 'N/A',
    totalListeners: 'N/A'
  };

  console.log('   Intervals:', initial.intervals);
  console.log('   Timeouts:', initial.timeouts);
  console.log('   Listeners:', initial.totalListeners);

  // Teste 3: Simular navegação
  console.log('\n3️⃣ Simulando Navegação (aguarde 30s)...');

  // Esperar 30 segundos para simular uso
  await new Promise(resolve => setTimeout(resolve, 30000));

  // Teste 4: Contadores após uso
  console.log('\n4️⃣ Contadores Após 30s...');
  const after = window.__leakDetector?.getStats() || {
    intervals: 'N/A',
    timeouts: 'N/A',
    totalListeners: 'N/A'
  };

  console.log('   Intervals:', after.intervals);
  console.log('   Timeouts:', after.timeouts);
  console.log('   Listeners:', after.totalListeners);

  // Análise de crescimento
  if (typeof initial.intervals === 'number' && typeof after.intervals === 'number') {
    const intervalGrowth = after.intervals - initial.intervals;
    console.log('\n5️⃣ Análise de Crescimento:');
    console.log(`   Intervals: ${intervalGrowth > 0 ? '+' : ''}${intervalGrowth}`);

    if (intervalGrowth > 5) {
      results.failed.push(`❌ Intervals cresceram ${intervalGrowth} (limite: 5)`);
    } else if (intervalGrowth > 2) {
      results.warnings.push(`⚠️  Intervals cresceram ${intervalGrowth} (observar)`);
    } else {
      results.passed.push(`✅ Intervals estáveis (${intervalGrowth})`);
    }

    const listenerGrowth = after.totalListeners - initial.totalListeners;
    console.log(`   Listeners: ${listenerGrowth > 0 ? '+' : ''}${listenerGrowth}`);

    if (listenerGrowth > 10) {
      results.failed.push(`❌ Listeners cresceram ${listenerGrowth} (limite: 10)`);
    } else if (listenerGrowth > 5) {
      results.warnings.push(`⚠️  Listeners cresceram ${listenerGrowth} (observar)`);
    } else {
      results.passed.push(`✅ Listeners estáveis (${listenerGrowth})`);
    }
  }

  // Teste 6: Performance.memory (Chrome only)
  console.log('\n6️⃣ Uso de Memória:');
  if (performance.memory) {
    const mb = performance.memory.usedJSHeapSize / 1024 / 1024;
    console.log(`   JS Heap: ${mb.toFixed(1)}MB`);

    if (mb > 500) {
      results.warnings.push(`⚠️  Memória alta: ${mb.toFixed(1)}MB`);
    } else {
      results.passed.push(`✅ Memória normal: ${mb.toFixed(1)}MB`);
    }
  } else {
    console.log('   (performance.memory não disponível)');
  }

  // Relatório Final
  console.log('\n' + '='.repeat(50));
  console.log('📊 RELATÓRIO FINAL\n');

  if (results.passed.length > 0) {
    console.log('✅ PASSOU:');
    results.passed.forEach(msg => console.log(`   ${msg}`));
  }

  if (results.warnings.length > 0) {
    console.log('\n⚠️  AVISOS:');
    results.warnings.forEach(msg => console.log(`   ${msg}`));
  }

  if (results.failed.length > 0) {
    console.log('\n❌ FALHOU:');
    results.failed.forEach(msg => console.log(`   ${msg}`));
  }

  const totalTests = results.passed.length + results.warnings.length + results.failed.length;
  const score = ((results.passed.length / totalTests) * 100).toFixed(0);

  console.log('\n' + '='.repeat(50));
  console.log(`Score: ${score}% (${results.passed.length}/${totalTests} passou)`);

  if (results.failed.length === 0) {
    console.log('✅ TESTE APROVADO!');
  } else {
    console.log('❌ TESTE REPROVADO - Corrigir problemas identificados');
  }

  return results;
}

// Executar
console.log('Para executar o teste, digite: testMemoryLeaks()');
console.log('⚠️  O teste demora 30 segundos para completar.\n');

// Expor globalmente
window.testMemoryLeaks = testMemoryLeaks;
```

---

## Uso Simples

1. Abrir app em DEV: `npm run dev`
2. Abrir Chrome DevTools → Console
3. Colar o script acima
4. Executar: `testMemoryLeaks()`
5. Aguardar 30 segundos
6. Ver relatório

---

## Output Esperado

```
🧪 INICIANDO TESTE DE MEMORY LEAKS

1️⃣ Verificando Leak Detector...
   ✅ Leak Detector ativo

2️⃣ Contadores Iniciais...
   Intervals: 3
   Timeouts: 2
   Listeners: 15

3️⃣ Simulando Navegação (aguarde 30s)...

4️⃣ Contadores Após 30s...
   Intervals: 4
   Timeouts: 3
   Listeners: 16

5️⃣ Análise de Crescimento:
   Intervals: +1
   Listeners: +1

6️⃣ Uso de Memória:
   JS Heap: 85.3MB

==================================================
📊 RELATÓRIO FINAL

✅ PASSOU:
   ✅ Leak Detector ativo
   ✅ Intervals estáveis (+1)
   ✅ Listeners estáveis (+1)
   ✅ Memória normal: 85.3MB

==================================================
Score: 100% (4/4 passou)
✅ TESTE APROVADO!
```

---

## Interpretação dos Resultados

### ✅ Aprovado
- Intervals cresceram < 5
- Listeners cresceram < 10
- Memória < 500MB

### ⚠️ Atenção
- Intervals cresceram 3-5
- Listeners cresceram 6-10
- Memória 300-500MB
- Necessário observar

### ❌ Reprovado
- Intervals cresceram > 5
- Listeners cresceram > 10
- Memória > 500MB
- **Memory leak detectado!**

---

## Comandos Rápidos no Console

```javascript
// Ver stats atuais
__leakDetector.getStats()

// Executar teste completo
testMemoryLeaks()

// Verificar memória atual
if (performance.memory) {
  console.log((performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1) + 'MB')
}

// Limpar console
console.clear()
```

---

## Teste Manual Complementar

1. **Navegar Entre Abas**
   - Projetos → Clientes → Produção → Projetos
   - Repetir 10x
   - Verificar: `__leakDetector.getStats()`

2. **Abrir/Fechar Modais**
   - Abrir modal criar documento
   - Fechar
   - Repetir 20x
   - Verificar stats

3. **Criar Jobs IA**
   - Criar 3 documentos IA simultâneos
   - Aguardar polling por 2 minutos
   - Verificar se polling para após conclusão

4. **Hot Reload (DEV)**
   - Fazer mudança pequena no código
   - Salvar (hot reload)
   - Repetir 5x
   - Verificar se listeners não acumulam

---

**Use este script sempre que suspeitar de memory leaks!**
