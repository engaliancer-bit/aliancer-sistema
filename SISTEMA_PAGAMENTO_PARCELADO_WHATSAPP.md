# Sistema de Pagamento Parcelado - WhatsApp

## O que foi implementado?

Sistema automático de cálculo e apresentação de formas de pagamento na mensagem de cobrança via WhatsApp.

## Formas de Pagamento Disponíveis

### 1. À VISTA (sem juros)
- PIX
- Dinheiro
- Cartão de Débito

### 2. CARTÃO DE CRÉDITO
Parcelamento em até **4x** com juros de **1,2% ao mês** compostos:
- 1x sem juros
- 2x com juros de ~2,4%
- 3x com juros de ~3,6%
- 4x com juros de ~4,9%

### 3. BOLETO
Parcelamento em até **3x** com juros de **1,2% ao mês** compostos:
- 1x sem juros
- 2x com juros de ~2,4%
- 3x com juros de ~3,6%

### 4. CHEQUE PRÉ-DATADO
Parcelamento em até **3x** com juros de **1,2% ao mês** compostos:
- 1x sem juros
- 2x com juros de ~2,4%
- 3x com juros de ~3,6%

## Como Funciona?

### Cálculo de Juros
A fórmula aplicada é de **juros compostos**:
```
Valor Final = Valor Inicial × (1 + 0,012)^número_de_parcelas
Parcela = Valor Final ÷ número_de_parcelas
```

### Exemplo Prático
Para um saldo de **R$ 3.800,00**:

**Cartão de Crédito:**
- 1x R$ 3.800,00 (sem juros)
- 2x R$ 1.937,60 (+2,4%)
- 3x R$ 1.306,93 (+3,6%)
- 4x R$ 989,60 (+4,9%)

**Boleto:**
- 1x R$ 3.800,00 (sem juros)
- 2x R$ 1.937,60 (+2,4%)
- 3x R$ 1.306,93 (+3,6%)

**Cheque:**
- 1x R$ 3.800,00 (sem juros)
- 2x R$ 1.937,60 (+2,4%)
- 3x R$ 1.306,93 (+3,6%)

## Como Usar?

1. Acesse **Projetos de Engenharia**
2. Selecione um projeto com saldo devedor
3. Clique em **"Cobrar via WhatsApp"**
4. Revise a mensagem gerada
5. Clique em **"Abrir WhatsApp"** ou **"Copiar Mensagem"**

## Formato da Mensagem

```
🏢 *NOME DA EMPRESA*

Olá, Cliente! 👋

Segue o extrato detalhado do projeto:

📋 *PROJETO:* Nome do Projeto
🏠 *IMÓVEL:* Nome do Imóvel

━━━━━━━━━━━━━━━━━━━━
💰 *DISCRIMINAÇÃO DE VALORES*
━━━━━━━━━━━━━━━━━━━━

• *Valor Negociado:*
  R$ X.XXX,XX

• *Custos Adicionais:*
  - Tipo: Descrição
    R$ XXX,XX

━━━━━━━━━━━━━━━━━━━━

💵 *RESUMO FINANCEIRO*

*Valor Total:* R$ X.XXX,XX
*Total Recebido:* R$ X.XXX,XX

🔴 *SALDO A RECEBER: R$ X.XXX,XX*

━━━━━━━━━━━━━━━━━━━━

💳 *FORMAS DE PAGAMENTO*

💰 *À VISTA (sem juros):*
  • PIX: R$ X.XXX,XX
    Chave: sua_chave_pix
  • Dinheiro: R$ X.XXX,XX
  • Débito: R$ X.XXX,XX

💳 *CARTÃO DE CRÉDITO:*
  • 1x R$ X.XXX,XX (sem juros)
  • 2x R$ X.XXX,XX (+2.4%)
  • 3x R$ X.XXX,XX (+3.6%)
  • 4x R$ XXX,XX (+4.9%)

📄 *BOLETO (consulte parcelamento):*
  • 1x R$ X.XXX,XX (sem juros)
  • 2x R$ X.XXX,XX (+2.4%)
  • 3x R$ X.XXX,XX (+3.6%)

📝 *CHEQUE PRÉ-DATADO:*
  • 1x R$ X.XXX,XX (sem juros)
  • 2x R$ X.XXX,XX (+2.4%)
  • 3x R$ X.XXX,XX (+3.6%)

🏦 *TRANSFERÊNCIA BANCÁRIA:*
  Banco XXX - Ag: XXXX - Conta: XXXXX-X

━━━━━━━━━━━━━━━━━━━━

Estamos à disposição para esclarecer qualquer dúvida!

📞 *Contato:* (XX) XXXXX-XXXX

_Mensagem gerada automaticamente pelo Sistema de Gestão_
```

## Vantagens do Sistema

1. **Transparência Total**: Cliente vê todas as opções de uma vez
2. **Cálculo Automático**: Valores já calculados com juros corretos
3. **Profissional**: Mensagem padronizada e bem formatada
4. **Praticidade**: Cliente escolhe melhor opção sem precisar perguntar
5. **Reduz Negociação**: Todas as condições já estão claras

## Configurações Necessárias

Para o sistema funcionar corretamente, configure em **Configurações da Empresa**:
- Nome da empresa
- Telefone de contato
- Chave PIX
- Dados bancários (opcional)

## Alterando as Taxas de Juros

Para alterar a taxa de juros, edite o arquivo:
`src/components/engineering/WhatsAppBillingModal.tsx`

Na função `calculateInstallments`, altere o valor padrão:
```typescript
function calculateInstallments(
  amount: number,
  installments: number,
  interestRate: number = 0.012  // 1,2% = 0.012
): number {
  ...
}
```

## Alterando Número de Parcelas

Para alterar o limite de parcelas, edite os loops:

**Cartão de Crédito (até 4x):**
```typescript
for (let i = 2; i <= 4; i++) {  // Altere o 4 para o número desejado
```

**Boleto (até 3x):**
```typescript
for (let i = 2; i <= 3; i++) {  // Altere o 3 para o número desejado
```

**Cheque (até 3x):**
```typescript
for (let i = 2; i <= 3; i++) {  // Altere o 3 para o número desejado
```

## Status da Implementação

✅ **CONCLUÍDO** - Sistema 100% operacional

### Arquivos Modificados:
- `src/components/engineering/WhatsAppBillingModal.tsx`

### Data da Implementação:
16/02/2026
