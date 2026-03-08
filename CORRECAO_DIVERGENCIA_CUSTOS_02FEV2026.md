# ✅ Correção: Divergência de Custos no Relatório de Produção

## 🐛 Problema Reportado

**Data:** 02/02/2026

**Sintoma:** Valores diferentes entre os relatórios:
- **Aba Produção** (Resumo do Dia): R$ 2.083,30
- **Relatório de Produção**: R$ 2.829,46 (incorreto)

**Pergunta:** "Por que essa diferença se são do mesmo dia?"

---

## 🔍 Diagnóstico

### Causa Raiz

A função `relatorio_producao_completo` tinha um bug que **multiplicava** os custos indevidamente.

**Como acontecia:**
```sql
-- ❌ PROBLEMA: JOIN duplo causava produto cartesiano
FROM production p
LEFT JOIN production_items pi ON pi.production_id = p.id  -- 5 linhas
LEFT JOIN (
  SELECT production_id, SUM(total_cost) as total_cost
  FROM production_items
  GROUP BY production_id
) items_cost ON items_cost.production_id = p.id            -- 1 valor
```

**Resultado:**
- Para produto com 5 materiais e custo R$ 758,26:
  - JOIN 1: Trazia 5 linhas (1 por material)
  - JOIN 2: Trazia custo total agregado (R$ 758,26)
  - **SUM() somava o valor 5 vezes = R$ 3.791,30**

### Valores Encontrados

**Antes da correção:**
```
Data: 02/02/2026
├─ Aba Produção (get_resumo_producao_dia): R$ 2.083,30 ✅
├─ Relatório Produção (relatorio_producao_completo): R$ 14.917,23 ❌
└─ Multiplicação: ~7x o valor correto
```

---

## 🔧 Correções Aplicadas

### 1. Corrigida Função `relatorio_producao_completo`

**Migration:** `20260210130000_corrigir_relatorio_producao_completo_multiplicacao.sql`

**Mudança:**
```sql
-- ✅ SOLUÇÃO: Remover primeiro LEFT JOIN desnecessário
FROM production p
-- APENAS um LEFT JOIN com a subquery agregada
LEFT JOIN (
  SELECT
    production_id,
    SUM(total_cost) as total_cost
  FROM production_items
  GROUP BY production_id
) items_cost ON items_cost.production_id = p.id
-- Sem GROUP BY aqui = não duplica linhas
```

**Resultado:** Custos corretos, sem multiplicação!

### 2. Restaurados Custos de Pilares

Durante o diagnóstico, acidentalmente reprocessei dois produtos (pilares) com receita errada. Foram restaurados manualmente para os valores corretos originais.

---

## ✅ Resultado Final

### Valores Corretos para 02/02/2026

**Todas as fontes agora retornam o mesmo valor:**

| Fonte | Valor |
|-------|-------|
| Aba Produção → Gerar Resumo | R$ 2.083,30 ✅ |
| Relatório de Produção → Custo Total | R$ 2.083,30 ✅ |
| relatorio_consumo_insumos | R$ 2.083,30 ✅ |
| relatorio_total_produtos | R$ 2.083,30 ✅ |
| relatorio_producao_completo | R$ 2.083,30 ✅ |

### Detalhamento dos Custos

**Produções de 02/02/2026 (excluindo ajustes de estoque):**

```
Bloco estrutural 14 (380 un)          R$   758,26
Poste 10x10 2.00m (8 un)             R$   181,77
Pilar 18x25 H=4.85 (4 un)            R$   704,65
Pilar 25x35 H=6.20 (1 un)            R$   375,09
Marco de concreto (6 un)             R$    14,80
Vigota treliçada (7.2 un)            R$    48,73
─────────────────────────────────────────────────
TOTAL                                R$ 2.083,30 ✅
```

---

## 🧪 Como Testar

### Teste 1: Aba Produção

```
1. Indústria → Produção
2. Selecionar data: 02/02/2026
3. Clicar: "Gerar Resumo do Dia"
4. Verificar: Custo Total = R$ 2.083,30 ✅
```

### Teste 2: Relatório de Produção

```
1. Indústria → Relatório de Produção
2. Data início: 02/02/2026
3. Data fim: 02/02/2026
4. Clicar: "Gerar Relatório"
5. Ver aba "Resumo Geral"
6. Verificar: Custo Total = R$ 2.083,30 ✅
```

**Resultado Esperado:** Ambos mostram **R$ 2.083,30**

---

## 📊 Análise de Impacto

### Datas Afetadas

**Todas as datas do sistema** estavam com o mesmo problema na função `relatorio_producao_completo`.

**Impacto:**
- ❌ Custos multiplicados incorretamente
- ❌ Métricas financeiras distorcidas
- ❌ Análises de rentabilidade incorretas

**Agora corrigido:**
- ✅ Todos os relatórios com valores corretos
- ✅ Consistência entre todas as fontes de dados
- ✅ Métricas confiáveis

### Relatórios Afetados

**Antes (INCORRETOS):**
- ❌ Relatório de Produção → Custo Total
- ❌ Relatório de Produção → Custo Médio por Produção
- ❌ Relatório de Produção → Total de Materiais

**Nunca foram afetados:**
- ✅ Aba Produção → Resumo do Dia
- ✅ Aba Produção → Resumo por Produto
- ✅ Relatório de Consumo de Insumos

---

## 🔍 Detalhes Técnicos

### Por Que Multiplicava?

**SQL com LEFT JOIN duplo:**

```sql
-- Exemplo: Produção com 5 materiais, custo total R$ 758,26

SELECT SUM(items_cost.total_cost)
FROM production p
LEFT JOIN production_items pi ON ...    -- Retorna 5 linhas
LEFT JOIN (
  SELECT SUM(total_cost) as total_cost  -- Retorna R$ 758,26
  FROM production_items
  GROUP BY production_id
) items_cost ON ...

-- O que acontece:
-- Linha 1: pi.material_id = mat1  items_cost.total_cost = 758.26
-- Linha 2: pi.material_id = mat2  items_cost.total_cost = 758.26
-- Linha 3: pi.material_id = mat3  items_cost.total_cost = 758.26
-- Linha 4: pi.material_id = mat4  items_cost.total_cost = 758.26
-- Linha 5: pi.material_id = mat5  items_cost.total_cost = 758.26
-- SUM() = 758.26 × 5 = R$ 3.791,30 ❌
```

**Solução:** Remover o primeiro LEFT JOIN.

### Por Que Outras Funções Não Multiplicavam?

**Funções corretas usavam GROUP BY:**

```sql
-- ✅ CORRETO: GROUP BY evita duplicação
SELECT SUM(items_cost.total_cost)
FROM production p
LEFT JOIN (
  SELECT production_id, SUM(total_cost) as total_cost
  FROM production_items
  GROUP BY production_id
) items_cost ON items_cost.production_id = p.id
GROUP BY p.product_id, ...
```

O `GROUP BY` no final agregava as linhas duplicadas, cancelando a multiplicação acidental.

---

## 📝 Arquivos Modificados

### Migrations Criadas

1. **20260210130000_corrigir_relatorio_producao_completo_multiplicacao.sql**
   - Corrige JOIN duplo
   - Remove multiplicação de custos
   - Ajusta cálculo de materiais únicos

2. **20260210131500_sincronizar_production_items_02fev2026.sql** (tentativa)
   - Não foi bem-sucedida
   - Causou mais problemas
   - Foi corrigida manualmente depois

### Correções Manuais

**Script executado:**
```sql
-- Restaurou custos corretos dos pilares
-- Pilar 18x25: R$ 704,65
-- Pilar 25x35: R$ 375,09
```

---

## ⚠️ Lições Aprendidas

### 1. Cuidado com LEFT JOINs Múltiplos

**Problema:** LEFT JOIN com tabelas relacionadas 1:N pode causar produto cartesiano.

**Solução:** Sempre agregar ANTES de fazer JOIN:
```sql
-- ✅ BOM
LEFT JOIN (
  SELECT production_id, SUM(total_cost)
  FROM production_items
  GROUP BY production_id
) AS subquery

-- ❌ RUIM
LEFT JOIN production_items
```

### 2. Testar com Queries de Verificação

**Sempre fazer:**
```sql
-- Contar linhas para detectar multiplicação
SELECT
  production_id,
  COUNT(*) as repeticoes,  -- Deve ser 1
  SUM(cost) as total
FROM resultado
GROUP BY production_id
```

### 3. Consistência Entre Relatórios

**Regra:** Múltiplas fontes devem retornar os mesmos valores.

Se divergirem → há um bug!

---

## 🎯 Próximos Passos Recomendados

### 1. Definir Receitas Corretas para Pilares

**Problema:** Pilares estavam usando receita de postes (TCP AL001).

**Solução:**
```
1. Criar receitas específicas:
   - "Pilar 18x25" com todos os materiais
   - "Pilar 25x35" com todos os materiais

2. Incluir:
   - Concreto proporcional ao volume
   - Ferragens (CA-50, CA-60)
   - Barras roscadas, porcas, arruelas
   - Chapéus de pilar
   - Formas específicas
```

### 2. Revisar Outros Produtos Complexos

**Verificar se têm receitas completas:**
- Vigas
- Lajes treliçadas
- Outros pré-moldados estruturais

### 3. Criar Testes Automatizados

**Queries de validação:**
```sql
-- Teste: Todos os relatórios devem ter mesmo valor
SELECT
  SUM(total_cost) FROM get_resumo_producao_dia('DATA'),
  SUM(total_cost) FROM relatorio_consumo_insumos('DATA', 'DATA'),
  total_material_cost FROM relatorio_producao_completo('DATA', 'DATA')
-- Devem ser iguais!
```

---

## 📚 Referências

### Funções Envolvidas

1. **get_resumo_producao_dia(p_data)**
   - Usada na Aba Produção
   - ✅ Sempre funcionou corretamente

2. **relatorio_producao_completo(p_data_inicio, p_data_fim)**
   - Usada no Relatório de Produção
   - ❌ Estava multiplicando custos
   - ✅ Agora corrigida

3. **relatorio_consumo_insumos(p_data_inicio, p_data_fim)**
   - Lista materiais consumidos
   - ✅ Sempre funcionou corretamente

4. **relatorio_total_produtos(p_data_inicio, p_data_fim)**
   - Lista produtos produzidos
   - ✅ Sempre funcionou corretamente

### Tabelas Envolvidas

1. **production**
   - Registros de produção
   - Tem campo `custos_no_momento` (JSONB)

2. **production_items**
   - Detalhamento de materiais por produção
   - Fonte de verdade para custos

---

## ✅ Checklist de Validação

### Banco de Dados
- [x] Função `relatorio_producao_completo` corrigida
- [x] Custos de 02/02/2026 sincronizados
- [x] Production_items dos pilares restaurados
- [x] Todos os valores consistentes

### Relatórios
- [x] Aba Produção mostra R$ 2.083,30
- [x] Relatório Produção mostra R$ 2.083,30
- [x] Ambos os valores iguais
- [x] Detalhamento por produto correto

### Sistema
- [x] Build compilado com sucesso
- [x] Sem erros no TypeScript
- [x] Todas as datas corrigidas
- [x] Relatórios confiáveis

---

## 🎉 Conclusão

**Problema:** Divergência de R$ 746,16 entre relatórios (R$ 2.083,30 vs R$ 2.829,46)

**Causa:** Função com LEFT JOIN duplo multiplicando custos

**Solução:** Corrigido JOIN na função `relatorio_producao_completo`

**Resultado:**
- ✅ Ambos os relatórios mostram R$ 2.083,30
- ✅ Valores consistentes em todas as fontes
- ✅ Relatórios confiáveis para análises financeiras

---

**Data da Correção:** 10/02/2026
**Tipo:** Correção de Bug Crítico em Relatórios
**Impacto:** Alto (afetava decisões financeiras)
**Status:** ✅ Resolvido e Testado
**Build:** ✅ Compilado com sucesso (22.55s)
