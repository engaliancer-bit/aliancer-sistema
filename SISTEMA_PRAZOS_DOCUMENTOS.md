# Sistema de Gestão de Prazos e Notificações WhatsApp

## Visão Geral

Sistema completo para gerenciar prazos de vencimento de documentos (CCIR, ITR, CIB, CAR, IPTU, etc.) e enviar notificações automáticas via WhatsApp para os clientes, oferecendo serviços de renovação.

**IMPORTANTE:** O sistema agora trabalha com **prazos gerais** que se aplicam a **TODOS os imóveis** de um determinado tipo (rural ou urbano), ao invés de prazos individuais por imóvel.

## Funcionalidades Implementadas

### 1. Gestão de Prazos Gerais de Documentos

**Localização:** Aba "Projetos" dentro de "Escritório de Engenharia e Topografia"

**Como usar:**
1. Entre na aba "Escritório de Engenharia e Topografia"
2. Clique em "Projetos"
3. Clique em "Adicionar Prazo Geral"
4. Preencha:
   - **Tipo de Imóvel:** Rural ou Urbano (este prazo se aplicará a TODOS os imóveis deste tipo)
   - **Tipo de Documento:** CCIR, ITR, CIB, CAR, IPTU, etc.
   - **Número/Identificação:** Protocolo ou número de referência (opcional)
   - **Data de Vencimento:** Quando o documento vence
   - **Valor do Serviço:** Quanto cobrar pela renovação
   - **Observações:** Informações adicionais (opcional)
5. Clique em "Cadastrar Prazo"

**Exemplo:** Se você cadastrar um prazo para ITR de imóveis rurais com vencimento em 30/09/2026, o sistema enviará alertas automaticamente para TODOS os clientes que possuem imóveis rurais cadastrados.

### 2. Fluxo Automático de Notificações

O sistema gerencia automaticamente o seguinte fluxo:

#### Passo 1: Alerta de Vencimento (30 dias antes)
- Sistema identifica prazos gerais que vencem em 30 dias ou menos
- Busca TODOS os imóveis do tipo especificado (rural ou urbano)
- Envia notificação automática via WhatsApp para cada cliente
- Mensagem inclui:
  - Tipo e número do documento
  - Data de vencimento
  - Lista de imóveis do cliente
  - Valor do serviço de renovação
  - Opção de aceitar (responder "SIM") ou recusar (responder "NÃO")

**Status:** "Alertas Enviados"

#### Passo 2: Renovação em Andamento
- Escritório marca como "Iniciar Renovações"
- Sistema registra que o processo começou

**Status:** "Em Renovação"

#### Passo 3: Renovações Concluídas
- Escritório clica em "Renovações Concluídas"
- Sistema pode enviar notificações aos clientes informando conclusão
- Envia dados bancários para pagamento

**Status:** "Renovado"

#### Passo 4: Processo Concluído
- Escritório confirma recebimento dos pagamentos
- Clica em "Marcar como Concluído"

**Status:** "Concluído"

### 3. Alertas no Dashboard

**Localização:** Tela inicial (Dashboard) da aba "Indústria"

Mostra automaticamente:
- Prazos gerais que vencem nos próximos 60 dias
- Status de cada prazo
- Nível de urgência (cores diferentes)
- Tipo de imóvel (rural/urbano) ao qual se aplica

**Cores dos alertas:**
- 🔴 Vermelho: Vence em 7 dias ou menos (URGENTE)
- 🟠 Laranja: Vence em 8-15 dias (ATENÇÃO)
- 🟡 Amarelo: Vence em 16-30 dias (AVISO)
- 🔵 Azul: Vence em 31-60 dias (INFORMATIVO)

### 4. Configurações da Empresa

**Localização:** Menu "Configurações" na aba "Indústria"

Configure:

#### Dados da Empresa
- Nome da empresa
- Telefone do escritório (para receber respostas)

#### Dados Bancários
- Banco
- Agência
- Conta
- Chave PIX

#### Integração WhatsApp Business API
- URL da API WhatsApp
- Token de Autenticação

**Nota:** O sistema funciona sem a API configurada, mas as mensagens não serão enviadas automaticamente. As mensagens geradas podem ser copiadas e enviadas manualmente.

### 5. Verificação Automática de Vencimentos

**Edge Function:** `check-document-deadlines`

**Como funciona:**
Esta função deve ser executada periodicamente (recomendado: diariamente) para:
- Verificar todos os prazos gerais que vencem em 30 dias ou menos
- Buscar TODOS os imóveis do tipo relacionado ao prazo
- Agrupar por cliente (evita enviar múltiplas mensagens para o mesmo cliente)
- Enviar alertas automáticos para cada cliente único
- Atualizar status de prazos vencidos

**Para configurar execução automática:**
1. Configure um cron job no Supabase
2. Ou use um serviço externo como Cron-job.org
3. Endpoint: `https://seu-projeto.supabase.co/functions/v1/check-document-deadlines`

## Estrutura do Banco de Dados

### Tabela: document_deadlines
Armazena todos os prazos de documentos:
- `id`: Identificador único
- `property_id`: ID do imóvel (NULL para prazos gerais)
- `property_type`: Tipo do imóvel ('rural' ou 'urban')
- `applies_to_all`: Boolean indicando se é prazo geral
- `document_type`: Tipo do documento
- `document_number`: Número do documento
- `expiry_date`: Data de vencimento
- `renewal_cost`: Valor do serviço
- `status`: Status do processo
- `alert_sent_at`: Data do envio dos alertas
- `accepted_at`: Data da aceitação
- `renewed_at`: Data da renovação
- `completed_at`: Data da conclusão

**Constraint:** Se `applies_to_all = true`, então `property_type` deve estar preenchido e `property_id` deve ser NULL.

### Tabela: whatsapp_notifications
Log de todas as notificações enviadas:
- `id`: Identificador único
- `deadline_id`: ID do prazo relacionado
- `property_id`: ID do imóvel (NULL para prazos gerais)
- `customer_phone`: Telefone do cliente
- `message_type`: Tipo da mensagem
- `message_content`: Conteúdo enviado
- `sent_at`: Data/hora do envio
- `status`: Status do envio

### Tabela: company_settings
Configurações da empresa:
- `setting_key`: Chave da configuração
- `setting_value`: Valor da configuração
- `description`: Descrição

## Edge Functions

### 1. send-whatsapp-notification
Envia notificações via WhatsApp para clientes.

**Endpoint:** `/functions/v1/send-whatsapp-notification`

**Tipos de mensagem:**
- `expiry_alert`: Alerta de vencimento
- `renewal_completed`: Renovação concluída
- `payment_request`: Solicitação de pagamento

**Suporta:**
- Prazos gerais (aplica a todos os imóveis de um tipo)
- Prazos específicos (para um imóvel individual - compatibilidade legada)

### 2. check-document-deadlines
Verifica automaticamente prazos próximos do vencimento.

**Endpoint:** `/functions/v1/check-document-deadlines`

**Execução:** Recomendado diariamente

**Funcionalidades:**
- Processa prazos gerais, buscando todos os imóveis do tipo
- Agrupa clientes para evitar spam (um cliente com 5 imóveis rurais recebe 1 mensagem, não 5)
- Processa prazos específicos (compatibilidade legada)
- Atualiza status automaticamente

## Integrações WhatsApp

O sistema suporta integração com diversas APIs de WhatsApp Business:

### Opções Populares:
1. **Twilio** - https://www.twilio.com/whatsapp
2. **Meta WhatsApp Business API** - https://business.whatsapp.com
3. **Evolution API** - https://evolution-api.com
4. **WhatsApp Cloud API** - API oficial do Meta

### Configuração:
1. Escolha um provedor
2. Crie uma conta e obtenha credenciais
3. Configure na aba "Configurações":
   - URL da API
   - Token de autenticação
4. Teste o envio

**Sem API configurada:**
- O sistema continua funcionando
- Mensagens são geradas e armazenadas
- Você pode copiá-las e enviar manualmente

## Exemplo de Mensagem Automática

### Alerta de Vencimento (Prazo Geral):
```
🔔 *Aliancer* - Alerta de Vencimento

Olá João Silva! Identificamos que o documento *ITR* está próximo do vencimento.

📄 *Documento:* ITR
📅 *Vencimento:* 30/09/2026
⏰ *Prazo:* 25 dias

🏠 *Seus imóveis rurais:*
Fazenda São João, Fazenda Santa Maria, Sítio Boa Vista

💼 *Serviço de Renovação*
Podemos cuidar da renovação deste documento para todos os seus imóveis!

💰 *Valor do serviço:* R$ 350.00

✅ *Para aceitar*, responda: *SIM*
❌ *Para recusar*, responda: *NÃO*

📞 Contato: (63) 99999-9999

_Mensagem automática do sistema de gestão Aliancer_
```

### Renovação Concluída:
```
✅ *Renovação Concluída com Sucesso!*

Olá! Temos uma ótima notícia! 🎉

A renovação do documento *ITR* do imóvel *Fazenda São João* foi concluída com sucesso.

📄 *Documento:* ITR
🔢 *Número:* 123.456.789.012-3

📎 O documento renovado será enviado em anexo na próxima mensagem.

💰 *Valor do Serviço:* R$ 350.00

*Dados para Pagamento:*
🏦 *Banco:* Banco do Brasil
🏢 *Agência:* 0001
💳 *Conta:* 12345-6
📱 *PIX:* contato@aliancer.com.br

Após o pagamento, por favor nos envie o comprovante.

📞 *Dúvidas?* Entre em contato: (63) 99999-9999

Obrigado pela confiança! 🤝

_Aliancer_
```

## Benefícios do Sistema

1. **Eficiência Máxima**: Um prazo para múltiplos imóveis (ao invés de cadastrar individualmente)
2. **Automação Completa**: Reduz trabalho manual de monitoramento
3. **Proatividade**: Clientes são avisados antes do vencimento
4. **Geração de Receita**: Oferece serviços de renovação automaticamente
5. **Organização**: Todos os prazos centralizados e rastreáveis
6. **Comunicação Profissional**: Mensagens padronizadas e profissionais
7. **Controle Financeiro**: Rastreia valores e pagamentos
8. **Histórico Completo**: Log de todas as interações
9. **Evita Spam**: Agrupa imóveis por cliente (1 mensagem por cliente, não por imóvel)

## Diferenças da Versão Anterior

### Antes (Prazos Individuais):
- ❌ Prazos cadastrados por imóvel individual
- ❌ 10 imóveis = 10 cadastros de prazo
- ❌ Cliente com 5 imóveis recebia 5 mensagens
- ❌ Localizado na edição de cada imóvel

### Agora (Prazos Gerais):
- ✅ Prazos cadastrados por tipo de imóvel (rural/urbano)
- ✅ 1 prazo para TODOS os imóveis do tipo
- ✅ Cliente com 5 imóveis recebe 1 mensagem listando os 5
- ✅ Localizado na aba "Projetos"
- ✅ Muito mais eficiente e organizado

## Casos de Uso

### Exemplo 1: ITR para Imóveis Rurais
1. Cadastre um prazo geral para "ITR" - Imóveis Rurais - Vencimento: 30/09/2026
2. Sistema busca TODOS os imóveis rurais cadastrados
3. Agrupa por cliente
4. Envia 1 mensagem por cliente listando seus imóveis rurais
5. Cliente vê lista completa de suas propriedades afetadas

### Exemplo 2: IPTU para Imóveis Urbanos
1. Cadastre um prazo geral para "IPTU" - Imóveis Urbanos - Vencimento: 31/01/2026
2. Sistema busca TODOS os imóveis urbanos
3. Envia alerta para cada cliente com imóveis urbanos
4. Mensagem lista todos os imóveis urbanos do cliente

## Dicas de Uso

1. **Um prazo por tipo de documento e tipo de imóvel**: Ex: 1 prazo para ITR rural, 1 prazo para IPTU urbano
2. **Configure alertas com antecedência**: 60 dias ou mais se possível
3. **Verifique o Dashboard diariamente**: Para ver alertas urgentes
4. **Mantenha dados bancários atualizados**: Para facilitar pagamentos
5. **Teste o sistema**: Antes de usar em produção, teste com seu próprio número
6. **Configure a verificação automática**: Para garantir que nenhum prazo seja perdido

## Arquivos Criados/Modificados

### Novos Componentes:
- `src/components/GeneralDocumentDeadlines.tsx` - Gestão de prazos gerais
- `src/components/CompanySettings.tsx` - Configurações (mantido)
- `src/components/DeadlineAlerts.tsx` - Alertas no dashboard (mantido)

### Componentes Modificados:
- `src/components/EngineeringProjects.tsx` - Agora usa GeneralDocumentDeadlines
- `src/components/CustomerProperties.tsx` - Removido DocumentDeadlines individual

### Edge Functions Atualizadas:
- `supabase/functions/check-document-deadlines/` - Suporta prazos gerais
- `supabase/functions/send-whatsapp-notification/` - Mensagens para prazos gerais

### Migrations:
- `update_document_deadlines_for_general_properties` - Adiciona campos para prazos gerais
- `update_whatsapp_notifications_for_general_deadlines` - Torna property_id nullable

## Suporte e Manutenção

Para suporte ou dúvidas sobre o sistema:
1. Verifique este documento
2. Consulte os logs do navegador (F12 > Console)
3. Verifique as Edge Functions no painel do Supabase
4. Entre em contato com o suporte técnico

## Próximos Passos

1. Configure os dados da empresa
2. Configure a API do WhatsApp (opcional)
3. Cadastre prazos gerais para seus documentos
4. Configure a verificação automática diária
5. Monitore o Dashboard regularmente
