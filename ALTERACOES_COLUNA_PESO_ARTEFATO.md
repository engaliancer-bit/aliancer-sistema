# Alterações Técnicas - Coluna peso_artefato

## Data: 02/02/2026

## Objetivo
Adicionar coluna específica `peso_artefato` na tabela `products` para armazenar o peso unitário de produtos do tipo "artefato", facilitando o cálculo proporcional de consumo de insumos.

---

## 1. Alterações no Banco de Dados

### Migration Criada
**Arquivo**: `add_peso_artefato_to_products.sql`

### Características da Coluna
- **Nome**: `peso_artefato`
- **Tipo**: `DECIMAL(10,3)`
- **Nullable**: Sim (opcional)
- **Unidade**: Quilogramas (kg)
- **Precisão**: 3 casas decimais (ex: 14.567 kg)
- **Uso**: Exclusivo para produtos do tipo `'artefato'`
- **Índice**: Criado para melhorar performance

---

## 2. Alterações no Frontend

### Arquivo Modificado
`src/components/Products.tsx`

### 2.1. Estado do Formulário
Adicionado campo `peso_artefato: ''` em:
- Estado inicial (linha ~173)
- Função `resetForm` (linha ~526)
- Funções de edição (linhas ~1076 e ~1207)

### 2.2. Lógica de Cálculo
Substituído `formData.total_weight` por `formData.peso_artefato` para produtos tipo artefato

### 2.3. Interface do Usuário
Campo de input atualizado:
- `step` alterado de `0.01` para `0.001` (3 casas decimais)
- `value` usa `formData.peso_artefato`
- Placeholder: `100.000`

### 2.4. Salvamento
Adicionado ao objeto de save:
```typescript
peso_artefato: formData.peso_artefato ? parseFloat(formData.peso_artefato) : null
```

---

## 3. Vantagens

1. **Clareza**: Campo específico com nome autodescritivo
2. **Precisão**: 3 casas decimais, tipo DECIMAL
3. **Performance**: Índice para queries rápidas
4. **Manutenibilidade**: Código mais legível
5. **Compatibilidade**: Nullable, não quebra dados existentes

---

## 4. Teste Rápido

```sql
-- Verificar produtos artefato com peso
SELECT
  name,
  peso_artefato,
  material_cost
FROM products
WHERE product_type = 'artifact'
  AND peso_artefato IS NOT NULL;
```

---

## Status

✅ **Concluído**
- Migration aplicada
- Código atualizado
- Build compilado (16.07s)
- Pronto para uso

