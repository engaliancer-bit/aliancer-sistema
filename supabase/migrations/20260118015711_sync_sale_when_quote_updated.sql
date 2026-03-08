/*
  # Sincronizar Venda quando Orçamento é Atualizado

  1. Problema
    - Quando um orçamento aprovado é editado, a venda não é atualizada
    - O valor total e outras informações ficam desatualizadas

  2. Solução
    - Criar função que atualiza a venda quando o orçamento é modificado
    - Atualizar valor_total, customer_name_snapshot e outros campos relevantes
    - Atualizar também o recebível "sem definição" com o novo valor

  3. Comportamento
    - Só atualiza se a venda já foi criada (sale_created = true)
    - Atualiza apenas se houve mudança nos campos relevantes
    - Mantém rastreabilidade das alterações
*/

-- Função para atualizar venda quando orçamento é modificado
CREATE OR REPLACE FUNCTION public.sync_sale_when_quote_updated()
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

  -- Verificar se houve mudança nos campos relevantes
  v_old_total := COALESCE(OLD.total_value, 0);
  v_new_total := COALESCE(NEW.total_value, 0);

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

-- Criar triggers para sincronização
DROP TRIGGER IF EXISTS trigger_sync_sale_quotes ON public.quotes;
CREATE TRIGGER trigger_sync_sale_quotes
  AFTER UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_sale_when_quote_updated();

DROP TRIGGER IF EXISTS trigger_sync_sale_ribbed ON public.ribbed_slab_quotes;
CREATE TRIGGER trigger_sync_sale_ribbed
  AFTER UPDATE ON public.ribbed_slab_quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_sale_when_quote_updated();

DROP TRIGGER IF EXISTS trigger_sync_sale_engineering ON public.engineering_projects;
CREATE TRIGGER trigger_sync_sale_engineering
  AFTER UPDATE ON public.engineering_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_sale_when_quote_updated();
