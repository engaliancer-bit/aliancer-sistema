# GUIA RÁPIDO - SISTEMA DE RECEBÍVEIS

## 🚀 Como Usar o Sistema

### 1️⃣ APROVAR ORÇAMENTO

**Em qualquer módulo (Fábrica, Laje ou Escritório):**

1. Abra o orçamento desejado
2. Preencha todos os dados necessários
3. Defina o campo `approval_status` para **"aprovado"**
4. O sistema cria automaticamente:
   - ✅ Venda em `unified_sales`
   - ✅ Recebível com status "Sem Definição"

**Resultado**: Venda aparece no painel de Recebíveis na aba "Sem Definição"

---

### 2️⃣ DEFINIR CONDIÇÃO DE PAGAMENTO

**No Painel de Recebíveis → Aba "Sem Definição":**

1. Localize a venda criada
2. Clique em **"Definir Pagamento"**
3. Escolha a forma de pagamento:
   - 💳 PIX
   - 💵 Dinheiro
   - 📄 Boleto
   - 🏦 Transferência
   - 📋 Cheque
   - 💳 Cartão

4. Configure as parcelas:
   - **Entrada**: Valor inicial (opcional)
   - **Número de Parcelas**: Quantas vezes
   - **Data 1ª Parcela**: Quando vence a primeira
   - **Intervalo**: Dias entre parcelas (30 = mensal)

5. Clique em **"Aplicar"**

**Resultado**: Recebíveis criados vão para aba "A Receber"

---

### 3️⃣ CONFIRMAR RECEBIMENTO

**No Painel de Recebíveis → Aba "A Receber":**

#### Opção A: Pagamento Normal (PIX, Dinheiro, etc)

1. Localize o recebível
2. Clique em **"Confirmar"**
3. Preencha:
   - Data do Recebimento
   - Valor Recebido (pode ser diferente se parcial)
   - Recebido por (seu nome)
   - Observações (opcional)
4. Clique em **"Confirmar Recebimento"**

**Resultado**:
- Recebível vai para aba "Recebido"
- Entrada criada automaticamente no Fluxo de Caixa

#### Opção B: Pagamento com Cheque

1. Localize o recebível
2. Clique em **"Informar Cheque"**
3. Preencha os dados do cheque:
   - Número do Cheque *
   - Banco *
   - Agência e Conta
   - Titular *
   - CPF/CNPJ
   - Data de Emissão *
   - Bom Para (data para depositar)
   - Observações
4. Clique em **"Salvar Cheque"**

**Resultado**: Recebível vai para aba "Em Compensação"

5. Quando o cheque compensar:
   - Na aba "Em Compensação"
   - Clique em **"Confirmar"** no recebível
   - Sistema cria entrada no caixa
   - Recebível vai para "Recebido"

---

### 4️⃣ REPLANEJAR PARCELAS (Renegociação)

**Quando cliente precisa mudar condições:**

1. No Painel de Recebíveis
2. Localize qualquer recebível da venda
3. Clique em **"Definir Pagamento"** novamente
4. Configure novo plano de parcelas
5. Clique em **"Aplicar"**

**O que acontece**:
- ✅ Parcelas já pagas são mantidas
- ✅ Parcelas não pagas são canceladas (ficam no histórico)
- ✅ Novas parcelas são criadas com novo plano

---

## 📊 ABAS DO PAINEL

### 🔘 Sem Definição (Cinza)
**O que tem aqui**: Vendas recém-aprovadas sem condição de pagamento definida

**O que fazer**: Clicar em "Definir Pagamento" e configurar parcelas

---

### ⏰ A Receber (Amarelo)
**O que tem aqui**: Parcelas definidas aguardando recebimento

**O que fazer**:
- Se for cheque: "Informar Cheque"
- Quando receber: "Confirmar"

**Indicadores de vencimento**:
- 🔴 Vermelho = Vencido
- 🟠 Laranja = Vence em 7 dias
- 🟢 Verde = No prazo

---

### 🏦 Em Compensação (Azul)
**O que tem aqui**: Cheques informados aguardando compensação bancária

**O que fazer**: Quando compensar, clicar em "Confirmar"

**Informações exibidas**: Número do cheque, banco, status

---

### ✅ Recebido (Verde)
**O que tem aqui**: Parcelas recebidas e no caixa

**O que fazer**: Visualizar apenas (histórico)

**Informações exibidas**: Data de recebimento, valor, responsável

---

## 💡 EXEMPLOS DE CONDIÇÕES COMUNS

### Exemplo 1: À Vista com Desconto
```
Forma: PIX
Entrada: R$ 2.850,00 (5% desconto)
Parcelas: 0
Data: Hoje
```

### Exemplo 2: Entrada + 3x no Boleto
```
Forma: Boleto
Entrada: R$ 1.000,00 (PIX hoje)
Parcelas: 3x de R$ 666,67
Intervalo: 30 dias
1ª Parcela: 15/02/2026
```

### Exemplo 3: 6 Cheques Mensais
```
Forma: Cheque
Entrada: R$ 0,00
Parcelas: 6x de R$ 500,00
Intervalo: 30 dias
1ª Parcela: 30/01/2026
```

### Exemplo 4: Entrada + Saldo em 60 dias
```
Forma: Transferência
Entrada: R$ 1.500,00 (PIX hoje)
Parcelas: 1x de R$ 1.500,00
1ª Parcela: 60 dias (21/03/2026)
```

---

## 🔍 BUSCAR E FILTRAR

### Busca por Texto
Digite no campo de busca:
- Número da venda (ex: VND-202601-0001)
- Nome do cliente
- Parte do nome ou número

### Filtro por Aba
Clique na aba desejada para ver apenas recebíveis naquele status

### Filtro por Origem
Cada recebível mostra a origem:
- 🏭 Orç. Fábrica
- 🏗️ Orç. Laje
- 📐 Orç. Escritório

---

## ⚠️ OBSERVAÇÕES IMPORTANTES

### ✅ Boas Práticas

1. **Sempre defina o pagamento**: Não deixe vendas em "Sem Definição" por muito tempo

2. **Cheques pré-datados**: Use o campo "Bom Para" para não depositar antes da hora

3. **Recebimentos parciais**: Pode receber menos que o valor da parcela (campo "Valor Recebido")

4. **Observações**: Use para registrar detalhes importantes (ex: "Cliente pediu desconto de R$ 50")

5. **Replanejamento**: Sempre comunique ao cliente antes de replanejar

### ❌ O Que NÃO Fazer

1. **Não apague recebíveis**: Use replanejamento em vez de deletar

2. **Não altere manualmente o caixa**: O sistema cria automaticamente

3. **Não confirme recebimento antes de receber**: Status "pago" cria entrada no caixa

4. **Não reaplique orçamento**: Um orçamento gera UMA venda apenas

---

## 🔗 INTEGRAÇÃO COM OUTROS MÓDULOS

### Fluxo de Caixa
- Entrada criada automaticamente ao confirmar recebimento
- Descrição completa: "Recebimento Venda VND-202601-0001 - Parcela 1 - Cliente X"
- Categoria: Venda
- Tipo: Entrada

### Orçamentos
- Ao aprovar orçamento, venda é criada
- Campo `sale_created` marca que venda foi gerada
- Não pode gerar venda duas vezes

### Portal do Cliente (futuro)
- Cliente pode visualizar suas parcelas
- Status de pagamento em tempo real
- Download de boletos

---

## 📞 SUPORTE

### Dúvidas Comuns

**P: Aprovei orçamento mas não apareceu venda**
R: Verifique se `approval_status` está como "aprovado" (não "approved")

**P: Posso alterar valor da parcela depois?**
R: Sim, use replanejamento. Parcelas pagas não são alteradas

**P: Cliente pagou cheque em dinheiro, e agora?**
R: Cancele o recebível do cheque e crie novo com forma "dinheiro"

**P: Como faço venda avulsa (sem orçamento)?**
R: (Funcionalidade futura - será adicionada)

**P: Posso ter entrada em PIX e parcelas em boleto?**
R: Sim! Cada parcela pode ter forma de pagamento diferente

---

## 🎯 CHECKLIST DIÁRIO

### Manhã
- [ ] Verificar aba "A Receber" → Recebíveis vencidos (vermelho)
- [ ] Verificar aba "Em Compensação" → Cheques para depositar
- [ ] Conferir aba "Sem Definição" → Definir pagamentos pendentes

### Ao Receber Pagamento
- [ ] Confirmar recebimento no sistema
- [ ] Anexar comprovante (se houver)
- [ ] Verificar se entrada apareceu no fluxo de caixa

### Final do Dia
- [ ] Revisar recebimentos do dia na aba "Recebido"
- [ ] Conferir total recebido com caixa físico
- [ ] Preparar depósitos de cheques do dia seguinte

---

## 📈 RELATÓRIOS E ANÁLISES

### Recebíveis por Status
```sql
SELECT status, COUNT(*), SUM(valor_parcela)
FROM receivables
WHERE status != 'cancelado'
GROUP BY status;
```

### Recebimentos do Mês
```sql
SELECT * FROM receivables
WHERE status = 'pago'
  AND data_recebimento >= '2026-01-01'
  AND data_recebimento < '2026-02-01';
```

### Cheques a Vencer
```sql
SELECT * FROM v_receivables_dashboard
WHERE forma_pagamento = 'cheque'
  AND status = 'em_compensacao'
  AND cheque_bom_para <= CURRENT_DATE + INTERVAL '7 days'
ORDER BY cheque_bom_para;
```

---

**Última Atualização**: 2026-01-17
**Versão**: 1.0
