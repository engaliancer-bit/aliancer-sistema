# Guia: Congelamento de Preços em Orçamentos

## O Que É?

O recurso de **Congelamento de Preços** permite criar um "snapshot" (foto) dos valores de um orçamento em um momento específico. Quando você congela os preços de um orçamento:

- ✅ Os valores do orçamento ficam fixos e não mudam mais
- ✅ Os preços dos produtos no sistema continuam atualizando normalmente
- ✅ O orçamento mantém os valores do momento do congelamento
- ✅ Você pode descongelar a qualquer momento para voltar aos valores atuais

## Por Que Usar?

### Cenário 1: Orçamento para Cliente com Prazo de Validade
Você fez um orçamento de R$ 10.000,00 para um cliente válido por 30 dias. Depois de 15 dias, os preços dos materiais subiram no sistema e o mesmo orçamento agora custaria R$ 11.500,00.

**Sem congelamento:** O valor do orçamento muda automaticamente para R$ 11.500,00
**Com congelamento:** O valor permanece R$ 10.000,00 conforme acordado com o cliente

### Cenário 2: Orçamento Aprovado que Será Executado Depois
Um cliente aprovou um orçamento de R$ 50.000,00 mas a obra só começa em 2 meses. Durante esses 2 meses, você continua atualizando os preços dos produtos no sistema.

**Sem congelamento:** O orçamento aprovado pode mudar de valor a cada atualização de preço
**Com congelamento:** O orçamento mantém os R$ 50.000,00 aprovados

### Cenário 3: Comparação de Orçamentos em Períodos Diferentes
Você quer comparar quanto custava fazer uma obra em Janeiro vs Março.

**Sem congelamento:** Todos os orçamentos sempre mostram o preço atual
**Com congelamento:** Cada orçamento mantém os valores da sua época

## Como Usar

### Método 1: Botão Rápido na Lista (NOVO! 🎉)

Na tela de listagem de orçamentos, você verá um botão de cadeado em cada linha:

1. Localize o orçamento na lista
2. Clique no ícone de **cadeado aberto** (🔓) para congelar
3. Clique no ícone de **cadeado fechado** (🔒) para descongelar

**Indicadores visuais na lista:**
- Badge amarelo **"Congelado"** ao lado do valor total
- Data do congelamento abaixo do valor
- Ícone de cadeado dourado nos orçamentos congelados

### Método 2: Durante a Edição do Orçamento

1. Clique em **"Editar"** no orçamento desejado
2. Role até a seção **"Congelar Preços"** (logo abaixo do campo Status)
3. Marque o checkbox **"Congelar Preços"**
4. Confirme a ação quando solicitado
5. Salve o orçamento

## Estados do Orçamento

### Orçamento com Preços Normais (Descongelado)

```
┌─────────────────────────────────────┐
│ Status: Pendente                    │
│                                     │
│ ☐ Congelar Preços                  │
│ Congela os valores deste orçamento │
├─────────────────────────────────────┤
│ Produto A: R$ 100,00 x 10 = R$ 1.000│
│ Produto B: R$ 50,00  x 5  = R$ 250  │
│                                     │
│ TOTAL: R$ 1.250,00                  │
└─────────────────────────────────────┘
```

**Comportamento:**
- Valores calculados em tempo real
- Se o preço do Produto A subir para R$ 110,00, o total muda para R$ 1.350,00
- Sempre reflete os preços atuais do cadastro

### Orçamento com Preços Congelados

```
┌─────────────────────────────────────┐
│ Status: Pendente                    │
│ 🔒 PREÇOS CONGELADOS                │
│                                     │
│ ☑ Congelar Preços                  │
│ Preços congelados desde 10/02/2026 │
│                                     │
│ Valor Congelado: R$ 1.250,00       │
├─────────────────────────────────────┤
│ Produto A: R$ 100,00 x 10 = R$ 1.000│
│ Produto B: R$ 50,00  x 5  = R$ 250  │
│                                     │
│ TOTAL: R$ 1.250,00 (CONGELADO)     │
└─────────────────────────────────────┘
```

**Comportamento:**
- Valores FIXOS no momento do congelamento
- Mesmo que o Produto A suba para R$ 110,00 no sistema, o orçamento mantém R$ 100,00
- Badge amarelo visível na lista de orçamentos

## O Que Fica Salvo no Snapshot?

Quando você congela um orçamento, o sistema salva:

### Para Cada Item:
- Nome do produto/material/composição
- Quantidade
- Unidade (un, m³, kg, etc.)
- **Custo unitário** no momento do congelamento
- **Preço unitário** no momento do congelamento
- Custo total do item
- Preço total do item
- Margem de lucro

### Totais Gerais:
- Custo total de todos os itens
- Preço total de todos os itens
- Margem total
- Percentual de margem
- Desconto aplicado
- Valor final após desconto
- **Data e hora** do congelamento

## Exemplos Práticos

### Exemplo 1: Congelar Orçamento Antes de Enviar ao Cliente

**Situação:**
- Você preparou um orçamento na segunda-feira
- Vai enviar para o cliente na sexta-feira
- Durante a semana, você atualiza preços de materiais constantemente

**Solução:**
1. Termine o orçamento na segunda-feira
2. **Congele os preços** antes de salvar
3. Durante a semana, atualize os preços no sistema normalmente
4. O orçamento que você enviará na sexta mantém os valores da segunda

### Exemplo 2: Orçamento Aprovado com Prazo de Execução

**Situação:**
- Cliente aprovou orçamento de R$ 80.000,00 em Janeiro
- Obra começa em Março
- Preços dos produtos sobem 8% em Fevereiro

**Solução:**
1. Assim que o cliente aprovar, **congele os preços**
2. Mude o status para "Aprovado"
3. Continue atualizando preços no sistema
4. O orçamento mantém os R$ 80.000,00 originais
5. Quando criar a Ordem de Produção, ela usará os valores congelados

### Exemplo 3: Descongelar para Atualizar Valores

**Situação:**
- Orçamento congelado há 3 meses em R$ 45.000,00
- Cliente pediu atualização dos valores
- Preços subiram e agora seria R$ 52.000,00

**Solução:**
1. Clique no botão de **cadeado** (🔒) na linha do orçamento
2. Os valores serão recalculados automaticamente
3. Novo total: R$ 52.000,00
4. Se necessário, congele novamente com os novos valores

## Perguntas Frequentes

### 1. Posso editar um orçamento congelado?

**Sim!** Você pode editar normalmente:
- Adicionar ou remover itens
- Mudar quantidades
- Alterar preços propostos manualmente

**MAS:** Os valores unitários dos produtos continuam congelados. Se você adicionar um novo item, ele usará o preço atual do cadastro.

### 2. O congelamento afeta os preços no cadastro de produtos?

**NÃO!** O congelamento é isolado por orçamento:
- Cada orçamento tem seu próprio snapshot
- Preços no cadastro continuam atualizando normalmente
- Outros orçamentos não são afetados
- Relatórios de custo usam sempre os preços atuais

### 3. Posso congelar e descongelar várias vezes?

**Sim!** Você pode congelar e descongelar quantas vezes quiser:
- Ao descongelar: valores voltam para os preços atuais do sistema
- Ao recongelar: cria um novo snapshot com os valores atuais
- O snapshot anterior é substituído pelo novo

### 4. O que acontece se eu excluir um produto do cadastro que está em um orçamento congelado?

O orçamento congelado **mantém os dados** do produto:
- Nome do produto continua aparecendo
- Valores permanecem salvos no snapshot
- O orçamento não é afetado pela exclusão do produto

### 5. Posso imprimir a diferença entre valores congelados e atuais?

**Sim!** Quando você imprime um orçamento congelado:
- O PDF mostra os valores congelados
- Aparece a data do congelamento
- Você pode descongelar temporariamente para ver a diferença

### 6. O congelamento afeta a criação de Ordens de Produção?

**Sim, positivamente!** Quando você aprovar um orçamento congelado:
- A Ordem de Produção é criada com os valores congelados
- As vendas e recebíveis usam os valores congelados
- Isso garante consistência entre orçamento aprovado e execução

### 7. Como sei se um orçamento está congelado?

**Indicadores visuais:**

Na lista:
- Badge amarelo **"Congelado"** ao lado do valor
- Ícone de cadeado dourado (🔒)
- Data do congelamento

No formulário de edição:
- Borda amarela na seção de congelamento
- Checkbox marcado
- Mensagem com data do congelamento
- Valor congelado destacado

### 8. Posso congelar um orçamento vazio?

**Tecnicamente sim**, mas não é recomendado:
- Um orçamento sem itens terá snapshot com valor R$ 0,00
- Ao adicionar itens depois, eles usarão preços atuais
- O congelamento só faz sentido com itens já adicionados

### 9. O desconto também é congelado?

**Sim!** Tudo é congelado:
- Valores unitários de cada item
- Descontos aplicados
- Formas de pagamento configuradas
- Cálculos de margem e lucro

### 10. Existe algum risco ao usar congelamento?

**Riscos mínimos:**

✅ **Seguro:**
- Não afeta outros orçamentos
- Não altera cadastro de produtos
- Pode ser desfeito a qualquer momento
- Mantém histórico de quando foi congelado

⚠️ **Atenção:**
- Se os custos subirem muito e o orçamento estiver congelado com margem baixa, você pode ter prejuízo
- Revise orçamentos congelados antigos antes de executar

## Boas Práticas

### ✅ FAÇA:

1. **Congele orçamentos que serão enviados a clientes**
   - Evita surpresas se os preços mudarem antes da aprovação

2. **Congele imediatamente após aprovação**
   - Garante que a execução usará os valores aprovados

3. **Revise orçamentos congelados antigos**
   - Antes de executar uma obra, verifique se os valores ainda são viáveis

4. **Use o badge de congelado como filtro visual**
   - Facilita identificar orçamentos com valores fixos

5. **Documente o motivo do congelamento nas observações**
   - Ajuda a entender o contexto no futuro

### ❌ NÃO FAÇA:

1. **Não congele orçamentos em rascunho que ainda estão sendo elaborados**
   - Deixe-os descongelados enquanto define os itens

2. **Não esqueça de descongelar se o cliente pedir atualização**
   - Valores desatualizados podem causar perda de oportunidade

3. **Não confie cegamente em orçamentos congelados muito antigos**
   - Custos podem ter mudado significativamente

4. **Não congele sem revisar os valores**
   - Certifique-se de que os preços estão corretos antes

5. **Não use congelamento como substituto para controle de versão**
   - Se precisar de múltiplas versões, crie orçamentos separados

## Estrutura Técnica (Para Referência)

### Campos no Banco de Dados

**Tabela: quotes**
- `precos_congelados` (boolean) - Indica se está congelado
- `snapshot_valores` (jsonb) - Dados completos do congelamento
- `data_congelamento` (timestamptz) - Quando foi congelado

### Funções Disponíveis

1. **freeze_quote_prices(quote_id)**
   - Congela os preços do orçamento
   - Retorna: snapshot completo em JSON

2. **unfreeze_quote_prices(quote_id)**
   - Descongela os preços do orçamento
   - Retorna: void

3. **get_quote_totals(quote_id)**
   - Retorna totais (congelados ou atuais)
   - Usa snapshot se congelado, senão calcula

## Onde Encontrar o Recurso

### Na Lista de Orçamentos:

```
┌─────────────────────────────────────────────────────┐
│ Ações   | Cliente  | Itens | Valor Total | Status  │
├─────────────────────────────────────────────────────┤
│ 🖨 ✏️ 🔒 💳 🗑️ | João  | 5     | R$ 10.000,00    │ Pend. │
│                  |       |       | 🔒 Congelado    │       │
│                  |       |       | Desde: 10/02    │       │
└─────────────────────────────────────────────────────┘
       ↑
  Botão de Congelar/Descongelar
```

### No Formulário de Edição:

```
┌─────────────────────────────────────────────────────┐
│ Editar Orçamento                                    │
├─────────────────────────────────────────────────────┤
│ Cliente: [João Silva ▼]                            │
│ Status:  [Pendente ▼]                              │
│                                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ 🔒 CONGELAMENTO DE PREÇOS                    │   │
│ │ ─────────────────────────────────────────── │   │
│ │ ☑ Congelar Preços                           │   │
│ │                                              │   │
│ │ Preços congelados desde 10/02/2026 14:30   │   │
│ │ Os valores deste orçamento não serão...     │   │
│ │                                              │   │
│ │ Valor Congelado: R$ 10.000,00         │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ [Itens do Orçamento...]                            │
└─────────────────────────────────────────────────────┘
```

## Resumo Rápido

| Ação | Resultado |
|------|-----------|
| ✅ Congelar orçamento | Valores fixados, não mudam mais |
| ❄️ Descongelar orçamento | Volta a calcular em tempo real |
| 📸 Snapshot criado | Todos os valores e datas salvos |
| 🔒 Orçamento congelado visível | Badge amarelo + data na lista |
| 💰 Valores no sistema | Continuam atualizando normalmente |
| 🎯 Uso recomendado | Orçamentos para clientes e aprovados |

---

## Precisa de Ajuda?

Se você não está vendo o recurso de congelamento:

1. ✅ Verifique se está **editando** um orçamento existente (não criando novo)
2. ✅ Procure pelo checkbox **"Congelar Preços"** logo abaixo do campo Status
3. ✅ Na lista, procure pelo ícone de **cadeado** (🔓 ou 🔒) na coluna de ações
4. ✅ Certifique-se de que o banco de dados está atualizado com a migration de congelamento

**Sistema atualizado com melhorias visuais!** Agora o congelamento está mais acessível e visível em toda a interface de orçamentos.
