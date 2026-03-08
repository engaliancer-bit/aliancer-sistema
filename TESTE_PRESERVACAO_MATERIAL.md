# Teste: Preservação de Material e Diâmetro ao Alterar Comprimento

## Objetivo

Verificar se o material e diâmetro das armaduras são preservados ao alterar o comprimento do produto.

## Teste Rápido (5 minutos)

### Passo 1: Criar Produto com Fôrma

1. Menu → **Produtos** → **Novo Cadastro**
2. Preencher:
   ```
   Nome: Teste Preservação
   Código: TEST-PRES
   Tipo: Pré-Moldado
   ```
3. Selecionar uma **Fôrma** (ex: Viga V-15x30)
4. Informar **Comprimento**: `10` metros
5. Clicar **"Carregar Dados da Fôrma"** (se necessário)

### Passo 2: Preencher Material e Diâmetro

Nas armaduras carregadas, preencher pelo menos 2 armaduras:

**Exemplo:**
```
E1 - Padrão do comprimento:
├─ Material: [Selecione um material, ex: "Ferro CA-60 Ø 5.0mm"]
└─ Diâmetro: 5.0

A - Armadura Superior:
├─ Material: [Selecione um material, ex: "Ferro CA-50 Ø 10.0mm"]
└─ Diâmetro: 10.0
```

### Passo 3: Abrir Console do Navegador

1. Pressione **F12**
2. Vá para a aba **"Console"**
3. Limpe o console (botão 🚫 ou Ctrl+L)

### Passo 4: Alterar o Comprimento

1. No campo **"Comprimento Total da Peça"**, altere de `10` para `5`
2. Observe o console

### Passo 5: Verificar os Logs

No console, você deve ver algo como:

```
♻️ Recalculando armaduras com novo comprimento: 5
🔍 Carregando dados da fôrma: abc123...

💾 Preservando dados de: transversal-E1-Padrão do comprimento
   material_id: "xyz789"
   material_name: "Ferro CA-60 Ø 5.0mm"
   diameter: 5

💾 Preservando dados de: longitudinal-A-...
   material_id: "abc456"
   material_name: "Ferro CA-50 Ø 10.0mm"
   diameter: 10

📏 Diferença de comprimento: -5m (Produto: 5m - Referência: 10m)
⭐ Ajustando estribo PADRÃO "E1": 66 estribos / 10m × 5m = 33 estribos

♻️ Restaurando dados de: transversal-E1-Padrão do comprimento
♻️ Restaurando dados de: longitudinal-A-...

✅ Armaduras carregadas da fôrma: X armaduras
```

### Passo 6: Verificar na Interface

Confirme que as armaduras mantêm:

```
E1 - Padrão do comprimento:
├─ Quantidade: 33 estribos  ✅ RECALCULADO (era 66)
├─ Material: Ferro CA-60 Ø 5.0mm  ✅ PRESERVADO
└─ Diâmetro: 5.0  ✅ PRESERVADO

A - Armadura Superior:
├─ Comprimento: ~5.2m  ✅ RECALCULADO (era ~10.2m)
├─ Material: Ferro CA-50 Ø 10.0mm  ✅ PRESERVADO
└─ Diâmetro: 10.0  ✅ PRESERVADO
```

## ✅ Critérios de Sucesso

- [ ] Console mostra logs `💾 Preservando dados de:`
- [ ] Console mostra logs `♻️ Restaurando dados de:`
- [ ] Material continua selecionado após alterar comprimento
- [ ] Diâmetro continua preenchido após alterar comprimento
- [ ] Quantidades/comprimentos foram recalculados
- [ ] Nenhum erro aparece no console

## ❌ Problema (Se Ocorrer)

Se após alterar o comprimento:
- Material volta para vazio
- Diâmetro volta para 0
- Você precisa preencher tudo novamente

**→ A correção NÃO está funcionando!**

## Teste Avançado

### Cenário 1: Múltiplas Alterações

1. Altere comprimento: `10` → `5`
2. Verifique preservação ✅
3. Altere comprimento: `5` → `8`
4. Verifique preservação ✅
5. Altere comprimento: `8` → `3.5`
6. Verifique preservação ✅

**Resultado esperado:**
- Material e diâmetro devem ser preservados em TODAS as alterações

### Cenário 2: Salvar e Editar

1. Preencha material e diâmetro
2. **Salve** o produto
3. **Edite** o produto novamente
4. Altere o comprimento
5. Verifique preservação ✅

**Resultado esperado:**
- Dados devem ser preservados mesmo após salvar e reabrir

### Cenário 3: Trocar de Fôrma

1. Configure produto com Fôrma A
2. Preencha materiais e diâmetros
3. Selecione **outra Fôrma B**
4. Volte para **Fôrma A**

**Resultado esperado:**
- ⚠️ Dados serão PERDIDOS (comportamento correto!)
- Motivo: Fôrma diferente = armaduras diferentes

### Cenário 4: Nova Armadura na Fôrma

1. Configure produto com fôrma (3 armaduras)
2. Preencha materiais
3. Vá em **Fôrmas** e adicione uma 4ª armadura
4. Volte ao produto e recarregue a fôrma

**Resultado esperado:**
- ✅ 3 armaduras originais: dados preservados
- ℹ️ 4ª armadura: vazia (é nova)

## Comparação Antes e Depois

### ❌ Comportamento Antigo

```
[Preencher material]  →  [Alterar comprimento]  →  [Material PERDIDO]
      Trabalho                  Ação                    Frustração
        ⏱️                       ⏱️                         😡
                                                    [Preencher NOVAMENTE]
                                                           ⏱️⏱️
```

### ✅ Comportamento Novo

```
[Preencher material]  →  [Alterar comprimento]  →  [Material PRESERVADO]
      Trabalho                  Ação                      Satisfação
        ⏱️                       ⏱️                           😊
                                                          [Pronto!]
```

## Troubleshooting

### Problema: Logs não aparecem

**Verificar:**
1. Console está aberto? (F12)
2. Filtro do console não está ocultando? (deve mostrar "Info")
3. Você realmente alterou o comprimento?

### Problema: Material ainda é perdido

**Verificar:**
1. Você preencheu o material ANTES de alterar o comprimento?
2. O comprimento foi realmente alterado? (valor diferente)
3. A fôrma está selecionada?
4. Há erros no console?

### Problema: Só alguns materiais são preservados

**Verificar:**
1. Logs mostram `💾 Preservando dados de:` para TODAS as armaduras?
2. Se não, verifique se todas tinham material preenchido
3. Armaduras sem material não são preservadas (comportamento correto)

## Logs Esperados (Exemplo Completo)

```
♻️ Recalculando armaduras com novo comprimento: 5
🔍 Carregando dados da fôrma: d3e21f2a-8b4c-...

💾 Preservando dados de: transversal-E1-Padrão do comprimento
   {material_id: "12345", material_name: "Ferro CA-60 Ø 5.0mm", diameter: 5}

💾 Preservando dados de: transversal-E2-Base e Topo
   {material_id: "12346", material_name: "Ferro CA-60 Ø 6.0mm", diameter: 6}

💾 Preservando dados de: longitudinal-A-4 barras superiores
   {material_id: "12347", material_name: "Ferro CA-50 Ø 10.0mm", diameter: 10}

💾 Preservando dados de: longitudinal-B-4 barras inferiores
   {material_id: "12348", material_name: "Ferro CA-50 Ø 12.5mm", diameter: 12.5}

📏 Diferença de comprimento: -5m (Produto: 5m - Referência: 10m)

⭐ Ajustando estribo PADRÃO "E1 - Padrão do comprimento": 66 estribos / 10m × 5m = 33 estribos

🔧 Ajustando armadura longitudinal A: 10.2 + 0 + -5 (diferença) = 5.20m
🔧 Ajustando armadura longitudinal B: 10.2 + 0 + -5 (diferença) = 5.20m

♻️ Restaurando dados de: transversal-E1-Padrão do comprimento
   {material_id: "12345", material_name: "Ferro CA-60 Ø 5.0mm", bar_diameter_mm: 5}

♻️ Restaurando dados de: transversal-E2-Base e Topo
   {material_id: "12346", material_name: "Ferro CA-60 Ø 6.0mm", bar_diameter_mm: 6}

♻️ Restaurando dados de: longitudinal-A-4 barras superiores
   {material_id: "12347", material_name: "Ferro CA-50 Ø 10.0mm", bar_diameter_mm: 10}

♻️ Restaurando dados de: longitudinal-B-4 barras inferiores
   {material_id: "12348", material_name: "Ferro CA-50 Ø 12.5mm", bar_diameter_mm: 12.5}

✅ Armaduras carregadas da fôrma: 4 armaduras
```

## Checklist Final

Use este checklist para confirmar que tudo está funcionando:

- [ ] Material é preservado ao alterar comprimento
- [ ] Diâmetro é preservado ao alterar comprimento
- [ ] Quantidades são recalculadas (estribos padrão)
- [ ] Comprimentos são recalculados (longitudinais)
- [ ] Console mostra logs de preservação (💾)
- [ ] Console mostra logs de restauração (♻️)
- [ ] Funciona para múltiplas alterações seguidas
- [ ] Funciona após salvar e editar
- [ ] Funciona para todas as armaduras preenchidas
- [ ] Sem erros no console

## Resultado Final

Se todos os itens do checklist estiverem ✅:

**🎉 A correção está funcionando perfeitamente!**

O usuário agora pode:
- Alterar o comprimento livremente
- Experimentar diferentes valores
- Ver recálculos em tempo real
- Sem perder dados já preenchidos
- Sem retrabalho ou frustração

**Workflow otimizado e experiência do usuário melhorada!**
