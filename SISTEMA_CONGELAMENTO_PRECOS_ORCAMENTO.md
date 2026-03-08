# Sistema de Congelamento de Preços em Orçamentos

## Resumo da Implementação

Foi implementado um sistema completo de congelamento de preços para orçamentos individuais. Agora você pode "fotografar" os valores de um orçamento específico, protegendo-o de mudanças automáticas de preços no sistema.

## 🎯 Problema Resolvido

**Antes:** Quando você mudava o preço de um produto ou insumo no sistema, TODOS os orçamentos eram automaticamente recalculados com os novos preços, o que podia causar problemas quando você já tinha acordado um valor com o cliente.

**Agora:** Você pode congelar os preços de orçamentos específicos. O orçamento congelado mantém os valores acordados, enquanto os preços dos produtos no sistema continuam atualizando normalmente.

## 📊 Campos Adicionados ao Banco

A tabela `quotes` agora possui três novos campos:

### 1. `precos_congelados` (boolean)
- Indica se o orçamento está com preços congelados
- `false` = orçamento usa preços atuais dos produtos
- `true` = orçamento usa valores do snapshot

### 2. `snapshot_valores` (jsonb)
- Armazena o "snapshot" completo dos valores no momento do congelamento
- Estrutura:
```json
{
  "items": [
    {
      "item_id": "uuid",
      "item_type": "product",
      "product_id": "uuid",
      "item_name": "Poste 9x9x280",
      "quantity": 10,
      "unit": "un",
      "unit_cost": 50.00,
      "unit_price": 120.00,
      "total_cost": 500.00,
      "total_price": 1200.00,
      "margin": 700.00
    }
  ],
  "totals": {
    "total_cost": 5000.00,
    "total_price": 12000.00,
    "total_margin": 7000.00,
    "margin_percentage": 58.33,
    "discount_value": 0,
    "final_value": 12000.00
  },
  "frozen_at": "2026-02-10T15:30:00Z"
}
```

### 3. `data_congelamento` (timestamptz)
- Data e hora em que os preços foram congelados
- Permite auditoria e rastreamento

## 🔄 Como Funciona

### Congelar Preços

1. Abra um orçamento existente para edição
2. Ative o checkbox "Congelar Preços"
3. O sistema:
   - Busca todos os itens do orçamento
   - Calcula custos usando `custo_unitario_materiais` dos produtos
   - Usa preços de venda atual de cada item
   - Cria snapshot com todos os valores
   - Marca orçamento como congelado

### Descongelar Preços

1. Desmarque o checkbox "Congelar Preços"
2. O sistema:
   - Remove o snapshot
   - Volta a calcular valores em tempo real
   - Usa preços atuais dos produtos

## 🎨 Interface do Usuário

### Visual do Toggle

**Quando NÃO congelado:**
```
┌─────────────────────────────────────────────────┐
│ 🔓 ☐ Congelar Preços                           │
│                                                  │
│ Congela os valores deste orçamento, criando um  │
│ snapshot dos preços atuais. Os preços dos       │
│ produtos no sistema continuam atualizando       │
│ normalmente.                                     │
└─────────────────────────────────────────────────┘
```

**Quando congelado:**
```
┌─────────────────────────────────────────────────┐
│ 🔒 ☑ Congelar Preços      Valor Congelado      │
│                              R$ 12.000,00       │
│ Preços congelados desde 10/02/2026 às 15:30    │
│                                                  │
│ Os valores deste orçamento não serão atualizados│
│ automaticamente. Os preços dos produtos no      │
│ sistema continuam atualizando normalmente.      │
└─────────────────────────────────────────────────┘
```

### Cores e Indicadores

- **Não congelado:** Borda cinza, fundo cinza claro
- **Congelado:** Borda amarela/âmbar, fundo amarelo claro
- **Ícones:**
  - 🔓 (Unlock) = Preços dinâmicos
  - 🔒 (Lock) = Preços congelados

## 🔧 Funções do Banco de Dados

### 1. `freeze_quote_prices(quote_id)`

Congela os preços de um orçamento:

```sql
SELECT freeze_quote_prices('uuid-do-orcamento');
```

**O que faz:**
- Busca todos os itens do orçamento
- Calcula custo usando `custo_unitario_materiais` dos produtos
- Calcula totais (custo, venda, margem)
- Cria snapshot completo em JSON
- Marca orçamento como congelado
- Registra data/hora do congelamento

**Retorna:** JSON com o snapshot criado

### 2. `unfreeze_quote_prices(quote_id)`

Descongela os preços de um orçamento:

```sql
SELECT unfreeze_quote_prices('uuid-do-orcamento');
```

**O que faz:**
- Remove flag de congelamento
- Limpa snapshot
- Remove data de congelamento
- Orçamento volta a usar preços atuais

### 3. `get_quote_totals(quote_id)`

Retorna totais do orçamento (congelados ou atuais):

```sql
SELECT * FROM get_quote_totals('uuid-do-orcamento');
```

**Retorna:**
```
total_cost           | 5000.00
total_price          | 12000.00
total_margin         | 7000.00
margin_percentage    | 58.33
discount_value       | 0.00
final_value          | 12000.00
is_frozen            | true
frozen_at            | 2026-02-10 15:30:00
```

**Lógica:**
- Se `precos_congelados = true`: Retorna valores do snapshot
- Se `precos_congelados = false`: Calcula valores em tempo real

## 📝 Casos de Uso

### Caso 1: Orçamento Aprovado Pelo Cliente

**Situação:** Cliente aprovou orçamento de R$ 50.000,00 com prazo de 30 dias para decidir.

**Solução:**
1. Congele o orçamento após aprovação do cliente
2. Mesmo que você aumente preços no sistema, o orçamento mantém R$ 50.000,00
3. Se cliente aceitar após 30 dias, valores permanecem os mesmos

### Caso 2: Orçamento para Licitação

**Situação:** Precisa enviar orçamento para licitação que será avaliada em 60 dias.

**Solução:**
1. Congele o orçamento antes de enviar
2. Sistema não recalcula valores automaticamente
3. Você pode continuar atualizando preços para outras vendas
4. Orçamento da licitação mantém valores originais

### Caso 3: Comparação de Preços

**Situação:** Cliente quer comparar preço atual vs. preço de 6 meses atrás.

**Solução:**
1. Mantenha orçamento antigo congelado
2. Crie novo orçamento com preços atuais
3. Compare facilmente valores congelados vs. atuais

## ⚠️ Pontos Importantes

### O que o Congelamento FAZ:
✅ Protege valores do orçamento específico
✅ Mantém histórico de preços no momento do congelamento
✅ Permite auditoria (quando foi congelado)
✅ Mostra claramente que está congelado na interface

### O que o Congelamento NÃO FAZ:
❌ NÃO afeta preços dos produtos no sistema
❌ NÃO impede mudanças nos cadastros de produtos
❌ NÃO congela outros orçamentos
❌ NÃO impede edição dos itens do orçamento

### Quando Congelar:
- ✅ Após aprovar orçamento com cliente
- ✅ Antes de enviar para licitação
- ✅ Para manter registro histórico de preços
- ✅ Quando precisa garantir valor fixo

### Quando NÃO Congelar:
- ❌ Orçamentos em elaboração
- ❌ Orçamentos que precisam acompanhar preços atuais
- ❌ Orçamentos internos/provisórios

## 🧪 Como Testar

### Teste Manual na Interface:

1. **Abrir orçamento existente:**
   - Clique em editar em qualquer orçamento
   - Veja o toggle "Congelar Preços" (só aparece ao editar)

2. **Congelar preços:**
   - Marque o checkbox "Congelar Preços"
   - Veja mensagem de confirmação
   - Note visual amarelo/âmbar indicando congelamento
   - Veja valor congelado exibido

3. **Mudar preço de produto:**
   - Vá em Produtos e aumente preço de algum produto usado no orçamento
   - Volte ao orçamento congelado
   - Confirme que valor não mudou

4. **Descongelar:**
   - Desmarque o checkbox
   - Veja mensagem de confirmação
   - Note que valor agora usa preços atuais

### Teste via SQL:

Execute o script de teste:
```bash
# No psql ou Supabase SQL Editor
\i TESTE_CONGELAMENTO_PRECOS_ORCAMENTO.sql
```

O script testa:
- Criação de campos
- Funções de congelar/descongelar
- Snapshot de valores
- Imunidade a mudanças de preço
- Recálculo ao descongelar

## 📈 Integração com Sistema Existente

### Compatibilidade:

✅ **Sistema de Recálculo Automático de Custos:**
- Produtos continuam tendo custos recalculados automaticamente
- Orçamentos congelados não são afetados
- Orçamentos não congelados usam custos atualizados

✅ **Relatórios:**
- Relatórios mostram valores corretos (congelados ou atuais)
- Função `get_quote_totals()` pode ser usada em relatórios

✅ **Vendas e Financeiro:**
- Ao aprovar orçamento congelado, usa valores do snapshot
- Ao aprovar orçamento não congelado, usa valores atuais

## 🔍 Auditoria e Rastreamento

### Informações Disponíveis:

```sql
-- Ver orçamentos congelados
SELECT
  q.id,
  c.name as cliente,
  q.precos_congelados,
  q.data_congelamento,
  (q.snapshot_valores->'totals'->>'final_value')::numeric as valor_congelado
FROM quotes q
JOIN customers c ON c.id = q.customer_id
WHERE q.precos_congelados = true;

-- Ver histórico de snapshot de um orçamento
SELECT
  id,
  precos_congelados,
  data_congelamento,
  jsonb_pretty(snapshot_valores) as snapshot_completo
FROM quotes
WHERE id = 'uuid-do-orcamento';

-- Comparar orçamento congelado vs. valores atuais
SELECT
  'Congelado' as tipo,
  (snapshot_valores->'totals'->>'final_value')::numeric as valor
FROM quotes
WHERE id = 'uuid-do-orcamento'
UNION ALL
SELECT
  'Atual' as tipo,
  (SELECT final_value FROM get_quote_totals('uuid-do-orcamento'));
```

## ✨ Benefícios

1. **Segurança:** Valores acordados não mudam acidentalmente
2. **Transparência:** Cliente vê exatamente o que foi acordado
3. **Flexibilidade:** Você pode atualizar preços sem medo
4. **Auditoria:** Histórico completo de valores congelados
5. **Controle:** Você decide quais orçamentos congelar
6. **Simplicidade:** Um clique para congelar/descongelar

## 🎓 Dicas de Uso

1. **Sempre congele após aprovação do cliente**
2. **Descongele apenas se cliente pedir recotação**
3. **Use para guardar histórico de preços antigos**
4. **Congele antes de enviar para licitações**
5. **Mantenha controle de quais orçamentos estão congelados**

---

Sistema pronto para uso! Você agora tem controle total sobre quando os preços dos orçamentos devem ou não ser atualizados automaticamente.
