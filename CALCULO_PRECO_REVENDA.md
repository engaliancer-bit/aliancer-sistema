# Guia: Cálculo de Preço de Revenda

## Como Funciona o Sistema de Revenda

O sistema permite que insumos comprados sejam revendidos diretamente aos clientes, calculando automaticamente o preço de venda com base no **valor da embalagem**.

## Conceitos Importantes

### Dupla Funcionalidade do Insumo

Cada insumo pode ser utilizado de duas formas:

1. **Como Insumo (em produtos/composições)**
   - Usa o **Custo Unitário** para calcular o custo de produção
   - Exemplo: Cimento usado na produção de blocos

2. **Como Revenda (em orçamentos diretos)**
   - Usa o **Preço de Venda** calculado automaticamente
   - Exemplo: Cimento vendido diretamente ao cliente

## Cálculo do Preço de Venda

### Fórmula Base

```
Preço de Venda = Valor da Embalagem + Impostos + Margem de Lucro
```

### Cálculo Detalhado

```
1. Valor da Embalagem = Preço da Embalagem (R$)
2. Valor dos Impostos = Valor da Embalagem × (% Impostos / 100)
3. Valor da Margem = Valor da Embalagem × (% Margem / 100)
4. Preço de Venda Final = (1) + (2) + (3)
```

### Exemplo Prático

**Cimento CP-II 50kg:**

- Preço da Embalagem: R$ 30,00
- Impostos: 18%
- Margem: 30%

**Cálculo:**
```
1. Base: R$ 30,00
2. Impostos: R$ 30,00 × 18% = R$ 5,40
3. Margem: R$ 30,00 × 30% = R$ 9,00
4. Preço Final: R$ 30,00 + R$ 5,40 + R$ 9,00 = R$ 44,40
```

**Preço por kg:**
```
R$ 44,40 ÷ 50kg = R$ 0,8880/kg
```

## Como Configurar um Insumo para Revenda

### Passo 1: Cadastrar o Insumo

1. Acesse **Insumos de Produção**
2. Clique em **Cadastrar Novo Insumo**
3. Preencha os dados básicos:
   - Nome do insumo
   - Descrição
   - Unidade de medida
   - Marca
   - Fornecedor

### Passo 2: Informar o Custo da Embalagem

Na seção **"📦 Cálculo de Custo por Embalagem"**:

1. **Tamanho da Embalagem**: Informe a quantidade (Ex: 50 para saco de 50kg)
2. **Preço da Embalagem**: Informe o valor pago (Ex: R$ 30,00)
3. O sistema calcula automaticamente o **Custo Unitário**

### Passo 3: Habilitar para Revenda

1. Marque a opção: **"Habilitar para Revenda Direta"**
2. Preencha:
   - **Impostos na Revenda (%)**: Ex: 18,00
   - **Margem de Lucro (%)**: Ex: 30,00

### Passo 4: Visualizar o Preço Calculado

O sistema mostra automaticamente o **Memorial de Cálculo**:
- Base de cálculo (valor da embalagem)
- Valor dos impostos
- Valor da margem
- **Preço de Venda por Embalagem** (destaque verde)
- Preço por unidade (kg, litro, etc.)

### Passo 5: Salvar

- Clique em **Cadastrar** ou **Atualizar**
- O sistema salva automaticamente o preço de venda calculado

## O que é Armazenado no Banco de Dados

| Campo | Descrição | Exemplo |
|-------|-----------|---------|
| `package_size` | Tamanho da embalagem | 50 (kg) |
| `unit_cost` | Custo por unidade | 0.6000 (R$/kg) |
| `resale_enabled` | Habilitado para revenda | true |
| `resale_tax_percentage` | Percentual de impostos | 18.00 (%) |
| `resale_margin_percentage` | Percentual de margem | 30.00 (%) |
| `resale_price` | **Preço de venda calculado** | 44.40 (R$) |

## Como o Preço de Venda é Usado

### Em Orçamentos

Quando você adiciona um insumo com `resale_enabled = true` em um orçamento:
- O sistema usa o **`resale_price`** (preço da embalagem)
- Não usa o `unit_cost`
- O cliente paga o valor com impostos e margem inclusos

### Em Composições/Produtos

Quando você usa o insumo na produção de um produto:
- O sistema usa o **`unit_cost`** (custo unitário)
- Não usa o `resale_price`
- O cálculo é baseado apenas no custo de produção

## Recalculando Preços

O preço de venda é **recalculado automaticamente** quando você altera:
- Preço da embalagem
- Tamanho da embalagem
- Percentual de impostos
- Percentual de margem

### Auto-Save

O sistema possui **salvamento automático**:
- Salva após 2 segundos de inatividade
- Mostra indicador visual de salvamento
- Recalcula o preço automaticamente

## Vantagens do Sistema

### 1. Precisão
- Cálculo automático elimina erros manuais
- Base de cálculo no valor da embalagem (como você compra)
- Impostos e margem aplicados corretamente

### 2. Transparência
- Memorial de cálculo visível em tempo real
- Mostra cada etapa do cálculo
- Exibe preço por unidade para referência

### 3. Flexibilidade
- Impostos e margem configuráveis por insumo
- Pode ajustar percentuais conforme necessidade
- Mantém histórico de mudanças

### 4. Economia de Tempo
- Não precisa calcular manualmente
- Atualização automática ao mudar valores
- Salva automaticamente

## Perguntas Frequentes

### Por que usar o valor da embalagem em vez do custo unitário?

**Resposta**: Na revenda, você vende o produto na mesma embalagem que comprou. O cliente compra "1 saco de cimento", não "50kg de cimento". É mais natural calcular a partir do valor da embalagem.

### O que acontece se eu não preencher o preço da embalagem?

**Resposta**: O sistema não conseguirá calcular o preço de venda. O memorial de cálculo ficará vazio até você preencher o valor da embalagem.

### Posso vender por unidade (kg, litro) em vez de por embalagem?

**Resposta**: Sim! O sistema mostra o "Preço por unidade" no memorial de cálculo. Você pode usar esse valor em orçamentos se preferir.

### Como alterar o percentual de impostos ou margem?

**Resposta**:
1. Clique em **Editar** no insumo
2. Role até a seção de revenda
3. Altere os percentuais
4. O sistema recalcula automaticamente
5. Salva após 2 segundos

### O preço de venda afeta o custo de produção?

**Resposta**: Não! O custo de produção usa sempre o `unit_cost` (custo unitário). O `resale_price` é usado apenas quando você vende o insumo diretamente ao cliente.

## Exemplo Completo

### Cenário: Areia Média

**Dados de Entrada:**
- Nome: Areia Média Lavada
- Unidade: m³
- Tamanho da Embalagem: 5 m³ (caminhão)
- Preço da Embalagem: R$ 200,00
- Impostos: 12%
- Margem: 25%

**Resultado:**
```
Valor da Embalagem:    R$ 200,00
Impostos (12%):        R$  24,00  (+)
Margem (25%):          R$  50,00  (+)
─────────────────────────────────
Preço de Venda:        R$ 274,00

Preço por m³:          R$  54,80/m³
```

**Uso:**
- Cliente compra 1 caminhão de areia = R$ 274,00
- Ou cliente compra 3m³ de areia = R$ 164,40

---

**Última Atualização**: Janeiro 2026
**Versão do Sistema**: 2.0
