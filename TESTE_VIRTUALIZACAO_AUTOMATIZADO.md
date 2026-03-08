# Teste Automatizado de Virtualização - Sistema de Gestão

## Script de Teste Completo

Cole este script no console do Chrome (F12) para testar a virtualização das listas:

```javascript
// ============================================================
// TESTE AUTOMATIZADO DE VIRTUALIZAÇÃO DE LISTAS
// ============================================================

class VirtualizationTester {
  constructor() {
    this.results = {
      dom: null,
      scroll: null,
      memory: null,
      virtualization: null,
    };
  }

  // Teste 1: Análise de elementos DOM
  testDOM() {
    console.log('\n📊 Teste 1: Analisando elementos DOM...');

    const tableRows = document.querySelectorAll('tbody tr');
    const virtualizedItems = document.querySelectorAll('[data-virtualized-item], [class*="virtual"]');
    const totalElements = document.querySelectorAll('*').length;
    const tables = document.querySelectorAll('table').length;

    const result = {
      tableRows: tableRows.length,
      virtualizedItems: virtualizedItems.length,
      totalElements,
      tables,
      status: 'unknown',
      recommendation: '',
    };

    // Análise
    if (virtualizedItems.length > 0) {
      result.status = 'virtualized';
      result.recommendation = '✅ Virtualização detectada!';
    } else if (tableRows.length > 100) {
      result.status = 'needs_virtualization';
      result.recommendation = '⚠️ Muitas linhas sem virtualização. Implementar urgente!';
    } else if (tableRows.length > 50) {
      result.status = 'should_virtualize';
      result.recommendation = '🟡 Recomendado virtualizar';
    } else {
      result.status = 'ok';
      result.recommendation = '✅ Quantidade aceitável de elementos';
    }

    console.log(`  Linhas de tabela: ${result.tableRows}`);
    console.log(`  Itens virtualizados: ${result.virtualizedItems}`);
    console.log(`  Total de elementos: ${result.totalElements}`);
    console.log(`  Tabelas: ${result.tables}`);
    console.log(`  ${result.recommendation}`);

    this.results.dom = result;
    return result;
  }

  // Teste 2: Performance de Scroll
  async testScroll() {
    return new Promise((resolve) => {
      console.log('\n🎯 Teste 2: Testando performance de scroll...');

      const scrollContainer =
        document.querySelector('[style*="overflow"]') ||
        document.querySelector('.overflow-auto') ||
        window;

      const isWindow = scrollContainer === window;

      const result = {
        fps: 0,
        frames: 0,
        totalTime: 0,
        status: 'unknown',
        recommendation: '',
      };

      let frameCount = 0;
      let lastTime = performance.now();
      const frameTimes = [];

      const startScroll = performance.now();

      const scrollTest = setInterval(() => {
        const currentTime = performance.now();
        const frameTime = currentTime - lastTime;
        frameTimes.push(frameTime);
        lastTime = currentTime;

        if (isWindow) {
          window.scrollBy(0, 50);
        } else {
          scrollContainer.scrollTop += 50;
        }

        frameCount++;

        const scrollTop = isWindow ? window.scrollY : scrollContainer.scrollTop;
        const scrollHeight = isWindow
          ? document.documentElement.scrollHeight
          : scrollContainer.scrollHeight;
        const clientHeight = isWindow ? window.innerHeight : scrollContainer.clientHeight;

        if (scrollTop >= scrollHeight - clientHeight || frameCount >= 30) {
          clearInterval(scrollTest);

          const endScroll = performance.now();
          const totalTime = endScroll - startScroll;
          const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
          const fps = 1000 / avgFrameTime;

          result.frames = frameCount;
          result.totalTime = totalTime;
          result.fps = fps;

          // Análise
          if (fps >= 55) {
            result.status = 'excellent';
            result.recommendation = '🟢 Performance EXCELENTE';
          } else if (fps >= 45) {
            result.status = 'good';
            result.recommendation = '✅ Performance BOA';
          } else if (fps >= 30) {
            result.status = 'acceptable';
            result.recommendation = '🟡 Performance ACEITÁVEL';
          } else {
            result.status = 'poor';
            result.recommendation = '🔴 Performance RUIM - Implementar virtualização!';
          }

          console.log(`  Frames renderizados: ${frameCount}`);
          console.log(`  Tempo total: ${totalTime.toFixed(0)}ms`);
          console.log(`  FPS médio: ${fps.toFixed(1)}`);
          console.log(`  ${result.recommendation}`);

          // Voltar ao topo
          if (isWindow) {
            window.scrollTo(0, 0);
          } else {
            scrollContainer.scrollTop = 0;
          }

          this.results.scroll = result;
          resolve(result);
        }
      }, 16); // ~60fps
    });
  }

  // Teste 3: Uso de Memória
  testMemory() {
    console.log('\n💾 Teste 3: Analisando uso de memória...');

    if (!performance.memory) {
      console.log('  ⚠️ performance.memory não disponível');
      console.log('  💡 Inicie Chrome com --enable-precise-memory-info');
      return null;
    }

    const usedMB = performance.memory.usedJSHeapSize / 1048576;
    const totalMB = performance.memory.totalJSHeapSize / 1048576;
    const limitMB = performance.memory.jsHeapSizeLimit / 1048576;

    const result = {
      usedMB: usedMB.toFixed(1),
      totalMB: totalMB.toFixed(1),
      limitMB: limitMB.toFixed(0),
      usagePercent: ((usedMB / limitMB) * 100).toFixed(1),
      status: 'unknown',
      recommendation: '',
    };

    // Análise
    if (usedMB < 50) {
      result.status = 'excellent';
      result.recommendation = '🟢 Uso de memória EXCELENTE';
    } else if (usedMB < 100) {
      result.status = 'good';
      result.recommendation = '✅ Uso de memória BOM';
    } else if (usedMB < 200) {
      result.status = 'high';
      result.recommendation = '🟡 Uso de memória ALTO';
    } else {
      result.status = 'critical';
      result.recommendation = '🔴 Uso de memória CRÍTICO - Otimizar!';
    }

    console.log(`  Heap usado: ${result.usedMB}MB`);
    console.log(`  Heap total: ${result.totalMB}MB`);
    console.log(`  Limite: ${result.limitMB}MB`);
    console.log(`  Uso: ${result.usagePercent}%`);
    console.log(`  ${result.recommendation}`);

    this.results.memory = result;
    return result;
  }

  // Teste 4: Detecção de Virtualização
  testVirtualization() {
    console.log('\n🔍 Teste 4: Detectando virtualização...');

    const result = {
      hasReactWindow: false,
      hasVirtualizedComponents: false,
      hasInfiniteLoader: false,
      listContainers: 0,
      status: 'not_detected',
      recommendation: '',
    };

    // Detectar react-window
    const reactWindowElements = document.querySelectorAll(
      '[style*="position: relative"], [style*="will-change: transform"]'
    );
    result.hasReactWindow = reactWindowElements.length > 0;

    // Detectar componentes virtualizados
    const virtualizedComponents = document.querySelectorAll(
      '[data-virtualized], [class*="Virtualized"], [class*="virtual"]'
    );
    result.hasVirtualizedComponents = virtualizedComponents.length > 0;

    // Detectar infinite loader
    const infiniteLoader = document.querySelector('[data-loading], .loading');
    result.hasInfiniteLoader = infiniteLoader !== null;

    // Contar containers de lista
    result.listContainers = document.querySelectorAll(
      'div[style*="overflow"], .overflow-auto, .overflow-y-auto'
    ).length;

    // Análise
    if (result.hasReactWindow && result.hasVirtualizedComponents) {
      result.status = 'active';
      result.recommendation = '✅ VIRTUALIZAÇÃO ATIVA E FUNCIONANDO';
    } else if (result.hasVirtualizedComponents) {
      result.status = 'partial';
      result.recommendation = '🟡 Virtualização parcial detectada';
    } else {
      result.status = 'none';
      result.recommendation = '❌ VIRTUALIZAÇÃO NÃO DETECTADA';
    }

    console.log(`  React Window: ${result.hasReactWindow ? '✅' : '❌'}`);
    console.log(`  Componentes virtualizados: ${result.hasVirtualizedComponents ? '✅' : '❌'}`);
    console.log(`  Infinite Loader: ${result.hasInfiniteLoader ? '✅' : '❌'}`);
    console.log(`  Containers de lista: ${result.listContainers}`);
    console.log(`  ${result.recommendation}`);

    this.results.virtualization = result;
    return result;
  }

  // Executar todos os testes
  async runAll() {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 TESTE AUTOMATIZADO DE VIRTUALIZAÇÃO');
    console.log('='.repeat(60));

    this.testDOM();
    await this.testScroll();
    this.testMemory();
    this.testVirtualization();

    this.printReport();
    return this.results;
  }

  // Imprimir relatório final
  printReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 RELATÓRIO FINAL');
    console.log('='.repeat(60));

    // Score geral
    let score = 0;
    let maxScore = 0;

    // DOM (25 pontos)
    maxScore += 25;
    if (this.results.dom) {
      if (this.results.dom.status === 'virtualized') score += 25;
      else if (this.results.dom.status === 'ok') score += 20;
      else if (this.results.dom.status === 'should_virtualize') score += 10;
      else score += 0;
    }

    // Scroll (25 pontos)
    maxScore += 25;
    if (this.results.scroll) {
      if (this.results.scroll.status === 'excellent') score += 25;
      else if (this.results.scroll.status === 'good') score += 20;
      else if (this.results.scroll.status === 'acceptable') score += 15;
      else score += 5;
    }

    // Memória (25 pontos)
    maxScore += 25;
    if (this.results.memory) {
      if (this.results.memory.status === 'excellent') score += 25;
      else if (this.results.memory.status === 'good') score += 20;
      else if (this.results.memory.status === 'high') score += 10;
      else score += 0;
    }

    // Virtualização (25 pontos)
    maxScore += 25;
    if (this.results.virtualization) {
      if (this.results.virtualization.status === 'active') score += 25;
      else if (this.results.virtualization.status === 'partial') score += 15;
      else score += 0;
    }

    const finalScore = (score / maxScore) * 100;

    console.log(`\n📊 SCORE GERAL: ${score}/${maxScore} (${finalScore.toFixed(0)}%)`);

    if (finalScore >= 90) {
      console.log('🌟 CLASSIFICAÇÃO: EXCELENTE');
      console.log('✅ Sistema altamente otimizado!');
    } else if (finalScore >= 75) {
      console.log('✅ CLASSIFICAÇÃO: BOM');
      console.log('💚 Sistema bem otimizado');
    } else if (finalScore >= 60) {
      console.log('🟡 CLASSIFICAÇÃO: ACEITÁVEL');
      console.log('⚠️ Algumas otimizações recomendadas');
    } else {
      console.log('🔴 CLASSIFICAÇÃO: PRECISA MELHORAR');
      console.log('❗ Otimizações urgentes necessárias');
    }

    // Recomendações
    console.log('\n💡 RECOMENDAÇÕES:');

    if (this.results.dom?.status === 'needs_virtualization') {
      console.log('  1. ⚠️ URGENTE: Implementar virtualização (muitos elementos DOM)');
    }

    if (this.results.scroll?.status === 'poor') {
      console.log('  2. ⚠️ URGENTE: Melhorar performance de scroll (FPS baixo)');
    }

    if (this.results.memory?.status === 'critical') {
      console.log('  3. ⚠️ URGENTE: Reduzir uso de memória');
    }

    if (this.results.virtualization?.status === 'none') {
      console.log('  4. 🔧 Implementar componentes virtualizados');
    }

    if (finalScore >= 75) {
      console.log('  ✅ Sistema está bem otimizado. Continue monitorando!');
    }

    console.log('\n' + '='.repeat(60));

    // Exportar dados
    console.log('\n📤 Dados completos:');
    console.log(JSON.stringify(this.results, null, 2));
  }

  // Teste de stress com scroll contínuo
  async stressTest(duration = 10000) {
    console.log('\n' + '='.repeat(60));
    console.log('⚡ TESTE DE STRESS - SCROLL CONTÍNUO');
    console.log(`Duração: ${duration / 1000}s`);
    console.log('='.repeat(60));

    const scrollContainer =
      document.querySelector('[style*="overflow"]') ||
      document.querySelector('.overflow-auto') ||
      window;

    const isWindow = scrollContainer === window;

    const startTime = performance.now();
    const startMemory = performance.memory
      ? performance.memory.usedJSHeapSize / 1048576
      : 0;

    let frameCount = 0;
    const frameTimes = [];
    let lastTime = performance.now();

    return new Promise((resolve) => {
      const stressInterval = setInterval(() => {
        const currentTime = performance.now();
        const frameTime = currentTime - lastTime;
        frameTimes.push(frameTime);
        lastTime = currentTime;

        if (isWindow) {
          window.scrollBy(0, 10);
        } else {
          scrollContainer.scrollTop += 10;
        }

        frameCount++;

        // Voltar ao topo quando chegar ao fim
        const scrollTop = isWindow ? window.scrollY : scrollContainer.scrollTop;
        const scrollHeight = isWindow
          ? document.documentElement.scrollHeight
          : scrollContainer.scrollHeight;
        const clientHeight = isWindow ? window.innerHeight : scrollContainer.clientHeight;

        if (scrollTop >= scrollHeight - clientHeight) {
          if (isWindow) {
            window.scrollTo(0, 0);
          } else {
            scrollContainer.scrollTop = 0;
          }
        }

        // Finalizar após duração
        if (currentTime - startTime >= duration) {
          clearInterval(stressInterval);

          const endTime = performance.now();
          const endMemory = performance.memory
            ? performance.memory.usedJSHeapSize / 1048576
            : 0;

          const totalTime = endTime - startTime;
          const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
          const fps = 1000 / avgFrameTime;
          const memoryGrowth = endMemory - startMemory;

          console.log('\n📊 RESULTADOS DO TESTE DE STRESS:');
          console.log(`  Duração: ${(totalTime / 1000).toFixed(1)}s`);
          console.log(`  Frames: ${frameCount}`);
          console.log(`  FPS médio: ${fps.toFixed(1)}`);
          console.log(`  Memória inicial: ${startMemory.toFixed(1)}MB`);
          console.log(`  Memória final: ${endMemory.toFixed(1)}MB`);
          console.log(`  Crescimento: ${memoryGrowth > 0 ? '+' : ''}${memoryGrowth.toFixed(1)}MB`);

          if (fps >= 55 && memoryGrowth < 10) {
            console.log('\n🟢 RESULTADO: EXCELENTE');
            console.log('✅ Sistema suporta scroll contínuo com alta performance');
          } else if (fps >= 45 && memoryGrowth < 20) {
            console.log('\n✅ RESULTADO: BOM');
            console.log('💚 Performance aceitável em uso intenso');
          } else if (fps >= 30) {
            console.log('\n🟡 RESULTADO: ACEITÁVEL');
            console.log('⚠️ Performance degrada sob stress');
          } else {
            console.log('\n🔴 RESULTADO: RUIM');
            console.log('❌ Performance crítica - virtualização necessária');
          }

          // Voltar ao topo
          if (isWindow) {
            window.scrollTo(0, 0);
          } else {
            scrollContainer.scrollTop = 0;
          }

          resolve({
            fps,
            memoryGrowth,
            frameCount,
            totalTime,
          });
        }
      }, 16); // ~60fps
    });
  }
}

// Instância global
window.virtualizationTester = new VirtualizationTester();

// Atalhos
window.testVirtualization = () => window.virtualizationTester.runAll();
window.testStress = (duration) => window.virtualizationTester.stressTest(duration);

console.log('\n✅ Teste de virtualização carregado!');
console.log('\n📖 Comandos disponíveis:');
console.log('  • testVirtualization() - Teste completo');
console.log('  • testStress(10000) - Teste de stress (10s)');
console.log('  • testStress(30000) - Teste de stress longo (30s)');
console.log('\n💡 Exemplo rápido: testVirtualization()\n');
```

---

## Como Usar

### 1. Teste Rápido (30 segundos)

```javascript
testVirtualization();
```

### 2. Teste de Stress (10 segundos)

```javascript
testStress(10000);
```

### 3. Teste de Stress Longo (30 segundos)

```javascript
testStress(30000);
```

---

## Interpretação dos Resultados

### Score Geral

- **90-100%** 🌟 - EXCELENTE - Sistema altamente otimizado
- **75-89%** ✅ - BOM - Sistema bem otimizado
- **60-74%** 🟡 - ACEITÁVEL - Algumas otimizações recomendadas
- **< 60%** 🔴 - PRECISA MELHORAR - Otimizações urgentes

### Teste de DOM

- **✅ Virtualizado** - Componentes virtualizados detectados
- **✅ OK** - Menos de 50 linhas, aceitável
- **🟡 Deveria virtualizar** - 50-100 linhas
- **🔴 Precisa virtualizar** - Mais de 100 linhas

### Teste de Scroll

- **🟢 55+ FPS** - Excelente
- **✅ 45-54 FPS** - Bom
- **🟡 30-44 FPS** - Aceitável
- **🔴 < 30 FPS** - Ruim, implementar virtualização

### Teste de Memória

- **🟢 < 50 MB** - Excelente
- **✅ 50-100 MB** - Bom
- **🟡 100-200 MB** - Alto
- **🔴 > 200 MB** - Crítico

### Teste de Virtualização

- **✅ Ativo** - React Window + Componentes virtualizados
- **🟡 Parcial** - Alguns componentes virtualizados
- **❌ Nenhum** - Virtualização não detectada

---

## Teste em Diferentes Páginas

### 1. Página de Insumos

```javascript
// Navegar para /fabrica/insumos
await testVirtualization();
```

### 2. Página de Produtos

```javascript
// Navegar para /fabrica/produtos
await testVirtualization();
```

### 3. Página de Obras

```javascript
// Navegar para /construtora/obras
await testVirtualization();
```

---

## Comparação Antes/Depois

### Antes da Virtualização (Exemplo)

```
📊 SCORE GERAL: 45/100 (45%)
🔴 CLASSIFICAÇÃO: PRECISA MELHORAR

Elementos DOM: 500 linhas de tabela
FPS Scroll: 18 FPS
Memória: 180 MB
Virtualização: ❌ Não detectada
```

### Depois da Virtualização (Esperado)

```
📊 SCORE GERAL: 95/100 (95%)
🌟 CLASSIFICAÇÃO: EXCELENTE

Elementos DOM: 10 linhas virtualizadas
FPS Scroll: 60 FPS
Memória: 45 MB
Virtualização: ✅ Ativa
```

---

**Use este script para validar a performance antes e depois da implementação de virtualização!**
