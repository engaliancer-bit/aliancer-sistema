# Guia: Dupla Funcionalidade Insumo/Revenda

## Visão Geral

O sistema permite que insumos tenham **dupla funcionalidade**, atuando de forma diferente dependendo do contexto de uso:

1. **Como Insumo** (em produtos/composições): Usa apenas o custo de compra
2. **Como Revenda** (em orçamentos diretos): Usa o preço de venda com impostos e margem

## Como Funciona

### 1. Cadastro de Insumos

Ao cadastrar um insumo em **Insumos de Produção**, você define:

- **Custo Unitário**: O preço que você paga ao fornecedor
- **Revenda Habilitada**: Se o insumo também pode ser vendido diretamente
- **Impostos (%)**: Percentual de impostos sobre a venda
- **Margem de Lucro (%)**: Percentual de lucro desejado

### 2. Cálculo Automático

O sistema calcula automaticamente:

```
Preço de Venda = Custo + (Custo × Impostos%) + (Custo × Margem%)
```

**Exemplo:**
- Custo: R$ 100,00
- Impostos: 18%
- Margem: 30%

```
Preço de Venda = 100 + (100 × 0,18) + (100 × 0,30)
Preço de Venda = 100 + 18 + 30 = R$ 148,00
```

## Contextos de Uso

### Contexto 1: Composição de Produtos (Artefatos/Pré-moldados)

**Localização:** Menu → Composições

Quando você adiciona um insumo a uma composição de produto:
- ✅ Sistema usa apenas o **Custo Unitário**
- ❌ NÃO aplica impostos ou margem de lucro
- 💡 **Por quê?** Para calcular corretamente o custo de produção do produto final

**Exemplo:**
```
Composição: Viga Pré-Moldada
├─ Cimento (50kg): R$ 1,00/kg → Usa R$ 1,00 (custo)
├─ Ferro (10m): R$ 5,00/m → Usa R$ 5,00 (custo)
└─ Custo Total da Viga: R$ 100,00 (soma dos custos)
```

### Contexto 2: Orçamento Direto (Venda ao Cliente)

**Localização:** Menu → Orçamentos

Quando você adiciona um insumo diretamente a um orçamento:

**Se revenda HABILITADA:**
- ✅ Sistema usa o **Preço de Venda** (custo + impostos + margem)
- 💡 **Por quê?** O cliente está comprando o insumo pronto, não um produto manufaturado

**Se revenda DESABILITADA:**
- ✅ Sistema usa apenas o **Custo Unitário**
- 💡 **Por quê?** Insumo não configurado para venda direta

**Exemplo:**
```
Orçamento #123 - Cliente: João Silva
├─ Viga Pré-Moldada (produto): R$ 200,00
└─ Cimento Extra (insumo revenda): R$ 148,00 (custo + impostos + margem)
```

## Interface do Sistema

### Tela de Insumos

A tabela mostra claramente:
- **Custo**: Valor usado em composições
- **Revenda**: Se habilitado ou não (Sim/Não)
- **Preço Venda**: Valor calculado com impostos e margem

### Tela de Composições

Ao adicionar materiais:
- Sempre mostra o custo unitário ao lado do nome
- Nota informativa: "Os insumos usados em composições sempre utilizam apenas o Custo Unitário"

### Tela de Orçamentos

Ao selecionar um insumo:
- Indica se é "Revenda" ao lado do nome
- Mostra nota informativa sobre qual preço está sendo usado
- Se revenda habilitada: mostra os percentuais de impostos e margem

## Vantagens desta Abordagem

1. **Flexibilidade**: Um mesmo insumo pode ser usado em dois contextos diferentes
2. **Precisão**: Cálculo correto do custo de produção vs. preço de venda
3. **Simplicidade**: Não precisa cadastrar o mesmo item duas vezes
4. **Transparência**: Sistema deixa claro qual preço está sendo usado

## Exemplo Prático Completo

### Cenário: Empresa de Pré-Moldados

**Insumo Cadastrado:**
- Nome: Cimento CP-II 50kg
- Custo: R$ 32,00/saco
- Revenda Habilitada: Sim
- Impostos: 18%
- Margem: 25%
- **Preço de Venda Calculado: R$ 45,76**

**Uso 1: Produção de Viga**
```
Composição: Viga 6m
├─ Cimento: 5 sacos × R$ 32,00 = R$ 160,00
├─ Outros materiais: R$ 140,00
└─ Custo Total: R$ 300,00
```
→ Ao vender a viga, você aplica SUA margem sobre os R$ 300,00

**Uso 2: Venda Direta ao Cliente**
```
Orçamento: Cliente quer comprar cimento direto
├─ Cimento: 20 sacos × R$ 45,76 = R$ 915,20
```
→ Cliente paga o preço com impostos e margem já inclusos

## Resumo

| Contexto | Preço Usado | Quando Usar |
|----------|-------------|-------------|
| **Composição de Produtos** | Custo Unitário | Calculando custo de produção de artefatos/pré-moldados |
| **Orçamento Direto (revenda habilitada)** | Preço de Venda | Vendendo insumo diretamente ao cliente |
| **Orçamento Direto (revenda desabilitada)** | Custo Unitário | Insumo não configurado para venda direta |

---

**Dúvidas?** O sistema sempre mostra notas informativas nas telas explicando qual preço está sendo usado!
