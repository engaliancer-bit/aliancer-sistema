/*
  # Corrigir Trigger de Criação de Venda - Nome do Campo

  1. Problema
    - Trigger estava tentando acessar campo `grand_total` que não existe
    - O campo correto é `total_value`

  2. Solução
    - Atualizar função para usar `total_value` em vez de `grand_total`
*/

CREATE OR REPLACE FUNCTION public.auto_create_sale_from_quote()
RETURNS TRIGGER AS $$
DECLARE
  v_venda_id uuid;
  v_customer_name text;
  v_total_value numeric;
  v_origem_tipo text;
  v_unidade text;
  v_is_approved boolean;
  v_existing_sale_id uuid;
BEGIN
  -- Verificar se foi aprovado (aceita ambos os campos e valores)
  v_is_approved := (
    (NEW.approval_status = 'aprovado') OR 
    (NEW.status = 'approved')
  );

  -- Só processa se foi aprovado
  IF v_is_approved THEN

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

    -- Verificar se já existe venda para este orçamento
    SELECT id INTO v_existing_sale_id
    FROM public.unified_sales
    WHERE origem_tipo = v_origem_tipo
      AND origem_id = NEW.id
    LIMIT 1;

    IF v_existing_sale_id IS NOT NULL THEN
      -- Venda já existe, apenas garantir que flag está marcada
      IF COALESCE(NEW.sale_created, false) = false THEN
        NEW.sale_created := true;
        RAISE NOTICE 'Orçamento % (tipo: %) já possui venda %. Marcando flag sale_created.', 
          NEW.id, v_origem_tipo, v_existing_sale_id;
      END IF;
      RETURN NEW;
    END IF;

    -- Se flag já está marcada mas não há venda, resetar e criar
    IF COALESCE(NEW.sale_created, false) = true THEN
      RAISE WARNING 'Flag sale_created estava marcada mas venda não existe. Criando venda para orçamento % (tipo: %)', 
        NEW.id, v_origem_tipo;
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

    RAISE NOTICE 'Venda % criada com sucesso para orçamento % (tipo: %)', 
      v_venda_id, NEW.id, v_origem_tipo;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Se houver violação de constraint única, apenas marcar flag
    RAISE NOTICE 'Tentativa de criar venda duplicada para orçamento % (tipo: %). Venda já existe.', 
      NEW.id, v_origem_tipo;
    NEW.sale_created := true;
    RETURN NEW;
  WHEN OTHERS THEN
    -- Qualquer outro erro, logar e repassar
    RAISE WARNING 'Erro ao criar venda para orçamento % (tipo: %): %', 
      NEW.id, v_origem_tipo, SQLERRM;
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
