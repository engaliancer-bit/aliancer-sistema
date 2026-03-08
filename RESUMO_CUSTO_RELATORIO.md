# Resumo: Correção de Custos e Margem no Relatório

## O Que Foi Corrigido

### Problema
O relatório de produção mostrava custo **R$ 0,00** quando a produção não tinha custos calculados nos materiais consumidos.

### Solução
Agora o sistema busca o **custo teórico** configurado no cadastro do produto quando o custo real não estiver disponível.

## Novas Colunas no Relatório

| Coluna | O Que Mostra | Exemplo |
|--------|--------------|---------|
| **Custo Real** | Custo dos materiais usados na produção | R$ 14,50 |
| **Custo Teórico** | Custo configurado no produto | R$ 15,00 |
| **Custo Final** | Custo efetivo (real ou teórico) | R$ 14,50 |
| **Preço Venda** | Preço de venda do produto | R$ 22,00 |
| **Margem Real** | Lucro por unidade | R$ 7,50 |
| **% Margem** | Percentual de lucro | 34,1% |

## Indicadores Visuais

### Cores da Margem
- 🟢 **Verde**: Produto com lucro (margem positiva)
- 🔴 **Vermelho**: Produto com prejuízo (margem negativa)

### Custo Final
- **Preto**: Usando custo real (materiais registrados)
- 🔵 **Azul + "Teórico"**: Usando custo do cadastro do produto

## Como Funciona

### Caso 1: Produção com Custos Reais
```
Produção de 100 vigotas
└─ Materiais consumidos: R$ 1.450,00
└─ Custo real: R$ 14,50/un (1450 ÷ 100)
└─ Sistema usa: CUSTO REAL
```

### Caso 2: Produção SEM Custos Reais
```
Produção de 100 vigotas
└─ Materiais NÃO registrados
└─ Custo teórico no produto: R$ 15,00/un
└─ Sistema usa: CUSTO TEÓRICO (azul)
```

## Onde Busca o Custo Teórico

O sistema busca nesta ordem:
1. `production_cost` (Custo de Produção)
2. `material_cost` (Custo de Material)
3. `manual_unit_cost` (Custo Manual)

Se nenhum estiver configurado, mostra **R$ 0,00**.

## Exemplos Práticos

### Exemplo 1: Vigota com Lucro
```
Produto: Vigota 12m
Quantidade: 100 m
Custo Final: R$ 15,00/m (teórico, em azul)
Preço Venda: R$ 22,00/m
Margem Real: R$ 7,00/m (verde)
% Margem: 31,8% (verde)
```

### Exemplo 2: Bloco com Prejuízo
```
Produto: Bloco Especial
Quantidade: 200 un
Custo Final: R$ 27,50/un (real, em preto)
Preço Venda: R$ 24,00/un
Margem Real: -R$ 3,50/un (vermelho)
% Margem: -14,6% (vermelho)
```

### Exemplo 3: Marco Concreto com Lucro
```
Produto: Marco 14x19
Quantidade: 50 un
Custo Final: R$ 29,00/un (real, em preto)
Preço Venda: R$ 42,00/un
Margem Real: R$ 13,00/un (verde)
% Margem: 31,0% (verde)
```

## Como Usar

1. Abra **Relatório de Produção**
2. Selecione o período (ex: 01/02 a 05/02)
3. Clique em **"Gerar Relatório"**
4. Vá na aba **"Produtos Produzidos"**
5. Analise:
   - Produtos em **azul**: Não tem custo real, usando teórico
   - Produtos em **vermelho**: Prejuízo, precisa ajustar preço ou custo
   - Produtos em **verde**: Lucro, está bom

## Ações Recomendadas

### Se aparecer em Azul "Teórico"
→ Os materiais da produção não foram registrados corretamente
→ Configure os custos no cadastro do produto

### Se aparecer em Vermelho (Prejuízo)
→ O custo está maior que o preço de venda
→ Opções:
   - Aumentar preço de venda
   - Reduzir custos de produção
   - Verificar se houve erro no registro

### Se aparecer Custo R$ 0,00
→ Produto não tem custo configurado
→ Vá no cadastro do produto e configure:
   - Custo de Produção, ou
   - Custo de Material, ou
   - Custo Manual

## Configurar Custos no Produto

1. Vá em **Produtos**
2. Edite o produto
3. Preencha um dos campos:
   - **Custo de Produção** (production_cost)
   - **Custo de Material** (material_cost)
   - **Custo Manual** (manual_unit_cost)
4. Preencha também:
   - **Preço de Venda** (sale_price)
   - **Preço Final** (final_sale_price)

## Benefícios

✅ Nunca mais aparece custo zerado
✅ Identifica produtos com prejuízo
✅ Analisa margem real de cada produto
✅ Compara custo real vs teórico
✅ Indicadores visuais claros

## Dúvidas Frequentes

**P: Por que aparece "Teórico" em azul?**
R: Porque os materiais da produção não foram registrados. O sistema usa o custo configurado no cadastro do produto.

**P: Como faço para usar sempre o custo real?**
R: Registre corretamente os materiais consumidos em cada produção. O sistema vai calcular automaticamente.

**P: O que fazer se a margem está negativa?**
R: Verifique se o preço de venda está correto e se os custos estão sendo calculados corretamente. Pode ser necessário ajustar o preço ou otimizar a produção.

**P: Posso confiar no custo teórico?**
R: O custo teórico é uma estimativa. O ideal é ter o custo real dos materiais para uma análise precisa.

**P: Como o sistema calcula a margem?**
R: Margem = Preço de Venda - Custo Final
% Margem = (Margem ÷ Preço de Venda) × 100

## Arquivos Modificados

- **Backend**: Migration SQL para função `relatorio_total_produtos`
- **Frontend**: `src/components/ProductionReport.tsx`
- **View**: `v_producao_com_custos` (consultas auxiliares)

## Status

✅ Implementado
✅ Testado
✅ Documentado
✅ Build compilado
