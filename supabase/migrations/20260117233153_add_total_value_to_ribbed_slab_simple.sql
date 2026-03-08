/*
  # Adicionar Valor Total aos Orçamentos de Laje Treliçada

  1. Problema
    - Trigger auto_create_sale_from_quote espera campo total_value
    - ribbed_slab_quotes não tem esse campo
    - Impede criação automática de vendas ao aprovar lajes

  2. Solução
    - Adicionar campo total_value em ribbed_slab_quotes
    - Frontend será responsável por calcular e salvar o valor
    - Valor será usado pelo trigger para criar venda automaticamente
*/

-- Adicionar campo total_value
ALTER TABLE public.ribbed_slab_quotes
ADD COLUMN IF NOT EXISTS total_value numeric DEFAULT 0 NOT NULL;

-- Criar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_ribbed_slab_quotes_total_value 
ON public.ribbed_slab_quotes(total_value);

-- Comentário explicativo
COMMENT ON COLUMN public.ribbed_slab_quotes.total_value IS 
'Valor total do orçamento calculado pelo frontend (inclui materiais, blocos, mão de obra, etc)';
