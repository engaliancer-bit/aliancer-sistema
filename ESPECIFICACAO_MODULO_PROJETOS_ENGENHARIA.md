# Especificação Técnica - Módulo de Gestão de Projetos de Engenharia

## 1. Visão Geral

Sistema completo de gestão de projetos para escritório de engenharia e topografia, incluindo controle financeiro, gestão de custos e integração com estoque.

## 2. Arquitetura do Banco de Dados

### 2.1 Tabelas Principais

#### `engineering_projects`
Tabela central que armazena os projetos
```sql
- id (uuid, PK)
- project_name (text) - Nome do projeto
- customer_id (uuid, FK -> customers)
- property_id (uuid, FK -> properties)
- start_date (date) - Data de início
- estimated_completion_date (date) - Previsão de conclusão
- actual_completion_date (date, nullable) - Data real de conclusão
- status (enum: 'em_planejamento', 'em_andamento', 'concluido', 'cancelado')
- total_suggested_value (decimal) - Soma dos valores sugeridos
- total_actual_value (decimal) - Soma dos valores praticados
- total_additional_costs (decimal) - Soma dos custos adicionais
- total_concrete_markers (decimal) - Custo total dos marcos
- grand_total (decimal) - Valor total geral
- notes (text) - Observações
- created_at (timestamp)
- updated_at (timestamp)
```

#### `engineering_project_services`
Serviços vinculados ao projeto
```sql
- id (uuid, PK)
- project_id (uuid, FK -> engineering_projects)
- service_id (uuid, FK -> engineering_services)
- suggested_value (decimal) - Valor da tabela
- actual_value (decimal) - Valor praticado
- description (text) - Descrição adicional
- created_at (timestamp)
```

#### `engineering_project_costs`
Custos adicionais do projeto
```sql
- id (uuid, PK)
- project_id (uuid, FK -> engineering_projects)
- cost_type (enum: 'taxa', 'deslocamento', 'hospedagem', 'alimentacao', 'outros')
- description (text) - Descrição do custo
- value (decimal) - Valor do custo
- date (date) - Data do custo
- created_at (timestamp)
```

#### `engineering_project_markers`
Marcos de concreto utilizados no projeto
```sql
- id (uuid, PK)
- project_id (uuid, FK -> engineering_projects)
- product_id (uuid, FK -> products) - Marco de concreto
- quantity (integer) - Quantidade utilizada
- unit_price (decimal) - Preço unitário no momento
- total_price (decimal) - Quantidade × Preço
- created_at (timestamp)
```

#### `engineering_project_payments`
Recebimentos do projeto
```sql
- id (uuid, PK)
- project_id (uuid, FK -> engineering_projects)
- payment_date (date) - Data do recebimento
- value (decimal) - Valor recebido
- payment_method (enum: 'dinheiro', 'pix', 'transferencia', 'cheque', 'cartao')
- account_id (uuid, FK -> contas_caixa, nullable)
- notes (text) - Observações
- created_at (timestamp)
```

## 3. Regras de Negócio

### 3.1 Criação de Projeto
1. Cliente deve estar cadastrado
2. Imóvel deve pertencer ao cliente selecionado
3. Pelo menos um serviço deve ser adicionado
4. Valores sugeridos são preenchidos automaticamente da tabela de serviços
5. Valores praticados iniciam iguais aos sugeridos (podem ser editados)

### 3.2 Cálculos Automáticos
```
total_suggested_value = SUM(services.suggested_value)
total_actual_value = SUM(services.actual_value)
total_additional_costs = SUM(costs.value)
total_concrete_markers = SUM(markers.total_price)
grand_total = total_actual_value + total_additional_costs + total_concrete_markers
```

### 3.3 Integração com Estoque
1. Ao adicionar marcos de concreto:
   - Verificar disponibilidade no estoque
   - Registrar movimentação de saída
   - Atualizar quantidade em estoque
   - Registrar preço unitário do momento
   - Calcular total automaticamente

2. Ao remover marcos:
   - Estornar movimentação
   - Devolver ao estoque

### 3.4 Controle Financeiro
1. Cada recebimento gera:
   - Entrada no fluxo de caixa geral
   - Atualização do saldo do projeto
   - Registro na conta caixa selecionada

2. Saldo atual = SUM(payments) - grand_total

### 3.5 Integração com Fluxo de Caixa
```
Ao registrar pagamento:
1. Criar entrada em cash_flow:
   - type = 'entrada'
   - category = 'Serviços de Engenharia'
   - reference_id = project_id
   - reference_type = 'engineering_project'
   - value = payment_value
   - date = payment_date
   - account_id = selected_account

2. Se conta_caixa selecionada:
   - Atualizar saldo da conta
```

## 4. Interface do Usuário

### 4.1 Tela Principal - Lista de Projetos
```
┌─────────────────────────────────────────────────────────┐
│ Projetos em Andamento          [+ Iniciar Novo Projeto] │
├─────────────────────────────────────────────────────────┤
│ Filtros: [Cliente ▼] [Status ▼] [Período ▼]           │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Card do Projeto 1                                       │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📋 Levantamento Topográfico - Fazenda Santa Maria   │ │
│ │ Cliente: João da Silva                              │ │
│ │ Status: 🟢 Em Andamento                             │ │
│ │ Início: 15/01/2026                                  │ │
│ │                                                      │ │
│ │ Financeiro:                                         │ │
│ │ Total: R$ 12.500,00                                │ │
│ │ Recebido: R$ 5.000,00                              │ │
│ │ Saldo: R$ 7.500,00                                 │ │
│ │                                                      │ │
│ │ [Ver Extrato] [Registrar Pagamento] [Editar]       │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Modal - Criar Novo Projeto
```
┌─────────────────────────────────────────────────────────┐
│ Iniciar Novo Projeto                              [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Nome do Projeto *                                       │
│ [_____________________________________________]         │
│                                                          │
│ Cliente *                                               │
│ [Selecione um cliente                          ▼]      │
│                                                          │
│ Imóvel *                                                │
│ [Selecione um imóvel                           ▼]      │
│                                                          │
│ Data de Início *        Previsão de Conclusão          │
│ [__/__/____]            [__/__/____]                   │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Serviços                         [+ Adicionar]      │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ Serviço              | Sugerido  | Praticado | [✕] │ │
│ │ Levantamento Topo.   | 4.500,00  | 4.500,00  | [✕] │ │
│ │ Projeto Executivo    | 6.000,00  | 5.500,00  | [✕] │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Custos Adicionais                [+ Adicionar]      │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ Tipo         | Descrição      | Valor      | [✕]   │ │
│ │ Deslocamento | Viagem ao local| 300,00     | [✕]   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Marcos de Concreto               [+ Adicionar]      │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ Produto      | Qtd | Unit. | Total    | Estoque [✕]│ │
│ │ Marco Padrão | 4   | 85,00 | 340,00   | 50 un  [✕]│ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Resumo Financeiro                                   │ │
│ │ Total Serviços:         R$ 10.000,00               │ │
│ │ Custos Adicionais:      R$    300,00               │ │
│ │ Marcos de Concreto:     R$    340,00               │ │
│ │ ─────────────────────────────────────              │ │
│ │ TOTAL GERAL:            R$ 10.640,00               │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│                        [Cancelar] [Salvar Projeto]      │
└─────────────────────────────────────────────────────────┘
```

### 4.3 Modal - Extrato Financeiro
```
┌─────────────────────────────────────────────────────────┐
│ Extrato Financeiro - Projeto #1234                [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Cliente: João da Silva                                  │
│ Imóvel: Fazenda Santa Maria                            │
│ Status: Em Andamento                                    │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ SERVIÇOS CONTRATADOS                                │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ Levantamento Topográfico                            │ │
│ │ Valor Sugerido: R$ 4.500,00                        │ │
│ │ Valor Praticado: R$ 4.500,00                       │ │
│ │                                                      │ │
│ │ Projeto Executivo                                   │ │
│ │ Valor Sugerido: R$ 6.000,00                        │ │
│ │ Valor Praticado: R$ 5.500,00                       │ │
│ │                                                      │ │
│ │ Subtotal Serviços: R$ 10.000,00                    │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ CUSTOS ADICIONAIS                                   │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ Deslocamento - Viagem ao local: R$ 300,00          │ │
│ │                                                      │ │
│ │ Subtotal Custos: R$ 300,00                         │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ MARCOS DE CONCRETO                                  │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ 4x Marco Padrão @ R$ 85,00: R$ 340,00              │ │
│ │                                                      │ │
│ │ Subtotal Marcos: R$ 340,00                         │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ RECEBIMENTOS                                        │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ 15/01/2026 - PIX: R$ 5.000,00                      │ │
│ │                                                      │ │
│ │ Total Recebido: R$ 5.000,00                        │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ RESUMO FINANCEIRO                                   │ │
│ │ Total do Projeto:    R$ 10.640,00                  │ │
│ │ Total Recebido:      R$  5.000,00                  │ │
│ │ ─────────────────────────────────                  │ │
│ │ Saldo a Receber:     R$  5.640,00 🔴               │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│                 [Imprimir] [Exportar PDF] [Fechar]      │
└─────────────────────────────────────────────────────────┘
```

### 4.4 Modal - Registrar Pagamento
```
┌─────────────────────────────────────────────────────────┐
│ Registrar Pagamento                               [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Projeto: Levantamento Topográfico                      │
│ Cliente: João da Silva                                  │
│                                                          │
│ Saldo a Receber: R$ 5.640,00                           │
│                                                          │
│ Data do Recebimento *                                   │
│ [__/__/____]                                           │
│                                                          │
│ Valor Recebido *                                        │
│ [R$ _____________]                                      │
│                                                          │
│ Forma de Pagamento *                                    │
│ ○ Dinheiro  ○ PIX  ○ Transferência                    │
│ ○ Cheque    ○ Cartão                                   │
│                                                          │
│ Conta Caixa *                                           │
│ [Selecione a conta                         ▼]          │
│                                                          │
│ Observações                                             │
│ [_____________________________________________]         │
│ [_____________________________________________]         │
│                                                          │
│                        [Cancelar] [Registrar]           │
└─────────────────────────────────────────────────────────┘
```

## 5. Fluxogramas de Processo

### 5.1 Criar Novo Projeto
```
[Início]
   ↓
[Selecionar Cliente]
   ↓
[Carregar Imóveis do Cliente]
   ↓
[Selecionar Imóvel]
   ↓
[Adicionar Serviços]
   ↓ (para cada serviço)
[Buscar Valor Sugerido]
   ↓
[Preencher Valor Praticado]
   ↓
[Adicionar Custos] (opcional)
   ↓
[Adicionar Marcos] (opcional)
   ↓ (se marcos)
[Verificar Estoque]
   ↓
[Calcular Totais]
   ↓
[Salvar Projeto]
   ↓
[Criar Movimentação Estoque] (se marcos)
   ↓
[Fim]
```

### 5.2 Registrar Pagamento
```
[Início]
   ↓
[Informar Valor]
   ↓
[Selecionar Forma Pagamento]
   ↓
[Selecionar Conta Caixa]
   ↓
[Salvar Pagamento]
   ↓
[Criar Entrada Fluxo Caixa]
   ↓
[Atualizar Saldo Conta]
   ↓
[Atualizar Saldo Projeto]
   ↓
[Fim]
```

### 5.3 Gerar Extrato
```
[Início]
   ↓
[Buscar Dados Projeto]
   ↓
[Buscar Serviços]
   ↓
[Buscar Custos]
   ↓
[Buscar Marcos]
   ↓
[Buscar Pagamentos]
   ↓
[Calcular Totais]
   ↓
[Calcular Saldo]
   ↓
[Exibir Extrato]
   ↓
[Opção Exportar?]
   ↓
[Gerar PDF] (se sim)
   ↓
[Fim]
```

## 6. Queries SQL Principais

### 6.1 Buscar Projetos com Totais
```sql
SELECT
  p.*,
  c.name as customer_name,
  pr.name as property_name,
  COALESCE(SUM(pay.value), 0) as total_received,
  (p.grand_total - COALESCE(SUM(pay.value), 0)) as balance
FROM engineering_projects p
LEFT JOIN customers c ON p.customer_id = c.id
LEFT JOIN properties pr ON p.property_id = pr.id
LEFT JOIN engineering_project_payments pay ON p.id = pay.project_id
WHERE p.status != 'cancelado'
GROUP BY p.id, c.name, pr.name
ORDER BY p.created_at DESC;
```

### 6.2 Extrato Completo do Projeto
```sql
-- Serviços
SELECT
  s.name,
  ps.suggested_value,
  ps.actual_value
FROM engineering_project_services ps
JOIN engineering_services s ON ps.service_id = s.id
WHERE ps.project_id = $1;

-- Custos
SELECT
  cost_type,
  description,
  value,
  date
FROM engineering_project_costs
WHERE project_id = $1
ORDER BY date;

-- Marcos
SELECT
  p.name,
  pm.quantity,
  pm.unit_price,
  pm.total_price
FROM engineering_project_markers pm
JOIN products p ON pm.product_id = p.id
WHERE pm.project_id = $1;

-- Pagamentos
SELECT
  payment_date,
  value,
  payment_method,
  notes
FROM engineering_project_payments
WHERE project_id = $1
ORDER BY payment_date DESC;
```

## 7. Validações e Restrições

### 7.1 Validações Frontend
- Nome do projeto: obrigatório, mínimo 3 caracteres
- Cliente: obrigatório
- Imóvel: obrigatório
- Pelo menos 1 serviço: obrigatório
- Valores: devem ser numéricos positivos
- Datas: data início <= data conclusão
- Quantidade marcos: deve ter em estoque

### 7.2 Validações Backend
- Cliente deve existir
- Imóvel deve pertencer ao cliente
- Serviço deve existir
- Produto (marco) deve existir e ter estoque suficiente
- Valor pagamento não pode exceder saldo devedor
- Conta caixa deve existir

### 7.3 Constraints Banco
- NOT NULL em campos obrigatórios
- CHECK constraints para valores positivos
- Foreign keys com ON DELETE RESTRICT
- Unique constraints onde apropriado

## 8. Integrações com Outros Módulos

### 8.1 Módulo de Clientes
- Busca lista de clientes
- Validação de cliente ativo

### 8.2 Módulo de Imóveis
- Busca imóveis por cliente
- Validação de imóvel ativo

### 8.3 Módulo de Serviços
- Busca serviços disponíveis
- Obtém valores sugeridos

### 8.4 Módulo de Estoque
- Verifica disponibilidade
- Registra movimentação de saída
- Atualiza quantidade

### 8.5 Módulo Fluxo de Caixa
- Registra entradas
- Atualiza saldos
- Integra com contas caixa

## 9. Relatórios e Exportações

### 9.1 Extrato do Projeto (PDF)
- Cabeçalho com logo da empresa
- Dados do cliente e imóvel
- Detalhamento de serviços
- Custos adicionais
- Marcos utilizados
- Histórico de pagamentos
- Resumo financeiro

### 9.2 Relatório de Projetos em Andamento
- Lista todos os projetos ativos
- Totais por status
- Valores a receber
- Alertas de atraso

### 9.3 Análise Financeira
- Receita por período
- Margem de contribuição
- Custos médios
- Prazo médio de recebimento

## 10. Melhorias Futuras

- Gestão de etapas do projeto
- Anexar documentos ao projeto
- Alertas de prazo de conclusão
- Dashboard analítico
- App mobile para campo
- Assinatura digital de contratos
- Integração com GPS para rastreamento
