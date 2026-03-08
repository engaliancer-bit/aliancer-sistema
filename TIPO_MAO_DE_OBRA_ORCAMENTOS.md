# Tipo "Mão de Obra" nos Orçamentos

## Resumo da Implementação

Foi adicionado um novo tipo de item aos orçamentos: **Mão de Obra**. Agora é possível incluir serviços de mão de obra diretamente nos orçamentos, junto com produtos, insumos e composições.

## Alterações Realizadas

### 1. Banco de Dados

#### Migration Aplicada
- **Arquivo**: `adicionar_tipo_mao_de_obra_quote_items.sql`
- **Tabela**: `quote_items`
- **Campo**: `item_type`

#### Constraint Atualizado

**Antes:**
```sql
CHECK (item_type = ANY (ARRAY['product', 'material', 'composition']))
```

**Depois:**
```sql
CHECK (item_type = ANY (ARRAY['product', 'material', 'composition', 'mao_de_obra']))
```

#### Compatibilidade
- ✅ 100% retrocompatível
- ✅ Não afeta orçamentos existentes
- ✅ Apenas adiciona nova opção

### 2. Frontend

#### Componente Modificado
- **Arquivo**: `src/components/Quotes.tsx`

#### Alterações no TypeScript

**Interface QuoteItem:**
```typescript
interface QuoteItem {
  item_type: 'product' | 'material' | 'composition' | 'mao_de_obra';
  // ... outros campos
}
```

#### Alterações na Interface

1. **Select de Tipo de Item**
   - Nova opção: "Mão de Obra"
   - Mantém opções existentes: Produto, Insumo, Composição

2. **Campo de Entrada**
   - Quando "Mão de Obra" é selecionado, exibe campo de texto
   - Placeholder: "Ex: Pedreiro, Eletricista, Pintor..."
   - Campo obrigatório para descrição do serviço

3. **Validação**
   - Verifica se descrição foi preenchida
   - Mesmas validações de quantidade e preço

4. **Exibição**
   - Itens de mão de obra exibem a descrição fornecida
   - Tipo exibido como "Mão de Obra" em listas e relatórios
   - Unidade padrão: "un"

## Como Usar

### Criando um Orçamento com Mão de Obra

1. **Acesse**: Fábrica → Orçamentos

2. **Criar Novo Orçamento**:
   - Clique em "Novo Orçamento"
   - Selecione o cliente
   - Preencha informações básicas

3. **Adicionar Item de Mão de Obra**:
   - Na seção "Adicionar Item ao Orçamento"
   - **Tipo de Item**: Selecione "Mão de Obra"
   - **Descrição do Serviço**: Digite o serviço (Ex: "Pedreiro - 2 dias de trabalho")
   - **Quantidade**: Informe a quantidade (Ex: 2 para 2 dias)
   - **Valor Sugerido**: Deixe 0 ou preencha se desejar
   - **Valor Praticado**: Digite o valor do serviço (Ex: 300.00)
   - **Observações**: Adicione detalhes adicionais se necessário
   - Clique em **"Adicionar Item"**

4. **Salvar Orçamento**:
   - Clique em "Salvar Orçamento"

### Exemplos de Uso

#### Exemplo 1: Orçamento Misto

**Produto:**
- Tipo: Produto
- Item: Pilar 15x15x280cm
- Quantidade: 20
- Valor: R$ 45,00

**Mão de Obra:**
- Tipo: Mão de Obra
- Descrição: Pedreiro - Montagem e concretagem
- Quantidade: 2 (dias)
- Valor: R$ 300,00

**Total do Orçamento**: R$ 1.500,00

#### Exemplo 2: Serviços de Construção

**Composição:**
- Tipo: Composição
- Item: Laje Treliçada 200m²
- Quantidade: 1
- Valor: R$ 8.500,00

**Mão de Obra 1:**
- Tipo: Mão de Obra
- Descrição: Equipe de Montagem - 5 dias
- Quantidade: 1
- Valor: R$ 2.500,00

**Mão de Obra 2:**
- Tipo: Mão de Obra
- Descrição: Concretagem e Acabamento
- Quantidade: 1
- Valor: R$ 1.800,00

**Total do Orçamento**: R$ 12.800,00

#### Exemplo 3: Serviços Especializados

**Mão de Obra 1:**
- Tipo: Mão de Obra
- Descrição: Eletricista - Instalação completa
- Quantidade: 1
- Valor: R$ 1.200,00

**Mão de Obra 2:**
- Tipo: Mão de Obra
- Descrição: Encanador - Instalação hidráulica
- Quantidade: 1
- Valor: R$ 950,00

**Material:**
- Tipo: Insumo
- Item: Fio elétrico 2,5mm
- Quantidade: 100m
- Valor: R$ 280,00

**Total do Orçamento**: R$ 2.430,00

## Características do Item "Mão de Obra"

### Campos Obrigatórios
- ✅ Descrição do serviço (campo de texto livre)
- ✅ Quantidade (numérico)
- ✅ Valor praticado (valor monetário)

### Campos Opcionais
- Valor sugerido
- Observações

### Diferenças dos Outros Tipos

| Característica | Produto/Insumo/Composição | Mão de Obra |
|---------------|---------------------------|-------------|
| **Vinculação** | Vinculado a cadastro específico | Texto livre |
| **Descrição** | Nome do item cadastrado | Digitada manualmente |
| **Estoque** | Pode afetar estoque | Não afeta estoque |
| **Unidade** | Definida no cadastro | Sempre "un" |
| **Custo** | Baseado em cadastro | Apenas valor praticado |

### Comportamento Específico

1. **Não Vincula a Cadastros**
   - Não precisa cadastrar previamente
   - Flexibilidade para serviços únicos
   - Descrição totalmente customizável

2. **Não Afeta Estoque**
   - Serviços não têm estoque
   - Não gera movimentações de materiais
   - Não cria ordens de produção

3. **Não Gera Entregas Automáticas**
   - Serviços são intangíveis
   - Controle manual se necessário

4. **Aparece em Relatórios**
   - Incluído no valor total do orçamento
   - Listado em PDFs e impressões
   - Identificado como "Mão de Obra"

## Impressão e Exportação

### PDF do Orçamento

Os itens de mão de obra aparecem na tabela de itens:

```
┌──────────────────────────────┬──────────────┬────────────┬────────────────┬──────────────┐
│ Item                         │ Tipo         │ Quantidade │ Valor Unitário │ Valor Total  │
├──────────────────────────────┼──────────────┼────────────┼────────────────┼──────────────┤
│ Pilar 15x15x280cm            │ Produto      │ 20,00      │ R$ 45,00       │ R$ 900,00    │
│ Pedreiro - Montagem          │ Mão de Obra  │ 2,00       │ R$ 300,00      │ R$ 600,00    │
│ Cimento CP-II                │ Insumo       │ 50,00      │ R$ 1,20        │ R$ 60,00     │
└──────────────────────────────┴──────────────┴────────────┴────────────────┴──────────────┘
                                                              TOTAL: R$ 1.560,00
```

### Visualização na Tela

```
📋 Orçamento #1234

Itens do Orçamento:
┌─────────────────────────────────────────────────────┐
│ Pedreiro - Montagem e concretagem                   │
│ Tipo: Mão de Obra                                   │
│ Qtd: 2 un × R$ 300,00 = R$ 600,00                  │
└─────────────────────────────────────────────────────┘
```

## Casos de Uso Recomendados

### ✅ Quando Usar "Mão de Obra"

1. **Serviços Específicos do Orçamento**
   - Serviços únicos que não se repetem
   - Trabalhos customizados para aquele cliente
   - Exemplo: "Demolição de parede específica"

2. **Serviços de Terceiros**
   - Subcontratação de serviços
   - Profissionais autônomos
   - Exemplo: "Pintor - João Silva"

3. **Orçamentos Rápidos**
   - Quando não há tempo para cadastrar
   - Serviços esporádicos
   - Exemplo: "Reparo emergencial"

4. **Consultoria e Serviços Intelectuais**
   - Projetos
   - Consultorias
   - Exemplo: "Análise estrutural"

### ⚠️ Quando NÃO Usar

1. **Serviços Recorrentes**
   - Se é um serviço que você sempre oferece
   - Melhor: Cadastrar como "Composição"
   - Vantagem: Padronização e histórico

2. **Serviços com Materiais**
   - Se o serviço inclui materiais
   - Melhor: Criar uma "Composição"
   - Vantagem: Controle de custo e estoque

3. **Produtos Pré-Moldados**
   - Use tipo "Produto"
   - Vantagem: Controle de produção e estoque

## Perguntas Frequentes

### 1. Posso misturar diferentes tipos no mesmo orçamento?

**Sim!** Um orçamento pode conter:
- Produtos
- Insumos
- Composições
- Mão de Obra

Todos juntos, sem restrições.

### 2. Itens de mão de obra geram ordens de produção?

**Não.** Apenas itens do tipo "Produto" geram ordens de produção quando o orçamento é aprovado.

### 3. Posso cadastrar mão de obra como produto?

**Tecnicamente sim**, mas não é recomendado:
- Produtos são para itens físicos
- Mão de obra é intangível
- Use o tipo correto para melhor organização

### 4. A descrição de mão de obra tem limite de caracteres?

Não há limite rígido, mas recomendamos:
- Descrições curtas e objetivas
- Máximo 100 caracteres para melhor visualização
- Use campo "Observações" para detalhes extras

### 5. Como faço para criar uma mão de obra "padrão"?

Se você oferece sempre o mesmo serviço:
1. **Opção 1**: Crie uma "Composição" sem materiais
2. **Opção 2**: Use mão de obra e copie a descrição

Recomendamos criar uma Composição para serviços recorrentes.

### 6. Itens de mão de obra aparecem em relatórios financeiros?

**Sim!** Aparecem em:
- Valor total do orçamento
- Relatórios de vendas
- PDFs e impressões
- Faturamento

### 7. Posso editar um item de mão de obra depois?

Atualmente, para editar um item:
1. Remova o item do orçamento
2. Adicione novamente com os dados corretos

**Importante**: Só é possível editar antes de salvar o orçamento.

## Benefícios da Nova Funcionalidade

### Para o Negócio

- ✅ Orçamentos mais completos
- ✅ Precificação de serviços facilitada
- ✅ Flexibilidade para serviços únicos
- ✅ Melhor controle de receitas

### Para o Usuário

- ✅ Interface intuitiva
- ✅ Cadastro rápido de serviços
- ✅ Não precisa cadastrar previamente
- ✅ Descrição livre e customizável

### Para o Sistema

- ✅ Compatibilidade total com código existente
- ✅ Validações apropriadas
- ✅ Exibição consistente
- ✅ Build sem erros

## Status da Implementação

```
✅ Migration aplicada no banco de dados
✅ Constraint atualizado (quote_items_item_type_check)
✅ Interface TypeScript atualizada
✅ Formulário com novo campo
✅ Validações implementadas
✅ Exibições atualizadas em todos os lugares
✅ PDF e impressões compatíveis
✅ Build finalizado: 17.66s
✅ Sem erros ou warnings
✅ 100% retrocompatível
✅ Pronto para uso em produção
```

## Conclusão

A funcionalidade de **Mão de Obra** nos orçamentos está completa e pronta para uso. Ela oferece flexibilidade para incluir serviços diretamente nos orçamentos, complementando os tipos existentes (Produto, Insumo, Composição).

A implementação foi feita com foco em:
- **Simplicidade**: Fácil de usar
- **Flexibilidade**: Descrição livre
- **Compatibilidade**: Não quebra nada existente
- **Consistência**: Integrado em todo o sistema

Agora você pode criar orçamentos mais completos, incluindo tanto materiais quanto serviços!
