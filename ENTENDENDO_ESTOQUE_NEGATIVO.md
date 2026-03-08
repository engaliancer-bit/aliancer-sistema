# Entendendo Estoque Negativo

## 🤔 Por que o Estoque Fica Negativo?

O sistema de gestão de estoque trabalha com o conceito de **reserva imediata**, o que pode resultar em valores negativos temporários. Veja como funciona:

## 📊 Como o Estoque é Calculado

### Fórmula Básica

```
Estoque Disponível = Produção "Para Estoque" - Entregas Ativas
```

### Tipos de Produção

1. **Produção "Para Estoque" (stock)**
   - Produção genérica que vai para o estoque geral
   - Conta no cálculo de estoque disponível
   - Pode ser vendida para qualquer cliente

2. **Produção "Para Ordem" (order)**
   - Produção vinculada a uma ordem específica
   - **NÃO conta** no estoque disponível
   - Destinada a um cliente específico

### Entregas Ativas

Entregas nos seguintes status são consideradas "ativas" e descontam do estoque:

- **Open (Aberta):** Pedido aprovado, aguardando carregamento
- **In Progress (Em andamento):** Carregamento iniciado
- **Closed (Fechada):** Entrega concluída

## 🔴 Cenários de Estoque Negativo

### Cenário 1: Ordem sem Produção Completa

```
Situação:
├─ Cliente: Celso Schaefer
├─ Produto: Pilar 18x25 H=5,50
├─ Ordem de Produção: OP#10
│
├─ Pedido: 6 pilares
├─ Produzido: 4 pilares (production_type='order')
└─ Entrega criada: 6 pilares (status='open')

Cálculo do Estoque:
├─ Produção para estoque: 0 (produção foi 'order', não 'stock')
├─ Entregas ativas: -6 (entrega aberta reservou 6)
└─ Estoque disponível: 0 - 6 = -6 ❌
```

**Por que fica negativo?**
- A entrega foi criada reservando 6 pilares
- Apenas 4 foram produzidos (e marcados como 'order')
- Faltam 2 pilares para produzir
- O estoque mostra -6 porque não há produção "para estoque"

### Cenário 2: Venda sem Estoque Prévio

```
Situação:
├─ Cliente: João Silva
├─ Produto: Laje treliçada reforçada
│
├─ Orçamento aprovado: 250 unidades
└─ Entrega criada automaticamente: 250 (status='open')

Produção:
└─ Nenhuma produção realizada ainda

Cálculo do Estoque:
├─ Produção para estoque: 0
├─ Entregas ativas: -250
└─ Estoque disponível: 0 - 250 = -250 ❌
```

**Por que fica negativo?**
- Orçamento aprovado cria entrega automaticamente
- Entrega reserva os produtos imediatamente
- Produção ainda não foi realizada
- Estoque negativo indica necessidade de produzir

### Cenário 3: Produção Mista

```
Situação:
├─ Produto: Poste de cerca 2,50m
│
Produção:
├─ Para estoque: 5 postes
├─ Para ordem OP#8: 17 postes
└─ Total produzido: 22 postes

Entregas:
├─ Fechada: 22 postes
└─ Aberta: 0 postes

Cálculo do Estoque:
├─ Produção para estoque: 5
├─ Entregas ativas: -22
└─ Estoque disponível: 5 - 22 = -17 ❌
```

**Por que fica negativo?**
- Apenas 5 postes foram para estoque geral
- 17 postes eram "para ordem" (não contam)
- Mas 22 postes foram entregues
- Sistema mostra deficit de 17 postes

## ✅ Como Interpretar Estoque Negativo

### O que significa?

| Estoque | Significado | Ação Necessária |
|---------|-------------|-----------------|
| Positivo (+) | Produtos disponíveis para venda | Nenhuma |
| Zero (0) | Sem estoque, sem pendências | Produzir para estoque se necessário |
| Negativo (-) | Produtos comprometidos sem estoque | Verificar ordens pendentes |

### Estoque Negativo NÃO é necessariamente um erro!

Pode indicar:
1. **Produção pendente** de ordens abertas
2. **Produtos sob encomenda** (made-to-order)
3. **Vendas antecipadas** aguardando produção

## 🎯 Onde Verificar Cada Informação

### 1. Estoque Disponível → "Estoque Produtos"

```
Menu: Indústria → Estoque Produtos

Mostra: Produtos disponíveis para venda imediata
Inclui: Produção "para estoque" - Entregas ativas
```

### 2. Pendências de Produção → "Itens a Produzir"

```
Menu: Indústria → Itens a Produzir

Mostra: O que precisa ser produzido
Inclui: Ordens abertas com produção incompleta
```

### 3. Ordens Completas → "Ordens de Produção"

```
Menu: Indústria → Ordens de Produção

Mostra: Todas as ordens (abertas, em andamento, concluídas)
Inclui: Status detalhado de cada ordem
```

## 🔧 Como Corrigir Estoque Negativo

### Opção 1: Completar a Produção Pendente

Se há uma ordem aberta com produção incompleta:

1. Acesse **"Itens a Produzir"**
2. Identifique o produto pendente
3. Acesse **"Produção"**
4. Lance a produção faltante vinculada à ordem

### Opção 2: Produzir para Estoque

Se o produto deve estar disponível para vendas futuras:

1. Acesse **"Produção"**
2. Selecione o produto
3. Marque como **"Para Estoque"** (production_type='stock')
4. Lance a quantidade desejada

### Opção 3: Cancelar Entrega Incorreta

Se a entrega foi criada por engano:

1. Acesse **"Entregas"**
2. Localize a entrega incorreta
3. Cancele a entrega
4. O estoque será creditado automaticamente

### Opção 4: Ajuste Manual de Estoque

Se houver discrepância com contagem física:

1. Faça **contagem física** do estoque real
2. Compare com o estoque do sistema
3. Lance **produção de ajuste** com a diferença
4. Use observação: "Ajuste de estoque após contagem física"

## 📋 Checklist de Verificação

Quando encontrar estoque negativo, verifique:

- [ ] Há ordens de produção abertas para este produto?
- [ ] A produção foi lançada como "Para Ordem" ou "Para Estoque"?
- [ ] Há entregas abertas aguardando carregamento?
- [ ] A contagem física do estoque está correta?
- [ ] Houve vendas sem estoque prévio?
- [ ] O produto é feito sob encomenda (made-to-order)?

## 🎓 Boas Práticas

### 1. Produtos de Estoque Regular

Para produtos que você sempre mantém em estoque:

```
Produção: Sempre marcar como "Para Estoque"
Resultado: Estoque positivo e disponível
```

### 2. Produtos sob Encomenda

Para produtos feitos apenas quando vendidos:

```
Venda: Aprovar orçamento (cria entrega)
Produção: Vincular à ordem específica
Resultado: Estoque negativo temporário até produção
```

### 3. Produção Antecipada

Para pedidos grandes conhecidos com antecedência:

```
1. Produzir antes da venda (como "Para Estoque")
2. Aprovar orçamento (cria entrega)
3. Estoque é descontado mas não fica negativo
```

## 🔍 Exemplo Prático Completo

### Situação Inicial
```
Produto: Bloco estrutural 14
Estoque: 0
```

### Ação 1: Produzir para Estoque
```
Produção:
├─ Quantidade: 1000 blocos
├─ Tipo: Para Estoque
└─ Data: 05/02/2026

Estoque Resultante: +1000 ✅
```

### Ação 2: Venda para Cliente A
```
Orçamento:
├─ Cliente: João Silva
├─ Quantidade: 600 blocos
└─ Status: Aprovado

Entrega criada automaticamente:
├─ Quantidade: 600
└─ Status: open

Estoque Resultante: 1000 - 600 = 400 ✅
```

### Ação 3: Venda para Cliente B (sem estoque)
```
Orçamento:
├─ Cliente: Maria Santos
├─ Quantidade: 500 blocos
└─ Status: Aprovado

Entrega criada automaticamente:
├─ Quantidade: 500
└─ Status: open

Estoque Resultante: 400 - 500 = -100 ❌

SOLUÇÃO: Produzir mais 100 blocos (ou cancelar pedido)
```

## 💡 Dicas Importantes

1. **Estoque negativo é um AVISO**, não necessariamente um erro
2. Use **"Itens a Produzir"** para ver o que precisa ser feito
3. Produza **"Para Estoque"** apenas produtos de giro regular
4. Produtos sob encomenda podem ter estoque negativo temporário
5. Faça **contagem física periódica** e ajuste se necessário

## 🚦 Resumo Visual

```
Estoque > 0  →  🟢 Produtos disponíveis para venda
Estoque = 0  →  🟡 Sem estoque, precisa produzir
Estoque < 0  →  🔴 Verificar "Itens a Produzir"
```

---

**Conclusão:** Estoque negativo indica que há entregas comprometidas sem estoque suficiente. Use o relatório "Itens a Produzir" para ver exatamente o que precisa ser produzido e priorize a produção conforme necessário.
