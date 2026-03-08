# Correção - Botão "Gerar Resumo do Dia"

## Problema Identificado

O botão "Gerar Resumo do Dia" na aba Produção não estava funcionando corretamente:

1. **RPC antiga ineficiente:** Usava `get_material_costs_report` que buscava de `custos_no_momento->materials`
2. **Dados vazios:** Produções antigas têm `custos_no_momento.materials = {}` (vazio)
3. **Tabela não populada:** `production_items` existe mas não tinha dados das produções antigas
4. **Sem diagnóstico:** Erros eram silenciados, usuário não sabia o que estava errado
5. **Sem retry:** Se falhasse, usuário precisava recarregar a página

## Causa Raiz

### Estrutura de Dados

O sistema tem DUAS formas de armazenar custos de produção:

#### 1. JSONB `custos_no_momento` (formato antigo)
```json
{
  "materials": {
    "uuid-material-1": {
      "material_id": "uuid",
      "name": "Cimento",
      "quantity": 50.5,
      "unit": "kg",
      "unit_price": 0.75,
      "total": 37.88
    }
  },
  "total_cost": 37.88,
  "calculated_at": "2026-02-04T12:00:00Z"
}
```

#### 2. Tabela `production_items` (formato novo)
```sql
CREATE TABLE production_items (
  id UUID PRIMARY KEY,
  production_id UUID REFERENCES production(id),
  material_id UUID REFERENCES materials(id),
  material_name TEXT,
  quantity DECIMAL,
  unit TEXT,
  unit_cost DECIMAL,
  total_cost DECIMAL
);
```

### Problema das Produções Antigas

Produções de 2026-02-03 (e outras antigas):
- ✅ Têm `custos_no_momento` definido
- ❌ Mas `materials` está vazio: `{}`
- ❌ NÃO têm registros em `production_items`
- ❌ Motivo: Cálculo de custos não funcionou corretamente na época

**Exemplo:**
```sql
SELECT custos_no_momento FROM production WHERE production_date = '2026-02-03' LIMIT 1;
-- Resultado: {"materials": {}, "total_cost": 0, "calculated_at": "..."}
```

## Solução Implementada

### 1. Nova RPC: `get_resumo_producao_dia`

**Arquivo:** `supabase/migrations/corrigir_resumo_producao_dia.sql`

```sql
CREATE OR REPLACE FUNCTION get_resumo_producao_dia(p_data DATE)
RETURNS TABLE (
  material_id UUID,
  material_name TEXT,
  total_quantity NUMERIC,
  unit TEXT,
  avg_unit_cost NUMERIC,
  total_cost NUMERIC,
  usage_count BIGINT,
  source TEXT
)
```

**Características:**
- ✅ Busca de `production_items` (fonte principal, mais rápida)
- ✅ Fallback para `custos_no_momento` se `production_items` vazio
- ✅ Retorna `source` indicando de onde veio os dados
- ✅ Logs detalhados via `RAISE NOTICE`
- ✅ Filtra "ajuste de estoque"
- ✅ Agrega por material com SUM, AVG

**Lógica:**
```sql
1. Conta quantos production_items existem para a data
2. Conta quantas produções existem para a data
3. SE production_items > 0:
     Buscar de production_items (JOIN production ON production_date)
4. SENÃO:
     Buscar de custos_no_momento->materials (fallback)
5. Retornar agregação por material
```

### 2. Nova RPC: `get_resumo_produtos_dia`

```sql
CREATE OR REPLACE FUNCTION get_resumo_produtos_dia(p_data DATE)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  product_code TEXT,
  total_quantity NUMERIC,
  unit TEXT,
  production_count BIGINT
)
```

**Características:**
- ✅ Agrega produções por produto
- ✅ Soma quantidades de múltiplas produções do mesmo produto
- ✅ Conta número de registros de produção
- ✅ Filtra "ajuste de estoque"

### 3. Frontend Atualizado

**Arquivo:** `src/components/DailyProduction.tsx`

#### Função `generateConsumptionSummary` reescrita

**Antes (ERRADO):**
```typescript
const { data, error } = await supabase.rpc('get_material_costs_report', {
  p_start_date: filterDate,
  p_end_date: filterDate
});

if (error) throw error; // Sem detalhes

// Processamento local no frontend (lento)
```

**Depois (CORRETO):**
```typescript
// 1. BUSCAR CONSUMO DE INSUMOS
const { data: materialReport, error: materialError } = await supabase.rpc(
  'get_resumo_producao_dia',
  { p_data: filterDate }
);

if (materialError) {
  console.error('Erro na RPC:', materialError);
  throw new Error(
    `Erro ao buscar consumo: ${materialError.message}` +
    `${materialError.details ? ` - ${materialError.details}` : ''}`
  );
}

// 2. VERIFICAR SE HÁ DADOS
if (!materialReport || materialReport.length === 0) {
  console.log('Nenhum consumo encontrado');
  alert(`Sem produções registradas para ${filterDate}`);
  setShowConsumption(true); // Mostra seção vazia
  return;
}

// 3. BUSCAR RESUMO DE PRODUTOS
const { data: productsReport, error: productsError } = await supabase.rpc(
  'get_resumo_produtos_dia',
  { p_data: filterDate }
);

// 4. PROCESSAR DADOS (mínimo processamento, já agregado no banco)
```

#### Tratamento de Erros Melhorado

```typescript
catch (error: any) {
  console.error('ERRO ao gerar resumo:', error);

  const errorMessage = error.message || 'Erro desconhecido';
  const errorDetails = error.details || error.hint || '';

  alert(
    `Erro ao gerar resumo do dia:\n\n` +
    `${errorMessage}\n\n` +
    `${errorDetails ? `Detalhes: ${errorDetails}\n\n` : ''}` +
    `Data: ${filterDate}\n\n` +
    `Verifique o console (F12) para mais informações.`
  );

  setShowConsumption(false); // Limpar estado
}
```

#### Botão "Tentar Novamente"

```typescript
{materialConsumption.length === 0 ? (
  <div className="text-center py-12">
    <div className="text-gray-500 mb-4">
      <p className="text-lg font-medium">Nenhum consumo de insumo encontrado</p>
      <p className="text-sm mt-2">
        Não há registros de produção para {filterDate} ou os custos não foram calculados.
      </p>
    </div>
    <button
      onClick={generateConsumptionSummary}
      disabled={loadingConsumption}
      className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
    >
      <FileText className="w-4 h-4" />
      {loadingConsumption ? 'Tentando...' : 'Tentar Novamente'}
    </button>
  </div>
) : (
  // Tabela de consumo
)}
```

#### Estados de Loading

```typescript
const generateConsumptionSummary = async () => {
  setLoadingConsumption(true);
  setShowConsumption(false); // Limpar antes de buscar

  try {
    // ... buscar dados
    setShowConsumption(true); // Mostrar resultado
  } catch (error) {
    // ... tratar erro
    setShowConsumption(false); // Não mostrar se erro
  } finally {
    setLoadingConsumption(false); // Sempre desabilitar loading
  }
};
```

## Como Funciona Agora

### Fluxo Normal (Produções Novas)

```
1. Usuário registra produção
   ↓
2. Frontend chama create_production_atomic
   ↓
3. RPC calcula custos via calculate_production_costs
   ↓
4. RPC insere em production com custos_no_momento preenchido
   ↓
5. TRIGGER sync_production_items_from_custos dispara
   ↓
6. Função extract_production_items_from_custos extrai materials do JSONB
   ↓
7. Insere registros em production_items
   ↓
8. Usuário clica "Gerar Resumo do Dia"
   ↓
9. RPC get_resumo_producao_dia busca de production_items
   ↓
10. Retorna dados agregados (fonte: 'production_items')
```

### Fluxo Fallback (Produções Antigas com custos_no_momento)

```
1. Usuário clica "Gerar Resumo do Dia" para data antiga
   ↓
2. RPC get_resumo_producao_dia verifica production_items (vazio)
   ↓
3. Usa fallback: busca de custos_no_momento->materials
   ↓
4. SE materials vazio: retorna array vazio
   ↓
5. Frontend detecta array vazio
   ↓
6. Mostra mensagem "Nenhum consumo encontrado" + botão "Tentar Novamente"
```

### Fluxo Sem Dados (Produções sem custos calculados)

```
1. Usuário clica "Gerar Resumo do Dia"
   ↓
2. RPC verifica production_items (vazio)
   ↓
3. Tenta fallback custos_no_momento->materials (também vazio)
   ↓
4. Retorna array vazio []
   ↓
5. Frontend mostra:
   "Nenhum consumo de insumo encontrado
    Não há registros de produção para [data] ou os custos não foram calculados."
   [Botão: Tentar Novamente]
```

## Diagnóstico de Problemas

### Verificar se RPC foi criada
```sql
SELECT proname FROM pg_proc WHERE proname = 'get_resumo_producao_dia';
-- Deve retornar 1 linha
```

### Testar RPC manualmente
```sql
SELECT * FROM get_resumo_producao_dia('2026-02-04');
-- Deve retornar materiais ou array vazio
```

### Verificar logs da RPC (Supabase Dashboard)
```
Logs → SQL Editor → Executar query
→ Observar NOTICE messages no console
```

### Verificar production_items
```sql
-- Contar registros
SELECT COUNT(*) FROM production_items;

-- Ver últimos registros
SELECT
  pi.material_name,
  pi.quantity,
  pi.total_cost,
  p.production_date
FROM production_items pi
JOIN production p ON p.id = pi.production_id
ORDER BY p.production_date DESC
LIMIT 10;
```

### Verificar custos_no_momento
```sql
-- Produções com custos calculados
SELECT
  production_date,
  product_id,
  jsonb_typeof(custos_no_momento) as tipo,
  jsonb_typeof(custos_no_momento->'materials') as tipo_materials,
  CASE
    WHEN custos_no_momento->'materials' = '{}'::jsonb THEN 'VAZIO'
    WHEN jsonb_typeof(custos_no_momento->'materials') = 'object' THEN 'COM DADOS'
    ELSE 'SEM materials'
  END as status
FROM production
WHERE production_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY production_date DESC;
```

### Verificar se trigger está ativo
```sql
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_sync_production_items';
-- Deve retornar 1 linha
```

## Testando a Correção

### Teste 1 - Data com Produções Novas (com custos)

1. Ir em **Produção Diária**
2. Selecionar data de hoje ou ontem
3. Verificar se há produções registradas
4. Clicar em **"Gerar Resumo do Dia"**
5. ✅ Deve mostrar tabela de consumo de insumos
6. ✅ Deve mostrar resumo de produtos produzidos
7. ✅ Console deve mostrar: `"Consumo encontrado: X materiais (fonte: production_items)"`

### Teste 2 - Data com Produções Antigas (sem custos)

1. Selecionar data 2026-02-03 (ou outra data antiga)
2. Clicar em **"Gerar Resumo do Dia"**
3. ✅ Deve mostrar alerta: "Sem produções registradas para 2026-02-03"
4. ✅ Deve mostrar mensagem na tela: "Nenhum consumo de insumo encontrado"
5. ✅ Deve mostrar botão "Tentar Novamente"

### Teste 3 - Data sem Produções

1. Selecionar data futura (ex: amanhã)
2. Clicar em **"Gerar Resumo do Dia"**
3. ✅ Deve mostrar alerta: "Sem produções registradas para [data]"
4. ✅ Deve mostrar seção vazia

### Teste 4 - Erro de Conexão (simulado)

1. Desconectar internet
2. Clicar em **"Gerar Resumo do Dia"**
3. ✅ Deve mostrar alerta com mensagem de erro detalhada
4. ✅ Console deve mostrar erro completo
5. Reconectar internet
6. Clicar em **"Tentar Novamente"**
7. ✅ Deve funcionar normalmente

### Teste 5 - Console Logs

Abrir DevTools (F12) → Console e clicar "Gerar Resumo":

```
Gerando resumo de produção do dia: 2026-02-04
Buscando resumo de produtos...
✓ Relatório gerado com sucesso! {
  materiais: 5,
  produtos: 3,
  custoTotal: "1234.56",
  receita: "5000.00"
}
```

## Queries Úteis

### Ver resumo de uma data específica
```sql
SELECT * FROM get_resumo_producao_dia('2026-02-04');
```

### Ver resumo de produtos de uma data
```sql
SELECT * FROM get_resumo_produtos_dia('2026-02-04');
```

### Comparar production_items vs custos_no_momento
```sql
SELECT
  p.production_date,
  COUNT(DISTINCT pi.id) as qtd_items,
  CASE
    WHEN custos_no_momento->'materials' = '{}'::jsonb THEN 0
    ELSE (SELECT COUNT(*) FROM jsonb_object_keys(custos_no_momento->'materials'))
  END as qtd_custos_materials
FROM production p
LEFT JOIN production_items pi ON pi.production_id = p.id
WHERE p.production_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY p.production_date, p.custos_no_momento
ORDER BY p.production_date DESC;
```

### Migrar custos antigos para production_items (opcional)
```sql
-- ATENÇÃO: Só executar se tiver certeza
-- Extrai production_items de produções que têm custos_no_momento mas não têm items
SELECT extract_production_items_from_custos(
  id,
  custos_no_momento
)
FROM production
WHERE custos_no_momento IS NOT NULL
AND jsonb_typeof(custos_no_momento->'materials') = 'object'
AND custos_no_momento->'materials' != '{}'::jsonb
AND NOT EXISTS (
  SELECT 1 FROM production_items WHERE production_id = production.id
);
```

## Impacto das Alterações

### ✅ Melhorias Implementadas

1. **Performance:** Queries no banco em vez de loops JavaScript
2. **Clareza:** Mensagens de erro detalhadas e específicas
3. **Usabilidade:** Botão "Tentar Novamente" disponível
4. **Diagnóstico:** Logs detalhados no console para debug
5. **Compatibilidade:** Funciona com ambas as fontes de dados
6. **Escalabilidade:** RPCs otimizadas com índices

### ⚠️ Limitações Conhecidas

1. **Produções antigas** sem custos calculados não podem exibir resumo
   - Solução: Usuário deve reprocessar ou aceitar que não há dados

2. **Produtos sem receita** não geram custos de materiais
   - Solução: Configurar receitas para todos os produtos

3. **Produtos sem peso_artefato** podem ter cálculo impreciso
   - Solução: Configurar peso para produtos pré-moldados

### 🔄 Compatibilidade

- ✅ Funciona com produções novas (create_production_atomic)
- ✅ Funciona com produções antigas que têm custos_no_momento preenchido
- ⚠️ Produções antigas sem custos mostram "sem dados" (correto)
- ✅ Não quebra nenhuma funcionalidade existente
- ✅ Mantém compatibilidade com ambos os formatos

## Próximos Passos Recomendados

### Curto Prazo (Implementado)
- ✅ Criar RPCs otimizadas
- ✅ Atualizar frontend
- ✅ Adicionar tratamento de erros
- ✅ Adicionar botão de retry

### Médio Prazo (Opcional)
- ⚠️ Configurar peso_artefato para todos os produtos pré-moldados
- ⚠️ Revisar produtos sem receita e criar receitas
- ⚠️ Monitorar logs de produções sem custos calculados

### Longo Prazo (Futuro)
- ⚠️ Migrar todas produções antigas para production_items (opcional)
- ⚠️ Depreciar custos_no_momento (se desejado)
- ⚠️ Adicionar alertas automáticos para produções sem custos

## Arquivos Alterados

**Banco de Dados:**
- `supabase/migrations/corrigir_resumo_producao_dia.sql` (NOVO)
  - Função `get_resumo_producao_dia(p_data DATE)`
  - Função `get_resumo_produtos_dia(p_data DATE)`

**Frontend:**
- `src/components/DailyProduction.tsx`
  - Função `generateConsumptionSummary` reescrita (~120 linhas)
  - Tratamento de erros melhorado
  - Botão "Tentar Novamente" adicionado
  - Estados de loading aprimorados
  - Mensagens mais claras

## Status Final

✅ Correção implementada com sucesso
✅ Build concluído sem erros
✅ RPCs otimizadas criadas
✅ Frontend atualizado com erros detalhados
✅ Botão "Tentar Novamente" funcional
✅ Estados de loading corretos
✅ Sistema pronto para uso

**O botão "Gerar Resumo do Dia" agora funciona corretamente e fornece feedback claro para o usuário em todos os cenários!**
