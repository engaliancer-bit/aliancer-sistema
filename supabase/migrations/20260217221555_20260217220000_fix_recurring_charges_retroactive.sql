/*
  # Correção: Geração Retroativa de Cobranças Recorrentes

  ## Problema
  - Projetos de consultoria com cobrança recorrente iniciados em 01/01/2026
  - Sistema só gerava cobrança para o mês atual
  - Meses anteriores (janeiro e fevereiro) não eram cobrados automaticamente

  ## Solução
  - Nova função para gerar cobranças retroativas
  - Processa todos os meses desde recurring_start_date até hoje
  - Respeita recurring_end_date se definida
  - Não cria duplicatas

  ## Campos Necessários em engineering_projects
  - recurring_start_date (date) - Data de início da cobrança recorrente
  - recurring_end_date (date, nullable) - Data de término da cobrança recorrente

  ## Segurança
  - Não afeta dados existentes
  - Cria apenas cobranças faltantes
  - RLS mantido
*/

-- Adicionar campos de período de cobrança recorrente aos projetos
ALTER TABLE engineering_projects
ADD COLUMN IF NOT EXISTS recurring_start_date date,
ADD COLUMN IF NOT EXISTS recurring_end_date date,
ADD COLUMN IF NOT EXISTS recurring_description text;

-- Comentários explicativos
COMMENT ON COLUMN engineering_projects.recurring_start_date IS 'Data de início da cobrança recorrente mensal';
COMMENT ON COLUMN engineering_projects.recurring_end_date IS 'Data de término da cobrança recorrente mensal (null = sem fim)';
COMMENT ON COLUMN engineering_projects.recurring_description IS 'Descrição customizada para cobranças recorrentes deste projeto';

-- Função para gerar cobranças retroativas de um projeto
CREATE OR REPLACE FUNCTION generate_retroactive_recurring_charges(
  p_project_id uuid
)
RETURNS TABLE(
  charge_id uuid,
  charge_month date,
  due_date date,
  amount decimal,
  created boolean
) AS $$
DECLARE
  v_project RECORD;
  v_template RECORD;
  v_current_month date;
  v_month_date date;
  v_due_date date;
  v_charge_id uuid;
  v_charge_exists boolean;
  v_end_date date;
BEGIN
  -- Buscar informações do projeto e template
  SELECT
    ep.*,
    est.fees,
    est.recurring_due_day,
    est.recurring_description as template_description,
    est.is_recurring_monthly
  INTO v_project
  FROM engineering_projects ep
  INNER JOIN engineering_service_templates est ON ep.template_id = est.id
  WHERE ep.id = p_project_id
    AND est.is_recurring_monthly = true;

  -- Se não encontrou ou não é recorrente, sair
  IF NOT FOUND THEN
    RAISE NOTICE 'Projeto % não encontrado ou não é recorrente', p_project_id;
    RETURN;
  END IF;

  -- Se não tem data de início, usar data de criação do projeto
  IF v_project.recurring_start_date IS NULL THEN
    v_project.recurring_start_date := date_trunc('month', v_project.start_date)::date;
  END IF;

  -- Definir data final (hoje ou recurring_end_date)
  v_end_date := COALESCE(v_project.recurring_end_date, CURRENT_DATE);
  v_current_month := date_trunc('month', CURRENT_DATE)::date;

  -- Se o projeto já foi finalizado ou registrado, usar a data de conclusão
  IF v_project.status IN ('finalizado', 'registrado') THEN
    v_end_date := LEAST(
      v_end_date,
      COALESCE(v_project.actual_completion_date, v_project.estimated_completion_date, CURRENT_DATE)
    );
  END IF;

  -- Iterar por cada mês desde o início até o fim
  v_month_date := date_trunc('month', v_project.recurring_start_date)::date;

  WHILE v_month_date <= date_trunc('month', v_end_date)::date LOOP
    -- Verificar se já existe cobrança para este mês
    SELECT EXISTS(
      SELECT 1
      FROM engineering_recurring_charges
      WHERE project_id = p_project_id
        AND date_trunc('month', charge_date) = v_month_date
    ) INTO v_charge_exists;

    IF NOT v_charge_exists THEN
      -- Calcular data de vencimento (dia definido no template)
      v_due_date := make_date(
        extract(year from v_month_date)::int,
        extract(month from v_month_date)::int,
        LEAST(
          v_project.recurring_due_day,
          extract(day from (v_month_date + interval '1 month' - interval '1 day'))::int
        )
      );

      -- Criar cobrança
      INSERT INTO engineering_recurring_charges (
        project_id,
        charge_date,
        due_date,
        amount,
        description,
        status,
        generated_automatically
      ) VALUES (
        p_project_id,
        v_month_date,
        v_due_date,
        v_project.fees,
        COALESCE(
          NULLIF(v_project.recurring_description, ''),
          NULLIF(v_project.template_description, ''),
          'Mensalidade de consultoria - ' || to_char(v_month_date, 'MM/YYYY')
        ),
        CASE
          WHEN v_due_date < CURRENT_DATE THEN 'overdue'
          ELSE 'pending'
        END,
        true
      )
      RETURNING id INTO v_charge_id;

      -- Retornar informação da cobrança criada
      RETURN QUERY SELECT
        v_charge_id,
        v_month_date,
        v_due_date,
        v_project.fees,
        true;

      RAISE NOTICE 'Cobrança criada: % para mês % com vencimento %',
        v_charge_id, v_month_date, v_due_date;
    ELSE
      RAISE NOTICE 'Cobrança já existe para o mês %', v_month_date;
    END IF;

    -- Avançar para o próximo mês
    v_month_date := (v_month_date + interval '1 month')::date;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Função para processar todos os projetos recorrentes (retroativo + atual)
CREATE OR REPLACE FUNCTION process_all_recurring_charges()
RETURNS TABLE(
  project_id uuid,
  project_name text,
  charges_created integer,
  total_amount decimal
) AS $$
DECLARE
  v_project RECORD;
  v_charges_count integer;
  v_total_amount decimal;
BEGIN
  -- Buscar todos os projetos com cobrança recorrente
  FOR v_project IN
    SELECT
      ep.id,
      ep.name
    FROM engineering_projects ep
    INNER JOIN engineering_service_templates est ON ep.template_id = est.id
    WHERE est.is_recurring_monthly = true
      AND ep.status NOT IN ('finalizado', 'registrado')
  LOOP
    -- Gerar cobranças retroativas para este projeto
    SELECT
      COUNT(*),
      COALESCE(SUM(amount), 0)
    INTO v_charges_count, v_total_amount
    FROM generate_retroactive_recurring_charges(v_project.id);

    -- Se criou alguma cobrança, retornar informações
    IF v_charges_count > 0 THEN
      RETURN QUERY SELECT
        v_project.id,
        v_project.name,
        v_charges_count,
        v_total_amount;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Atualizar projetos existentes de consultoria com datas de cobrança
-- (apenas se ainda não tiver data definida)
UPDATE engineering_projects ep
SET
  recurring_start_date = COALESCE(recurring_start_date, date_trunc('month', start_date)::date),
  recurring_end_date = COALESCE(recurring_end_date, estimated_completion_date)
FROM engineering_service_templates est
WHERE ep.template_id = est.id
  AND est.is_recurring_monthly = true
  AND ep.recurring_start_date IS NULL;

-- Gerar cobranças retroativas para projetos existentes
DO $$
DECLARE
  v_result RECORD;
  v_total_charges integer := 0;
  v_total_amount decimal := 0;
BEGIN
  RAISE NOTICE '=== Iniciando geração de cobranças retroativas ===';

  FOR v_result IN
    SELECT * FROM process_all_recurring_charges()
  LOOP
    v_total_charges := v_total_charges + v_result.charges_created;
    v_total_amount := v_total_amount + v_result.total_amount;

    RAISE NOTICE 'Projeto: % - Cobranças criadas: % - Total: R$ %',
      v_result.project_name,
      v_result.charges_created,
      v_result.total_amount;
  END LOOP;

  RAISE NOTICE '=== Total: % cobranças no valor de R$ % ===',
    v_total_charges,
    v_total_amount;
END $$;

-- Atualizar a edge function para usar a nova função retroativa
COMMENT ON FUNCTION process_all_recurring_charges() IS 'Processa todos os projetos recorrentes gerando cobranças retroativas desde recurring_start_date';
COMMENT ON FUNCTION generate_retroactive_recurring_charges(uuid) IS 'Gera cobranças retroativas para um projeto específico desde recurring_start_date até hoje';

-- View atualizada para mostrar informações de projetos recorrentes
CREATE OR REPLACE VIEW v_recurring_projects AS
SELECT
  ep.id,
  ep.name as project_name,
  c.name as customer_name,
  est.name as template_name,
  ep.recurring_start_date,
  ep.recurring_end_date,
  est.fees as monthly_fee,
  est.recurring_due_day,
  ep.status,
  -- Contar cobranças
  COUNT(rc.id) FILTER (WHERE rc.status = 'pending') as pending_charges,
  COUNT(rc.id) FILTER (WHERE rc.status = 'overdue') as overdue_charges,
  COUNT(rc.id) FILTER (WHERE rc.status = 'paid') as paid_charges,
  -- Somar valores
  COALESCE(SUM(rc.amount) FILTER (WHERE rc.status IN ('pending', 'overdue')), 0) as total_pending,
  COALESCE(SUM(rc.amount) FILTER (WHERE rc.status = 'paid'), 0) as total_paid
FROM engineering_projects ep
INNER JOIN engineering_service_templates est ON ep.template_id = est.id
INNER JOIN customers c ON ep.customer_id = c.id
LEFT JOIN engineering_recurring_charges rc ON rc.project_id = ep.id
WHERE est.is_recurring_monthly = true
GROUP BY
  ep.id,
  ep.name,
  c.name,
  est.name,
  ep.recurring_start_date,
  ep.recurring_end_date,
  est.fees,
  est.recurring_due_day,
  ep.status
ORDER BY ep.name;

COMMENT ON VIEW v_recurring_projects IS 'Visão geral dos projetos com cobrança recorrente e suas cobranças';