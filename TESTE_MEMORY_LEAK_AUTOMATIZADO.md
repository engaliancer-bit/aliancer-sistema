# Teste Automatizado de Memory Leak

## Como Executar

### 1. Iniciar Chrome com Garbage Collection Exposto

```bash
# Windows
chrome.exe --js-flags="--expose-gc" --enable-precise-memory-info

# Mac
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --js-flags="--expose-gc" --enable-precise-memory-info

# Linux
google-chrome --js-flags="--expose-gc" --enable-precise-memory-info
```

### 2. Executar Script de Teste

Abra o console do Chrome (F12) e cole este script:

```javascript
// ============================================================
// TESTE AUTOMATIZADO DE MEMORY LEAK
// ============================================================

class MemoryLeakTester {
  constructor() {
    this.snapshots = [];
    this.isRunning = false;
    this.interval = null;
  }

  // Tirar snapshot de memória
  takeSnapshot() {
    if (!performance.memory) {
      console.error('❌ performance.memory não disponível. Use Chrome com --enable-precise-memory-info');
      return null;
    }

    // Forçar GC se disponível
    if (window.gc) {
      window.gc();
    }

    const snapshot = {
      timestamp: Date.now(),
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
    };

    this.snapshots.push(snapshot);
    return snapshot;
  }

  // Analisar tendência de memória
  analyzeTrend() {
    if (this.snapshots.length < 5) {
      return {
        status: 'insufficient_data',
        message: 'Coletando dados... (mínimo 5 snapshots)',
      };
    }

    const usedMemoryMB = this.snapshots.map(s => s.usedJSHeapSize / 1048576);
    const currentMB = usedMemoryMB[usedMemoryMB.length - 1];
    const firstMB = usedMemoryMB[0];
    const growthMB = currentMB - firstMB;

    const timeSpanMinutes = (this.snapshots[this.snapshots.length - 1].timestamp - this.snapshots[0].timestamp) / 60000;
    const growthRate = timeSpanMinutes > 0 ? growthMB / timeSpanMinutes : 0;

    // Calcular tendência linear
    const n = usedMemoryMB.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = usedMemoryMB.reduce((a, b) => a + b, 0);
    const sumXY = usedMemoryMB.reduce((sum, y, x) => sum + x * y, 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    let status, message, recommendation;

    if (growthRate > 10 || slope > 2) {
      status = 'LEAK_DETECTED';
      message = `🔴 MEMORY LEAK DETECTADO! Crescimento: ${growthRate.toFixed(1)}MB/min`;
      recommendation = 'CRÍTICO: Investigar imediatamente com DevTools Memory Profiler';
    } else if (growthRate > 5 || slope > 1) {
      status = 'HIGH_GROWTH';
      message = `⚠️ Crescimento Alto: ${growthRate.toFixed(1)}MB/min`;
      recommendation = 'Monitorar de perto. Pode indicar leak.';
    } else if (growthRate > 2) {
      status = 'MODERATE_GROWTH';
      message = `🟡 Crescimento Moderado: ${growthRate.toFixed(1)}MB/min`;
      recommendation = 'Aceitável, mas monitorar.';
    } else {
      status = 'STABLE';
      message = `✅ Memória Estável: ${growthRate.toFixed(1)}MB/min`;
      recommendation = 'Sistema saudável!';
    }

    return {
      status,
      message,
      recommendation,
      stats: {
        currentMB: currentMB.toFixed(1),
        firstMB: firstMB.toFixed(1),
        growthMB: growthMB.toFixed(1),
        growthRate: growthRate.toFixed(2),
        slope: slope.toFixed(4),
        samples: n,
        timeMinutes: timeSpanMinutes.toFixed(1),
      },
    };
  }

  // Imprimir relatório
  printReport() {
    const analysis = this.analyzeTrend();

    console.log('\n' + '='.repeat(60));
    console.log('📊 RELATÓRIO DE MEMORY LEAK');
    console.log('='.repeat(60));
    console.log(`Status: ${analysis.status}`);
    console.log(`Mensagem: ${analysis.message}`);
    console.log(`Recomendação: ${analysis.recommendation}`);

    if (analysis.stats) {
      console.log('\n📈 Estatísticas:');
      console.log(`  • Memória Atual: ${analysis.stats.currentMB} MB`);
      console.log(`  • Memória Inicial: ${analysis.stats.firstMB} MB`);
      console.log(`  • Crescimento Total: ${analysis.stats.growthMB} MB`);
      console.log(`  • Taxa de Crescimento: ${analysis.stats.growthRate} MB/min`);
      console.log(`  • Slope (tendência): ${analysis.stats.slope}`);
      console.log(`  • Amostras: ${analysis.stats.samples}`);
      console.log(`  • Tempo Decorrido: ${analysis.stats.timeMinutes} min`);
    }

    console.log('='.repeat(60) + '\n');

    return analysis;
  }

  // Iniciar teste automático
  start(intervalSeconds = 10, durationMinutes = 5) {
    if (this.isRunning) {
      console.warn('⚠️ Teste já está em execução');
      return;
    }

    this.isRunning = true;
    this.snapshots = [];

    console.log('🚀 Iniciando teste de memory leak...');
    console.log(`⏱️ Intervalo: ${intervalSeconds}s | Duração: ${durationMinutes}min`);
    console.log('📝 Use sistema normalmente durante o teste.\n');

    // Snapshot inicial
    this.takeSnapshot();

    // Snapshots periódicos
    let count = 1;
    const maxCount = Math.floor((durationMinutes * 60) / intervalSeconds);

    this.interval = setInterval(() => {
      this.takeSnapshot();

      const analysis = this.analyzeTrend();
      const lastMB = (this.snapshots[this.snapshots.length - 1].usedJSHeapSize / 1048576).toFixed(1);

      console.log(`[${count}/${maxCount}] Memória: ${lastMB}MB - ${analysis.message}`);

      count++;

      if (count > maxCount) {
        this.stop();
        this.printReport();
      }
    }, intervalSeconds * 1000);

    // Auto-stop após duração
    setTimeout(() => {
      if (this.isRunning) {
        this.stop();
        this.printReport();
      }
    }, durationMinutes * 60 * 1000);
  }

  // Parar teste
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    console.log('\n⏹️ Teste finalizado.\n');
  }

  // Exportar dados
  exportData() {
    const data = {
      snapshots: this.snapshots.map(s => ({
        time: new Date(s.timestamp).toISOString(),
        usedMB: (s.usedJSHeapSize / 1048576).toFixed(2),
        totalMB: (s.totalJSHeapSize / 1048576).toFixed(2),
      })),
      analysis: this.analyzeTrend(),
    };

    console.log('📤 Exportando dados:');
    console.log(JSON.stringify(data, null, 2));

    // Copiar para clipboard se disponível
    if (navigator.clipboard) {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      console.log('✅ Dados copiados para clipboard!');
    }

    return data;
  }

  // Gerar gráfico ASCII
  plotGraph() {
    if (this.snapshots.length < 2) {
      console.log('❌ Dados insuficientes para gráfico');
      return;
    }

    const usedMemoryMB = this.snapshots.map(s => s.usedJSHeapSize / 1048576);
    const maxMB = Math.max(...usedMemoryMB);
    const minMB = Math.min(...usedMemoryMB);
    const range = maxMB - minMB || 1;

    console.log('\n' + '='.repeat(60));
    console.log('📊 GRÁFICO DE MEMÓRIA (ASCII)');
    console.log('='.repeat(60));

    const height = 15;
    const width = Math.min(usedMemoryMB.length, 60);

    // Normalizar para a largura
    const step = Math.ceil(usedMemoryMB.length / width);
    const normalizedData = [];
    for (let i = 0; i < usedMemoryMB.length; i += step) {
      const chunk = usedMemoryMB.slice(i, i + step);
      const avg = chunk.reduce((a, b) => a + b, 0) / chunk.length;
      normalizedData.push(avg);
    }

    // Desenhar gráfico
    for (let y = height; y >= 0; y--) {
      const value = minMB + (range * y / height);
      let line = `${value.toFixed(0).padStart(4)}MB |`;

      for (let x = 0; x < normalizedData.length; x++) {
        const pointValue = normalizedData[x];
        const pointY = Math.round(((pointValue - minMB) / range) * height);

        if (pointY === y) {
          line += '●';
        } else if (pointY > y) {
          line += '│';
        } else {
          line += ' ';
        }
      }

      console.log(line);
    }

    console.log('     ' + '+' + '-'.repeat(normalizedData.length));
    console.log(`     ${this.snapshots[0].timestamp}`.padEnd(30) + `${this.snapshots[this.snapshots.length - 1].timestamp}`);
    console.log('='.repeat(60) + '\n');
  }
}

// Criar instância global
window.memoryTester = new MemoryLeakTester();

// Atalhos
window.startMemoryTest = (interval = 10, duration = 5) => {
  window.memoryTester.start(interval, duration);
};

window.stopMemoryTest = () => {
  window.memoryTester.stop();
  window.memoryTester.printReport();
};

window.memoryReport = () => {
  window.memoryTester.printReport();
};

window.memoryGraph = () => {
  window.memoryTester.plotGraph();
};

window.memoryExport = () => {
  return window.memoryTester.exportData();
};

console.log('\n✅ Memory Leak Tester carregado!');
console.log('\n📖 Comandos disponíveis:');
console.log('  • startMemoryTest(intervalSeg, duracaoMin) - Iniciar teste (padrão: 10s, 5min)');
console.log('  • stopMemoryTest() - Parar e gerar relatório');
console.log('  • memoryReport() - Ver relatório atual');
console.log('  • memoryGraph() - Gráfico ASCII');
console.log('  • memoryExport() - Exportar dados JSON');
console.log('\n💡 Exemplo: startMemoryTest(5, 3) - teste de 3min com snapshots a cada 5s\n');
```

### 3. Executar Teste

```javascript
// Teste rápido (3 minutos, snapshots a cada 5 segundos)
startMemoryTest(5, 3);

// Teste padrão (5 minutos, snapshots a cada 10 segundos)
startMemoryTest();

// Teste longo (10 minutos, snapshots a cada 15 segundos)
startMemoryTest(15, 10);
```

### 4. Interpretar Resultados

#### ✅ Resultado BOM (Sem Leak)

```
📊 RELATÓRIO DE MEMORY LEAK
============================================================
Status: STABLE
Mensagem: ✅ Memória Estável: 1.2MB/min
Recomendação: Sistema saudável!

📈 Estatísticas:
  • Memória Atual: 68.5 MB
  • Memória Inicial: 62.3 MB
  • Crescimento Total: 6.2 MB
  • Taxa de Crescimento: 1.24 MB/min
  • Slope (tendência): 0.1523
  • Amostras: 30
  • Tempo Decorrido: 5.0 min
============================================================
```

#### ⚠️ Resultado MODERADO

```
📊 RELATÓRIO DE MEMORY LEAK
============================================================
Status: MODERATE_GROWTH
Mensagem: 🟡 Crescimento Moderado: 3.8MB/min
Recomendação: Aceitável, mas monitorar.

📈 Estatísticas:
  • Memória Atual: 81.2 MB
  • Memória Inicial: 62.3 MB
  • Crescimento Total: 18.9 MB
  • Taxa de Crescimento: 3.78 MB/min
  • Slope (tendência): 0.6234
============================================================
```

#### 🔴 Resultado RUIM (Leak Detectado)

```
📊 RELATÓRIO DE MEMORY LEAK
============================================================
Status: LEAK_DETECTED
Mensagem: 🔴 MEMORY LEAK DETECTADO! Crescimento: 12.5MB/min
Recomendação: CRÍTICO: Investigar imediatamente com DevTools Memory Profiler

📈 Estatísticas:
  • Memória Atual: 124.8 MB
  • Memória Inicial: 62.3 MB
  • Crescimento Total: 62.5 MB
  • Taxa de Crescimento: 12.50 MB/min
  • Slope (tendência): 2.1234
============================================================
```

---

## Ações Após Detectar Leak

### 1. Ver Gráfico

```javascript
memoryGraph();
```

### 2. Exportar Dados

```javascript
const data = memoryExport();
// Dados copiados para clipboard automaticamente
```

### 3. Investigar no Chrome DevTools

```
1. Abrir DevTools (F12)
2. Ir para aba "Memory"
3. Selecionar "Heap snapshot"
4. Tirar snapshot antes de usar sistema
5. Usar sistema por 2-3 minutos
6. Tirar segundo snapshot
7. Clicar em "Comparison" no segundo snapshot
8. Procurar por:
   - Objects com muitas instâncias
   - Arrays crescendo
   - Detached DOM nodes
   - Event listeners
```

### 4. Buscar Causas Comuns

```javascript
// Verificar channels do Supabase
console.log('Supabase Channels:', supabase.getChannels().length);

// Listar todos os intervals/timeouts ativos (aproximado)
console.log('Timers ativos estimados:',
  performance.getEntriesByType('measure').length
);
```

---

## Cenários de Teste

### Cenário 1: Teste Básico de Navegação

```
1. Iniciar teste: startMemoryTest(10, 5)
2. Navegar entre abas principais (Fábrica, Engenharia, Construtora)
3. Abrir e fechar modals
4. Aguardar conclusão do teste
5. Verificar relatório
```

### Cenário 2: Teste de Formulários

```
1. Iniciar teste: startMemoryTest(5, 3)
2. Abrir formulário de cadastro de produtos
3. Preencher campos
4. Salvar
5. Abrir outro produto
6. Repetir 5-10 vezes
7. Verificar relatório
```

### Cenário 3: Teste de Listas

```
1. Iniciar teste: startMemoryTest(10, 5)
2. Abrir lista de produtos
3. Pesquisar produtos
4. Rolar lista
5. Abrir e fechar produtos
6. Mudar filtros
7. Verificar relatório
```

### Cenário 4: Teste de Dashboard

```
1. Iniciar teste: startMemoryTest(15, 10)
2. Ficar na tela de Dashboard
3. Deixar timers rodando (alertas, métricas)
4. Aguardar 10 minutos
5. Verificar se memória cresce continuamente
```

---

## Automação Completa

Para teste totalmente automatizado, use este script:

```javascript
async function runFullMemoryAudit() {
  console.log('🏁 Iniciando auditoria completa de memória...\n');

  const scenarios = [
    {
      name: 'Navegação Básica',
      duration: 3,
      interval: 5,
      actions: async () => {
        // Simular cliques em abas
        const tabs = ['factory', 'engineering', 'construction'];
        for (const tab of tabs) {
          console.log(`  Navegando para ${tab}...`);
          // Aqui você pode simular cliques reais se necessário
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    },
    {
      name: 'Dashboard Estático',
      duration: 5,
      interval: 10,
      actions: async () => {
        console.log('  Aguardando em dashboard...');
        // Apenas esperar
      }
    }
  ];

  const results = [];

  for (const scenario of scenarios) {
    console.log(`\n🧪 Testando: ${scenario.name}`);
    console.log(`   Duração: ${scenario.duration}min | Intervalo: ${scenario.interval}s\n`);

    // Limpar snapshots anteriores
    window.memoryTester.snapshots = [];

    // Executar ações do cenário
    if (scenario.actions) {
      await scenario.actions();
    }

    // Iniciar teste
    window.memoryTester.start(scenario.interval, scenario.duration);

    // Aguardar conclusão
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (!window.memoryTester.isRunning) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 1000);
    });

    // Coletar resultado
    const analysis = window.memoryTester.analyzeTrend();
    results.push({
      scenario: scenario.name,
      ...analysis
    });

    console.log(`\n✅ ${scenario.name} concluído\n`);
    console.log('='.repeat(60));
  }

  // Relatório final
  console.log('\n' + '='.repeat(60));
  console.log('📋 RELATÓRIO FINAL DA AUDITORIA');
  console.log('='.repeat(60));

  results.forEach(result => {
    console.log(`\n${result.scenario}:`);
    console.log(`  Status: ${result.status}`);
    console.log(`  ${result.message}`);
    if (result.stats) {
      console.log(`  Taxa: ${result.stats.growthRate} MB/min`);
    }
  });

  const hasLeak = results.some(r => r.status === 'LEAK_DETECTED');
  const hasHighGrowth = results.some(r => r.status === 'HIGH_GROWTH');

  console.log('\n' + '='.repeat(60));
  if (hasLeak) {
    console.log('🔴 RESULTADO: MEMORY LEAK DETECTADO!');
  } else if (hasHighGrowth) {
    console.log('⚠️ RESULTADO: CRESCIMENTO ALTO - MONITORAR');
  } else {
    console.log('✅ RESULTADO: SISTEMA SAUDÁVEL');
  }
  console.log('='.repeat(60) + '\n');

  return results;
}

// Executar
window.runFullMemoryAudit = runFullMemoryAudit;

console.log('✅ Auditoria automática carregada!');
console.log('   Execute: runFullMemoryAudit()');
```

---

## Valores de Referência

| Status | Taxa Crescimento | Ação |
|--------|------------------|------|
| ✅ Estável | &lt; 2 MB/min | Nenhuma |
| 🟡 Moderado | 2-5 MB/min | Monitorar |
| ⚠️ Alto | 5-10 MB/min | Investigar |
| 🔴 Leak | &gt; 10 MB/min | Correção urgente |

---

**Use este teste regularmente para garantir que o sistema permanece saudável!**
