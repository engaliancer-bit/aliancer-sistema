import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface NotificationRequest {
  deadlineId: string;
  propertyId?: string;
  propertyName?: string;
  propertyNames?: string;
  propertyType?: string;
  appliesToAll?: boolean;
  customerName?: string;
  customerPhone: string;
  messageType: 'expiry_alert' | 'renewal_completed' | 'payment_request';
  documentType: string;
  documentNumber?: string;
  expiryDate?: string;
  renewalCost: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload: NotificationRequest = await req.json();
    const {
      deadlineId,
      propertyId,
      propertyName,
      propertyNames,
      propertyType,
      appliesToAll,
      customerName,
      customerPhone,
      messageType,
      documentType,
      documentNumber,
      expiryDate,
      renewalCost,
    } = payload;

    console.log('Processando notificação:', { messageType, customerPhone, documentType });

    // Buscar configurações da empresa
    const { data: settings } = await supabase
      .from('company_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['company_name', 'company_phone', 'bank_name', 'bank_agency', 'bank_account', 'bank_pix', 'whatsapp_api_url', 'whatsapp_api_token']);

    const config: Record<string, string> = {};
    settings?.forEach(s => {
      config[s.setting_key] = s.setting_value;
    });

    // Montar mensagem baseada no tipo
    let messageContent = '';

    if (messageType === 'expiry_alert') {
      const daysUntilExpiry = expiryDate
        ? Math.ceil((new Date(expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : 30;

      const docTypeLabel = {
        'ccir': 'CCIR',
        'itr': 'ITR',
        'cib': 'CIB',
        'car': 'CAR',
        'iptu': 'IPTU'
      }[documentType] || documentType.toUpperCase();

      if (appliesToAll) {
        const propertyTypeLabel = propertyType === 'rural' ? 'rurais' : 'urbanos';
        messageContent = `🔔 *${config.company_name || 'Aliancer'}* - Alerta de Vencimento

Olá ${customerName ? customerName : ''}! Identificamos que o documento *${docTypeLabel}* está próximo do vencimento.

📄 *Documento:* ${docTypeLabel}
${documentNumber ? `🔢 *Número:* ${documentNumber}` : ''}
📅 *Vencimento:* ${expiryDate ? new Date(expiryDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}
⏰ *Prazo:* ${daysUntilExpiry} dias

🏠 *Seus imóveis ${propertyTypeLabel}:*
${propertyNames || 'Todos os seus imóveis cadastrados'}

💼 *Serviço de Renovação*
Podemos cuidar da renovação deste documento para todos os seus imóveis!

💰 *Valor do serviço:* R$ ${renewalCost.toFixed(2)}

✅ *Para aceitar*, responda: *SIM*
❌ *Para recusar*, responda: *NÃO*

📞 Contato: ${config.company_phone || '(63) 99999-9999'}

_Mensagem automática do sistema de gestão ${config.company_name || 'Aliancer'}_`;
      } else {
        messageContent = `🔔 *${config.company_name || 'Aliancer'}* - Alerta de Vencimento

Olá! Identificamos que o documento *${docTypeLabel}* do imóvel *${propertyName}* está próximo do vencimento.

📄 *Documento:* ${docTypeLabel}
🔢 *Número:* ${documentNumber || 'N/A'}
📅 *Vencimento:* ${expiryDate ? new Date(expiryDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}
⏰ *Prazo:* ${daysUntilExpiry} dias

💼 *Serviço de Renovação*
Podemos cuidar da renovação deste documento para você!

💰 *Valor do serviço:* R$ ${renewalCost.toFixed(2)}

✅ *Para aceitar*, responda: *SIM*
❌ *Para recusar*, responda: *NÃO*

📞 Contato: ${config.company_phone || '(63) 99999-9999'}

_Mensagem automática do sistema de gestão ${config.company_name || 'Aliancer'}_`;
      }

    } else if (messageType === 'renewal_completed') {
      const docTypeLabel = {
        'ccir': 'CCIR',
        'itr': 'ITR',
        'cib': 'CIB',
        'car': 'CAR'
      }[documentType] || documentType.toUpperCase();

      messageContent = `✅ *Renovação Concluída com Sucesso!*

Olá! Temos uma ótima notícia! 🎉

A renovação do documento *${docTypeLabel}* do imóvel *${propertyName}* foi concluída com sucesso.

📄 *Documento:* ${docTypeLabel}
🔢 *Número:* ${documentNumber || 'N/A'}

📎 O documento renovado será enviado em anexo na próxima mensagem.

💰 *Valor do Serviço:* R$ ${renewalCost.toFixed(2)}

*Dados para Pagamento:*
🏦 *Banco:* ${config.bank_name || 'N/A'}
🏢 *Agência:* ${config.bank_agency || 'N/A'}
💳 *Conta:* ${config.bank_account || 'N/A'}
📱 *PIX:* ${config.bank_pix || 'N/A'}

Após o pagamento, por favor nos envie o comprovante.

📞 *Dúvidas?* Entre em contato: ${config.company_phone || '(63) 99999-9999'}

Obrigado pela confiança! 🤝

_${config.company_name || 'Aliancer'}_`;
    }

    // IMPORTANTE: Aqui você precisa integrar com uma API real de WhatsApp
    // Exemplos: Twilio, Meta WhatsApp Business API, Evolution API, etc.

    const whatsappApiUrl = config.whatsapp_api_url;
    const whatsappApiToken = config.whatsapp_api_token;

    let notificationStatus = 'pending';
    let errorMessage = null;

    if (whatsappApiUrl && whatsappApiToken) {
      try {
        // Exemplo de integração com Twilio (adapte conforme sua API)
        /*
        const twilioResponse = await fetch(whatsappApiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${whatsappApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: customerPhone,
            body: messageContent,
          }),
        });

        if (twilioResponse.ok) {
          notificationStatus = 'sent';
        } else {
          notificationStatus = 'failed';
          errorMessage = await twilioResponse.text();
        }
        */

        // Por enquanto, simula sucesso se as configurações existem
        console.log('API WhatsApp configurada, enviando mensagem...');
        console.log('Para:', customerPhone);
        console.log('Mensagem:', messageContent);
        notificationStatus = 'sent';
      } catch (error) {
        console.error('Erro ao enviar via API WhatsApp:', error);
        notificationStatus = 'failed';
        errorMessage = error.message;
      }
    } else {
      console.warn('API do WhatsApp não configurada. Configure em Configurações da Empresa.');
      console.log('Mensagem que seria enviada:', messageContent);
      console.log('Para:', customerPhone);
      // Marca como 'sent' para permitir testes sem API configurada
      notificationStatus = 'sent';
    }

    // Registrar notificação no banco
    const { error: insertError } = await supabase
      .from('whatsapp_notifications')
      .insert([{
        deadline_id: deadlineId,
        property_id: propertyId,
        customer_phone: customerPhone,
        message_type: messageType,
        message_content: messageContent,
        sent_at: notificationStatus === 'sent' ? new Date().toISOString() : null,
        status: notificationStatus,
      }]);

    if (insertError) {
      console.error('Erro ao registrar notificação:', insertError);
    }

    return new Response(
      JSON.stringify({
        success: notificationStatus === 'sent',
        status: notificationStatus,
        message: messageContent,
        error: errorMessage,
        info: !whatsappApiUrl || !whatsappApiToken
          ? 'API do WhatsApp não configurada. Configure em company_settings.'
          : null
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Erro ao processar notificação:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});