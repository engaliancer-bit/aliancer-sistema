/*
  # Corrigir Todas as Referências a Campos Obsoletos

  ## Problema
  Várias funções ainda referenciam campos que foram removidos ou nunca existiram:
  - `project_number` - não existe na tabela engineering_projects
  - `project_name` - foi consolidado para `name`
  - `total_value` - foi consolidado para `grand_total`

  ## Solução
  1. Remover trigger e função que tentam gerar project_number (campo não existe)
  2. Atualizar todas as funções para usar os nomes corretos das colunas
  3. Garantir que não haverá mais erros de campos inexistentes

  ## Alterações
  - Remove trigger de project_number (campo não existe)
  - Atualiza funções para usar `name` em vez de `project_name`
  - Atualiza funções para usar `grand_total` em vez de `total_value`
*/

-- ============================================
-- 1. REMOVER TRIGGER E FUNÇÃO DE PROJECT_NUMBER
-- ============================================

DROP TRIGGER IF EXISTS trigger_set_engineering_project_number ON engineering_projects;
DROP FUNCTION IF EXISTS set_engineering_project_number();
DROP FUNCTION IF EXISTS generate_engineering_project_number();

-- ============================================
-- 2. ATUALIZAR FUNÇÃO integrate_payment_to_cash_flow
-- ============================================

CREATE OR REPLACE FUNCTION integrate_payment_to_cash_flow()
RETURNS TRIGGER AS $$
DECLARE
  v_project_name text;
  v_customer_name text;
  v_category_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Buscar informações do projeto e cliente (usando 'name' em vez de 'project_name')
    SELECT 
      p.name,
      c.name
    INTO v_project_name, v_customer_name
    FROM engineering_projects p
    JOIN customers c ON p.customer_id = c.id
    WHERE p.id = NEW.project_id;

    -- Buscar ou criar categoria "Serviços de Engenharia"
    SELECT id INTO v_category_id
    FROM cost_categories
    WHERE name = 'Serviços de Engenharia'
    LIMIT 1;

    IF v_category_id IS NULL THEN
      INSERT INTO cost_categories (name, type)
      VALUES ('Serviços de Engenharia', 'receita')
      RETURNING id INTO v_category_id;
    END IF;

    -- Criar entrada no fluxo de caixa
    INSERT INTO cash_flow (
      type,
      category_id,
      description,
      value,
      date,
      payment_method,
      reference_id,
      reference_type,
      account_id
    ) VALUES (
      'entrada',
      v_category_id,
      'Recebimento - ' || v_project_name || ' - ' || v_customer_name,
      NEW.value,
      NEW.payment_date,
      NEW.payment_method::text,
      NEW.project_id::text,
      'engineering_project',
      NEW.account_id
    );

    -- Atualizar saldo da conta caixa se especificada
    IF NEW.account_id IS NOT NULL THEN
      UPDATE contas_caixa
      SET saldo_atual = saldo_atual + NEW.value
      WHERE id = NEW.account_id;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    -- Remover do fluxo de caixa
    DELETE FROM cash_flow
    WHERE reference_id = OLD.project_id::text
      AND reference_type = 'engineering_project'
      AND date = OLD.payment_date
      AND value = OLD.value;

    -- Estornar saldo da conta caixa
    IF OLD.account_id IS NOT NULL THEN
      UPDATE contas_caixa
      SET saldo_atual = saldo_atual - OLD.value
      WHERE id = OLD.account_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. ATUALIZAR FUNÇÃO notify_stage_completion
-- ============================================

CREATE OR REPLACE FUNCTION notify_stage_completion()
RETURNS TRIGGER AS $$
DECLARE
  project_name text;
BEGIN
  IF NEW.status = 'concluida' AND OLD.status != 'concluida' THEN
    SELECT ep.name INTO project_name
    FROM engineering_projects ep
    WHERE ep.id = NEW.project_id;

    INSERT INTO engineering_project_alerts (
      project_id,
      stage_id,
      alert_type,
      alert_title,
      alert_message,
      alert_date,
      priority
    ) VALUES (
      NEW.project_id,
      NEW.id,
      'etapa_concluida',
      'Etapa concluída',
      'A etapa "' || NEW.stage_name || '" do projeto "' || project_name || '" foi concluída.',
      CURRENT_DATE,
      'normal'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. ATUALIZAR FUNÇÃO notify_transfer
-- ============================================

CREATE OR REPLACE FUNCTION notify_transfer()
RETURNS TRIGGER AS $$
DECLARE
  project_name text;
  stage_name text;
BEGIN
  SELECT ep.name, ps.stage_name 
  INTO project_name, stage_name
  FROM engineering_projects ep
  JOIN engineering_project_stages ps ON ps.project_id = ep.id
  WHERE ep.id = NEW.project_id AND ps.id = NEW.stage_id;

  INSERT INTO engineering_project_alerts (
    project_id,
    stage_id,
    alert_type,
    alert_title,
    alert_message,
    alert_date,
    priority
  ) VALUES (
    NEW.project_id,
    NEW.stage_id,
    'transferencia_recebida',
    'Etapa transferida',
    'A etapa "' || stage_name || '" do projeto "' || project_name || '" foi transferida para ' || NEW.to_department || 
    COALESCE(' (' || NEW.to_user || ')', ''),
    CURRENT_DATE,
    'alta'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. ATUALIZAR FUNÇÃO notify_document_update
-- ============================================

CREATE OR REPLACE FUNCTION notify_document_update()
RETURNS TRIGGER AS $$
DECLARE
  project_name text;
BEGIN
  SELECT ep.name INTO project_name
  FROM engineering_projects ep
  WHERE ep.id = NEW.project_id;

  INSERT INTO engineering_project_alerts (
    project_id,
    alert_type,
    alert_title,
    alert_message,
    alert_date,
    priority
  ) VALUES (
    NEW.project_id,
    'documento_atualizado',
    'Documento atualizado',
    'O documento "' || NEW.document_type || '" do projeto "' || project_name || '" foi atualizado.',
    CURRENT_DATE,
    'alta'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. ATUALIZAR FUNÇÃO create_cash_flow_for_engineering_payment
-- ============================================

CREATE OR REPLACE FUNCTION create_cash_flow_for_engineering_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_project_name text;
BEGIN
  -- Buscar nome do projeto (usando 'name' em vez de 'project_name')
  SELECT name INTO v_project_name
  FROM engineering_projects
  WHERE id = NEW.project_id;

  -- Inserir no fluxo de caixa
  INSERT INTO cash_flow (
    date,
    type,
    category,
    description,
    value,
    payment_method,
    conta_caixa_id,
    reference_type,
    reference_id
  ) VALUES (
    NEW.payment_date,
    'entrada',
    'Recebimento de Projeto',
    'Pagamento do projeto: ' || COALESCE(v_project_name, 'Sem nome'),
    NEW.value,
    NEW.payment_method,
    NEW.conta_caixa_id,
    'engineering_project_payment',
    NEW.id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. ATUALIZAR FUNÇÃO auto_create_sale_from_quote
-- ============================================

CREATE OR REPLACE FUNCTION auto_create_sale_from_quote()
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

    -- Buscar nome do cliente e valor total (usando grand_total em vez de total_value)
    SELECT c.name, COALESCE(NEW.grand_total, 0)
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

-- ============================================
-- 8. ATUALIZAR FUNÇÃO sync_sale_when_quote_updated
-- ============================================

CREATE OR REPLACE FUNCTION sync_sale_when_quote_updated()
RETURNS TRIGGER AS $$
DECLARE
  v_venda_id uuid;
  v_customer_name text;
  v_origem_tipo text;
  v_old_total numeric;
  v_new_total numeric;
BEGIN
  -- Só processa se a venda já foi criada
  IF COALESCE(NEW.sale_created, false) = false THEN
    RETURN NEW;
  END IF;

  -- Determinar origem baseado na tabela
  IF TG_TABLE_NAME = 'quotes' THEN
    v_origem_tipo := 'fabrica';
  ELSIF TG_TABLE_NAME = 'ribbed_slab_quotes' THEN
    v_origem_tipo := 'laje';
  ELSIF TG_TABLE_NAME = 'engineering_projects' THEN
    v_origem_tipo := 'escritorio';
  END IF;

  -- Buscar a venda vinculada
  SELECT id INTO v_venda_id
  FROM public.unified_sales
  WHERE origem_tipo = v_origem_tipo
    AND origem_id = NEW.id
  LIMIT 1;

  -- Se não encontrou a venda, não faz nada
  IF v_venda_id IS NULL THEN
    RAISE NOTICE 'Venda não encontrada para orçamento % (tipo: %)', NEW.id, v_origem_tipo;
    RETURN NEW;
  END IF;

  -- Verificar se houve mudança nos campos relevantes (usando grand_total em vez de total_value)
  v_old_total := COALESCE(OLD.grand_total, 0);
  v_new_total := COALESCE(NEW.grand_total, 0);

  IF (v_old_total = v_new_total) AND (OLD.customer_id = NEW.customer_id) THEN
    -- Nenhuma mudança relevante
    RETURN NEW;
  END IF;

  -- Buscar nome do cliente atualizado
  SELECT c.name INTO v_customer_name
  FROM public.customers c
  WHERE c.id = NEW.customer_id;

  IF v_customer_name IS NULL THEN
    v_customer_name := 'Cliente não identificado';
  END IF;

  -- Atualizar a venda
  UPDATE public.unified_sales
  SET
    valor_total = v_new_total,
    customer_name_snapshot = v_customer_name,
    customer_id = NEW.customer_id,
    updated_at = now()
  WHERE id = v_venda_id;

  -- Atualizar recebível "sem definição" se existir e se o valor mudou
  IF v_old_total != v_new_total THEN
    UPDATE public.receivables
    SET
      valor_parcela = v_new_total,
      updated_at = now()
    WHERE venda_id = v_venda_id
      AND status = 'sem_definicao'
      AND descricao = 'Pagamento a definir';

    RAISE NOTICE 'Venda % atualizada. Valor anterior: %, Novo valor: %',
      v_venda_id, v_old_total, v_new_total;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erro ao sincronizar venda para orçamento % (tipo: %): %',
      NEW.id, v_origem_tipo, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;