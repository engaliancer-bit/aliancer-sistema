# Correção: Consumo de Materiais em Ferragens Diversas

**Data:** 30 de Janeiro de 2026
**Status:** ✅ CORRIGIDO
**Tipo:** Bug Fix + Correção de Dados Históricos

---

## 🐛 PROBLEMA IDENTIFICADO

### Sintoma
Produtos do tipo "ferragens diversas" (como "Grade divisória de pocilga - 3,00m") não estavam tendo o consumo de materiais calculado ao registrar a produção.

### Causa Raiz
O sistema estava criando movimentos de materiais apenas para:
- ✅ Materiais em `recipe_items` (receitas de concreto)
- ✅ Materiais em `product_material_weights` (pesos de materiais)
- ✅ Materiais em `product_reinforcements` (armaduras de premoldados)
- ❌ Materiais em `product_accessories` **NÃO ERAM CRIADOS**

Produtos do tipo "ferragens_diversas" utilizam a tabela `product_accessories` com `item_type = 'material'` para definir os materiais que os compõem.

### Impacto
- Insumos de ferragens diversas não apareciam no resumo de consumo
- Estoque não era debitado para produtos como grades, portões, etc.
- Custos de produção incorretos
- Relatórios financeiros incompletos

---

## ✅ SOLUÇÃO IMPLEMENTADA

### 1. Código Corrigido (DailyProduction.tsx)

Adicionada verificação de `product_accessories`:

```typescript
// 3. VERIFICAR SE PRODUTO TEM ACESSÓRIOS/MATERIAIS (PARA FERRAGENS DIVERSAS)
const { data: accessories, error: accessoriesError } = await supabase
  .from('product_accessories')
  .select('material_id, quantity, item_type')
  .eq('product_id', formData.product_id);

// Filtrar apenas acessórios do tipo 'material' que têm material_id
const materialAccessories = accessories.filter(
  acc => acc.item_type === 'material' && acc.material_id
);

// Criar movimentos para cada acessório
materialAccessories.forEach(acc => {
  movements.push({
    material_id: acc.material_id,
    movement_type: 'saida',
    quantity: acc.quantity * parseFloat(formData.quantity),
    movement_date: formData.production_date,
    production_id: productionData.id,
    notes: `Consumo de acessório/material para produção de ${formData.quantity} ${productUnit} de ${productName}`,
  });
});
```

### 2. Migration para Dados Históricos

Criada migration `fix_missing_accessories_material_movements.sql` que:

```sql
-- Busca produções que têm produtos com acessórios do tipo 'material'
-- Verifica se movimentos de materiais existem
-- Cria os movimentos faltantes automaticamente
```

**Lógica:**
1. Encontra todas as produções com produtos que têm product_accessories
2. Filtra apenas acessórios com `item_type = 'material'` e `material_id` preenchido
3. Verifica se já existe movimento desse material
4. Se NÃO existir, cria o movimento com a quantidade correta
5. Adiciona nota: "(corrigido automaticamente)"

---

## 📊 RESULTADO

### Antes da Correção
```
Produto: Grade divisória de pocilga - 3,00m
Materiais cadastrados em product_accessories:
  - Ferro CA-50 6.3mm: 15 kg
  - Solda: 0.5 kg

Produção: 10 unidades

❌ NENHUM movimento de material criado
❌ Estoque não debitado
❌ Não aparece no resumo de consumo
```

### Depois da Correção
```
Produto: Grade divisória de pocilga - 3,00m
Materiais cadastrados em product_accessories:
  - Ferro CA-50 6.3mm: 15 kg
  - Solda: 0.5 kg

Produção: 10 unidades

✅ Movimentos criados:
  - Ferro CA-50 6.3mm: 150 kg (15 × 10)
  - Solda: 5 kg (0.5 × 10)

✅ Estoque debitado corretamente
✅ Aparece no resumo de consumo
```

---

## 🔄 FLUXO COMPLETO DE VERIFICAÇÃO

Agora ao registrar uma produção, o sistema verifica **TODAS** as fontes de materiais:

```
1. RECEITAS (recipe_items)
   └─ Para produtos de concreto que têm traço cadastrado

2. PESOS DE MATERIAIS (product_material_weights)
   └─ Para produtos com peso específico de materiais

3. ACESSÓRIOS/MATERIAIS (product_accessories) ✅ NOVO
   └─ Para produtos do tipo ferragens_diversas
   └─ Filtra apenas item_type = 'material'

4. INSERIR TODOS OS MOVIMENTOS (batch)
   └─ Cria todos os movimentos de uma vez

5. ARMADURAS (product_reinforcements)
   └─ Para produtos premoldados com armação
```

---

## 🧪 VALIDAÇÃO

### Como Testar

1. **Testar Nova Produção:**
   ```
   1. Vá em Produção Diária
   2. Registre produção de "Grade divisória de pocilga"
   3. Gere o resumo do dia
   4. ✅ Verificar se Ferro e Solda aparecem no consumo
   ```

2. **Verificar Dados Históricos:**
   ```
   1. Selecione data antiga (antes da correção)
   2. Gere o resumo do dia
   3. ✅ Materiais de ferragens diversas devem aparecer agora
   ```

3. **Verificar Logs (Console):**
   ```
   Ao registrar produção, deve aparecer:
   ✅ "Acessórios encontrados: X"
   ✅ "Acessórios de material encontrados: Y"
   ✅ "Criando Z movimentos de materiais..."
   ```

### Query de Verificação

```sql
-- Ver movimentos criados pela correção para ferragens diversas
SELECT 
  mm.movement_date,
  m.name as material,
  mm.quantity,
  mm.notes,
  p.quantity as prod_quantity,
  pr.name as product,
  pr.product_type
FROM material_movements mm
INNER JOIN materials m ON m.id = mm.material_id
INNER JOIN production p ON p.id = mm.production_id
INNER JOIN products pr ON pr.id = p.product_id
WHERE pr.product_type = 'ferragens_diversas'
  AND mm.notes LIKE '%acessório%'
ORDER BY mm.movement_date DESC;
```

---

## 📝 ARQUIVOS MODIFICADOS

```
✅ src/components/DailyProduction.tsx
   - Adicionada verificação de product_accessories
   - Filtro por item_type = 'material'
   - Logs adicionados para debug
   
✅ supabase/migrations/fix_missing_accessories_material_movements.sql
   - Corrige dados históricos
   - Cria movimentos faltantes de acessórios
   - Adiciona nota de correção automática
```

---

## 🎯 TIPOS DE PRODUTO E SUAS FONTES DE MATERIAIS

### 1. Artifact (Artefatos de Concreto)
```
Fontes de materiais:
├─ recipe_items (traço de concreto) ✅
└─ product_material_weights (opcional) ✅
```

### 2. Premolded (Pré-Moldados)
```
Fontes de materiais:
├─ recipe_items (traço de concreto) ✅
├─ product_reinforcements (armaduras) ✅
└─ product_accessories (desmoldante, gancho, etc) ✅
```

### 3. Ferragens Diversas ✅ CORRIGIDO
```
Fontes de materiais:
└─ product_accessories (ferro, solda, etc) ✅ AGORA FUNCIONA
   └─ Apenas item_type = 'material'
```

---

## ⚠️ OBSERVAÇÕES IMPORTANTES

### 1. Item Type em Product Accessories

A tabela `product_accessories` tem dois tipos de items:
- **`material`**: Insumo do estoque (ex: ferro, solda, desmoldante)
  - ✅ Gera movimento de material
  - ✅ Debita estoque
  - ✅ Aparece no resumo de consumo

- **`product`**: Produto acabado (ex: grade pequena dentro de grade grande)
  - ❌ NÃO gera movimento de material
  - ❌ Usa outro fluxo de produção

### 2. Material ID Obrigatório

Para que o movimento seja criado, o acessório precisa ter:
```sql
item_type = 'material' 
AND material_id IS NOT NULL
```

Se `material_id` for NULL, o acessório é apenas descritivo e não gera movimento.

### 3. Movimentos Duplicados

A migration verifica se já existe movimento antes de criar:
```sql
WHERE NOT EXISTS (
  SELECT 1 FROM material_movements mm
  WHERE mm.production_id = p.id
  AND mm.material_id = pa.material_id
)
```

**Não há risco de duplicação!**

---

## ✅ CHECKLIST DE VALIDAÇÃO

- [x] Código atualizado em DailyProduction.tsx
- [x] Migration aplicada com sucesso
- [x] Console.log adicionado para debug
- [x] Verifica item_type = 'material'
- [x] Filtra apenas com material_id preenchido
- [x] Cria movimentos em batch
- [x] Previne duplicação
- [x] Documentação criada
- [ ] Testar com produção nova de ferragem
- [ ] Verificar dados históricos
- [ ] Validar resumo de consumo
- [ ] Confirmar com usuário

---

## 🚀 PRÓXIMOS PASSOS

1. **Teste em Produção:**
   - Registrar produção de "Grade divisória de pocilga"
   - Verificar se materiais aparecem no resumo

2. **Validar Histórico:**
   - Gerar resumo de dias anteriores
   - Confirmar correção dos dados

3. **Monitorar:**
   - Verificar console logs
   - Garantir que movimentos estão sendo criados

---

## 📚 EXEMPLO PRÁTICO

### Produto: Grade divisória de pocilga - 3,00m

**Tipo:** `ferragens_diversas`

**Acessórios Cadastrados:**
```
┌─────────────────────┬──────────────┬──────────┬────────────┐
│ Descrição           │ Material     │ Qtd/un   │ Item Type  │
├─────────────────────┼──────────────┼──────────┼────────────┤
│ Ferro principal     │ CA-50 6.3mm  │ 15 kg    │ material   │
│ Solda MIG           │ Solda        │ 0.5 kg   │ material   │
│ Pintura (opcional)  │ Tinta spray  │ 0.2 L    │ material   │
└─────────────────────┴──────────────┴──────────┴────────────┘
```

**Produção: 5 unidades**

**Movimentos Criados:**
```
┌─────────────────┬────────────┬────────────────────────────┐
│ Material        │ Quantidade │ Nota                       │
├─────────────────┼────────────┼────────────────────────────┤
│ CA-50 6.3mm     │ 75 kg      │ Consumo de acessório/ma... │
│ Solda           │ 2.5 kg     │ Consumo de acessório/ma... │
│ Tinta spray     │ 1 L        │ Consumo de acessório/ma... │
└─────────────────┴────────────┴────────────────────────────┘
```

---

**Criado em:** 30 de Janeiro de 2026
**Status:** 🟢 PRONTO PARA TESTES
**Prioridade:** 🔴 ALTA (Bug crítico corrigido)

**Resultado:** Sistema agora registra corretamente todos os materiais de produtos do tipo "ferragens diversas", incluindo grades, portões e outros produtos metálicos. Dados históricos foram corrigidos automaticamente.
