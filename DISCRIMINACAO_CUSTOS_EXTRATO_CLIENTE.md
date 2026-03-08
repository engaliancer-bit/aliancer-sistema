# Discriminação de Custos Adicionais no Extrato do Cliente

## Resumo da Implementação

Foi implementada a discriminação detalhada de custos adicionais no Extrato do Cliente, tornando mais transparente os valores que compõem o saldo total de cada projeto.

---

## Funcionalidade Implementada

### O que foi adicionado:

1. **Carregamento de Custos Adicionais**
   - Query automática para buscar todos os custos adicionais vinculados aos projetos do cliente
   - Dados organizados por projeto para fácil visualização

2. **Interface Web - Nova Seção**
   - Seção "Discriminação de Valores por Projeto" entre a tabela de projetos e o histórico de recebimentos
   - Cada projeto mostra:
     - Nome do serviço e imóvel
     - Status do projeto
     - Honorários do serviço (fees do template)
     - Todos os custos adicionais discriminados (tipo + descrição + valor)
     - Total do projeto
     - Total recebido
     - Saldo a receber (se houver)

3. **PDF - Nova Seção Detalhada**
   - Seção "Discriminação de Valores por Projeto" após a tabela de projetos
   - Para cada projeto:
     - Cabeçalho com nome do serviço e imóvel (em azul)
     - Lista de custos com marcadores:
       - • Honorários do Serviço: R$ X,XX
       - • [Tipo]: [Descrição]: R$ X,XX
     - TOTAL DO PROJETO em negrito
     - Linha separadora entre projetos

---

## Estrutura de Dados

### Interface AdditionalCost
```typescript
interface AdditionalCost {
  id: string;
  project_id: string;
  cost_type: string;        // material, labor, equipment, service, travel, other
  description: string;      // Descrição detalhada
  value: number;           // Valor do custo
  date: string;            // Data do custo
}
```

### Interface ProjectSummary (Atualizada)
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
  service_description: string;
  service_fees: number;              // NOVO: Honorários do template
  additional_costs: AdditionalCost[]; // NOVO: Array de custos adicionais
}
```

---

## Tipos de Custo Suportados

| cost_type  | Label                  |
|------------|------------------------|
| material   | Material               |
| labor      | Mão de Obra           |
| equipment  | Equipamento           |
| service    | Serviço               |
| travel     | Viagem/Deslocamento   |
| other      | Outros                |

---

## Exemplo de Visualização

### Interface Web

```
┌─────────────────────────────────────────────────────────────┐
│ Discriminação de Valores por Projeto                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ GEORREFERENCIAMENTO DE IMÓVEL RURAL - Fazenda Santa Clara   │
│ Status: [Em Desenvolvimento]                                 │
│                                                              │
│ ┌───────────────────────────────────────────────────────┐  │
│ │ • Honorários do Serviço:              R$ 5.000,00     │  │
│ │ • Material: GPS Geodésico             R$ 1.200,00     │  │
│ │ • Viagem/Deslocamento: Visita técnica R$ 300,00       │  │
│ │ • Serviço: Topografia                 R$ 800,00       │  │
│ │ ─────────────────────────────────────────────────────  │  │
│ │ TOTAL DO PROJETO:                     R$ 7.300,00     │  │
│ │ Total Recebido:                       R$ 3.000,00     │  │
│ │ Saldo a Receber:                      R$ 4.300,00     │  │
│ └───────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### PDF

```
Discriminação de Valores por Projeto
─────────────────────────────────────

GEORREFERENCIAMENTO DE IMÓVEL RURAL - Fazenda Santa Clara

• Honorários do Serviço:                                   R$ 5.000,00
• Material: GPS Geodésico                                  R$ 1.200,00
• Viagem/Deslocamento: Visita técnica                      R$ 300,00
• Serviço: Topografia                                      R$ 800,00

TOTAL DO PROJETO:                                          R$ 7.300,00
─────────────────────────────────────────────────────────────────────

[Próximo projeto...]
```

---

## Alterações no Código

### 1. Novas Interfaces (Linha 27-48)

```typescript
interface AdditionalCost {
  id: string;
  project_id: string;
  cost_type: string;
  description: string;
  value: number;
  date: string;
}

interface ProjectSummary {
  // ... campos existentes
  service_fees: number;              // NOVO
  additional_costs: AdditionalCost[]; // NOVO
}
```

### 2. Carregamento de Dados (Linha 147-201)

**Query de Projetos Atualizada:**
```typescript
.select(`
  id,
  name,
  start_date,
  status,
  grand_total,
  total_received,
  balance,
  property:property_id (name),
  template:template_id (name, fees)  // Incluindo fees
`)
```

**Query de Custos Adicionais:**
```typescript
const { data: costsData, error: costsError } = await supabase
  .from('engineering_project_costs')
  .select('*')
  .in('project_id', projectIds)
  .order('date', { ascending: true });
```

**Mapeamento dos Dados:**
```typescript
const formattedProjects = (projectsData || []).map((p: any) => {
  const projectCosts = additionalCostsData.filter((c: any) => c.project_id === p.id);
  const serviceFees = p.template?.fees || 0;

  return {
    // ... outros campos
    service_fees: serviceFees,
    additional_costs: projectCosts
  };
});
```

### 3. Função getCostTypeLabel (Linha 447-457)

```typescript
const getCostTypeLabel = (costType: string): string => {
  const labels: Record<string, string> = {
    'material': 'Material',
    'labor': 'Mão de Obra',
    'equipment': 'Equipamento',
    'service': 'Serviço',
    'travel': 'Viagem/Deslocamento',
    'other': 'Outros'
  };
  return labels[costType] || costType;
};
```

### 4. Seção no PDF (Linha 394-445)

```typescript
// Discriminação de Custos por Projeto
doc.text('Discriminação de Valores por Projeto', 14, currentY);

projects.forEach((project, index) => {
  // Título do projeto
  doc.text(`${project.service_description} - ${project.property_name}`, 14, currentY);

  // Honorários do serviço
  doc.text(`• Honorários do Serviço:`, 18, currentY);
  doc.text(`R$ ${project.service_fees.toFixed(2)}`, 140, currentY, { align: 'right' });

  // Custos adicionais
  project.additional_costs.forEach((cost: AdditionalCost) => {
    const costLabel = `• ${getCostTypeLabel(cost.cost_type)}: ${cost.description}`;
    doc.text(costLabel, 18, currentY);
    doc.text(`R$ ${cost.value.toFixed(2)}`, 140, currentY, { align: 'right' });
  });

  // Total do projeto
  doc.text('TOTAL DO PROJETO:', 18, currentY);
  doc.text(`R$ ${project.grand_total.toFixed(2)}`, 140, currentY, { align: 'right' });
});
```

### 5. Seção na Interface Web (Linha 762-830)

```typescript
{/* Discriminação de Custos por Projeto */}
<div className="bg-white rounded-lg shadow-sm border border-gray-200">
  <div className="p-4 border-b border-gray-200">
    <h3 className="text-lg font-semibold text-gray-800">
      Discriminação de Valores por Projeto
    </h3>
  </div>
  <div className="p-6 space-y-6">
    {projects.map(project => (
      <div key={project.id} className="border-b border-gray-200 pb-6">
        {/* Cabeçalho do projeto */}
        <h4 className="text-base font-semibold text-blue-600">
          {project.service_description} - {project.property_name}
        </h4>

        <div className="space-y-2 bg-gray-50 p-4 rounded-lg">
          {/* Honorários do serviço */}
          <div className="flex justify-between">
            <span>• Honorários do Serviço:</span>
            <span>R$ {project.service_fees.toFixed(2)}</span>
          </div>

          {/* Custos adicionais */}
          {project.additional_costs.map((cost: AdditionalCost) => (
            <div key={cost.id} className="flex justify-between">
              <span>• {getCostTypeLabel(cost.cost_type)}: {cost.description}</span>
              <span>R$ {cost.value.toFixed(2)}</span>
            </div>
          ))}

          {/* Total, Recebido e Saldo */}
          <div className="flex justify-between pt-2 border-t">
            <span className="font-bold">TOTAL DO PROJETO:</span>
            <span className="font-bold text-blue-600">R$ {project.grand_total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    ))}
  </div>
</div>
```

---

## Como Testar

### 1. Criar Projeto com Custos Adicionais

```sql
-- Inserir projeto
INSERT INTO engineering_projects (
  customer_id,
  template_id,
  property_id,
  name,
  start_date,
  status,
  grand_total
) VALUES (
  '[customer_id]',
  '[template_id]',
  '[property_id]',
  'Georreferenciamento Fazenda',
  '2026-01-15',
  'em_desenvolvimento',
  7300.00
);

-- Inserir custos adicionais
INSERT INTO engineering_project_costs (project_id, cost_type, description, value, date) VALUES
('[project_id]', 'material', 'GPS Geodésico', 1200.00, '2026-01-16'),
('[project_id]', 'travel', 'Visita técnica ao imóvel', 300.00, '2026-01-17'),
('[project_id]', 'service', 'Serviço de topografia', 800.00, '2026-01-18');
```

### 2. Verificar na Interface Web

```
1. Acesse: Módulo Engenharia → Extrato do Cliente
2. Selecione o cliente
3. Verifique a seção "Discriminação de Valores por Projeto"
4. Confirme que mostra:
   ✓ Honorários do serviço
   ✓ Todos os custos adicionais com tipo e descrição
   ✓ Total do projeto
   ✓ Total recebido
   ✓ Saldo a receber
```

### 3. Verificar no PDF

```
1. Clique em "Exportar PDF"
2. Abra o PDF
3. Localize a seção "Discriminação de Valores por Projeto"
4. Confirme que cada projeto mostra:
   ✓ Nome do serviço e imóvel
   ✓ Honorários em linha separada
   ✓ Cada custo adicional em linha separada
   ✓ Total do projeto em negrito
   ✓ Linha separadora entre projetos
```

### 4. Query de Verificação

```sql
-- Verificar projeto com custos
SELECT
  ep.id,
  ep.name as projeto,
  est.name as servico,
  est.fees as honorarios,
  ep.grand_total,
  COUNT(epc.id) as qtd_custos_adicionais,
  COALESCE(SUM(epc.value), 0) as total_custos_adicionais
FROM engineering_projects ep
LEFT JOIN engineering_service_templates est ON ep.template_id = est.id
LEFT JOIN engineering_project_costs epc ON ep.project_id = epc.project_id
WHERE ep.customer_id = '[customer_id]'
GROUP BY ep.id, ep.name, est.name, est.fees, ep.grand_total;
```

**Resultado esperado:**
```
projeto                        | servico              | honorarios | grand_total | qtd_custos | total_custos
-------------------------------|---------------------|------------|-------------|------------|-------------
Georreferenciamento Fazenda    | GEORREFERENCIAMENTO | 5000.00    | 7300.00     | 3          | 2300.00
```

---

## Benefícios da Implementação

### 1. Transparência Total
- Cliente vê exatamente o que está pagando
- Discriminação clara de honorários vs custos adicionais
- Cada custo adicional identificado por tipo e descrição

### 2. Organização Visual
- Interface limpa e organizada
- Cores diferentes para cada tipo de valor
- Agrupamento por projeto facilita a compreensão

### 3. PDF Profissional
- Documento formal com todos os detalhes
- Fácil impressão e envio ao cliente
- Layout organizado e legível

### 4. Auditoria Facilitada
- Fácil rastreamento de custos
- Histórico completo de valores
- Soma automática de todos os componentes

---

## Exemplos Práticos

### Exemplo 1: Projeto com Apenas Honorários

**Interface Web:**
```
GEORREFERENCIAMENTO DE IMÓVEL RURAL - Chácara Vista Alegre
Status: [Finalizado]

┌────────────────────────────────────────┐
│ • Honorários do Serviço: R$ 3.500,00  │
│ ──────────────────────────────────────  │
│ TOTAL DO PROJETO:        R$ 3.500,00  │
│ Total Recebido:          R$ 3.500,00  │
└────────────────────────────────────────┘
```

### Exemplo 2: Projeto com Vários Custos Adicionais

**Interface Web:**
```
LICENCIAMENTO AMBIENTAL - Fazenda Boa Vista
Status: [Em Desenvolvimento]

┌──────────────────────────────────────────────────┐
│ • Honorários do Serviço:              R$ 8.000,00│
│ • Material: Equipamento de medição    R$ 2.500,00│
│ • Material: Materiais de coleta       R$ 450,00  │
│ • Viagem/Deslocamento: 3 visitas      R$ 900,00  │
│ • Serviço: Análises laboratoriais     R$ 1.800,00│
│ • Serviço: Consultoria especializada  R$ 3.000,00│
│ ────────────────────────────────────────────────  │
│ TOTAL DO PROJETO:                    R$ 16.650,00│
│ Total Recebido:                       R$ 8.000,00│
│ Saldo a Receber:                      R$ 8.650,00│
└──────────────────────────────────────────────────┘
```

### Exemplo 3: Múltiplos Projetos no PDF

```
Discriminação de Valores por Projeto
─────────────────────────────────────

GEORREFERENCIAMENTO DE IMÓVEL RURAL - Chácara Vista Alegre

• Honorários do Serviço:                           R$ 3.500,00

TOTAL DO PROJETO:                                  R$ 3.500,00
─────────────────────────────────────────────────────────────

LICENCIAMENTO AMBIENTAL - Fazenda Boa Vista

• Honorários do Serviço:                           R$ 8.000,00
• Material: Equipamento de medição                 R$ 2.500,00
• Material: Materiais de coleta                    R$ 450,00
• Viagem/Deslocamento: 3 visitas técnicas          R$ 900,00
• Serviço: Análises laboratoriais                  R$ 1.800,00
• Serviço: Consultoria especializada               R$ 3.000,00

TOTAL DO PROJETO:                                 R$ 16.650,00
─────────────────────────────────────────────────────────────
```

---

## Arquivo Modificado

| Arquivo | Linhas | Alterações |
|---------|--------|-----------|
| `src/components/EngineeringClientStatement.tsx` | 27-34 | Adicionada interface `AdditionalCost` |
| | 36-48 | Atualizada interface `ProjectSummary` |
| | 147-201 | Carregamento de custos adicionais |
| | 394-445 | Seção de discriminação no PDF |
| | 447-457 | Função `getCostTypeLabel` |
| | 762-830 | Seção de discriminação na interface web |

---

## Build

```bash
npm run build
```

**Resultado:**
```
✓ built in 20.99s
✅ Build concluído sem erros
```

---

## Impacto

### Antes
- Apenas valor total do projeto visível
- Sem discriminação de custos
- Cliente não sabia composição do valor

### Depois
- ✅ Transparência total de custos
- ✅ Discriminação completa (honorários + custos adicionais)
- ✅ Cada custo adicional identificado por tipo e descrição
- ✅ Interface web organizada e clara
- ✅ PDF profissional com todos os detalhes
- ✅ Facilita auditoria e prestação de contas

---

**Implementação concluída em 16/02/2026**

✅ Interface web atualizada
✅ PDF com discriminação completa
✅ Build sem erros
✅ Documentação completa
