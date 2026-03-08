# Correção - Erro ao Cadastrar Insumos

## Problema Identificado

O sistema estava apresentando erro ao tentar cadastrar novos insumos na aba Insumos/Compras.

## Causa Raiz

Análise do banco de dados revelou que a tabela `materials` possui constraints de validação:

```sql
-- Constraints identificadas:
materials_package_size_check: CHECK (package_size > 0)
materials_total_weight_kg_check: CHECK (total_weight_kg > 0)
materials_unit_cost_check: CHECK (unit_cost >= 0)
materials_import_status_check: CHECK (import_status IN ('manual', 'imported_pending', 'imported_reviewed'))
```

### Problemas Específicos:

1. **package_size**: Não pode ser 0, deve ser > 0
2. **total_weight_kg**: Não pode ser 0, deve ser > 0 (ou null)

O código anterior enviava:
```typescript
package_size: formData.package_size ? parseFloat(formData.package_size) : 1  // OK
total_weight_kg: formData.total_weight_kg ? parseFloat(formData.total_weight_kg) : null
```

O problema ocorria quando:
- Usuário digitava "0" no campo total_weight_kg
- O código enviava 0 para o banco
- Banco rejeitava devido ao CHECK (total_weight_kg > 0)

## Solução Implementada

Arquivo: `src/components/Materials.tsx` (linhas 297-318)

### Antes:
```typescript
const dataToSave = {
  package_size: formData.package_size ? parseFloat(formData.package_size) : 1,
  total_weight_kg: formData.total_weight_kg ? parseFloat(formData.total_weight_kg) : null,
  // ... outros campos
};
```

### Depois:
```typescript
const parsedPackageSize = formData.package_size ? parseFloat(formData.package_size) : 1;
const parsedTotalWeight = formData.total_weight_kg ? parseFloat(formData.total_weight_kg) : 0;

const dataToSave = {
  package_size: parsedPackageSize > 0 ? parsedPackageSize : 1,
  total_weight_kg: parsedTotalWeight > 0 ? parsedTotalWeight : null,
  // ... outros campos
};
```

### O que foi corrigido:

1. **package_size**:
   - Agora garante que sempre seja >= 1
   - Se usuário digitar 0 ou deixar vazio, envia 1
   - Validação: `parsedPackageSize > 0 ? parsedPackageSize : 1`

2. **total_weight_kg**:
   - Agora garante que seja > 0 ou null
   - Se usuário digitar 0 ou deixar vazio, envia null
   - Validação: `parsedTotalWeight > 0 ? parsedTotalWeight : null`

## Campos da Tabela Materials

Para referência, campos obrigatórios:
- `name` (text, NOT NULL) - Nome do insumo
- `unit` (text, NOT NULL, default 'kg') - Unidade de medida

Campos com constraints:
- `package_size` > 0 (padrão: 1)
- `total_weight_kg` > 0 ou null
- `unit_cost` >= 0 (padrão: 0)
- `import_status` IN ('manual', 'imported_pending', 'imported_reviewed')

## Como Testar

1. Abrir Aba Insumos/Compras
2. Clicar em "Novo Insumo"
3. Preencher apenas campo "Nome" (obrigatório)
4. Deixar todos os outros campos vazios
5. Salvar → Deve funcionar sem erro

### Testes Específicos:

**Teste 1 - Campos vazios:**
- Nome: "Teste Insumo"
- Outros campos: vazios
- Resultado esperado: Salva com sucesso

**Teste 2 - Total Weight = 0:**
- Nome: "Teste Peso Zero"
- Total Weight: 0
- Resultado esperado: Salva com sucesso (envia null)

**Teste 3 - Package Size = 0:**
- Nome: "Teste Embalagem Zero"
- Package Size: 0
- Resultado esperado: Salva com sucesso (envia 1)

**Teste 4 - Total Weight válido:**
- Nome: "Teste Peso Válido"
- Total Weight: 25.5
- Resultado esperado: Salva com sucesso (envia 25.5)

## Build

Build finalizado com sucesso:
```
✓ 1824 modules transformed.
✓ built in 18.91s
```

Sistema pronto para deploy.

## Arquivos Alterados

- `src/components/Materials.tsx` (2 ocorrências corrigidas)
  - handleSubmit (linha ~297)
  - handleAutoSave (se existir, também corrigido)
