# Correção - Erro ao Cadastrar Cliente Solteiro

## Problema Identificado

Erro ao salvar cliente quando marcada opção "Solteiro(a)":
```
new row for relation "customers" violates check constraint "customers_marital_regime_check"
```

## Causa do Problema

Quando o estado civil era alterado para "solteiro", os campos relacionados ao cônjuge e regime de bens não eram limpos automaticamente, causando inconsistência nos dados enviados ao banco.

O banco de dados tem uma constraint que valida:
- `marital_regime` deve ser NULL ou um dos valores específicos
- Quando o estado civil é "solteiro", o regime de bens DEVE ser NULL

## Solução Implementada

### 1. Limpeza Automática de Campos

Modificado o componente `Customers.tsx` para limpar automaticamente os campos quando "Solteiro(a)" é selecionado:

```typescript
onChange={(e) => {
  const newValue = e.target.value as any;
  if (newValue === 'solteiro' || newValue === '') {
    setFormData({
      ...formData,
      marital_status_type: newValue,
      marital_regime: '',
      spouse_name: '',
      spouse_cpf: ''
    });
  } else {
    setFormData({ ...formData, marital_status_type: newValue });
  }
}}
```

### 2. Validação ao Salvar

Adicionada validação extra na função de salvar para garantir que o regime de bens seja NULL quando o estado civil for "solteiro" ou não informado:

```typescript
marital_regime: (formData.marital_status_type === 'solteiro' || !formData.marital_status_type)
  ? null
  : (formData.marital_regime || null)
```

## Comportamento Correto Agora

✅ **Solteiro(a)**: Campos de cônjuge e regime ficam ocultos e são enviados como NULL
✅ **Casado(a)**: Campos de cônjuge e regime aparecem e podem ser preenchidos
✅ **União Estável**: Campos de cônjuge e regime aparecem e podem ser preenchidos
✅ **Não Informado**: Todos os campos opcionais são enviados como NULL

## Como Testar

1. Acesse o módulo de Clientes
2. Clique em "Novo Cliente"
3. Preencha os dados básicos
4. Selecione "Solteiro(a)" em Estado Civil
5. Salve o cliente - Deve funcionar corretamente
6. Edite o cliente e mude para "Casado(a)"
7. Preencha os dados do cônjuge e regime
8. Volte para "Solteiro(a)" - Os campos devem ser limpos automaticamente
9. Salve novamente - Deve funcionar sem erros

## Status

✅ **Corrigido**
- Build executado com sucesso
- Validações implementadas
- Lógica de limpeza automática funcionando
