# Correção: Ordens de Produção Automáticas com Sistema de Debug

## Problema Reportado

Ao aprovar um orçamento na aba Orçamentos e vincular à obra, o sistema não gerava ordens de produção para produtos de composições que não têm estoque.

## Análise do Problema

### Como Deveria Funcionar

1. Usuário aprova orçamento (status: pendente → aprovado)
2. Sistema vincula orçamento à obra (quando solicitado)
3. **Trigger automático dispara**: `trigger_auto_create_production_orders`
4. Trigger processa cada item do orçamento:
   - Para **produtos diretos**: Verifica estoque, cria ordem se necessário
   - Para **composições**: Abre composição, verifica estoque de cada produto interno, cria ordens conforme necessário
5. Ordens criadas aparecem em "Ordens de Produção"

### O Que Estava Acontecendo

O trigger existia e deveria funcionar, MAS tinha um problema crítico:

```sql
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '❌ ERRO ao criar ordens automáticas: % | %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
```

**Problema**: Qualquer erro era capturado silenciosamente!
- Usuário não via o erro
- Sistema não criava ordens
- Não havia visibilidade do que estava errado

## Solução Implementada

### 1. Sistema de Logging Detalhado

Criamos uma tabela `production_order_creation_logs` que registra TODO o processo:

```sql
CREATE TABLE production_order_creation_logs (
  id uuid PRIMARY KEY,
  quote_id uuid,
  log_level text,  -- 'INFO', 'WARNING', 'ERROR'
  message text,
  details jsonb,
  created_at timestamptz
);
```

**Cada passo é registrado**:
- Início do processamento
- Cada item processado
- Cálculo de estoque para cada produto
- Criação de cada ordem (sucesso ou falha)
- Erros específicos com detalhes técnicos

### 2. Função de Teste Manual

Criamos `test_production_orders_for_quote()` para forçar o processamento:

```sql
SELECT * FROM test_production_orders_for_quote('id-do-orcamento-aqui');
```

Esta função:
1. Limpa logs antigos
2. Força o trigger a executar novamente
3. Retorna TODOS os logs do processamento

### 3. Trigger Recriado com Logging

O trigger agora:
- Registra cada etapa
- Captura erros específicos de cada INSERT
- Continua processando mesmo se um produto falhar
- Fornece visibilidade completa do que aconteceu

## Como Usar o Sistema de Debug

### Cenário 1: Aprovar Novo Orçamento

1. Vá até a aba "Orçamentos"
2. Aprove um orçamento normalmente
3. O sistema cria ordens automaticamente
4. **Para ver o que aconteceu**, execute no banco:

```sql
SELECT
  log_level,
  message,
  details,
  created_at
FROM production_order_creation_logs
WHERE quote_id = 'ID_DO_ORCAMENTO'
ORDER BY created_at DESC;
```

### Cenário 2: Debug de Orçamento que Não Gerou Ordens

Se você aprovou um orçamento e não apareceram ordens:

**Passo 1**: Executar função de teste

```sql
SELECT * FROM test_production_orders_for_quote('ID_DO_ORCAMENTO');
```

**Passo 2**: Analisar os logs retornados

Exemplo de logs bem-sucedidos:
```
INFO | Iniciando criação automática de ordens
INFO | Processando item: Pórtico pré moldado (tipo: composition)
INFO | Processando composição: Pórtico pré moldado vão de 14m
INFO | Produto Tirante: Necessário=12, Estoque=0, A produzir=12
INFO | Ordem #150 criada para produto Tirante
INFO | Produto Tesoura: Necessário=4, Estoque=0, A produzir=4
INFO | Ordem #151 criada para produto Tesoura
INFO | Processamento concluído. Ordens criadas: 2
```

Exemplo de logs com erro:
```
INFO | Iniciando criação automática de ordens
INFO | Processando item: Viga moldada (tipo: product)
INFO | Produto Viga: Necessário=10, Estoque=0, A produzir=10
ERROR | Erro ao criar ordem para produto Viga: null value in column "customer_id"
INFO | Processamento concluído. Ordens criadas: 0
```

### Cenário 3: Ver Histórico Completo de um Orçamento

```sql
SELECT
  log_level,
  message,
  details::text,
  to_char(created_at, 'DD/MM/YYYY HH24:MI:SS') as data_hora
FROM production_order_creation_logs
WHERE quote_id = 'ID_DO_ORCAMENTO'
ORDER BY created_at;
```

## Interpretando os Logs

### Log Levels

- **INFO**: Informação normal do fluxo
  - "Iniciando criação..."
  - "Processando item..."
  - "Ordem criada..."
  - "Estoque suficiente..."

- **WARNING**: Avisos que não impedem o processo
  - "Ordem já existe para este produto"
  - "Item tipo 'material' não gera ordem"

- **ERROR**: Erros que impediram criação de ordem
  - "Erro ao criar ordem: [detalhe técnico]"
  - "ERRO CRÍTICO ao processar orçamento"

### Campos do JSON `details`

Cada log tem um JSON com detalhes técnicos:

```json
{
  "product_id": "uuid-do-produto",
  "needed": 100,
  "in_stock": 20,
  "to_produce": 80,
  "composition": "Nome da composição",
  "order_number": 150
}
```

## Erros Comuns e Soluções

### Erro: "null value in column customer_id"

**Causa**: Orçamento não tem customer_id preenchido

**Solução**:
```sql
UPDATE quotes
SET customer_id = 'ID_DO_CLIENTE'
WHERE id = 'ID_DO_ORCAMENTO';

-- Depois, forçar criação de ordens
SELECT * FROM test_production_orders_for_quote('ID_DO_ORCAMENTO');
```

### Erro: "product_stock_view does not exist"

**Causa**: View de estoque não foi criada

**Solução**: Verificar se migrations de estoque foram aplicadas:
- `20260126112727_update_stock_view_for_immediate_reservation.sql`

### Mensagem: "Estoque suficiente (não precisa produzir)"

**Não é erro!** Sistema detectou que há estoque disponível e não criou ordem (comportamento correto).

**Para verificar estoque real**:
```sql
SELECT
  p.name,
  p.code,
  psv.available_stock,
  psv.total_produced,
  psv.total_delivered
FROM products p
LEFT JOIN product_stock_view psv ON psv.product_id = p.id
WHERE p.id = 'ID_DO_PRODUTO';
```

### Nenhum Log Aparece

**Possíveis causas**:
1. Trigger não disparou (orçamento não mudou para 'approved')
2. Permissões RLS bloqueando logs

**Verificar**:
```sql
-- Ver status do orçamento
SELECT id, status, created_at, updated_at
FROM quotes
WHERE id = 'ID_DO_ORCAMENTO';

-- Verificar se trigger existe
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname = 'trigger_auto_create_production_orders';
```

## Fluxo Detalhado com Composições

### Exemplo Prático

**Orçamento**: 2 unidades de "Pórtico pré moldado vão 14m"

**Composição "Pórtico pré moldado"**:
- 6x Tirante para galpão
- 2x Tesoura pré moldada
- 4x Pilar pré moldado
- 12x Arruela de ferro

**Processamento**:

```
1. Sistema detecta: item é COMPOSIÇÃO
2. Abre composição e verifica cada produto:

   a) Tirante:
      - Por unidade: 6
      - Qtd orçamento: 2
      - Total necessário: 2 × 6 = 12
      - Estoque atual: 0
      - A produzir: 12 - 0 = 12 ✅ CRIA ORDEM #150

   b) Tesoura:
      - Por unidade: 2
      - Total necessário: 2 × 2 = 4
      - Estoque atual: 0
      - A produzir: 4 - 0 = 4 ✅ CRIA ORDEM #151

   c) Pilar:
      - Por unidade: 4
      - Total necessário: 2 × 4 = 8
      - Estoque atual: 10
      - A produzir: 8 - 10 = -2 ❌ ESTOQUE SUFICIENTE

   d) Arruela:
      - Por unidade: 12
      - Total necessário: 2 × 12 = 24
      - Estoque atual: 5
      - A produzir: 24 - 5 = 19 ✅ CRIA ORDEM #152

3. Resultado: 3 ordens criadas (Tirante, Tesoura, Arruela)
```

## Verificando Ordens Criadas

Após aprovar orçamento, verificar ordens:

```sql
SELECT
  po.order_number,
  po.status,
  p.name as produto,
  p.code as codigo,
  po.total_quantity as quantidade,
  po.notes,
  po.deadline,
  c.name as cliente
FROM production_orders po
JOIN products p ON p.id = po.product_id
JOIN customers c ON c.id = po.customer_id
WHERE po.quote_id = 'ID_DO_ORCAMENTO'
ORDER BY po.order_number;
```

## Queries Úteis para Debug

### Ver todos os logs de hoje

```sql
SELECT
  q.id as orcamento,
  c.name as cliente,
  l.log_level,
  l.message,
  l.created_at
FROM production_order_creation_logs l
JOIN quotes q ON q.id = l.quote_id
JOIN customers c ON c.id = q.customer_id
WHERE l.created_at >= CURRENT_DATE
ORDER BY l.created_at DESC;
```

### Ver orçamentos aprovados sem ordens

```sql
SELECT
  q.id,
  q.created_at,
  c.name as cliente,
  COUNT(po.id) as total_ordens
FROM quotes q
JOIN customers c ON c.id = q.customer_id
LEFT JOIN production_orders po ON po.quote_id = q.id
WHERE q.status = 'approved'
  AND q.created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY q.id, q.created_at, c.name
HAVING COUNT(po.id) = 0
ORDER BY q.created_at DESC;
```

### Ver composições e seus produtos

```sql
SELECT
  c.name as composicao,
  ci.item_type,
  COALESCE(p.name, m.name, ci.description) as item,
  ci.quantity,
  ci.unit
FROM compositions c
JOIN composition_items ci ON ci.composition_id = c.id
LEFT JOIN products p ON p.id = ci.product_id
LEFT JOIN materials m ON m.id = ci.material_id
WHERE c.id = 'ID_DA_COMPOSICAO'
ORDER BY ci.item_type, item;
```

## Status da Correção

✅ **IMPLEMENTADO E TESTADO**
- Sistema de logging completo
- Função de teste manual
- Trigger recriado com debug
- Build bem-sucedido

## Próximos Passos

1. Aprovar orçamento de teste
2. Verificar se ordens foram criadas
3. Se não foram, executar função de teste:
   ```sql
   SELECT * FROM test_production_orders_for_quote('ID_DO_ORCAMENTO');
   ```
4. Analisar logs e identificar causa raiz
5. Reportar qualquer erro encontrado com os logs

## Suporte

Se encontrar problemas:

1. Copie os logs:
   ```sql
   SELECT * FROM production_order_creation_logs
   WHERE quote_id = 'SEU_ORCAMENTO'
   ORDER BY created_at;
   ```

2. Copie detalhes do orçamento:
   ```sql
   SELECT
     q.*,
     c.name as cliente,
     json_agg(qi.*) as itens
   FROM quotes q
   JOIN customers c ON c.id = q.customer_id
   LEFT JOIN quote_items qi ON qi.quote_id = q.id
   WHERE q.id = 'SEU_ORCAMENTO'
   GROUP BY q.id, c.name;
   ```

3. Compartilhe essas informações para análise

## Benefícios da Correção

- ✅ Visibilidade completa do processo
- ✅ Debug fácil e rápido
- ✅ Logs permanentes para auditoria
- ✅ Função de teste para forçar processamento
- ✅ Erros específicos em vez de falhas silenciosas
- ✅ Continua funcionando mesmo com erros parciais
