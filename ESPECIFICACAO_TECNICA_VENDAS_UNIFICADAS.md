# ESPECIFICAÇÃO TÉCNICA - SISTEMA UNIFICADO DE VENDAS E RECEBÍVEIS

## 📋 ÍNDICE
1. [Visão Geral do Sistema](#visão-geral-do-sistema)
2. [Estrutura de Banco de Dados](#estrutura-de-banco-de-dados)
3. [Campos de Status nas Tabelas de Orçamento](#campos-de-status-nas-tabelas-de-orçamento)
4. [Automações e Triggers](#automações-e-triggers)
5. [Padrões de Condição de Pagamento](#padrões-de-condição-de-pagamento)
6. [Diagrama de Relacionamento](#diagrama-de-relacionamento)
7. [Regras de Negócio](#regras-de-negócio)
8. [API e Funções](#api-e-funções)
9. [Interface do Usuário](#interface-do-usuário)
10. [Exemplos Práticos](#exemplos-práticos)

---

## 🎯 VISÃO GERAL DO SISTEMA

### Objetivo
Centralizar vendas de três módulos de orçamento (Fábrica, Laje e Escritório) em um único painel financeiro com gestão completa de recebíveis.

### Arquitetura
- **Padrão de Design**: Polimorfismo por tipo (Type-based Polymorphism)
- **Estratégia de Dados**: Snapshot Pattern para preservação histórica
- **Integridade**: Triggers automáticos + Constraints únicos
- **Segurança**: Row Level Security (RLS) em todas as tabelas

### Fluxo Principal
```
Orçamento Aprovado → Venda Criada Automaticamente → Recebível "Sem Definição"
→ Usuário Define Pagamento → Recebíveis "Pendentes" → Confirmação de Recebimento
→ Entrada Automática no Fluxo de Caixa → Status "Pago"
```

---

## 🗄️ ESTRUTURA DE BANCO DE DADOS

### 1. TABELA: unified_sales

**Descrição**: Tabela central de vendas com relacionamento polimórfico para os três tipos de orçamento.

**Estrutura Completa**:

```sql
CREATE TABLE public.unified_sales (
  -- Identificador único
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- RELACIONAMENTO POLIMÓRFICO (Núcleo do Sistema)
  origem_tipo text NOT NULL CHECK (origem_tipo IN ('fabrica', 'laje', 'escritorio')),
  origem_id uuid NOT NULL,

  -- Dados do Cliente (Snapshot)
  customer_id uuid REFERENCES public.customers(id),
  customer_name_snapshot text,  -- Nome preservado no momento da venda

  -- Identificação e Dados da Venda
  sale_number text UNIQUE,  -- Gerado automaticamente: VND-YYYYMM0001
  data_venda date NOT NULL DEFAULT CURRENT_DATE,
  valor_total numeric(15, 2) NOT NULL DEFAULT 0,

  -- Responsável pela Venda
  responsavel_id uuid,  -- Referência opcional a employees
  responsavel_nome text,

  -- Classificação
  unidade_negocio text,  -- 'Fábrica', 'Fábrica - Laje', 'Escritório de Engenharia'

  -- Informações Complementares
  observacoes text,
  status text DEFAULT 'ativa' CHECK (status IN ('ativa', 'cancelada', 'concluida')),

  -- Auditoria
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text,

  -- CONSTRAINT CRÍTICA: Impede duplicação de vendas
  CONSTRAINT unique_origem UNIQUE (origem_tipo, origem_id)
);
```

**Campos Detalhados**:

| Campo | Tipo | Nullable | Descrição | Regra de Negócio |
|-------|------|----------|-----------|------------------|
| `id` | uuid | NO | Chave primária | Gerado automaticamente |
| `origem_tipo` | text | NO | Tipo do orçamento origem | 'fabrica', 'laje' ou 'escritorio' |
| `origem_id` | uuid | NO | ID do orçamento origem | Referência ao ID da tabela de origem |
| `customer_id` | uuid | YES | FK para customers | Mantém vínculo ativo com cliente |
| `customer_name_snapshot` | text | YES | Nome do cliente na época | Snapshot para relatórios históricos |
| `sale_number` | text | YES | Número único da venda | VND-YYYYMM0001 (gerado por trigger) |
| `data_venda` | date | NO | Data da venda | Default: data atual |
| `valor_total` | numeric(15,2) | NO | Valor total da venda | Soma dos itens ou do orçamento |
| `responsavel_id` | uuid | YES | ID do responsável | Referência opcional |
| `responsavel_nome` | text | YES | Nome do responsável | Snapshot do nome |
| `unidade_negocio` | text | YES | Unidade geradora | Identifica visualmente a origem |
| `observacoes` | text | YES | Observações gerais | Texto livre |
| `status` | text | YES | Status da venda | 'ativa', 'cancelada', 'concluida' |
| `created_at` | timestamptz | YES | Data/hora criação | Auditoria |
| `updated_at` | timestamptz | YES | Data/hora atualização | Atualizado por trigger |
| `created_by` | text | YES | Usuário criador | Nome/ID do usuário |

**Índices**:
```sql
CREATE INDEX idx_unified_sales_origem ON unified_sales(origem_tipo, origem_id);
CREATE INDEX idx_unified_sales_customer ON unified_sales(customer_id);
CREATE INDEX idx_unified_sales_data ON unified_sales(data_venda);
CREATE INDEX idx_unified_sales_status ON unified_sales(status);
```

---

### 2. TABELA: sale_items_snapshot

**Descrição**: Itens da venda com snapshot completo dos dados originais para preservação histórica.

**Estrutura Completa**:

```sql
CREATE TABLE public.sale_items_snapshot (
  -- Identificador
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id uuid NOT NULL REFERENCES unified_sales(id) ON DELETE CASCADE,

  -- Origem Polimórfica do Item
  item_origem_tipo text NOT NULL CHECK (item_origem_tipo IN ('produto', 'composicao', 'insumo')),
  item_origem_id uuid,  -- Pode ser NULL para itens customizados

  -- SNAPSHOT - Dados Preservados
  descricao_snapshot text NOT NULL,
  unidade_medida_snapshot text NOT NULL,
  codigo_snapshot text,

  -- Valores Comerciais
  quantidade numeric(15, 3) NOT NULL CHECK (quantidade > 0),
  preco_unitario numeric(15, 2) NOT NULL CHECK (preco_unitario >= 0),
  subtotal numeric(15, 2) NOT NULL,

  -- Custo para Análises
  custo_estimado_snapshot numeric(15, 2),

  -- Informações Adicionais
  observacoes text,

  -- Auditoria
  created_at timestamptz DEFAULT now()
);
```

**Campos Detalhados**:

| Campo | Tipo | Nullable | Descrição | Propósito do Snapshot |
|-------|------|----------|-----------|----------------------|
| `id` | uuid | NO | Chave primária | Identificador único |
| `venda_id` | uuid | NO | FK para unified_sales | Vínculo com a venda |
| `item_origem_tipo` | text | NO | Tipo do item | 'produto', 'composicao', 'insumo' |
| `item_origem_id` | uuid | YES | ID original do item | NULL se item customizado |
| `descricao_snapshot` | text | NO | Nome/descrição na época | Se produto mudar nome, venda mantém |
| `unidade_medida_snapshot` | text | NO | Unidade na época | Ex: "m³", "un", "kg" |
| `codigo_snapshot` | text | YES | Código na época | Referência cruzada |
| `quantidade` | numeric(15,3) | NO | Quantidade vendida | Deve ser > 0 |
| `preco_unitario` | numeric(15,2) | NO | Preço unitário na época | Preserva preço histórico |
| `subtotal` | numeric(15,2) | NO | Total do item | quantidade × preco_unitario |
| `custo_estimado_snapshot` | numeric(15,2) | YES | Custo na época | Para cálculo de margem |
| `observacoes` | text | YES | Obs específicas | Ex: customizações |
| `created_at` | timestamptz | YES | Data/hora criação | Auditoria |

**Índices**:
```sql
CREATE INDEX idx_sale_items_venda ON sale_items_snapshot(venda_id);
CREATE INDEX idx_sale_items_origem ON sale_items_snapshot(item_origem_tipo, item_origem_id);
```

**Por que Snapshot?**
- ✅ Vendas antigas continuam consistentes mesmo se produtos mudarem
- ✅ Relatórios históricos mantêm dados originais
- ✅ Não há quebra de informação ao alterar cadastros base
- ✅ Auditoria e compliance facilitados

---

### 3. TABELA: receivables

**Descrição**: Parcelas/Recebíveis com sistema de abas por status. Coração do controle financeiro.

**Estrutura Completa**:

```sql
CREATE TABLE public.receivables (
  -- Identificador
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id uuid NOT NULL REFERENCES unified_sales(id) ON DELETE CASCADE,

  -- Identificação da Parcela
  parcela_numero integer NOT NULL,
  descricao text,  -- Ex: "Entrada", "Parcela 1/6", "Saldo"

  -- Valores
  valor_parcela numeric(15, 2) NOT NULL CHECK (valor_parcela > 0),
  valor_recebido numeric(15, 2) DEFAULT 0,  -- Permite recebimento parcial

  -- Datas
  data_vencimento date,  -- Pode ser NULL para "sem definição"
  data_recebimento timestamptz,  -- Preenchido ao confirmar

  -- Forma de Pagamento
  forma_pagamento text,  -- pix, dinheiro, boleto, cheque, cartao_credito, etc

  -- STATUS (ABAS DO PAINEL) - CAMPO MAIS IMPORTANTE
  status text NOT NULL DEFAULT 'sem_definicao' CHECK (
    status IN ('sem_definicao', 'pendente', 'em_compensacao', 'pago', 'cancelado')
  ),

  -- Integração com Caixa
  conta_caixa_id uuid,  -- ID da conta de caixa (se houver tabela)
  conta_caixa_nome text,  -- Nome da conta
  cash_flow_id uuid,  -- Referência ao movimento criado no cash_flow

  -- Classificação
  unidade_negocio text,  -- Herdada da venda, mas editável

  -- Confirmação
  recebido_por text,  -- Nome de quem confirmou recebimento

  -- Observações
  observacoes text,

  -- Auditoria
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Campos Detalhados**:

| Campo | Tipo | Nullable | Descrição | Status Relacionado |
|-------|------|----------|-----------|-------------------|
| `id` | uuid | NO | Chave primária | - |
| `venda_id` | uuid | NO | FK para unified_sales | - |
| `parcela_numero` | integer | NO | Número sequencial | 0=entrada, 1..N=parcelas |
| `descricao` | text | YES | Descrição da parcela | "Entrada", "1/6", etc |
| `valor_parcela` | numeric(15,2) | NO | Valor da parcela | Deve ser > 0 |
| `valor_recebido` | numeric(15,2) | YES | Valor efetivamente recebido | Permite recebimento parcial |
| `data_vencimento` | date | YES | Data de vencimento | NULL em "sem_definicao" |
| `data_recebimento` | timestamptz | YES | Quando foi recebido | Preenchido ao mudar para "pago" |
| `forma_pagamento` | text | YES | Meio de pagamento | Ver tabela de formas abaixo |
| `status` | text | NO | **STATUS PRINCIPAL** | **Ver tabela de status abaixo** |
| `conta_caixa_id` | uuid | YES | ID da conta destino | Preenchido ao receber |
| `conta_caixa_nome` | text | YES | Nome da conta | Snapshot do nome |
| `cash_flow_id` | uuid | YES | ID do movimento criado | Vínculo com cash_flow |
| `unidade_negocio` | text | YES | Unidade de negócio | Herdada da venda |
| `recebido_por` | text | YES | Usuário confirmador | Nome/ID |
| `observacoes` | text | YES | Observações | Texto livre |
| `created_at` | timestamptz | YES | Data/hora criação | Auditoria |
| `updated_at` | timestamptz | YES | Data/hora atualização | Trigger |

**Status dos Recebíveis (Campo Crítico)**:

| Status | Significado | Quando Usar | Ações Disponíveis |
|--------|-------------|-------------|-------------------|
| `sem_definicao` | Pagamento não definido | Orçamento aprovado mas condições não definidas | Definir Pagamento |
| `pendente` | Aguardando recebimento | Condição definida, aguardando vencimento/pagamento | Confirmar Recebimento, Informar Cheque |
| `em_compensacao` | Cheque em processo | Cheque informado, aguardando compensação bancária | Confirmar Compensação |
| `pago` | Recebido | Valor confirmado e no caixa | Visualizar Movimento |
| `cancelado` | Cancelado | Replanejamento ou cancelamento da venda | Nenhuma |

**Formas de Pagamento Suportadas**:

| Valor | Descrição | Observações |
|-------|-----------|-------------|
| `pix` | PIX | Recebimento instantâneo |
| `dinheiro` | Dinheiro | Recebimento em espécie |
| `transferencia` | Transferência bancária | TED/DOC |
| `cheque` | Cheque | Requer tabela cheque_details |
| `boleto` | Boleto bancário | Aguardar compensação |
| `cartao_credito` | Cartão de Crédito | Pode ter taxa |
| `cartao_debito` | Cartão de Débito | Débito imediato |
| `deposito` | Depósito bancário | Depósito em conta |

**Índices**:
```sql
CREATE INDEX idx_receivables_venda ON receivables(venda_id);
CREATE INDEX idx_receivables_status ON receivables(status);
CREATE INDEX idx_receivables_vencimento ON receivables(data_vencimento);
CREATE INDEX idx_receivables_forma ON receivables(forma_pagamento);
```

---

### 4. TABELA: cheque_details

**Descrição**: Detalhes completos de cheques (opcional, vinculado a receivables com forma_pagamento='cheque').

**Estrutura Completa**:

```sql
CREATE TABLE public.cheque_details (
  -- Identificador
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receivable_id uuid NOT NULL REFERENCES receivables(id) ON DELETE CASCADE,

  -- Dados do Cheque
  numero_cheque text NOT NULL,
  banco_nome text NOT NULL,
  banco_codigo text,  -- Código do banco (ex: 001, 237)
  agencia text,
  conta text,

  -- Titular
  titular text NOT NULL,
  cpf_cnpj_titular text,

  -- Datas do Ciclo do Cheque
  data_emissao date NOT NULL,
  data_bom_para date,  -- Data para depositar (cheque pré-datado)
  data_deposito date,  -- Quando foi depositado
  data_compensacao date,  -- Quando compensou

  -- Status Específico do Cheque
  status_cheque text DEFAULT 'a_depositar' CHECK (
    status_cheque IN ('a_depositar', 'depositado', 'compensado', 'devolvido', 'cancelado')
  ),

  -- Anexos
  attachment_url text,  -- URL do anexo (foto/PDF do cheque)
  attachment_type text,  -- 'foto' ou 'pdf'

  -- Observações
  observacoes text,
  motivo_devolucao text,  -- Se devolvido, motivo

  -- Auditoria
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Campos Detalhados**:

| Campo | Tipo | Nullable | Descrição | Validação |
|-------|------|----------|-----------|-----------|
| `id` | uuid | NO | Chave primária | - |
| `receivable_id` | uuid | NO | FK para receivables | Cascade delete |
| `numero_cheque` | text | NO | Número do cheque | Obrigatório |
| `banco_nome` | text | NO | Nome do banco | Obrigatório |
| `banco_codigo` | text | YES | Código BACEN | Ex: 001, 237, 104 |
| `agencia` | text | YES | Agência | Opcional |
| `conta` | text | YES | Conta corrente | Opcional |
| `titular` | text | NO | Nome do titular | Obrigatório |
| `cpf_cnpj_titular` | text | YES | Documento do titular | Opcional |
| `data_emissao` | date | NO | Data de emissão | Obrigatório |
| `data_bom_para` | date | YES | Data para depositar | Cheque pré-datado |
| `data_deposito` | date | YES | Quando depositou | Preenchido ao depositar |
| `data_compensacao` | date | YES | Quando compensou | Preenchido ao compensar |
| `status_cheque` | text | YES | Status do cheque | Ver tabela abaixo |
| `attachment_url` | text | YES | URL do anexo | Storage Supabase |
| `attachment_type` | text | YES | Tipo do anexo | 'foto' ou 'pdf' |
| `observacoes` | text | YES | Observações gerais | Texto livre |
| `motivo_devolucao` | text | YES | Motivo se devolvido | Ex: "Sem fundos" |
| `created_at` | timestamptz | YES | Data/hora criação | Auditoria |
| `updated_at` | timestamptz | YES | Data/hora atualização | Trigger |

**Status do Cheque**:

| Status | Significado | Próxima Ação |
|--------|-------------|--------------|
| `a_depositar` | Cheque recebido, aguardando depósito | Depositar |
| `depositado` | Depositado, aguardando compensação | Aguardar |
| `compensado` | Compensado com sucesso | Nenhuma |
| `devolvido` | Devolvido pelo banco | Contatar cliente |
| `cancelado` | Cheque cancelado | Nenhuma |

**Índices**:
```sql
CREATE INDEX idx_cheque_receivable ON cheque_details(receivable_id);
CREATE INDEX idx_cheque_status ON cheque_details(status_cheque);
CREATE INDEX idx_cheque_bom_para ON cheque_details(data_bom_para);
```

---

## 📊 CAMPOS DE STATUS NAS TABELAS DE ORÇAMENTO

### Status Atual das Tabelas

#### 1. quotes (Orçamentos Fábrica)

| Campo | Tipo | Default | Valores Possíveis | Uso no Sistema |
|-------|------|---------|-------------------|----------------|
| `status` | text | 'pending' | 'pending', 'approved', 'rejected' | Status legado (mantido) |
| `approval_status` | text | 'pendente' | **'pendente', 'aprovado', 'rejeitado'** | **Status usado pelo trigger** |
| `payment_method` | text | NULL | Texto livre | Legado |
| `payment_condition` | jsonb | NULL | Estrutura JSON | **Novo campo para condições** |
| `sale_created` | boolean | false | true/false | **Flag de controle do trigger** |

#### 2. ribbed_slab_quotes (Orçamentos Laje)

| Campo | Tipo | Default | Valores Possíveis | Uso no Sistema |
|-------|------|---------|-------------------|----------------|
| `status` | text | 'draft' | 'draft', 'approved', 'rejected' | Status legado (mantido) |
| `approval_status` | text | 'pendente' | **'pendente', 'aprovado', 'rejeitado'** | **Status usado pelo trigger** |
| `payment_condition` | jsonb | NULL | Estrutura JSON | **Novo campo para condições** |
| `sale_created` | boolean | false | true/false | **Flag de controle do trigger** |

#### 3. engineering_projects (Orçamentos Escritório)

| Campo | Tipo | Default | Valores Possíveis | Uso no Sistema |
|-------|------|---------|-------------------|----------------|
| `status` | text | 'planning' | 'planning', 'active', 'completed', 'cancelled' | Status do projeto |
| `approval_status` | text | 'pendente' | **'pendente', 'aprovado', 'rejeitado'** | **Status usado pelo trigger** |
| `payment_condition` | jsonb | NULL | Estrutura JSON | **Novo campo para condições** |
| `sale_created` | boolean | false | true/false | **Flag de controle do trigger** |

### Padronização Implementada

**Campo Unificador: `approval_status`**
- ✅ Valor exato: `'aprovado'` (minúscula, sem acento)
- ✅ Presente nas 3 tabelas
- ✅ Trigger monitora mudança para 'aprovado'
- ✅ Flag `sale_created` evita duplicação

**Migração de Status Legados**:
```sql
-- Já executado na migration
UPDATE quotes SET approval_status = 'aprovado' WHERE status = 'approved';
UPDATE ribbed_slab_quotes SET approval_status = 'aprovado' WHERE status = 'approved';
UPDATE engineering_projects SET approval_status = 'aprovado' WHERE status = 'completed';
```

---

## ⚙️ AUTOMAÇÕES E TRIGGERS

### 1. AUTO-CRIAÇÃO DE VENDA AO APROVAR ORÇAMENTO

**Trigger**: `trigger_auto_create_sale_[quotes|ribbed|engineering]`

**Função**: `auto_create_sale_from_quote()`

**Lógica Completa**:

```sql
CREATE OR REPLACE FUNCTION public.auto_create_sale_from_quote()
RETURNS TRIGGER AS $$
DECLARE
  v_venda_id uuid;
  v_customer_name text;
  v_total_value numeric;
  v_origem_tipo text;
  v_unidade text;
BEGIN
  -- 1. VERIFICAÇÃO: Só processa se aprovado E venda ainda não criada
  IF NEW.approval_status = 'aprovado' AND NEW.sale_created = false THEN

    -- 2. IDENTIFICAÇÃO: Determinar tipo baseado na tabela
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

    -- 3. DADOS DO CLIENTE: Buscar nome atual
    SELECT c.name, COALESCE(NEW.total_value, 0)
    INTO v_customer_name, v_total_value
    FROM public.customers c
    WHERE c.id = NEW.customer_id;

    -- 4. CRIAR VENDA
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
      NEW.approved_by,
      v_unidade,
      'Venda criada automaticamente a partir de orçamento aprovado',
      NEW.approved_by
    )
    RETURNING id INTO v_venda_id;

    -- 5. CRIAR RECEBÍVEL INICIAL "SEM DEFINIÇÃO"
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
      'sem_definicao',  -- STATUS INICIAL
      v_unidade,
      'Condição de pagamento a ser definida'
    );

    -- 6. MARCAR ORÇAMENTO: Evita reprocessamento
    NEW.sale_created := true;

    -- 7. LOG
    RAISE NOTICE 'Venda % criada automaticamente para orçamento % (tipo: %)',
      v_venda_id, NEW.id, v_origem_tipo;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Instalação do Trigger**:

```sql
-- Para quotes (Fábrica)
DROP TRIGGER IF EXISTS trigger_auto_create_sale_quotes ON public.quotes;
CREATE TRIGGER trigger_auto_create_sale_quotes
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW
  WHEN (NEW.approval_status = 'aprovado' AND OLD.sale_created = false)
  EXECUTE FUNCTION public.auto_create_sale_from_quote();

-- Para ribbed_slab_quotes (Laje)
DROP TRIGGER IF EXISTS trigger_auto_create_sale_ribbed ON public.ribbed_slab_quotes;
CREATE TRIGGER trigger_auto_create_sale_ribbed
  BEFORE UPDATE ON public.ribbed_slab_quotes
  FOR EACH ROW
  WHEN (NEW.approval_status = 'aprovado' AND OLD.sale_created = false)
  EXECUTE FUNCTION public.auto_create_sale_from_quote();

-- Para engineering_projects (Escritório)
DROP TRIGGER IF EXISTS trigger_auto_create_sale_engineering ON public.engineering_projects;
CREATE TRIGGER trigger_auto_create_sale_engineering
  BEFORE UPDATE ON public.engineering_projects
  FOR EACH ROW
  WHEN (NEW.approval_status = 'aprovado' AND OLD.sale_created = false)
  EXECUTE FUNCTION public.auto_create_sale_from_quote();
```

**Fluxo de Execução**:

```
1. Usuário aprova orçamento (SET approval_status = 'aprovado')
   ↓
2. BEFORE UPDATE trigger detecta mudança
   ↓
3. Verifica: approval_status='aprovado' E sale_created=false
   ↓
4. Identifica tipo de orçamento (quotes/ribbed/engineering)
   ↓
5. Busca dados do cliente
   ↓
6. Cria registro em unified_sales
   ↓
7. Cria recebível inicial com status='sem_definicao'
   ↓
8. Marca sale_created=true no orçamento
   ↓
9. COMMIT
```

**Proteções Implementadas**:
- ✅ UNIQUE constraint (origem_tipo, origem_id) impede duplicação no BD
- ✅ Flag sale_created impede reprocessamento
- ✅ WHEN clause no trigger otimiza performance
- ✅ BEFORE UPDATE permite modificar NEW.sale_created

---

### 2. AUTO-CRIAÇÃO DE MOVIMENTO NO FLUXO DE CAIXA

**Trigger**: `trigger_auto_create_cash_flow`

**Função**: `auto_create_cash_flow_on_receivable_paid()`

**Lógica Completa**:

```sql
CREATE OR REPLACE FUNCTION public.auto_create_cash_flow_on_receivable_paid()
RETURNS TRIGGER AS $$
DECLARE
  v_venda record;
  v_cash_flow_id uuid;
BEGIN
  -- 1. VERIFICAÇÃO: Só processa quando status mudou para 'pago'
  IF NEW.status = 'pago' AND (OLD.status IS NULL OR OLD.status != 'pago') THEN

    -- 2. BUSCAR DADOS DA VENDA
    SELECT * INTO v_venda
    FROM public.unified_sales
    WHERE id = NEW.venda_id;

    -- 3. CRIAR MOVIMENTO NO FLUXO DE CAIXA
    INSERT INTO public.cash_flow (
      date,
      type,
      category,
      description,
      amount,
      created_at
    ) VALUES (
      COALESCE(NEW.data_recebimento, now()),  -- Data do recebimento ou agora
      'entrada',  -- Sempre entrada
      'Venda',  -- Categoria
      'Recebimento Venda ' || v_venda.sale_number ||
      ' - Parcela ' || NEW.parcela_numero ||
      ' - ' || v_venda.customer_name_snapshot ||
      ' (' || v_venda.unidade_negocio || ')',  -- Descrição completa
      COALESCE(NEW.valor_recebido, NEW.valor_parcela),  -- Valor recebido ou total
      now()
    )
    RETURNING id INTO v_cash_flow_id;

    -- 4. VINCULAR MOVIMENTO AO RECEBÍVEL
    NEW.cash_flow_id := v_cash_flow_id;

    -- 5. LOG
    RAISE NOTICE 'Movimento de caixa % criado para recebível %', v_cash_flow_id, NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Instalação do Trigger**:

```sql
DROP TRIGGER IF EXISTS trigger_auto_create_cash_flow ON public.receivables;
CREATE TRIGGER trigger_auto_create_cash_flow
  BEFORE UPDATE ON public.receivables
  FOR EACH ROW
  WHEN (NEW.status = 'pago')
  EXECUTE FUNCTION public.auto_create_cash_flow_on_receivable_paid();
```

**Características Importantes**:
- ✅ Só cria entrada quando status vira 'pago'
- ✅ Não cria nada para 'pendente' ou 'em_compensacao'
- ✅ Fluxo de caixa fica limpo (só valores reais)
- ✅ Descrição completa e rastreável
- ✅ Vínculo bidirecional (receivable ↔ cash_flow)

---

### 3. FUNÇÃO DE REPLANEJAMENTO SEGURO

**Função**: `replan_receivables()`

**Descrição**: Permite replanejar parcelas sem perder histórico, mantendo parcelas já pagas.

**Lógica Completa**:

```sql
CREATE OR REPLACE FUNCTION public.replan_receivables(
  p_venda_id uuid,
  p_new_receivables jsonb  -- Array de novos recebíveis
)
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
  v_receivable jsonb;
  v_paid_count int;
  v_new_id uuid;
BEGIN
  -- 1. CONTAR RECEBÍVEIS JÁ PAGOS
  SELECT COUNT(*)
  INTO v_paid_count
  FROM public.receivables
  WHERE venda_id = p_venda_id
    AND status = 'pago';

  -- 2. CANCELAR RECEBÍVEIS NÃO PAGOS (mantém os pagos)
  UPDATE public.receivables
  SET
    status = 'cancelado',
    observacoes = COALESCE(observacoes, '') || ' | Cancelado por replanejamento em ' || NOW()::text,
    updated_at = NOW()
  WHERE venda_id = p_venda_id
    AND status != 'pago';

  -- 3. CRIAR NOVOS RECEBÍVEIS
  FOR v_receivable IN SELECT * FROM jsonb_array_elements(p_new_receivables)
  LOOP
    INSERT INTO public.receivables (
      venda_id,
      parcela_numero,
      descricao,
      valor_parcela,
      data_vencimento,
      forma_pagamento,
      status,
      unidade_negocio,
      observacoes
    ) VALUES (
      p_venda_id,
      (v_receivable->>'parcela_numero')::integer,
      v_receivable->>'descricao',
      (v_receivable->>'valor_parcela')::numeric,
      (v_receivable->>'data_vencimento')::date,
      v_receivable->>'forma_pagamento',
      COALESCE(v_receivable->>'status', 'pendente'),
      v_receivable->>'unidade_negocio',
      v_receivable->>'observacoes'
    )
    RETURNING id INTO v_new_id;
  END LOOP;

  -- 4. RETORNAR RESULTADO
  v_result := jsonb_build_object(
    'success', true,
    'paid_kept', v_paid_count,
    'message', 'Replanejamento concluído. ' || v_paid_count || ' parcelas pagas foram mantidas.'
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Exemplo de Uso**:

```sql
-- Replanejar venda em 3 parcelas mensais
SELECT replan_receivables(
  '123e4567-e89b-12d3-a456-426614174000',  -- venda_id
  '[
    {
      "parcela_numero": 1,
      "descricao": "Parcela 1/3",
      "valor_parcela": 1000.00,
      "data_vencimento": "2026-02-15",
      "forma_pagamento": "pix",
      "status": "pendente",
      "unidade_negocio": "Fábrica"
    },
    {
      "parcela_numero": 2,
      "descricao": "Parcela 2/3",
      "valor_parcela": 1000.00,
      "data_vencimento": "2026-03-15",
      "forma_pagamento": "pix",
      "status": "pendente",
      "unidade_negocio": "Fábrica"
    },
    {
      "parcela_numero": 3,
      "descricao": "Parcela 3/3",
      "valor_parcela": 1000.00,
      "data_vencimento": "2026-04-15",
      "forma_pagamento": "pix",
      "status": "pendente",
      "unidade_negocio": "Fábrica"
    }
  ]'::jsonb
);
```

**Segurança do Replanejamento**:
- ✅ Parcelas pagas NUNCA são tocadas
- ✅ Parcelas antigas são canceladas (não deletadas) → histórico
- ✅ Novas parcelas criadas com novo plano
- ✅ Auditoria completa via timestamps
- ✅ Retorna quantidade de parcelas pagas mantidas

---

## 💰 PADRÕES DE CONDIÇÃO DE PAGAMENTO

### Estrutura do Campo payment_condition (JSONB)

O campo `payment_condition` aceita estruturas flexíveis em JSON. Aqui estão os padrões recomendados:

### 1. À VISTA

```json
{
  "tipo": "a_vista",
  "forma": "pix",
  "desconto_percentual": 5
}
```

**Uso no Replanejamento**:
```json
[
  {
    "parcela_numero": 1,
    "descricao": "À vista",
    "valor_parcela": 2850.00,
    "data_vencimento": "2026-01-20",
    "forma_pagamento": "pix",
    "status": "pendente"
  }
]
```

---

### 2. ENTRADA + PARCELADO

```json
{
  "tipo": "entrada_parcelado",
  "entrada_percentual": 30,
  "entrada_valor": 900.00,
  "num_parcelas": 3,
  "valor_parcela": 700.00,
  "intervalo_dias": 30,
  "primeira_parcela": "2026-02-20"
}
```

**Uso no Replanejamento**:
```json
[
  {
    "parcela_numero": 0,
    "descricao": "Entrada (30%)",
    "valor_parcela": 900.00,
    "data_vencimento": "2026-01-20",
    "forma_pagamento": "pix",
    "status": "pendente"
  },
  {
    "parcela_numero": 1,
    "descricao": "Parcela 1/3",
    "valor_parcela": 700.00,
    "data_vencimento": "2026-02-20",
    "forma_pagamento": "boleto",
    "status": "pendente"
  },
  {
    "parcela_numero": 2,
    "descricao": "Parcela 2/3",
    "valor_parcela": 700.00,
    "data_vencimento": "2026-03-20",
    "forma_pagamento": "boleto",
    "status": "pendente"
  },
  {
    "parcela_numero": 3,
    "descricao": "Parcela 3/3",
    "valor_parcela": 700.00,
    "data_vencimento": "2026-04-20",
    "forma_pagamento": "boleto",
    "status": "pendente"
  }
]
```

---

### 3. CHEQUES PRÉ-DATADOS

```json
{
  "tipo": "cheques_predatados",
  "num_cheques": 6,
  "valor_cheque": 500.00,
  "intervalo_dias": 30,
  "primeiro_cheque_data": "2026-01-30",
  "bom_para_dias_offset": 0
}
```

**Uso no Replanejamento**:
```json
[
  {
    "parcela_numero": 1,
    "descricao": "Cheque 1/6",
    "valor_parcela": 500.00,
    "data_vencimento": "2026-01-30",
    "forma_pagamento": "cheque",
    "status": "pendente"
  },
  {
    "parcela_numero": 2,
    "descricao": "Cheque 2/6",
    "valor_parcela": 500.00,
    "data_vencimento": "2026-02-28",
    "forma_pagamento": "cheque",
    "status": "pendente"
  }
  // ... até 6/6
]
```

---

### 4. PARCELADO NO CARTÃO

```json
{
  "tipo": "cartao_parcelado",
  "bandeira": "visa",
  "num_parcelas": 12,
  "valor_parcela": 250.00,
  "com_juros": false,
  "taxa_percentual": 0
}
```

**Uso no Replanejamento**:
```json
[
  {
    "parcela_numero": 1,
    "descricao": "Parcela 1/12 - Cartão Visa",
    "valor_parcela": 250.00,
    "data_vencimento": "2026-02-05",
    "forma_pagamento": "cartao_credito",
    "status": "pendente"
  }
  // ... até 12/12
]
```

---

### 5. CUSTOMIZADO (ENTRADA + SALDO EM X DIAS)

```json
{
  "tipo": "customizado",
  "entrada_valor": 1000.00,
  "saldo_valor": 2000.00,
  "saldo_prazo_dias": 60,
  "observacoes": "Entrada à vista + saldo em 60 dias"
}
```

**Uso no Replanejamento**:
```json
[
  {
    "parcela_numero": 0,
    "descricao": "Entrada",
    "valor_parcela": 1000.00,
    "data_vencimento": "2026-01-20",
    "forma_pagamento": "dinheiro",
    "status": "pendente"
  },
  {
    "parcela_numero": 1,
    "descricao": "Saldo (60 dias)",
    "valor_parcela": 2000.00,
    "data_vencimento": "2026-03-21",
    "forma_pagamento": "transferencia",
    "status": "pendente"
  }
]
```

---

## 🔗 DIAGRAMA DE RELACIONAMENTO

```
┌─────────────────────┐
│     customers       │
└──────────┬──────────┘
           │
           │ 1:N
           ▼
┌─────────────────────┐         ┌─────────────────────┐
│      quotes         │         │ ribbed_slab_quotes  │
│ (origem: fabrica)   │         │  (origem: laje)     │
└──────────┬──────────┘         └──────────┬──────────┘
           │                               │
           │                               │
           │                               │
           │         ┌─────────────────────┴──────────┐
           │         │  engineering_projects          │
           │         │   (origem: escritorio)         │
           │         └─────────────┬──────────────────┘
           │                       │
           │ Polimorfismo          │
           │ (origem_tipo +        │
           │  origem_id)           │
           │                       │
           ▼                       ▼
    ┌──────────────────────────────────────┐
    │        unified_sales                 │
    │  ┌─────────────────────────────┐    │
    │  │ origem_tipo + origem_id     │    │
    │  │ UNIQUE CONSTRAINT           │    │
    │  └─────────────────────────────┘    │
    └──────────────┬───────────────────────┘
                   │
                   │ 1:N
                   ▼
    ┌──────────────────────────────────────┐
    │      sale_items_snapshot             │
    │  ┌─────────────────────────────┐    │
    │  │ Snapshot Pattern:           │    │
    │  │ - descricao_snapshot        │    │
    │  │ - preco_unitario            │    │
    │  │ - custo_estimado_snapshot   │    │
    │  └─────────────────────────────┘    │
    └──────────────────────────────────────┘
                   │
                   │ 1:N
    ┌──────────────┴───────────────────────┐
    │         receivables                  │
    │  ┌─────────────────────────────┐    │
    │  │ STATUS (Abas):              │    │
    │  │ - sem_definicao             │    │
    │  │ - pendente                  │    │
    │  │ - em_compensacao            │    │
    │  │ - pago                      │    │
    │  │ - cancelado                 │    │
    │  └─────────────────────────────┘    │
    └──────────────┬───────────────────────┘
                   │
                   │ 1:1 (opcional)
                   ▼
    ┌──────────────────────────────────────┐
    │       cheque_details                 │
    │  (apenas se forma_pagamento='cheque')│
    └──────────────────────────────────────┘
                   │
                   │ 1:1 (quando pago)
                   ▼
    ┌──────────────────────────────────────┐
    │         cash_flow                    │
    │  (entrada criada pelo trigger)       │
    └──────────────────────────────────────┘
```

---

## 📏 REGRAS DE NEGÓCIO

### RN-01: Unicidade de Venda
- **Regra**: Um orçamento pode gerar apenas UMA venda
- **Implementação**: UNIQUE constraint (origem_tipo, origem_id)
- **Violação**: Erro no BD impede inserção duplicada

### RN-02: Snapshot Obrigatório
- **Regra**: Todos os dados comerciais devem ser preservados em snapshot
- **Implementação**: Campos NOT NULL em sale_items_snapshot
- **Benefício**: Relatórios históricos consistentes

### RN-03: Status de Recebível
- **Regra**: Recebível segue fluxo obrigatório de status
- **Fluxo**: sem_definicao → pendente → [em_compensacao] → pago
- **Exceção**: Pode ir direto de pendente para pago (não cheque)

### RN-04: Movimento de Caixa
- **Regra**: Entrada no cash_flow APENAS quando status='pago'
- **Implementação**: Trigger em receivables
- **Benefício**: Fluxo de caixa realista (sem previsões)

### RN-05: Replanejamento Seguro
- **Regra**: Replanejamento NUNCA altera parcelas pagas
- **Implementação**: Função replan_receivables
- **Ação**: Cancela pendentes, mantém pagas, cria novas

### RN-06: Validação de Valores
- **Regra**: Valores devem ser sempre positivos
- **Implementação**: CHECK constraints (valor > 0)
- **Exceção**: valor_recebido pode ser 0 (não recebido)

### RN-07: Rastreabilidade de Cheque
- **Regra**: Cheque requer registro em cheque_details
- **Implementação**: Interface exige dados ao escolher cheque
- **Validação**: Campos obrigatórios (numero_cheque, banco, titular)

### RN-08: Auditoria Completa
- **Regra**: Todas as alterações são auditadas
- **Implementação**: Campos created_at, updated_at em todas as tabelas
- **Trigger**: update_updated_at_column em UPDATE

### RN-09: Integridade Referencial
- **Regra**: Deleção em cascata para itens dependentes
- **Implementação**: ON DELETE CASCADE
- **Exemplo**: Deletar venda deleta itens e recebíveis

### RN-10: Aprovação Única
- **Regra**: Orçamento aprovado não pode ser reaprovado
- **Implementação**: Flag sale_created + WHEN clause
- **Proteção**: Impede reprocessamento do trigger

---

## 🔌 API E FUNÇÕES

### VIEW: v_receivables_dashboard

**Descrição**: View consolidada para o painel de recebíveis.

```sql
CREATE OR REPLACE VIEW public.v_receivables_dashboard AS
SELECT
  -- Recebível
  r.id,
  r.venda_id,
  r.parcela_numero,
  r.descricao,
  r.valor_parcela,
  r.valor_recebido,
  r.data_vencimento,
  r.data_recebimento,
  r.forma_pagamento,
  r.status,
  r.unidade_negocio,
  r.observacoes,

  -- Venda
  v.sale_number,
  v.origem_tipo,
  v.customer_id,
  v.customer_name_snapshot,
  v.data_venda,
  v.valor_total as venda_valor_total,

  -- Indicadores Calculados
  CASE
    WHEN r.status = 'pago' THEN 'pago'
    WHEN r.data_vencimento IS NULL THEN 'sem_vencimento'
    WHEN r.data_vencimento < CURRENT_DATE THEN 'vencido'
    WHEN r.data_vencimento <= CURRENT_DATE + INTERVAL '7 days' THEN 'vence_em_breve'
    ELSE 'no_prazo'
  END as indicador_vencimento,

  -- Cheque (se existir)
  cd.numero_cheque,
  cd.banco_nome,
  cd.status_cheque,
  cd.data_bom_para as cheque_bom_para,

  -- Auditoria
  r.created_at,
  r.updated_at
FROM public.receivables r
JOIN public.unified_sales v ON v.id = r.venda_id
LEFT JOIN public.cheque_details cd ON cd.receivable_id = r.id
WHERE r.status != 'cancelado';
```

**Uso**:
```sql
-- Recebíveis vencidos
SELECT * FROM v_receivables_dashboard
WHERE indicador_vencimento = 'vencido';

-- Recebíveis da fábrica
SELECT * FROM v_receivables_dashboard
WHERE origem_tipo = 'fabrica';

-- Recebíveis por status
SELECT * FROM v_receivables_dashboard
WHERE status = 'pendente'
ORDER BY data_vencimento;
```

---

## 🖥️ INTERFACE DO USUÁRIO

### Componente: UnifiedSales.tsx

**Localização**: `/src/components/UnifiedSales.tsx`

**Características**:
- ✅ Abas de status (Sem Definição, A Receber, Em Compensação, Recebido)
- ✅ Busca por número de venda ou cliente
- ✅ Cards coloridos por indicador de vencimento
- ✅ Modais para: Recebimento, Cheque, Replanejamento
- ✅ Atualização automática após ações

**Menu Principal**:
- Novo módulo "Recebíveis - Painel Financeiro Unificado"
- Ícone: DollarSign (cifrão)
- Cor: Verde esmeralda
- Removida aba "Vendas" da Fábrica

---

## 💡 EXEMPLOS PRÁTICOS

### Exemplo 1: Aprovar Orçamento e Gerar Venda

```sql
-- 1. Aprovar orçamento da fábrica
UPDATE public.quotes
SET
  approval_status = 'aprovado',
  approved_by = 'João Silva',
  approved_at = NOW()
WHERE id = '123e4567-e89b-12d3-a456-426614174000';

-- 2. Sistema cria automaticamente:
-- - unified_sales (origem_tipo='fabrica', origem_id=id_do_orcamento)
-- - receivables (status='sem_definicao', valor=total_do_orcamento)

-- 3. Verificar venda criada
SELECT * FROM unified_sales
WHERE origem_tipo = 'fabrica'
  AND origem_id = '123e4567-e89b-12d3-a456-426614174000';
```

---

### Exemplo 2: Definir Pagamento Parcelado

```typescript
// Interface (TypeScript)
const replanData = {
  venda_id: 'abc12345-...',
  forma_pagamento: 'boleto',
  num_parcelas: 6,
  valor_entrada: 1000,
  data_primeira_parcela: '2026-02-15',
  intervalo_dias: 30
};

// Calcular parcelas
const valor_total = 7000;
const valor_parcelado = valor_total - replanData.valor_entrada;
const valor_parcela = valor_parcelado / replanData.num_parcelas;

const newReceivables = [];

// Entrada
newReceivables.push({
  parcela_numero: 0,
  descricao: 'Entrada',
  valor_parcela: replanData.valor_entrada,
  data_vencimento: new Date().toISOString().split('T')[0],
  forma_pagamento: 'pix',
  status: 'pendente',
  unidade_negocio: 'Fábrica'
});

// Parcelas
for (let i = 1; i <= replanData.num_parcelas; i++) {
  const data_venc = new Date(replanData.data_primeira_parcela);
  data_venc.setDate(data_venc.getDate() + (i - 1) * replanData.intervalo_dias);

  newReceivables.push({
    parcela_numero: i,
    descricao: `Parcela ${i}/${replanData.num_parcelas}`,
    valor_parcela: valor_parcela,
    data_vencimento: data_venc.toISOString().split('T')[0],
    forma_pagamento: replanData.forma_pagamento,
    status: 'pendente',
    unidade_negocio: 'Fábrica'
  });
}

// Chamar função
await supabase.rpc('replan_receivables', {
  p_venda_id: replanData.venda_id,
  p_new_receivables: newReceivables
});
```

---

### Exemplo 3: Confirmar Recebimento

```typescript
// Atualizar status para 'pago'
const { error } = await supabase
  .from('receivables')
  .update({
    status: 'pago',
    data_recebimento: new Date().toISOString(),
    valor_recebido: 1000,
    recebido_por: 'Maria Santos',
    observacoes: 'Recebido via PIX'
  })
  .eq('id', receivable_id);

// Trigger cria automaticamente entrada no cash_flow
```

---

### Exemplo 4: Informar Cheque

```typescript
const chequeData = {
  receivable_id: 'xyz789-...',
  numero_cheque: '000123',
  banco_nome: 'Banco do Brasil',
  banco_codigo: '001',
  agencia: '1234-5',
  conta: '12345-6',
  titular: 'Cliente XYZ Ltda',
  cpf_cnpj_titular: '12.345.678/0001-90',
  data_emissao: '2026-01-15',
  data_bom_para: '2026-02-15',
  status_cheque: 'a_depositar',
  observacoes: 'Cheque pré-datado'
};

// Inserir detalhes do cheque
await supabase
  .from('cheque_details')
  .insert(chequeData);

// Atualizar recebível para 'em_compensacao'
await supabase
  .from('receivables')
  .update({ status: 'em_compensacao' })
  .eq('id', chequeData.receivable_id);
```

---

## 🎯 RESUMO EXECUTIVO

### O Que Foi Implementado

1. **✅ Sistema de Vendas Unificado**
   - Tabela única para vendas de 3 origens
   - Relacionamento polimórfico seguro
   - Numeração automática

2. **✅ Gestão de Recebíveis com Abas**
   - 4 status principais: Sem Definição, Pendente, Em Compensação, Pago
   - Controle completo de parcelas
   - Rastreamento de cheques

3. **✅ Automações Completas**
   - Venda criada ao aprovar orçamento
   - Entrada no caixa ao confirmar recebimento
   - Replanejamento seguro preservando histórico

4. **✅ Snapshot Pattern**
   - Dados históricos preservados
   - Relatórios consistentes no tempo
   - Integridade de informações

5. **✅ Interface Moderna**
   - Painel unificado no menu principal
   - Abas visuais por status
   - Indicadores de vencimento

### Benefícios

- 🎯 **Centralização**: Todos os recebíveis em um único lugar
- 📊 **Visibilidade**: Status claro de cada parcela
- 💰 **Caixa Limpo**: Apenas valores efetivamente recebidos
- 🔒 **Segurança**: Constraints e triggers impedem erros
- 📈 **Flexibilidade**: Replanejamento sem perder dados
- 🕐 **Histórico**: Snapshot preserva informações originais
- ⚡ **Automação**: Menos trabalho manual, menos erros

---

**Data**: 2026-01-17
**Versão**: 1.0
**Status**: ✅ Implementado e Testado
