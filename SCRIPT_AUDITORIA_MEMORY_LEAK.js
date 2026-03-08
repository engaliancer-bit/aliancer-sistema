// ============================================================
// SCRIPT AUTOMATIZADO DE AUDITORIA DE MEMORY LEAKS
// Cole no Console do Chrome DevTools (F12)
// ============================================================

class MemoryLeakAuditor {
  constructor() {
    this.snapshots = [];
    this.eventListeners = [];
    this.startTime = Date.now();
    this.monitoringInterval = null;
  }

  // Iniciar auditoria completa (3 minutos)
  async startAudit() {
    console.clear();
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║    AUDITORIA AUTOMÁTICA DE MEMORY LEAKS - 3 MIN      ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    if (!performance.memory) {
      console.error('❌ performance.memory não disponível');
      console.log('\n💡 Para habilitar:');
      console.log('   1. Feche o Chrome');
      console.log('   2. Reinicie com: chrome --enable-precise-memory-info');
      console.log('   3. Abra DevTools e execute novamente\n');
      return;
    }

    console.log('✅ performance.memory disponível\n');
    console.log('📋 INSTRUÇÕES:');
    console.log('   1. Use o sistema NORMALMENTE por 3 minutos');
    console.log('   2. Navegue entre abas/componentes');
    console.log('   3. Abra e feche dropdowns/modais');
    console.log('   4. Aguarde o resultado automático\n');
    console.log('⏱️  Iniciando em 3 segundos...\n');

    await this.sleep(3000);

    console.log('🔍 AUDITORIA INICIADA!\n');
    console.log('═'.repeat(60) + '\n');

    // Fase 1: Baseline
    this.takeSnapshot();
    this.countEventListeners();

    // Fase 2: Monitoramento (snapshots a cada 20s por 3 min)
    let elapsed = 0;
    this.monitoringInterval = setInterval(() => {
      elapsed += 20;

      if (elapsed >= 180) {
        clearInterval(this.monitoringInterval);
        this.generateReport();
        return;
      }

      this.takeSnapshot();
      this.countEventListeners();

      const progress = Math.round((elapsed / 180) * 100);
      console.log(`[${elapsed}s] Progresso: ${progress}% | ${this.snapshots[this.snapshots.length - 1].usedMB}MB`);
    }, 20000);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  takeSnapshot() {
    if (!performance.memory) return;

    const snapshot = {
      timestamp: Date.now() - this.startTime,
      usedMB: Math.round(performance.memory.usedJSHeapSize / 1048576),
      totalMB: Math.round(performance.memory.totalJSHeapSize / 1048576),
      limitMB: Math.round(performance.memory.jsHeapSizeLimit / 1048576),
    };

    this.snapshots.push(snapshot);
    return snapshot;
  }

  countEventListeners() {
    const events = ['click', 'scroll', 'resize', 'mousedown', 'mouseup', 'keydown', 'keyup'];
    let total = 0;

    events.forEach(event => {
      try {
        const listeners = getEventListeners(window)[event] || [];
        total += listeners.length;
      } catch (e) {
        // getEventListeners não disponível
      }
    });

    this.eventListeners.push({
      timestamp: Date.now() - this.startTime,
      count: total,
    });
  }

  generateReport() {
    console.log('\n' + '═'.repeat(60));
    console.log('📊 RELATÓRIO DE AUDITORIA DE MEMORY LEAK');
    console.log('═'.repeat(60) + '\n');

    if (this.snapshots.length < 2) {
      console.error('❌ Dados insuficientes para análise');
      return;
    }

    const first = this.snapshots[0];
    const last = this.snapshots[this.snapshots.length - 1];
    const middle = this.snapshots[Math.floor(this.snapshots.length / 2)];

    // Análise de Memória
    console.log('📈 ANÁLISE DE MEMÓRIA:\n');

    const timeMinutes = (last.timestamp - first.timestamp) / 60000;
    const growth = last.usedMB - first.usedMB;
    const growthRate = growth / timeMinutes;

    console.log(`   Tempo Total:        ${timeMinutes.toFixed(1)} minutos`);
    console.log(`   Memória Inicial:    ${first.usedMB} MB`);
    console.log(`   Memória Meio:       ${middle.usedMB} MB`);
    console.log(`   Memória Final:      ${last.usedMB} MB`);
    console.log(`   Crescimento Total:  ${growth > 0 ? '+' : ''}${growth} MB`);
    console.log(`   Taxa Crescimento:   ${growthRate > 0 ? '+' : ''}${growthRate.toFixed(2)} MB/min`);

    console.log('\n' + '─'.repeat(60) + '\n');

    // Análise de Event Listeners
    if (this.eventListeners.length >= 2) {
      console.log('🎧 ANÁLISE DE EVENT LISTENERS:\n');

      const firstListeners = this.eventListeners[0];
      const lastListeners = this.eventListeners[this.eventListeners.length - 1];
      const listenerGrowth = lastListeners.count - firstListeners.count;

      console.log(`   Inicial:       ${firstListeners.count} listeners`);
      console.log(`   Final:         ${lastListeners.count} listeners`);
      console.log(`   Crescimento:   ${listenerGrowth > 0 ? '+' : ''}${listenerGrowth} listeners`);

      console.log('\n' + '─'.repeat(60) + '\n');
    }

    // Análise de Tendência
    console.log('📊 ANÁLISE DE TENDÊNCIA:\n');

    const samples = this.snapshots.map(s => s.usedMB);
    const slope = this.calculateSlope(samples);

    if (slope > 5) {
      console.log('   📈 Crescimento LINEAR CONSTANTE (⚠️ Leak provável)');
    } else if (slope > 2) {
      console.log('   📈 Crescimento gradual (⚠️ Monitorar)');
    } else if (slope < -2) {
      console.log('   📉 Decrescendo (✅ GC funcionando)');
    } else {
      console.log('   ➡️  Estável (✅ Normal)');
    }

    console.log('\n' + '═'.repeat(60) + '\n');

    // VEREDICTO FINAL
    console.log('🎯 VEREDICTO FINAL:\n');

    const issues = [];
    let severity = 'success'; // success, warning, critical

    if (growthRate > 10) {
      severity = 'critical';
      issues.push({
        level: 'CRÍTICO',
        message: `Memory leak SEVERO: ${growthRate.toFixed(1)}MB/min`,
        icon: '🔴',
      });
    } else if (growthRate > 3) {
      severity = 'warning';
      issues.push({
        level: 'ATENÇÃO',
        message: `Possível memory leak: ${growthRate.toFixed(1)}MB/min`,
        icon: '🟡',
      });
    }

    if (this.eventListeners.length >= 2) {
      const listenerGrowth = this.eventListeners[this.eventListeners.length - 1].count -
                            this.eventListeners[0].count;

      if (listenerGrowth > 10) {
        severity = severity === 'critical' ? 'critical' : 'warning';
        issues.push({
          level: 'CRÍTICO',
          message: `Event listeners vazando: +${listenerGrowth}`,
          icon: '🔴',
        });
      }
    }

    if (last.usedMB > 200) {
      severity = severity === 'critical' ? 'critical' : 'warning';
      issues.push({
        level: 'ATENÇÃO',
        message: `Memória muito alta: ${last.usedMB}MB`,
        icon: '🟡',
      });
    }

    if (issues.length === 0) {
      console.log('✅ ✅ ✅ PASSOU - SISTEMA SAUDÁVEL! ✅ ✅ ✅\n');
      console.log('   • Crescimento de memória aceitável');
      console.log('   • Taxa: ' + growthRate.toFixed(2) + 'MB/min (< 3MB/min)');
      console.log('   • Nenhum leak detectado');
      console.log('\n🎉 Sistema funcionando corretamente!\n');
    } else {
      if (severity === 'critical') {
        console.error('❌ ❌ ❌ FALHOU - MEMORY LEAK DETECTADO! ❌ ❌ ❌\n');
      } else {
        console.warn('⚠️  ⚠️  ⚠️  ATENÇÃO - PROBLEMAS DETECTADOS ⚠️  ⚠️  ⚠️\n');
      }

      issues.forEach(issue => {
        console.log(`   ${issue.icon} [${issue.level}] ${issue.message}`);
      });

      console.log('\n💡 PRÓXIMOS PASSOS:\n');
      console.log('   1. Abra DevTools > Memory > Take Heap Snapshot');
      console.log('   2. Use sistema por 1-2 minutos');
      console.log('   3. Take Heap Snapshot novamente');
      console.log('   4. Compare snapshots (Comparison view)');
      console.log('   5. Identifique objetos com maior crescimento');
      console.log('\n   COMPONENTES SUSPEITOS:');
      console.log('   • Dashboard.tsx - Verificar setInterval');
      console.log('   • DeadlineAlerts.tsx - Verificar polling');
      console.log('   • OptimizedSelect.tsx - Verificar event listeners');
      console.log('   • Listas grandes - Verificar cleanup\n');
    }

    console.log('═'.repeat(60) + '\n');

    // Gráfico ASCII
    console.log('📊 GRÁFICO DE EVOLUÇÃO DA MEMÓRIA:\n');
    this.renderGraph();

    console.log('\n' + '═'.repeat(60) + '\n');

    // Recomendações
    if (issues.length > 0) {
      console.log('🔧 RECOMENDAÇÕES DE CORREÇÃO:\n');

      if (growthRate > 3) {
        console.log('   1. VERIFICAR TIMERS:');
        console.log('      • Todos setInterval devem ter clearInterval no cleanup');
        console.log('      • Todos setTimeout devem ter clearTimeout no cleanup\n');

        console.log('   2. VERIFICAR EVENT LISTENERS:');
        console.log('      • addEventListener deve ter removeEventListener');
        console.log('      • Usar { once: true } quando apropriado\n');

        console.log('   3. VERIFICAR REFERÊNCIAS:');
        console.log('      • Closures podem manter referências grandes');
        console.log('      • Limpar refs manualmente no cleanup\n');

        console.log('   4. ADICIONAR ABORT CONTROLLER:');
        console.log('      • Cancelar requests pendentes ao desmontar');
        console.log('      • Usar AbortController para fetch/axios\n');
      }

      console.log('═'.repeat(60) + '\n');
    }

    // Exportar dados
    window.memoryAuditReport = {
      snapshots: this.snapshots,
      eventListeners: this.eventListeners,
      summary: {
        growthRate,
        growth,
        timeMinutes,
        severity,
        issues,
      },
    };

    console.log('💾 Relatório salvo em: window.memoryAuditReport');
    console.log('   Use para análise detalhada ou exportação\n');
  }

  calculateSlope(values) {
    const n = values.length;
    const indices = Array.from({ length: n }, (_, i) => i);

    const sumX = indices.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = indices.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);

    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  renderGraph() {
    const max = Math.max(...this.snapshots.map(s => s.usedMB));
    const min = Math.min(...this.snapshots.map(s => s.usedMB));

    this.snapshots.forEach((s, i) => {
      const elapsed = Math.floor(s.timestamp / 1000);
      const normalized = max - min > 0 ? ((s.usedMB - min) / (max - min)) : 0.5;
      const bars = Math.round(normalized * 40);
      const bar = '█'.repeat(bars);

      console.log(`   ${String(elapsed).padStart(3)}s │${bar} ${s.usedMB}MB`);
    });
  }

  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.generateReport();
    }
  }
}

// ============================================================
// TESTE RÁPIDO (30 SEGUNDOS)
// ============================================================

class QuickMemoryTest {
  async run() {
    console.clear();
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║         TESTE RÁPIDO DE MEMORY LEAK - 30s            ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    if (!performance.memory) {
      console.error('❌ performance.memory não disponível');
      return;
    }

    const snapshots = [];

    for (let i = 0; i <= 30; i += 5) {
      const mb = Math.round(performance.memory.usedJSHeapSize / 1048576);
      snapshots.push({ time: i, mb });
      console.log(`[${i}s] ${mb}MB`);

      if (i < 30) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    const growth = last.mb - first.mb;
    const growthRate = (growth / 0.5); // 30s = 0.5 min

    console.log('\n' + '═'.repeat(50));
    console.log('📊 RESULTADO:');
    console.log('═'.repeat(50));
    console.log(`   Crescimento: ${growth > 0 ? '+' : ''}${growth}MB em 30s`);
    console.log(`   Taxa: ~${growthRate.toFixed(1)}MB/min`);

    if (growthRate > 10) {
      console.error('\n🔴 FALHOU - Memory leak detectado!');
    } else if (growthRate > 3) {
      console.warn('\n🟡 ATENÇÃO - Possível leak');
    } else {
      console.log('\n✅ PASSOU - Sistema saudável');
    }
  }
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================

window.memoryAuditor = new MemoryLeakAuditor();
window.quickTest = new QuickMemoryTest();

console.clear();
console.log('╔═══════════════════════════════════════════════════════╗');
console.log('║     FERRAMENTAS DE AUDITORIA DE MEMORY LEAK          ║');
console.log('╚═══════════════════════════════════════════════════════╝\n');

console.log('✅ Ferramentas carregadas com sucesso!\n');
console.log('📝 COMANDOS DISPONÍVEIS:\n');
console.log('   🔍 AUDITORIA COMPLETA (3 minutos):');
console.log('      memoryAuditor.startAudit()');
console.log('         → Análise detalhada com gráfico e relatório\n');

console.log('   ⚡ TESTE RÁPIDO (30 segundos):');
console.log('      quickTest.run()');
console.log('         → Verificação rápida de crescimento\n');

console.log('   ⏹️  PARAR AUDITORIA:');
console.log('      memoryAuditor.stop()');
console.log('         → Parar e gerar relatório imediatamente\n');

console.log('═'.repeat(60) + '\n');
console.log('💡 RECOMENDAÇÃO: Execute a auditoria completa primeiro\n');
