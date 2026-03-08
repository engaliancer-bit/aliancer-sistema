/*
  # Adicionar Suporte para Atualização de Pagamentos de Projetos de Engenharia

  1. Problema
    - Pagamentos podem ser editados mas o cash_flow não é atualizado
    - Duplo clique pode criar pagamentos duplicados
    - Não há histórico de alterações

  2. Solução
    - Criar função para atualizar cash_flow quando pagamento é editado
    - Adicionar coluna updated_at com trigger automático
    - Atualizar função integrate_payment_to_cash_flow para tratar UPDATE

  3. Comportamento
    - INSERT: Cria novo registro no cash_flow
    - UPDATE: Atualiza registro correspondente no cash_flow
    - DELETE: Remove registro correspondente do cash_flow
*/

-- =====================================================
-- 1. GARANTIR COLUNA updated_at COM TRIGGER
-- =====================================================

-- Garantir que coluna updated_at existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'engineering_project_payments'
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE engineering_project_payments
    ADD COLUMN updated_at timestamptz DEFAULT now();

    RAISE NOTICE 'Coluna updated_at adicionada';
  END IF;
END $$;

-- Criar ou substituir função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_engineering_payment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS set_updated_at_engineering_payments ON engineering_project_payments;

-- Criar trigger para atualizar updated_at automaticamente
CREATE TRIGGER set_updated_at_engineering_payments
  BEFORE UPDATE ON engineering_project_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_engineering_payment_updated_at();

-- =====================================================
-- 2. ATUALIZAR FUNÇÃO PARA TRATAR UPDATE
-- =====================================================

CREATE OR REPLACE FUNCTION integrate_payment_to_cash_flow()
RETURNS TRIGGER AS $$
DECLARE
  v_project_name text;
  v_customer_name text;
  v_cash_flow_id uuid;
BEGIN
  -- Buscar informações do projeto e cliente
  SELECT
    p.name,
    c.name
  INTO v_project_name, v_customer_name
  FROM engineering_projects p
  LEFT JOIN customers c ON p.customer_id = c.id
  WHERE p.id = COALESCE(NEW.project_id, OLD.project_id);

  IF TG_OP = 'INSERT' THEN
    -- Criar entrada no fluxo de caixa
    INSERT INTO cash_flow (
      date,
      type,
      category,
      description,
      amount,
      conta_caixa_id,
      notes,
      business_unit
    ) VALUES (
      NEW.payment_date,
      'entrada',
      'Serviços de Engenharia',
      'Recebimento - Projeto: ' || COALESCE(v_project_name, 'Sem nome') ||
      ' - Cliente: ' || COALESCE(v_customer_name, 'Não informado'),
      NEW.value,
      NEW.conta_caixa_id,
      'Pagamento de projeto de engenharia' ||
      CASE WHEN NEW.notes IS NOT NULL THEN ' - ' || NEW.notes ELSE '' END,
      'engineering'
    );

    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Buscar ID do cash_flow correspondente
    SELECT id INTO v_cash_flow_id
    FROM cash_flow
    WHERE date = OLD.payment_date
      AND type = 'entrada'
      AND category = 'Serviços de Engenharia'
      AND amount = OLD.value
      AND conta_caixa_id = OLD.conta_caixa_id
      AND business_unit = 'engineering'
      AND created_at >= OLD.created_at - INTERVAL '1 minute'
      AND created_at <= OLD.created_at + INTERVAL '1 minute'
    ORDER BY created_at DESC
    LIMIT 1;

    -- Se encontrou, atualizar
    IF v_cash_flow_id IS NOT NULL THEN
      UPDATE cash_flow
      SET
        date = NEW.payment_date,
        amount = NEW.value,
        conta_caixa_id = NEW.conta_caixa_id,
        description = 'Recebimento - Projeto: ' || COALESCE(v_project_name, 'Sem nome') ||
                      ' - Cliente: ' || COALESCE(v_customer_name, 'Não informado'),
        notes = 'Pagamento de projeto de engenharia' ||
                CASE WHEN NEW.notes IS NOT NULL THEN ' - ' || NEW.notes ELSE '' END
      WHERE id = v_cash_flow_id;
    ELSE
      -- Se não encontrou (caso de dados antigos), criar novo
      INSERT INTO cash_flow (
        date,
        type,
        category,
        description,
        amount,
        conta_caixa_id,
        notes,
        business_unit
      ) VALUES (
        NEW.payment_date,
        'entrada',
        'Serviços de Engenharia',
        'Recebimento - Projeto: ' || COALESCE(v_project_name, 'Sem nome') ||
        ' - Cliente: ' || COALESCE(v_customer_name, 'Não informado'),
        NEW.value,
        NEW.conta_caixa_id,
        'Pagamento de projeto de engenharia' ||
        CASE WHEN NEW.notes IS NOT NULL THEN ' - ' || NEW.notes ELSE '' END,
        'engineering'
      );
    END IF;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- Remover do fluxo de caixa
    DELETE FROM cash_flow
    WHERE date = OLD.payment_date
      AND type = 'entrada'
      AND category = 'Serviços de Engenharia'
      AND amount = OLD.value
      AND conta_caixa_id = OLD.conta_caixa_id
      AND business_unit = 'engineering'
      AND created_at >= OLD.created_at - INTERVAL '1 minute'
      AND created_at <= OLD.created_at + INTERVAL '1 minute';

    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION integrate_payment_to_cash_flow() IS
'Integra pagamentos de projetos de engenharia com o fluxo de caixa. Suporta INSERT, UPDATE e DELETE. Atualiza o cash_flow correspondente quando um pagamento é editado.';

-- =====================================================
-- 3. RECRIAR TRIGGER COM UPDATE HABILITADO
-- =====================================================

-- Remover trigger antigo
DROP TRIGGER IF EXISTS integrate_payment_cash_flow ON engineering_project_payments;

-- Criar novo trigger que trata INSERT, UPDATE e DELETE
CREATE TRIGGER integrate_payment_cash_flow
  AFTER INSERT OR UPDATE OR DELETE ON engineering_project_payments
  FOR EACH ROW
  EXECUTE FUNCTION integrate_payment_to_cash_flow();

-- =====================================================
-- 4. ÍNDICES PARA MELHOR PERFORMANCE
-- =====================================================

-- Índice composto para busca rápida do cash_flow correspondente
CREATE INDEX IF NOT EXISTS idx_cash_flow_engineering_payment_lookup
  ON cash_flow(date, type, category, amount, conta_caixa_id, business_unit)
  WHERE business_unit = 'engineering' AND type = 'entrada';

-- =====================================================
-- 5. MENSAGENS FINAIS
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'Trigger de UPDATE de pagamentos criado com sucesso!';
  RAISE NOTICE 'Agora pagamentos podem ser editados e o cash_flow será atualizado automaticamente';
  RAISE NOTICE 'Coluna updated_at atualiza automaticamente ao editar';
  RAISE NOTICE '==================================================';
END $$;