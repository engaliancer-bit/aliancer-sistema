# Simplificação do Formulário de Produtos - Ferragens Diversas

## Alterações Realizadas

### 1. Seções Removidas para Produtos "Ferragens Diversas"

Foram removidas as seguintes seções redundantes do formulário de cadastro de produtos do tipo "Ferragens Diversas":

#### A) Campos Individuais de Custos (REMOVIDOS)
**Localização:** Após a seção de "Insumos e Materiais"

Campos removidos:
- Mão de Obra (R$)
- Custos Fixos (R$)
- Custo de Transporte (R$)
- Estoque Mínimo (este campo foi duplicado, mantido apenas na seção de precificação)

**Motivo:** Esses campos eram redundantes com a seção de precificação que já permite informar todos esses custos de forma mais completa e organizada.

#### B) Seção "Materiais Auxiliares (Acessórios)" (REMOVIDA)
**Localização:** Após a seção de armaduras dos produtos pré-moldados

**Motivo:** Esta seção era duplicada, pois para produtos "Ferragens Diversas" já existe a seção "Insumos e Materiais" que permite adicionar todos os materiais e produtos necessários.

### 2. Estrutura Final do Formulário para "Ferragens Diversas"

Agora o formulário possui apenas 2 seções principais:

#### 1. Insumos e Materiais
- Permite adicionar materiais ou produtos
- Campos disponíveis:
  - Tipo de Material (texto livre)
  - Tipo de Item (Material/Produto)
  - Seleção do Material/Produto
  - Quantidade
  - Descrição
- Botões de Ação:
  - Adicionar/Atualizar Insumo
  - Editar insumo (ícone de lápis)
  - Excluir insumo (ícone de lixeira)

#### 2. Precificação do Produto
Contém todos os campos necessários para definição de custos e preço:
- **Composição do Custo:**
  - Custo de Material (R$)
  - Custo de Mão de Obra (%)
  - Custos Fixos (%)
  - Custo de Transporte (R$)
  - Perdas (%)
  - Custo de Produção Total (calculado automaticamente)

- **Definir Preço de Venda:**
  - Margem de Lucro (%)
  - Preço de Venda sem impostos (calculado)
  - Impostos (%)

- **Preço Final de Venda** (destaque em verde com cálculo final)

### 3. Funcionalidade de Cópia de Produtos Aprimorada

#### Antes
- Ao clonar um produto "Ferragens Diversas", os insumos/materiais não eram copiados
- Apenas produtos "Pré-Moldados" tinham seus acessórios clonados

#### Depois
- Ao clonar um produto "Ferragens Diversas", todos os insumos/materiais são copiados automaticamente
- Os insumos copiados podem ser editados ou excluídos individualmente
- Botões de edição e exclusão disponíveis para cada insumo na lista

**Implementação:**
```typescript
// Agora clona acessórios tanto para premolded quanto ferragens_diversas
if (product.product_type === 'premolded' || product.product_type === 'ferragens_diversas') {
  const { data: accessoriesData } = await supabase
    .from('product_accessories')
    .select(`
      *,
      materials (name)
    `)
    .eq('product_id', product.id);
  // ... processamento e carregamento dos acessórios
}
```

## Benefícios das Alterações

1. **Interface Mais Limpa:** Formulário mais enxuto e focado, sem campos duplicados
2. **Menor Confusão:** Usuário não precisa preencher informações em múltiplos lugares
3. **Facilidade de Cadastro:** Com a função de cópia, criar produtos similares ficou muito mais rápido
4. **Edição Flexível:** Após copiar, todos os insumos podem ser facilmente editados ou removidos
5. **Consistência:** Todos os custos são definidos em um único local (Precificação)

## Workflow Recomendado

### Para Cadastrar um Novo Produto "Ferragens Diversas":

1. Preencher informações básicas (Nome, Código, Unidade, etc.)
2. Na seção **"Insumos e Materiais"**:
   - Adicionar todos os materiais/produtos necessários
   - Definir quantidades
   - Adicionar descrições se necessário
3. Na seção **"Precificação do Produto"**:
   - Informar ou revisar o custo de material (calculado automaticamente a partir dos insumos)
   - Definir percentuais de mão de obra, custos fixos, perdas
   - Informar custo de transporte se aplicável
   - Definir margem de lucro
   - Definir percentual de impostos
4. Salvar o produto

### Para Criar um Produto Similar:

1. Localizar o produto existente na lista
2. Clicar no ícone de **cópia** (ícone verde)
3. O sistema irá:
   - Criar uma cópia com o nome "Nome Original - Cópia"
   - Gerar um novo código automaticamente
   - Copiar TODOS os insumos/materiais
   - Copiar todos os valores de precificação
4. Editar as informações necessárias:
   - Alterar o nome
   - Adicionar, editar ou remover insumos conforme necessário
   - Ajustar quantidades e custos
5. Salvar o novo produto

## Arquivos Modificados

- `src/components/Products.tsx`
  - Linhas 2671-2728: Seção de custos individuais removida
  - Linhas 3075-3217: Seção de materiais auxiliares removida
  - Linhas 1230-1268: Clonagem de acessórios estendida para ferragens_diversas

## Testes Recomendados

- [ ] Cadastrar novo produto "Ferragens Diversas"
- [ ] Adicionar múltiplos insumos (materiais e produtos)
- [ ] Verificar cálculo automático de custos
- [ ] Testar precificação completa
- [ ] Clonar o produto criado
- [ ] Editar insumos do produto clonado
- [ ] Excluir alguns insumos do produto clonado
- [ ] Salvar e verificar se tudo foi persistido corretamente
