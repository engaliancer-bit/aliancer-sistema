# Resumo - Correção Botão "Gerar Resumo do Dia"

## Problema
Botão "Gerar Resumo do Dia" não funcionava:
- RPC antiga buscava de `custos_no_momento->materials` (vazio em produções antigas)
- Erros eram silenciados
- Sem botão de retry

## Solução

### 1. Novas RPCs Otimizadas

```sql
-- Busca consumo de insumos (production_items ou custos_no_momento)
CREATE FUNCTION get_resumo_producao_dia(p_data DATE)

-- Busca produtos produzidos agregados
CREATE FUNCTION get_resumo_produtos_dia(p_data DATE)
```

**Características:**
- ✅ Busca de `production_items` (fonte principal)
- ✅ Fallback para `custos_no_momento` se vazio
- ✅ Retorna `source` indicando origem dos dados
- ✅ Logs detalhados via `RAISE NOTICE`

### 2. Frontend Atualizado

**Antes:**
```typescript
// Busca de RPC antiga (lenta)
const { data, error } = await supabase.rpc('get_material_costs_report');
if (error) throw error; // Sem detalhes
```

**Depois:**
```typescript
// 1. Busca otimizada
const { data, error } = await supabase.rpc('get_resumo_producao_dia', { p_data: filterDate });

// 2. Erro detalhado
if (error) {
  throw new Error(`Erro: ${error.message} - ${error.details || ''}`);
}

// 3. Verificar dados vazios
if (!data || data.length === 0) {
  alert('Sem produções para ' + filterDate);
  setShowConsumption(true); // Mostra seção vazia
  return;
}

// 4. Buscar resumo de produtos
const { data: products } = await supabase.rpc('get_resumo_produtos_dia', { p_data: filterDate });
```

### 3. Tratamento de Erros

```typescript
catch (error: any) {
  console.error('ERRO:', error);

  alert(
    `Erro ao gerar resumo:\n\n` +
    `${error.message}\n\n` +
    `${error.details || ''}\n\n` +
    `Data: ${filterDate}`
  );

  setShowConsumption(false);
}
```

### 4. Botão "Tentar Novamente"

```tsx
{materialConsumption.length === 0 ? (
  <div className="text-center py-12">
    <p className="text-lg font-medium">Nenhum consumo encontrado</p>
    <p className="text-sm mt-2">
      Não há registros para {filterDate} ou custos não foram calculados.
    </p>
    <button onClick={generateConsumptionSummary} disabled={loadingConsumption}>
      {loadingConsumption ? 'Tentando...' : 'Tentar Novamente'}
    </button>
  </div>
) : (
  // Tabela de consumo
)}
```

## Como Funciona

### Produções Novas
```
Registro de Produção
  ↓
create_production_atomic calcula custos
  ↓
Insere em production com custos_no_momento
  ↓
TRIGGER extrai para production_items
  ↓
"Gerar Resumo" busca de production_items ✓
```

### Produções Antigas (com custos)
```
"Gerar Resumo"
  ↓
production_items vazio
  ↓
Fallback: busca custos_no_momento->materials ✓
```

### Produções Antigas (sem custos)
```
"Gerar Resumo"
  ↓
production_items vazio
  ↓
custos_no_momento->materials também vazio
  ↓
Mostra "Nenhum consumo encontrado" + botão retry ✓
```

## Teste Rápido

### Teste 1 - Data com Produções
1. Selecionar data com produções
2. Clicar "Gerar Resumo do Dia"
3. ✅ Deve mostrar tabela de insumos e produtos

### Teste 2 - Data sem Produções
1. Selecionar data futura
2. Clicar "Gerar Resumo do Dia"
3. ✅ Deve mostrar alerta "Sem produções"
4. ✅ Deve mostrar botão "Tentar Novamente"

### Teste 3 - Console Logs
Abrir DevTools (F12):
```
Gerando resumo de produção do dia: 2026-02-04
Consumo encontrado: 5 materiais (fonte: production_items)
Buscando resumo de produtos...
✓ Relatório gerado com sucesso!
```

## Queries Úteis

```sql
-- Testar RPC
SELECT * FROM get_resumo_producao_dia('2026-02-04');

-- Ver produtos
SELECT * FROM get_resumo_produtos_dia('2026-02-04');

-- Verificar production_items
SELECT COUNT(*) FROM production_items;

-- Ver últimos items
SELECT pi.material_name, pi.quantity, p.production_date
FROM production_items pi
JOIN production p ON p.id = pi.production_id
ORDER BY p.production_date DESC
LIMIT 10;
```

## Arquivos Alterados

**Banco:**
- `supabase/migrations/corrigir_resumo_producao_dia.sql` (NOVO)

**Frontend:**
- `src/components/DailyProduction.tsx`
  - Função `generateConsumptionSummary` reescrita
  - Tratamento de erros melhorado
  - Botão retry adicionado

## Status

✅ RPCs otimizadas criadas
✅ Frontend atualizado
✅ Erros detalhados
✅ Botão retry funcional
✅ Build sem erros
✅ Sistema pronto para uso

## Documentação Completa

Ver: `CORRECAO_BOTAO_GERAR_RESUMO.md`
