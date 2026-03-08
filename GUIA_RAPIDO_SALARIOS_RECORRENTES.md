# Guia Rápido: Pagamento Recorrente de Salários CLT

## Como Configurar Salários Recorrentes

### Passo 1: Cadastrar Colaborador CLT

1. Acesse **Escritório de Engenharia** → **Colaboradores**
2. Clique em **"+ Novo Colaborador"**
3. Preencha os dados:
   - Nome: Ex: "João Silva"
   - Cargo: Ex: "Engenheiro Civil"
   - Salário Base: Ex: R$ 8.000,00
   - Benefícios: Ex: R$ 500,00
   - **Regime: CLT**
   - Data de Admissão
   - **Dia de Pagamento do Salário: 5** (ou dia desejado)
   - ☑ **Incluir automaticamente nas sugestões mensais**
4. Clique em **"Cadastrar"**

### Passo 2: O Sistema Trabalha Automaticamente

- Sistema gera sugestões de pagamento todo mês
- Não precisa fazer nada manual
- Basta acessar "Receitas/Despesas" quando chegar o período

### Passo 3: Confirmar Salários do Mês

1. Acesse **Escritório de Engenharia** → **Receitas/Despesas**
2. Sistema mostra alerta: **"Há 3 pagamento(s) pendente(s). Deseja revisar?"**
3. Clique em **"Sim"**
4. Modal abre com lista de colaboradores:

```
┌────────────────────────────────────────────────┐
│ Pagamento de Salários - Fevereiro/2026        │
├────────────────────────────────────────────────┤
│ ☑ João Silva                                   │
│   Engenheiro Civil                             │
│   Salário: R$ 8.000,00                         │
│   Benefícios: [R$ 500,00] ← Editável          │
│   Total: R$ 8.500,00                           │
├────────────────────────────────────────────────┤
```

5. **Edite os benefícios** se necessário (campo editável)
6. **Selecione** os colaboradores para pagar
7. Clique em **"Confirmar Pagamentos"**
8. Pronto! Lançamentos criados automaticamente

---

## Funcionalidades Principais

### 1. Filtro Automático do Mês Atual

Ao abrir "Receitas/Despesas":
- **Automaticamente** mostra apenas movimentações do mês atual
- Exemplo: Em fevereiro/2026, mostra 01/02 até 29/02
- Para ver outros meses: Altere as datas e clique em "Atualizar"

### 2. Categorias Customizáveis

**Acessar**: Receitas/Despesas → **Botão "Categorias"**

**Criar Nova Categoria**:
1. Clique em "Nova Categoria"
2. Digite nome (ex: "Aluguel")
3. Descrição opcional
4. Escolha uma cor
5. Clique em "Criar Categoria"

**Usar Categoria**:
- Ao criar despesa, selecione a categoria criada
- Facilita organização e relatórios

**Categorias Padrão** (não podem ser excluídas):
- Salários e Encargos
- Antecipações a Clientes
- Despesas Operacionais
- Outras Despesas

### 3. Notificação de Salários Pendentes

**Automático**:
- Ao abrir "Receitas/Despesas"
- Se houver salários pendentes do mês
- Mostra alerta perguntando se deseja revisar

**Manual**:
- Botão **"Salários"** aparece no topo
- Badge vermelho mostra quantidade pendente
- Clique para abrir modal

### 4. Edição de Benefícios na Confirmação

**Por que é útil?**
- Salário base é fixo (vem do cadastro)
- Benefícios podem variar mensalmente
- Exemplo: Mês teve hora extra, adiciona no benefício

**Como usar**:
1. No modal, localize o campo "Benefícios"
2. Edite o valor conforme necessário
3. Total é recalculado automaticamente
4. Confirme o pagamento

### 5. Confirmação em Lote

**Confirmar Vários de Uma Vez**:
1. Marque checkbox de múltiplos colaboradores
2. Ou clique em "Selecionar Todos"
3. Clique em "Confirmar Selecionados"
4. Sistema processa todos juntos

**Pular Pagamentos**:
- Use botão "Pular Selecionados"
- Não cria lançamento financeiro
- Útil se colaborador estiver de férias

---

## Perguntas Frequentes

### P: Como sei que há salários pendentes?
**R**: O sistema avisa automaticamente ao abrir "Receitas/Despesas". Além disso, aparece um botão "Salários" com badge vermelho mostrando a quantidade.

### P: Posso editar o salário base no modal?
**R**: Não. O salário base vem do cadastro do colaborador e não pode ser editado no modal. Apenas os benefícios são editáveis.

### P: E se eu não quiser pagar um colaborador este mês?
**R**: Selecione o colaborador e clique em "Pular Selecionados". O pagamento não será criado.

### P: Posso confirmar salários de meses anteriores?
**R**: O modal mostra apenas salários do mês atual. Para meses anteriores, crie lançamentos manualmente em "Lançamentos".

### P: Como criar minhas próprias categorias de despesas?
**R**: Vá em "Receitas/Despesas" → "Categorias" → "Nova Categoria". Preencha nome, descrição e escolha uma cor.

### P: Posso excluir categorias?
**R**: Sim, mas apenas categorias customizadas (que você criou). Categorias do sistema não podem ser excluídas. Se houver lançamentos vinculados, não será possível excluir.

### P: Como mudar o dia de pagamento de um colaborador?
**R**: Edite o colaborador na aba "Colaboradores" e altere o campo "Dia de Pagamento do Salário".

### P: O que acontece se o dia de pagamento for 31 em fevereiro?
**R**: O sistema usa o último dia do mês automaticamente (28 ou 29 em fevereiro).

### P: Como desativar a recorrência de um colaborador?
**R**: Edite o colaborador e desmarque "Incluir automaticamente nas sugestões mensais". Ele não aparecerá mais nas sugestões.

### P: Os salários confirmados aparecem nos relatórios?
**R**: Sim! Aparecem como despesas normais na categoria "Salários e Encargos" e contam em todos os relatórios.

---

## Dicas de Uso

### Configuração Inicial (Fazer Uma Vez)

1. Cadastre todos os colaboradores CLT
2. Configure o dia de pagamento de cada um
3. Marque "Incluir automaticamente"
4. Pronto! Sistema funciona sozinho

### Rotina Mensal (Todo Mês)

1. Acesse "Receitas/Despesas" no início do mês
2. Sistema avisa sobre salários pendentes
3. Revise e confirme os pagamentos
4. Edite benefícios se necessário
5. Pronto! Despesas lançadas automaticamente

### Organização de Despesas

1. Crie categorias para suas despesas recorrentes:
   - Aluguel
   - Energia
   - Telefonia
   - Material de Escritório
   - etc.
2. Ao criar despesas, selecione a categoria correta
3. Relatórios ficam mais organizados e informativos

---

## Exemplo Prático Completo

### Cenário: Escritório com 3 Colaboradores CLT

**Colaboradores**:
1. João Silva - Engenheiro - R$ 8.000 + R$ 500 - Paga dia 5
2. Maria Santos - Arquiteta - R$ 7.000 + R$ 450 - Paga dia 5
3. Pedro Costa - Topógrafo - R$ 4.500 + R$ 300 - Paga dia 10

**Dia 1 de Fevereiro**:
- Sistema gera automaticamente 3 agendamentos
- Status: pending
- Aguardando confirmação do usuário

**Dia 5 de Fevereiro** (Usuário acessa Receitas/Despesas):
- Alerta: "Há 2 pagamento(s) pendente(s)"
- Usuário abre modal
- Vê João Silva e Maria Santos (ambos dia 5)
- Edita benefícios de Maria para R$ 500 (tinha hora extra)
- Confirma ambos
- Total: R$ 15.950

**Dia 10 de Fevereiro** (Usuário acessa novamente):
- Alerta: "Há 1 pagamento(s) pendente(s)"
- Usuário abre modal
- Vê Pedro Costa
- Confirma pagamento
- Total: R$ 4.800

**Resultado Final**:
- 3 lançamentos financeiros criados
- Total de despesas com salários: R$ 20.750
- Todos marcados como "efetivado"
- Categoria: "Salários e Encargos"
- Aparecem nos relatórios do mês

---

## Atalhos Rápidos

### Gerar Sugestões Manualmente (SQL)
```sql
SELECT * FROM generate_monthly_payroll_schedule(2026, 2);
```

### Ver Pendências do Mês
```sql
SELECT * FROM v_pending_payroll_current_month;
```

### Ver Total de Salários do Mês
```sql
SELECT SUM(amount) as total
FROM engineering_finance_entries
WHERE category = 'salario_clt'
  AND EXTRACT(YEAR FROM entry_date) = 2026
  AND EXTRACT(MONTH FROM entry_date) = 2;
```

---

## Status

✅ **Sistema Completo e Funcionando**

**Testado**:
- Build passou sem erros
- Categorias customizáveis OK
- Recorrência de salários OK
- Modal de confirmação OK
- Filtro mês atual OK

**Pronto para uso em produção!**
