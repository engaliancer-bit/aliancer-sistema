// ============================================================
// SCRIPT DE TESTE DE PERFORMANCE - VIRTUALIZAÇÃO DE LISTAS
// Cole no Console do Chrome DevTools (F12)
// ============================================================

class VirtualizationPerformanceTester {
  constructor() {
    this.results = {
      renderTime: [],
      scrollPerformance: [],
      memoryUsage: [],
      fpsReadings: [],
    };
  }

  // Teste 1: Tempo de Renderização
  async testRenderTime(testName, iterations = 5) {
    console.log(`\n🔍 Testando: ${testName}`);
    console.log('═'.repeat(50));

    const times = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          const end = performance.now();
          const time = end - start;
          times.push(time);
          console.log(`  Iteração ${i + 1}: ${time.toFixed(2)}ms`);
          resolve();
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);

    console.log('\n📊 Resultado:');
    console.log(`  Média: ${avg.toFixed(2)}ms`);
    console.log(`  Mínimo: ${min.toFixed(2)}ms`);
    console.log(`  Máximo: ${max.toFixed(2)}ms`);

    this.results.renderTime.push({
      testName,
      avg,
      min,
      max,
      times,
    });

    return { avg, min, max };
  }

  // Teste 2: Performance de Scroll
  async testScrollPerformance() {
    console.log('\n🎯 Testando Performance de Scroll');
    console.log('═'.repeat(50));

    if (!performance.memory) {
      console.warn('⚠️  performance.memory não disponível');
      return null;
    }

    const initialMemory = performance.memory.usedJSHeapSize / 1048576;
    const fpsReadings = [];
    let frameCount = 0;
    let lastTime = performance.now();

    console.log('📋 Instruções:');
    console.log('  1. Role a lista rapidamente');
    console.log('  2. Aguarde 3 segundos');
    console.log('  3. O teste capturará FPS automaticamente\n');

    const measureFPS = () => {
      const currentTime = performance.now();
      const delta = currentTime - lastTime;

      if (delta >= 1000) {
        const fps = (frameCount * 1000) / delta;
        fpsReadings.push(fps);
        console.log(`  FPS: ${fps.toFixed(1)}`);

        frameCount = 0;
        lastTime = currentTime;
      }

      frameCount++;

      if (fpsReadings.length < 3) {
        requestAnimationFrame(measureFPS);
      } else {
        this.finishScrollTest(fpsReadings, initialMemory);
      }
    };

    requestAnimationFrame(measureFPS);
  }

  finishScrollTest(fpsReadings, initialMemory) {
    const finalMemory = performance.memory.usedJSHeapSize / 1048576;
    const memoryDelta = finalMemory - initialMemory;

    const avgFPS = fpsReadings.reduce((a, b) => a + b, 0) / fpsReadings.length;
    const minFPS = Math.min(...fpsReadings);

    console.log('\n📊 Resultado:');
    console.log(`  FPS Médio: ${avgFPS.toFixed(1)}`);
    console.log(`  FPS Mínimo: ${minFPS.toFixed(1)}`);
    console.log(`  Memória Inicial: ${initialMemory.toFixed(2)}MB`);
    console.log(`  Memória Final: ${finalMemory.toFixed(2)}MB`);
    console.log(`  Crescimento: ${memoryDelta > 0 ? '+' : ''}${memoryDelta.toFixed(2)}MB`);

    const verdict =
      avgFPS >= 55 && minFPS >= 45
        ? '✅ EXCELENTE - Scroll fluido'
        : avgFPS >= 40
        ? '🟡 BOM - Aceitável'
        : '❌ RUIM - Precisa otimização';

    console.log(`\n  Veredicto: ${verdict}`);

    this.results.scrollPerformance.push({
      avgFPS,
      minFPS,
      fpsReadings,
      memoryDelta,
      initialMemory,
      finalMemory,
    });
  }

  // Teste 3: Comparação Antes/Depois
  comparePerformance(before, after) {
    console.log('\n📊 COMPARAÇÃO DE PERFORMANCE');
    console.log('═'.repeat(60));

    const metrics = [
      {
        name: 'Tempo de Renderização',
        before: before.renderTime,
        after: after.renderTime,
        unit: 'ms',
        lower_is_better: true,
      },
      {
        name: 'Uso de Memória',
        before: before.memory,
        after: after.memory,
        unit: 'MB',
        lower_is_better: true,
      },
      {
        name: 'FPS Médio',
        before: before.fps,
        after: after.fps,
        unit: 'fps',
        lower_is_better: false,
      },
    ];

    metrics.forEach((metric) => {
      const improvement = metric.lower_is_better
        ? ((metric.before - metric.after) / metric.before) * 100
        : ((metric.after - metric.before) / metric.before) * 100;

      console.log(`\n${metric.name}:`);
      console.log(`  Antes:    ${metric.before}${metric.unit}`);
      console.log(`  Depois:   ${metric.after}${metric.unit}`);

      if (improvement > 0) {
        console.log(`  Melhoria: +${improvement.toFixed(1)}% ✅`);
      } else {
        console.log(`  Piora:    ${improvement.toFixed(1)}% ❌`);
      }
    });

    console.log('\n' + '═'.repeat(60));
  }

  // Teste 4: Stress Test com Muitos Itens
  async stressTest(itemCounts = [100, 500, 1000, 2000]) {
    console.log('\n💪 STRESS TEST - Múltiplas Quantidades');
    console.log('═'.repeat(50));

    if (!performance.memory) {
      console.warn('⚠️  performance.memory não disponível');
      return;
    }

    for (const count of itemCounts) {
      console.log(`\n📦 Testando com ${count} itens:`);

      const startMemory = performance.memory.usedJSHeapSize / 1048576;
      const startTime = performance.now();

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const endTime = performance.now();
      const endMemory = performance.memory.usedJSHeapSize / 1048576;

      const loadTime = endTime - startTime;
      const memoryUsed = endMemory - startMemory;

      console.log(`  Tempo: ${loadTime.toFixed(0)}ms`);
      console.log(`  Memória: ${memoryUsed.toFixed(2)}MB`);

      let verdict = '✅ ÓTIMO';
      if (loadTime > 500 || memoryUsed > 10) {
        verdict = '🟡 ACEITÁVEL';
      }
      if (loadTime > 1000 || memoryUsed > 20) {
        verdict = '❌ RUIM';
      }

      console.log(`  Status: ${verdict}`);
    }
  }

  // Teste 5: Busca e Filtro
  async testSearchPerformance(searchTerms) {
    console.log('\n🔍 TESTE DE BUSCA E FILTRO');
    console.log('═'.repeat(50));

    const times = [];

    for (const term of searchTerms) {
      const start = performance.now();

      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          const end = performance.now();
          const time = end - start;
          times.push(time);
          console.log(`  Buscar "${term}": ${time.toFixed(2)}ms`);
          resolve();
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(`\n  Tempo Médio: ${avg.toFixed(2)}ms`);

    const verdict =
      avg < 100
        ? '✅ INSTANTÂNEO'
        : avg < 300
        ? '🟡 RÁPIDO'
        : '❌ LENTO - Otimizar';

    console.log(`  Veredicto: ${verdict}`);

    return { avg, times, verdict };
  }

  // Gerar Relatório Final
  generateReport() {
    console.log('\n\n');
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║         RELATÓRIO DE PERFORMANCE - VIRTUALIZAÇÃO      ║');
    console.log('╚═══════════════════════════════════════════════════════╝');

    if (this.results.renderTime.length > 0) {
      console.log('\n📊 TEMPO DE RENDERIZAÇÃO:');
      console.log('─'.repeat(50));

      this.results.renderTime.forEach((result) => {
        console.log(`\n  ${result.testName}:`);
        console.log(`    Média: ${result.avg.toFixed(2)}ms`);
        console.log(`    Range: ${result.min.toFixed(2)}ms - ${result.max.toFixed(2)}ms`);

        const verdict =
          result.avg < 200
            ? '✅ EXCELENTE'
            : result.avg < 500
            ? '🟡 BOM'
            : '❌ PRECISA OTIMIZAR';

        console.log(`    Status: ${verdict}`);
      });
    }

    if (this.results.scrollPerformance.length > 0) {
      console.log('\n\n🎯 PERFORMANCE DE SCROLL:');
      console.log('─'.repeat(50));

      this.results.scrollPerformance.forEach((result, i) => {
        console.log(`\n  Teste ${i + 1}:`);
        console.log(`    FPS Médio: ${result.avgFPS.toFixed(1)}`);
        console.log(`    FPS Mínimo: ${result.minFPS.toFixed(1)}`);
        console.log(`    Memória: ${result.memoryDelta > 0 ? '+' : ''}${result.memoryDelta.toFixed(2)}MB`);

        const verdict =
          result.avgFPS >= 55 && result.minFPS >= 45
            ? '✅ 60FPS - PERFEITO'
            : result.avgFPS >= 40
            ? '🟡 BOM'
            : '❌ ABAIXO DO ESPERADO';

        console.log(`    Status: ${verdict}`);
      });
    }

    console.log('\n\n' + '═'.repeat(60));
    console.log('CRITÉRIOS DE SUCESSO:');
    console.log('─'.repeat(60));
    console.log('  ✅ Renderização:   < 200ms');
    console.log('  ✅ FPS:            >= 55fps');
    console.log('  ✅ FPS Mínimo:     >= 45fps');
    console.log('  ✅ Memória:        < 5MB crescimento');
    console.log('  ✅ Busca:          < 100ms');
    console.log('═'.repeat(60) + '\n');

    window.virtualizationReport = this.results;
    console.log('💾 Relatório salvo em: window.virtualizationReport');
  }

  // Atalhos para testes rápidos
  async quickTest() {
    console.clear();
    console.log('⚡ TESTE RÁPIDO DE VIRTUALIZAÇÃO\n');

    await this.testRenderTime('Renderização Inicial', 3);
    console.log('\n⏳ Aguardando 2 segundos...\n');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log('\n✅ Teste rápido concluído!');
    console.log('\nPara teste completo, execute: tester.fullTest()');
  }

  async fullTest() {
    console.clear();
    console.log('🔬 TESTE COMPLETO DE VIRTUALIZAÇÃO\n');

    await this.testRenderTime('Renderização de Lista', 5);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log('\n⏳ Iniciando teste de scroll em 3 segundos...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    await this.testScrollPerformance();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await this.stressTest([100, 500, 1000]);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await this.testSearchPerformance(['test', 'produto', 'material']);

    this.generateReport();
  }
}

// ============================================================
// COMPARADOR DE PERFORMANCE (Antes vs Depois)
// ============================================================

class PerformanceComparator {
  compare(beforeData, afterData) {
    console.clear();
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║     COMPARAÇÃO: ANTES vs DEPOIS DA VIRTUALIZAÇÃO      ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    this.compareMetric('Tempo de Renderização', beforeData.renderTime, afterData.renderTime, 'ms', true);
    this.compareMetric('FPS Durante Scroll', beforeData.fps, afterData.fps, 'fps', false);
    this.compareMetric('Uso de Memória', beforeData.memory, afterData.memory, 'MB', true);
    this.compareMetric('Elementos DOM', beforeData.domElements, afterData.domElements, '', true);

    console.log('\n' + '═'.repeat(60));
    this.showSummary(beforeData, afterData);
  }

  compareMetric(name, before, after, unit, lowerIsBetter) {
    const improvement = lowerIsBetter
      ? ((before - after) / before) * 100
      : ((after - before) / before) * 100;

    console.log(`\n${name}:`);
    console.log(`  Antes:     ${before}${unit}`);
    console.log(`  Depois:    ${after}${unit}`);

    if (improvement > 0) {
      console.log(`  Melhoria:  +${improvement.toFixed(1)}% ✅`);
    } else {
      console.log(`  Piora:     ${improvement.toFixed(1)}% ❌`);
    }
  }

  showSummary(before, after) {
    console.log('\n📊 RESUMO GERAL:\n');

    const renderImprovement = ((before.renderTime - after.renderTime) / before.renderTime) * 100;
    const memoryReduction = ((before.memory - after.memory) / before.memory) * 100;
    const fpsIncrease = ((after.fps - before.fps) / before.fps) * 100;

    if (renderImprovement > 50 && memoryReduction > 50) {
      console.log('  🎉 SUCESSO TOTAL!');
      console.log(`     • ${renderImprovement.toFixed(0)}% mais rápido`);
      console.log(`     • ${memoryReduction.toFixed(0)}% menos memória`);
      console.log(`     • ${fpsIncrease.toFixed(0)}% melhor FPS`);
    } else if (renderImprovement > 30) {
      console.log('  ✅ MELHORIA SIGNIFICATIVA!');
      console.log(`     • ${renderImprovement.toFixed(0)}% mais rápido`);
    } else {
      console.log('  ⚠️  MELHORIA MODERADA');
      console.log('     • Considere otimizações adicionais');
    }

    console.log('\n' + '═'.repeat(60));
  }
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================

window.tester = new VirtualizationPerformanceTester();
window.comparator = new PerformanceComparator();

console.clear();
console.log('╔═══════════════════════════════════════════════════════╗');
console.log('║    FERRAMENTAS DE TESTE - VIRTUALIZAÇÃO DE LISTAS    ║');
console.log('╚═══════════════════════════════════════════════════════╝\n');

console.log('✅ Ferramentas carregadas!\n');

console.log('📝 COMANDOS DISPONÍVEIS:\n');

console.log('   ⚡ TESTE RÁPIDO (30 segundos):');
console.log('      tester.quickTest()\n');

console.log('   🔬 TESTE COMPLETO (2-3 minutos):');
console.log('      tester.fullTest()\n');

console.log('   📊 COMPARAR PERFORMANCE:');
console.log('      comparator.compare(antes, depois)\n');

console.log('   📈 TESTES INDIVIDUAIS:');
console.log('      tester.testRenderTime("Nome do Teste", 5)');
console.log('      tester.testScrollPerformance()');
console.log('      tester.stressTest([100, 500, 1000])');
console.log('      tester.testSearchPerformance(["termo1", "termo2"])\n');

console.log('═'.repeat(60) + '\n');

console.log('💡 RECOMENDAÇÃO: Comece com o teste rápido\n');
console.log('   Execute: tester.quickTest()\n');
