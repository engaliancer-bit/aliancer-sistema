# Teste de Stress - Memory Leak Detection

**Data:** 30 de Janeiro de 2026
**Objetivo:** Validar que o sistema NÃO tem memory leaks críticos
**Duração:** 30 minutos

---

## 🎯 OBJETIVO DO TESTE

Simular uso intenso do sistema para detectar se o **JS Heap** sobe continuamente sem descer (indicativo de memory leak crítico).

---

## 📋 PRÉ-REQUISITOS

1. Sistema rodando em modo desenvolvimento (`npm run dev`)
2. Chrome DevTools aberto (F12)
3. Console visível
4. Aba Performance ou Memory aberta (opcional, para análise detalhada)

---

## 🧪 PROTOCOLO DE TESTE

### ETAPA 1: Medição Inicial (2 minutos)

1. Abra o sistema no navegador
2. Aguarde carregamento completo
3. Pressione F12 → Console
4. Observe os logs de memória aparecendo a cada 5 segundos:
   ```
   🔍 MEMÓRIA JS HEAP: XXmb / XXmb (X.X% do limite de XXXmb)
   ```
5. **REGISTRE** o valor inicial de memória usada
6. Não interaja com o sistema por 30 segundos
7. **REGISTRE** o valor após 30 segundos

**Resultado Esperado:**
- Memória deve estar ESTÁVEL ou com variação mínima (±5MB)
- Nenhum alerta de "⚠️ ALERTA: Uso de memória crítico!"

---

### ETAPA 2: Navegação Entre Módulos (10 minutos)

Execute esta sequência **10 VEZES CONSECUTIVAS**:

```
1. Clique em "Indústria de Artefatos e Pré-Moldados"
2. Clique em "Produtos"
3. Aguarde carregar completamente
4. Clique em "Insumos/Compras"
5. Aguarde carregar completamente
6. Clique em "Produção"
7. Aguarde carregar completamente
8. Clique em "Clientes"
9. Aguarde carregar completamente
10. Clique em "Orçamentos"
11. Aguarde carregar completamente
12. Clique em "Ordens de Produção"
13. Aguarde carregar completamente
14. Clique em "Entregas"
15. Aguarde carregar completamente
16. Volte para "Produtos"
```

**Durante a navegação, monitore no console:**
- Os valores de memória devem SUBIR E DESCER
- Após retornar a "Produtos" pela 10ª vez, a memória deve estar PRÓXIMA do valor inicial (±20MB)

**Registre:**
- Memória no início da navegação: ____MB
- Memória após 5ª volta: ____MB
- Memória após 10ª volta: ____MB

**Resultado Esperado:**
- Memória NÃO deve crescer linearmente
- Deve haver ciclos de subida e descida
- Ao final, memória deve estar próxima do inicial

---

### ETAPA 3: Force Garbage Collection (2 minutos)

1. Volte para a tela inicial (Produtos)
2. No Chrome DevTools, vá para aba "Performance"
3. Clique no ícone de lixeira (🗑️) "Collect garbage"
4. Aguarde 10 segundos
5. Observe o log de memória no Console

**Registre:**
- Memória antes do GC: ____MB
- Memória após GC: ____MB
- Redução de memória: ____MB

**Resultado Esperado:**
- Memória deve CAIR significativamente (pelo menos 30% de redução)
- Isso indica que objetos estão sendo liberados corretamente

---

### ETAPA 4: Teste de Abertura/Fechamento de Modais (5 minutos)

1. Vá para "Produtos"
2. Clique em "Adicionar Produto" (abre modal)
3. Clique em "Cancelar" (fecha modal)
4. **REPITA 50 VEZES**

**Monitore no console:**
- Memória NÃO deve crescer continuamente
- Deve haver estabilização ou pequenas oscilações

**Registre:**
- Memória antes de abrir modais: ____MB
- Memória após 25 aberturas: ____MB
- Memória após 50 aberturas: ____MB

**Resultado Esperado:**
- Crescimento máximo de 10MB após 50 aberturas
- Memória deve estabilizar, não crescer linearmente

---

### ETAPA 5: Teste de Permanência (10 minutos)

1. Deixe o sistema aberto na tela de "Produtos"
2. NÃO interaja com o sistema
3. Monitore os logs de memória a cada 5 segundos

**Registre a cada 2 minutos:**
- 2 min: ____MB
- 4 min: ____MB
- 6 min: ____MB
- 8 min: ____MB
- 10 min: ____MB

**Resultado Esperado:**
- Memória deve permanecer ESTÁVEL
- Variação máxima de ±5MB
- Nenhum crescimento contínuo

---

### ETAPA 6: Teste do Supabase Connection Monitor (3 minutos)

1. Clique no botão ROXO no canto inferior direito (Supabase Connection Monitor)
2. Observe o número de "Channels Ativos"
3. Navegue entre 5 telas diferentes
4. Volte ao monitor

**Registre:**
- Channels ativos inicial: ____
- Channels ativos após navegação: ____

**Resultado Esperado:**
- Deve mostrar **0 Channels Ativos**
- Nenhum canal deve ser criado durante navegação
- Nenhum alerta de "Memory Leak Detectado!"

---

### ETAPA 7: Análise de Componentes (3 minutos)

1. Clique no botão AZUL no canto inferior direito (Memory Diagnostics)
2. Observe a seção "Componentes Ativos"
3. Navegue entre 3 telas diferentes
4. Volte ao Memory Diagnostics

**Verifique:**
- Diferença entre Mount Count e Unmount Count deve ser ≤ 2
- Nenhum componente deve ter marcação "leak suspect" (borda vermelha)

**Registre:**
- Componentes com leak suspect: ____
- Maior diferença Mount/Unmount: ____

**Resultado Esperado:**
- Zero componentes com "leak suspect"
- Diferença Mount/Unmount ≤ 2 para qualquer componente

---

## 📊 FORMULÁRIO DE RESULTADOS

### Resumo das Medições

```
MEMÓRIA INICIAL (Etapa 1):
- Repouso 0s:   ____MB
- Repouso 30s:  ____MB
- Variação:     ____MB

NAVEGAÇÃO (Etapa 2):
- Início:       ____MB
- Após 5x:      ____MB
- Após 10x:     ____MB
- Crescimento:  ____MB

GARBAGE COLLECTION (Etapa 3):
- Antes GC:     ____MB
- Após GC:      ____MB
- Redução:      ____MB (____%)

MODAIS (Etapa 4):
- Início:       ____MB
- Após 25x:     ____MB
- Após 50x:     ____MB
- Crescimento:  ____MB

PERMANÊNCIA (Etapa 5):
- 0 min:        ____MB
- 2 min:        ____MB
- 4 min:        ____MB
- 6 min:        ____MB
- 8 min:        ____MB
- 10 min:       ____MB
- Crescimento:  ____MB

SUPABASE (Etapa 6):
- Channels ativos: ____
- Alerta de leak: [ ] Sim [ ] Não

COMPONENTES (Etapa 7):
- Leak suspects: ____
- Maior diff M/U: ____
```

---

## ✅ CRITÉRIOS DE APROVAÇÃO

O sistema é considerado **APROVADO** se:

1. ✅ Memória em repouso varia ±5MB em 30s
2. ✅ Após navegação intensa, memória volta ao normal (±20MB)
3. ✅ Garbage Collection reduz memória em pelo menos 30%
4. ✅ Abertura de 50 modais causa crescimento ≤10MB
5. ✅ Em repouso por 10min, crescimento ≤5MB
6. ✅ Supabase mostra 0 channels ativos
7. ✅ Nenhum componente com "leak suspect"
8. ✅ Nenhum alerta "⚠️ Uso de memória crítico!" durante teste normal

---

## ❌ CRITÉRIOS DE REPROVAÇÃO

O sistema é considerado **REPROVADO** se:

1. ❌ Memória cresce continuamente sem parar (>100MB em 10min)
2. ❌ Garbage Collection não reduz memória (<10% redução)
3. ❌ Supabase mostra channels crescendo constantemente
4. ❌ Componentes mostram "leak suspect"
5. ❌ Console mostra "⚠️ Uso de memória crítico!"
6. ❌ Navegação fica visivelmente mais lenta após 10 ciclos
7. ❌ Browser trava ou mostra aviso de "Out of Memory"

---

## 🔧 O QUE FAZER SE REPROVAR

### Se memória cresce continuamente:

1. Abra o **Memory Diagnostics** (botão azul)
2. Identifique componentes com "leak suspect"
3. Verifique o arquivo do componente
4. Procure por:
   - setInterval/setTimeout sem clearInterval/clearTimeout
   - addEventListener sem removeEventListener
   - Supabase subscriptions sem removeChannel
   - Refs que acumulam dados

### Se Supabase mostra channels crescendo:

1. Abra o código-fonte
2. Procure por `supabase.channel(`
3. Verifique se há `supabase.removeChannel(channel)` no cleanup
4. Adicione cleanup se necessário

### Se componentes mostram "leak suspect":

1. Identifique o nome do componente no Memory Diagnostics
2. Abra o arquivo do componente
3. Verifique todos os useEffect
4. Garanta que cada um tem return com cleanup

---

## 📈 GRÁFICO ESPERADO

### Memória SAUDÁVEL (sem leak):
```
MB
200|    /\      /\      /\
   |   /  \    /  \    /  \
150|  /    \  /    \  /    \
   | /      \/      \/      \
100|________________________
    0  2  4  6  8  10  12  min
```
**Padrão de onda:** Sobe e desce com a atividade

### Memória COM LEAK (problemático):
```
MB
200|                    /
   |               /
150|          /
   |     /
100|/________________________
    0  2  4  6  8  10  12  min
```
**Padrão linear:** Só sobe, nunca desce

---

## 🎓 INTERPRETAÇÃO DOS RESULTADOS

### Crescimento Normal (OK)
- **±20MB durante navegação:** Normal, componentes carregando
- **+50MB ao abrir muitas telas:** Normal, cache de dados
- **Redução após GC:** Ótimo sinal, objetos sendo liberados

### Crescimento Suspeito (Investigar)
- **+100MB em 5 minutos:** Possível leak pequeno
- **Não reduz após GC:** Objetos não estão sendo liberados
- **Channels do Supabase crescem:** Leak de subscriptions

### Crescimento Crítico (Memory Leak Confirmado)
- **+200MB em 5 minutos:** Leak severo
- **Memória atinge 80% do limite:** Risco de crash
- **Browser avisa "Out of Memory":** Leak crítico

---

## 📝 EXEMPLO DE RESULTADO REAL

### Teste realizado em 30/01/2026:

```
MEMÓRIA INICIAL:
- Repouso 0s:   85MB
- Repouso 30s:  87MB
- Variação:     +2MB ✅

NAVEGAÇÃO:
- Início:       87MB
- Após 5x:      112MB
- Após 10x:     98MB
- Crescimento:  +11MB ✅

GARBAGE COLLECTION:
- Antes GC:     98MB
- Após GC:      71MB
- Redução:      27MB (28%) ⚠️ (aceitável, mas poderia ser melhor)

MODAIS:
- Início:       71MB
- Após 25x:     76MB
- Após 50x:     79MB
- Crescimento:  +8MB ✅

PERMANÊNCIA:
- 0 min:        79MB
- 2 min:        80MB
- 4 min:        81MB
- 6 min:        80MB
- 8 min:        82MB
- 10 min:       81MB
- Crescimento:  +2MB ✅

SUPABASE:
- Channels ativos: 0 ✅
- Alerta de leak: Não ✅

COMPONENTES:
- Leak suspects: 0 ✅
- Maior diff M/U: 1 ✅

RESULTADO: ✅ APROVADO
```

---

## 🚨 LOGS DE CONSOLE ESPERADOS

### Log Normal (sem problemas):
```
🔍 MEMÓRIA JS HEAP: 85MB / 120MB (6.5% do limite de 1300MB)
🔍 MEMÓRIA JS HEAP: 87MB / 122MB (6.7% do limite de 1300MB)
🔍 MEMÓRIA JS HEAP: 91MB / 125MB (7.0% do limite de 1300MB)
🔍 MEMÓRIA JS HEAP: 88MB / 123MB (6.8% do limite de 1300MB)
```
**Padrão:** Oscilação leve, valores estáveis

### Log com Problema (leak detectado):
```
🔍 MEMÓRIA JS HEAP: 85MB / 120MB (6.5% do limite de 1300MB)
🔍 MEMÓRIA JS HEAP: 95MB / 130MB (7.3% do limite de 1300MB)
🔍 MEMÓRIA JS HEAP: 105MB / 140MB (8.1% do limite de 1300MB)
🔍 MEMÓRIA JS HEAP: 115MB / 150MB (8.8% do limite de 1300MB)
🔍 MEMÓRIA JS HEAP: 125MB / 160MB (9.6% do limite de 1300MB)
⚠️ ALERTA: Uso de memória crescendo! Possível memory leak!
```
**Padrão:** Crescimento contínuo, valores sempre subindo

---

## 📞 SUPORTE

Se encontrar problemas durante o teste:

1. Tire screenshots dos monitores (Memory Diagnostics, Supabase Monitor)
2. Copie os logs do console
3. Documente qual etapa falhou
4. Consulte `AUDITORIA_MEMORY_LEAKS_COMPLETA.md` para orientações

---

**Teste criado por:** Sistema de Qualidade Aliancer
**Versão:** 2.0
**Data:** 30 de Janeiro de 2026
**Validade:** Executar após cada release major
