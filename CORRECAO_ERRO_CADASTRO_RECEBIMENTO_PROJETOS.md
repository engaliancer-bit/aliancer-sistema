# Correção: Erro ao Cadastrar Recebimento de Projetos

## Data
12 de fevereiro de 2026 - 12:22

## Erro Reportado

```
Erro ao adicionar recebimento: new row for relation "cash_flow"
violates check constraint "cash_flow_type_check"
```

---

## 🔍 Análise do Problema

### Causa Raiz

A tabela `cash_flow` possui um constraint que valida o campo `type`:

```sql
CHECK ((type = ANY (ARRAY['income'::text, 'expense'::text])))
```

**Valores permitidos**: `'income'` ou `'expense'`

Porém, a função `integrate_payment_to_cash_flow()` estava inserindo registros com `type = 'entrada'`, que **não é permitido** pelo constraint.

### Onde Ocorria o Erro

**Arquivo**: `20260203204349_add_update_trigger_engineering_payments.sql`

**Linhas problemáticas**:
```sql
INSERT INTO cash_flow (
  ...
  type,
  ...
) VALUES (
  ...
  'entrada',  -- ❌ ERRO: deveria ser 'income'
  ...
);
```

Isso ocorria em **3 locais** da função:
1. **INSERT** de novo pagamento (linha 90)
2. **UPDATE** quando não encontra registro antigo (linha 143)
3. **DELETE** ao buscar registro para remover (linha 161)

---

## ✅ Solução Implementada

### Migration: `20260212122000_fix_engineering_payment_trigger_type_income.sql`

#### 1. Atualização de Registros Antigos

```sql
-- Corrigir registros existentes que possam ter 'entrada'
UPDATE cash_flow
SET type = 'income'
WHERE type = 'entrada'
  AND business_unit = 'engineering'
  AND category = 'Serviços de Engenharia';
```

#### 2. Correção da Função

Substituí **todas as 3 ocorrências** de `'entrada'` por `'income'`:

**INSERT (criação de novo recebimento)**:
```sql
INSERT INTO cash_flow (
  date,
  type,
  category,
  description,
  amount,
  conta_caixa_id,
  notes,
  business_unit
) VALUES (
  NEW.payment_date,
  'income',  -- ✅ CORRIGIDO
  'Serviços de Engenharia',
  ...
);
```

**UPDATE (busca e atualização de registro existente)**:
```sql
SELECT id INTO v_cash_flow_id
FROM cash_flow
WHERE date = OLD.payment_date
  AND type = 'income'  -- ✅ CORRIGIDO
  AND category = 'Serviços de Engenharia'
  ...
```

**UPDATE (criação quando não encontra registro)**:
```sql
INSERT INTO cash_flow (
  ...
  type,
  ...
) VALUES (
  ...
  'income',  -- ✅ CORRIGIDO
  ...
);
```

**DELETE (busca para remover registro)**:
```sql
DELETE FROM cash_flow
WHERE date = OLD.payment_date
  AND type = 'income'  -- ✅ CORRIGIDO
  AND category = 'Serviços de Engenharia'
  ...
```

---

## 🎯 Como Funciona Agora

### Fluxo Completo de Recebimento

```
1. Usuário acessa projeto de engenharia
   ↓
2. Clica em "Adicionar Recebimento"
   ↓
3. Preenche formulário:
   - Data do recebimento
   - Valor (R$)
   - Forma de pagamento
   - Conta/Caixa (opcional)
   - Observações (opcional)
   ↓
4. Sistema salva em "engineering_project_payments"
   ↓
5. TRIGGER "integrate_payment_cash_flow" é acionado
   ↓
6. Função "integrate_payment_to_cash_flow()" executa:

   INSERT INTO cash_flow (
     date: data do recebimento
     type: 'income'  ✅ CORRETO AGORA
     category: 'Serviços de Engenharia'
     description: 'Recebimento - Projeto: [nome] - Cliente: [nome]'
     amount: valor recebido
     conta_caixa_id: conta selecionada (se informada)
     notes: 'Pagamento de projeto de engenharia'
     business_unit: 'engineering'
   )
   ↓
7. Registro criado com SUCESSO ✅
   ↓
8. Sistema atualiza automaticamente:
   - total_received do projeto
   - balance do projeto
   - fluxo de caixa consolidado
```

---

## 📊 Validação da Correção

### Teste Manual

**Passos para testar**:

1. Acessar "Escritório de Engenharia" → "Projetos"
2. Selecionar qualquer projeto com saldo a receber
3. Clicar no botão 💵 (Ver Financeiro)
4. Clicar em "Adicionar Recebimento"
5. Preencher:
   - Data: hoje
   - Valor: R$ 100,00
   - Forma: Dinheiro
6. Clicar em "Adicionar"

**Resultado esperado**:
- ✅ Recebimento registrado com sucesso
- ✅ NENHUM erro de constraint
- ✅ Valor aparece na lista de recebimentos
- ✅ Total recebido atualizado
- ✅ Saldo devedor recalculado
- ✅ Registro criado no cash_flow com type='income'

### Teste SQL

```sql
-- Ver último recebimento de projeto registrado
SELECT
  date,
  type,
  category,
  description,
  amount,
  business_unit,
  created_at
FROM cash_flow
WHERE business_unit = 'engineering'
  AND category = 'Serviços de Engenharia'
ORDER BY created_at DESC
LIMIT 1;

-- Resultado esperado:
-- type = 'income' ✅
-- category = 'Serviços de Engenharia' ✅
-- business_unit = 'engineering' ✅
```

---

## 🔒 Constraint do Cash Flow

### Definição

```sql
ALTER TABLE cash_flow
ADD CONSTRAINT cash_flow_type_check
CHECK (type = ANY (ARRAY['income'::text, 'expense'::text]));
```

### Significado

| Valor | Português | Uso |
|-------|-----------|-----|
| `'income'` | Receita/Entrada | Recebimentos, vendas, pagamentos recebidos |
| `'expense'` | Despesa/Saída | Pagamentos, compras, custos |

**Qualquer outro valor é REJEITADO** pelo banco de dados.

---

## 🎨 Campos Obrigatórios do Cash Flow

Quando a trigger insere no `cash_flow`, ela preenche:

| Campo | Valor | Exemplo |
|-------|-------|---------|
| `date` | Data do recebimento | `2026-02-12` |
| `type` | **'income'** ✅ | `income` |
| `category` | Categoria fixa | `Serviços de Engenharia` |
| `description` | Descrição automática | `Recebimento - Projeto: CAR João - Cliente: João Silva` |
| `amount` | Valor recebido | `500.00` |
| `conta_caixa_id` | Conta selecionada (NULL se não informado) | `uuid` ou `NULL` |
| `notes` | Observações | `Pagamento de projeto de engenharia - Primeira parcela` |
| `business_unit` | Unidade de negócio fixa | `engineering` |

---

## 📈 Impacto no Sistema

### Antes da Correção

| Situação | Resultado |
|----------|-----------|
| Adicionar recebimento | ❌ ERRO de constraint |
| Cash flow atualizado | ❌ NÃO |
| Total recebido atualizado | ❌ NÃO |
| Saldo devedor atualizado | ❌ NÃO |
| Experiência do usuário | 😡 Frustrante |

### Depois da Correção

| Situação | Resultado |
|----------|-----------|
| Adicionar recebimento | ✅ SUCESSO |
| Cash flow atualizado | ✅ SIM |
| Total recebido atualizado | ✅ SIM |
| Saldo devedor atualizado | ✅ SIM |
| Experiência do usuário | 😊 Fluida |

---

## 🔄 Operações Suportadas

A função `integrate_payment_to_cash_flow()` suporta 3 operações:

### 1. INSERT (Novo Recebimento)

```sql
-- Usuário adiciona recebimento
INSERT INTO engineering_project_payments (...)
VALUES (...);

-- Trigger automaticamente cria:
INSERT INTO cash_flow (type, ...) VALUES ('income', ...);
```

### 2. UPDATE (Edição de Recebimento)

```sql
-- Usuário edita valor ou data
UPDATE engineering_project_payments
SET value = 600, payment_date = '2026-02-15'
WHERE id = 'uuid';

-- Trigger automaticamente atualiza o cash_flow correspondente:
UPDATE cash_flow
SET amount = 600, date = '2026-02-15'
WHERE id = 'cash_flow_uuid';
```

### 3. DELETE (Remoção de Recebimento)

```sql
-- Usuário remove recebimento
DELETE FROM engineering_project_payments
WHERE id = 'uuid';

-- Trigger automaticamente remove do cash_flow:
DELETE FROM cash_flow
WHERE type = 'income'
  AND date = OLD.payment_date
  AND amount = OLD.value
  ...
```

---

## 🎯 Benefícios da Correção

### Para o Usuário

| Benefício | Descrição |
|-----------|-----------|
| **Funcionamento** | Sistema funciona conforme esperado |
| **Sem erros** | Nenhuma mensagem de erro ao cadastrar |
| **Rapidez** | Registro instantâneo de recebimentos |
| **Confiança** | Dados salvos corretamente |

### Para o Sistema

| Benefício | Descrição |
|-----------|-----------|
| **Integridade** | Dados consistentes entre tabelas |
| **Automação** | Cash flow atualizado automaticamente |
| **Auditoria** | Histórico completo de recebimentos |
| **Relatórios** | Fluxo de caixa preciso |

### Para o Negócio

| Benefício | Descrição |
|-----------|-----------|
| **Controle Financeiro** | Visão real do fluxo de caixa |
| **Gestão de Cobranças** | Acompanhamento de recebimentos |
| **Tomada de Decisão** | Dados confiáveis para análise |
| **Produtividade** | Menos tempo corrigindo erros |

---

## 🧪 Casos de Teste

### Caso 1: Recebimento à Vista

**Dados**:
- Projeto: CAR João Silva
- Valor total: R$ 500,00
- Recebimento: R$ 500,00 (à vista)
- Data: 12/02/2026
- Forma: Dinheiro

**Resultado esperado**:
- ✅ Recebimento registrado
- ✅ Cash flow: type='income', amount=500
- ✅ total_received = 500
- ✅ balance = 0

---

### Caso 2: Recebimento Parcial

**Dados**:
- Projeto: PRAD Fazenda Boa Vista
- Valor total: R$ 1.500,00
- Recebimento: R$ 500,00 (1ª parcela)
- Data: 12/02/2026
- Forma: PIX

**Resultado esperado**:
- ✅ Recebimento registrado
- ✅ Cash flow: type='income', amount=500
- ✅ total_received = 500
- ✅ balance = 1000

---

### Caso 3: Múltiplos Recebimentos

**Dados**:
- Projeto: Avaliação Imóvel
- Valor total: R$ 800,00
- Recebimento 1: R$ 400,00 (entrada)
- Recebimento 2: R$ 400,00 (final)

**Resultado esperado**:
- ✅ Ambos os recebimentos registrados
- ✅ Cash flow: 2 registros com type='income'
- ✅ total_received = 800
- ✅ balance = 0
- ✅ Projeto aparece na aba "Registrados"

---

## 🔍 Diagnóstico Rápido

### Se o erro voltar a acontecer

**Verificar tipo sendo usado**:
```sql
-- Ver o código da função atual
SELECT prosrc
FROM pg_proc
WHERE proname = 'integrate_payment_to_cash_flow';

-- Buscar por 'entrada' (deve retornar 0 resultados)
-- Se encontrar, precisa corrigir novamente
```

**Verificar registros com tipo errado**:
```sql
-- Buscar registros com type inválido
SELECT id, date, type, category, amount
FROM cash_flow
WHERE type NOT IN ('income', 'expense')
  AND business_unit = 'engineering';

-- Deve retornar 0 linhas
```

**Corrigir manualmente se necessário**:
```sql
-- Se encontrar registros com 'entrada'
UPDATE cash_flow
SET type = 'income'
WHERE type = 'entrada';

-- Se encontrar registros com 'saida' ou 'despesa'
UPDATE cash_flow
SET type = 'expense'
WHERE type IN ('saida', 'despesa');
```

---

## 📝 Notas Técnicas

### Por que 'income' e 'expense'?

Esses são termos **universais em inglês** usados em sistemas contábeis:
- **Income** = receita, entrada, recebimento
- **Expense** = despesa, saída, pagamento

Padronizar em inglês facilita:
- Integração com outros sistemas
- Leitura de código por desenvolvedores internacionais
- Conformidade com padrões contábeis

### Alternativa em Português

Se fosse necessário usar português, os valores seriam:
- `'receita'` ao invés de `'income'`
- `'despesa'` ao invés de `'expense'`

Mas isso exigiria alterar o constraint:
```sql
ALTER TABLE cash_flow DROP CONSTRAINT cash_flow_type_check;
ALTER TABLE cash_flow
ADD CONSTRAINT cash_flow_type_check
CHECK (type = ANY (ARRAY['receita'::text, 'despesa'::text]));
```

**Não recomendado**, pois quebraria toda a integração existente.

---

## ✅ Status Final

- ✅ Migration criada e aplicada
- ✅ Função `integrate_payment_to_cash_flow()` corrigida
- ✅ Todas as 3 ocorrências de 'entrada' substituídas por 'income'
- ✅ Registros antigos atualizados
- ✅ Build testado e aprovado
- ✅ Sistema funcionando corretamente

**Problema resolvido! Recebimentos de projetos podem ser cadastrados sem erros.** 🎉

---

## 📁 Arquivos Modificados

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| `20260212122000_fix_engineering_payment_trigger_type_income.sql` | Migration | Corrige função para usar 'income' |

---

**Relacionado a**:
- `MODULO_PAGAMENTOS_PROJETOS_ENGENHARIA.md` (sistema financeiro)
- `IMPLEMENTACAO_ABA_A_COBRAR_PROJETOS.md` (aba à cobrar)
- `GUIA_PROJETOS_ENGENHARIA.md` (guia de uso)
