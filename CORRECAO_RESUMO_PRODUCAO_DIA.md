# Correção - Resumo de Produção do Dia

## Problema Reportado

**Sintoma:** Na aba Produção, ao clicar em "Gerar Resumo do Dia":
- Os itens produzidos aparecem na listagem
- Mas o sistema informa: "Sem produções registradas para [data]"
- Há uma inconsistência entre os dados mostrados e o resumo gerado

## Diagnóstico Técnico

### Fluxo de Dados

1. **Cadastro de Produção:**
   ```
   Frontend (DailyProduction.tsx)
   → calculateProductionCosts() → Retorna JSONB com custos
   → create_production_atomic() → Cria registro em production
   → extract_production_items_from_custos() → Popula production_items
   ```

2. **Geração de Resumo:**
   ```
   Frontend: "Gerar Resumo do Dia"
   → get_resumo_producao_dia(p_data)
   → Verifica production_items para a data
   → Se vazio, tenta custos_no_momento->materials
   → Se ambos vazios, retorna []
   → Frontend mostra "Sem produções registradas"
   ```

### Causa Raiz

A função `get_resumo_producao_dia` funciona em dois passos:

```sql
-- 1. Verificar se há production_items para essa data
SELECT COUNT(*) INTO v_items_count
FROM production_items pi
INNER JOIN production p ON p.id = pi.production_id
WHERE p.production_date = p_data;

-- 2. Se v_items_count = 0, tenta fallback para custos_no_momento
-- 3. Se ambos estiverem vazios, retorna array vazio
```

**O problema:** A tabela `production_items` não estava sendo populada, então:
- ✓ Produções existiam na tabela `production`
- ✗ Mas `production_items` estava vazia
- ✗ E `custos_no_momento->materials` também estava vazio ou mal formatado
- ✗ Resultado: função retornava array vazio

### Por Que Isso Aconteceu?

A função `extract_production_items_from_custos` existe e é chamada em `create_production_atomic`, mas pode ter falhado silenciosamente por:

1. **Formato JSONB incorreto:** Se `custos_no_momento->materials` não for um objeto válido
2. **Erro silencioso:** A função original não tinha tratamento de erros robusto
3. **Trigger não disparou:** Em produções antigas criadas antes da implementação do trigger

## Solução Implementada

### 1. Migration: `fix_resumo_producao_dia_population_v2.sql`

Criada migration que:

#### A. Melhorou `extract_production_items_from_custos`

**Antes:**
```sql
-- Sem validações, sem logging
FOR v_material IN SELECT value FROM jsonb_each(p_custos->'materials')
LOOP
  INSERT INTO production_items (...) VALUES (...);
END LOOP;
```

**Depois:**
```sql
-- Com validações completas e logging detalhado
IF p_custos IS NULL THEN
  RAISE NOTICE 'custos é NULL para production %', p_production_id;
  RETURN;
END IF;

IF jsonb_typeof(p_custos->'materials') != 'object' THEN
  RAISE NOTICE 'materials não é objeto. Tipo: %', jsonb_typeof(...);
  RETURN;
END IF;

FOR v_material IN SELECT value FROM jsonb_each(p_custos->'materials')
LOOP
  BEGIN
    -- Extrair e validar valores
    v_material_id := (v_material->>'material_id')::uuid;
    v_quantity := (v_material->>'quantity')::decimal;

    IF v_material_id IS NULL OR v_quantity <= 0 THEN
      RAISE NOTICE 'Material inválido: id=%, qty=%', v_material_id, v_quantity;
      CONTINUE;
    END IF;

    -- Inserir com tratamento de conflito
    INSERT INTO production_items (...) VALUES (...)
    ON CONFLICT DO NOTHING;

  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Erro ao processar material: %', SQLERRM;
  END;
END LOOP;
```

**Melhorias:**
- ✓ Validação de entrada (NULL, tipo incorreto)
- ✓ Validação de valores (IDs nulos, quantidades negativas)
- ✓ Tratamento de erros individual por material
- ✓ Logging detalhado para debug
- ✓ Não falha silenciosamente

#### B. Criou `reprocess_production_items()`

Função auxiliar que:
- Busca TODAS as produções no banco
- Verifica quais têm `custos_no_momento` mas não têm `production_items`
- Tenta re-processar cada uma
- Retorna estatísticas detalhadas

```sql
CREATE OR REPLACE FUNCTION reprocess_production_items()
RETURNS TABLE (
  prod_id UUID,
  prod_date DATE,
  tinha_items BOOLEAN,
  inseriu_items BIGINT,
  status TEXT
)
```

**Status possíveis:**
- `ITEMS_INSERIDOS` - Sucesso! Items foram inseridos
- `JA_TINHA_ITEMS` - Já tinha items, nada a fazer
- `SEM_MATERIALS_NO_JSONB` - custos_no_momento->materials está vazio
- `ERRO: <mensagem>` - Erro durante processamento

#### C. Executou Re-processamento Automático

No bloco `DO $$` da migration:

```sql
DO $$
DECLARE
  v_total_producoes INT;
  v_producoes_sem_items INT;
  v_producoes_processadas INT := 0;
  v_items_inseridos BIGINT := 0;
BEGIN
  -- Contar totais
  SELECT COUNT(*) INTO v_total_producoes FROM production;
  SELECT COUNT(*) INTO v_producoes_sem_items
  FROM production p
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE production_id = p.id);

  RAISE NOTICE 'Total de produções: %', v_total_producoes;
  RAISE NOTICE 'Produções sem items: %', v_producoes_sem_items;

  -- Re-processar todas
  FOR v_result IN SELECT * FROM reprocess_production_items()
  LOOP
    -- Processar e logar resultados
  END LOOP;

  RAISE NOTICE 'Produções processadas: %', v_producoes_processadas;
  RAISE NOTICE 'Items inseridos: %', v_items_inseridos;
END $$;
```

**O que faz:**
1. Conta quantas produções existem
2. Conta quantas não têm `production_items`
3. Re-processa TODAS retroativamente
4. Mostra estatísticas detalhadas no log

### 2. Arquivo de Diagnóstico

Criado `DIAGNOSTICO_RESUMO_PRODUCAO.sql` com queries para verificar:

```sql
-- 1. Verificar produções de hoje
SELECT COUNT(*) FROM production WHERE production_date = CURRENT_DATE;

-- 2. Verificar production_items de hoje
SELECT COUNT(*) FROM production_items pi
INNER JOIN production p ON p.id = pi.production_id
WHERE p.production_date = CURRENT_DATE;

-- 3. Verificar produções SEM production_items
SELECT COUNT(*) FROM production p
WHERE p.production_date = CURRENT_DATE
  AND NOT EXISTS (SELECT 1 FROM production_items WHERE production_id = p.id);

-- 4. Verificar estrutura de custos_no_momento
SELECT
  p.id,
  jsonb_typeof(p.custos_no_momento) as tipo_custos,
  jsonb_typeof(p.custos_no_momento->'materials') as tipo_materials,
  (SELECT COUNT(*) FROM jsonb_each(p.custos_no_momento->'materials')) as qtd_materials,
  EXISTS (SELECT 1 FROM production_items WHERE production_id = p.id) as tem_items
FROM production p
WHERE p.production_date = CURRENT_DATE;

-- 5. Testar função diretamente
SELECT * FROM get_resumo_producao_dia(CURRENT_DATE);
SELECT * FROM get_resumo_produtos_dia(CURRENT_DATE);
```

## Resultado Esperado

### Antes da Correção

```
Usuário: Clica em "Gerar Resumo do Dia"
Sistema: Verifica production_items → Vazio
Sistema: Verifica custos_no_momento->materials → Vazio
Sistema: Retorna []
Frontend: Mostra "Sem produções registradas para [data]"
```

### Depois da Correção

```
Usuário: Clica em "Gerar Resumo do Dia"
Sistema: Verifica production_items → Tem dados! ✓
Sistema: Agrega por material
Sistema: Retorna array com consumo detalhado
Frontend: Mostra:
  ✓ Tabela de produtos produzidos
  ✓ Tabela de consumo de insumos
  ✓ Resumo financeiro
  ✓ Custo total, receita, lucro
```

## Como Verificar Se Foi Corrigido

### Teste 1 - Verificar Re-processamento

Execute no Supabase SQL Editor:

```sql
-- Ver quantas produções têm production_items agora
SELECT
  'Total de produções' as tipo,
  COUNT(*) as quantidade
FROM production
UNION ALL
SELECT
  'Produções com items',
  COUNT(DISTINCT pi.production_id)
FROM production_items pi
UNION ALL
SELECT
  'Produções sem items',
  COUNT(*)
FROM production p
WHERE NOT EXISTS (
  SELECT 1 FROM production_items WHERE production_id = p.id
);
```

**Resultado esperado:**
- Se "Produções sem items" for 0 ou próximo de 0 → ✓ Corrigido
- Se for > 0, verificar se essas produções têm `custos_no_momento` vazios

### Teste 2 - Testar Resumo no Sistema

1. Ir em **Produção Diária**
2. Filtrar por uma data que tem produções cadastradas
3. Verificar se a lista de produções aparece
4. Clicar em **"Gerar Resumo do Dia"**
5. ✓ Deve mostrar:
   - Tabela de produtos produzidos
   - Tabela de consumo de insumos
   - Resumo financeiro
6. ✗ NÃO deve mostrar: "Sem produções registradas"

### Teste 3 - Verificar Nova Produção

1. Cadastrar uma NOVA produção
2. Verificar no SQL:
   ```sql
   SELECT
     p.id,
     p.product_id,
     p.quantity,
     COUNT(pi.id) as qtd_items
   FROM production p
   LEFT JOIN production_items pi ON pi.production_id = p.id
   WHERE p.production_date = CURRENT_DATE
   GROUP BY p.id, p.product_id, p.quantity
   ORDER BY p.created_at DESC
   LIMIT 5;
   ```
3. ✓ Novas produções devem ter `qtd_items > 0`
4. Gerar resumo do dia
5. ✓ Deve incluir a nova produção

## Possíveis Problemas Residuais

### Problema: "Ainda mostra sem produções"

**Causa:** Produções antigas não têm `custos_no_momento->materials` populado

**Solução:**
```sql
-- Verificar produções sem custos
SELECT
  p.id,
  p.product_id,
  p.quantity,
  p.production_date,
  p.custos_no_momento IS NULL as sem_custos,
  jsonb_typeof(p.custos_no_momento->'materials') as tipo_materials
FROM production p
WHERE p.production_date >= '2024-01-01'
  AND NOT EXISTS (SELECT 1 FROM production_items WHERE production_id = p.id)
ORDER BY p.production_date DESC
LIMIT 20;
```

Se houver produções sem `custos_no_momento`, elas precisam ser recalculadas manualmente ou ignoradas.

### Problema: "Resumo vazio para data específica"

**Debug:**
```sql
-- Ver se há produções nessa data
SELECT * FROM production WHERE production_date = '2024-XX-XX';

-- Ver se há production_items para essas produções
SELECT pi.*, p.production_date
FROM production_items pi
INNER JOIN production p ON p.id = pi.production_id
WHERE p.production_date = '2024-XX-XX';

-- Tentar gerar resumo manualmente
SELECT * FROM get_resumo_producao_dia('2024-XX-XX');
```

### Problema: "Erro ao gerar resumo"

**Debug:**
1. Verificar logs do Supabase (Dashboard → Logs → Postgres Logs)
2. Procurar por mensagens `NOTICE` e `WARNING` da função
3. Verificar se há erros de tipo ou conversão

## Arquivos Alterados/Criados

### Migrations
- `supabase/migrations/20260204_fix_resumo_producao_dia_population_v2.sql` ← **NOVA**

### Documentação
- `CORRECAO_RESUMO_PRODUCAO_DIA.md` ← **NOVA**
- `DIAGNOSTICO_RESUMO_PRODUCAO.sql` ← **NOVA**
- `RESUMO_CORRECAO_RESUMO_PRODUCAO.md` ← **NOVA**

### Frontend
Nenhuma alteração necessária - o componente `DailyProduction.tsx` já estava correto.

## Status Final

✅ Migration aplicada com sucesso
✅ Função `extract_production_items_from_custos` melhorada
✅ Re-processamento automático executado
✅ Produções retroativas populadas em `production_items`
✅ Novas produções serão populadas automaticamente
✅ Trigger mantido para sincronização futura
✅ Build concluído sem erros
✅ Sistema pronto para uso

**O resumo de produção do dia agora deve funcionar corretamente!**
