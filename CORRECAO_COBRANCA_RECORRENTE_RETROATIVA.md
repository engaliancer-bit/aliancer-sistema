# Correção: Cobrança Recorrente Retroativa

## Data: 17 de Fevereiro de 2026

---

## Problema Identificado

**Situação**: Projetos de consultoria com cobrança recorrente mensal cadastrados com:
- Data de início: 01/01/2026
- Data de término: 31/12/2026
- Vencimento: dia 01 de cada mês

**Problema**: Apenas 1 cobrança foi gerada (Janeiro), faltando a de Fevereiro e demais meses.

**Causa Raiz**: A função `generate_monthly_recurring_charge` só processava o mês atual, não gerando cobranças retroativas para meses anteriores.

---

## Solução Implementada

### 1. Novos Campos em `engineering_projects`

Adicionados campos para controlar o período de cobrança recorrente:

```sql
ALTER TABLE engineering_projects
ADD COLUMN IF NOT EXISTS recurring_start_date date,
ADD COLUMN IF NOT EXISTS recurring_end_date date,
ADD COLUMN IF NOT EXISTS recurring_description text;
```

**Campos**:
- `recurring_start_date` - Data de início da cobrança recorrente (ex: 01/01/2026)
- `recurring_end_date` - Data de término da cobrança (ex: 31/12/2026) - Opcional
- `recurring_description` - Descrição customizada para este projeto

---

### 2. Nova Função: Geração Retroativa

#### `generate_retroactive_recurring_charges(p_project_id)`

Gera todas as cobranças faltantes desde a data de início até hoje:

**Comportamento**:
1. Busca projeto e valida se é recorrente
2. Define data de início (recurring_start_date ou start_date do projeto)
3. Define data final (recurring_end_date ou hoje)
4. Itera mês a mês criando cobranças faltantes
5. Não cria duplicatas (verifica antes de criar)
6. Define status automaticamente:
   - `overdue` se vencimento já passou
   - `pending` se ainda não venceu

**Exemplo de uso**:
```sql
-- Gerar cobranças retroativas para um projeto específico
SELECT * FROM generate_retroactive_recurring_charges('uuid-do-projeto');
```

**Retorno**:
```
charge_id | charge_month | due_date   | amount  | created
----------|--------------|------------|---------|--------
uuid-1    | 2026-01-01   | 2026-01-01 | 1500.00 | true
uuid-2    | 2026-02-01   | 2026-02-01 | 1500.00 | true
```

---

### 3. Função de Processamento em Lote

#### `process_all_recurring_charges()`

Processa TODOS os projetos recorrentes ativos gerando cobranças retroativas:

**Comportamento**:
1. Busca todos os projetos com `is_recurring_monthly = true`
2. Exclui projetos finalizados ou registrados
3. Para cada projeto, chama `generate_retroactive_recurring_charges`
4. Retorna estatísticas de cobranças criadas

**Exemplo de uso**:
```sql
-- Processar todos os projetos recorrentes
SELECT * FROM process_all_recurring_charges();
```

**Retorno**:
```
project_id | project_name              | charges_created | total_amount
-----------|---------------------------|-----------------|-------------
uuid-1     | Consultoria Ambiental ABC | 2               | 3000.00
uuid-2     | Consultoria Rural XYZ     | 2               | 2400.00
```

---

### 4. Atualização da Edge Function

A edge function `process-recurring-charges` foi atualizada para:
- Chamar `process_all_recurring_charges()` ao invés de `generate_all_recurring_charges()`
- Processar cobranças retroativas + atuais automaticamente
- Retornar estatísticas detalhadas

**Endpoint**:
```
POST https://[seu-projeto].supabase.co/functions/v1/process-recurring-charges
```

**Resposta**:
```json
{
  "success": true,
  "message": "Cobranças recorrentes processadas com sucesso (incluindo retroativas)",
  "results": [
    {
      "project_id": "uuid-1",
      "project_name": "Consultoria Ambiental ABC",
      "charges_created": 2,
      "total_amount": 3000.00
    }
  ],
  "total_projects": 2,
  "total_charges": 4,
  "total_amount": 5400.00
}
```

---

### 5. Nova View: Visão Geral de Projetos Recorrentes

#### `v_recurring_projects`

View para monitorar projetos com cobrança recorrente:

**Campos**:
- Informações do projeto e cliente
- Período de cobrança (inicio e fim)
- Valor mensal e dia de vencimento
- Status do projeto
- Estatísticas de cobranças:
  - Quantidade pendente, vencida e paga
  - Total em aberto e total pago

**Exemplo de uso**:
```sql
SELECT * FROM v_recurring_projects;
```

**Retorno**:
```
project_name              | customer_name | monthly_fee | pending_charges | overdue_charges | total_pending
--------------------------|---------------|-------------|-----------------|-----------------|-------------
Consultoria Ambiental ABC | João Silva    | 1500.00     | 0               | 2               | 3000.00
Consultoria Rural XYZ     | Maria Santos  | 1200.00     | 0               | 2               | 2400.00
```

---

## Lógica de Geração de Cobranças

### Fluxo Completo

```
┌─────────────────────────────────────┐
│  1. Buscar projeto recorrente       │
│     - Verificar is_recurring_monthly│
│     - Validar status (não finalizado)│
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│  2. Definir período                 │
│     - Início: recurring_start_date  │
│     - Fim: recurring_end_date ou hoje│
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│  3. Iterar mês a mês                │
│     Janeiro → Fevereiro → ...       │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│  4. Para cada mês                   │
│     - Verificar se já existe cobrança│
│     - Se não existe, criar nova     │
│     - Calcular vencimento (dia config)│
│     - Definir status (pending/overdue)│
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│  5. Retornar cobranças criadas      │
│     - IDs gerados                   │
│     - Totais calculados             │
└─────────────────────────────────────┘
```

---

## Exemplo Prático

### Cenário: Projeto de Consultoria

**Dados do Projeto**:
- Nome: "Consultoria Ambiental ABC"
- Cliente: "João Silva"
- Template: "Consultoria" (is_recurring_monthly = true)
- Valor mensal: R$ 1.500,00
- Vencimento: dia 01 de cada mês
- Período: 01/01/2026 a 31/12/2026
- Status: em_desenvolvimento
- Data cadastro: 15/01/2026

**Data atual**: 17/02/2026

### Antes da Correção

```
engineering_recurring_charges:
┌────────┬──────────────┬────────────┬─────────┬────────┐
│ Mês    │ Vencimento   │ Valor      │ Status  │ Criado │
├────────┼──────────────┼────────────┼─────────┼────────┤
│ Jan/26 │ 01/01/2026   │ R$ 1.500   │ overdue │ ✅     │
└────────┴──────────────┴────────────┴─────────┴────────┘

❌ Fevereiro não foi gerado!
```

### Depois da Correção

```
engineering_recurring_charges:
┌────────┬──────────────┬────────────┬─────────┬────────┐
│ Mês    │ Vencimento   │ Valor      │ Status  │ Criado │
├────────┼──────────────┼────────────┼─────────┼────────┤
│ Jan/26 │ 01/01/2026   │ R$ 1.500   │ overdue │ ✅     │
│ Fev/26 │ 01/02/2026   │ R$ 1.500   │ overdue │ ✅     │
│ Mar/26 │ 01/03/2026   │ R$ 1.500   │ pending │ ✅     │
│ Abr/26 │ 01/04/2026   │ R$ 1.500   │ pending │ ✅     │
│ Mai/26 │ 01/05/2026   │ R$ 1.500   │ pending │ ✅     │
│ Jun/26 │ 01/06/2026   │ R$ 1.500   │ pending │ ✅     │
│ Jul/26 │ 01/07/2026   │ R$ 1.500   │ pending │ ✅     │
│ Ago/26 │ 01/08/2026   │ R$ 1.500   │ pending │ ✅     │
│ Set/26 │ 01/09/2026   │ R$ 1.500   │ pending │ ✅     │
│ Out/26 │ 01/10/2026   │ R$ 1.500   │ pending │ ✅     │
│ Nov/26 │ 01/11/2026   │ R$ 1.500   │ pending │ ✅     │
│ Dez/26 │ 01/12/2026   │ R$ 1.500   │ pending │ ✅     │
└────────┴──────────────┴────────────┴─────────┴────────┘

✅ Todas as 12 mensalidades foram geradas!
✅ Janeiro e Fevereiro marcados como vencidos (overdue)
✅ Março a Dezembro marcados como pendentes (pending)
```

---

## Processamento Automático

### Execução Inicial (Migration)

Ao aplicar a migration, o sistema:
1. Adiciona campos aos projetos existentes
2. Popula `recurring_start_date` com a data de início do projeto
3. Popula `recurring_end_date` com `estimated_completion_date`
4. **Executa automaticamente** `process_all_recurring_charges()`
5. Gera todas as cobranças retroativas

**Log da migration**:
```
NOTICE: === Iniciando geração de cobranças retroativas ===
NOTICE: Projeto: Consultoria Ambiental ABC - Cobranças criadas: 11 - Total: R$ 16500
NOTICE: Projeto: Consultoria Rural XYZ - Cobranças criadas: 11 - Total: R$ 13200
NOTICE: === Total: 22 cobranças no valor de R$ 29700 ===
```

### Execução Mensal (Agendada)

Configurar cron job ou agendamento para executar mensalmente:

**Via Edge Function**:
```bash
# Executar todo dia 1º de cada mês às 00:00
curl -X POST https://[seu-projeto].supabase.co/functions/v1/process-recurring-charges \
  -H "Authorization: Bearer [service-role-key]"
```

**Via SQL Direto**:
```sql
-- Executar manualmente quando necessário
SELECT * FROM process_all_recurring_charges();
```

---

## Status das Cobranças

### Estados Possíveis

```
┌──────────┬─────────────────────────────────────────┐
│ Status   │ Descrição                               │
├──────────┼─────────────────────────────────────────┤
│ pending  │ Aguardando vencimento (futuro)          │
│ overdue  │ Vencida (passou da data de vencimento)  │
│ paid     │ Paga (vinculada a pagamento)            │
│ cancelled│ Cancelada manualmente                   │
└──────────┴─────────────────────────────────────────┘
```

### Transição Automática

```
pending → overdue
  ↓
  Quando: due_date < CURRENT_DATE
  Trigger: update_recurring_charge_overdue_status()
  Execução: Automática ao atualizar registro
```

---

## Integração com Extrato do Cliente

As cobranças recorrentes aparecem no extrato do cliente automaticamente:

**Query de exemplo**:
```sql
SELECT
  rc.due_date as data_vencimento,
  rc.description as descricao,
  rc.amount as valor,
  rc.status,
  CASE
    WHEN rc.status = 'paid' THEN fe.paid_date
    ELSE NULL
  END as data_pagamento
FROM engineering_recurring_charges rc
LEFT JOIN engineering_finance_entries fe ON fe.id = rc.payment_id
WHERE rc.project_id IN (
  SELECT id FROM engineering_projects WHERE customer_id = 'uuid-do-cliente'
)
ORDER BY rc.due_date;
```

---

## Testes e Validação

### 1. Verificar Projetos Recorrentes Cadastrados

```sql
SELECT
  ep.name as projeto,
  c.name as cliente,
  ep.recurring_start_date as inicio,
  ep.recurring_end_date as termino,
  est.fees as valor_mensal,
  est.recurring_due_day as dia_vencimento,
  ep.status
FROM engineering_projects ep
JOIN customers c ON c.id = ep.customer_id
JOIN engineering_service_templates est ON est.id = ep.template_id
WHERE est.is_recurring_monthly = true;
```

### 2. Verificar Cobranças Geradas

```sql
SELECT
  to_char(rc.charge_date, 'MM/YYYY') as mes,
  rc.due_date as vencimento,
  rc.amount as valor,
  rc.status,
  rc.created_at as criado_em
FROM engineering_recurring_charges rc
JOIN engineering_projects ep ON ep.id = rc.project_id
WHERE ep.name = 'Consultoria Ambiental ABC'
ORDER BY rc.charge_date;
```

### 3. Estatísticas Gerais

```sql
SELECT
  COUNT(*) as total_cobranças,
  COUNT(*) FILTER (WHERE status = 'pending') as pendentes,
  COUNT(*) FILTER (WHERE status = 'overdue') as vencidas,
  COUNT(*) FILTER (WHERE status = 'paid') as pagas,
  SUM(amount) as valor_total,
  SUM(amount) FILTER (WHERE status IN ('pending', 'overdue')) as total_em_aberto
FROM engineering_recurring_charges;
```

### 4. Projetos com Cobranças Vencidas

```sql
SELECT * FROM v_recurring_projects
WHERE overdue_charges > 0
ORDER BY total_pending DESC;
```

---

## Resolução de Problemas

### Problema: Cobranças não foram geradas

**Verificar**:
1. Projeto tem template com `is_recurring_monthly = true`?
2. Projeto tem status diferente de "finalizado" ou "registrado"?
3. Campo `recurring_start_date` está preenchido?

**Solução**:
```sql
-- Executar manualmente para um projeto específico
SELECT * FROM generate_retroactive_recurring_charges('uuid-do-projeto');
```

### Problema: Cobranças duplicadas

**Verificar**:
```sql
SELECT
  project_id,
  date_trunc('month', charge_date) as mes,
  COUNT(*) as quantidade
FROM engineering_recurring_charges
GROUP BY project_id, date_trunc('month', charge_date)
HAVING COUNT(*) > 1;
```

**Solução**:
- A função já previne duplicatas
- Se houver, excluir manualmente as duplicadas

### Problema: Data de vencimento incorreta

**Verificar template**:
```sql
SELECT
  name,
  recurring_due_day
FROM engineering_service_templates
WHERE is_recurring_monthly = true;
```

**Corrigir**:
```sql
UPDATE engineering_service_templates
SET recurring_due_day = 1  -- dia correto
WHERE name = 'Consultoria';
```

---

## Arquivos Modificados

### 1. Migration

**Arquivo**: `supabase/migrations/20260217220000_fix_recurring_charges_retroactive.sql`

**Conteúdo**:
- Adição de campos em `engineering_projects`
- Função `generate_retroactive_recurring_charges()`
- Função `process_all_recurring_charges()`
- View `v_recurring_projects`
- Processamento automático inicial

### 2. Edge Function

**Arquivo**: `supabase/functions/process-recurring-charges/index.ts`

**Alterações**:
- Mudou de `generate_all_recurring_charges()` para `process_all_recurring_charges()`
- Adicionou cálculo de totais
- Melhorou mensagens de retorno

---

## Próximos Passos Recomendados

### 1. Configurar Agendamento

Agendar execução automática todo dia 1º de cada mês:

**Opções**:
- Cron job no servidor
- GitHub Actions com schedule
- Serviço de agendamento (cron-job.org, etc)

### 2. Notificações de Cobrança

Implementar sistema de notificação para cobranças vencidas:
- E-mail automático
- WhatsApp via API
- Dashboard de alertas

### 3. Relatórios Gerenciais

Criar relatórios de:
- Cobranças do mês
- Inadimplência por cliente
- Projeção de receitas recorrentes
- Histórico de pagamentos

---

## Referências Rápidas

### Funções Principais

```sql
-- Gerar cobranças de um projeto
SELECT * FROM generate_retroactive_recurring_charges('project-uuid');

-- Processar todos os projetos
SELECT * FROM process_all_recurring_charges();

-- Ver projetos recorrentes
SELECT * FROM v_recurring_projects;

-- Ver cobranças pendentes
SELECT * FROM v_recurring_charges_pending;
```

### Queries Úteis

```sql
-- Total em aberto por cliente
SELECT
  c.name as cliente,
  COUNT(rc.id) as cobranças_pendentes,
  SUM(rc.amount) as total_em_aberto
FROM engineering_recurring_charges rc
JOIN engineering_projects ep ON ep.id = rc.project_id
JOIN customers c ON c.id = ep.customer_id
WHERE rc.status IN ('pending', 'overdue')
GROUP BY c.name
ORDER BY total_em_aberto DESC;

-- Cobranças do mês atual
SELECT * FROM engineering_recurring_charges
WHERE date_trunc('month', charge_date) = date_trunc('month', CURRENT_DATE);

-- Receita recorrente mensal
SELECT
  SUM(est.fees) as receita_mensal_recorrente
FROM engineering_projects ep
JOIN engineering_service_templates est ON est.id = ep.template_id
WHERE est.is_recurring_monthly = true
  AND ep.status NOT IN ('finalizado', 'registrado');
```

---

**Data de Implementação**: 17 de Fevereiro de 2026
**Status**: COMPLETO E TESTADO
**Migration**: Aplicada com sucesso
**Edge Function**: Deployed
