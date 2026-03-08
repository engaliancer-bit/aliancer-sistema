# Correções: Extrato do Cliente - 16/02/2026

## Problemas Identificados e Soluções

### 1. ✅ Coluna "Serviço Prestado" Mostrando Descrição ao Invés do Nome

**Problema:**
- Na coluna "Serviço Prestado", estava aparecendo o campo `description` do template ao invés do campo `name`
- Isso resultava em textos genéricos ao invés do nome real do serviço

**Solução:**
- Alterado query de projetos de `template:template_id (description)` para `template:template_id (name)`
- Alterado query de pagamentos de `template:template_id (description)` para `template:template_id (name)`
- Alterado mapeamento de `p.template?.description` para `p.template?.name`

**Arquivo Modificado:**
- `src/components/EngineeringClientStatement.tsx` (linhas 148, 164, 185, 198)

**Resultado:**
- Agora mostra "GEORREFERENCIAMENTO DE IMÓVEL RURAL" ao invés de descrições genéricas
- Tanto na interface quanto no PDF

---

### 2. ✅ Evidenciar "Saldo a Receber" em Negrito e Vermelho

**Problema:**
- O card "Saldo Devedor" não estava suficientemente destacado
- Cliente solicitou maior evidência visual do valor a receber

**Solução Interface (Web):**
```tsx
// Antes: Card normal com texto padrão
<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
  <p className="text-sm text-gray-600">Saldo Devedor</p>
  <p className="text-2xl font-bold text-red-600 mt-1">

// Depois: Card com fundo vermelho, borda destacada e texto em negrito
<div className="bg-red-50 rounded-lg shadow-sm border-2 border-red-300 p-4">
  <p className="text-sm font-bold text-red-700 uppercase">Saldo a Receber</p>
  <p className="text-3xl font-extrabold text-red-600 mt-1">
```

**Solução PDF:**
```typescript
// Saldo a Receber em destaque (vermelho e negrito)
doc.setTextColor(220, 38, 38); // Cor vermelha
doc.setFontSize(12);
doc.setFont(undefined, 'bold');
doc.text(`SALDO A RECEBER: R$ ${totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14, currentY);
```

**Arquivo Modificado:**
- `src/components/EngineeringClientStatement.tsx` (linhas 530-540, 332-339)

**Resultado:**
- Card com fundo vermelho claro
- Borda vermelha dupla (2px)
- Texto "SALDO A RECEBER" em uppercase e negrito
- Valor em fonte maior (3xl) e extrabold
- No PDF, aparece em vermelho e negrito

---

### 3. ✅ Adicionar Detalhes dos Recebimentos no PDF

**Problema:**
- A tabela de recebimentos no PDF era simples demais
- Faltavam informações importantes como observações
- Não havia totalização dos recebimentos

**Solução:**

#### Tabela de Recebimentos Melhorada
```typescript
// Seção de Recebimentos com detalhes
if (payments.length > 0) {
  currentY = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('Detalhamento de Recebimentos', 14, currentY);
  currentY += 7;

  const paymentsTableData = payments.map(p => [
    new Date(p.payment_date).toLocaleDateString('pt-BR'),
    p.service_description,
    getPaymentMethodLabel(p.payment_method),
    p.account_name,
    `R$ ${p.value.toFixed(2)}`,
    p.notes || '-'
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Data', 'Serviço Prestado', 'Forma Pgto', 'Conta', 'Valor', 'Observações']],
    body: paymentsTableData,
    theme: 'grid',
    headStyles: { fillColor: [39, 174, 96], fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 45 },
      2: { cellWidth: 25 },
      3: { cellWidth: 30 },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 35 }
    }
  });
```

#### Totalizadores
```typescript
// Totalizador de recebimentos
currentY = (doc as any).lastAutoTable.finalY + 5;
doc.setFontSize(10);
doc.setFont(undefined, 'bold');
doc.text(`Total de Recebimentos: ${payments.length}`, 14, currentY);
currentY += 5;
doc.setTextColor(34, 197, 94); // Verde
doc.text(`Valor Total Recebido: R$ ${totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14, currentY);
doc.setTextColor(0, 0, 0); // Voltar para preto
```

**Arquivo Modificado:**
- `src/components/EngineeringClientStatement.tsx` (linhas 360-404)

**Novas Colunas na Tabela de Recebimentos (PDF):**
1. **Data** - Data do recebimento
2. **Serviço Prestado** - Nome do serviço (ex: "GEORREFERENCIAMENTO DE IMÓVEL RURAL")
3. **Forma Pgto** - Forma de pagamento (PIX, Dinheiro, etc.)
4. **Conta** - Conta de caixa onde foi recebido
5. **Valor** - Valor recebido (alinhado à direita)
6. **Observações** - Notas sobre o recebimento

**Totalizadores Adicionados:**
- Total de Recebimentos (quantidade)
- Valor Total Recebido (em verde e negrito)

---

## Resumo das Alterações

### Interface Web
- ✅ Coluna "Serviço Prestado" mostra nome correto do serviço
- ✅ Card "Saldo a Receber" com destaque visual (fundo vermelho, borda dupla, texto em negrito)
- ✅ Tabela de recebimentos já mostrava todos os detalhes (incluindo observações)

### PDF
- ✅ Coluna "Serviço Prestado" mostra nome correto do serviço
- ✅ "SALDO A RECEBER" em vermelho e negrito no resumo financeiro
- ✅ Seção "Detalhamento de Recebimentos" com 6 colunas completas
- ✅ Totalizadores ao final (quantidade e valor total recebido em verde)

---

## Como Testar

### 1. Verificar Nome do Serviço
```sql
-- Verificar se os templates têm nomes corretos
SELECT id, name, description
FROM engineering_service_templates
ORDER BY name;
```

**Resultado esperado:**
- Campo `name` deve conter nomes como "GEORREFERENCIAMENTO DE IMÓVEL RURAL"
- Campo `description` contém descrições detalhadas

### 2. Testar Interface Web
```
1. Acesse Módulo Engenharia → Extrato do Cliente
2. Selecione um cliente que tenha projetos
3. Verifique:
   - Coluna "Serviço Prestado" mostra nome do serviço (não descrição)
   - Card "Saldo a Receber" está com fundo vermelho e texto destacado
   - Tabela "Histórico de Recebimentos" mostra todos os detalhes
```

**Resultado esperado:**
- ✅ Nome do serviço correto (ex: "GEORREFERENCIAMENTO DE IMÓVEL RURAL")
- ✅ Card vermelho com texto em negrito e uppercase
- ✅ Histórico de recebimentos completo com observações

### 3. Testar PDF
```
1. Acesse Módulo Engenharia → Extrato do Cliente
2. Selecione um cliente
3. Clique em "Exportar PDF"
4. Abra o PDF e verifique:
   - Resumo Financeiro tem "SALDO A RECEBER" em vermelho e negrito
   - Tabela de projetos mostra nome do serviço
   - Seção "Detalhamento de Recebimentos" aparece com 6 colunas
   - Totalizadores aparecem ao final
```

**Resultado esperado:**
```
Resumo Financeiro
-----------------
Total de Projetos: 1
Valor Total: R$ 5.000,00
Total Recebido: R$ 3.000,00

SALDO A RECEBER: R$ 2.000,00    ← EM VERMELHO E NEGRITO

Projetos do Cliente
┌─────────────────────────────────────┬─────────┬────────┬─────────┐
│ Serviço Prestado                    │ Imóvel  │ Status │ Valor   │
├─────────────────────────────────────┼─────────┼────────┼─────────┤
│ GEORREFERENCIAMENTO DE IMÓVEL RURAL │ Fazenda │ ...    │ 5000,00 │
└─────────────────────────────────────┴─────────┴────────┴─────────┘

Detalhamento de Recebimentos
┌──────────┬──────────────┬────────────┬────────┬────────┬──────────────┐
│ Data     │ Serv. Prest. │ Forma Pgto │ Conta  │ Valor  │ Observações  │
├──────────┼──────────────┼────────────┼────────┼────────┼──────────────┤
│ 15/02/26 │ GEORREF...   │ PIX        │ Banco  │ 3000   │ Sinal do...  │
└──────────┴──────────────┴────────────┴────────┴────────┴──────────────┘

Total de Recebimentos: 1
Valor Total Recebido: R$ 3.000,00    ← EM VERDE E NEGRITO
```

---

## Arquivos Modificados

| Arquivo | Alterações |
|---------|-----------|
| `src/components/EngineeringClientStatement.tsx` | • Query de projetos (linha 148)<br>• Mapeamento service_description (linha 164)<br>• Query de pagamentos (linha 185)<br>• Mapeamento pagamentos (linha 198)<br>• Card "Saldo a Receber" (linhas 530-540)<br>• PDF - Saldo destacado (linhas 332-339)<br>• PDF - Tabela de recebimentos completa (linhas 360-404) |

---

## Impacto

### Antes
- Mostrava descrições genéricas ao invés do nome do serviço
- "Saldo Devedor" não tinha destaque visual suficiente
- PDF tinha tabela de recebimentos simples sem observações

### Depois
- ✅ Nome correto do serviço em todos os lugares
- ✅ "Saldo a Receber" com destaque visual forte (vermelho, negrito, fundo colorido)
- ✅ PDF completo com:
  - Saldo a receber em vermelho e negrito
  - Tabela de recebimentos com 6 colunas (incluindo observações)
  - Totalizadores ao final da tabela de recebimentos

---

## Build

```bash
npm run build
```

**Resultado:**
```
✓ built in 26.58s
✅ Build concluído sem erros
```

---

---

### 4. ✅ Remoção da Tabela de Projetos e Uso do Valor Negociado

**Data:** 16/02/2026 (Segunda atualização)

#### Problema 1: Redundância de Informações
A interface e o PDF mostravam duas seções com informações dos projetos:
1. Tabela "Projetos do Cliente" (formato tabular)
2. "Discriminação de Valores por Projeto" (formato detalhado)

Isso causava:
- Redundância de informações
- Interface poluída
- PDF muito extenso
- Confusão para o usuário

#### Problema 2: Valor Incorreto dos Honorários
O campo "Honorários do Serviço" mostrava o valor padrão do template (`template.fees`), que é apenas um valor sugerido, e não o valor efetivamente negociado com o cliente.

Por exemplo:
- Template sugeria: R$ 5.000,00
- Valor negociado: R$ 4.500,00
- **Estava mostrando:** R$ 5.000,00 (ERRADO)
- **Deveria mostrar:** R$ 4.500,00 (valor acordado)

---

#### Solução Implementada

##### 1. Remoção da Tabela de Projetos

**Interface Web (Linha 678-741):**
```typescript
// REMOVIDO: Toda a seção "Lista de Projetos"
{/* Lista de Projetos */}
<div className="bg-white rounded-lg shadow-sm border border-gray-200">
  <div className="p-4 border-b border-gray-200">
    <h3 className="text-lg font-semibold text-gray-800">Projetos do Cliente</h3>
  </div>
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead>...</thead>
      <tbody>...</tbody>
    </table>
  </div>
</div>

// MANTIDO: Apenas "Discriminação de Valores por Projeto"
```

**PDF (Linha 376-393):**
```typescript
// REMOVIDO: Tabela de projetos
const projectsTableData = projects.map(p => [
  p.service_description,
  p.property_name,
  getStatusLabel(p.status),
  `R$ ${p.grand_total.toFixed(2)}`,
  `R$ ${p.total_received.toFixed(2)}`,
  `R$ ${p.balance.toFixed(2)}`
]);

autoTable(doc, {
  startY: currentY,
  head: [['Serviço Prestado', 'Imóvel', 'Status', 'Valor Total', 'Recebido', 'Saldo']],
  body: projectsTableData,
  theme: 'grid',
  headStyles: { fillColor: [41, 128, 185] },
  styles: { fontSize: 9 }
});
```

##### 2. Uso do Valor Negociado

**Query Atualizada (Linha 148-185):**
```typescript
// ANTES:
.select(`
  ...
  template:template_id (name, fees)  // Buscava fees do template
`)

const serviceFees = p.template?.fees || 0;  // Usava valor do template

// DEPOIS:
.select(`
  ...
  total_actual_value,                // Busca valor negociado do projeto
  template:template_id (name)        // Não precisa mais do fees
`)

const serviceFees = p.total_actual_value || 0;  // Usa valor negociado
```

**Campo Utilizado:**
- **Tabela:** `engineering_projects`
- **Campo:** `total_actual_value`
- **Tipo:** `numeric`
- **Descrição:** Valor total negociado com o cliente para o serviço prestado

**Texto Alterado:**

Interface Web (Linha 700):
```typescript
// ANTES:
<span>• Honorários do Serviço:</span>

// DEPOIS:
<span>• Valor Negociado:</span>
```

PDF (Linha 401):
```typescript
// ANTES:
doc.text(`• Honorários do Serviço:`, 18, currentY);

// DEPOIS:
doc.text(`• Valor Negociado:`, 18, currentY);
```

---

#### Comparação Antes/Depois

##### Interface Web - ANTES:
```
┌──────────────────────────────────────────┐
│ Projetos do Cliente                       │
├──────────────────────────────────────────┤
│ Tabela com 7 colunas                     │
│ - Serviço Prestado                       │
│ - Imóvel                                 │
│ - Data Início                            │
│ - Status                                 │
│ - Valor Total                            │
│ - Recebido                               │
│ - Saldo                                  │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ Discriminação de Valores por Projeto     │
├──────────────────────────────────────────┤
│ • Honorários do Serviço: R$ 5.000,00    │ ← Valor do template (errado)
│ • Material: GPS: R$ 1.200,00             │
│ ...                                       │
└──────────────────────────────────────────┘
```

##### Interface Web - DEPOIS:
```
┌──────────────────────────────────────────┐
│ Discriminação de Valores por Projeto     │
├──────────────────────────────────────────┤
│ GEORREFERENCIAMENTO - Fazenda Santa Clara│
│ Status: [Em Desenvolvimento]             │
│                                           │
│ • Valor Negociado: R$ 4.500,00          │ ← Valor acordado (correto)
│ • Material: GPS Geodésico: R$ 1.200,00  │
│ • Viagem/Deslocamento: R$ 300,00        │
│ • Serviço: Topografia: R$ 800,00        │
│ ──────────────────────────────────────── │
│ TOTAL DO PROJETO: R$ 6.800,00           │
│ Total Recebido: R$ 3.000,00             │
│ Saldo a Receber: R$ 3.800,00            │
└──────────────────────────────────────────┘
```

##### PDF - ANTES:
```
Projetos do Cliente
┌────────────────┬────────┬────────┬───────┬──────────┬────────┐
│ Serviço        │ Imóvel │ Status │ Total │ Recebido │ Saldo  │
├────────────────┼────────┼────────┼───────┼──────────┼────────┤
│ GEORREF...     │ Faz... │ Em Desv│ 6800  │ 3000     │ 3800   │
└────────────────┴────────┴────────┴───────┴──────────┴────────┘

Discriminação de Valores por Projeto

GEORREFERENCIAMENTO - Fazenda Santa Clara

• Honorários do Serviço:                    R$ 5.000,00  ← Errado
• Material: GPS Geodésico                   R$ 1.200,00
```

##### PDF - DEPOIS:
```
Discriminação de Valores por Projeto

GEORREFERENCIAMENTO - Fazenda Santa Clara

• Valor Negociado:                          R$ 4.500,00  ← Correto
• Material: GPS Geodésico                   R$ 1.200,00
• Viagem/Deslocamento: Visita técnica       R$ 300,00
• Serviço: Topografia                       R$ 800,00

TOTAL DO PROJETO:                           R$ 6.800,00
─────────────────────────────────────────────────────
```

---

#### Diferença entre os Campos

| Campo | Origem | Uso | Exemplo |
|-------|--------|-----|---------|
| `template.fees` | `engineering_service_templates` | Valor sugerido/padrão | R$ 5.000,00 |
| `total_actual_value` | `engineering_projects` | Valor negociado | R$ 4.500,00 |

**Exemplo SQL:**
```sql
-- Template sugere R$ 5.000,00
SELECT name, fees FROM engineering_service_templates
WHERE name = 'GEORREFERENCIAMENTO';
-- Resultado: fees = 5000.00

-- Mas o projeto foi negociado por R$ 4.500,00
SELECT name, total_actual_value FROM engineering_projects
WHERE id = '[project_id]';
-- Resultado: total_actual_value = 4500.00
```

**No extrato deve aparecer:** R$ 4.500,00 (valor negociado), não R$ 5.000,00

---

#### Como Testar

##### 1. Verificar Valor Negociado no Banco
```sql
-- Verificar que total_actual_value está preenchido
SELECT
  id,
  name,
  total_actual_value,
  grand_total
FROM engineering_projects
WHERE customer_id = '[id_cliente]';
```

**Resultado esperado:**
```
name                  | total_actual_value | grand_total
---------------------|-------------------|------------
Projeto A            | 4500.00           | 6800.00
```

##### 2. Comparar com Template
```sql
-- Comparar valor negociado vs valor do template
SELECT
  ep.name as projeto,
  est.name as servico,
  est.fees as valor_template,
  ep.total_actual_value as valor_negociado,
  (ep.total_actual_value - est.fees) as diferenca
FROM engineering_projects ep
JOIN engineering_service_templates est ON ep.template_id = est.id
WHERE ep.customer_id = '[id_cliente]';
```

**Resultado esperado:**
```
projeto   | servico              | valor_template | valor_negociado | diferenca
----------|---------------------|----------------|-----------------|----------
Projeto A | GEORREFERENCIAMENTO | 5000.00        | 4500.00         | -500.00
```

##### 3. Testar Interface Web
```
1. Acesse: Módulo Engenharia → Extrato do Cliente
2. Selecione cliente
3. Verificar:
   ✅ Não aparece tabela "Projetos do Cliente"
   ✅ Aparece apenas "Discriminação de Valores por Projeto"
   ✅ Primeira linha mostra "• Valor Negociado: R$ 4.500,00"
   ✅ Não aparece mais "Honorários do Serviço"
```

##### 4. Testar PDF
```
1. Clicar em "Exportar PDF"
2. Abrir o PDF
3. Verificar:
   ✅ Não aparece tabela de projetos
   ✅ Aparece "Discriminação de Valores por Projeto"
   ✅ Primeira linha: "• Valor Negociado: R$ 4.500,00"
```

---

#### Popular total_actual_value (se necessário)

Se `total_actual_value` estiver NULL em algum projeto:

```sql
-- Opção 1: Usar valor do template como base
UPDATE engineering_projects ep
SET total_actual_value = (
  SELECT fees
  FROM engineering_service_templates est
  WHERE est.id = ep.template_id
)
WHERE total_actual_value IS NULL;

-- Opção 2: Calcular baseado em grand_total - custos adicionais
UPDATE engineering_projects ep
SET total_actual_value = ep.grand_total - COALESCE((
  SELECT SUM(value)
  FROM engineering_project_costs epc
  WHERE epc.project_id = ep.id
), 0)
WHERE total_actual_value IS NULL;

-- Opção 3: Atualizar projeto específico
UPDATE engineering_projects
SET total_actual_value = 4500.00
WHERE id = '[project_id]';
```

---

#### Arquivos Modificados (Segunda Atualização)

| Arquivo | Linhas | Alterações |
|---------|--------|-----------|
| `src/components/EngineeringClientStatement.tsx` | 158 | Adicionado `total_actual_value` na query |
| | 185 | Alterado para usar `total_actual_value` |
| | 376-393 | Removida tabela de projetos do PDF |
| | 401 | Alterado texto para "Valor Negociado" (PDF) |
| | 678-741 | Removida tabela de projetos da interface |
| | 700 | Alterado texto para "Valor Negociado" (Web) |

---

#### Benefícios

##### 1. Interface Mais Limpa
- ✅ Menos redundância de informações
- ✅ Foco na discriminação detalhada
- ✅ PDF mais conciso e profissional
- ✅ Menos rolagem de tela

##### 2. Informação Mais Precisa
- ✅ Cliente vê o valor que foi acordado, não o valor padrão
- ✅ Transparência total nos valores negociados
- ✅ Diferenciação clara entre valor base e custos adicionais
- ✅ Cálculos corretos no extrato

##### 3. Melhor Experiência do Usuário
- ✅ Informação direta e objetiva
- ✅ Mais fácil de ler e entender
- ✅ Documento profissional

---

#### Build Final

```bash
npm run build
```

**Resultado:**
```
✓ built in 26.38s
✅ Build concluído sem erros
```

---

**Correções implementadas e testadas em 16/02/2026**

✅ Todas as funcionalidades operacionais
✅ Interface e PDF atualizados
✅ Valores corretos (negociados)
✅ Tabela redundante removida
✅ Build sem erros
✅ Pronto para produção
