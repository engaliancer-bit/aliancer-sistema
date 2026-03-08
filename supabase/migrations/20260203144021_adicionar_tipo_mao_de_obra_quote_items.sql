/*
  # Adicionar Tipo "Mão de Obra" aos Itens de Orçamento

  1. Modificações
    - Remove constraint antigo de item_type
    - Adiciona novo constraint permitindo: product, material, composition, mao_de_obra
  
  2. Compatibilidade
    - Totalmente retrocompatível
    - Não afeta dados existentes
    - Apenas adiciona nova opção
  
  3. Casos de Uso
    - Permite incluir mão de obra diretamente nos orçamentos
    - Facilita precificação completa de serviços
    - Exemplo: "Pedreiro", "Eletricista", "Pintor", etc.
*/

-- Remover constraint antigo
ALTER TABLE quote_items 
DROP CONSTRAINT IF EXISTS quote_items_item_type_check;

-- Adicionar novo constraint incluindo 'mao_de_obra'
ALTER TABLE quote_items 
ADD CONSTRAINT quote_items_item_type_check 
CHECK (item_type = ANY (ARRAY['product'::text, 'material'::text, 'composition'::text, 'mao_de_obra'::text]));

-- Comentário explicativo
COMMENT ON COLUMN quote_items.item_type IS 
'Tipo do item no orçamento: product (produto pré-moldado), material (insumo para revenda), composition (composição de materiais), mao_de_obra (serviço de mão de obra)';
