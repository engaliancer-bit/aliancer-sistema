/*
  # Corrigir Trigger de Criação de Venda - Campo de Status

  1. Problema Identificado
    - Trigger verifica `approval_status = 'aprovado'` (português)
    - Interface usa campo `status` com valores em inglês: 'approved', 'pending', 'rejected'
    - Resultado: vendas não são criadas automaticamente

  2. Solução
    - Atualizar trigger para aceitar ambos os campos e valores
    - Verificar: status = 'approved' OU approval_status = 'aprovado'
*/

-- Recriar função do trigger com verificação dupla
CREATE OR REPLACE FUNCTION public.auto_create_sale_from_quote()
RETURNS TRIGGER AS $$
DECLARE
  v_venda_id uuid;
  v_customer_name text;
  v_total_value numeric;
  v_origem_tipo text;
  v_unidade text;
  v_is_approved boolean;
BEGIN
  -- Verificar se foi aprovado (aceita ambos os campos e valores)
  v_is_approved := (
    (NEW.approval_status = 'aprovado') OR 
    (NEW.status = 'approved')
  );

  -- Só processa se foi aprovado e ainda não criou venda
  IF v_is_approved AND COALESCE(NEW.sale_created, false) = false THEN

    -- Determinar origem e unidade baseado na tabela
    IF TG_TABLE_NAME = 'quotes' THEN
      v_origem_tipo := 'fabrica';
      v_unidade := 'Fábrica';
    ELSIF TG_TABLE_NAME = 'ribbed_slab_quotes' THEN
      v_origem_tipo := 'laje';
      v_unidade := 'Fábrica - Laje';
    ELSIF TG_TABLE_NAME = 'engineering_projects' THEN
      v_origem_tipo := 'escritorio';
      v_unidade := 'Escritório de Engenharia';
    END IF;

    -- Buscar nome do cliente e valor total
    SELECT c.name, COALESCE(NEW.total_value, 0)
    INTO v_customer_name, v_total_value
    FROM public.customers c
    WHERE c.id = NEW.customer_id;

    -- Se não encontrou cliente, usar placeholder
    IF v_customer_name IS NULL THEN
      v_customer_name := 'Cliente não identificado';
    END IF;

    -- Criar venda
    INSERT INTO public.unified_sales (
      origem_tipo,
      origem_id,
      customer_id,
      customer_name_snapshot,
      data_venda,
      valor_total,
      responsavel_nome,
      unidade_negocio,
      observacoes,
      created_by
    ) VALUES (
      v_origem_tipo,
      NEW.id,
      NEW.customer_id,
      v_customer_name,
      CURRENT_DATE,
      v_total_value,
      COALESCE(NEW.approved_by, 'Sistema'),
      v_unidade,
      'Venda criada automaticamente a partir de orçamento aprovado',
      COALESCE(NEW.approved_by, 'Sistema')
    )
    RETURNING id INTO v_venda_id;

    -- Criar recebível inicial "sem definição" com valor total
    INSERT INTO public.receivables (
      venda_id,
      parcela_numero,
      descricao,
      valor_parcela,
      status,
      unidade_negocio,
      observacoes
    ) VALUES (
      v_venda_id,
      1,
      'Pagamento a definir',
      v_total_value,
      'sem_definicao',
      v_unidade,
      'Condição de pagamento a ser definida'
    );

    -- Marcar que venda foi criada no orçamento
    NEW.sale_created := true;

    RAISE NOTICE 'Venda % criada automaticamente para orçamento % (tipo: %)', 
      v_venda_id, NEW.id, v_origem_tipo;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar os triggers para todas as tabelas
DROP TRIGGER IF EXISTS trigger_auto_create_sale_quotes ON public.quotes;
CREATE TRIGGER trigger_auto_create_sale_quotes
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_sale_from_quote();

DROP TRIGGER IF EXISTS trigger_auto_create_sale_ribbed ON public.ribbed_slab_quotes;
CREATE TRIGGER trigger_auto_create_sale_ribbed
  BEFORE UPDATE ON public.ribbed_slab_quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_sale_from_quote();

DROP TRIGGER IF EXISTS trigger_auto_create_sale_engineering ON public.engineering_projects;
CREATE TRIGGER trigger_auto_create_sale_engineering
  BEFORE UPDATE ON public.engineering_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_sale_from_quote();
