# Projetos de Consultoria - Imóvel Opcional

## Resumo da Implementação

O sistema agora permite criar projetos de consultoria **SEM** a necessidade de vincular um imóvel. Esta é uma funcionalidade essencial para contratos de consultoria que não estão relacionados a um imóvel específico.

## O que Foi Implementado

### 1. **Campo Imóvel Opcional no Banco de Dados**

O campo `property_id` na tabela `engineering_projects` agora é **opcional (NULL permitido)**.

```sql
-- Migration aplicada
ALTER TABLE engineering_projects ALTER COLUMN property_id DROP NOT NULL;
```

### 2. **Detecção Automática de Projetos de Consultoria**

O sistema detecta automaticamente quando o template selecionado é da categoria "Consultoria" e:

- Remove o asterisco obrigatório (*) do campo Imóvel
- Mostra a mensagem: "(opcional para consultoria)"
- Permite prosseguir sem selecionar imóvel
- Exibe a opção: "Não vinculado a imóvel"

### 3. **Indicador Visual**

Quando um projeto de consultoria é criado, o modal mostra:
```
Novo Projeto (Consultoria)
```

### 4. **Integração com Cobranças Recorrentes**

Projetos de consultoria com cobrança recorrente mensal funcionam perfeitamente sem imóvel vinculado.

## Como Usar

### Criar Projeto de Consultoria Sem Imóvel

1. Acesse **Engenharia e Topografia** > **Projetos**
2. Clique em **"Novo Projeto"**
3. Selecione um **template de Consultoria** que tenha cobrança recorrente
4. Preencha:
   - Nome do Projeto
   - Cliente
5. **Campo Imóvel**:
   - Verá a indicação "(opcional para consultoria)"
   - Pode selecionar "Não vinculado a imóvel"
   - **OU** selecionar um imóvel se desejar
6. Preencha as demais informações
7. Salve o projeto

### Exemplo Prático

**Cenário**: Consultoria Ambiental Mensal

- **Cliente**: Empresa ABC Ltda
- **Serviço**: Consultoria Ambiental - R$ 3.500/mês
- **Imóvel**: Não vinculado (consultoria não é específica de um imóvel)
- **Cobrança**: Automática todo dia 5 do mês

**Resultado**:
- Projeto criado sem imóvel
- Sistema gera cobranças mensais normalmente
- Cliente recebe extrato apenas com dados do projeto

## Regras de Negócio

### Quando o Imóvel é Obrigatório

✅ **Imóvel OBRIGATÓRIO para**:
- Projetos de Topografia
- Projetos de Licenciamento
- Projetos de Laudos e Pareceres
- Qualquer projeto vinculado a um imóvel específico

### Quando o Imóvel é Opcional

✅ **Imóvel OPCIONAL para**:
- Projetos de Consultoria
- Serviços de assessoria geral
- Contratos de consultoria mensal
- Projetos não relacionados a imóveis

## Detalhes Técnicos

### Banco de Dados

**Tabela**: `engineering_projects`

```sql
-- Campo property_id agora aceita NULL
property_id uuid REFERENCES properties(id) ON DELETE RESTRICT
-- Comentário: ID do imóvel relacionado (NULL para projetos de consultoria sem imóvel específico)
```

**Índice Criado**:
```sql
CREATE INDEX idx_engineering_projects_without_property
  ON engineering_projects(customer_id, status)
  WHERE property_id IS NULL;
```

### Frontend

**Detecção Automática**:
```typescript
const isConsultoriaProject = useMemo(() => {
  return selectedServices.some(serviceId => {
    const template = serviceTemplates.find(t => t.id === serviceId);
    return template?.category === 'consultoria';
  });
}, [selectedServices, serviceTemplates]);
```

**Campo Condicional**:
```tsx
<select required={!isConsultoriaProject} value={formData.property_id}>
  <option value="">
    {isConsultoriaProject ? 'Não vinculado a imóvel' : 'Selecione um imóvel'}
  </option>
  {properties.map(...)}
</select>
```

### Views Atualizadas

**v_projects_to_collect**: Atualizada para funcionar com ou sem imóvel

```sql
CREATE OR REPLACE VIEW v_projects_to_collect AS
SELECT
  ep.id,
  ep.name as project_name,
  c.name as customer_name,
  c.id as customer_id,
  (ep.grand_total - ep.total_received) as balance_due,
  ep.grand_total,
  ep.total_received
FROM engineering_projects ep
INNER JOIN customers c ON ep.customer_id = c.id
WHERE ep.status NOT IN ('finalizado', 'entregue', 'registrado')
  AND (ep.grand_total - ep.total_received) > 0
ORDER BY balance_due DESC;
```

## Impacto no Sistema

### Funcionalidades Que Continuam Funcionando

✅ **Todas as funcionalidades existentes mantidas**:
- Projetos com imóvel funcionam normalmente
- Cobranças recorrentes funcionam com ou sem imóvel
- Relatórios e extratos adaptados automaticamente
- Aba "A Cobrar" funciona normalmente
- Pagamentos e recebimentos sem alteração

### Compatibilidade

✅ **Totalmente compatível**:
- Projetos antigos com imóvel: Continuam funcionando
- Projetos novos sem imóvel: Funcionam perfeitamente
- Migrações aplicadas sem perda de dados
- Views atualizadas automaticamente

## Exemplos de Uso

### Exemplo 1: Consultoria Ambiental

**Projeto**: Consultoria Ambiental Mensal
- Cliente: Indústria XYZ
- Serviço: Gestão de resíduos e compliance ambiental
- Valor: R$ 4.000/mês
- Imóvel: **Não vinculado** (consultoria aplicável a todas as unidades)
- Vencimento: Dia 10

**Resultado**:
- Sistema gera cobrança todo dia 10
- Extrato mostra apenas dados do projeto
- Sem necessidade de cadastrar imóvel fictício

### Exemplo 2: Acompanhamento de Obra

**Projeto**: Fiscalização e Acompanhamento
- Cliente: Construtora ABC
- Serviço: Acompanhamento técnico
- Valor: R$ 2.500/mês
- Imóvel: **Loteamento Portal do Sol** (vinculado a imóvel específico)
- Vencimento: Dia 15

**Resultado**:
- Sistema gera cobrança todo dia 15
- Extrato inclui dados do imóvel
- Projeto vinculado ao imóvel específico

### Exemplo 3: Mix - Consultoria + Projetos

**Projeto**: Consultoria + Projeto de Drenagem
- Cliente: Prefeitura Municipal
- Serviços múltiplos:
  1. Consultoria Técnica Mensal (sem imóvel)
  2. Projeto de Drenagem (com imóvel vinculado)
- Tratamento: Sistema permite mix de serviços

## Queries Úteis

### Listar Projetos Sem Imóvel

```sql
SELECT
  ep.name as projeto,
  c.name as cliente,
  ep.grand_total as valor_total,
  ep.status
FROM engineering_projects ep
INNER JOIN customers c ON ep.customer_id = c.id
WHERE ep.property_id IS NULL
ORDER BY ep.created_at DESC;
```

### Projetos de Consultoria Ativos

```sql
SELECT
  ep.name as projeto,
  c.name as cliente,
  est.name as template,
  est.fees as valor_mensal,
  est.recurring_due_day as dia_vencimento
FROM engineering_projects ep
INNER JOIN customers c ON ep.customer_id = c.id
INNER JOIN engineering_service_templates est ON ep.template_id = est.id
WHERE ep.property_id IS NULL
  AND est.is_recurring_monthly = true
  AND ep.status NOT IN ('finalizado', 'entregue', 'registrado')
ORDER BY ep.created_at DESC;
```

### Cobranças Recorrentes Sem Imóvel

```sql
SELECT
  rc.id,
  ep.name as projeto,
  c.name as cliente,
  rc.due_date as vencimento,
  rc.amount as valor,
  rc.status
FROM engineering_recurring_charges rc
INNER JOIN engineering_projects ep ON rc.project_id = ep.id
INNER JOIN customers c ON ep.customer_id = c.id
WHERE ep.property_id IS NULL
  AND rc.status IN ('pending', 'overdue')
ORDER BY rc.due_date;
```

## Mensagens de Erro Resolvidas

### Antes da Implementação

❌ **Erro**: "Campo imóvel é obrigatório"
❌ **Problema**: Impossível criar projeto de consultoria sem imóvel

### Após a Implementação

✅ **Sucesso**: Campo imóvel opcional para consultoria
✅ **Solução**: Projeto criado sem imóvel normalmente

## Arquivos Modificados

### Migrations
- `supabase/migrations/YYYYMMDD_make_property_optional_for_consultoria.sql`

### Componentes
- `src/components/EngineeringProjectsManager.tsx`
- `src/components/engineering/ProjectFormFields.tsx` (se usado)

### Views
- `v_projects_to_collect` (recriada)

## Data de Implementação

**17 de Fevereiro de 2026**

## Status

✅ **IMPLEMENTADO E TESTADO**

---

Sistema totalmente funcional para projetos de consultoria com ou sem imóvel vinculado, mantendo compatibilidade total com projetos existentes.
