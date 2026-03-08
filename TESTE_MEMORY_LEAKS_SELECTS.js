// ============================================================
// SCRIPT DE TESTE - MEMORY LEAKS EM SELECTS/AUTOCOMPLETE
// Cole no Console do Chrome DevTools (F12)
// ============================================================

class SelectMemoryLeakTester {
  constructor() {
    this.results = {
      memoryTests: [],
      performanceTests: [],
      eventListenerTests: [],
    };
  }

  // Teste 1: Memory Leak ao Abrir/Fechar Select
  async testOpenCloseMemoryLeak(iterations = 50) {
    console.log('\n🧪 TESTE 1: Memory Leak - Abrir/Fechar Select');
    console.log('═'.repeat(60));

    if (!performance.memory) {
      console.warn('⚠️  performance.memory não disponível');
      console.log('💡 Use Chrome com flag: --enable-precise-memory-info');
      return null;
    }

    // Forçar garbage collection inicial (se disponível)
    if (window.gc) {
      window.gc();
      await new Promise((r) => setTimeout(r, 1000));
    }

    const initialMemory = performance.memory.usedJSHeapSize / 1048576;
    console.log(`📊 Memória inicial: ${initialMemory.toFixed(2)}MB`);
    console.log(`\n🔄 Abrindo e fechando select ${iterations} vezes...`);

    const selectButton = document.querySelector(
      'button[aria-haspopup="listbox"], button[aria-expanded]'
    );

    if (!selectButton) {
      console.error('❌ Select não encontrado na página');
      return null;
    }

    const samples = [];

    for (let i = 0; i < iterations; i++) {
      // Abrir
      selectButton.click();
      await new Promise((r) => setTimeout(r, 50));

      // Fechar (clicar fora)
      document.body.click();
      await new Promise((r) => setTimeout(r, 50));

      // Capturar amostra a cada 10 iterações
      if (i % 10 === 0) {
        const currentMemory = performance.memory.usedJSHeapSize / 1048576;
        samples.push({
          iteration: i,
          memory: currentMemory,
          delta: currentMemory - initialMemory,
        });

        console.log(
          `  Iteração ${i}: ${currentMemory.toFixed(2)}MB (Δ ${(currentMemory - initialMemory).toFixed(2)}MB)`
        );
      }
    }

    // Forçar garbage collection final (se disponível)
    if (window.gc) {
      console.log('\n🗑️  Executando garbage collection...');
      window.gc();
      await new Promise((r) => setTimeout(r, 1000));
    }

    const finalMemory = performance.memory.usedJSHeapSize / 1048576;
    const totalLeak = finalMemory - initialMemory;

    console.log('\n📊 RESULTADO:');
    console.log(`  Memória inicial:  ${initialMemory.toFixed(2)}MB`);
    console.log(`  Memória final:    ${finalMemory.toFixed(2)}MB`);
    console.log(`  Vazamento total:  ${totalLeak.toFixed(2)}MB`);
    console.log(`  Vazamento/ciclo:  ${(totalLeak / iterations).toFixed(3)}MB`);

    let verdict;
    if (totalLeak < 2) {
      verdict = '✅ EXCELENTE - Sem memory leak significativo';
    } else if (totalLeak < 5) {
      verdict = '🟡 ACEITÁVEL - Pequeno vazamento detectado';
    } else {
      verdict = '❌ CRÍTICO - Memory leak detectado!';
    }

    console.log(`\n  Veredicto: ${verdict}`);

    this.results.memoryTests.push({
      test: 'Open/Close Memory Leak',
      iterations,
      initialMemory,
      finalMemory,
      totalLeak,
      leakPerCycle: totalLeak / iterations,
      samples,
      verdict,
    });

    return {
      initialMemory,
      finalMemory,
      totalLeak,
      leakPerCycle: totalLeak / iterations,
      verdict,
    };
  }

  // Teste 2: Event Listeners Vazando
  async testEventListenerLeak() {
    console.log('\n🧪 TESTE 2: Event Listeners Não Removidos');
    console.log('═'.repeat(60));

    const getEventListenerCount = () => {
      const listeners = window.getEventListeners
        ? window.getEventListeners(document)
        : null;

      if (!listeners) {
        console.warn(
          '⚠️  getEventListeners não disponível (apenas no Chrome DevTools)'
        );
        return null;
      }

      let count = 0;
      Object.keys(listeners).forEach((type) => {
        count += listeners[type].length;
      });
      return count;
    };

    const initialCount = getEventListenerCount();

    if (initialCount === null) {
      console.log('💡 Este teste requer Chrome DevTools aberto');
      return null;
    }

    console.log(`📊 Event listeners iniciais: ${initialCount}`);

    // Abrir e fechar select 10 vezes
    const selectButton = document.querySelector(
      'button[aria-haspopup="listbox"]'
    );

    if (!selectButton) {
      console.error('❌ Select não encontrado');
      return null;
    }

    console.log('\n🔄 Testando 10 ciclos de abertura/fechamento...');

    for (let i = 0; i < 10; i++) {
      selectButton.click();
      await new Promise((r) => setTimeout(r, 100));
      document.body.click();
      await new Promise((r) => setTimeout(r, 100));
    }

    const finalCount = getEventListenerCount();
    const leakedListeners = finalCount - initialCount;

    console.log('\n📊 RESULTADO:');
    console.log(`  Listeners iniciais: ${initialCount}`);
    console.log(`  Listeners finais:   ${finalCount}`);
    console.log(`  Vazamento:          ${leakedListeners} listeners`);

    let verdict;
    if (leakedListeners <= 1) {
      verdict = '✅ EXCELENTE - Listeners limpos corretamente';
    } else if (leakedListeners <= 5) {
      verdict = '🟡 ATENÇÃO - Possível vazamento pequeno';
    } else {
      verdict = '❌ CRÍTICO - Event listeners vazando!';
    }

    console.log(`\n  Veredicto: ${verdict}`);

    this.results.eventListenerTests.push({
      test: 'Event Listener Leak',
      initialCount,
      finalCount,
      leakedListeners,
      verdict,
    });

    return {
      initialCount,
      finalCount,
      leakedListeners,
      verdict,
    };
  }

  // Teste 3: Performance de Abertura
  async testOpeningPerformance(iterations = 10) {
    console.log('\n🧪 TESTE 3: Performance de Abertura do Dropdown');
    console.log('═'.repeat(60));

    const selectButton = document.querySelector(
      'button[aria-haspopup="listbox"]'
    );

    if (!selectButton) {
      console.error('❌ Select não encontrado');
      return null;
    }

    const times = [];

    console.log(`\n⏱️  Medindo ${iterations} aberturas...\n`);

    for (let i = 0; i < iterations; i++) {
      // Garantir que está fechado
      if (selectButton.getAttribute('aria-expanded') === 'true') {
        document.body.click();
        await new Promise((r) => setTimeout(r, 100));
      }

      const start = performance.now();
      selectButton.click();

      // Aguardar dropdown aparecer
      await new Promise((resolve) => {
        const observer = new MutationObserver(() => {
          const dropdown = document.querySelector('[role="listbox"]');
          if (dropdown) {
            const end = performance.now();
            times.push(end - start);
            console.log(`  Tentativa ${i + 1}: ${(end - start).toFixed(2)}ms`);
            observer.disconnect();
            resolve();
          }
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true,
        });

        // Timeout de segurança
        setTimeout(() => {
          observer.disconnect();
          resolve();
        }, 1000);
      });

      // Fechar
      document.body.click();
      await new Promise((r) => setTimeout(r, 100));
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);

    console.log('\n📊 RESULTADO:');
    console.log(`  Tempo médio: ${avg.toFixed(2)}ms`);
    console.log(`  Mais rápido: ${min.toFixed(2)}ms`);
    console.log(`  Mais lento:  ${max.toFixed(2)}ms`);

    let verdict;
    if (avg < 100) {
      verdict = '✅ EXCELENTE - Abertura instantânea';
    } else if (avg < 300) {
      verdict = '🟡 BOM - Abertura rápida';
    } else if (avg < 1000) {
      verdict = '🟠 ACEITÁVEL - Pode melhorar';
    } else {
      verdict = '❌ LENTO - Precisa otimização';
    }

    console.log(`\n  Veredicto: ${verdict}`);

    this.results.performanceTests.push({
      test: 'Opening Performance',
      iterations,
      times,
      avg,
      min,
      max,
      verdict,
    });

    return { avg, min, max, verdict };
  }

  // Teste 4: Debounce em Busca
  async testSearchDebounce() {
    console.log('\n🧪 TESTE 4: Debounce em Campo de Busca');
    console.log('═'.repeat(60));

    const selectButton = document.querySelector(
      'button[aria-haspopup="listbox"]'
    );

    if (!selectButton) {
      console.error('❌ Select não encontrado');
      return null;
    }

    // Abrir select
    selectButton.click();
    await new Promise((r) => setTimeout(r, 200));

    const searchInput = document.querySelector('input[type="text"]');

    if (!searchInput) {
      console.log('ℹ️  Select não tem campo de busca');
      document.body.click();
      return null;
    }

    console.log('✍️  Simulando digitação rápida...');

    let updateCount = 0;
    const observer = new MutationObserver(() => {
      updateCount++;
    });

    const dropdown = document.querySelector('[role="listbox"]');
    if (dropdown) {
      observer.observe(dropdown, {
        childList: true,
        subtree: true,
      });
    }

    // Simular digitação rápida
    const searchTerm = 'teste';
    for (let char of searchTerm) {
      searchInput.value += char;
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 50));
    }

    // Aguardar debounce
    await new Promise((r) => setTimeout(r, 500));

    observer.disconnect();

    console.log('\n📊 RESULTADO:');
    console.log(`  Caracteres digitados: ${searchTerm.length}`);
    console.log(`  Atualizações da lista: ${updateCount}`);

    let verdict;
    if (updateCount <= 2) {
      verdict = '✅ EXCELENTE - Debounce funcionando perfeitamente';
    } else if (updateCount <= 5) {
      verdict = '🟡 BOM - Debounce ativo mas pode melhorar';
    } else {
      verdict = '❌ RUIM - Sem debounce ou mal configurado';
    }

    console.log(`\n  Veredicto: ${verdict}`);

    // Fechar
    document.body.click();

    return {
      charactersTyped: searchTerm.length,
      listUpdates: updateCount,
      hasDebounce: updateCount <= searchTerm.length / 2,
      verdict,
    };
  }

  // Teste 5: Lazy Loading
  async testLazyLoading() {
    console.log('\n🧪 TESTE 5: Lazy Loading de Opções');
    console.log('═'.repeat(60));

    const selectButton = document.querySelector(
      'button[aria-haspopup="listbox"]'
    );

    if (!selectButton) {
      console.error('❌ Select não encontrado');
      return null;
    }

    // Abrir select
    selectButton.click();
    await new Promise((r) => setTimeout(r, 200));

    const dropdown = document.querySelector('[role="listbox"]');

    if (!dropdown) {
      console.error('❌ Dropdown não encontrado');
      return null;
    }

    const initialOptions = dropdown.querySelectorAll('[role="option"]').length;
    console.log(`📊 Opções inicialmente renderizadas: ${initialOptions}`);

    // Simular scroll até o fim
    console.log('\n📜 Simulando scroll...');

    const scrollableElement = dropdown.parentElement;
    if (scrollableElement) {
      scrollableElement.scrollTop = scrollableElement.scrollHeight;
      await new Promise((r) => setTimeout(r, 500));

      const finalOptions = dropdown.querySelectorAll('[role="option"]').length;
      console.log(`📊 Opções após scroll: ${finalOptions}`);

      const loadedMore = finalOptions > initialOptions;

      console.log('\n📊 RESULTADO:');
      console.log(`  Opções iniciais: ${initialOptions}`);
      console.log(`  Opções finais:   ${finalOptions}`);
      console.log(`  Carregou mais:   ${loadedMore ? 'Sim' : 'Não'}`);

      let verdict;
      if (loadedMore && initialOptions < 50) {
        verdict = '✅ EXCELENTE - Lazy loading ativo';
      } else if (initialOptions < 30) {
        verdict = '✅ BOM - Lista pequena ou lazy loading otimizado';
      } else if (initialOptions > 100) {
        verdict = '❌ RUIM - Renderizando muitas opções de uma vez';
      } else {
        verdict = '🟡 ACEITÁVEL';
      }

      console.log(`\n  Veredicto: ${verdict}`);

      // Fechar
      document.body.click();

      return {
        initialOptions,
        finalOptions,
        loadedMore,
        verdict,
      };
    }

    document.body.click();
    return null;
  }

  // Gerar Relatório Completo
  generateReport() {
    console.log('\n\n');
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║        RELATÓRIO COMPLETO - TESTES DE SELECTS         ║');
    console.log('╚═══════════════════════════════════════════════════════╝');

    // Teste de Memória
    if (this.results.memoryTests.length > 0) {
      console.log('\n📊 MEMORY LEAK:');
      console.log('─'.repeat(60));

      this.results.memoryTests.forEach((result) => {
        console.log(`\n  ${result.test}:`);
        console.log(`    Vazamento total: ${result.totalLeak.toFixed(2)}MB`);
        console.log(`    Por ciclo: ${result.leakPerCycle.toFixed(3)}MB`);
        console.log(`    ${result.verdict}`);
      });
    }

    // Teste de Event Listeners
    if (this.results.eventListenerTests.length > 0) {
      console.log('\n\n🎧 EVENT LISTENERS:');
      console.log('─'.repeat(60));

      this.results.eventListenerTests.forEach((result) => {
        console.log(`\n  ${result.test}:`);
        console.log(`    Listeners vazados: ${result.leakedListeners}`);
        console.log(`    ${result.verdict}`);
      });
    }

    // Teste de Performance
    if (this.results.performanceTests.length > 0) {
      console.log('\n\n⚡ PERFORMANCE:');
      console.log('─'.repeat(60));

      this.results.performanceTests.forEach((result) => {
        console.log(`\n  ${result.test}:`);
        console.log(`    Tempo médio: ${result.avg.toFixed(2)}ms`);
        console.log(`    Range: ${result.min.toFixed(2)}ms - ${result.max.toFixed(2)}ms`);
        console.log(`    ${result.verdict}`);
      });
    }

    console.log('\n\n' + '═'.repeat(60));
    console.log('CRITÉRIOS DE SUCESSO:');
    console.log('─'.repeat(60));
    console.log('  ✅ Memory leak:      < 2MB total');
    console.log('  ✅ Event listeners:  Nenhum vazamento');
    console.log('  ✅ Abertura:         < 100ms');
    console.log('  ✅ Debounce:         Máximo 2 updates');
    console.log('  ✅ Lazy loading:     < 50 opções iniciais');
    console.log('═'.repeat(60) + '\n');

    window.selectTestReport = this.results;
    console.log('💾 Relatório salvo em: window.selectTestReport');
  }

  // Teste completo automático
  async runFullTest() {
    console.clear();
    console.log('🚀 TESTE COMPLETO DE SELECTS - MEMORY LEAKS E PERFORMANCE\n');

    await this.testOpenCloseMemoryLeak(50);
    await new Promise((r) => setTimeout(r, 1000));

    await this.testEventListenerLeak();
    await new Promise((r) => setTimeout(r, 1000));

    await this.testOpeningPerformance(10);
    await new Promise((r) => setTimeout(r, 1000));

    await this.testSearchDebounce();
    await new Promise((r) => setTimeout(r, 1000));

    await this.testLazyLoading();

    this.generateReport();
  }

  // Teste rápido
  async quickTest() {
    console.clear();
    console.log('⚡ TESTE RÁPIDO DE SELECTS\n');

    await this.testOpenCloseMemoryLeak(20);
    await new Promise((r) => setTimeout(r, 500));

    await this.testOpeningPerformance(5);

    console.log('\n✅ Teste rápido concluído!');
    console.log('Para teste completo, execute: tester.runFullTest()');
  }
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================

window.selectTester = new SelectMemoryLeakTester();

console.clear();
console.log('╔═══════════════════════════════════════════════════════╗');
console.log('║    FERRAMENTAS DE TESTE - MEMORY LEAKS EM SELECTS    ║');
console.log('╚═══════════════════════════════════════════════════════╝\n');

console.log('✅ Ferramentas carregadas!\n');

console.log('📝 COMANDOS DISPONÍVEIS:\n');

console.log('   ⚡ TESTE RÁPIDO (1 minuto):');
console.log('      selectTester.quickTest()\n');

console.log('   🔬 TESTE COMPLETO (3-4 minutos):');
console.log('      selectTester.runFullTest()\n');

console.log('   🧪 TESTES INDIVIDUAIS:');
console.log('      selectTester.testOpenCloseMemoryLeak(50)');
console.log('      selectTester.testEventListenerLeak()');
console.log('      selectTester.testOpeningPerformance(10)');
console.log('      selectTester.testSearchDebounce()');
console.log('      selectTester.testLazyLoading()\n');

console.log('═'.repeat(60) + '\n');

console.log('💡 DICA: Abra uma página com um OptimizedSelect antes de testar\n');
console.log('📋 RECOMENDAÇÃO: Comece com o teste rápido\n');
console.log('   Execute: selectTester.quickTest()\n');
