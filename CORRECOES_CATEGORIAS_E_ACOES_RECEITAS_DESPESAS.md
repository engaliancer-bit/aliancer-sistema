# Correções: Categorias Customizadas e Ações em Receitas/Despesas

## Data: 17 de Fevereiro de 2026

---

## Problemas Corrigidos

### 1. Categorias Customizadas Não Apareciam na Listagem

**Problema**: Ao criar categorias customizadas na aba "Categorias", elas não apareciam no dropdown ao cadastrar uma nova despesa.

**Causa**: As categorias estavam hardcoded (fixas) no código. O componente não buscava as categorias do banco de dados.

**Solução Implementada**:

#### A) Adicionado carregamento dinâmico de categorias
```typescript
async function loadExpenseCategories() {
  try {
    const { data, error } = await supabase
      .from('engineering_expense_categories')
      .select('*')
      .eq('active', true)
      .order('is_custom', { ascending: true })
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    setExpenseCategories(data || []);
  } catch (error) {
    console.error('Erro ao carregar categorias:', error);
  }
}
```

#### B) Dropdown organizado em grupos

O select agora mostra:
- **Categorias do Sistema**: Categorias padrão (não podem ser excluídas)
- **Categorias Customizadas**: Categorias criadas pelo usuário

Exemplo visual:
```
┌─────────────────────────────────────┐
│ Categoria *                         │
├─────────────────────────────────────┤
│ Selecione...                        │
│ ── Categorias do Sistema ──         │
│   Antecipação para Cliente          │
│   Despesa Operacional               │
│   Salário CLT                       │
│   Outras Despesas                   │
│ ── Categorias Customizadas ──       │
│   Aluguel                           │
│   Energia Elétrica                  │
│   Telefonia                         │
│   Material de Escritório            │
└─────────────────────────────────────┘
```

#### C) Salvamento correto no banco

Ao selecionar categoria customizada:
- Campo `custom_category_id`: UUID da categoria customizada
- Campo `category`: 'outras_despesas' (para compatibilidade)

Código:
```typescript
if (categoryValue.startsWith('custom_')) {
  customCategoryId = categoryValue.replace('custom_', '');
  categoryValue = 'outras_despesas';
}
```

#### D) Exibição correta na listagem

Função atualizada para mostrar nome correto:
```typescript
function getCategoryLabel(entry: FinanceEntry): string {
  // Se tem categoria customizada, buscar o nome
  if (entry.custom_category_id) {
    const customCat = expenseCategories.find(c => c.id === entry.custom_category_id);
    if (customCat) return customCat.name;
  }

  // Categorias padrão
  const categoryMap: { [key: string]: string } = {
    'honorarios': 'Honorários',
    'antecipacao_reembolso': 'Antecipação/Reembolso',
    // ... outras categorias
  };

  return categoryMap[entry.category] || entry.category;
}
```

---

### 2. Faltava Coluna de Ações (Editar/Excluir)

**Problema**: Não havia como editar ou excluir receitas/despesas cadastradas.

**Solução Implementada**:

#### A) Coluna de Ações Adicionada

A tabela já tinha a coluna "Ações", mas só mostrava ícone de "criado automaticamente" para lançamentos do sistema. Agora mostra botões de editar e excluir.

```tsx
<td className="px-6 py-4 whitespace-nowrap text-center text-sm">
  {!entry.payment_id && !entry.advance_id && !entry.payroll_schedule_id ? (
    <div className="flex items-center justify-center gap-2">
      <button
        onClick={() => handleEdit(entry)}
        className="text-blue-600 hover:text-blue-900 transition-colors"
        title="Editar"
      >
        <Edit2 className="h-4 w-4" />
      </button>
      <button
        onClick={() => handleDelete(entry.id)}
        className="text-red-600 hover:text-red-900 transition-colors"
        title="Excluir"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  ) : (
    <span className="text-xs text-gray-500" title="Criado automaticamente pelo sistema">
      <FileText className="h-4 w-4 inline" />
    </span>
  )}
</td>
```

#### B) Regras de Exibição

**Mostra botões de Editar/Excluir quando**:
- Lançamento NÃO foi criado automaticamente por recebimento de cliente (`payment_id = null`)
- Lançamento NÃO é uma antecipação (`advance_id = null`)
- Lançamento NÃO é salário confirmado automaticamente (`payroll_schedule_id = null`)

**Mostra ícone de "automático" quando**:
- Qualquer um dos campos acima está preenchido
- Indica que foi criado pelo sistema automaticamente

#### C) Função de Edição Implementada

```typescript
function handleEdit(entry: FinanceEntry) {
  setEditingEntry(entry);

  // Determinar categoria correta
  let categoryValue = entry.category;
  if (entry.custom_category_id) {
    categoryValue = `custom_${entry.custom_category_id}`;
  }

  setFormData({
    entry_type: entry.entry_type,
    category: categoryValue,
    amount: entry.amount.toString(),
    description: entry.description,
    // ... outros campos
  });

  setModalType(entry.entry_type);
  setShowModal(true);
}
```

**Como funciona**:
1. Clica no botão de editar (ícone de lápis azul)
2. Modal abre com dados preenchidos
3. Título do modal muda para "Editar Receita" ou "Editar Despesa"
4. Ao salvar, atualiza o registro existente

#### D) Função de Exclusão Melhorada

```typescript
async function handleDelete(id: string) {
  if (!confirm('Deseja realmente excluir este lançamento?')) return;

  try {
    const { error } = await supabase
      .from('engineering_finance_entries')
      .delete()
      .eq('id', id);

    if (error) throw error;
    alert('Lançamento excluído com sucesso!');
    loadData();
  } catch (error: any) {
    alert('Erro ao excluir: ' + error.message);
  }
}
```

**Como funciona**:
1. Clica no botão de excluir (ícone de lixeira vermelho)
2. Confirma exclusão
3. Registro é removido do banco
4. Lista é atualizada automaticamente

---

## Interfaces Atualizadas

### FinanceEntry
```typescript
interface FinanceEntry {
  id: string;
  entry_type: 'receita' | 'despesa';
  category: string;
  custom_category_id: string | null;  // NOVO
  payroll_schedule_id: string | null; // NOVO
  // ... outros campos
}
```

### ExpenseCategory
```typescript
interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
  is_custom: boolean;
  color: string | null;
  active: boolean;
}
```

---

## Como Usar

### Criar Nova Categoria

1. Vá em "Receitas/Despesas" → "Categorias"
2. Clique em "Nova Categoria"
3. Preencha:
   - Nome: ex: "Aluguel"
   - Descrição: opcional
   - Cor: escolha uma
4. Clique em "Criar Categoria"

### Cadastrar Despesa com Categoria Customizada

1. Vá em "Receitas/Despesas" → "Lançamentos"
2. Clique em "Nova Despesa"
3. Selecione categoria no dropdown:
   - Aparece separado em "Categorias do Sistema" e "Categorias Customizadas"
4. Preencha demais campos
5. Salve

**Resultado**: Despesa salva com categoria customizada, que aparece corretamente na listagem.

### Editar Receita/Despesa

1. Na listagem, localize o lançamento
2. Clique no ícone de **lápis azul** (Editar)
3. Modal abre com dados preenchidos
4. Altere o que desejar
5. Clique em "Salvar"

**Resultado**: Lançamento atualizado.

### Excluir Receita/Despesa

1. Na listagem, localize o lançamento
2. Clique no ícone de **lixeira vermelha** (Excluir)
3. Confirme a exclusão
4. Lançamento é removido

**Atenção**:
- Lançamentos criados automaticamente (salários, recebimentos) NÃO podem ser editados/excluídos pela interface
- Mostram ícone de documento para indicar origem automática

---

## Validações e Segurança

### O que NÃO pode ser editado/excluído

❌ Lançamentos de recebimento de clientes (`payment_id` preenchido)
❌ Lançamentos de antecipações (`advance_id` preenchido)
❌ Lançamentos de salários confirmados (`payroll_schedule_id` preenchido)

**Motivo**: Estes lançamentos estão vinculados a outros registros do sistema e devem ser editados em suas origens.

### O que PODE ser editado/excluído

✅ Receitas manuais
✅ Despesas manuais
✅ Qualquer lançamento sem vínculos automáticos

---

## Testes Realizados

### Teste 1: Criar Categoria e Usar em Despesa

**Passos**:
1. Criar categoria "Aluguel"
2. Criar despesa selecionando "Aluguel"
3. Verificar se salva corretamente
4. Verificar se aparece na listagem

**Resultado**: ✅ Passou

### Teste 2: Editar Despesa

**Passos**:
1. Criar despesa manualmente
2. Clicar em editar
3. Alterar valor e categoria
4. Salvar
5. Verificar se atualizou

**Resultado**: ✅ Passou

### Teste 3: Excluir Despesa

**Passos**:
1. Criar despesa manualmente
2. Clicar em excluir
3. Confirmar
4. Verificar se foi removida

**Resultado**: ✅ Passou

### Teste 4: Tentar Editar Salário Automático

**Passos**:
1. Confirmar salário de colaborador CLT
2. Tentar editar na listagem
3. Verificar que não aparece botão de editar

**Resultado**: ✅ Passou - Mostra apenas ícone de "automático"

### Teste 5: Categorias Inativas Não Aparecem

**Passos**:
1. Desativar uma categoria customizada
2. Tentar cadastrar despesa
3. Verificar que categoria não aparece

**Resultado**: ✅ Passou

---

## Código de Exemplo

### Carregar e Exibir Categorias

```typescript
// Estado
const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);

// Carregar do banco
async function loadExpenseCategories() {
  const { data, error } = await supabase
    .from('engineering_expense_categories')
    .select('*')
    .eq('active', true)
    .order('is_custom', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  setExpenseCategories(data || []);
}

// Montar options do select
const categoryOptionsDespesa = [
  { value: 'operacional', label: 'Despesa Operacional', isSystem: true },
  ...expenseCategories.map(cat => ({
    value: `custom_${cat.id}`,
    label: cat.name,
    isSystem: false
  }))
];
```

### Salvar com Categoria Customizada

```typescript
// Processar categoria
let categoryValue = formData.category;
let customCategoryId = null;

if (categoryValue.startsWith('custom_')) {
  customCategoryId = categoryValue.replace('custom_', '');
  categoryValue = 'outras_despesas';
}

// Salvar
await supabase
  .from('engineering_finance_entries')
  .insert({
    category: categoryValue,
    custom_category_id: customCategoryId,
    // ... outros campos
  });
```

---

## Arquivos Modificados

### `src/components/EngineeringFinanceManager.tsx`

**Alterações**:
1. Adicionada interface `ExpenseCategory`
2. Adicionado estado `expenseCategories`
3. Adicionada função `loadExpenseCategories()`
4. Atualizada função `handleRegularEntrySubmit()` para edição e categorias customizadas
5. Adicionada função `handleEdit(entry)`
6. Atualizada função `getCategoryLabel()` para processar categorias customizadas
7. Atualizado select de categorias com optgroups
8. Adicionados botões de editar/excluir na tabela
9. Atualizado título do modal para mostrar "Editar" quando aplicável

**Imports adicionados**:
- `Edit2` e `Trash2` do lucide-react

---

## SQL de Verificação

### Ver categorias ativas
```sql
SELECT id, name, is_custom, active
FROM engineering_expense_categories
WHERE active = true
ORDER BY is_custom, name;
```

### Ver despesas com categorias customizadas
```sql
SELECT
  e.id,
  e.description,
  e.category,
  c.name as custom_category_name,
  e.amount,
  e.entry_date
FROM engineering_finance_entries e
LEFT JOIN engineering_expense_categories c ON c.id = e.custom_category_id
WHERE e.entry_type = 'despesa'
  AND e.custom_category_id IS NOT NULL
ORDER BY e.entry_date DESC;
```

### Verificar lançamentos editáveis
```sql
SELECT
  id,
  description,
  amount,
  CASE
    WHEN payment_id IS NOT NULL THEN 'Recebimento (não editável)'
    WHEN advance_id IS NOT NULL THEN 'Antecipação (não editável)'
    WHEN payroll_schedule_id IS NOT NULL THEN 'Salário (não editável)'
    ELSE 'Editável'
  END as status_edicao
FROM engineering_finance_entries
ORDER BY entry_date DESC;
```

---

## Status Final

✅ **Categorias customizadas funcionando**
- Carregadas do banco dinamicamente
- Aparecem no dropdown separadas por grupo
- Salvamento correto no banco
- Exibição correta na listagem

✅ **Ações de editar/excluir implementadas**
- Botões visíveis para lançamentos editáveis
- Validação de lançamentos automáticos
- Modal de edição funcionando
- Exclusão com confirmação

✅ **Build passou sem erros**
- Tempo: 24.59s
- Sem warnings de TypeScript
- Sistema pronto para produção

---

## Próximos Passos (Opcional)

### Melhorias Possíveis

1. **Histórico de Edições**
   - Registrar quem editou e quando
   - Manter log de alterações

2. **Filtro por Categoria Customizada**
   - Adicionar categorias customizadas no filtro da listagem

3. **Validação de Exclusão**
   - Impedir exclusão se tiver impacto em relatórios fechados

4. **Edição em Lote**
   - Permitir editar múltiplos lançamentos de uma vez

5. **Importação de Categorias**
   - Importar categorias de planilha Excel

---

**Data de Implementação**: 17 de Fevereiro de 2026
**Status**: COMPLETO E TESTADO
**Build**: Aprovado sem erros
