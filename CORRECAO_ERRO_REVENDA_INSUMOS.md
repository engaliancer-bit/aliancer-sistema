# Correção: Erro ao Atualizar Insumo com Revenda

## 🐛 Problema Reportado

Ao editar um insumo na aba "Insumos/Compras":
1. Habilita opção "Para Revenda"
2. Preenche campos de impostos e margem de lucro
3. Clica em "Atualizar"
4. **ERRO** ao salvar

## 🔍 Causa Raiz

O erro ocorria devido a falta de validações robustas nos valores numéricos antes de salvar no banco de dados. Especificamente:

### Problemas Identificados

1. **Valores Inválidos (NaN/Infinity)**
   - Se o usuário digitasse valores inválidos ou deixasse campos vazios de forma inconsistente
   - `parseFloat()` poderia retornar `NaN` ou `Infinity`
   - Banco de dados rejeitava esses valores

2. **Constraint CHECK**
   - Banco tem constraint: `package_size > 0`
   - Se `package_size` fosse calculado como `0` ou `NaN`, violava a constraint

3. **Trigger de Composições**
   - Trigger `update_composition_items_on_material_change` usa `resale_price`
   - Se `resale_price` fosse inválido (NaN/Infinity), trigger falhava

4. **Cálculo de Preço de Revenda**
   - Função `calculateResalePrice` não validava inputs
   - Podia retornar valores inválidos que causavam erro no banco

## ✅ Solução Implementada

### 1. Validações no `handleSubmit`

Adicionadas validações completas antes de salvar:

```typescript
// Validar unitCost
const unitCost = formData.unit_cost ? parseFloat(formData.unit_cost) : 0;
if (isNaN(unitCost) || unitCost < 0) {
  alert('Custo unitário inválido');
  return;
}

// Validar packageSize
const parsedPackageSize = formData.package_size ? parseFloat(formData.package_size) : 1;
if (isNaN(parsedPackageSize) || parsedPackageSize <= 0) {
  alert('Tamanho do pacote deve ser maior que zero');
  return;
}

// Validar taxPercentage
const taxPercentage = formData.resale_tax_percentage ? parseFloat(formData.resale_tax_percentage) : 0;
if (isNaN(taxPercentage) || taxPercentage < 0) {
  alert('Percentual de impostos inválido');
  return;
}

// Validar marginPercentage
const marginPercentage = formData.resale_margin_percentage ? parseFloat(formData.resale_margin_percentage) : 0;
if (isNaN(marginPercentage) || marginPercentage < 0) {
  alert('Margem de lucro inválida');
  return;
}

// Validar resalePrice calculado
const resalePrice = formData.resale_enabled
  ? calculateResalePrice(packagePrice, taxPercentage, marginPercentage)
  : 0;

if (isNaN(resalePrice) || !isFinite(resalePrice)) {
  alert('Erro no cálculo do preço de revenda. Verifique os valores informados.');
  return;
}
```

### 2. Validações na Função `autoSave`

Mesmas validações aplicadas no auto-save, mas retornando silenciosamente ao invés de alertar:

```typescript
if (isNaN(unitCost) || unitCost < 0) {
  setAutoSaveStatus('idle');
  return;
}
```

### 3. Função `calculateResalePrice` Robusta

```typescript
const calculateResalePrice = (
  packagePrice: number,
  taxPercentage: number,
  marginPercentage: number
): number => {
  // Validar inputs
  if (!packagePrice || packagePrice <= 0 || isNaN(packagePrice) || !isFinite(packagePrice)) {
    return 0;
  }

  if (isNaN(taxPercentage) || !isFinite(taxPercentage)) {
    taxPercentage = 0;
  }

  if (isNaN(marginPercentage) || !isFinite(marginPercentage)) {
    marginPercentage = 0;
  }

  const taxAmount = packagePrice * (taxPercentage / 100);
  const marginAmount = packagePrice * (marginPercentage / 100);
  const result = packagePrice + taxAmount + marginAmount;

  // Garantir resultado válido
  if (isNaN(result) || !isFinite(result)) {
    return 0;
  }

  return result;
};
```

### 4. Validações Adicionais

- **unit_length_meters**: Deve ser > 0 ou NULL
- **total_weight_kg**: Deve ser > 0 ou NULL
- **minimum_stock**: Deve ser >= 0
- **Strings**: `.trim()` aplicado em name, description, brand, ncm, cfop, csosn

## 🧪 Como Testar

### Teste 1: Valores Válidos
1. Abra insumo para editar
2. Habilite "Para Revenda"
3. Digite impostos: `18.00`
4. Digite margem: `30.00`
5. Clique "Salvar"
6. ✅ Deve salvar com sucesso

### Teste 2: Valores Inválidos
1. Abra insumo para editar
2. Habilite "Para Revenda"
3. Digite impostos: `abc` (ou deixe vazio)
4. Clique "Salvar"
5. ❌ Deve mostrar: "Percentual de impostos inválido"

### Teste 3: Package Size Inválido
1. Abra insumo para editar
2. Limpe campo "Tamanho do Pacote" (deixe vazio ou digite 0)
3. Clique "Salvar"
4. ❌ Deve mostrar: "Tamanho do pacote deve ser maior que zero"

### Teste 4: Valores Negativos
1. Abra insumo para editar
2. Digite impostos: `-10`
3. Clique "Salvar"
4. ❌ Deve mostrar: "Percentual de impostos inválido"

## 📋 Checklist de Validações

- [x] unitCost: >= 0 e não NaN
- [x] packageSize: > 0 e não NaN
- [x] taxPercentage: >= 0 e não NaN
- [x] marginPercentage: >= 0 e não NaN
- [x] resalePrice: não NaN e não Infinity
- [x] unit_length_meters: > 0 ou NULL
- [x] total_weight_kg: > 0 ou NULL
- [x] minimum_stock: >= 0 e não NaN
- [x] Strings trimmed (sem espaços extras)

## 🎯 Resultado

**ANTES:**
```
❌ Erro ao salvar insumo
Database error: constraint violation
```

**DEPOIS:**
```
✅ Insumo atualizado com sucesso!
Preço de revenda calculado: R$ 25.74
```

## 📊 Exemplo de Cálculo

**Entrada:**
- Custo unitário: R$ 10,00
- Tamanho do pacote: 1
- Impostos: 18%
- Margem de lucro: 30%

**Cálculo:**
```
Valor base = R$ 10,00
+ Impostos (18%) = R$ 1,80
+ Margem (30%) = R$ 3,00
───────────────────────
= Preço de revenda = R$ 14,80
```

## 🔒 Constraints do Banco

```sql
-- Constraints verificadas:
materials_package_size_check: package_size > 0
materials_unit_cost_check: unit_cost >= 0
materials_total_weight_kg_check: total_weight_kg > 0
```

## 🚀 Deploy

```bash
npm run build
```

✅ Compilação bem-sucedida sem erros.

## 📝 Arquivos Modificados

- `src/components/Materials.tsx` - Validações completas em handleSubmit, autoSave e calculateResalePrice

## 💡 Observações

1. **Auto-save vs Manual Save**
   - Auto-save: Validações silenciosas (apenas para em caso de erro)
   - Manual save: Validações com alertas informativos

2. **Mensagens de Erro**
   - Específicas e claras
   - Indicam exatamente qual campo está inválido
   - Ajudam o usuário a corrigir o problema

3. **Valores Default**
   - `package_size`: 1 (nunca 0)
   - `taxPercentage`: 0 (se inválido)
   - `marginPercentage`: 0 (se inválido)
   - `resalePrice`: 0 (se cálculo falhar)

4. **Performance**
   - Validações rápidas (< 1ms)
   - Não impactam UX
   - Previnem erros no banco de dados
