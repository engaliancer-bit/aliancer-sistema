/*
  # Adicionar Foreign Key entre receivables e contas_caixa

  1. Problema
    - Frontend tenta fazer JOIN entre receivables e contas_caixa
    - Mas não existe foreign key configurada
    - Causa erro: "Could not find a relationship between 'receivables' and 'contas_caixa'"

  2. Solução
    - Adicionar foreign key de receivables.conta_caixa_id para contas_caixa.id
    - Permitir NULL (nem todos recebíveis têm conta definida)
*/

-- Adicionar foreign key de receivables para contas_caixa
ALTER TABLE public.receivables
ADD CONSTRAINT receivables_conta_caixa_id_fkey 
FOREIGN KEY (conta_caixa_id) 
REFERENCES public.contas_caixa(id)
ON DELETE SET NULL;

-- Criar índice para melhorar performance das consultas
CREATE INDEX IF NOT EXISTS idx_receivables_conta_caixa_id 
ON public.receivables(conta_caixa_id);
