# Sistema de Cobrança Recorrente Automática - Consultoria

## Resumo

Sistema completamente automático que gera cobranças mensais recorrentes para projetos de consultoria **desde a data de início do projeto até hoje**, com vencimento no dia especificado no template.

## Como Funciona

### 1. Geração Automática ao Criar Projeto

Quando você cria um projeto de consultoria com template que tem cobrança recorrente mensal:

1. Sistema verifica a **data de início do projeto**
2. Gera **automaticamente todas as cobranças mensais** desde essa data até hoje
3. Define o **vencimento** conforme o dia especificado no template
4. Marca como **"overdue"** as cobranças com vencimento passado
5. Marca como **"pending"** as cobranças futuras

### 2. Exemplo Prático

**Cenário**:
- Data de início: **01/01/2026**
- Data de hoje: **17/02/2026**
- Dia de vencimento: **5**
- Valor mensal: **R$ 3.500,00**

**Resultado**:
Sistema cria **2 cobranças automaticamente**:
1. **Vencimento: 05/01/2026** - Status: **Vencido** (overdue)
2. **Vencimento: 05/02/2026** - Status: **Vencido** (overdue)

Ao executar a função de gerar cobranças novamente em Março:
3. **Vencimento: 05/03/2026** - Status: **Pendente** (pending)

## Localização da Aba Consultoria

### Menu de Navegação

**Escritório de Engenharia e Topografia** > **Projetos**

### Abas Disponíveis

1. **Em Andamento** - Projetos normais em andamento (com imóvel vinculado)
2. **A Cobrar** - Projetos com saldo a receber
3. **Consultoria** - Projetos de consultoria (sem imóvel vinculado) ⭐ NOVA ABA
4. **Registrados** - Projetos concluídos e registrados
5. **Extrato do Cliente** - Visualização de extratos

## Como Usar

### Passo 1: Configurar Template de Consultoria

1. Acesse **Projetos (Templates)**
2. Crie ou edite um template
3. Configure:
   - **Categoria**: Consultoria
   - **Cobrança Recorrente**: ✅ Ativado
   - **Dia do Vencimento**: 1 a 31 (ex: 5)
   - **Valor Mensal**: R$ 3.500,00
   - **Descrição da Recorrência**: "Mensalidade consultoria"

### Passo 2: Criar Projeto de Consultoria

1. Clique em **"Novo Projeto"**
2. Selecione o **template de consultoria**
3. Preencha:
   - Nome do Projeto
   - Cliente
   - **Imóvel**: Deixe como "Não vinculado a imóvel"
   - **Data de Início**: Escolha a data (ex: 01/01/2026)
4. Salve

**Sistema gera automaticamente todas as cobranças desde a data de início!**

### Passo 3: Visualizar Cobranças

1. Acesse a aba **"Consultoria"**
2. Selecione o projeto
3. Clique na aba **"Financeiro"**
4. Veja todas as cobranças geradas automaticamente

### Passo 4: Marcar Cobranças como Pagas

1. Na lista de cobranças recorrentes
2. Clique em **"Marcar como Pago"**
3. Confirme a data de pagamento
4. Sistema registra o pagamento automaticamente

## Regras de Negócio

### Detecção de Projeto de Consultoria

✅ **É Consultoria quando**:
- `property_id` é **NULL**
- Aparece na aba **"Consultoria"**
- Não aparece na aba **"Em Andamento"**

❌ **NÃO é Consultoria quando**:
- `property_id` tem valor (imóvel vinculado)
- Aparece na aba **"Em Andamento"**
- Não aparece na aba **"Consultoria"**

### Status das Cobranças

| Status | Descrição | Cor |
|--------|-----------|-----|
| `pending` | Aguardando pagamento (vencimento futuro) | Amarelo |
| `overdue` | Vencida (vencimento passado) | Vermelho |
| `paid` | Paga | Verde |
| `cancelled` | Cancelada | Cinza |

### Geração de Cobranças

**Quando são geradas**:
1. ✅ Automaticamente ao criar projeto
2. ✅ Automaticamente ao editar data de início
3. ✅ Manualmente ao clicar "Gerar Cobranças do Mês"

**Proteção contra duplicatas**:
- Sistema verifica se já existe cobrança para o mês
- Nunca cria cobranças duplicadas
- Seguro executar múltiplas vezes

### Cálculo do Vencimento

**Dia Especificado**: 5

| Mês | Vencimento |
|-----|------------|
| Janeiro | 05/01/2026 |
| Fevereiro | 05/02/2026 |
| Março | 05/03/2026 |

**Meses com menos dias**:
- Se especificar dia 31 em Fevereiro
- Sistema ajusta automaticamente para o último dia do mês (28 ou 29)

## Queries Úteis

### Ver Todas as Cobranças de um Projeto

```sql
SELECT
  erc.id,
  erc.due_date as vencimento,
  erc.amount as valor,
  erc.status,
  erc.paid_date as data_pagamento,
  erc.notes
FROM engineering_recurring_charges erc
WHERE erc.project_id = 'UUID_DO_PROJETO'
ORDER BY erc.due_date;
```

### Cobranças Vencidas de Todos os Projetos

```sql
SELECT
  ep.name as projeto,
  c.name as cliente,
  erc.due_date as vencimento,
  erc.amount as valor,
  (CURRENT_DATE - erc.due_date) as dias_atraso
FROM engineering_recurring_charges erc
INNER JOIN engineering_projects ep ON erc.project_id = ep.id
INNER JOIN customers c ON ep.customer_id = c.id
WHERE erc.status = 'overdue'
ORDER BY erc.due_date;
```

### Total a Receber por Cliente (Consultoria)

```sql
SELECT
  c.id,
  c.name as cliente,
  COUNT(erc.id) as quantidade_cobrancas,
  SUM(erc.amount) as total_pendente
FROM engineering_projects ep
INNER JOIN customers c ON ep.customer_id = c.id
INNER JOIN engineering_recurring_charges erc ON ep.project_id = erc.project_id
WHERE ep.property_id IS NULL
  AND erc.status IN ('pending', 'overdue')
GROUP BY c.id, c.name
ORDER BY total_pendente DESC;
```

### Gerar Cobranças Manualmente (Função SQL)

```sql
-- Gerar cobranças de um projeto específico
SELECT generate_recurring_charges_for_project('UUID_DO_PROJETO');

-- Gerar cobranças de todos os projetos ativos
SELECT * FROM generate_all_recurring_charges();
```

### Reprocessar Cobranças de Projeto Existente

```sql
-- Se você criar um projeto manualmente no banco e precisar gerar cobranças
SELECT generate_recurring_charges_for_project(
  (SELECT id FROM engineering_projects WHERE name = 'Nome do Projeto')
);
```

## Estrutura de Dados

### Tabela: `engineering_recurring_charges`

```sql
CREATE TABLE engineering_recurring_charges (
  id uuid PRIMARY KEY,
  project_id uuid REFERENCES engineering_projects(id),
  due_date date NOT NULL,              -- Data de vencimento
  amount numeric(10, 2) NOT NULL,      -- Valor da cobrança
  status text NOT NULL,                -- pending, paid, overdue, cancelled
  paid_date date,                      -- Data do pagamento (quando pago)
  payment_id uuid,                     -- Referência ao pagamento
  notes text,                          -- Observações
  created_at timestamptz,
  updated_at timestamptz
);
```

### Function: `generate_recurring_charges_for_project`

**Parâmetros**:
- `p_project_id uuid` - ID do projeto

**Retorno**: `void`

**Funcionalidade**:
1. Busca projeto e template
2. Verifica se tem cobrança recorrente ativa
3. Gera cobranças de `start_date` até `CURRENT_DATE`
4. Define status automático (overdue ou pending)
5. Evita duplicatas

### Function: `generate_all_recurring_charges`

**Parâmetros**: Nenhum

**Retorno**:
```sql
TABLE(
  project_id uuid,
  project_name text,
  charges_created int
)
```

**Funcionalidade**:
- Gera cobranças para todos os projetos ativos
- Retorna quantidade de cobranças criadas por projeto
- Útil para executar mensalmente

## Triggers Automáticos

### `trigger_auto_generate_recurring_charges`

**Quando executa**: Após inserir novo projeto

**O que faz**:
1. Verifica se projeto tem `template_id`
2. Verifica se template tem cobrança recorrente
3. Chama `generate_recurring_charges_for_project`
4. Gera todas as cobranças automaticamente

## Exemplos Práticos

### Exemplo 1: Consultoria Mensal Simples

**Configuração**:
- Cliente: Empresa ABC
- Serviço: Consultoria Ambiental
- Valor: R$ 4.000/mês
- Vencimento: Dia 10
- Início: 01/11/2025

**Hoje**: 17/02/2026

**Cobranças Geradas**:
1. 10/11/2025 - R$ 4.000 - **Vencido**
2. 10/12/2025 - R$ 4.000 - **Vencido**
3. 10/01/2026 - R$ 4.000 - **Vencido**
4. 10/02/2026 - R$ 4.000 - **Vencido**

**Total em atraso**: R$ 16.000,00

### Exemplo 2: Consultoria com Pagamentos Parciais

**Situação**:
- 4 cobranças vencidas
- Cliente pagou 2 cobranças

**Ações**:
1. Marcar cobrança 1 como paga
2. Marcar cobrança 2 como paga
3. Cobranças 3 e 4 continuam vencidas

**Saldo devedor**: R$ 8.000,00

### Exemplo 3: Cancelamento de Cobrança

**Situação**:
- Cliente solicitou cancelamento de uma cobrança específica

**Ação**:
1. Alterar status para `cancelled`
2. Cobrança não aparece mais em pendentes
3. Não afeta outras cobranças

## Integração com Financeiro

### Criação Automática de Entrada Financeira

Quando uma cobrança é marcada como paga:

1. Sistema cria entrada em `engineering_finance_entries`
2. Tipo: `income`
3. Categoria: `receita_servicos`
4. Vincula ao projeto
5. Atualiza `total_received` do projeto

### Atualização de Saldo do Projeto

```sql
-- Saldo devedor atualizado automaticamente
SELECT
  ep.grand_total,
  ep.total_received,
  (ep.grand_total - ep.total_received) as saldo_devedor
FROM engineering_projects ep
WHERE ep.id = 'UUID_DO_PROJETO';
```

## Manutenção e Administração

### Gerar Cobranças do Próximo Mês

Execute todo fim de mês:

```sql
SELECT * FROM generate_all_recurring_charges();
```

**Resultado**: Cria cobranças do próximo mês para todos os projetos ativos

### Verificar Projetos Sem Cobranças

```sql
SELECT
  ep.id,
  ep.name as projeto,
  ep.start_date,
  est.recurring_due_day as dia_vencimento,
  COUNT(erc.id) as quantidade_cobrancas
FROM engineering_projects ep
INNER JOIN engineering_service_templates est ON ep.template_id = est.id
LEFT JOIN engineering_recurring_charges erc ON ep.id = erc.project_id
WHERE est.is_recurring_monthly = true
  AND ep.status NOT IN ('finalizado', 'entregue', 'registrado')
GROUP BY ep.id, ep.name, ep.start_date, est.recurring_due_day
HAVING COUNT(erc.id) = 0;
```

### Reprocessar Cobranças de Projeto

Se um projeto não gerou cobranças corretamente:

```sql
-- Deletar cobranças existentes (se necessário)
DELETE FROM engineering_recurring_charges WHERE project_id = 'UUID_DO_PROJETO';

-- Gerar novamente
SELECT generate_recurring_charges_for_project('UUID_DO_PROJETO');
```

## Perguntas Frequentes

### 1. E se eu mudar a data de início do projeto?

**R**: Execute manualmente a geração de cobranças:
```sql
SELECT generate_recurring_charges_for_project('UUID_DO_PROJETO');
```

### 2. Como cancelar todas as cobranças de um projeto?

**R**:
```sql
UPDATE engineering_recurring_charges
SET status = 'cancelled'
WHERE project_id = 'UUID_DO_PROJETO'
  AND status IN ('pending', 'overdue');
```

### 3. Posso ter projetos com e sem imóvel no mesmo sistema?

**R**: Sim! Projetos COM imóvel aparecem em "Em Andamento", projetos SEM imóvel aparecem em "Consultoria".

### 4. O que acontece se o dia de vencimento cair em um mês que não tem esse dia?

**R**: Sistema ajusta automaticamente para o último dia do mês (ex: dia 31 em Fevereiro = dia 28/29).

### 5. Como sei quantas cobranças foram geradas?

**R**: Execute:
```sql
SELECT COUNT(*)
FROM engineering_recurring_charges
WHERE project_id = 'UUID_DO_PROJETO';
```

### 6. Posso mudar o valor de uma cobrança específica?

**R**: Sim:
```sql
UPDATE engineering_recurring_charges
SET amount = 5000.00
WHERE id = 'UUID_DA_COBRANCA';
```

### 7. Como visualizar a próxima cobrança a vencer?

**R**:
```sql
SELECT *
FROM engineering_recurring_charges
WHERE project_id = 'UUID_DO_PROJETO'
  AND status = 'pending'
  AND due_date >= CURRENT_DATE
ORDER BY due_date
LIMIT 1;
```

## Status da Implementação

✅ **IMPLEMENTADO E FUNCIONANDO**

- ✅ Detecção automática de projetos de consultoria
- ✅ Aba "Consultoria" criada
- ✅ Campo imóvel opcional para consultoria
- ✅ Geração automática de cobranças ao criar projeto
- ✅ Geração desde data de início até hoje
- ✅ Proteção contra duplicatas
- ✅ Status automático (overdue/pending)
- ✅ Integração com financeiro
- ✅ Trigger automático
- ✅ Functions SQL completas

---

**Data de Implementação**: 17 de Fevereiro de 2026
