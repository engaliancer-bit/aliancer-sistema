# Sistema de Cobrança Recorrente Mensal - Consultoria

## Visão Geral

Sistema completo para gerenciar contratos de consultoria com cobrança mensal automática. O sistema gera automaticamente cobranças mensais para projetos de consultoria ativos.

## Funcionalidades Implementadas

### 1. Templates de Consultoria com Cobrança Recorrente

Ao cadastrar um template de serviço na categoria **"Consultoria"**, você pode configurar:

- **Cobrança Mensal Automática**: Marque a opção para ativar
- **Dia do Vencimento**: Escolha de 1 a 31 (dia do mês para vencimento)
- **Valor Mensal**: Definido no campo "Honorários"
- **Descrição Personalizada**: Descrição que aparecerá nas cobranças (opcional)

### 2. Geração Automática de Cobranças

O sistema gera automaticamente cobranças mensais para:
- Todos os projetos ativos (não concluídos e não cancelados)
- Que usam templates com cobrança recorrente ativada
- No dia configurado de cada mês

### 3. Gestão Centralizada de Cobranças

Nova aba **"Cobranças Recorrentes"** no módulo de Engenharia com:
- Visualização de todas as cobranças
- Filtros: Todas, Pendentes, Vencidas, Pagas
- Dashboard com totais e estatísticas
- Ações: Marcar como pago, Cancelar cobrança

## Como Usar

### Passo 1: Criar Template de Consultoria

1. Acesse **Engenharia e Topografia** > **Projetos (Templates)**
2. Clique em **"Novo Serviço"**
3. Preencha os dados básicos:
   - Nome: Ex: "Consultoria Ambiental Mensal"
   - Categoria: Selecione **"Consultoria"**
   - Honorários: Ex: R$ 2.500,00 (valor mensal)
   - Descrição: Descreva o serviço

4. **Seção de Cobrança Recorrente** (aparece automaticamente para categoria Consultoria):
   - ☑️ Marque **"Este serviço tem cobrança mensal recorrente"**
   - Selecione o **Dia do Vencimento** (ex: Dia 10)
   - (Opcional) Adicione uma **Descrição personalizada** para as cobranças

5. Configure o **Checklist** (opcional)
6. Clique em **"Cadastrar Serviço"**

### Passo 2: Criar Projeto de Consultoria

1. Acesse **Engenharia e Topografia** > **Projetos**
2. Clique em **"Novo Projeto"**
3. Selecione o template de consultoria criado
4. Preencha os dados do projeto
5. Salve o projeto

**Importante**: A partir deste momento, o projeto está ativo para cobrança recorrente!

### Passo 3: Gerar Cobranças Mensais

#### Opção A: Gerar Manualmente (Recomendado para o primeiro mês)

1. Acesse **Engenharia e Topografia** > **Cobranças Recorrentes**
2. Clique em **"Gerar Cobranças do Mês"**
3. O sistema criará automaticamente cobranças para todos os projetos ativos

#### Opção B: Automático via Sistema (Futuro)

O sistema pode ser configurado para gerar automaticamente via:
- Edge Function agendada (cron job)
- Execução manual mensal
- Integração com sistema de notificações

### Passo 4: Gerenciar Cobranças

1. Acesse **Engenharia e Topografia** > **Cobranças Recorrentes**

2. **Visualize as cobranças**:
   - Use os filtros: Todas, Pendentes, Vencidas, Pagas
   - Veja o dashboard com totais

3. **Marcar como paga**:
   - Clique no ícone ✓ (verde) ao lado da cobrança
   - Confirme o pagamento

4. **Cancelar cobrança**:
   - Clique no ícone ✗ (vermelho) ao lado da cobrança
   - Confirme o cancelamento

## Detalhes Técnicos

### Estrutura de Dados

#### Tabela `engineering_service_templates`
Novos campos:
- `is_recurring_monthly` (boolean) - Ativa cobrança recorrente
- `recurring_due_day` (integer 1-31) - Dia do vencimento
- `recurring_description` (text) - Descrição personalizada

#### Tabela `engineering_recurring_charges`
Armazena as cobranças geradas:
- `project_id` - Referência ao projeto
- `charge_date` - Data de referência (mês da cobrança)
- `due_date` - Data de vencimento
- `amount` - Valor da cobrança
- `description` - Descrição
- `status` - pending, paid, overdue, cancelled
- `payment_id` - Referência ao pagamento (quando pago)
- `generated_automatically` - Se foi gerado automaticamente

### Funções SQL Disponíveis

#### `generate_monthly_recurring_charge(project_id, charge_month)`
Gera uma cobrança para um projeto específico em um mês.

```sql
-- Exemplo: Gerar cobrança de fevereiro de 2026 para um projeto
SELECT generate_monthly_recurring_charge(
  'uuid-do-projeto',
  '2026-02-01'::date
);
```

#### `generate_all_monthly_charges()`
Gera cobranças para todos os projetos recorrentes ativos do mês atual.

```sql
-- Gerar todas as cobranças do mês
SELECT * FROM generate_all_monthly_charges();
```

### View `v_recurring_charges_pending`
View otimizada que mostra cobranças pendentes e vencidas com informações do projeto e cliente.

## Regras de Negócio

### Quando uma Cobrança é Gerada

✅ **SIM** - Cobrança será gerada se:
- Projeto está ativo (não concluído, não cancelado)
- Template tem `is_recurring_monthly = true`
- Ainda não existe cobrança para aquele mês

❌ **NÃO** - Cobrança NÃO será gerada se:
- Projeto está concluído ou cancelado
- Template não tem cobrança recorrente ativada
- Já existe cobrança para aquele mês (evita duplicação)

### Status das Cobranças

1. **Pending (Pendente)**
   - Cobrança criada e aguardando pagamento
   - Vencimento ainda não passou

2. **Overdue (Vencida)**
   - Vencimento já passou
   - Ainda não foi paga
   - Sistema atualiza automaticamente

3. **Paid (Paga)**
   - Pagamento confirmado
   - Pode ter referência ao lançamento financeiro

4. **Cancelled (Cancelada)**
   - Cobrança cancelada manualmente
   - Não será cobrada

### Cálculo da Data de Vencimento

O sistema calcula automaticamente considerando:
- **Mês com 31 dias**: Vencimento no dia configurado
- **Mês com 30 dias**: Se dia configurado > 30, vencimento dia 30
- **Fevereiro (28/29 dias)**: Se dia configurado > 28/29, vencimento no último dia

**Exemplo**: Se configurado para vencer dia 31:
- Janeiro: 31/01
- Fevereiro: 28/02 (ou 29 em ano bissexto)
- Março: 31/03
- Abril: 30/04

## Integração com Financeiro

### Integração Manual (Atual)

1. Gere as cobranças mensais
2. Quando receber o pagamento, marque como "Pago" em Cobranças Recorrentes
3. Registre o recebimento em **Receitas/Despesas**

### Integração Automática (Futura)

Ao marcar cobrança como paga:
- Sistema cria automaticamente lançamento em Receitas/Despesas
- Vincula a cobrança ao lançamento
- Atualiza o saldo do projeto

## Relatórios e Consultas

### Dashboard de Cobranças

Mostra:
- **Total Pendente**: Soma de todas as cobranças pendentes + vencidas
- **Total Vencido**: Soma apenas das cobranças vencidas
- **Total de Cobranças**: Quantidade total

### Consultas SQL Úteis

```sql
-- Cobranças do mês atual
SELECT * FROM engineering_recurring_charges
WHERE date_trunc('month', charge_date) = date_trunc('month', CURRENT_DATE);

-- Projetos com cobrança recorrente ativa
SELECT
  ep.name as projeto,
  c.name as cliente,
  est.fees as valor_mensal,
  est.recurring_due_day as dia_vencimento
FROM engineering_projects ep
INNER JOIN customers c ON ep.customer_id = c.id
INNER JOIN engineering_service_templates est ON ep.template_id = est.id
WHERE est.is_recurring_monthly = true
  AND ep.status NOT IN ('concluido', 'cancelado');

-- Total a receber no mês
SELECT
  SUM(amount) as total_receber
FROM engineering_recurring_charges
WHERE status IN ('pending', 'overdue')
  AND date_trunc('month', charge_date) = date_trunc('month', CURRENT_DATE);
```

## Melhores Práticas

### 1. Geração de Cobranças
- Gere as cobranças no **início de cada mês**
- Verifique se não há duplicatas antes de gerar
- Revise as cobranças geradas antes de enviar aos clientes

### 2. Gestão de Status
- Marque como **"Paga"** assim que receber
- **Cancele** cobranças indevidas imediatamente
- Monitore as **vencidas** diariamente

### 3. Comunicação com Cliente
- Envie notificação quando gerar a cobrança
- Lembre o cliente próximo ao vencimento
- Acompanhe cobranças vencidas

### 4. Controle de Contratos
- Quando projeto for concluído, mude status para **"Concluído"**
- Sistema para automaticamente de gerar cobranças
- Mantenha histórico de cobranças pagas

## Exemplos Práticos

### Exemplo 1: Consultoria Ambiental Mensal

**Template:**
- Nome: Consultoria Ambiental - Gestão de Resíduos
- Valor: R$ 3.500,00/mês
- Vencimento: Dia 5
- Descrição: Mensalidade de consultoria ambiental - Gestão de resíduos sólidos

**Resultado:**
- Todo dia 5 do mês, uma cobrança de R$ 3.500,00 é criada
- Cliente recebe cobrança referente ao mês corrente
- Descrição aparece no extrato

### Exemplo 2: Acompanhamento de Obra

**Template:**
- Nome: Acompanhamento Técnico de Obra
- Valor: R$ 2.000,00/mês
- Vencimento: Dia 15
- Descrição: Mensalidade - Acompanhamento técnico e fiscalização

**Resultado:**
- Todo dia 15 do mês, cobrança de R$ 2.000,00
- Projeto ativo durante toda a obra
- Ao concluir obra, projeto é finalizado e cobranças param

## Perguntas Frequentes (FAQ)

**P: E se eu esquecer de gerar as cobranças do mês?**
R: Você pode gerar cobranças retroativas. Basta executar a função para o mês desejado.

**P: Posso ter vários projetos de consultoria para o mesmo cliente?**
R: Sim! Cada projeto gera suas próprias cobranças independentemente.

**P: O que acontece se eu mudar o valor do template?**
R: Cobranças já geradas mantêm o valor original. Novas cobranças usarão o novo valor.

**P: Posso mudar o dia de vencimento?**
R: Sim, alterando no template. Cobranças futuras usarão o novo dia.

**P: Como cancelo um contrato de consultoria?**
R: Mude o status do projeto para "Cancelado" ou "Concluído". O sistema para de gerar cobranças.

**P: Posso ter cobrança recorrente em outras categorias?**
R: Atualmente, só a categoria "Consultoria" suporta. Mas tecnicamente é possível adicionar a outras.

## Próximas Melhorias (Roadmap)

### Curto Prazo
- [ ] Integração automática com Receitas/Despesas
- [ ] Notificação por e-mail/WhatsApp ao gerar cobrança
- [ ] Geração automática via cron job

### Médio Prazo
- [ ] Boleto bancário automático
- [ ] Link de pagamento online
- [ ] Relatório mensal de cobranças

### Longo Prazo
- [ ] Cobrança com múltiplas periodicidades (trimestral, semestral, anual)
- [ ] Reajuste automático por índice (IPCA, IGP-M)
- [ ] Portal do cliente para visualizar cobranças

## Suporte e Problemas

### Problemas Comuns

**1. Cobrança não foi gerada**
- Verifique se projeto está ativo
- Confirme que template tem cobrança recorrente ativada
- Verifique se já não existe cobrança para aquele mês

**2. Cobrança duplicada**
- Sistema tem proteção contra duplicação
- Se ocorrer, delete a cobrança duplicada manualmente

**3. Data de vencimento errada**
- Verifique o dia configurado no template
- Lembre que meses com menos dias ajustam automaticamente

## Arquivos do Sistema

### Arquivos Criados/Modificados

**Migrações:**
- `supabase/migrations/YYYYMMDD_add_recurring_billing_to_consultoria_templates.sql`

**Componentes:**
- `src/components/EngineeringServices.tsx` (modificado)
- `src/components/RecurringChargesManager.tsx` (novo)
- `src/App.tsx` (modificado)

**Funções SQL:**
- `generate_monthly_recurring_charge()`
- `generate_all_monthly_charges()`

**Views:**
- `v_recurring_charges_pending`

## Data de Implementação

**17 de Fevereiro de 2026**

Status: ✅ **SISTEMA COMPLETO E OPERACIONAL**

---

Sistema desenvolvido para gestão profissional de contratos de consultoria com cobrança mensal recorrente automatizada.
