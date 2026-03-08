# Guia de Teste - Pagamentos de Projetos de Engenharia

## Teste Rápido

### 1. Criar um Novo Projeto
1. Acesse "Projetos de Engenharia" no menu
2. Clique em "Novo Projeto"
3. Preencha os dados:
   - Nome do projeto
   - Cliente
   - Propriedade
   - Data de início
   - Adicione pelo menos um serviço
4. Clique em "Criar Projeto"
5. Verifique se o projeto aparece na lista com o valor total correto

### 2. Registrar um Pagamento
1. Localize o projeto criado na lista
2. Observe o card mostrando:
   - Total: R$ X,XX
   - Recebido: R$ 0,00
   - Saldo: R$ X,XX (em vermelho)
3. Clique no botão "Receber" (botão verde)
4. Na tela de pagamentos:
   - Veja o resumo financeiro em cards coloridos
   - Clique em "Adicionar Pagamento"
5. Preencha o formulário:
   - Data: data de hoje
   - Valor: metade do valor total (para testar pagamento parcial)
   - Método: PIX
   - Conta: selecione uma conta de caixa
   - Observações: "Primeira parcela"
6. Clique em "Salvar Pagamento"
7. Verifique se:
   - O pagamento aparece na lista
   - O saldo foi atualizado
   - Os cards mostram os valores corretos

### 3. Verificar Fluxo de Caixa
1. Volte ao menu principal
2. Acesse "Fluxo de Caixa"
3. Verifique se aparece uma entrada de "Recebimento de Projeto"
4. Confirme se o valor está correto
5. Confirme se está na conta de caixa selecionada

### 4. Adicionar Mais Pagamentos
1. Volte para "Projetos de Engenharia"
2. Clique novamente em "Receber" no projeto
3. Adicione mais um pagamento com:
   - Valor: restante do saldo
   - Método: Transferência
   - Outra conta de caixa (se disponível)
   - Observações: "Quitação"
4. Verifique se o saldo agora é R$ 0,00
5. Observe que o botão "Receber" não aparece mais (pois não há saldo)

### 5. Exportar Extrato para Cliente
1. Clique em "Extrato" no projeto
2. Na tela de pagamentos, clique em "Exportar Extrato (PDF)"
3. Verifique o PDF baixado:
   - Cabeçalho com nome do projeto, cliente e propriedade
   - Resumo financeiro (total, recebido, saldo)
   - Tabela com histórico de pagamentos
   - Formatação profissional
4. Confirme se todas as informações estão corretas

### 6. Excluir um Pagamento
1. Na tela de pagamentos
2. Clique no ícone da lixeira em um dos pagamentos
3. Confirme a exclusão
4. Verifique se:
   - O pagamento foi removido da lista
   - O saldo foi recalculado
   - O total recebido foi atualizado
5. Volte ao fluxo de caixa e confirme que a entrada foi removida

### 7. Testar com Projeto sem Saldo
1. Crie um novo projeto pequeno (valor baixo)
2. Faça um pagamento quitando totalmente o projeto
3. Verifique que:
   - O saldo fica em R$ 0,00
   - O botão "Receber" não aparece
   - O saldo aparece em verde (ao invés de vermelho/laranja)

## Cenários Adicionais

### Pagamentos Parciais
- Fazer vários pagamentos menores
- Verificar se o saldo vai diminuindo gradualmente
- Confirmar que cada pagamento gera uma entrada no fluxo de caixa

### Diferentes Métodos de Pagamento
- Testar com Dinheiro, PIX, Transferência, Cartão, Cheque, Boleto
- Verificar se os métodos aparecem corretamente no extrato

### Múltiplas Contas de Caixa
- Usar contas diferentes para pagamentos diferentes
- Verificar se cada entrada vai para a conta correta no fluxo de caixa

### Histórico Completo
- Fazer vários pagamentos ao longo de dias diferentes
- Verificar se aparecem ordenados (mais recentes primeiro)
- Confirmar que todas as observações são mantidas

## Validações a Verificar

1. Não é possível salvar pagamento sem:
   - Valor
   - Conta de caixa
   - Método de pagamento

2. Valores aparecem corretamente formatados:
   - Formato brasileiro (R$ 1.234,56)
   - Sempre com 2 casas decimais

3. Cores dos indicadores:
   - Saldo pendente: laranja/vermelho
   - Saldo zerado: verde/cinza
   - Total recebido: verde

4. Sincronização automática:
   - Alterar qualquer valor atualiza todos os outros
   - Fluxo de caixa sempre reflete os pagamentos

## Problemas Comuns e Soluções

### "Erro ao carregar dados"
- Verifique se há contas de caixa cadastradas
- Verifique se o projeto existe no banco

### "Erro ao registrar pagamento"
- Preencha todos os campos obrigatórios (marcados com *)
- Verifique se o valor é maior que zero

### Saldo não atualiza
- Recarregue a página
- Os triggers devem atualizar automaticamente

### Extrato PDF não gera
- Verifique se há dados no projeto
- Tente novamente após alguns segundos
