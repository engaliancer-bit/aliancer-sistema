# Correção: Extrato do Cliente - PDF com Logo e Descrição do Serviço

## Problemas Identificados

### 1. Cabeçalho com Logo não Aparecia no PDF
O cabeçalho com a logo da Aliancer não estava sendo exibido no PDF do extrato do cliente.

**Causa:**
- O código estava tentando buscar as configurações da empresa como colunas individuais (`logo_url, company_name, etc.`)
- Mas a tabela `company_settings` usa estrutura key-value com `setting_key` e `setting_value`
- A chave correta é `company_logo_url` (não `logo_url`)
- Faltava também o campo `company_address` no banco de dados

### 2. Nome do Projeto Aparecia ao Invés da Descrição do Serviço
No extrato, estava aparecendo o nome do projeto (ex: "Geo Raquel Klein") quando deveria aparecer a descrição do serviço prestado (ex: "GEORREFERENCIAMENTO DE IMÓVEL RURAL").

**Causa:**
- As queries não estavam buscando a descrição do serviço do template
- O PDF e a interface estavam usando `project.name` ao invés de `template.description`

## Soluções Implementadas

### 1. Corrigir Carregamento das Configurações da Empresa ✓

**Antes:**
```typescript
const { data: companyData } = await supabase
  .from('company_settings')
  .select('logo_url, company_name, company_address, company_phone, company_email, company_cnpj')
  .single();
```

**Depois:**
```typescript
// Carregar configurações da empresa (estrutura key-value)
const { data: settingsData } = await supabase
  .from('company_settings')
  .select('setting_key, setting_value');

// Converter array de settings para objeto
const settingsMap: Record<string, string> = {};
settingsData?.forEach((s: any) => {
  settingsMap[s.setting_key] = s.setting_value;
});

// Mapear para o formato esperado pelo addPDFHeader
const companyData = {
  logo_url: settingsMap.company_logo_url,  // Chave correta
  company_name: settingsMap.company_name,
  company_address: settingsMap.company_address,
  company_phone: settingsMap.company_phone,
  company_email: settingsMap.company_email,
  company_cnpj: settingsMap.company_cnpj
};
```

### 2. Adicionar Campo company_address ao Banco ✓

```sql
INSERT INTO company_settings (setting_key, setting_value, description)
SELECT
  'company_address',
  'Linha Olaria, s/n, Zona Rural - Itapiranga/SC',
  'Endereço da empresa'
WHERE NOT EXISTS (
  SELECT 1 FROM company_settings WHERE setting_key = 'company_address'
);
```

### 3. Buscar Descrição do Serviço nos Projetos ✓

**Interface Atualizada:**
```typescript
interface ProjectSummary {
  id: string;
  name: string;
  start_date: string;
  status: string;
  grand_total: number;
  total_received: number;
  balance: number;
  property_name: string;
  service_description: string;  // ← NOVO CAMPO
}
```

**Query Atualizada:**
```typescript
const { data: projectsData } = await supabase
  .from('engineering_projects')
  .select(`
    id,
    name,
    start_date,
    status,
    grand_total,
    total_received,
    balance,
    property:property_id (name),
    template:template_id (description)  // ← BUSCAR DESCRIÇÃO DO TEMPLATE
  `)
  .eq('customer_id', selectedCustomerId)
  .order('start_date', { ascending: false });

const formattedProjects = (projectsData || []).map((p: any) => ({
  id: p.id,
  name: p.name,
  start_date: p.start_date,
  status: p.status,
  grand_total: p.grand_total || 0,
  total_received: p.total_received || 0,
  balance: p.balance || 0,
  property_name: p.property?.name || 'N/A',
  service_description: p.template?.description || p.name  // ← USAR DESCRIÇÃO DO TEMPLATE
}));
```

### 4. Buscar Descrição do Serviço nos Pagamentos ✓

**Interface Atualizada:**
```typescript
interface Payment {
  id: string;
  project_id: string;
  project_name: string;
  service_description: string;  // ← NOVO CAMPO
  payment_date: string;
  value: number;
  payment_method: string;
  conta_caixa_id: string;
  account_name: string;
  notes: string;
}
```

**Query Atualizada:**
```typescript
const { data: paymentsData } = await supabase
  .from('engineering_project_payments')
  .select(`
    id,
    project_id,
    payment_date,
    value,
    payment_method,
    conta_caixa_id,
    notes,
    project:project_id (
      name,
      template:template_id (description)  // ← BUSCAR DESCRIÇÃO DO TEMPLATE
    ),
    conta_caixa:conta_caixa_id (nome)
  `)
  .in('project_id', projectIds)
  .order('payment_date', { ascending: false });

const formattedPayments = (paymentsData || []).map((p: any) => ({
  id: p.id,
  project_id: p.project_id,
  project_name: p.project?.name || 'N/A',
  service_description: p.project?.template?.description || p.project?.name || 'N/A',  // ← FALLBACK
  payment_date: p.payment_date,
  value: p.value,
  payment_method: p.payment_method,
  conta_caixa_id: p.conta_caixa_id,
  account_name: p.conta_caixa?.nome || 'N/A',
  notes: p.notes || ''
}));
```

### 5. Atualizar Tabelas no PDF ✓

**Tabela de Projetos:**
```typescript
// ANTES: head: [['Projeto', 'Imóvel', 'Status', 'Valor Total', 'Recebido', 'Saldo']]
// DEPOIS:
head: [['Serviço Prestado', 'Imóvel', 'Status', 'Valor Total', 'Recebido', 'Saldo']]

// ANTES: p.name
// DEPOIS: p.service_description
const projectsTableData = projects.map(p => [
  p.service_description,  // ← MUDANÇA
  p.property_name,
  getStatusLabel(p.status),
  `R$ ${p.grand_total.toFixed(2)}`,
  `R$ ${p.total_received.toFixed(2)}`,
  `R$ ${p.balance.toFixed(2)}`
]);
```

**Tabela de Pagamentos:**
```typescript
// ANTES: head: [['Data', 'Projeto', 'Forma Pagamento', 'Valor', 'Conta']]
// DEPOIS:
head: [['Data', 'Serviço Prestado', 'Forma Pagamento', 'Valor', 'Conta']]

// ANTES: p.project_name
// DEPOIS: p.service_description
const paymentsTableData = payments.map(p => [
  new Date(p.payment_date).toLocaleDateString('pt-BR'),
  p.service_description,  // ← MUDANÇA
  getPaymentMethodLabel(p.payment_method),
  `R$ ${p.value.toFixed(2)}`,
  p.account_name
]);
```

### 6. Atualizar Interface Visual ✓

**Tabela de Projetos na Tela:**
```tsx
// ANTES: <th>Projeto</th>
// DEPOIS:
<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
  Serviço Prestado
</th>

// ANTES: {project.name}
// DEPOIS: {project.service_description}
<td className="px-4 py-3">
  <div className="font-medium text-gray-900">{project.service_description}</div>
</td>
```

**Tabela de Pagamentos na Tela:**
```tsx
// ANTES: <th>Projeto</th>
// DEPOIS:
<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
  Serviço Prestado
</th>

// ANTES: {payment.project_name}
// DEPOIS: {payment.service_description}
<td className="px-4 py-3 text-sm text-gray-900">{payment.service_description}</td>
```

## Resultado Final

### Extrato do Cliente "Raquel Klein"

**Antes:**
```
Cabeçalho: [SEM LOGO - NÃO APARECIA]

Projetos:
┌─────────────────┬──────────┬────────┬─────────┐
│ Projeto         │ Imóvel   │ Status │ Valor   │
├─────────────────┼──────────┼────────┼─────────┤
│ Geo Raquel Klein│ Fazenda  │ Ativo  │ 500,00  │
└─────────────────┴──────────┴────────┴─────────┘
```

**Depois:**
```
Cabeçalho:
┌────────────────────────────────────────────────────────┐
│ [LOGO ALIANCER]    Aliancer Engenharia e Topografia   │
│                    Linha Olaria, s/n, Itapiranga/SC   │
│                    Tel: 49 991955198                   │
│                    Email: administrativo@aliancer...   │
│                    CNPJ: 28.008.940/0001-46            │
├────────────────────────────────────────────────────────┤
│     Extrato do Cliente - Projetos de Engenharia       │
└────────────────────────────────────────────────────────┘

Projetos:
┌─────────────────────────────────────┬──────────┬────────┬─────────┐
│ Serviço Prestado                    │ Imóvel   │ Status │ Valor   │
├─────────────────────────────────────┼──────────┼────────┼─────────┤
│ GEORREFERENCIAMENTO DE IMÓVEL RURAL │ Fazenda  │ Ativo  │ 500,00  │
└─────────────────────────────────────┴──────────┴────────┴─────────┘
```

## Configurações da Empresa Atualizadas

```
✓ company_logo_url: https://lfddbmknscawlbldrmub.supabase.co/storage/v1/object/public/company-logo/company-logo.png
✓ company_name: Aliancer Engenharia e Topografia
✓ company_address: Linha Olaria, s/n, Zona Rural - Itapiranga/SC
✓ company_phone: 49 991955198
✓ company_email: administrativo@aliancer.com.br
✓ company_cnpj: 28.008.940/0001-46
```

## Arquivos Modificados

```
src/components/
└─ EngineeringClientStatement.tsx
```

## Build

✅ **Build bem-sucedido**
- Módulo Engineering: 217.01 kB
- Sem erros de compilação
- Todas as funcionalidades operacionais

## Como Testar

### 1. Verificar Logo no PDF

```
1. Acesse Módulo Engenharia → Extrato do Cliente
2. Selecione um cliente (ex: Raquel Klein)
3. Clique em "Exportar PDF"
4. Verifique se o cabeçalho aparece com:
   - Logo da Aliancer no canto superior esquerdo
   - Nome da empresa, endereço, telefone, email e CNPJ ao lado da logo
   - Linha separadora
   - Título do documento
```

**Resultado esperado:**
- Logo da Aliancer visível
- Todas as informações da empresa formatadas corretamente
- Layout profissional e padronizado

### 2. Verificar Descrição do Serviço

**Na interface:**
```
1. Acesse Módulo Engenharia → Extrato do Cliente
2. Selecione um cliente com projetos
3. Verifique a coluna "Serviço Prestado"
4. Deve mostrar a descrição do serviço (ex: "GEORREFERENCIAMENTO DE IMÓVEL RURAL")
```

**No PDF:**
```
1. Exporte o PDF
2. Verifique as tabelas:
   - Tabela de Projetos: Coluna "Serviço Prestado"
   - Tabela de Recebimentos: Coluna "Serviço Prestado"
3. Ambas devem mostrar a descrição do serviço
```

**Resultado esperado:**
- Interface e PDF mostram "GEORREFERENCIAMENTO DE IMÓVEL RURAL" ao invés de "Geo Raquel Klein"
- Descrição fica clara e profissional
- Se o projeto não tiver template, usa o nome do projeto como fallback

### 3. Validar SQL

```sql
-- Verificar configurações da empresa
SELECT setting_key, setting_value
FROM company_settings
WHERE setting_key IN ('company_logo_url', 'company_name', 'company_address', 'company_phone', 'company_email', 'company_cnpj')
ORDER BY setting_key;
```

**Resultado esperado:**
- Todas as 6 configurações presentes
- Logo URL válida e acessível
- Endereço completo configurado

## Observações Importantes

1. **Estrutura Key-Value:** A tabela `company_settings` usa `setting_key` e `setting_value`, não colunas individuais

2. **Chave Correta da Logo:** Use `company_logo_url` (não `logo_url`)

3. **Fallback:** Se o projeto não tiver `template_id`, usa `project.name` como fallback para `service_description`

4. **Compatibilidade:** As queries usam nested select do Supabase para buscar dados relacionados:
   ```typescript
   template:template_id (description)
   ```

5. **CORS:** A logo deve estar em um bucket público com CORS configurado para ser exibida no PDF

6. **Formato do Cabeçalho:** A função `addPDFHeader` já está implementada e funcional em `pdfGenerator.ts`

---

**Correção concluída com sucesso em 16/02/2026**

**Benefícios:**
✅ Logo da empresa aparece em todos os PDFs de extrato
✅ Informações da empresa completas e profissionais
✅ Descrição do serviço clara e objetiva
✅ Interface e PDF consistentes
✅ Fallback inteligente para projetos sem template
✅ Código reutilizável para outros relatórios
