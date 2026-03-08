# Como Verificar Se o Resumo de Produção Está Funcionando

## Teste Rápido no Sistema

### 1. Teste "Gerar Resumo do Dia"

1. Ir em **Produção Diária**
2. Selecionar uma data que tem produções cadastradas
3. Clicar em **"Gerar Resumo do Dia"**

**✓ FUNCIONOU** se aparecer:
- Tabela de produtos produzidos
- Tabela de consumo de insumos
- Resumo financeiro

**✗ PROBLEMA** se mostrar:
- "Sem produções registradas"

### 2. Teste "Relatório de Produção"

1. Ir em **Relatórios → Relatório de Produção**
2. Selecionar período (ex: 01/02 a 05/02)
3. Clicar em **"Gerar Relatório"**

**✓ FUNCIONOU** se aparecer:
- Aba Resumo Geral com totais
- Aba Produtos com lista de produzidos
- Aba Materiais com consumo agregado

**✗ PROBLEMA** se:
- Todas as abas vazias

---

## Teste Rápido no SQL

Execute no **Supabase SQL Editor**:

```sql
-- Verificar se production_items está populada
SELECT
  'Total de produções' as tipo,
  COUNT(*) as quantidade
FROM production
UNION ALL
SELECT
  'Produções em production_items',
  COUNT(DISTINCT production_id)
FROM production_items;
```

**✓ FUNCIONOU** se:
- Ambos os números forem próximos (ex: 250 produções, 248 em items)

**✗ PROBLEMA** se:
- production_items = 0

---

## Se Não Funcionar

Execute o diagnóstico completo:
```
DIAGNOSTICO_PRODUCAO_COMPLETO.sql
```

Veja análise detalhada em:
```
SOLUCAO_RESUMO_PRODUCAO_FINAL.md
```

---

**Resumo:** O sistema foi corrigido para popular `production_items` automaticamente. Todas as produções históricas foram re-processadas. Os resumos e relatórios devem funcionar normalmente.
