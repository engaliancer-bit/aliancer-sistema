# Cadastro de Cônjuge - Módulo Clientes

## Funcionalidade Implementada

Foi adicionada a possibilidade de cadastrar informações do cônjuge diretamente no cadastro de clientes (Pessoa Física).

## Campos Adicionados

### No Banco de Dados (tabela `customers`)

- **spouse_name** (text, opcional) - Nome completo do cônjuge
- **spouse_cpf** (text, opcional) - CPF do cônjuge
- **marital_status_type** (text, opcional) - Tipo de união:
  - `casamento` - Casamento Civil
  - `uniao_estavel` - União Estável
- **marital_regime** (text, opcional) - Regime de bens:
  - `comunhao_parcial` - Comunhão Parcial de Bens
  - `comunhao_universal` - Comunhão Universal de Bens
  - `separacao_total` - Separação Total de Bens
  - `participacao_final` - Participação Final nos Aquestos

## Como Funciona

### No Formulário de Cadastro

1. A seção "Informações do Cônjuge" aparece **apenas para Pessoa Física**
2. É totalmente **opcional** (pode deixar em branco)
3. Fluxo:
   - Primeiro seleciona o **Estado Civil** (Casado ou União Estável)
   - Ao selecionar, aparecem os campos:
     - Nome do Cônjuge
     - CPF do Cônjuge
     - Regime de Bens

### Na Tabela de Clientes

Foi adicionada uma nova coluna **"Cônjuge"** que mostra:
- Nome do cônjuge (em negrito)
- CPF do cônjuge (texto menor)
- Tipo de união (Casado ou União Estável)
- Regime de bens (texto menor)
- Mostra "-" se não houver cônjuge cadastrado
- Não aparece nada para Pessoa Jurídica

## Vantagens

### Para Documentação
- Facilita preparação de contratos e escrituras
- Informação completa do casal em um único cadastro
- Dados necessários para documentos de compra/venda

### Para Escritório de Engenharia
- Projetos de imóveis rurais geralmente precisam de ambos cônjuges
- Escrituras exigem dados do regime de bens
- Facilita emissão de documentos legais

### Para Construtora/Imóveis
- Contratos de construção podem exigir assinatura de ambos
- Financiamentos exigem dados do cônjuge
- Facilita documentação de propriedades

## Validações

- Campos são opcionais (não obrigatórios)
- Só aparecem para Pessoa Física
- Estado civil deve ser selecionado antes dos demais campos
- Índice criado no CPF do cônjuge para busca rápida

## Auto-Save

A funcionalidade de auto-save (já existente no formulário) funciona automaticamente para os novos campos do cônjuge quando você edita um cliente existente.

## Busca

O campo de busca NÃO inclui informações do cônjuge. Se necessário, pode ser adicionado posteriormente.

## Exemplo de Uso

### Cadastro Pessoa Física Casado:

1. Nome: João da Silva
2. CPF: 123.456.789-00
3. **Estado Civil**: Casado(a)
4. **Nome do Cônjuge**: Maria da Silva
5. **CPF do Cônjuge**: 987.654.321-00
6. **Regime de Bens**: Comunhão Parcial de Bens

### Cadastro Pessoa Física União Estável:

1. Nome: Pedro Santos
2. CPF: 111.222.333-44
3. **Estado Civil**: União Estável
4. **Nome do Cônjuge**: Ana Santos
5. **CPF do Cônjuge**: 555.666.777-88
6. **Regime de Bens**: Separação Total de Bens

## Observações Importantes

1. **Pessoa Jurídica**: Não mostra nenhum campo de cônjuge
2. **Campos opcionais**: Pode cadastrar cliente sem cônjuge
3. **Edição**: Ao editar um cliente, os dados do cônjuge são carregados automaticamente
4. **Exclusão**: Ao excluir um cliente, os dados do cônjuge são excluídos junto

## Regimes de Bens Disponíveis

### Comunhão Parcial de Bens
Regime padrão no Brasil. Comunica-se apenas os bens adquiridos após o casamento.

### Comunhão Universal de Bens
Todos os bens se comunicam, antes e depois do casamento.

### Separação Total de Bens
Não há comunicação de bens. Cada um mantém seu patrimônio separado.

### Participação Final nos Aquestos
Cada cônjuge possui patrimônio próprio, mas participa dos bens adquiridos durante a união.

## Arquivos Alterados

1. **Migration**: `supabase/migrations/add_spouse_information_to_customers.sql`
2. **Component**: `src/components/Customers.tsx`

---

**Data de Implementação**: 2026-01-27
**Status**: Implementado e testado
