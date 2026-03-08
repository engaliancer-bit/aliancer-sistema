# Guia de Uso - Módulo Projetos em Andamento

## Visão Geral

O módulo **Projetos em Andamento** é uma ferramenta completa de gestão de projetos para escritórios de engenharia e topografia. Ele permite:

- ✅ Criar e gerenciar projetos vinculados a clientes e imóveis
- ✅ Controlar financeiramente cada projeto (valores sugeridos vs praticados)
- ✅ Adicionar custos adicionais (taxas, deslocamento, hospedagem, etc)
- ✅ Utilizar marcos de concreto do estoque (com baixa automática)
- ✅ Registrar recebimentos integrados ao fluxo de caixa
- ✅ Gerar extratos financeiros completos
- ✅ Acompanhar saldo a receber de cada projeto

## Como Acessar

1. Acesse o menu principal
2. Clique em **"Escritório de Engenharia e Topografia"**
3. Selecione a aba **"Projetos em Andamento"**

## Criar um Novo Projeto

### Passo 1: Iniciar Projeto

1. Clique no botão **"Iniciar Novo Projeto"**
2. Preencha as informações básicas:
   - **Nome do Projeto** (obrigatório)
   - **Cliente** (obrigatório)
   - **Imóvel** do cliente (obrigatório)
   - **Data de Início** (obrigatório)
   - **Previsão de Conclusão** (opcional)
   - **Status** (Em Planejamento ou Em Andamento)
   - **Observações** (opcional)

### Passo 2: Adicionar Serviços

1. Na seção **"Serviços"**, clique em **"Adicionar"**
2. Selecione o serviço da lista (da Tabela de Serviços)
3. O **Valor Sugerido** será preenchido automaticamente
4. Você pode editar o **Valor Praticado** se houver desconto/acréscimo
5. Adicione quantos serviços forem necessários
6. Para remover um serviço, clique no ícone ❌

**Exemplo:**
```
Serviço: Levantamento Topográfico
Valor Sugerido: R$ 4.500,00
Valor Praticado: R$ 4.500,00 (pode ser editado)
```

### Passo 3: Adicionar Custos Adicionais (Opcional)

1. Na seção **"Custos Adicionais"**, clique em **"Adicionar"**
2. Selecione o tipo de custo:
   - Taxa
   - Deslocamento
   - Hospedagem
   - Alimentação
   - Outros
3. Digite a descrição
4. Informe o valor
5. Para remover, clique no ícone ❌

**Exemplo:**
```
Tipo: Deslocamento
Descrição: Viagem até a propriedade
Valor: R$ 300,00
```

### Passo 4: Adicionar Marcos de Concreto (Opcional)

1. Na seção **"Marcos de Concreto"**, clique em **"Adicionar"**
2. Selecione o produto (Marco de Concreto do estoque)
3. Informe a quantidade necessária
4. O sistema mostrará:
   - Valor unitário (automático)
   - Valor total (quantidade × unitário)
   - Estoque disponível
5. Para remover, clique no ícone ❌

**Importante:** O sistema verifica se há estoque suficiente antes de salvar!

**Exemplo:**
```
Produto: Marco de Concreto
Quantidade: 4
Valor Unitário: R$ 85,00 (automático)
Valor Total: R$ 340,00 (automático)
Estoque: 50 unidades
```

### Passo 5: Revisar e Salvar

1. Confira o **Resumo Financeiro** na parte inferior:
   - Total de Serviços
   - Custos Adicionais
   - Marcos de Concreto
   - **TOTAL GERAL**
2. Clique em **"Salvar Projeto"**

**Ao salvar, o sistema automaticamente:**
- ✅ Cria o projeto no banco de dados
- ✅ Dá baixa nos marcos de concreto do estoque
- ✅ Registra a movimentação de estoque
- ✅ Calcula todos os totais

## Visualizar Projetos

### Lista de Projetos

A tela principal exibe cards com informações resumidas:

```
┌─────────────────────────────────────┐
│ 📋 Levantamento Topográfico         │
│ Cliente: João da Silva              │
│ Status: 🟢 Em Andamento             │
│ Início: 15/01/2026                  │
│                                     │
│ Financeiro:                         │
│ Total: R$ 12.500,00                │
│ Recebido: R$ 5.000,00              │
│ Saldo: R$ 7.500,00                 │
│                                     │
│ [Ver Extrato] [Receber]            │
└─────────────────────────────────────┘
```

### Filtros Disponíveis

1. **Busca por texto:** Digite nome do projeto ou cliente
2. **Filtro por status:**
   - Todos os Status
   - Em Planejamento
   - Em Andamento
   - Concluído
   - Cancelado

## Ver Extrato Financeiro

1. Localize o projeto na lista
2. Clique no botão **"Ver Extrato"**
3. O extrato exibe:

### Seção 1: Serviços Contratados
- Nome de cada serviço
- Valor sugerido × Valor praticado
- Subtotal de serviços

### Seção 2: Custos Adicionais
- Tipo e descrição de cada custo
- Valores individuais
- Subtotal de custos

### Seção 3: Marcos de Concreto
- Quantidade × Produto @ Valor unitário
- Subtotal de marcos

### Seção 4: Recebimentos
- Data, forma de pagamento e conta
- Valores recebidos
- Total recebido

### Seção 5: Resumo Financeiro
```
Total do Projeto:    R$ 10.640,00
Total Recebido:      R$  5.000,00
─────────────────────────────────
Saldo a Receber:     R$  5.640,00 🔴
```

## Registrar Pagamento

### Quando Usar
Use quando o cliente efetuar um pagamento do projeto.

### Como Fazer

1. Localize o projeto na lista
2. Clique no botão **"Receber"** (só aparece se houver saldo devedor)
3. Preencha as informações:
   - **Data do Recebimento**
   - **Valor Recebido** (não pode ser maior que o saldo)
   - **Forma de Pagamento:**
     - Dinheiro
     - PIX
     - Transferência
     - Cheque
     - Cartão
   - **Conta Caixa** (obrigatório)
   - **Observações** (opcional)
4. Clique em **"Registrar"**

### O que acontece automaticamente:

1. ✅ Pagamento registrado no projeto
2. ✅ Entrada criada no **Fluxo de Caixa Geral**
3. ✅ Saldo da **Conta Caixa** atualizado
4. ✅ Saldo do projeto recalculado
5. ✅ Categoria "Serviços de Engenharia" criada/atualizada

**Exemplo:**
```
Data: 18/01/2026
Valor: R$ 2.000,00
Forma: PIX
Conta: Banco do Brasil - Conta Corrente
Observações: Pagamento parcial
```

## Integração com Outros Módulos

### 1. Módulo de Clientes
- Seleciona clientes já cadastrados
- Valida cliente ativo

### 2. Módulo de Imóveis
- Lista imóveis do cliente selecionado
- Valida imóvel ativo

### 3. Tabela de Serviços
- Busca serviços disponíveis
- Obtém valores sugeridos automaticamente

### 4. Estoque de Produtos
- Verifica disponibilidade de marcos de concreto
- Dá baixa automática ao salvar projeto
- Registra movimentação com referência ao projeto
- Estorna ao remover marcos

### 5. Fluxo de Caixa Geral
- Registra entradas automaticamente ao receber pagamentos
- Atualiza saldos de contas caixa
- Integra com categoria "Serviços de Engenharia"

## Status dos Projetos

### 🔵 Em Planejamento
- Projeto ainda não iniciado
- Permite edições completas

### 🟢 Em Andamento
- Projeto em execução
- Pode receber pagamentos

### ⚪ Concluído
- Projeto finalizado
- Mantém histórico completo

### 🔴 Cancelado
- Projeto cancelado
- Não aparece nos filtros padrão

## Dicas e Boas Práticas

### ✅ Cadastros Prévios
Antes de criar projetos, certifique-se de ter:
1. Clientes cadastrados
2. Imóveis vinculados aos clientes
3. Serviços na Tabela de Serviços
4. Marcos de concreto no estoque (se for usar)
5. Contas caixa configuradas

### ✅ Valores Praticados
- Sempre revise os valores praticados
- Aplique descontos diretamente no valor praticado
- O sistema sempre usa o valor praticado nos cálculos

### ✅ Custos Adicionais
- Registre todos os custos extras do projeto
- Seja específico nas descrições
- Isso ajuda na análise de rentabilidade

### ✅ Recebimentos
- Registre pagamentos assim que recebê-los
- Sempre associe a uma conta caixa
- Use observações para documentar condições

### ✅ Estoque de Marcos
- Verifique o estoque antes de adicionar marcos
- O sistema bloqueia se não houver estoque suficiente
- A baixa é automática ao salvar o projeto

## Relatórios e Análises

### Dados Disponíveis
Cada projeto fornece:
- Histórico completo de valores
- Variação entre sugerido e praticado
- Custos detalhados
- Marcos utilizados
- Histórico de recebimentos
- Saldo atual

### Análise Financeira
Use os dados para:
- Calcular margem de contribuição
- Identificar custos médios
- Avaliar prazos de recebimento
- Comparar valores sugeridos vs praticados

## Solução de Problemas

### "Estoque insuficiente para o produto"
**Causa:** Não há marcos suficientes no estoque
**Solução:** Vá em "Estoque de Produtos" e adicione mais marcos

### "Preencha todos os campos obrigatórios"
**Causa:** Nome, cliente ou imóvel não preenchidos
**Solução:** Complete todos os campos marcados com *

### "Adicione pelo menos um serviço ao projeto"
**Causa:** Tentativa de salvar sem serviços
**Solução:** Adicione ao menos um serviço na seção Serviços

### "Valor não pode ser maior que o saldo devedor"
**Causa:** Tentativa de registrar valor maior que o devido
**Solução:** Verifique o saldo e registre valor correto

### Imóveis não aparecem ao selecionar cliente
**Causa:** Cliente não tem imóveis cadastrados
**Solução:** Vá em "Imóveis" e cadastre imóveis para o cliente

## Fluxo Completo - Exemplo Prático

### Cenário
Cliente João da Silva contratou um Levantamento Topográfico da Fazenda Santa Maria.

### Passo a Passo

**1. Criar o Projeto**
```
Nome: Levantamento Topográfico - Fazenda Santa Maria
Cliente: João da Silva
Imóvel: Fazenda Santa Maria
Data Início: 15/01/2026
Previsão: 30/01/2026
Status: Em Andamento
```

**2. Adicionar Serviços**
```
Serviço: Levantamento Topográfico Planialtimétrico
Valor Sugerido: R$ 4.500,00
Valor Praticado: R$ 4.200,00 (desconto de R$ 300)
```

**3. Adicionar Custos**
```
Tipo: Deslocamento
Descrição: Viagem até a propriedade (200 km)
Valor: R$ 400,00

Tipo: Alimentação
Descrição: Refeições durante 3 dias
Valor: R$ 150,00
```

**4. Adicionar Marcos**
```
Produto: Marco de Concreto
Quantidade: 5
Valor Unitário: R$ 85,00
Total: R$ 425,00
```

**5. Resumo Financeiro**
```
Total Serviços:        R$ 4.200,00
Custos Adicionais:     R$   550,00
Marcos de Concreto:    R$   425,00
────────────────────────────────
TOTAL GERAL:           R$ 5.175,00
```

**6. Salvar Projeto**
- ✅ Projeto criado
- ✅ 5 marcos descontados do estoque
- ✅ Movimentação registrada

**7. Registrar Primeiro Pagamento (Entrada)**
```
Data: 15/01/2026
Valor: R$ 2.000,00
Forma: PIX
Conta: Banco do Brasil
Observações: Pagamento de entrada (40%)
```
- ✅ Saldo atualizado: R$ 3.175,00

**8. Registrar Segundo Pagamento (Restante)**
```
Data: 05/02/2026
Valor: R$ 3.175,00
Forma: Transferência
Conta: Banco do Brasil
Observações: Pagamento final
```
- ✅ Projeto quitado: R$ 0,00

## Perguntas Frequentes

**P: Posso editar um projeto depois de criado?**
R: Atualmente não há função de edição. Em breve será adicionada.

**P: O que acontece se eu remover marcos do projeto?**
R: Os marcos seriam estornados ao estoque (função futura).

**P: Posso usar o mesmo imóvel em vários projetos?**
R: Sim! Um imóvel pode ter múltiplos projetos.

**P: Como cancelo um projeto?**
R: Função de cancelamento será adicionada em breve.

**P: Os pagamentos aparecem no fluxo de caixa?**
R: Sim! Automaticamente na categoria "Serviços de Engenharia".

**P: Posso usar outros produtos além de marcos?**
R: Atualmente só marcos. Outros produtos serão adicionados.

**P: Onde vejo o histórico de todos os projetos?**
R: Na tela principal, altere o filtro de status para "Todos".

## Suporte

Se encontrar algum problema ou tiver dúvidas:
1. Verifique este guia primeiro
2. Confira a Especificação Técnica (para desenvolvedores)
3. Entre em contato com o suporte técnico

## Atualizações Futuras

Recursos planejados:
- [ ] Edição de projetos existentes
- [ ] Cancelamento de projetos
- [ ] Anexar documentos aos projetos
- [ ] Gestão de etapas do projeto
- [ ] Relatórios analíticos
- [ ] Exportação de extrato em PDF
- [ ] Notificações de prazo
- [ ] Dashboard de projetos

---

**Versão:** 1.0
**Data:** Janeiro 2026
**Autor:** Sistema ERP Aliancer
