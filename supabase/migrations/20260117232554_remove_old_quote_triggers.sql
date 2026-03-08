/*
  # Remover Triggers Antigos de Orçamentos

  1. Problema
    - Trigger antigo `on_quote_approved` tenta criar venda na tabela `sales` (antiga)
    - Conflita com novo trigger `trigger_auto_create_sale_quotes` 
    - Causa erro: "trigger functions can only be called as triggers"

  2. Solução
    - Remover trigger antigo e sua função
    - Manter apenas o novo sistema unificado
*/

-- Remover trigger antigo de quotes
DROP TRIGGER IF EXISTS on_quote_approved ON public.quotes;

-- Remover função antiga (se não for usada em outro lugar)
DROP FUNCTION IF EXISTS create_sale_from_quote() CASCADE;

-- Verificar e remover triggers antigos de outras tabelas também
DROP TRIGGER IF EXISTS on_ribbed_slab_quote_approved ON public.ribbed_slab_quotes;
DROP TRIGGER IF EXISTS on_engineering_project_approved ON public.engineering_projects;
