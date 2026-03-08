# Guia de Uso - Extrato do Cliente (Projetos de Engenharia)

## Visão Geral

A nova aba **Extrato do Cliente** foi criada no módulo de Projetos de Engenharia para centralizar toda a movimentação financeira de um cliente específico, permitindo visualizar e gerenciar todos os seus projetos em um único local.

## Funcionalidades Implementadas

### 1. Seleção de Cliente
- Campo de busca inteligente por nome ou CPF
- Lista com sugestões em tempo real
- Exibição dos dados do cliente selecionado

### 2. Resumo Financeiro
Quatro cards com informações consolidadas:
- **Total de Projetos**: Quantidade de projetos do cliente
- **Valor Total**: Soma de todos os valores dos projetos
- **Total Recebido**: Soma de todos os recebimentos realizados
- **Saldo Devedor**: Valor total ainda pendente de recebimento

### 3. Lista de Projetos
Tabela completa com:
- Nome do projeto
- Imóvel vinculado
- Data de início
- Status atual (com cores diferenciadas)
- Valor total do projeto
- Valor já recebido
- Saldo devedor (destacado em vermelho quando > 0)

### 4. Histórico de Recebimentos
Tabela com todos os pagamentos realizados:
- Data do recebimento
- Projeto vinculado
- Forma de pagamento
- Conta de caixa utilizada
- Valor recebido
- Observações

### 5. Cadastro de Recebimentos
Modal para registrar novos recebimentos:
- Seleção do projeto do cliente
- Data do recebimento
- Valor
- Forma de pagamento (PIX, Dinheiro, Transferência, Cheque, Cartão)
- Conta de caixa destino
- Observações

**Importante**: Os recebimentos cadastrados aqui são automaticamente vinculados à aba financeiro do projeto correspondente.

### 6. Exportação em PDF
Gera um relatório completo em PDF contendo:
- Dados do cliente
- Resumo financeiro
- Tabela de todos os projetos
- Histórico completo de recebimentos

## Como Usar

### Acessar o Extrato do Cliente

1. Acesse o módulo **Projetos de Engenharia**
2. Clique na aba **Extrato do Cliente** (em roxo)

### Visualizar Extrato de um Cliente

1. Digite o nome ou CPF do cliente no campo de busca
2. Clique no cliente desejado na lista de sugestões
3. O sistema carregará automaticamente:
   - Todos os projetos do cliente
   - Resumo financeiro consolidado
   - Histórico de recebimentos

### Cadastrar um Recebimento

1. Selecione o cliente no extrato
2. Clique no botão **Cadastrar Recebimento** (verde)
3. Preencha os dados:
   - **Projeto**: Selecione o projeto que está recebendo o pagamento
   - **Data**: Data do recebimento
   - **Valor**: Valor recebido
   - **Forma de Pagamento**: Escolha entre PIX, Dinheiro, Transferência, Cheque ou Cartão
   - **Conta de Caixa**: Selecione a conta onde o valor será depositado
   - **Observações**: Informações adicionais (opcional)
4. Clique em **Cadastrar Recebimento**

O sistema irá:
- Registrar o pagamento no projeto
- Atualizar o saldo devedor
- Criar movimentação no fluxo de caixa
- Atualizar os totais automaticamente

### Exportar Relatório em PDF

1. Selecione o cliente no extrato
2. Clique no botão **Exportar PDF** (azul)
3. O PDF será gerado e baixado automaticamente

O relatório incluirá:
- Cabeçalho com dados do cliente
- Resumo financeiro completo
- Tabela detalhada de projetos
- Histórico de todos os recebimentos

## Vantagens da Nova Funcionalidade

### Para Gestão Financeira
- **Visão Consolidada**: Veja todos os projetos de um cliente em um só lugar
- **Controle de Inadimplência**: Identifique rapidamente clientes com saldo devedor
- **Histórico Completo**: Acesse todo o histórico de pagamentos do cliente

### Para Atendimento ao Cliente
- **Transparência**: Gere relatórios completos para enviar ao cliente
- **Agilidade**: Consulte rapidamente o status financeiro do cliente
- **Comprovantes**: Histórico detalhado de todos os recebimentos

### Para Cobrança
- **Priorização**: Identifique clientes com maior saldo devedor
- **Múltiplos Projetos**: Gerencie clientes com diversos projetos simultaneamente
- **Facilidade**: Cadastre recebimentos diretamente no extrato

## Integração com Outros Módulos

### Projetos de Engenharia
- Os recebimentos cadastrados no extrato aparecem na aba **Financeiro** do projeto
- Os valores são atualizados automaticamente em ambos os locais
- Alterações nos projetos refletem imediatamente no extrato

### Fluxo de Caixa
- Cada recebimento gera uma entrada no fluxo de caixa
- Categoria: "Receita"
- Vinculado à conta de caixa selecionada
- Sincronização automática bidirecional

### Aba "A Cobrar"
- Projetos com saldo devedor aparecem tanto no extrato quanto na aba "A Cobrar"
- As informações são sempre consistentes
- Permite diferentes visões para diferentes necessidades

## Exemplo de Uso Prático

### Cenário
Cliente João Silva possui:
- Projeto 1: CAR Novo - R$ 380,00
- Projeto 2: Georreferenciamento - R$ 5.000,00

### Passo a Passo

1. **Consultar Extrato**
   - Busque por "João Silva"
   - Veja que ele tem R$ 5.380,00 em projetos
   - Verifique quanto já foi pago e quanto está pendente

2. **Registrar Recebimento**
   - Cliente pagou R$ 380,00 do projeto CAR
   - Cadastre o recebimento no extrato
   - Sistema atualiza automaticamente:
     - Saldo do Projeto 1: R$ 0,00
     - Total Recebido: R$ 380,00
     - Saldo Devedor Total: R$ 5.000,00

3. **Gerar Comprovante**
   - Exporte o PDF do extrato
   - Envie ao cliente como comprovante
   - Arquivo mostra todos os projetos e pagamentos

## Dicas de Uso

1. **Organização por Cliente**
   - Use o extrato quando o cliente tiver múltiplos projetos
   - Facilita a visualização do relacionamento completo

2. **Cobrança Eficiente**
   - Filtre clientes com maior saldo devedor
   - Gere relatórios periódicos para envio
   - Acompanhe o histórico de pagamentos

3. **Atendimento Rápido**
   - Durante ligações, acesse rapidamente o extrato
   - Informe valores e status sem navegar entre projetos
   - Cadastre recebimentos durante a conversa

4. **Relatórios para Cliente**
   - Gere PDFs mensais ou por solicitação
   - Use como prestação de contas
   - Mantenha transparência no relacionamento

## Observações Importantes

- Os dados são sempre em tempo real
- Alterações feitas na aba "Financeiro" do projeto aparecem no extrato
- Alterações feitas no extrato aparecem na aba "Financeiro" do projeto
- Todos os recebimentos geram movimentação no fluxo de caixa
- Os PDFs podem ser gerados quantas vezes necessário

## Suporte

Em caso de dúvidas ou problemas:
1. Verifique se o cliente está corretamente selecionado
2. Confirme que os projetos estão vinculados ao cliente correto
3. Verifique as permissões de acesso ao módulo
4. Consulte os logs do sistema para erros específicos
