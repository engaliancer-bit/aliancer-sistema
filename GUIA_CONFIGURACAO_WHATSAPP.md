# Guia Rápido de Configuração do Sistema de Notificações WhatsApp

## Passo a Passo para Começar

### 1. Configure a Empresa (OBRIGATÓRIO)

1. Acesse: **Indústria → Configurações**
2. Preencha TODOS os campos:

#### Dados da Empresa
- **Nome da Empresa:** Aliancer Engenharia
- **Telefone do Escritório:** (63) 99999-9999
- **Número de WhatsApp da Empresa (REMETENTE):** 556399999999
  - ⚠️ **FORMATO:** Código do país (55) + DDD (63) + Número (99999999)
  - ⚠️ **SEM:** Espaços, parênteses, hífens ou traços
  - ⚠️ Este número deve estar vinculado à sua API do WhatsApp Business

#### Dados Bancários
- **Banco:** Banco do Brasil
- **Agência:** 0001
- **Conta:** 12345-6
- **Chave PIX:** contato@aliancer.com.br

#### API do WhatsApp Business
- **URL da API:** Fornecida pelo seu provedor
- **Token de Autenticação:** Token fornecido pelo provedor

3. Clique em **"Salvar Configurações"**

### 2. Cadastre seus Imóveis

1. Acesse: **Escritório de Engenharia e Topografia → Clientes**
2. Cadastre clientes com **telefone no formato internacional**
   - Exemplo: 556399999999
3. Acesse: **Escritório de Engenharia e Topografia → Imóveis**
4. Cadastre os imóveis e vincule aos clientes
5. Selecione o tipo: **Rural** ou **Urbano**

### 3. Configure os Prazos de Documentos

1. Acesse: **Escritório de Engenharia e Topografia → Projetos**
2. Clique em **"Adicionar Prazo Geral"**
3. Preencha:
   - **Tipo de Imóvel:** Rural ou Urbano
   - **Tipo de Documento:** CCIR, ITR, CIB, CAR, IPTU, etc.
   - **Data de Vencimento:** Quando o documento vence
   - **Valor do Serviço:** Quanto cobrar pela renovação
4. Clique em **"Cadastrar Prazo"**

### 4. Envie os Alertas

1. Na lista de prazos, clique em **"Enviar Alertas"**
2. O sistema irá:
   - Buscar todos os imóveis do tipo selecionado
   - Agrupar por cliente
   - Enviar 1 mensagem por cliente listando seus imóveis
   - Registrar o envio no banco de dados

## Formato dos Telefones

### ✅ CORRETO
- **Cliente:** 556399999999
- **Empresa (Remetente):** 556399999999

### ❌ INCORRETO
- (63) 99999-9999
- +55 63 99999-9999
- 63 99999-9999
- 99999-9999

## Opções de API do WhatsApp Business

### 1. Evolution API (Recomendado para iniciantes)
- **Site:** https://evolution-api.com
- **Vantagens:** Fácil instalação, gratuito, auto-hospedável
- **Como usar:** Instale localmente ou em servidor, obtenha URL e token

### 2. Meta WhatsApp Cloud API (Oficial)
- **Site:** https://business.whatsapp.com
- **Vantagens:** Oficial do WhatsApp, confiável
- **Desvantagens:** Processo de aprovação mais demorado

### 3. Twilio
- **Site:** https://www.twilio.com/whatsapp
- **Vantagens:** Robusto, suporte profissional
- **Desvantagens:** Pago

### 4. Sem API (Envio Manual)
- O sistema funciona mesmo sem API
- As mensagens são geradas e você pode copiá-las
- Envie manualmente pelo seu WhatsApp

## Testando o Sistema

### Teste Básico:
1. Configure seus dados
2. Cadastre UM cliente com seu próprio número
3. Cadastre UM imóvel para este cliente
4. Crie um prazo geral com vencimento próximo
5. Clique em "Enviar Alertas"
6. Você deve receber a mensagem no seu WhatsApp

### Verificando Logs:
1. Pressione **F12** no navegador
2. Vá na aba **Console**
3. Procure por mensagens de erro ou sucesso
4. Anote qualquer erro para suporte

## Resolução de Problemas

### Não recebi a mensagem
✅ **Verifique:**
1. Configurações preenchidas? (Indústria → Configurações)
2. Número do remetente no formato correto? (556399999999)
3. Telefone do cliente no formato correto? (556399999999)
4. API do WhatsApp configurada? (URL e Token)
5. Número do remetente vinculado à API?

### Erro ao enviar alertas
✅ **Verifique:**
1. Console do navegador (F12 → Console)
2. Mensagem de erro exibida
3. Todas as configurações preenchidas
4. Cliente tem telefone cadastrado

### Cliente não recebeu
✅ **Verifique:**
1. Telefone do cliente está correto?
2. Cliente tem imóveis cadastrados?
3. Imóveis são do tipo correto? (rural/urbano)
4. Verifique o log de notificações no banco

## Estrutura de Mensagem Enviada

```
🔔 *Aliancer Engenharia* - Alerta de Vencimento

Olá João Silva! Identificamos que o documento *ITR* está próximo do vencimento.

📄 *Documento:* ITR
📅 *Vencimento:* 30/09/2026
⏰ *Prazo:* 25 dias

🏠 *Seus imóveis rurais:*
Fazenda São João, Fazenda Santa Maria

💼 *Serviço de Renovação*
Podemos cuidar da renovação deste documento para todos os seus imóveis!

💰 *Valor do serviço:* R$ 350.00

✅ *Para aceitar*, responda: *SIM*
❌ *Para recusar*, responda: *NÃO*

📞 Contato: (63) 99999-9999

_Mensagem automática do sistema de gestão Aliancer Engenharia_
```

## Dicas Importantes

1. **Sempre teste primeiro** com seu próprio número
2. **Mantenha backup** dos números de telefone
3. **Configure a API** antes de cadastrar muitos prazos
4. **Use alertas com antecedência** (60 dias ou mais)
5. **Monitore o console** para ver erros
6. **Salve as configurações** após qualquer alteração

## Suporte

Para ajuda adicional:
- Verifique `SISTEMA_PRAZOS_DOCUMENTOS.md` para documentação completa
- Consulte os logs do navegador (F12)
- Verifique as Edge Functions no painel do Supabase
- Entre em contato com o suporte técnico

---

**Última atualização:** Janeiro 2026
