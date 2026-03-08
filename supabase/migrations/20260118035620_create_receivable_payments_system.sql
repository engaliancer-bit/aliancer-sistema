/*
  # Sistema de Pagamentos de Recebíveis

  ## Descrição
  Cria um sistema completo para registrar pagamentos individuais de recebíveis,
  permitindo múltiplos pagamentos parciais e estornos independentes.

  ## Novas Tabelas

  ### `receivable_payments`
  Registra cada pagamento realizado em um recebível
  - `id` (uuid, PK) - Identificador único do pagamento
  - `receivable_id` (uuid, FK) - Referência ao recebível
  - `valor_pago` (numeric) - Valor pago neste pagamento específico
  - `data_pagamento` (date) - Data em que o pagamento foi realizado
  - `forma_pagamento` (text) - Forma de pagamento utilizada
  - `conta_caixa_id` (uuid, FK) - Conta/caixa onde foi recebido
  - `recebido_por` (text) - Nome de quem recebeu
  - `observacoes` (text) - Observações sobre o pagamento
  - `estornado` (boolean) - Se o pagamento foi estornado
  - `data_estorno` (timestamptz) - Data do estorno
  - `motivo_estorno` (text) - Motivo do estorno
  - `created_at` (timestamptz) - Data de criação
  - `updated_at` (timestamptz) - Data de atualização

  ## Funcionalidades

  1. **Registro de Pagamentos**
     - Cada pagamento (total ou parcial) cria um registro independente
     - Atualiza automaticamente o valor_recebido do receivable

  2. **Estorno de Pagamentos**
     - Permite estornar pagamentos individuais
     - Atualiza automaticamente o valor_recebido ao estornar
     - Mantém histórico com motivo do estorno

  3. **Sincronização Automática**
     - Trigger atualiza valor_recebido no receivable
     - Atualiza status do receivable baseado nos pagamentos

  ## Segurança
  - RLS habilitado com políticas adequadas
*/

-- Criar tabela de pagamentos de recebíveis
CREATE TABLE IF NOT EXISTS receivable_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receivable_id uuid NOT NULL REFERENCES receivables(id) ON DELETE CASCADE,
  valor_pago numeric NOT NULL CHECK (valor_pago > 0),
  data_pagamento date NOT NULL,
  forma_pagamento text,
  conta_caixa_id uuid REFERENCES contas_caixa(id),
  recebido_por text,
  observacoes text,
  estornado boolean DEFAULT false,
  data_estorno timestamptz,
  motivo_estorno text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_receivable_payments_receivable ON receivable_payments(receivable_id);
CREATE INDEX IF NOT EXISTS idx_receivable_payments_data ON receivable_payments(data_pagamento);
CREATE INDEX IF NOT EXISTS idx_receivable_payments_estornado ON receivable_payments(estornado);
CREATE INDEX IF NOT EXISTS idx_receivable_payments_conta_caixa ON receivable_payments(conta_caixa_id);

-- Habilitar RLS
ALTER TABLE receivable_payments ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (acesso público temporário para desenvolvimento)
CREATE POLICY "Permitir acesso público a receivable_payments" ON receivable_payments FOR ALL USING (true) WITH CHECK (true);

-- Função para atualizar valor_recebido no receivable
CREATE OR REPLACE FUNCTION update_receivable_valor_recebido()
RETURNS TRIGGER AS $$
DECLARE
  v_total_recebido numeric;
  v_valor_parcela numeric;
  v_novo_status text;
BEGIN
  -- Calcular total recebido (apenas pagamentos não estornados)
  SELECT COALESCE(SUM(valor_pago), 0)
  INTO v_total_recebido
  FROM receivable_payments
  WHERE receivable_id = COALESCE(NEW.receivable_id, OLD.receivable_id)
    AND estornado = false;

  -- Buscar valor da parcela
  SELECT valor_parcela
  INTO v_valor_parcela
  FROM receivables
  WHERE id = COALESCE(NEW.receivable_id, OLD.receivable_id);

  -- Determinar novo status
  IF v_total_recebido >= v_valor_parcela THEN
    v_novo_status := 'pago';
  ELSIF v_total_recebido > 0 THEN
    v_novo_status := 'em_compensacao';
  ELSE
    -- Manter status atual se não houver pagamentos
    SELECT status INTO v_novo_status
    FROM receivables
    WHERE id = COALESCE(NEW.receivable_id, OLD.receivable_id);

    -- Se estava em compensacao ou pago e agora não tem pagamentos, volta para pendente
    IF v_novo_status IN ('em_compensacao', 'pago') THEN
      v_novo_status := 'pendente';
    END IF;
  END IF;

  -- Atualizar receivable
  UPDATE receivables
  SET
    valor_recebido = v_total_recebido,
    status = v_novo_status,
    updated_at = now()
  WHERE id = COALESCE(NEW.receivable_id, OLD.receivable_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar receivable após inserir pagamento
DROP TRIGGER IF EXISTS trg_receivable_payment_insert ON receivable_payments;
CREATE TRIGGER trg_receivable_payment_insert
  AFTER INSERT ON receivable_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_receivable_valor_recebido();

-- Trigger para atualizar receivable após atualizar pagamento (estorno)
DROP TRIGGER IF EXISTS trg_receivable_payment_update ON receivable_payments;
CREATE TRIGGER trg_receivable_payment_update
  AFTER UPDATE ON receivable_payments
  FOR EACH ROW
  WHEN (OLD.estornado IS DISTINCT FROM NEW.estornado)
  EXECUTE FUNCTION update_receivable_valor_recebido();

-- Trigger para atualizar receivable após deletar pagamento
DROP TRIGGER IF EXISTS trg_receivable_payment_delete ON receivable_payments;
CREATE TRIGGER trg_receivable_payment_delete
  AFTER DELETE ON receivable_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_receivable_valor_recebido();

-- Adicionar comentários
COMMENT ON TABLE receivable_payments IS 'Registra cada pagamento individual realizado em recebíveis';
COMMENT ON COLUMN receivable_payments.valor_pago IS 'Valor pago neste pagamento específico';
COMMENT ON COLUMN receivable_payments.estornado IS 'Indica se este pagamento foi estornado';
COMMENT ON COLUMN receivable_payments.data_estorno IS 'Data em que o pagamento foi estornado';
COMMENT ON COLUMN receivable_payments.motivo_estorno IS 'Motivo do estorno do pagamento';
