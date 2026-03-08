# Relatório "Itens a Produzir"

## 📋 Problema Identificado

O relatório de estoque estava mostrando **valores negativos** para produtos com ordens de produção não concluídas.

### Exemplo:
```
Ordem de Produção: 6 pilares para Celso Schaefer
Produzidos: 4 pilares
Estoque mostrava: -2 pilares ❌
```

### Por que isso acontecia?

1. **Reserva Automática:** Quando um orçamento é aprovado, uma entrega é criada automaticamente (status='open')
2. **Estoque Descontado:** A entrega reserva os produtos imediatamente no estoque
3. **Produção Pendente:** Se a produção não foi completada, o estoque fica negativo
4. **Confusão:** O relatório de estoque misturava produtos disponíveis com produtos pendentes de produção

## ✅ Solução Implementada

Criado um **novo relatório separado** chamado **"Itens a Produzir"** que mostra exclusivamente:
- Produtos com ordens de produção abertas ou em andamento
- Quantidade pedida vs quantidade produzida
- Quantidade que ainda falta produzir
- Status de urgência (atrasado, urgente, no prazo)
- Cliente e prazo de entrega

### Localização no Sistema

**Menu:** Indústria → **Itens a Produzir**

(Entre "Ordens de Produção" e "Entregas")

## 📊 Funcionalidades do Relatório

### 1. Cards de Resumo

```
┌─────────────────┬──────────────┬─────────────┬──────────────┐
│ Total Pendente  │ Atrasados    │ Urgentes    │ No Prazo     │
│ XXX unidades    │ X produtos   │ X produtos  │ X produtos   │
│ X produtos      │ XXX unidades │ Próx 3 dias │ Dentro prazo │
└─────────────────┴──────────────┴─────────────┴──────────────┘
```

### 2. Filtros Rápidos

- **Todos:** Mostra todos os itens pendentes
- **Atrasados:** Apenas itens com prazo vencido
- **Urgentes:** Itens com prazo nos próximos 3 dias

### 3. Tabela Detalhada

Colunas:
- **OP#:** Número da ordem de produção
- **Cliente:** Nome do cliente
- **Produto:** Nome e código do produto
- **Pedido:** Quantidade solicitada
- **Produzido:** Quantidade já produzida (em azul)
- **Falta Produzir:** Quantidade pendente (em vermelho, **destaque**)
- **Progresso:** Barra visual de progresso
- **Prazo:** Data limite para produção
- **Entrega:** Data prevista de entrega
- **Status:** Badge colorido (Atrasado/Urgente/No prazo)

### 4. Status com Cores

- 🔴 **Vermelho:** Atrasado (prazo vencido)
- 🟡 **Amarelo:** Urgente (3 dias ou menos)
- 🟢 **Verde:** No prazo (mais de 3 dias)
- ⚪ **Cinza:** Sem prazo definido

## 🎯 Benefícios

### 1. Separação Clara
- **Estoque de Produtos:** Mostra apenas produtos disponíveis para venda
- **Itens a Produzir:** Mostra apenas o que precisa ser produzido

### 2. Gestão de Produção
- Visualização rápida do backlog de produção
- Identificação de itens atrasados
- Priorização por urgência
- Acompanhamento de progresso por ordem

### 3. Melhor Experiência
- Sem confusão entre estoque negativo e produção pendente
- Relatórios focados em propósitos específicos
- Interface intuitiva com filtros e cores

## 📝 Exemplo de Uso

### Cenário 1: Consulta Geral

```
Gerente acessa "Itens a Produzir"
└─> Vê que há 5 produtos atrasados
    └─> Filtra por "Atrasados"
        └─> Identifica pilares para Celso Schaefer
            └─> Prioriza essa produção
```

### Cenário 2: Planejamento Semanal

```
Início da semana
└─> Acessa "Itens a Produzir"
    └─> Filtra por "Urgentes"
        └─> Vê todos os itens com prazo em 3 dias
            └─> Planeja a produção da semana
```

### Cenário 3: Acompanhamento

```
Durante a produção
└─> Consulta progresso da OP#15
    └─> Vê: 4/6 pilares produzidos (67%)
        └─> Faltam 2 pilares
            └─> Prazo: Amanhã → Status: URGENTE
```

## 🔧 Implementação Técnica

### Componente Criado
```
src/components/ProductionPending.tsx
```

### Query Utilizada

```sql
SELECT
  po.order_number,
  p.name as product_name,
  poi.quantity as quantity_ordered,
  SUM(pr.quantity) as quantity_produced,
  poi.quantity - SUM(pr.quantity) as quantity_pending,
  po.deadline,
  c.name as customer_name
FROM production_orders po
JOIN production_order_items poi ON poi.production_order_id = po.id
JOIN products p ON p.id = poi.product_id
LEFT JOIN production pr ON pr.production_order_item_id = poi.id
LEFT JOIN quotes q ON q.id = po.quote_id
LEFT JOIN customers c ON c.id = q.customer_id
WHERE po.status IN ('pending', 'in_progress')
  AND poi.quantity > COALESCE(SUM(pr.quantity), 0)
GROUP BY po.id, poi.id, p.name, c.name
ORDER BY po.order_number
```

### Características
- ✅ Lazy loading (carregamento sob demanda)
- ✅ Interface responsiva
- ✅ Filtros em tempo real
- ✅ Cards de resumo dinâmicos
- ✅ Barra de progresso visual
- ✅ Badges de status coloridos

## 📱 Responsividade

O relatório se adapta a diferentes tamanhos de tela:

- **Desktop:** 4 cards + tabela completa
- **Tablet:** 2 cards por linha + rolagem horizontal na tabela
- **Mobile:** 1 card por linha + tabela com rolagem

## 🎨 Design

### Cores Utilizadas

```css
Azul (#3B82F6):   Informações gerais
Verde (#10B981):  Status "No prazo"
Amarelo (#F59E0B): Status "Urgente"
Vermelho (#EF4444): Status "Atrasado"
Cinza (#6B7280):   Status "Sem prazo"
```

### Ícones

- 📦 `Package`: Representação de itens
- ⚠️ `AlertCircle`: Alertas e avisos
- 📈 `TrendingUp`: Urgência
- 📅 `Calendar`: Prazos

## 🚀 Como Usar

### 1. Acessar o Relatório

```
Sistema → Indústria → Itens a Produzir
```

### 2. Visualizar Resumo

Os 4 cards no topo mostram:
- Total de itens pendentes
- Quantidade de itens atrasados
- Quantidade de itens urgentes
- Quantidade de itens no prazo

### 3. Filtrar Resultados

Clique nos botões:
- **Todos:** Ver tudo
- **Atrasados:** Apenas com prazo vencido
- **Urgentes:** Próximos 3 dias

### 4. Analisar Detalhes

A tabela mostra:
- Qual ordem de produção (OP#)
- Para qual cliente
- Qual produto
- Quantos foram pedidos
- Quantos já foram produzidos
- **Quantos faltam produzir** (coluna em destaque)
- Progresso em %
- Prazo de produção
- Data de entrega
- Status visual

### 5. Tomar Ações

Com base no relatório:
1. Priorize itens atrasados
2. Planeje produção de itens urgentes
3. Monitore progresso das ordens
4. Identifique gargalos de produção

## 📈 Métricas Importantes

O relatório ajuda a acompanhar:

- **Taxa de conclusão:** % de ordens completas vs pendentes
- **Itens atrasados:** Quantidade de produtos com prazo vencido
- **Lead time:** Tempo entre pedido e conclusão
- **Gargalos:** Produtos que frequentemente atrasam

## ⚙️ Configuração

### Definição de "Urgente"

Atualmente configurado como: **3 dias**

Itens com prazo em 3 dias ou menos são marcados como urgentes.

### Status Automático

O sistema calcula automaticamente:
- **Atrasado:** `deadline < hoje`
- **Urgente:** `hoje <= deadline <= hoje + 3 dias`
- **No prazo:** `deadline > hoje + 3 dias`
- **Sem prazo:** `deadline = null`

## 🔮 Melhorias Futuras Sugeridas

1. **Exportação:** Permitir exportar para PDF/Excel
2. **Notificações:** Alertas automáticos de itens atrasados
3. **Gráficos:** Dashboard visual de produção
4. **Histórico:** Acompanhar tempo médio de produção
5. **Integração:** Link direto para criar produção do item

## 📚 Relacionado

- **Ordens de Produção:** Visualizar todas as ordens
- **Produção:** Lançar novas produções
- **Estoque Produtos:** Ver estoque disponível para venda
- **Entregas:** Acompanhar entregas criadas

---

**Resumo:** O relatório "Itens a Produzir" separa claramente o que está disponível (Estoque) do que precisa ser produzido (Pendente), eliminando a confusão de estoques negativos e melhorando a gestão de produção.
