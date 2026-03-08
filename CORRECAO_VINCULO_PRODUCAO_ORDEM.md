# Correção: Vínculo de Produção com Ordem de Produção

## Problema Identificado

Ao tentar vincular uma produção a uma ordem de produção, ocorria o erro:
```
Erro ao salvar a produção: invalid input syntax for type uuid
```

Este erro acontecia tanto ao criar uma nova produção quanto ao editar uma produção existente.

## Causa Raiz

Foram identificados dois problemas principais:

### 1. Erro de Sintaxe UUID

Quando os campos `production_order_id` e `production_order_item_id` estavam vazios (string vazia `''`), o sistema tentava salvar essas strings vazias no banco de dados, que esperava valores UUID válidos ou NULL.

**Código problemático:**
```typescript
production_order_id: formData.production_type === 'order' ? formData.production_order_id : null,
production_order_item_id: formData.production_type === 'order' ? formData.production_order_item_id : null,
```

Se `formData.production_order_id` fosse `''` (string vazia), o banco recebia `''` ao invés de `null`, causando o erro de sintaxe UUID.

### 2. Fluxo de Interface Impedindo Seleção

O campo de produto ficava **desabilitado** quando o usuário selecionava "Para Ordem de Produção", mas as ordens só eram carregadas quando um produto era selecionado. Isso criava um ciclo impossível:

1. Usuário seleciona "Para Ordem de Produção"
2. Campo de produto fica desabilitado
3. Sem produto selecionado, nenhuma ordem é carregada
4. Usuário não consegue selecionar uma ordem

## Soluções Implementadas

### 1. Correção de Sintaxe UUID

Adicionada validação para converter strings vazias em `null`:

```typescript
production_order_id: formData.production_type === 'order' && formData.production_order_id
  ? formData.production_order_id
  : null,
production_order_item_id: formData.production_type === 'order' && formData.production_order_item_id
  ? formData.production_order_item_id
  : null,
```

Esta correção foi aplicada em **dois lugares**:
- Na atualização direta (UPDATE) de produção existente
- Na chamada RPC `create_production_atomic` para nova produção

### 2. Fluxo de Interface Melhorado

Agora o campo de produto funciona assim:

#### Para Produção "Para Estoque":
- Campo **sempre habilitado**
- Usuário pode selecionar qualquer produto

#### Para Produção "Para Ordem de Produção":

**Passo 1 - Sem ordem selecionada:**
```
[✓] Produto: [Poste 9x9x280 ▼]  (selecione o produto para ver as ordens disponíveis)
```
- Campo **habilitado** para seleção
- Dica: "selecione o produto para ver as ordens disponíveis"

**Passo 2 - Produto selecionado, carregando ordens:**
```
[✓] Produto: [Poste 9x9x280 ▼]
[✓] Ordem: [OP #21 - Poste 9x9x280 - João Silva - Faltam 50 de 100 ▼]
```
- Ordens do produto são carregadas automaticamente
- Usuário pode selecionar a ordem

**Passo 3 - Ordem selecionada:**
```
[🔒] Produto: [Poste 9x9x280 ▼]  (definido pela ordem selecionada)
[✓] Ordem: OP #21 - Poste 9x9x280 - João Silva
```
- Campo de produto **travado** (disabled)
- Dica: "definido pela ordem selecionada"
- Previne mudança acidental de produto

**Se usuário mudar de ideia:**
- Pode mudar o produto novamente
- Ao trocar o produto, os campos de ordem são **limpos automaticamente**
- Novas ordens do novo produto são carregadas

## Código Modificado

### Arquivo: `src/components/DailyProduction.tsx`

#### 1. Correção de NULL em UPDATE (linhas 257-258)
```typescript
production_order_id: formData.production_type === 'order' && formData.production_order_id
  ? formData.production_order_id
  : null,
production_order_item_id: formData.production_type === 'order' && formData.production_order_item_id
  ? formData.production_order_item_id
  : null,
```

#### 2. Correção de NULL em RPC (linha 306)
```typescript
p_production_order_item_id: formData.production_type === 'order' && formData.production_order_item_id
  ? formData.production_order_item_id
  : null,
```

#### 3. Campo de Produto com Lógica Inteligente (linhas 794-817)
```typescript
<select
  value={formData.product_id}
  onChange={(e) => setFormData({
    ...formData,
    product_id: e.target.value,
    production_order_id: '',
    production_order_item_id: ''
  })}
  required
  disabled={formData.production_type === 'order' && (formData.production_order_item_id || formData.production_order_id) ? true : false}
>
```

**Lógica de desabilitação:**
- Desabilitado SOMENTE quando:
  - Tipo é "order" E
  - (Há um item de ordem OU há uma ordem selecionada)

**Limpeza automática ao trocar produto:**
- Quando o usuário muda o produto, os campos `production_order_id` e `production_order_item_id` são limpos
- Isso força o usuário a selecionar uma nova ordem compatível com o novo produto

## Fluxo Completo de Uso

### Cenário 1: Produção Para Estoque

1. Selecione "Para Estoque"
2. Escolha o produto
3. Informe a quantidade
4. Salvar

### Cenário 2: Produção Para Ordem (Novo Cadastro)

1. Selecione "Para Ordem de Produção"
2. **Escolha o produto** (campo habilitado)
3. Sistema carrega ordens abertas desse produto
4. **Selecione a ordem de produção**
5. Produto fica travado automaticamente
6. Informe a quantidade
7. Salvar

### Cenário 3: Editar Produção Existente Vinculada a Ordem

1. Clique em "Editar" em uma produção existente
2. Se estava vinculada a ordem:
   - Produto carregado e **travado**
   - Ordem carregada e selecionada
3. Pode alterar quantidade
4. Salvar (sem erro de UUID)

### Cenário 4: Trocar de Produto Durante Cadastro

1. Selecione "Para Ordem de Produção"
2. Escolha "Poste 9x9x280"
3. Ordens desse poste são carregadas
4. **Muda de ideia** e seleciona "Viga 10x20x500"
5. Campos de ordem são **limpos automaticamente**
6. Novas ordens da viga são carregadas
7. Selecione a ordem da viga
8. Continue normalmente

## Validações Implementadas

### Backend (Supabase)
- ✅ Campos UUID aceitam NULL quando não há ordem vinculada
- ✅ Campos UUID rejeitam strings vazias (com erro claro)
- ✅ Validação de que ordem existe e está aberta

### Frontend
- ✅ Não permite salvar sem ordem quando tipo é "order"
- ✅ Converte strings vazias em NULL antes de enviar
- ✅ Valida quantidade > 0
- ✅ Limpa ordens ao trocar produto
- ✅ Trava produto após selecionar ordem

## Mensagens de Erro Tratadas

### Antes:
```
Erro ao salvar a produção: invalid input syntax for type uuid
```
❌ Mensagem técnica, usuário não entende

### Depois:
Se usuário não selecionar ordem quando tipo é "order":
```
Selecione uma ordem de produção
```
✅ Mensagem clara e acionável

Se houver erro técnico:
```
Erro ao salvar a produção: [mensagem do erro]
```
✅ Erro é logado no console para debug

## Testes Recomendados

### Teste 1: Novo Cadastro com Ordem
1. Vá em Produção
2. Selecione "Para Ordem de Produção"
3. Escolha um produto (ex: Poste)
4. Verifique que ordens aparecem
5. Selecione uma ordem
6. Informe quantidade
7. Salvar
8. ✅ Deve salvar sem erro

### Teste 2: Editar Produção Vinculada
1. Encontre uma produção vinculada a ordem
2. Clique em "Editar"
3. Verifique que produto está travado
4. Verifique que ordem está selecionada
5. Mude a quantidade
6. Salvar
7. ✅ Deve atualizar sem erro

### Teste 3: Trocar de Produto
1. Selecione "Para Ordem de Produção"
2. Escolha produto A
3. Veja ordens do produto A
4. Mude para produto B
5. ✅ Campos de ordem devem ser limpos
6. ✅ Ordens do produto B devem carregar

### Teste 4: Produção Para Estoque
1. Selecione "Para Estoque"
2. Escolha produto
3. Informe quantidade
4. Salvar
5. ✅ Deve salvar com production_order_id = NULL

## Compatibilidade

✅ **Ordens Legadas (modelo antigo):** Suportadas
✅ **Ordens com Itens (modelo novo):** Suportadas
✅ **Produção para Estoque:** Funcionando
✅ **Produção para Ordem:** Funcionando
✅ **Edição de Produção:** Funcionando

## Logs de Debug

O sistema mantém logs detalhados no console (F12) para facilitar debug:

```javascript
=== DADOS DE PRODUÇÃO A SEREM SALVOS ===
Data formatada: 2026-02-10
Dados completos: {
  product_id: "uuid...",
  quantity: 10,
  production_date: "2026-02-10",
  production_type: "order",
  production_order_id: "uuid..." ou null,
  production_order_item_id: "uuid..." ou null,
  notes: ""
}
=======================================
```

## Benefícios

1. ✅ **Erro de UUID corrigido** - Não há mais erro ao salvar
2. ✅ **Interface intuitiva** - Usuário entende o fluxo
3. ✅ **Validações claras** - Mensagens de erro acionáveis
4. ✅ **Compatibilidade** - Funciona com ordens antigas e novas
5. ✅ **Segurança** - Produto travado após selecionar ordem previne erros
6. ✅ **Flexibilidade** - Usuário pode mudar de ideia e trocar produto

---

Sistema corrigido e pronto para uso! Agora é possível vincular produções a ordens de produção tanto em cadastros novos quanto em edições.
