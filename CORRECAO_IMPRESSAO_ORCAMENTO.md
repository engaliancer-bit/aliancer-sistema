# Correção: Impressão de Orçamentos com Itens

## Problema Identificado

Ao clicar no botão de impressão de um orçamento aprovado, o PDF gerado mostrava apenas o valor total, **sem exibir os itens do orçamento**.

### Causa Raiz

O sistema utiliza carregamento sob demanda (lazy loading) para os itens dos orçamentos:

1. **Carregamento Inicial**: Apenas dados básicos dos orçamentos
2. **Carregamento de Detalhes**: Itens são carregados apenas quando o usuário expande o orçamento

Quando o usuário clicava diretamente em **Imprimir** sem expandir o orçamento primeiro, os itens não estavam carregados na memória, resultando em um PDF sem a tabela de itens.

## Solução Implementada

Modificada a função `handlePrint` para **garantir o carregamento dos itens antes de gerar o PDF**.

### Como Funciona

```typescript
// 1. Verifica se os itens já estão carregados
let items = quote.quote_items || [];

// 2. Se não estão carregados ou estão incompletos, busca do banco
if (!items.length || !items[0]?.products) {
  const { data: quoteItems, error } = await supabase
    .from('quote_items')
    .select(`
      *,
      products (name),
      materials (name, unit),
      compositions (name, total_cost)
    `)
    .eq('quote_id', quote.id);

  items = quoteItems || [];
}

// 3. Gera o PDF com os itens carregados
```

## O que Muda para o Usuário

### Antes
```
1. Usuário clica em "Imprimir"
2. PDF é gerado imediatamente
3. ❌ Itens não aparecem no PDF
4. ❌ Apenas valor total é exibido
```

### Depois
```
1. Usuário clica em "Imprimir"
2. Sistema verifica se itens estão carregados
3. Se necessário, carrega itens do banco de dados
4. ✅ PDF é gerado com todos os itens
5. ✅ Tabela completa com detalhes
```

## Estrutura do PDF Gerado

O PDF agora sempre incluirá:

### 1. Cabeçalho
```
┌──────────────────────────────────────┐
│ ORÇAMENTO                            │
│ Sistema de Gestão                    │
│                                      │
│ Nome da Empresa                      │
│ Endereço completo                    │
│ Telefone: (XX) XXXX-XXXX            │
│ Email: contato@empresa.com           │
└──────────────────────────────────────┘
```

### 2. Dados do Cliente
```
┌──────────────────────────────────────┐
│ DADOS DO CLIENTE                     │
│                                      │
│ Cliente: João da Silva               │
│ Tipo: Pessoa Física                  │
│ Data: 03/02/2026                     │
│ Status: Aprovado                     │
│ Prazo de Entrega: 15/02/2026         │
└──────────────────────────────────────┘
```

### 3. Itens do Orçamento (CORRIGIDO)
```
┌─────────────────────────────────────────────────────────────┐
│ ITENS DO ORÇAMENTO                                          │
├──────────────────┬──────┬──────┬──────────┬────────────────┤
│ Item             │ Tipo │ Qtd  │ Valor Un.│ Total          │
├──────────────────┼──────┼──────┼──────────┼────────────────┤
│ Bloco 14x19x39   │ Prod │ 1000 │ R$ 2.50  │ R$ 2,500.00    │
│ Cimento CP II    │ Ins  │ 50   │ R$ 35.00 │ R$ 1,750.00    │
│ Areia Média      │ Ins  │ 2    │ R$ 80.00 │ R$ 160.00      │
│ ...              │      │      │          │                │
├──────────────────┴──────┴──────┴──────────┴────────────────┤
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4. Forma de Pagamento
```
┌──────────────────────────────────────┐
│ FORMA DE PAGAMENTO                   │
│                                      │
│ Método: À Vista                      │
│ Desconto: R$ 200.00                  │
└──────────────────────────────────────┘
```

### 5. Observações
```
┌──────────────────────────────────────┐
│ OBSERVAÇÕES                          │
│                                      │
│ Entregar na obra até dia 15/02.     │
│ Materiais de primeira qualidade.     │
└──────────────────────────────────────┘
```

### 6. Valor Total
```
┌──────────────────────────────────────┐
│ VALOR TOTAL: R$ 4,410.00             │
└──────────────────────────────────────┘
```

## Detalhes Técnicos

### Arquivo Modificado
- `src/components/Quotes.tsx`

### Função Alterada
- `handlePrint` (linha ~1075)

### Query Utilizada
```sql
SELECT *,
  products.name,
  materials.name,
  materials.unit,
  compositions.name,
  compositions.total_cost
FROM quote_items
WHERE quote_id = ?
```

### Dados Carregados para Cada Item

| Campo | Origem | Usado Para |
|-------|--------|------------|
| `item_type` | quote_items | Identificar tipo (produto/insumo/composição) |
| `quantity` | quote_items | Quantidade do item |
| `proposed_price` | quote_items | Valor unitário proposto |
| `products.name` | products | Nome do produto |
| `materials.name` | materials | Nome do insumo |
| `materials.unit` | materials | Unidade de medida |
| `compositions.name` | compositions | Nome da composição |

## Validações Implementadas

1. **Verifica se itens existem**
   ```typescript
   if (!items.length || !items[0]?.products)
   ```

2. **Trata erro de carregamento**
   ```typescript
   if (error) {
     console.error('Erro ao carregar itens:', error);
     alert('Erro ao carregar itens do orçamento');
     return;
   }
   ```

3. **Garante array válido**
   ```typescript
   items = quoteItems || [];
   ```

## Benefícios

### ✅ Performance
- Carrega itens apenas quando necessário
- Não impacta listagem de orçamentos
- Mantém carregamento sob demanda

### ✅ Confiabilidade
- PDF sempre completo
- Não depende de ações prévias do usuário
- Tratamento de erros adequado

### ✅ Experiência do Usuário
- Funciona de primeira
- Mensagem clara em caso de erro
- Processo transparente

## Teste de Validação

1. Acesse **Fábrica > Vendas > Orçamentos**
2. Localize um orçamento com status **Aprovado**
3. **Sem expandir o orçamento**, clique no botão de impressão
4. ✅ PDF será gerado com todos os itens
5. ✅ Tabela completa será exibida
6. ✅ Valores individuais e total aparecem

## Cenários Testados

| Cenário | Status | Resultado |
|---------|--------|-----------|
| Imprimir sem expandir | ✅ OK | Itens aparecem |
| Imprimir após expandir | ✅ OK | Itens aparecem |
| Orçamento com produtos | ✅ OK | Produtos listados |
| Orçamento com insumos | ✅ OK | Insumos listados |
| Orçamento com composições | ✅ OK | Composições listadas |
| Orçamento misto | ✅ OK | Todos tipos aparecem |
| Orçamento sem itens | ✅ OK | Tabela vazia (sem erro) |

## Status

```
✅ Problema identificado
✅ Solução implementada
✅ Testes realizados
✅ Build: 17.37s
✅ Pronto para uso
```

## Impacto

- **Módulo**: Fábrica > Vendas > Orçamentos
- **Funcionalidade**: Impressão/Geração de PDF
- **Usuários afetados**: Todos que imprimem orçamentos
- **Compatibilidade**: 100% retrocompatível
- **Quebras**: Nenhuma

## Próximos Passos

Para melhorias futuras, considerar:

1. Adicionar indicador visual de carregamento durante geração do PDF
2. Permitir personalização do formato da tabela de itens
3. Adicionar opção de incluir/excluir seções no PDF
4. Implementar cache dos itens após primeiro carregamento
