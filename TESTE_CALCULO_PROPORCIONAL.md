# Guia de Teste: Cálculo Proporcional Automático de Estribos

## Objetivo do Teste

Verificar se o sistema ajusta automaticamente a quantidade de estribos transversais baseado no estribo marcado como padrão (⭐) na fôrma.

## Pré-requisitos

- Sistema rodando
- Console do navegador aberto (F12) para ver os logs
- Acesso ao módulo de Fôrmas e Produtos

## Teste 1: Configurar Fôrma Base

### Passo 1: Criar/Editar uma Fôrma

1. Menu lateral → **Fôrmas**
2. Clique em **"Novo Cadastro"** ou edite uma fôrma existente
3. Preencha os dados básicos:
   ```
   Nome: Viga V-15x30 (TESTE)
   Tipo: Viga
   Largura: 0.15m (15cm)
   Altura: 0.30m (30cm)
   Medida de referência: 10.00m
   Volume de referência: 0.045m³
   ```

### Passo 2: Configurar Armaduras

1. Vá para a aba **"2. Configuração de Armaduras"**

2. Adicione armaduras longitudinais (opcional):
   ```
   A: 4 barras × 10.2m
   B: 4 barras × 10.2m
   ```

3. Adicione **3 estribos transversais**:

   **Estribo 1 (O PADRÃO):**
   ```
   Descrição: E1 - Padrão do comprimento
   Tipo: Transversal
   Quantidade padrão: 66
   Comprimento padrão: 2.5m
   Espaçamento: 0.15m (calculado automaticamente)
   ```
   ⭐ **MARQUE A ESTRELA** deste estribo!

   **Estribo 2 (Fixo):**
   ```
   Descrição: E2 - Base e Topo
   Tipo: Transversal
   Quantidade padrão: 10
   Comprimento padrão: 2.8m
   ```
   ☆ NÃO marque a estrela

   **Estribo 3 (Fixo):**
   ```
   Descrição: E3 - Emendas
   Tipo: Transversal
   Quantidade padrão: 20
   Comprimento padrão: 2.6m
   ```
   ☆ NÃO marque a estrela

### Passo 3: Salvar a Fôrma

1. Clique em **"Salvar"**
2. Confirme que a fôrma foi salva com sucesso

### ✅ Resultado Esperado

- Fôrma criada com sucesso
- Estribo E1 está com a estrela ⭐ marcada
- Estribos E2 e E3 estão sem estrela ☆

---

## Teste 2: Produto com 5 Metros (Metade da Referência)

### Passo 1: Criar Produto

1. Menu lateral → **Produtos**
2. Clique em **"Novo Cadastro"**
3. Preencha:
   ```
   Nome: Pilar P1 - 5m (TESTE)
   Código: P1-5M
   Tipo: Pré-Moldado
   Cadastro: Completo (não marcado "Simplificado")
   ```

### Passo 2: Selecionar a Fôrma

1. No campo **"Selecionar Fôrma"**: Escolha "Viga V-15x30 (TESTE)"
2. No campo **"Comprimento Total da Peça"**: Digite `5`

### Passo 3: Verificar no Console

Pressione **F12** e veja no console:

```
🔍 Carregando dados da fôrma: <id-da-forma>
📏 Diferença de comprimento: -5m (Produto: 5m - Referência: 10m)
⭐ Ajustando estribo PADRÃO "E1 - Padrão do comprimento": 66 estribos / 10m × 5m = 33 estribos
✅ Armaduras carregadas da fôrma: [...]
```

### Passo 4: Verificar na Tela

Role a página e veja a seção **"Armaduras Cadastradas para esta Fôrma"**:

```
✅ E1 - Padrão do comprimento
   33 estribos × 2.5m  ← DEVE MOSTRAR 33 (não 66)
   Espaçamento: 0.15m | Qtd padrão: 66 estribos

✅ E2 - Base e Topo
   10 estribos × 2.8m  ← DEVE MOSTRAR 10 (mantém original)

✅ E3 - Emendas
   20 estribos × 2.6m  ← DEVE MOSTRAR 20 (mantém original)
```

### ✅ Resultado Esperado

- **E1**: 33 estribos (66 ÷ 10m × 5m = 33)
- **E2**: 10 estribos (mantém)
- **E3**: 20 estribos (mantém)
- **Log no console** mostra o cálculo

---

## Teste 3: Produto com 15 Metros (1.5x da Referência)

### Passo 1: Criar Novo Produto

1. Clique em **"Novo Cadastro"**
2. Preencha:
   ```
   Nome: Pilar P2 - 15m (TESTE)
   Código: P2-15M
   Tipo: Pré-Moldado
   ```

### Passo 2: Aplicar a Fôrma

1. **Selecionar Fôrma**: "Viga V-15x30 (TESTE)"
2. **Comprimento**: Digite `15`

### Passo 3: Verificar Cálculo

Console:
```
⭐ Ajustando estribo PADRÃO "E1 - Padrão do comprimento": 66 estribos / 10m × 15m = 99 estribos
```

Tela:
```
E1: 99 estribos × 2.5m  ← CALCULADO: 66 ÷ 10 × 15 = 99
E2: 10 estribos × 2.8m  ← MANTÉM
E3: 20 estribos × 2.6m  ← MANTÉM
```

### ✅ Resultado Esperado

- **E1**: 99 estribos (66 ÷ 10m × 15m = 99)
- **E2**: 10 estribos
- **E3**: 20 estribos

---

## Teste 4: Produto com 3.5 Metros (Decimal)

### Passo 1: Criar Novo Produto

1. Clique em **"Novo Cadastro"**
2. Preencha:
   ```
   Nome: Pilar P3 - 3.5m (TESTE)
   Código: P3-3.5M
   ```

### Passo 2: Aplicar a Fôrma

1. **Selecionar Fôrma**: "Viga V-15x30 (TESTE)"
2. **Comprimento**: Digite `3.5`

### Passo 3: Verificar Cálculo

Console:
```
⭐ Ajustando estribo PADRÃO "E1 - Padrão do comprimento": 66 estribos / 10m × 3.5m = 23 estribos
```

Tela:
```
E1: 23 estribos × 2.5m  ← CALCULADO: 66 ÷ 10 × 3.5 = 23.1 ≈ 23
E2: 10 estribos × 2.8m
E3: 20 estribos × 2.6m
```

### ✅ Resultado Esperado

- **E1**: 23 estribos (arredondado de 23.1)
- **E2**: 10 estribos
- **E3**: 20 estribos

---

## Teste 5: Alterar Comprimento de Produto Existente

### Passo 1: Editar o Produto P1

1. Na listagem de produtos, clique em **"Editar"** do produto "Pilar P1 - 5m"
2. Altere o **Comprimento** de `5` para `8`

### Passo 2: Recarregar a Fôrma

**IMPORTANTE**: Para recalcular, você precisa:

1. No campo **"Selecionar Fôrma"**, selecione temporariamente "Nenhuma (Cadastro Manual)"
2. Depois selecione novamente "Viga V-15x30 (TESTE)"

### Passo 3: Verificar Novo Cálculo

Console:
```
⭐ Ajustando estribo PADRÃO "E1 - Padrão do comprimento": 66 estribos / 10m × 8m = 53 estribos
```

Tela:
```
E1: 53 estribos × 2.5m  ← RECALCULADO: 66 ÷ 10 × 8 = 52.8 ≈ 53
E2: 10 estribos × 2.8m
E3: 20 estribos × 2.6m
```

### ✅ Resultado Esperado

- **E1**: 53 estribos (atualizado de 33 para 53)
- **E2**: 10 estribos
- **E3**: 20 estribos

---

## Teste 6: Fôrma Sem Estribo Padrão Marcado

### Passo 1: Criar Nova Fôrma Sem Padrão

1. Menu → **Fôrmas** → **"Novo Cadastro"**
2. Preencha:
   ```
   Nome: Viga V-20x40 (SEM PADRÃO)
   Medida de referência: 8.00m
   ```

3. Adicione estribos transversais:
   ```
   E1: 50 estribos × 2.5m  ☆ NÃO marque a estrela
   E2: 15 estribos × 2.8m  ☆ NÃO marque a estrela
   ```

### Passo 2: Criar Produto com Esta Fôrma

1. Menu → **Produtos** → **"Novo Cadastro"**
2. Preencha:
   ```
   Nome: Pilar P4 - 6m (SEM PADRÃO)
   Comprimento: 6m
   ```
3. Selecione a fôrma "Viga V-20x40 (SEM PADRÃO)"

### Passo 3: Verificar Comportamento

Console:
```
🔍 Carregando dados da fôrma: <id>
✅ Armaduras carregadas da fôrma: [...]
```
(Não deve aparecer o log de ajuste ⭐)

Tela:
```
E1: 50 estribos × 2.5m  ← MANTÉM ORIGINAL (não calcula)
E2: 15 estribos × 2.8m  ← MANTÉM ORIGINAL
```

### ✅ Resultado Esperado

- **E1**: 50 estribos (mantém original, sem cálculo)
- **E2**: 15 estribos (mantém original)
- **Sem cálculo proporcional** porque nenhum estribo foi marcado como padrão

---

## Teste 7: Verificar Espaçamento Consistente

### Objetivo

Verificar se o espaçamento entre estribos permanece constante, independente do comprimento do produto.

### Tabela de Verificação

| Produto | Comprimento | E1 Qtd | Espaçamento E1 |
|---------|-------------|--------|----------------|
| P1      | 5m          | 33     | 5 ÷ 33 = 0.15m |
| P2      | 15m         | 99     | 15 ÷ 99 = 0.15m |
| P3      | 3.5m        | 23     | 3.5 ÷ 23 = 0.15m |
| P1(edit)| 8m          | 53     | 8 ÷ 53 = 0.15m |

### ✅ Resultado Esperado

- Todos os produtos têm espaçamento de **0.15m** (15cm)
- Espaçamento consistente independente do comprimento

---

## Teste 8: Verificar Cálculo de Custos

### Passo 1: Selecionar Material para E1

1. Edite o produto **"Pilar P1 - 5m"**
2. Na seção de armaduras, para **E1**:
   - Selecione um material (ex: "Ferro CA-60 Ø 5.0mm")
   - Verifique o diâmetro está preenchido (5.0mm)

### Passo 2: Verificar o Cálculo

Na área de resumo do cálculo de E1:

```
Resumo do Cálculo:
33 estribos × 2.5m = 82.5m total
Ø 5.0mm (CA 60) × R$ 0.1234/m
Custo Total: R$ 10.18
```

### Passo 3: Comparar com P2 (15m)

Edite **"Pilar P2 - 15m"** e selecione o mesmo material:

```
Resumo do Cálculo:
99 estribos × 2.5m = 247.5m total
Ø 5.0mm (CA 60) × R$ 0.1234/m
Custo Total: R$ 30.54
```

### ✅ Resultado Esperado

- Custos proporcionais ao comprimento
- P2 (15m) custa 3× mais que P1 (5m) em E1
- Cálculos automáticos e precisos

---

## Teste 9: Múltiplos Estribos Marcados como Padrão

### Objetivo

Verificar o que acontece se marcar mais de um estribo como padrão (não recomendado, mas possível).

### Passo 1: Marcar 2 Estribos como Padrão

1. Edite a fôrma "Viga V-15x30 (TESTE)"
2. Marque a estrela ⭐ em:
   - **E1** (já está marcado)
   - **E2** (marque também)

### Passo 2: Criar Produto

1. Crie um novo produto com esta fôrma
2. Comprimento: 5m

### Passo 3: Verificar Comportamento

Console deve mostrar:
```
⭐ Ajustando estribo PADRÃO "E1 - Padrão do comprimento": 66 / 10 × 5 = 33
⭐ Ajustando estribo PADRÃO "E2 - Base e Topo": 10 / 10 × 5 = 5
```

### ✅ Resultado Esperado

- **E1**: 33 estribos (calculado)
- **E2**: 5 estribos (calculado - antes era 10)
- **E3**: 20 estribos (mantém)

**Recomendação**: Ter apenas 1 estribo marcado como padrão por fôrma.

---

## Teste 10: Salvar e Recarregar Produto

### Passo 1: Salvar Produto

1. Edite **"Pilar P1 - 5m"**
2. Preencha todos os campos obrigatórios
3. Clique em **"Salvar"**

### Passo 2: Recarregar a Página

1. Pressione **F5** para recarregar
2. Vá em **Produtos**
3. Edite novamente **"Pilar P1 - 5m"**

### Passo 3: Verificar os Dados

```
E1: Deve estar salvo com 33 estribos ✅
E2: Deve estar salvo com 10 estribos ✅
E3: Deve estar salvo com 20 estribos ✅
```

### ✅ Resultado Esperado

- Quantidades ajustadas foram salvas corretamente
- Ao reabrir, os valores estão corretos

---

## Checklist Final de Validação

Use este checklist para confirmar que tudo está funcionando:

- [ ] Fôrma aceita marcar estribo como padrão (⭐)
- [ ] Apenas um estribo deve estar marcado como padrão (recomendado)
- [ ] Console mostra log `⭐ Ajustando estribo PADRÃO...`
- [ ] Quantidade de E1 é ajustada proporcionalmente
- [ ] Outros estribos (E2, E3) mantêm quantidades originais
- [ ] Espaçamento permanece consistente entre produtos
- [ ] Fórmula: `(66 / 10) × comprimento_produto` está correta
- [ ] Comprimentos decimais (3.5m) funcionam
- [ ] Arredondamento usa `Math.round()`
- [ ] Custos são calculados com quantidades corretas
- [ ] Produtos são salvos com quantidades ajustadas
- [ ] Sem estribo padrão marcado = sem cálculo proporcional
- [ ] Recarregar fôrma recalcula as quantidades

---

## Resultados Esperados por Teste

| Teste | Descrição | Status Esperado |
|-------|-----------|-----------------|
| 1 | Configurar fôrma base | ✅ Fôrma salva com E1 marcado |
| 2 | Produto 5m (metade) | ✅ E1 = 33 estribos |
| 3 | Produto 15m (1.5x) | ✅ E1 = 99 estribos |
| 4 | Produto 3.5m (decimal) | ✅ E1 = 23 estribos |
| 5 | Alterar comprimento | ✅ E1 = 53 estribos (atualizado) |
| 6 | Sem estribo padrão | ✅ Mantém quantidades originais |
| 7 | Espaçamento consistente | ✅ Sempre 0.15m |
| 8 | Custos proporcionais | ✅ Cálculo correto |
| 9 | Múltiplos padrões | ✅ Ambos calculados |
| 10 | Salvar e recarregar | ✅ Dados persistidos |

---

## Troubleshooting

### Problema: Quantidade não está sendo ajustada

**Verificar:**
1. O estribo está marcado como padrão (⭐) na fôrma?
2. O comprimento do produto está preenchido?
3. A fôrma tem comprimento de referência?
4. Você recarregou a fôrma após alterar o comprimento?

### Problema: Logs não aparecem no console

**Verificar:**
1. Console está aberto (F12)?
2. Filtro do console não está ocultando logs?
3. Você selecionou a fôrma DEPOIS de preencher o comprimento?

### Problema: Todos os estribos estão sendo ajustados

**Verificar:**
1. Você marcou mais de um estribo como padrão?
2. Desmarque os que não devem ser ajustados (clique na estrela)

---

## Conclusão

Após realizar todos os testes, você deve ter confirmado que:

✅ O sistema identifica o estribo padrão (⭐) da fôrma
✅ A quantidade é ajustada proporcionalmente ao comprimento
✅ O espaçamento permanece consistente
✅ Outros estribos não são afetados
✅ Os custos são calculados corretamente
✅ Os dados são salvos e persistidos

O sistema de cálculo proporcional automático está funcionando corretamente!
