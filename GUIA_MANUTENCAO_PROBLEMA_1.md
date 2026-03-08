# Guia de Manutenção - Problema 1: Divergência de Custos

## Visão Geral

Este guia fornece informações técnicas para manutenção, troubleshooting e evolução da solução implementada para o **Problema 1: Divergência de Custos entre Relatórios**.

**Data da Implementação:** 18 de Fevereiro de 2026
**Status:** Produção
**Criticidade:** Alta (afeta decisões financeiras)

---

## 1. Arquitetura da Solução

### 1.1 Diagrama de Fluxo

```
┌──────────────────────────────────────────────────────────────────┐
│                    CAMADA DE APRESENTAÇÃO                        │
│  (ProductionCosts.tsx, ProductionReport.tsx, DailyProduction.tsx)│
└─────────────────────────────────────┬──────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
        ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
        │   REPORTS LAYER  │ │  REPORTS LAYER   │ │  REPORTS LAYER   │
        ├──────────────────┤ ├──────────────────┤ ├──────────────────┤
        │relatorio_        │ │relatorio_        │ │get_resumo_       │
        │producao_completo │ │consumo_insumos   │ │producao_dia      │
        └────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘
                 │                    │                    │
                 │                    │                    │
                 └────────────────────┼────────────────────┘
                                      │
                    ┌─────────────────▼─────────────────┐
                    │   CENTRALIZED FUNCTIONS LAYER     │
                    │     (Single Source of Truth)      │
                    ├──────────────────────────────────┤
                    │  get_production_costs_safe()     │
                    │  get_production_costs_aggregated()│
                    │  validate_production_costs()     │
                    │  validate_cost_consistency()     │
                    └────────────┬──────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   DATABASE LAYER        │
                    ├─────────────────────────┤
                    │ production              │
                    │ production_costs        │
                    │ production_items        │
                    │ recipes & recipe_items  │
                    │ materials               │
                    │ employees & overtime    │
                    └─────────────────────────┘
```

### 1.2 Componentes Principais

**Funções Centralizadas:**
- `get_production_costs_safe()` - Retorna custos de produção com dados detalhados
- `get_production_costs_aggregated()` - Retorna custos agregados
- `validate_production_costs()` - Valida integridade dos dados
- `validate_cost_consistency()` - Valida consistência entre funções

**Tabelas de Auditoria:**
- `cost_calculation_audit` - Log de cada cálculo realizado
- `cost_validation_report` - Registra resultados de validações

**Views de Monitoramento:**
- `v_production_costs_detail` - Detalhe por produção
- `v_production_summary_daily` - Resumo diário
- `v_production_summary_period` - Resumo por período
- `v_cost_system_status` - Status geral do sistema

---

## 2. Dados Técnicos das Funções

### 2.1 get_production_costs_safe()

**Assinatura:**
```sql
get_production_costs_safe(
  p_date_start DATE,
  p_date_end DATE,
  p_exclude_stock_adjustments BOOLEAN DEFAULT true
)
```

**Retorna:**
```
production_id, product_id, quantity, production_date,
material_cost, labor_cost, indirect_cost, depreciation_cost,
total_cost, cost_per_unit
```

**Características:**
- JOIN único com `production_costs` (sem duplicação)
- Exclui ajustes de estoque por padrão
- Performance: < 500ms para 500+ produções
- Qualificador: STABLE (pode ser cacheado)

**Casos de Uso:**
```sql
-- Listar custos detalhados
SELECT * FROM get_production_costs_safe('2026-02-01', '2026-02-28');

-- Filtrar por faixa de custo
SELECT * FROM get_production_costs_safe('2026-02-01', '2026-02-28')
WHERE total_cost > 1000;

-- Agregar por produto
SELECT product_id, SUM(total_cost)
FROM get_production_costs_safe('2026-02-01', '2026-02-28')
GROUP BY product_id;
```

### 2.2 get_production_costs_aggregated()

**Assinatura:**
```sql
get_production_costs_aggregated(
  p_date_start DATE,
  p_date_end DATE,
  p_exclude_stock_adjustments BOOLEAN DEFAULT true
)
```

**Retorna:**
```
total_productions, total_quantity, total_cost,
avg_cost_per_unit, avg_cost_per_production,
material_cost_total, labor_cost_total, indirect_cost_total,
depreciation_cost_total
```

**Características:**
- Usa `get_production_costs_safe()` internamente
- Retorna uma única linha agregada
- Garante consistência com função de detalhe
- Performance: < 100ms

**Casos de Uso:**
```sql
-- KPI consolidado do mês
SELECT * FROM get_production_costs_aggregated('2026-02-01', '2026-02-28');

-- Comparar períodos
SELECT
  'Jan' as month,
  total_cost
FROM get_production_costs_aggregated('2026-01-01', '2026-01-31')
UNION ALL
SELECT
  'Feb' as month,
  total_cost
FROM get_production_costs_aggregated('2026-02-01', '2026-02-28');
```

### 2.3 validate_production_costs()

**Assinatura:**
```sql
validate_production_costs(
  p_date_start DATE,
  p_date_end DATE
)
```

**Retorna:**
```
validation_passed BOOLEAN,
total_productions INTEGER,
duplicate_cost_entries INTEGER,
zero_cost_entries INTEGER,
negative_cost_entries INTEGER,
total_cost_amount DECIMAL,
error_message TEXT
```

**Características:**
- Verifica integridade dos dados
- Detecta duplicações, valores zero, negativos
- Registra resultado em auditoria
- Ideal para pré-deployment validation

**Casos de Uso:**
```sql
-- Validar antes de processar relatório
SELECT * FROM validate_production_costs('2026-02-01', '2026-02-28');

-- Se validation_passed = false, investigar:
-- 1. duplicate_cost_entries > 0 → verificar production_costs
-- 2. negative_cost_entries > 0 → verificar material costs
-- 3. error_message → mensagem específica
```

### 2.4 validate_cost_consistency()

**Assinatura:**
```sql
validate_cost_consistency(
  p_date_start DATE,
  p_date_end DATE
)
```

**Retorna:**
```
function_name TEXT,
consistency_check TEXT,
total_cost_from_function DECIMAL,
total_cost_from_aggregated DECIMAL,
difference DECIMAL,
percentage_difference DECIMAL
```

**Características:**
- Compara múltiplas funções
- Detecta divergências
- Retorna 1 linha por função validada
- Ideal para troubleshooting

**Casos de Uso:**
```sql
-- Detectar se há divergências
SELECT * FROM validate_cost_consistency('2026-02-01', '2026-02-28')
WHERE consistency_check != 'OK';

-- Se houver divergência:
-- 1. Verificar qual função retorna valor diferente
-- 2. Executar EXPLAIN ANALYZE na query dessa função
-- 3. Verificar dados em production_costs table
```

---

## 3. Tabelas de Auditoria

### 3.1 cost_calculation_audit

**Estrutura:**
```sql
CREATE TABLE cost_calculation_audit (
  id UUID PRIMARY KEY,
  function_name TEXT,
  calculation_date TIMESTAMPTZ,
  date_range_start DATE,
  date_range_end DATE,
  total_productions INTEGER,
  total_cost DECIMAL,
  status TEXT, -- 'success', 'error', 'warning'
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ
);
```

**Consultas Úteis:**
```sql
-- Ultimas 10 execuções
SELECT * FROM cost_calculation_audit
ORDER BY calculation_date DESC
LIMIT 10;

-- Erros nos últimos 7 dias
SELECT * FROM cost_calculation_audit
WHERE status = 'error'
  AND calculation_date >= NOW() - INTERVAL '7 days';

-- Performance por função
SELECT
  function_name,
  COUNT(*) as executions,
  AVG(execution_time_ms) as avg_time,
  MAX(execution_time_ms) as max_time
FROM cost_calculation_audit
WHERE calculation_date >= NOW() - INTERVAL '30 days'
GROUP BY function_name
ORDER BY avg_time DESC;
```

### 3.2 cost_validation_report

**Estrutura:**
```sql
CREATE TABLE cost_validation_report (
  id UUID PRIMARY KEY,
  validation_date TIMESTAMPTZ,
  date_range_start DATE,
  date_range_end DATE,
  validation_summary TEXT,
  total_cost DECIMAL,
  validation_details JSONB,
  status TEXT, -- 'passed', 'failed', 'warning'
  created_at TIMESTAMPTZ
);
```

**Consultas Úteis:**
```sql
-- Histórico de validações
SELECT * FROM cost_validation_report
ORDER BY validation_date DESC
LIMIT 20;

-- Validações com falha
SELECT * FROM cost_validation_report
WHERE status = 'failed'
  AND validation_date >= NOW() - INTERVAL '7 days';

-- Detalhes específicos
SELECT
  validation_details
FROM cost_validation_report
WHERE validation_date = (SELECT MAX(validation_date) FROM cost_validation_report);
```

---

## 4. Troubleshooting

### 4.1 Problema: Relatórios com Valores Diferentes

**Sintoma:**
- Aba Produção mostra R$ 2.083,30
- Relatório de Produção mostra R$ 14.917,23
- Divergência de 5-7x

**Diagnóstico:**

1. **Executar validação de consistência:**
```sql
SELECT * FROM validate_cost_consistency('2026-02-01', '2026-02-28')
WHERE consistency_check != 'OK';
```

2. **Verificar qual função retorna valor diferente:**
```sql
SELECT
  'get_production_costs_aggregated' as source,
  SUM(total_cost) as total
FROM get_production_costs_safe('2026-02-01', '2026-02-28')
UNION ALL
SELECT
  'relatorio_producao_completo' as source,
  total_material_cost
FROM relatorio_producao_completo('2026-02-01', '2026-02-28');
```

3. **Verificar duplicações em production_costs:**
```sql
SELECT
  production_id,
  COUNT(*) as duplicates,
  SUM(total_cost) as total
FROM production_costs
WHERE production_date BETWEEN '2026-02-01' AND '2026-02-28'
GROUP BY production_id
HAVING COUNT(*) > 1;
```

**Solução:**
- Se há duplicatas: Remover registros duplicados em production_costs
- Se há divergência: Executar validação completa
- Se tudo OK: Bug em nova função, revisar QUERY

### 4.2 Problema: Valores Negativos em Custos

**Sintoma:**
- Validação retorna `negative_cost_entries > 0`
- Relatórios mostram valores estranhos

**Diagnóstico:**

```sql
-- Encontrar valores negativos
SELECT * FROM production_costs
WHERE total_cost < 0 OR material_cost < 0
  AND production_date BETWEEN '2026-02-01' AND '2026-02-28';
```

**Solução:**
1. Revisar cálculo que gerou custo negativo
2. Corrigir campo específico:
```sql
UPDATE production_costs
SET total_cost = ABS(total_cost)
WHERE total_cost < 0
  AND production_date BETWEEN '2026-02-01' AND '2026-02-28';
```

3. Verificar tabela de custos unitários (materiais e mão de obra)

### 4.3 Problema: Performance Lenta (> 1 segundo)

**Sintoma:**
- `get_production_costs_safe()` demorando > 1 segundo
- Relatório travando ao carregar

**Diagnóstico:**

```sql
-- Analisar query execution plan
EXPLAIN ANALYZE
SELECT * FROM get_production_costs_safe('2026-02-01', '2026-02-28');

-- Verificar se índices existem
SELECT * FROM pg_indexes
WHERE tablename IN ('production_costs', 'production', 'production_items')
  AND indexname LIKE '%idx%';
```

**Solução:**
- Se Seq Scan em production_costs: Criar índice
- Se muitos registros: Reduzir período de datas
- Se material_costs lento: Verificar índice em materials.unit_cost

### 4.4 Problema: Relatório Vazio

**Sintoma:**
- `relatorio_consumo_insumos()` retorna zero linhas
- `get_resumo_producao_dia()` mostra "Sem dados"

**Diagnóstico:**

```sql
-- Verificar se existem produções
SELECT COUNT(*) FROM production
WHERE production_date >= '2026-02-01' AND production_date <= '2026-02-28';

-- Verificar se existem production_costs
SELECT COUNT(*) FROM production_costs
WHERE production_date >= '2026-02-01' AND production_date <= '2026-02-28';

-- Verificar se existem receitas
SELECT COUNT(*) FROM recipes;
SELECT COUNT(*) FROM recipe_items;
```

**Solução:**
1. Se sem production_costs: Gerar custos de produção
2. Se sem recipes: Criar receitas para produtos
3. Se sem recipe_items: Adicionar materiais às receitas

---

## 5. Operações Comuns de Manutenção

### 5.1 Limpar Auditoria Antiga

```sql
-- Manter apenas 90 dias de auditoria
DELETE FROM cost_calculation_audit
WHERE calculation_date < NOW() - INTERVAL '90 days';

DELETE FROM cost_validation_report
WHERE validation_date < NOW() - INTERVAL '90 days';

-- Fazer VACUUM para reclamar espaço
VACUUM cost_calculation_audit;
VACUUM cost_validation_report;
```

### 5.2 Recalcular Custos de Período

```sql
-- Se valores antigos precisam ser recalculados:
-- 1. Obter dados
SELECT * FROM get_production_costs_safe('2026-01-01', '2026-01-31');

-- 2. Validar antes de atualizar
SELECT * FROM validate_production_costs('2026-01-01', '2026-01-31');

-- 3. Se validação passou, dados estão corretos
```

### 5.3 Recriar Índices

```sql
-- Se performance degrada
REINDEX INDEX idx_production_costs_production_id;
REINDEX INDEX idx_production_date;
REINDEX INDEX idx_production_notes;
REINDEX INDEX idx_production_items_production_id;

-- Ou reindex todas as tabelas
REINDEX TABLE production_costs;
REINDEX TABLE production;
```

### 5.4 Gerar Relatório de Validação Completo

```sql
-- Executar todas as validações
SELECT * FROM generate_cost_validation_report('2026-02-01', '2026-02-28');

-- Exportar para análise
\copy (
  SELECT * FROM generate_cost_validation_report('2026-02-01', '2026-02-28')
) TO '/tmp/validation_report.csv' CSV HEADER;
```

---

## 6. Casos de Evolução Futura

### 6.1 Adicionar Novo Tipo de Custo

Se precisar adicionar um novo tipo de custo (ex: custo de energia):

1. **Adicionar coluna em production_costs:**
```sql
ALTER TABLE production_costs ADD COLUMN energy_cost DECIMAL DEFAULT 0;
```

2. **Atualizar função centralizada:**
```sql
-- Modificar get_production_costs_safe() para incluir energy_cost
-- Adicionar na query: "energy_cost" ao SELECT
-- Adicionar validação: "SELECT * FROM validate_production_costs()"
```

3. **Atualizar agregação:**
```sql
-- Modificar get_production_costs_aggregated()
-- Adicionar: energy_cost_total = SUM(energy_cost)
-- Atualizar total_cost = material_cost + labor_cost + ... + energy_cost
```

4. **Atualizar relatórios:**
```sql
-- Modificar relatorio_producao_completo()
-- Incluir novo tipo de custo na coluna final
```

5. **Testar com validação:**
```sql
SELECT * FROM validate_production_costs('2026-02-01', '2026-02-28');
```

### 6.2 Adicionar Novo Relatório

Se precisar criar novo relatório de custos:

1. **Sempre usar get_production_costs_safe() internamente**
2. **Nunca fazer JOINs diretos com production_items**
3. **Validar com validate_cost_consistency()**
4. **Testar que retorna mesmo total_cost que get_production_costs_aggregated()**

Exemplo correto:
```sql
CREATE OR REPLACE FUNCTION novo_relatorio_custos(
  p_data_inicio DATE,
  p_data_fim DATE
) RETURNS TABLE (...) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH costs AS (
    SELECT * FROM get_production_costs_safe(p_data_inicio, p_data_fim)
  )
  SELECT ... FROM costs;
END;
$$;
```

### 6.3 Monitoramento em Tempo Real

Para adicionar dashboard de monitoramento:

```sql
-- Query para dashboard (executar a cada 5 minutos)
SELECT
  'Production Costs System' as system_name,
  (SELECT COUNT(*) FROM v_production_costs_detail WHERE production_date >= CURRENT_DATE) as today_productions,
  (SELECT SUM(total_cost) FROM v_production_costs_detail WHERE production_date >= CURRENT_DATE) as today_total_cost,
  (SELECT successful_validations FROM v_cost_system_status) as last_validation_success,
  (SELECT last_validation_date FROM v_cost_system_status) as last_check
;
```

---

## 7. Checklist de Integridade Mensal

Executar no primeiro dia de cada mês:

```sql
-- 1. Validar mês anterior
SELECT * FROM validate_production_costs(
  DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')::date,
  (DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') + INTERVAL '1 month' - INTERVAL '1 day')::date
);

-- 2. Validar consistência
SELECT * FROM validate_cost_consistency(
  DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')::date,
  (DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') + INTERVAL '1 month' - INTERVAL '1 day')::date
);

-- 3. Gerar relatório
SELECT * FROM generate_cost_validation_report(
  DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')::date,
  (DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') + INTERVAL '1 month' - INTERVAL '1 day')::date
);

-- 4. Verificar status
SELECT * FROM v_cost_system_status;

-- 5. Limpar auditoria se necessário
DELETE FROM cost_calculation_audit
WHERE calculation_date < NOW() - INTERVAL '90 days';
```

---

## 8. Documentos de Referência

- **SOLUCAO_PROBLEMA_1_DIVERGENCIA_CUSTOS.md** - Documentação técnica completa
- **RESUMO_SOLUCAO_PROBLEMA_1.txt** - Resumo visual ASCII
- **TESTE_VALIDACAO_PROBLEMA_1.sql** - 15 testes de validação
- **CORRECAO_DIVERGENCIA_CUSTOS_02FEV2026.md** - Histórico do problema original
- **GUIA_MANUTENCAO_PROBLEMA_1.md** - Este arquivo

---

## 9. Contato e Suporte

Para dúvidas sobre a implementação:

1. Consultar documentação técnica em SOLUCAO_PROBLEMA_1_DIVERGENCIA_CUSTOS.md
2. Executar testes em TESTE_VALIDACAO_PROBLEMA_1.sql
3. Verificar logs em cost_calculation_audit
4. Consultar status em v_cost_system_status

---

**Última Atualização:** 18 de Fevereiro de 2026
**Versão:** 1.0
**Status:** Produção
**Criticidade:** Alta
