# Categorização de Receitas e Despesas - Escritório de Engenharia

## Problema Identificado

As receitas e despesas do módulo de Engenharia não estavam sendo categorizadas corretamente:

1. ❌ Pagamentos sendo lançados como uma única receita
2. ❌ Categoria "honorarios" (minúscula) sendo usada
3. ❌ Custos adicionais não aparecendo como despesas
4. ❌ Falta de separação entre Honorários e Reembolsos

## Solução Implementada

### Sistema de Categorização

#### Receitas (Entradas)
1. **Honorários** - Valor dos honorários profissionais do projeto
2. **Antecipação/Reembolso** - Reembolso de custos adicionais pagos pelo escritório

#### Despesas (Saídas)
1. **Custos do Escritório** - Custos adicionais do projeto (taxas, certidões, etc.)

### Como Funciona

Quando um projeto tem:
- **Honorários**: R$ 4.500,00
- **Custos Adicionais**: R$ 439,82
- **Total do Projeto**: R$ 4.939,82

O sistema automaticamente:

#### No Cadastro do Projeto
✅ Cria despesa de R$ 439,82 na categoria "Custos do Escritório"

#### No Recebimento do Pagamento
✅ Cria receita de R$ 4.500,00 na categoria "Honorários"
✅ Cria receita de R$ 439,82 na categoria "Antecipação/Reembolso"

### Exemplo Prático: Projeto Milton Klein

```
📊 Projeto: Geo Milton Klein e outros
├─ Cliente: Milton Klein
├─ Honorários: R$ 4.500,00
├─ Custos Adicionais: R$ 439,82
└─ Total: R$ 4.939,82

💰 Lançamentos Automáticos:

21/01/2026 - DESPESA
└─ R$ 439,82 - Custos do Escritório
   "Custos adicionais - Geo Milton Klein e outros"

16/02/2026 - RECEBIMENTO
├─ R$ 4.500,00 - Honorários
│  "Honorários - Milton Klein - Geo Milton Klein e outros"
└─ R$ 439,82 - Antecipação/Reembolso
   "Reembolso de custos adicionais - Milton Klein - Geo Milton Klein e outros"
```

### Exemplo: Projeto Apenas com Custos

```
📊 Projeto: LAUDO APP NEIDE
├─ Cliente: NEIDE IMMIG SCHROEDER
├─ Honorários: R$ 0,00
├─ Custos Adicionais: R$ 280,00
└─ Total: R$ 280,00

💰 Lançamentos Automáticos:

02/02/2026 - DESPESA
└─ R$ 280,00 - Custos do Escritório
   "Custos adicionais - LAUDO APP NEIDE"

13/02/2026 - RECEBIMENTO
└─ R$ 280,00 - Antecipação/Reembolso
   "Reembolso de custos adicionais - NEIDE IMMIG SCHROEDER - LAUDO APP NEIDE"
```

## Resultado Final

### Totais por Categoria

```
📈 RECEITAS TOTAIS: R$ 29.019,82
├─ Honorários: R$ 27.360,00
└─ Antecipação/Reembolso: R$ 1.659,82

📉 DESPESAS TOTAIS: R$ 2.169,82
└─ Custos do Escritório: R$ 2.169,82

💵 SALDO FINAL: R$ 26.850,00
```

### Lançamentos Corrigidos

✅ **13 receitas de Honorários**
✅ **5 receitas de Reembolso**
✅ **10 despesas de Custos**
✅ **Total: 28 lançamentos categorizados**

## Correções Realizadas

### 1. Atualização de Categorias
- Categoria "honorarios" → "Honorários" (padronizada)
- Lançamentos únicos divididos em duas categorias

### 2. Criação de Lançamentos Faltantes
Pagamentos que tinham custos adicionais mas apenas 1 lançamento foram divididos:
- ✅ Projeto Desmembramento 8ha (R$ 1.800 + R$ 20)
- ✅ Outros projetos com custos adicionais

### 3. Triggers Automáticos

#### Trigger 1: Criar Receitas ao Receber Pagamento
```sql
trigger_auto_create_finance_entry_from_payment
```
- Quando um pagamento é cadastrado
- Divide automaticamente em Honorários + Reembolso
- Considera o valor de cada categoria

#### Trigger 2: Criar Despesa ao Cadastrar Projeto
```sql
trigger_auto_create_expense_on_project
```
- Quando um projeto é criado/atualizado
- Se houver custos adicionais > 0
- Cria despesa na categoria "Custos do Escritório"

## Visualização na Aba Receitas/Despesas

### Cards de Resumo
```
╔════════════════════════╗
║   TOTAL RECEITAS       ║
║   R$ 29.019,82         ║
╠════════════════════════╣
║ Honorários             ║
║ R$ 27.360,00           ║
║                        ║
║ Antecipação/Reembolso  ║
║ R$ 1.659,82            ║
╚════════════════════════╝

╔════════════════════════╗
║   TOTAL DESPESAS       ║
║   R$ 2.169,82          ║
╠════════════════════════╣
║ Custos do Escritório   ║
║ R$ 2.169,82            ║
╚════════════════════════╝

╔════════════════════════╗
║   SALDO                ║
║   R$ 26.850,00         ║
╚════════════════════════╝
```

### Tabela de Lançamentos
Agora exibe a coluna "Categoria" com:
- Honorários
- Antecipação/Reembolso
- Custos do Escritório

## Como Testar

### 1. Ver Lançamentos Existentes
```
Módulo Engenharia → Receitas/Despesas
```
Verificar:
- ✅ Receitas divididas em 2 categorias
- ✅ Despesas de custos adicionais lançadas
- ✅ Totais corretos nos cards

### 2. Cadastrar Novo Projeto com Custos
```sql
-- Projeto com honorários + custos
Honorários: R$ 5.000,00
Custos Adicionais: R$ 150,00
Total: R$ 5.150,00
```
Verificar que foi criada:
- ✅ 1 despesa de R$ 150 (Custos do Escritório)

### 3. Cadastrar Recebimento
```sql
-- Ao receber R$ 5.150,00
```
Verificar que foram criadas:
- ✅ 1 receita de R$ 5.000 (Honorários)
- ✅ 1 receita de R$ 150 (Antecipação/Reembolso)

## Migrações Criadas

### 1. `remove_duplicate_payments_and_receipts.sql`
- Removeu 6 pagamentos duplicados
- Removeu 6 receitas duplicadas
- Adicionou índice único para prevenir duplicatas

### 2. `fix_engineering_finance_categorization_v3.sql`
- Corrigiu categorias incorretas
- Dividiu receitas em Honorários + Reembolso
- Criou triggers automáticos
- Gerou despesas de custos adicionais

## Benefícios

✅ **Clareza Financeira**: Separação clara entre honorários e reembolsos
✅ **Rastreabilidade**: Cada custo tem sua despesa correspondente
✅ **Automatização**: Sistema divide pagamentos automaticamente
✅ **Relatórios Precisos**: Cards mostram breakdown detalhado
✅ **Saldo Real**: Saldo considera despesas (R$ 26.850 ao invés de R$ 29.019)

## Observações Importantes

1. **Projetos Antigos**: Todos os projetos desde 01/01/2026 foram corrigidos
2. **Sincronização**: Despesas são criadas na data de início do projeto
3. **Reembolsos**: Receitas de reembolso são criadas na data do pagamento
4. **Validação**: Reembolsos nunca excedem o valor dos custos adicionais

---

## Build Final

✅ **Build bem-sucedido**
- Módulo Engineering: 212.98 kB
- Sem erros de compilação
- Sistema totalmente funcional
