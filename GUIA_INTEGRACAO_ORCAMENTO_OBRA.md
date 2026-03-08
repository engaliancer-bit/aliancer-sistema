# Guia de Integração Orçamento-Obra com Gestão Automática de Estoque

## Visão Geral

Sistema completo que integra orçamentos aprovados com obras, verificando automaticamente o estoque de produtos das composições e criando ordens de produção quando necessário.

## Como Funciona

### Fluxo Automático

1. **Aprovação do Orçamento**
   - Você aprova um orçamento que contém composições
   - Vincula o orçamento a uma obra específica

2. **Verificação Automática de Estoque**
   - O sistema analisa todos os produtos das composições
   - Calcula: Estoque Atual = Produção Total - Entregas Realizadas
   - Compara estoque disponível com quantidade necessária

3. **Criação Automática de Ordens de Produção**
   - Para produtos **SEM estoque**: cria ordem de produção automaticamente
   - Para produtos **COM estoque parcial**: cria ordem apenas para quantidade faltante
   - Para produtos **COM estoque completo**: marca como "disponível para entrega"

4. **Acompanhamento em Tempo Real**
   - Conforme a produção avança, o sistema atualiza o status automaticamente
   - Quando produtos ficam prontos, são marcados como disponíveis para entrega

## Como Usar

### 1. Acessar Acompanhamento de Obras

```
Menu Principal → Construtora → Acompanhamento
```

### 2. Selecionar uma Obra

Na tela de acompanhamento, você verá cards com:
- Nome da obra
- Cliente
- Status da obra
- Total de produtos vinculados
- Produtos disponíveis para entrega
- Produtos em produção

Clique no card da obra desejada.

### 3. Vincular Orçamento

Na tela de detalhes da obra:

1. **Tipo de Orçamento**: Selecione entre:
   - Orçamento Padrão
   - Laje Treliçada

2. **ID do Orçamento**: Cole o ID do orçamento aprovado
   - Para obter o ID: copie da URL ou da lista de orçamentos

3. **Clique em "Vincular e Processar"**

### 4. Processamento Automático

O sistema irá:

✅ Analisar todas as composições do orçamento
✅ Verificar estoque de cada produto
✅ Criar ordens de produção para itens faltantes
✅ Marcar itens disponíveis para entrega

Você receberá uma mensagem como:
```
✅ 3 composições analisadas | 12 produtos registrados | 5 ordens de produção criadas
```

### 5. Visualizar Status dos Produtos

Após o processamento, você verá todos os produtos com:

**Status Possíveis:**

| Status | Significado | Ação |
|--------|-------------|------|
| 🟢 **Disponível para Entrega** | Estoque completo | Pode carregar agora |
| 🟡 **Parcialmente Disponível** | Estoque parcial | Aguardar produção do restante |
| 🔵 **Em Produção** | Sem estoque | Aguardar conclusão da ordem |
| 🟣 **Entregue** | Já foi entregue | Histórico |

**Informações Exibidas:**

- Nome e código do produto
- Quantidade necessária
- Quantidade em estoque
- Quantidade a produzir
- Número da ordem de produção (se aplicável)
- Data da entrega (se já entregue)

### 6. Atualizar Status

Clique no botão **"Atualizar Status"** para:
- Recalcular estoque atual
- Atualizar status dos produtos
- Verificar se produção foi concluída

## Exemplos Práticos

### Exemplo 1: Composição com Estoque Completo

**Composição:** Laje Treliçada 3m
- Vigota 3m: Necessário 20 → Estoque: 25
- Tavela: Necessário 100 → Estoque: 150
- Ferragens: Necessário 5 → Estoque: 10

**Resultado:**
```
✅ Todos os produtos disponíveis para entrega
   Nenhuma ordem de produção criada
```

### Exemplo 2: Composição com Estoque Parcial

**Composição:** Laje Treliçada 4m
- Vigota 4m: Necessário 30 → Estoque: 15
- Tavela: Necessário 120 → Estoque: 0
- Ferragens: Necessário 8 → Estoque: 8

**Resultado:**
```
⚠️ Estoque parcial: 15 de 30 Vigotas
   → Ordem OP-345: Produzir 15 vigotas

🏭 Aguardando produção: 120 Tavelas
   → Ordem OP-346: Produzir 120 tavelas

✅ Ferragens disponível: 8 unidades
```

### Exemplo 3: Composição Sem Estoque

**Composição:** Pilar Pré-Moldado
- Pilar 3x30: Necessário 10 → Estoque: 0
- Base: Necessário 10 → Estoque: 0

**Resultado:**
```
🏭 Ordem OP-347: Produzir 10 pilares
🏭 Ordem OP-348: Produzir 10 bases
```

## Atualização Automática

O sistema atualiza automaticamente quando:

1. **Nova produção é registrada**
   - Status muda de "Em Produção" para "Disponível"
   - Estoque é recalculado

2. **Entrega é realizada**
   - Status muda para "Entregue"
   - Estoque é reduzido

## Regras Importantes

### Cálculo de Estoque

```
Estoque Disponível = Total Produzido - Total Entregue
```

### Prioridade das Ordens

Ordens criadas automaticamente para obras recebem:
- **Prioridade: Alta**
- **Status: Aberta**
- **Observação: "Ordem para obra - [Nome do Produto]"**

### Status das Composições

O sistema considera o status por produto individual, não por composição completa. Isso permite:
- Carregar produtos disponíveis enquanto aguarda outros
- Fazer entregas parciais
- Otimizar logística

## Dicas e Boas Práticas

### 1. Planejamento

✅ Vincule orçamentos à obra **antes** de aprovar com o cliente
✅ Verifique estoque disponível antes de prometer prazos
✅ Use o relatório de produtos em produção para planejar entregas

### 2. Acompanhamento

✅ Atualize o status diariamente
✅ Priorize ordens de produção vinculadas a obras
✅ Comunique o cliente sobre itens disponíveis

### 3. Entregas

✅ Faça entregas parciais de itens disponíveis
✅ Não aguarde composição completa se puder entregar parcialmente
✅ Registre entregas no sistema para atualizar estoque

## Relatórios e Informações

### Dashboard da Obra

Ao selecionar uma obra, você vê:

**Resumo Geral:**
- Total de produtos vinculados
- Produtos disponíveis para entrega
- Produtos em produção

**Por Orçamento:**
- Tipo (Padrão ou Laje Treliçada)
- ID do orçamento
- Lista detalhada de produtos

**Por Produto:**
- Status atual
- Quantidades (necessário, estoque, a produzir)
- Ordem de produção vinculada
- Histórico de entregas

## Solução de Problemas

### Problema: Status não atualiza automaticamente

**Solução:** Clique em "Atualizar Status" manualmente

### Problema: Ordem de produção não foi criada

**Causas possíveis:**
1. Produto não faz parte de composição
2. Já havia estoque suficiente
3. Erro no processamento

**Solução:** Verifique os logs ou crie ordem manualmente

### Problema: Estoque incorreto

**Causas possíveis:**
1. Produção não registrada no sistema
2. Entregas não registradas
3. Dados desatualizados

**Solução:**
1. Registre produções pendentes
2. Registre entregas realizadas
3. Clique em "Atualizar Status"

## Benefícios do Sistema

✅ **Automação Completa**
- Elimina verificação manual de estoque
- Cria ordens de produção automaticamente
- Atualiza status em tempo real

✅ **Melhor Planejamento**
- Visão clara do que está disponível
- Previsão de quando produtos estarão prontos
- Priorização de produção

✅ **Redução de Erros**
- Cálculo automático de quantidades
- Histórico completo de movimentações
- Rastreabilidade total

✅ **Otimização de Entregas**
- Identifica produtos prontos imediatamente
- Permite entregas parciais eficientes
- Reduz tempo de espera do cliente

## Próximos Passos

Após dominar o básico:

1. **Integre com Entregas**
   - Use o módulo de entregas para carregar produtos
   - Vincule entregas aos produtos da obra
   - Acompanhe histórico completo

2. **Monitore Ordens de Produção**
   - Acesse "Ordens de Produção" no menu
   - Priorize ordens vinculadas a obras
   - Acompanhe progresso

3. **Relatórios Gerenciais**
   - Use filtros por obra
   - Analise tempo médio de produção
   - Otimize processos

---

**Sistema desenvolvido para otimizar a gestão de obras e estoque** 🏗️
