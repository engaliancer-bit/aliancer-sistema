# Módulo de Pagamentos de Projetos de Engenharia

## Correções Implementadas

### 1. Colunas Faltantes no Banco de Dados

Foram adicionadas as seguintes colunas na tabela `engineering_projects`:
- `project_name` - Nome do projeto (sincronizado automaticamente com `name`)
- `grand_total` - Valor total do projeto (sincronizado automaticamente com `total_value`)
- `total_actual_value` - Valor total dos serviços
- `total_additional_costs` - Custos adicionais
- `total_concrete_markers` - Valor dos marcos de concreto
- `total_received` - Total de pagamentos recebidos
- `balance` - Saldo pendente (calculado automaticamente)

### 2. Triggers Automáticos

Foram criados triggers que:
- Sincronizam automaticamente `project_name` com `name`
- Sincronizam automaticamente `grand_total` com `total_value`
- Calculam automaticamente o saldo (`balance = grand_total - total_received`)
- Atualizam o `total_received` quando pagamentos são inseridos/atualizados/deletados
- Registram automaticamente entradas no fluxo de caixa quando pagamentos são feitos
- Removem automaticamente entradas do fluxo de caixa quando pagamentos são excluídos

## Novas Funcionalidades

### 1. Sistema de Pagamentos

Nova tabela `engineering_project_payments` criada com:
- Registro de pagamentos recebidos
- Integração automática com fluxo de caixa
- Métodos de pagamento suportados:
  - Dinheiro
  - PIX
  - Transferência
  - Cartão de Crédito
  - Cartão de Débito
  - Cheque
  - Boleto
- Vinculação com contas de caixa
- Campo de observações
- Data do pagamento

### 2. Tela de Gestão de Pagamentos

Novo componente `EngineeringProjectPayments` com:

#### Resumo Financeiro
- Valor total do projeto
- Total recebido
- Saldo pendente
- Indicadores visuais coloridos

#### Cadastro de Pagamentos
- Formulário completo para adicionar novos pagamentos
- Validação de campos obrigatórios
- Seleção de conta de caixa
- Seleção de método de pagamento
- Campo de observações

#### Histórico de Pagamentos
- Lista completa de todos os pagamentos recebidos
- Informações detalhadas de cada pagamento
- Opção de excluir pagamentos
- Ordenação por data (mais recentes primeiro)

#### Extrato para Cliente
- Exportação de extrato em PDF
- Contém:
  - Nome do projeto, cliente e propriedade
  - Resumo financeiro completo
  - Histórico detalhado de pagamentos
  - Data de geração do extrato
- Formatação profissional
- Pronto para enviar ao cliente

### 3. Integração com Fluxo de Caixa

Todos os pagamentos de projetos são automaticamente:
- Registrados como entradas no fluxo de caixa
- Categorizados como "Recebimento de Projeto"
- Vinculados à conta de caixa selecionada
- Referenciados ao pagamento original (para rastreabilidade)
- Removidos do fluxo de caixa se o pagamento for excluído

## Como Usar

### Acessar Pagamentos de um Projeto

1. Entre no módulo "Projetos de Engenharia"
2. Localize o projeto desejado na lista
3. Clique no botão "Receber" (disponível quando há saldo pendente)
4. Ou clique em "Extrato" para ver detalhes e acessar pagamentos

### Cadastrar um Novo Pagamento

1. Na tela de pagamentos do projeto
2. Clique em "Adicionar Pagamento"
3. Preencha:
   - Data do pagamento
   - Valor recebido
   - Método de pagamento
   - Conta de caixa (obrigatório)
   - Observações (opcional)
4. Clique em "Salvar Pagamento"
5. O saldo será atualizado automaticamente
6. Uma entrada será criada no fluxo de caixa

### Excluir um Pagamento

1. Na lista de pagamentos
2. Clique no ícone da lixeira ao lado do pagamento
3. Confirme a exclusão
4. O saldo será atualizado automaticamente
5. A entrada do fluxo de caixa será removida

### Exportar Extrato para Cliente

1. Na tela de pagamentos do projeto
2. Clique em "Exportar Extrato (PDF)"
3. O arquivo PDF será baixado automaticamente
4. O extrato contém todas as informações financeiras do projeto
5. Pronto para enviar ao cliente

## Segurança e Integridade

- Todas as operações são transacionais
- Validações impedem valores negativos ou inválidos
- Conta de caixa é obrigatória para rastreabilidade
- Histórico completo de pagamentos mantido
- Integração automática com fluxo de caixa garante consistência
- RLS habilitado para segurança dos dados

## Observações Importantes

- O saldo é calculado automaticamente: `Saldo = Valor Total - Total Recebido`
- Ao excluir um pagamento, tanto o registro quanto a entrada no fluxo de caixa são removidos
- É possível fazer pagamentos parciais
- Não há limite para a quantidade de pagamentos por projeto
- Todos os valores são armazenados em formato numérico para precisão
- Datas são armazenadas e exibidas no formato brasileiro (dd/mm/aaaa)
