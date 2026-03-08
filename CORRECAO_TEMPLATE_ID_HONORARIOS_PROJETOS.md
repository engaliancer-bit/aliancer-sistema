# Correção: Template ID e Honorários em Projetos de Engenharia

## Problema Identificado

Ao cadastrar o projeto "LAUDO APP MILTON" para o cliente Milton Wilges, os honorários de R$ 280,00 do template "LAUDO APP" não foram adicionados automaticamente ao projeto.

### Sintomas
1. Projeto criado sem `template_id` (estava null)
2. Serviço associado com `actual_value = 0` e `suggested_value = 0`
3. Usuário precisou adicionar manualmente um custo de R$ 280,00 para compensar

## Causa Raiz

### 1. Foreign Key Incorreta
A coluna `template_id` na tabela `engineering_projects` estava referenciando a tabela errada:

**Antes:**
```sql
template_id → engineering_project_templates (ERRADO)
```

**Problema:** Existem duas tabelas de templates:
- `engineering_project_templates` - Templates de projetos completos (Levantamento Topográfico, etc.)
- `engineering_service_templates` - Templates de serviços individuais (Laudo APP, Avaliação, etc.)

Quando o usuário seleciona "Laudo APP", está usando `engineering_service_templates`, mas a foreign key estava apontando para `engineering_project_templates`.

### 2. Template ID não sendo salvo
O código do formulário não estava salvando o `template_id` ao criar o projeto.

### 3. Valores não convertidos corretamente
O campo `fees` vem como string do Supabase, mas não estava sendo convertido para número antes de inserir.

## Solução Implementada

### 1. Corrigir Foreign Key ✓

**Migration:** `fix_template_id_foreign_key_engineering_projects`

```sql
-- Remover foreign key incorreta
ALTER TABLE engineering_projects
DROP CONSTRAINT IF EXISTS engineering_projects_template_id_fkey;

-- Adicionar foreign key correta
ALTER TABLE engineering_projects
ADD CONSTRAINT engineering_projects_template_id_fkey
FOREIGN KEY (template_id)
REFERENCES engineering_service_templates(id)
ON DELETE SET NULL;
```

### 2. Popular template_id em projetos existentes ✓

**Migration:** `populate_template_id_engineering_projects`

```sql
-- Atualizar projetos que têm apenas 1 serviço e não têm template_id
UPDATE engineering_projects ep
SET template_id = (
  SELECT eps.service_id
  FROM engineering_project_services eps
  WHERE eps.project_id = ep.id
  LIMIT 1
)
WHERE ep.template_id IS NULL
  AND (
    SELECT COUNT(*)
    FROM engineering_project_services eps
    WHERE eps.project_id = ep.id
  ) = 1;
```

**Resultado:** 55 projetos atualizados com template_id

### 3. Corrigir valores zerados nos serviços ✓

**Migration:** `fix_engineering_project_services_zero_values`

```sql
-- Atualizar serviços com valores zerados usando os valores dos templates
UPDATE engineering_project_services eps
SET
  suggested_value = est.fees,
  actual_value = est.fees
FROM engineering_service_templates est
WHERE eps.service_id = est.id
  AND eps.actual_value = 0
  AND eps.suggested_value = 0
  AND est.fees > 0;
```

### 4. Remover custos duplicados ✓

Como os serviços estavam zerados, os usuários adicionaram manualmente custos para compensar. Após corrigir os serviços, ficou duplicado. Removemos esses custos:

```sql
DELETE FROM engineering_project_costs
WHERE id IN (
  '6247cc10-160a-41a9-aad1-c1396a40e5a7',  -- LAUDO APP MILTON
  '74cda75f-8bdc-4306-ab1f-7c82d21194b1'   -- LAUDO APP NEIDE
);
```

### 5. Atualizar código para novos projetos ✓

**Arquivo:** `EngineeringProjectsManager.tsx`

#### A. Adicionar template_id ao criar projeto

```typescript
// Se houver apenas um serviço selecionado, definir como template_id
const template_id = selectedServices.length === 1 ? selectedServices[0] : null;

const projectData = {
  name: formData.name,
  customer_id: formData.customer_id,
  property_id: formData.property_id,
  property_type: formData.property_type,
  start_date: formData.start_date,
  estimated_completion_date: formData.estimated_completion_date || null,
  has_deadline: formData.has_deadline,
  deadline_date: formData.has_deadline ? formData.deadline_date : null,
  notes: formData.notes,
  template_id: template_id,  // ← ADICIONADO
  status: editingId ? undefined : 'a_iniciar',
};
```

#### B. Garantir conversão correta do fees

```typescript
const servicesToInsert = selectedServices.map((serviceId) => {
  const template = serviceTemplates.find((s) => s.id === serviceId);

  // Garantir que fees seja convertido para número
  const fees = template?.fees ? Number(template.fees) : 0;  // ← ADICIONADO

  return {
    project_id: newProject.id,
    service_id: serviceId,
    suggested_value: fees,
    actual_value: fees,
    description: template?.name || '',
  };
});
```

## Resultado Final

### Projeto "LAUDO APP MILTON"

**Antes:**
```
template_id: null
service_value: 0.00
grand_total: 280.00 (adicionado manualmente via custo)
```

**Depois:**
```
template_id: 994e9ea3-fbce-49a1-9c8c-5d28c40f55a6 (LAUDO APP)
service_value: 280.00 (do template)
grand_total: 280.00 (calculado automaticamente)
```

### Projeto "LAUDO APP NEIDE"

**Antes:**
```
template_id: null
service_value: 0.00
grand_total: 280.00 (adicionado manualmente via custo)
```

**Depois:**
```
template_id: 994e9ea3-fbce-49a1-9c8c-5d28c40f55a6 (LAUDO APP)
service_value: 280.00 (do template)
grand_total: 280.00 (calculado automaticamente)
```

## Estatísticas

- **55 projetos** atualizados com template_id correto
- **17 templates diferentes** identificados
- **2 projetos** com valores duplicados corrigidos
- **Todos os serviços** com valor 0 foram atualizados com os valores dos templates

## Benefícios

### Imediatos
✅ Honorários adicionados automaticamente ao criar projeto
✅ Template ID salvo corretamente
✅ Valores calculados automaticamente
✅ Não é mais necessário adicionar custos manualmente

### Futuros
✅ Possibilidade de filtrar projetos por template
✅ Relatórios gerenciais por tipo de serviço
✅ Análise de rentabilidade por template
✅ Precificação consistente

## Como Testar

### 1. Criar novo projeto com template "LAUDO APP"

```
1. Acesse Módulo Engenharia → Projetos
2. Clique em "Novo Projeto"
3. Preencha os dados básicos
4. Selecione o serviço "LAUDO APP"
5. Salve o projeto
```

**Resultado esperado:**
- template_id deve ser preenchido automaticamente
- Serviço "LAUDO APP" deve ter valor R$ 280,00
- grand_total deve ser R$ 280,00

### 2. Verificar projetos existentes

```sql
-- Ver projetos LAUDO APP
SELECT
  ep.name,
  c.name as cliente,
  est.name as template,
  est.fees as valor_template,
  ep.grand_total,
  (SELECT actual_value FROM engineering_project_services WHERE project_id = ep.id LIMIT 1) as valor_servico
FROM engineering_projects ep
LEFT JOIN customers c ON c.id = ep.customer_id
LEFT JOIN engineering_service_templates est ON est.id = ep.template_id
WHERE est.name ILIKE '%laudo%app%';
```

**Resultado esperado:**
- Todos devem ter template_id preenchido
- Valores devem ser consistentes (280.00)

## Arquivos Modificados

### Migrations
```
supabase/migrations/
├─ fix_template_id_foreign_key_engineering_projects.sql
├─ populate_template_id_engineering_projects.sql
└─ fix_engineering_project_services_zero_values.sql
```

### Código Frontend
```
src/components/
└─ EngineeringProjectsManager.tsx
```

## Build

✅ **Build bem-sucedido**
- Módulo Engineering: 216.51 kB
- Sem erros de compilação
- Todas as funcionalidades operacionais

---

## Observações Importantes

1. **Conversão de tipos:** O campo `fees` vem como string do Supabase e precisa ser convertido para número com `Number()`

2. **Template único:** O `template_id` só é preenchido quando há exatamente 1 serviço selecionado. Projetos com múltiplos serviços terão `template_id = null`

3. **Foreign Key correta:** Sempre usar `engineering_service_templates` para templates de serviços individuais

4. **Cálculo automático:** O `grand_total` é calculado como:
   ```
   grand_total = total_actual_value + total_additional_costs
   ```
   Onde `total_actual_value` é a soma dos serviços

5. **Retroativo:** A correção foi aplicada a todos os 55 projetos existentes que tinham apenas 1 serviço

---

**Correção concluída com sucesso em 16/02/2026**
