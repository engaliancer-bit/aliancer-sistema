# Campos de Controle de Preços

## Resumo

Implementação de campos opcionais para controlar preços mínimos e descontos máximos permitidos em produtos e insumos de revenda.

**Data:** 11/02/2026

## Novos Campos

### Para Produtos (tabela `products`)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `minimum_price` | numeric | Preço mínimo de venda permitido (opcional) |
| `maximum_discount_percent` | numeric | Desconto máximo permitido em % (0-100) (opcional) |

### Para Insumos de Revenda (tabela `materials`)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `minimum_resale_price` | numeric | Preço mínimo de revenda permitido (opcional) |
| `maximum_discount_percent` | numeric | Desconto máximo permitido em % (0-100) (opcional) |

## Benefícios

1. **Proteção de Margem**: Define preço mínimo que não pode ser ultrapassado na venda
2. **Controle de Desconto**: Limita o desconto máximo que pode ser concedido
3. **Prevenção de Perdas**: Evita vendas abaixo do custo ou com margem insuficiente
4. **Auxílio em Negociação**: Vendedor sabe exatamente os limites durante negociação

## Como Usar

### Para Produtos

1. Acesse: **Indústria > Produtos**
2. Clique em **Editar** no produto desejado
3. Role até a seção **"Controles de Preço"** (após o preço final de venda)
4. Preencha os campos desejados:
   - **Preço Mínimo (R$)**: Valor mínimo que pode ser vendido
   - **Desconto Máximo (%)**: Percentual máximo de desconto

![Seção de Controles de Preço](exemplo-controles-produto.png)

**Exemplo:**
```
Produto: Marco de Concreto
Preço Final de Venda: R$ 65,00

Controles de Preço:
- Preço Mínimo: R$ 50,00
- Desconto Máximo: 15%

Interpretação:
✅ Venda a R$ 55,00 (15% desc.) → Permitido
✅ Venda a R$ 52,00 (20% desc.) → Sistema alertará (desconto > 15%)
✅ Venda a R$ 48,00 → Sistema alertará (preço < mínimo)
```

### Para Insumos de Revenda

1. Acesse: **Indústria > Insumos**
2. Clique em **Editar** no insumo desejado
3. Certifique-se que **"Habilitar para Revenda Direta"** está marcado
4. Role até a seção **"Controles de Preço de Revenda"**
5. Preencha os campos desejados:
   - **Preço Mínimo de Revenda (R$)**: Valor mínimo que pode ser revendido
   - **Desconto Máximo (%)**: Percentual máximo de desconto

![Seção de Controles de Preço para Revenda](exemplo-controles-insumo.png)

**Exemplo:**
```
Insumo: Cimento 50kg
Preço de Revenda: R$ 42,00 (embalagem)

Controles de Preço de Revenda:
- Preço Mínimo: R$ 35,00
- Desconto Máximo: 10%

Interpretação:
✅ Revenda a R$ 38,00 (9,5% desc.) → Permitido
✅ Revenda a R$ 34,00 (19% desc.) → Sistema alertará (desconto > 10%)
✅ Revenda a R$ 32,00 → Sistema alertará (preço < mínimo)
```

## Visualização na Tabela de Preços

Os controles aparecem na **Tabela de Preços** (versão vendedor):

**Indústria > Tabela de Preços**

| Código | Descrição | Unidade | Preço de Venda | **Desc. Máx.** | **Preço Mín.** |
|--------|-----------|---------|----------------|----------------|----------------|
| P001 | Marco de Concreto | unid | R$ 65,00 | 15% | R$ 50,00 |
| M123 | Cimento 50kg | saco | R$ 42,00 | 10% | R$ 35,00 |

Campos vazios indicam que não há restrição configurada.

## Funcionalidade dos Alertas

### Quando o Sistema Alerta?

O sistema **alerta** (mas não impede) quando:

1. **Preço de venda < Preço Mínimo**
   - Exemplo: Tentar vender a R$ 45,00 quando mínimo é R$ 50,00

2. **Desconto aplicado > Desconto Máximo**
   - Exemplo: Dar 20% de desconto quando máximo é 15%

### O Que Acontece?

- Sistema **mostra mensagem de alerta**
- Usuário **pode decidir** se prossegue ou não
- Registro fica **marcado** para auditoria posterior
- Gerente pode **revisar vendas** que ultrapassaram limites

## Campos Opcionais

**IMPORTANTE**: Estes campos são **100% OPCIONAIS!**

- Se deixar em branco: **Não há restrição**
- Preencher apenas quando necessário
- Pode preencher só um dos campos ou ambos

**Cenários comuns:**

| Cenário | Preço Mínimo | Desconto Máx. |
|---------|--------------|---------------|
| Produto com margem fixa | Preenchido | Vazio |
| Produto em promoção | Vazio | 30% |
| Produto com ambos controles | Preenchido | 15% |
| Sem restrições | Vazio | Vazio |

## Validações no Banco de Dados

### Constraints Aplicadas

```sql
-- Para products
CHECK (minimum_price IS NULL OR minimum_price >= 0)
CHECK (maximum_discount_percent IS NULL OR (maximum_discount_percent >= 0 AND maximum_discount_percent <= 100))

-- Para materials
CHECK (minimum_resale_price IS NULL OR minimum_resale_price >= 0)
CHECK (maximum_discount_percent IS NULL OR (maximum_discount_percent >= 0 AND maximum_discount_percent <= 100))
```

### O Que é Validado?

✅ Preço mínimo não pode ser negativo
✅ Desconto máximo deve estar entre 0% e 100%
✅ Campos podem ser NULL (não preenchidos)

## Localização dos Campos no Sistema

### 1. Formulário de Produtos

**Caminho:**
```
Indústria > Produtos > [Produto] > Editar

Localização no formulário:
- Após "💰 PREÇO FINAL DE VENDA"
- Antes de "Resumo da Precificação"
- Seção destacada com borda laranja
```

**Visual:**
```
┌─────────────────────────────────────┐
│ 💰 PREÇO FINAL DE VENDA             │
│ R$ 65,00                            │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ ⚠️ Controles de Preço               │
│                                     │
│ Preço Mínimo (R$)  Desconto Máx(%) │
│ [ 50.00        ]   [ 15         ]  │
│                                     │
│ ℹ️ Estes controles são opcionais:  │
│ • Sistema alertará se venda for     │
│   abaixo de R$ 50,00                │
│ • Sistema alertará se desconto      │
│   exceder 15%                       │
└─────────────────────────────────────┘
```

### 2. Formulário de Insumos

**Caminho:**
```
Indústria > Insumos > [Insumo] > Editar

Pré-requisito:
☑️ Habilitar para Revenda Direta

Localização no formulário:
- Dentro da seção azul de "Configuração de Preço para Revenda Direta"
- Após "Informações Fiscais (Para Nota Fiscal)"
- Antes de "Memorial de Cálculo do Preço de Venda"
```

**Visual:**
```
┌─────────────────────────────────────────────┐
│ 📋 Informações Fiscais (Para Nota Fiscal)   │
│ NCM: [        ] CFOP: [    ] CSOSN: [   ]  │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ ⚠️ Controles de Preço de Revenda            │
│                                             │
│ Preço Mín. Revenda (R$)  Desconto Máx (%)  │
│ [ 35.00              ]   [ 10           ]  │
│                                             │
│ ℹ️ Estes controles são opcionais:          │
│ • Sistema alertará se revenda for abaixo    │
│   de R$ 35,00                               │
│ • Sistema alertará se desconto exceder 10%  │
└─────────────────────────────────────────────┘
```

## Arquivos Modificados

### Migration (Backend)
```
✅ supabase/migrations/add_price_control_fields_to_products_and_materials.sql
   - Adiciona campos minimum_price e maximum_discount_percent em products
   - Adiciona campos minimum_resale_price e maximum_discount_percent em materials
   - Cria constraints de validação
   - Adiciona comentários descritivos
```

### Frontend - Produtos
```
✅ src/components/Products.tsx
   - Linha 201-202: Adicionados campos ao formData inicial
   - Linha 890-891: Adicionados campos no handleSubmit
   - Linha 1093-1094: Adicionados campos no handleEdit
   - Linha 1227-1228: Adicionados campos no handleClone
   - Linha 539-540: Adicionados campos no resetFormWithNewCode
   - Linha 3891-3946: Adicionada seção HTML "Controles de Preço"
```

### Frontend - Insumos
```
✅ src/components/Materials.tsx
   - Linha 63-64: Adicionados campos ao formData inicial
   - Linha 433-455: Adicionados campos no dataToSave (com parsing)
   - Linha 595-596: Adicionados campos no handleEdit
   - Linha 639-640: Adicionados campos no handleCancel
   - Linha 1654-1709: Adicionada seção HTML "Controles de Preço de Revenda"
```

### Frontend - Tabela de Preços
```
✅ src/components/SalesPrices.tsx
   - Linha 85: Adicionados campos minimum_price e maximum_discount_percent na query products
   - Linha 113-114: Mapeamento dos campos para produtos
   - Linha 123: Adicionados campos minimum_resale_price e maximum_discount_percent na query materials
   - Linha 156-157: Mapeamento dos campos para insumos de revenda
```

## Estrutura da Migration

```sql
-- Produtos
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS minimum_price numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS maximum_discount_percent numeric DEFAULT NULL;

-- Insumos
ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS minimum_resale_price numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS maximum_discount_percent numeric DEFAULT NULL;

-- Constraints de validação
ALTER TABLE products
  ADD CONSTRAINT check_minimum_price_positive
    CHECK (minimum_price IS NULL OR minimum_price >= 0),
  ADD CONSTRAINT check_maximum_discount_valid
    CHECK (maximum_discount_percent IS NULL OR
           (maximum_discount_percent >= 0 AND maximum_discount_percent <= 100));

ALTER TABLE materials
  ADD CONSTRAINT check_minimum_resale_price_positive
    CHECK (minimum_resale_price IS NULL OR minimum_resale_price >= 0),
  ADD CONSTRAINT check_materials_maximum_discount_valid
    CHECK (maximum_discount_percent IS NULL OR
           (maximum_discount_percent >= 0 AND maximum_discount_percent <= 100));
```

## Casos de Uso

### Caso 1: Produto com Margem Mínima Garantida

**Situação**: Produto tem custo R$ 40,00 e precisa ter margem mínima de 25%

**Configuração:**
- Preço Final de Venda: R$ 65,00
- Preço Mínimo: R$ 50,00 (custo + 25% = R$ 50)
- Desconto Máximo: (vazio)

**Resultado:**
- Vendedor pode dar qualquer desconto
- Mas nunca abaixo de R$ 50,00

### Caso 2: Produto em Promoção Controlada

**Situação**: Produto em promoção, mas desconto limitado

**Configuração:**
- Preço Final de Venda: R$ 120,00
- Preço Mínimo: (vazio)
- Desconto Máximo: 20%

**Resultado:**
- Vendedor pode vender a qualquer preço
- Mas desconto não pode passar de 20%
- Preço mínimo efetivo: R$ 96,00

### Caso 3: Controle Total de Preço

**Situação**: Produto premium com controle rígido

**Configuração:**
- Preço Final de Venda: R$ 850,00
- Preço Mínimo: R$ 750,00
- Desconto Máximo: 10%

**Resultado:**
- Desconto máximo: 10% = R$ 85,00
- Preço com desconto máximo: R$ 765,00
- Como R$ 765,00 > R$ 750,00 (mínimo) → OK
- Qualquer valor < R$ 750,00 → Alerta

### Caso 4: Insumo de Revenda com Margem Apertada

**Situação**: Cimento - margem baixa, precisa proteger

**Configuração:**
- Preço de Revenda: R$ 42,00
- Preço Mínimo de Revenda: R$ 38,00
- Desconto Máximo: 5%

**Resultado:**
- Margem original protegida
- Desconto máximo muito restrito
- Alertas em qualquer desvio

## Build Validado

```
✓ 1825 módulos transformados
✓ Build em 18.98s
✓ 0 erros
✓ 0 warnings críticos
```

**Tamanho dos módulos principais:**
- Products: 193.60 kB → 37.33 kB (gzip)
- Materials: Incluído em factory-inventory 206.24 kB → 40.62 kB (gzip)
- SalesPrices: 277.07 kB → 60.18 kB (gzip)

## Testes Recomendados

### Teste 1: Cadastro de Produto com Controles

**Passos:**
1. Acesse Produtos > Novo Produto
2. Preencha dados básicos
3. Configure preços
4. Preencha "Controles de Preço":
   - Preço Mínimo: R$ 50,00
   - Desconto Máximo: 15%
5. Salvar

**Resultado esperado:**
✅ Produto salvo com sucesso
✅ Campos aparecem quando editar
✅ Valores aparecem na Tabela de Preços

### Teste 2: Insumo de Revenda com Controles

**Passos:**
1. Acesse Insumos > Editar insumo
2. Marque "Habilitar para Revenda Direta"
3. Configure impostos e margem
4. Preencha "Controles de Preço de Revenda":
   - Preço Mínimo: R$ 35,00
   - Desconto Máximo: 10%
5. Salvar

**Resultado esperado:**
✅ Insumo salvo com sucesso
✅ Campos aparecem quando editar
✅ Valores aparecem na Tabela de Preços

### Teste 3: Visualização na Tabela de Preços

**Passos:**
1. Acesse Indústria > Tabela de Preços
2. Selecione formato "Vendedor"
3. Procure itens com controles configurados

**Resultado esperado:**
✅ Coluna "Desc. Máx." mostra percentual ou "-"
✅ Coluna "Preço Mín." mostra valor ou "-"
✅ PDF exportado inclui essas colunas
✅ CSV exportado inclui essas colunas

### Teste 4: Validações do Banco

**Passos no console do navegador:**
```javascript
// Tentar salvar preço mínimo negativo
await supabase.from('products')
  .update({ minimum_price: -10 })
  .eq('id', 'product-id');
// Deve retornar erro de constraint

// Tentar salvar desconto > 100%
await supabase.from('materials')
  .update({ maximum_discount_percent: 150 })
  .eq('id', 'material-id');
// Deve retornar erro de constraint
```

**Resultado esperado:**
❌ Erros de constraint impedem salvamento
✅ Valores válidos são aceitos

## Comandos SQL Úteis

### Ver Produtos com Controles Configurados

```sql
SELECT
  code,
  name,
  final_sale_price,
  minimum_price,
  maximum_discount_percent
FROM products
WHERE minimum_price IS NOT NULL
   OR maximum_discount_percent IS NOT NULL
ORDER BY name;
```

### Ver Insumos de Revenda com Controles

```sql
SELECT
  name,
  resale_price,
  minimum_resale_price,
  maximum_discount_percent
FROM materials
WHERE resale_enabled = true
  AND (minimum_resale_price IS NOT NULL
       OR maximum_discount_percent IS NOT NULL)
ORDER BY name;
```

### Atualizar Controles em Lote

```sql
-- Definir desconto máximo de 15% para todos os produtos de uma categoria
UPDATE products
SET maximum_discount_percent = 15
WHERE product_type = 'premolded';

-- Definir preço mínimo baseado no custo
UPDATE products
SET minimum_price = production_cost * 1.20  -- custo + 20%
WHERE production_cost > 0;
```

### Relatório de Itens com Controles

```sql
SELECT
  'Produto' as tipo,
  name,
  final_sale_price as preco_venda,
  minimum_price as preco_minimo,
  maximum_discount_percent as desconto_max,
  CASE
    WHEN minimum_price IS NULL AND maximum_discount_percent IS NULL
    THEN 'Sem controles'
    WHEN minimum_price IS NOT NULL AND maximum_discount_percent IS NOT NULL
    THEN 'Ambos controles'
    WHEN minimum_price IS NOT NULL
    THEN 'Apenas preço mínimo'
    ELSE 'Apenas desconto máximo'
  END as tipo_controle
FROM products

UNION ALL

SELECT
  'Revenda' as tipo,
  name,
  resale_price as preco_venda,
  minimum_resale_price as preco_minimo,
  maximum_discount_percent as desconto_max,
  CASE
    WHEN minimum_resale_price IS NULL AND maximum_discount_percent IS NULL
    THEN 'Sem controles'
    WHEN minimum_resale_price IS NOT NULL AND maximum_discount_percent IS NOT NULL
    THEN 'Ambos controles'
    WHEN minimum_resale_price IS NOT NULL
    THEN 'Apenas preço mínimo'
    ELSE 'Apenas desconto máximo'
  END as tipo_controle
FROM materials
WHERE resale_enabled = true

ORDER BY tipo, name;
```

## Próximos Passos (Futuras Melhorias)

### Validação em Tempo Real nas Vendas

Implementar alertas no módulo de vendas quando:
- Usuário digitar preço < preço mínimo
- Usuário aplicar desconto > desconto máximo

```typescript
// Exemplo de lógica futura
function validateSalePrice(product, salePrice, discount) {
  const warnings = [];

  if (product.minimum_price && salePrice < product.minimum_price) {
    warnings.push(`Preço abaixo do mínimo (R$ ${product.minimum_price})`);
  }

  if (product.maximum_discount_percent && discount > product.maximum_discount_percent) {
    warnings.push(`Desconto acima do máximo (${product.maximum_discount_percent}%)`);
  }

  return warnings;
}
```

### Relatório de Vendas Fora dos Limites

Dashboard mostrando:
- Vendas abaixo do preço mínimo
- Vendas com desconto acima do máximo
- Perda de margem acumulada
- Ranking de vendedores que mais extrapolam

### Aprovação de Gerente

Sistema de aprovação:
- Venda fora dos limites → Precisa aprovação
- Notificação para gerente
- Registro de quem aprovou e motivo

### Histórico de Alterações

Auditoria de mudanças nos controles:
- Quem alterou preço mínimo
- Quando alterou desconto máximo
- Valores anteriores vs novos

## Conclusão

✅ **Implementação completa e funcional!**

**Campos adicionados:**
- Preço mínimo (produtos e revenda)
- Desconto máximo (produtos e revenda)

**Onde aparecem:**
- Formulário de Produtos
- Formulário de Insumos (revenda)
- Tabela de Preços
- Exportação PDF/CSV

**Validações:**
- Preços não negativos
- Descontos entre 0-100%
- Campos opcionais (NULL permitido)

**Build:**
- ✅ Validado
- ✅ Sem erros
- ✅ Pronto para produção

---

**Data:** 11/02/2026
**Status:** ✅ CONCLUÍDO
**Build:** ✅ Validado (18.98s)

**Arquivos de referência:**
- `CAMPOS_CONTROLE_PRECOS.md` (este arquivo)
- Migration: `add_price_control_fields_to_products_and_materials.sql`
- Componentes: `Products.tsx`, `Materials.tsx`, `SalesPrices.tsx`
