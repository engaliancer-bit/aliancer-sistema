# Módulo de Receitas/Despesas - Escritório de Engenharia

## Visão Geral

O módulo de Receitas/Despesas permite o controle financeiro completo do escritório de engenharia, incluindo:
- Registro automático de receitas a partir de recebimentos de clientes
- Lançamentos manuais de receitas e despesas
- Sistema de antecipações (custos pagos pelo escritório para o cliente)
- Classificação detalhada de receitas e despesas
- Relatórios financeiros segregados por categoria

## Funcionalidades Principais

### 1. Receitas Automáticas
Todos os recebimentos cadastrados na aba "Pagamentos" são automaticamente registrados como receita na aba "Receitas/Despesas".

**Fluxo:**
```
Recebimento do cliente → Automático → Receita no sistema
```

### 2. Sistema de Antecipações

#### O que são Antecipações?
Antecipações são custos que o escritório paga antecipadamente em nome do cliente, que devem ser reembolsados posteriormente.

**Exemplo prático (Milton Klein):**
- Honorários do projeto: R$ 4.500,00
- Antecipação (taxas + marcos de concreto): R$ 439,82
- **Total devido pelo cliente: R$ 4.939,82**

#### Como funciona:

**Ao cadastrar uma antecipação:**
1. Sistema registra como DESPESA do escritório
2. Adiciona o valor ao `grand_total` do projeto
3. Aumenta o saldo devedor do cliente (`balance`)
4. Cria vínculo entre a antecipação e o projeto

**Ao receber pagamento do cliente:**
1. Sistema registra como RECEITA
2. Marca antecipações como "reembolsadas"
3. Classifica a receita como "Antecipação/Reembolso"
4. Permite segregar honorários de reembolsos

### 3. Classificação de Receitas

As receitas são classificadas em 3 categorias:

| Categoria | Descrição | Quando usar |
|-----------|-----------|-------------|
| **Honorários** | Receitas de serviços prestados | Pagamento pelos serviços técnicos |
| **Antecipação/Reembolso** | Receitas de reembolso de custos | Quando cliente paga antecipação feita pelo escritório |
| **Outras Receitas** | Outras entradas de recursos | Outras fontes de receita |

### 4. Classificação de Despesas

As despesas são classificadas em 3 categorias:

| Categoria | Descrição | Quando usar |
|-----------|-----------|-------------|
| **Antecipação para Cliente** | Custos pagos pelo escritório em nome do cliente | Taxas, materiais, serviços pagos antecipadamente |
| **Despesa Operacional** | Custos de funcionamento do escritório | Aluguel, energia, internet, materiais de escritório |
| **Outras Despesas** | Outras saídas de recursos | Outras despesas não categorizadas |

## Estrutura do Banco de Dados

### Tabela: `engineering_finance_entries`
Armazena todos os lançamentos financeiros do escritório.

**Campos principais:**
- `entry_type`: 'receita' ou 'despesa'
- `category`: Categoria do lançamento
- `amount`: Valor
- `description`: Descrição
- `project_id`: Vínculo com projeto (opcional)
- `customer_id`: Vínculo com cliente (opcional)
- `payment_id`: Vínculo com recebimento (quando automático)
- `advance_id`: Vínculo com antecipação
- `entry_date`: Data do lançamento
- `status`: 'pendente', 'efetivado' ou 'cancelado'

### Tabela: `engineering_project_advances`
Armazena antecipações feitas pelo escritório para clientes.

**Campos principais:**
- `project_id`: Projeto relacionado
- `customer_id`: Cliente relacionado
- `description`: Descrição da antecipação
- `amount`: Valor
- `advance_type`: Tipo (taxa, material, serviço_terceiro, deslocamento, outros)
- `advance_date`: Data da antecipação
- `reimbursed`: Se foi reembolsada
- `reimbursed_date`: Data do reembolso
- `finance_entry_id`: Vínculo com lançamento financeiro

## Fluxos de Trabalho

### Fluxo 1: Recebimento Normal (Honorários)

```
1. Cadastrar pagamento na aba "Pagamentos"
   └─ Projeto: CAR João Silva
   └─ Valor: R$ 2.000,00

2. Sistema AUTOMATICAMENTE:
   └─ Cria receita em "Receitas/Despesas"
   └─ Categoria: "Honorários"
   └─ Status: "Efetivado"
   └─ Vincula ao projeto e cliente
```

### Fluxo 2: Antecipação para Cliente

```
1. Clicar em "Antecipação" na aba "Receitas/Despesas"
2. Preencher formulário:
   └─ Projeto: Georreferenciamento Maria
   └─ Tipo: Taxa
   └─ Descrição: "Taxa de registro em cartório"
   └─ Valor: R$ 500,00

3. Sistema AUTOMATICAMENTE:
   └─ Registra DESPESA de R$ 500,00
   └─ Adiciona R$ 500,00 ao grand_total do projeto
   └─ Aumenta saldo devedor do cliente em R$ 500,00
   └─ Cria vínculo entre despesa e antecipação

4. Quando cliente pagar:
   └─ Receita é classificada como "Antecipação/Reembolso"
   └─ Antecipação marcada como "reembolsada"
```

### Fluxo 3: Despesa Operacional

```
1. Clicar em "Nova Despesa" na aba "Receitas/Despesas"
2. Preencher formulário:
   └─ Categoria: Despesa Operacional
   └─ Descrição: "Aluguel do escritório - Janeiro/2026"
   └─ Valor: R$ 1.500,00
   └─ Projeto: (deixar vazio)

3. Sistema registra:
   └─ DESPESA de R$ 1.500,00
   └─ Sem vínculo com projeto
   └─ Para controle interno do escritório
```

### Fluxo 4: Receita Manual (Outras Receitas)

```
1. Clicar em "Nova Receita" na aba "Receitas/Despesas"
2. Preencher formulário:
   └─ Categoria: Outras Receitas
   └─ Descrição: "Consultoria avulsa"
   └─ Valor: R$ 800,00
   └─ Projeto: (deixar vazio)

3. Sistema registra:
   └─ RECEITA de R$ 800,00
   └─ Sem vínculo com projeto
   └─ Para controle interno do escritório
```

## Exemplo Completo (Milton Klein)

### Situação:
- Projeto: Georreferenciamento Rural
- Honorários acordados: R$ 4.500,00
- Antecipação feita: R$ 439,82 (taxas + marcos de concreto)
- **Total devido: R$ 4.939,82**

### Passo a Passo:

#### 1. Criar o projeto
```
Nome: Georreferenciamento Rural
Cliente: Milton Klein
Valor (grand_total): R$ 4.500,00
```

#### 2. Registrar a antecipação
```
Na aba "Receitas/Despesas":
→ Clicar em "Antecipação"
→ Projeto: Georreferenciamento Rural
→ Tipo: Material
→ Descrição: "Taxas e marcos de concreto"
→ Valor: R$ 439,82
```

**Resultado automático:**
- DESPESA de R$ 439,82 registrada
- `grand_total` do projeto atualizado para R$ 4.939,82
- `balance` do cliente atualizado para R$ 4.939,82

#### 3. Cliente faz pagamento parcial (honorários)
```
Na aba "Pagamentos":
→ Projeto: Georreferenciamento Rural
→ Valor: R$ 4.500,00
→ Descrição: "Pagamento de honorários"
```

**Resultado automático:**
- RECEITA de R$ 4.500,00 registrada
- Categoria: "Honorários"
- `total_received` = R$ 4.500,00
- `balance` = R$ 439,82 (ainda falta o reembolso)

#### 4. Cliente paga a antecipação
```
Na aba "Pagamentos":
→ Projeto: Georreferenciamento Rural
→ Valor: R$ 439,82
→ Descrição: "Reembolso de antecipação"
```

**Resultado automático:**
- RECEITA de R$ 439,82 registrada
- Categoria: "Antecipação/Reembolso"
- Antecipação marcada como "reembolsada"
- `total_received` = R$ 4.939,82
- `balance` = R$ 0,00 (projeto quitado)

## Relatórios Disponíveis

### Dashboard de Saldo

Exibe 3 cards principais:

**1. Total Receitas**
- Valor total de receitas efetivadas
- Detalhamento:
  - Honorários
  - Reembolsos
  - Outras receitas

**2. Total Despesas**
- Valor total de despesas efetivadas
- Detalhamento:
  - Antecipações
  - Operacionais
  - Outras despesas

**3. Saldo**
- Saldo = Receitas - Despesas
- Verde se positivo
- Laranja se negativo

### Filtros Disponíveis

1. **Por Tipo**: Todas | Receitas | Despesas
2. **Por Categoria**: Todas | Honorários | Antecipações | etc.
3. **Por Período**: Data início e data fim
4. **Por Descrição**: Busca textual

### Listagem Detalhada

Tabela com todas as movimentações mostrando:
- Data
- Tipo (Receita/Despesa)
- Categoria
- Descrição
- Valor
- Status
- Ações (excluir lançamentos manuais)

**Observação:** Lançamentos automáticos (vindos de recebimentos) não podem ser excluídos diretamente.

## Integrações Automáticas

### 1. Trigger: Criar receita ao receber pagamento
```sql
Quando: INSERT em engineering_project_payments
Ação: Cria receita em engineering_finance_entries
Categoria: honorarios (padrão)
```

### 2. Trigger: Adicionar antecipação ao projeto
```sql
Quando: INSERT em engineering_project_advances
Ação:
  - Cria despesa em engineering_finance_entries
  - Atualiza grand_total do projeto
  - Atualiza balance do projeto
```

### 3. Trigger: Marcar antecipação como reembolsada
```sql
Quando: Recebimento vinculado a projeto com antecipações
Ação:
  - Marca antecipações como reimbursed = true
  - Atualiza categoria da receita para 'antecipacao_reembolso'
```

## Benefícios do Sistema

### Para Controle Financeiro
- ✅ Visão completa de receitas e despesas
- ✅ Segregação entre honorários e reembolsos
- ✅ Controle de antecipações pendentes de reembolso
- ✅ Relatórios financeiros detalhados

### Para Gestão de Projetos
- ✅ Valores de projetos atualizados automaticamente
- ✅ Saldo correto incluindo antecipações
- ✅ Rastreamento de reembolsos pendentes
- ✅ Integração total com módulo de projetos

### Para Contabilidade
- ✅ Classificação contábil das receitas
- ✅ Separação de receitas próprias vs reembolsos
- ✅ Despesas categorizadas
- ✅ Exportação de relatórios por período

### Para Cobrança
- ✅ Identificação clara de valores a receber
- ✅ Separação entre honorários e reembolsos
- ✅ Histórico completo de movimentações
- ✅ Alertas de antecipações não reembolsadas

## Tipos de Antecipação

### Taxa
Taxas pagas em cartórios, órgãos públicos, etc.

**Exemplo:** Taxa de registro de CAR, taxa de averbação

### Material
Materiais adquiridos para o cliente

**Exemplo:** Marcos de concreto, GPS para locação

### Serviço de Terceiro
Serviços contratados em nome do cliente

**Exemplo:** Topógrafo externo, laboratório de análise

### Deslocamento
Custos de deslocamento para o projeto

**Exemplo:** Combustível, hospedagem, alimentação

### Outros
Outras antecipações não categorizadas acima

## Métodos de Pagamento

Opções disponíveis:
- Dinheiro
- PIX
- Transferência bancária
- Cheque
- Cartão de crédito/débito
- Boleto bancário

## Status dos Lançamentos

### Efetivado
Lançamento confirmado e contabilizado

### Pendente
Lançamento futuro ou a confirmar

### Cancelado
Lançamento cancelado (não entra nos cálculos)

## Observações Importantes

1. **Lançamentos Automáticos**
   - Criados a partir de recebimentos
   - Não podem ser excluídos diretamente
   - Vinculados ao payment_id

2. **Lançamentos Manuais**
   - Criados manualmente pelo usuário
   - Podem ser excluídos
   - Não têm payment_id

3. **Antecipações**
   - Sempre criam despesa automática
   - Sempre atualizam grand_total do projeto
   - Marcadas como reembolsadas ao receber pagamento

4. **Integridade de Dados**
   - Sistema mantém sincronização automática
   - Não é necessário ajuste manual
   - Triggers garantem consistência

## Queries Úteis

### Saldo financeiro do escritório
```sql
SELECT * FROM get_engineering_finance_balance(
  p_start_date := '2026-01-01',
  p_end_date := '2026-12-31'
);
```

### Antecipações pendentes de reembolso
```sql
SELECT
  pa.*,
  p.name as project_name,
  c.name as customer_name
FROM engineering_project_advances pa
JOIN engineering_projects p ON p.id = pa.project_id
JOIN customers c ON c.id = pa.customer_id
WHERE pa.reimbursed = false
ORDER BY pa.advance_date;
```

### Receitas por categoria no mês
```sql
SELECT
  category,
  COUNT(*) as total_entries,
  SUM(amount) as total_amount
FROM engineering_finance_entries
WHERE entry_type = 'receita'
  AND status = 'efetivado'
  AND entry_date >= '2026-01-01'
  AND entry_date < '2026-02-01'
GROUP BY category;
```

### Despesas operacionais do mês
```sql
SELECT
  description,
  amount,
  entry_date
FROM engineering_finance_entries
WHERE entry_type = 'despesa'
  AND category = 'operacional'
  AND status = 'efetivado'
  AND entry_date >= '2026-01-01'
  AND entry_date < '2026-02-01'
ORDER BY entry_date DESC;
```

## Como Usar

### 1. Acessar a Aba
```
Módulo de Engenharia → Aba "Receitas/Despesas"
```

### 2. Visualizar Saldo
- Cards superiores mostram resumo financeiro
- Valores atualizados em tempo real
- Detalhamento por categoria

### 3. Cadastrar Receita Manual
```
1. Clicar em "Nova Receita"
2. Selecionar categoria
3. Preencher valor e descrição
4. Vincular projeto (opcional)
5. Salvar
```

### 4. Cadastrar Despesa Manual
```
1. Clicar em "Nova Despesa"
2. Selecionar categoria
3. Preencher valor e descrição
4. Vincular projeto (opcional)
5. Salvar
```

### 5. Cadastrar Antecipação
```
1. Clicar em "Antecipação"
2. Selecionar projeto (OBRIGATÓRIO)
3. Selecionar cliente (OBRIGATÓRIO)
4. Escolher tipo de antecipação
5. Preencher descrição e valor
6. Salvar

Sistema adiciona automaticamente ao saldo do cliente!
```

### 6. Filtrar Lançamentos
```
1. Usar filtros no topo da listagem
2. Filtrar por tipo, categoria, período
3. Buscar por descrição
4. Resultados atualizados em tempo real
```

### 7. Excluir Lançamento Manual
```
1. Localizar lançamento na listagem
2. Clicar no ícone de excluir (X vermelho)
3. Confirmar exclusão

Obs: Apenas lançamentos manuais podem ser excluídos
```

## Validação Final

- ✅ Banco de dados estruturado
- ✅ Triggers de integração criados
- ✅ Componente React desenvolvido
- ✅ Integração com módulo de projetos
- ✅ Sistema de antecipações implementado
- ✅ Classificação de receitas e despesas
- ✅ Relatórios financeiros funcionais
- ✅ Documentação completa

## Conclusão

O módulo de Receitas/Despesas oferece controle financeiro completo para o escritório de engenharia, com integração automática com os recebimentos de clientes e sistema inteligente de antecipações que mantém os saldos sempre corretos e permite identificar claramente honorários de reembolsos.
