# Correção: Consumo de Insumos em Ajustes de Estoque

## Problema Identificado

Quando ajustes de estoque de produtos eram realizados (entradas manuais para migração de dados ou correções administrativas), o sistema estava calculando consumo de insumos como se fossem produções reais.

### Exemplo Real
- **Produto**: Paver retangular 10x20x06
- **Quantidade**: 13.916 unidades
- **Tipo**: Ajuste de estoque (entrada manual)
- **Problema**: Sistema consumiu indevidamente:
  - Areia industrial: 62.343,68 kg
  - Areia média: 53.298,28 kg
  - CIMENTO OBRAS ESPECIAIS: 13.916 kg
  - CQ Plast PM 9000: 34,79 kg
  - Pedrisco: 22.404,76 kg

## Causa Raiz

Mesmo com produções marcadas como `production_type = 'adjustment'`, ainda existiam movimentações de material (saídas) vinculadas a elas. Isso ocorreu porque:

1. Uma migração anterior (`20260210212927`) tentou deletar essas movimentações
2. Mas o padrão de busca estava errado: procurava por notas como "Consumo automático%"
3. As movimentações reais tinham notas como "Consumo da receita%"
4. Resultado: as movimentações não foram deletadas

## Solução Implementada

### Migration: `fix_remove_material_consumption_from_adjustments.sql`

```sql
DELETE FROM material_movements
WHERE production_id IN (
  SELECT id FROM production WHERE production_type = 'adjustment'
)
AND movement_type = 'saida';
```

Esta migration remove **TODAS** as movimentações de saída (consumo) vinculadas a produções do tipo 'adjustment', restaurando automaticamente o estoque dos insumos.

## Resultados

### Produções Corrigidas
- **Total de ajustes**: 7 produções
- **Total de unidades**: 15.926 unidades
- **Produtos diferentes**: 7 produtos

### Lista Completa de Ajustes
1. Paver retangular 10x20x06 - 13.916 unidades
2. Paver 10x20x06 não trepidante pigmentado preto - 550 unidades
3. Paver retangular 10x20x06 não trepidante - 1.100 unidades
4. Poste de cerca 10x10cm x 2.50m - 17 unidades
5. Poste de cerca 10x10cm dobra 2.00m - 14 unidades
6. Poste de cerca 10x10cm x 2.00m - 79 unidades
7. Laje treliçada com reforço estrutural - 250 unidades

### Movimentações Removidas
- **Total**: Todas as movimentações de consumo indevidas foram removidas
- **Estoque**: Todos os insumos foram automaticamente restaurados

## Como Funciona Agora

### Tipos de Produção

1. **'stock'**: Produção normal em estoque
   - **Consome insumos**: SIM
   - **Uso**: Produções do dia a dia

2. **'order'**: Produção vinculada a ordem
   - **Consome insumos**: SIM
   - **Uso**: Produções com ordem de produção

3. **'adjustment'**: Ajuste manual de estoque
   - **Consome insumos**: NÃO
   - **Uso**: Migrações de dados, correções administrativas, balanços

### Trigger Atualizado

A função `process_material_consumption()` agora:

```sql
IF NEW.production_type = 'adjustment' THEN
  RETURN NEW;  -- Não processa consumo de insumos
END IF;
```

## Verificação

### Query para Verificar Ajustes
```sql
SELECT
  p.id,
  p.production_date,
  pr.name as product_name,
  p.quantity,
  p.production_type,
  p.notes,
  COUNT(mm.id) as material_movements_count
FROM production p
LEFT JOIN products pr ON pr.id = p.product_id
LEFT JOIN material_movements mm ON mm.production_id = p.id
WHERE p.production_type = 'adjustment'
GROUP BY p.id, p.production_date, pr.name, p.quantity, p.production_type, p.notes;
```

**Resultado esperado**: `material_movements_count = 0` para todos os registros

### Query para Estoque de Materiais
```sql
SELECT
  m.name,
  m.unit,
  COALESCE(
    (SELECT SUM(CASE
      WHEN mm.movement_type = 'entrada' THEN mm.quantity
      ELSE -mm.quantity
    END)
    FROM material_movements mm
    WHERE mm.material_id = m.id
    ), 0
  ) as current_stock
FROM materials m
ORDER BY m.name;
```

## Próximos Ajustes de Estoque

### Como Fazer Corretamente

Ao registrar um ajuste de estoque no futuro:

1. Na aba **Produção**, ao criar uma nova produção
2. Selecione o produto
3. Informe a quantidade
4. **IMPORTANTE**: Nas notas, use termos como:
   - "Ajuste de estoque (entrada)"
   - "Ajuste manual"
   - "Balanço de inventário"
   - "Migração de dados"

O sistema detectará automaticamente pela palavra "ajuste" e marcará como `production_type = 'adjustment'`, garantindo que não haverá consumo de insumos.

## Build

- **Status**: Compilado com sucesso
- **Tempo**: 17.10s
- **Erros**: 0
- **Warnings**: Apenas sobre Tailwind v3 (não crítico)

## Arquivos Relacionados

### Migration
- `supabase/migrations/fix_remove_material_consumption_from_adjustments.sql`

### Migrations Anteriores Relacionadas
- `20260210212927_fix_material_consumption_ignore_stock_adjustments.sql` - Tentativa anterior (incompleta)
- `20260110202246_create_material_movements_table.sql` - Criação da tabela

### Documentação
- `CORRECAO_AJUSTES_ESTOQUE_CONSUMO_INSUMOS.md` - Este arquivo

## Resumo Técnico

1. ✅ Identificadas 7 produções com tipo 'adjustment'
2. ✅ Removidas todas as movimentações de consumo indevidas
3. ✅ Estoque de insumos restaurado automaticamente
4. ✅ Trigger atualizado para prevenir problemas futuros
5. ✅ Build compilado com sucesso
6. ✅ Nenhum outro ajuste pendente identificado

## Data da Correção
11 de fevereiro de 2026
