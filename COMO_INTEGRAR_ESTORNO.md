# Como Integrar o Estorno de Produtos no UnifiedSales

O componente `ProductReturnManager` foi criado para gerenciar o estorno de produtos vendidos. Para integrá-lo no UnifiedSales, siga as instruções abaixo:

## 1. Importar o componente

No arquivo `src/components/UnifiedSales.tsx`, adicione a importação no início do arquivo:

```typescript
import ProductReturnManager from './ProductReturnManager';
```

## 2. Adicionar o botão no modal de detalhes da venda

Localize a seção onde são exibidos os detalhes de uma venda (provavelmente dentro de um modal que mostra informações da venda). Adicione o componente ProductReturnManager:

```typescript
<ProductReturnManager
  saleId={selectedReceivable?.venda_id || ''}
  saleOriginType={selectedReceivable?.unified_sales?.origem_tipo || ''}
  saleOriginId={selectedReceivable?.unified_sales?.origem_id || ''}
  customerId={selectedReceivable?.unified_sales?.customer_id || null}
  onReturnComplete={() => {
    // Recarregar dados após o estorno
    loadReceivables();
    // Fechar modal se necessário
    // setShowDetailsModal(false);
  }}
/>
```

## 3. Exemplo de posicionamento

O botão deve aparecer junto com outros botões de ação da venda. Um bom lugar seria próximo aos botões de "Ver Orçamento", "Imprimir", etc.

```typescript
<div className="flex gap-2">
  {/* Outros botões aqui */}

  <ProductReturnManager
    saleId={selectedReceivable?.venda_id || ''}
    saleOriginType={selectedReceivable?.unified_sales?.origem_tipo || ''}
    saleOriginId={selectedReceivable?.unified_sales?.origem_id || ''}
    customerId={selectedReceivable?.unified_sales?.customer_id || null}
    onReturnComplete={loadReceivables}
  />
</div>
```

## Funcionalidades Implementadas

### 1. Ajuste de Estoque (Inventory)
- **Coluna de Ações** com botão de ajuste de estoque (ícone de engrenagem)
- **Modal de Ajuste** permite adicionar ou remover produtos do estoque
- **Suporta** produtos de produção e materiais de revenda
- **Registra** motivo do ajuste nas observações

### 2. Valores Monetários no Estoque
- **Coluna de Preço Unitário** mostra o preço de venda de cada produto
- **Coluna de Valor Total** calcula automaticamente (quantidade × preço)
- **Card de Resumo** exibe valor total de todo o estoque
- **Relatório em PDF** inclui valores monetários com totais por categoria

### 3. Estorno de Produtos (ProductReturnManager)
- **Seleção de Itens** permite escolher quais produtos devolver
- **Quantidade Flexível** define quanto de cada item será estornado
- **Duas Opções de Estorno:**
  - **Apenas Produto**: Devolve ao estoque sem mexer no financeiro
  - **Produto + Valor**: Devolve ao estoque E cria crédito para o cliente
- **Observações** para documentar o motivo do estorno
- **Atualização Automática** dos registros de estoque e financeiro

## Fluxo de Uso do Estorno

1. **Usuário** acessa os detalhes de uma venda no UnifiedSales
2. **Clica** no botão "Estornar Produtos"
3. **Visualiza** todos os produtos entregues na venda
4. **Define** quantidade a estornar para cada item
5. **Escolhe** se quer estornar o valor também
6. **Adiciona** observações sobre o motivo
7. **Confirma** o estorno
8. **Sistema:**
   - Reduz `delivered_quantity` dos itens do orçamento
   - Adiciona produtos de volta ao estoque
   - Cria recebível negativo se solicitado
   - Registra tudo com as observações

## Observações Técnicas

- O estorno só funciona para vendas do tipo 'quote' (orçamentos)
- Os produtos são devolvidos ao estoque livre (não vinculados a OP)
- Materiais são devolvidos via `material_movements` com tipo 'entrada'
- Produtos são devolvidos via tabela `production` com `production_type: 'estoque'`
- Créditos ao cliente são criados como recebíveis com `valor_parcela` negativo e `parcela_numero: 999`

## Próximos Passos

Caso queira adicionar suporte a outros tipos de venda (lajes nervuradas, projetos de engenharia), será necessário:
1. Adaptar a query de `loadQuoteItems()` para buscar itens desses outros tipos
2. Ajustar a lógica de estorno para suportar as tabelas correspondentes
