# Correção: Erro de Schema Cache em Pagamentos de Projetos

## Problema Identificado

**Erro**: `Could not find the 'account_id' column of 'engineering_project_payments' in the schema cache`

### Causa Raiz

O erro ocorreu porque:

1. **Cache Desatualizado**: O PostgREST (API do Supabase) mantém um cache do schema do banco de dados. Quando removemos a coluna `account_id` e adicionamos `conta_caixa_id`, o cache não foi atualizado automaticamente.

2. **Tipo Incorreto no cash_flow**: Os triggers estavam usando `type = 'entrada'` mas a tabela `cash_flow` valida apenas `'income'` ou `'expense'`.

## Soluções Implementadas

### 1. Forçar Refresh do Schema Cache

**Ações:**
- ✅ Enviado comando `NOTIFY pgrst, 'reload schema'` para forçar reload
- ✅ Políticas RLS recriadas (força detecção de mudanças)
- ✅ Comentários da tabela atualizados
- ✅ Índices recriados
- ✅ Estatísticas atualizadas com `ANALYZE`
- ✅ Parâmetros da tabela alterados e revertidos (força refresh)

### 2. Corrigir Tipo no cash_flow

**ANTES (Incorreto):**
```sql
INSERT INTO cash_flow (..., type, ...)
VALUES (..., 'entrada', ...);  -- ❌ Inválido
```

**DEPOIS (Correto):**
```sql
INSERT INTO cash_flow (..., type, ...)
VALUES (..., 'income', ...);  -- ✅ Válido
```

**Funções Corrigidas:**
- ✅ `integrate_payment_to_cash_flow()` - usa 'income'
- ✅ `create_cash_flow_for_engineering_payment()` - usa 'income'
- ✅ `delete_cash_flow_for_engineering_payment()` - usa 'income'

### 3. Garantir Estrutura Correta

**Verificações Realizadas:**
- ✅ Coluna `account_id` não existe (removida)
- ✅ Coluna `conta_caixa_id` existe (ativa)
- ✅ Foreign key correto para `contas_caixa`
- ✅ Índices criados para performance
- ✅ Políticas RLS ativas
- ✅ 5 triggers ativos e funcionando

## Estrutura Final da Tabela

```sql
CREATE TABLE engineering_project_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES engineering_projects(id),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  value numeric NOT NULL CHECK (value > 0),
  payment_method payment_method_type NOT NULL,
  conta_caixa_id uuid REFERENCES contas_caixa(id),  -- ✅ Correto
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

## Integração com cash_flow

### Constraint do cash_flow

```sql
-- Validação do tipo
CHECK (type = ANY (ARRAY['income', 'expense']))
```

### Como Funciona Agora

**Quando você registra um pagamento:**

1. Inserção em `engineering_project_payments`
2. Trigger `integrate_payment_to_cash_flow` dispara
3. Cria registro em `cash_flow` com:
   - `type = 'income'` ✅ (receita)
   - `category = 'Serviços de Engenharia'`
   - `amount = valor do pagamento`
   - `conta_caixa_id = conta selecionada`
   - `business_unit = 'engineering'`
4. Trigger `update_project_total_received` atualiza totais do projeto

**Quando você deleta um pagamento:**

1. Deleção de `engineering_project_payments`
2. Trigger remove registro correspondente do `cash_flow`
3. Trigger atualiza totais do projeto

## Testes Realizados

### Teste de Estrutura
```
✅ PASSOU: conta_caixa_id existe, account_id não existe
```

### Teste de Triggers
```
✅ PASSOU: 5 triggers ativos
```

### Teste de Função
```
✅ PASSOU: Funções usam 'income' corretamente
```

### Teste de Índices
```
✅ PASSOU: Índices criados
```

### Teste de RLS
```
✅ PASSOU: RLS ativo
```

### Teste de Inserção e Deleção
```sql
-- Teste completo executado com sucesso
✅ PASSOU: Inserção de pagamento
✅ PASSOU: Registro criado no cash_flow automaticamente
✅ PASSOU: Deleção de pagamento
✅ PASSOU: Registro removido do cash_flow automaticamente
```

## Como Usar Agora

### Registrar um Pagamento

1. Acesse "Escritório de Engenharia" → "Projetos"
2. Clique no projeto desejado
3. Clique em "Pagamentos" (ícone financeiro)
4. Clique em "Adicionar Pagamento"
5. Preencha:
   - Data do pagamento
   - Valor (R$)
   - Método de pagamento
   - Conta de caixa (obrigatório)
   - Observações (opcional)
6. Clique em "Salvar Pagamento"

**Resultado Esperado:**
- ✅ Mensagem: "Pagamento registrado com sucesso!"
- ✅ Sem erros de schema cache
- ✅ Carregamento rápido (< 1 segundo)
- ✅ Totais atualizados automaticamente
- ✅ Registro criado no fluxo de caixa

## Verificações Manuais

### Verificar Estrutura da Tabela

```sql
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'engineering_project_payments'
ORDER BY ordinal_position;
```

**Esperado:**
- ✅ `conta_caixa_id` presente
- ✅ `account_id` ausente

### Verificar Integração com cash_flow

```sql
-- Ver pagamentos e suas entradas no cash_flow
SELECT
  p.name as projeto,
  pay.payment_date,
  pay.value,
  cf.type,
  cf.category,
  cf.amount
FROM engineering_project_payments pay
JOIN engineering_projects p ON p.id = pay.project_id
LEFT JOIN cash_flow cf ON
  cf.date = pay.payment_date
  AND cf.amount = pay.value
  AND cf.type = 'income'
  AND cf.category = 'Serviços de Engenharia'
ORDER BY pay.payment_date DESC
LIMIT 10;
```

**Esperado:**
- ✅ Todo pagamento tem entrada correspondente no cash_flow
- ✅ `type = 'income'` (não 'entrada')

### Verificar Triggers Ativos

```sql
SELECT
  trigger_name,
  event_manipulation
FROM information_schema.triggers
WHERE event_object_table = 'engineering_project_payments'
ORDER BY trigger_name;
```

**Esperado:**
- ✅ `integrate_payment_cash_flow` (INSERT, DELETE)
- ✅ `update_total_received_on_insert` (INSERT)
- ✅ `update_total_received_on_update` (UPDATE)
- ✅ `update_total_received_on_delete` (DELETE)

## Migrations Aplicadas

1. **fix_engineering_payment_cash_flow_integration.sql**
   - Corrigiu campos do cash_flow (value → amount)
   - Adicionou conta_caixa_id
   - Removeu account_id

2. **force_schema_cache_refresh_engineering_payments_v3.sql**
   - Forçou refresh do cache do PostgREST
   - Recriou políticas e índices
   - Atualizou comentários

3. **fix_engineering_payment_triggers_use_income_expense.sql**
   - Corrigiu triggers para usar 'income' ao invés de 'entrada'
   - Atualizou todas as 3 funções de trigger
   - Atualizou registros antigos no cash_flow

## Resumo

| Item | Status |
|------|--------|
| Erro de schema cache | ✅ Corrigido |
| Cache do PostgREST atualizado | ✅ Completo |
| Coluna conta_caixa_id funcionando | ✅ Completo |
| Triggers usando 'income' | ✅ Completo |
| Integração com cash_flow | ✅ Funcionando |
| Testes de inserção/deleção | ✅ Passando |
| Performance otimizada | ✅ Mantida |
| Build do projeto | ✅ Sem erros |

## Importante

⏱️ **Aguarde 5-10 segundos** após a aplicação das migrations para que o cache do PostgREST seja completamente atualizado.

🔄 Se ainda encontrar erro de cache:
1. Aguarde mais alguns segundos
2. Recarregue a página (F5)
3. O cache será atualizado automaticamente

✅ **Sistema pronto para uso!** Agora você pode registrar pagamentos sem erros de schema cache.
