# Resumo das Correções de Cadastros - Fevereiro 2026

## Visão Geral

Dois problemas críticos foram identificados e corrigidos no sistema:
1. Erro ao cadastrar/editar insumos na aba "Insumos/Compras"
2. Erro ao editar traços na aba "Traços"

## Causa Comum

Ambos os problemas eram causados pela mesma questão:
- **Envio de valores inválidos para o banco de dados que violavam constraints CHECK**

O PostgreSQL/Supabase possui validações de integridade (constraints) que rejeitam valores inválidos:
- Valores numéricos que devem ser > 0 não podem ser 0
- Enums que aceitam valores específicos não podem receber strings vazias

## Correções Implementadas

### 1. Correção em Materials.tsx (Insumos)

**Problema:**
```typescript
// ERRADO - Enviava 0 quando violava constraint
package_size: formData.package_size ? parseFloat(formData.package_size) : 1
total_weight_kg: formData.total_weight_kg ? parseFloat(formData.total_weight_kg) : null
```

**Solução:**
```typescript
// CORRETO - Valida antes de enviar
const parsedPackageSize = formData.package_size ? parseFloat(formData.package_size) : 1;
const parsedTotalWeight = formData.total_weight_kg ? parseFloat(formData.total_weight_kg) : 0;

package_size: parsedPackageSize > 0 ? parsedPackageSize : 1,        // Garante >= 1
total_weight_kg: parsedTotalWeight > 0 ? parsedTotalWeight : null   // Garante > 0 ou null
```

**Constraints do Banco:**
- `package_size` > 0 (não pode ser zero)
- `total_weight_kg` > 0 ou null (não pode ser zero)
- `unit_cost` >= 0

### 2. Correção em Recipes.tsx (Traços)

**Problema:**
```typescript
// ERRADO - Enviava valores inválidos
concrete_type: formData.concrete_type || null,                     // Podia enviar ''
specific_weight: formData.specific_weight ? parseFloat(...) : 0,    // Sempre enviava 0
moisture_percentage: formData.moisture_percentage ? parseFloat(...) : 0  // Sempre enviava 0
```

**Solução:**
```typescript
// CORRETO - Valida e converte adequadamente
const parsedSpecificWeight = formData.specific_weight ? parseFloat(formData.specific_weight) : 0;
const parsedMoisturePercentage = formData.moisture_percentage ? parseFloat(formData.moisture_percentage) : 0;

concrete_type: formData.concrete_type && formData.concrete_type !== '' ? formData.concrete_type : null,
specific_weight: parsedSpecificWeight > 0 ? parsedSpecificWeight : null,
moisture_percentage: (parsedMoisturePercentage >= 0 && parsedMoisturePercentage <= 100) ? parsedMoisturePercentage : null
```

**Constraints do Banco:**
- `concrete_type` IN ('dry', 'plastic') ou null (não aceita '')
- `moisture_percentage` entre 0-100 ou null

## Padrão de Correção Aplicado

Para todos os campos numéricos opcionais:

### Antes (padrão incorreto):
```typescript
campo: formData.campo ? parseFloat(formData.campo) : 0
```
**Problema:** Sempre enviava 0 quando vazio, violando constraints que exigem > 0

### Depois (padrão correto):
```typescript
const parsed = formData.campo ? parseFloat(formData.campo) : 0;
campo: parsed > 0 ? parsed : null
```
**Solução:** Envia null quando valor é inválido (0 ou negativo)

## Melhorias no Tratamento de Erros

Ambos os componentes agora possuem logs detalhados:

```typescript
catch (error: any) {
  console.error('======= ERRO AO SALVAR =======');
  console.error('Erro completo:', error);
  console.error('Mensagem:', error?.message);
  console.error('Detalhes:', error?.details);
  console.error('Hint:', error?.hint);
  console.error('Código:', error?.code);
  console.error('Dados enviados:', dataToSave);
  console.error('====================================');
  alert(`Erro: ${error?.message || 'Erro desconhecido'}\n${error?.details || ''}`);
}
```

**Benefícios:**
- Facilita identificação de problemas em produção
- Mostra exatamente quais dados causaram o erro
- Exibe mensagem do banco ao usuário para melhor compreensão

## Regras Gerais para Novos Desenvolvimentos

### ✅ FAZER:

1. **Sempre validar valores antes de enviar ao banco**
   ```typescript
   const parsed = value ? parseFloat(value) : 0;
   campo: parsed > 0 ? parsed : null
   ```

2. **Usar null para campos opcionais vazios**
   - Nunca enviar 0 para campos com constraint > 0
   - Nunca enviar '' para campos com constraint IN (...)

3. **Verificar constraints do banco antes de implementar**
   ```sql
   SELECT constraint_name, pg_get_constraintdef(oid)
   FROM pg_constraint
   WHERE conrelid = 'tabela'::regclass;
   ```

4. **Adicionar logs detalhados nos catches**
   - Incluir dados enviados
   - Incluir todas as propriedades do erro

### ❌ NÃO FAZER:

1. **Nunca enviar valores padrão que violam constraints**
   ```typescript
   // ERRADO
   campo_com_check_gt_zero: valor || 0  // Pode violar CHECK > 0
   ```

2. **Nunca ignorar validações de enum**
   ```typescript
   // ERRADO
   campo_enum: valor || ''  // String vazia não está no enum
   ```

3. **Nunca usar valores mágicos sem validação**
   ```typescript
   // ERRADO
   campo: parseFloat(valor) || 0  // Pode gerar valores inválidos
   ```

## Testes Recomendados

Para cada formulário com campos opcionais:

1. **Teste de campos vazios**
   - Deixar campos opcionais completamente vazios
   - Verificar se salva sem erro

2. **Teste de valor zero**
   - Digitar explicitamente 0 em campos numéricos
   - Verificar se converte para null ou valor padrão válido

3. **Teste de valor inválido**
   - Digitar valores fora do range permitido
   - Verificar se há validação adequada

4. **Teste de edição**
   - Editar registro existente
   - Remover valores opcionais
   - Verificar se atualiza corretamente

## Checklist de Verificação

Ao implementar novos formulários:

- [ ] Verificar constraints da tabela no banco
- [ ] Validar valores numéricos antes de enviar
- [ ] Converter valores inválidos para null
- [ ] Validar enums explicitamente
- [ ] Adicionar logs detalhados de erro
- [ ] Testar com campos vazios
- [ ] Testar com valor zero
- [ ] Testar edição de registros existentes

## Arquivos Alterados

1. `src/components/Materials.tsx`
   - handleSubmit (linha ~297)
   - handleAutoSave (linha ~141)

2. `src/components/Recipes.tsx`
   - handleSubmit (linha ~119)

## Status do Build

✅ Build concluído com sucesso em ambas as correções
✅ Sistema pronto para deploy
✅ Todas as validações TypeScript passando

## Documentação Adicional

- `CORRECAO_CADASTRO_INSUMOS.md` - Detalhes da correção em Materials
- `CORRECAO_EDICAO_TRACOS.md` - Detalhes da correção em Recipes

## Próximos Passos Recomendados

1. **Revisar outros formulários** do sistema aplicando o mesmo padrão
2. **Criar função utilitária** para validação de campos numéricos opcionais
3. **Documentar constraints** de todas as tabelas principais
4. **Adicionar testes automatizados** para validações de formulário

## Exemplo de Função Utilitária (Proposta)

```typescript
// src/lib/formValidation.ts

/**
 * Valida e converte valor numérico opcional
 * @param value - Valor do formulário (string)
 * @param min - Valor mínimo permitido (opcional)
 * @param max - Valor máximo permitido (opcional)
 * @returns Número válido ou null
 */
export function parseOptionalNumber(
  value: string,
  min?: number,
  max?: number
): number | null {
  if (!value || value.trim() === '') return null;

  const parsed = parseFloat(value);

  if (isNaN(parsed)) return null;
  if (min !== undefined && parsed < min) return null;
  if (max !== undefined && parsed > max) return null;

  return parsed;
}

// Uso:
const dataToSave = {
  package_size: parseOptionalNumber(formData.package_size, 0.01) ?? 1,
  total_weight_kg: parseOptionalNumber(formData.total_weight_kg, 0.01),
  moisture_percentage: parseOptionalNumber(formData.moisture_percentage, 0, 100),
};
```
