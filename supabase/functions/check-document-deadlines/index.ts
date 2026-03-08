import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    console.log('Iniciando verificação de prazos...');

    const today = new Date();
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    const todayStr = today.toISOString().split('T')[0];
    const thirtyDaysStr = thirtyDaysFromNow.toISOString().split('T')[0];

    console.log(`Buscando documentos que vencem entre ${todayStr} e ${thirtyDaysStr}`);

    const { data: deadlines, error: deadlinesError } = await supabase
      .from('document_deadlines')
      .select('*')
      .eq('status', 'active')
      .gte('expiry_date', todayStr)
      .lte('expiry_date', thirtyDaysStr);

    if (deadlinesError) {
      console.error('Erro ao buscar prazos:', deadlinesError);
      throw deadlinesError;
    }

    console.log(`Encontrados ${deadlines?.length || 0} prazos para verificação`);

    const results = {
      total: deadlines?.length || 0,
      alerts_sent: 0,
      errors: 0,
      skipped: 0,
      details: [] as any[],
    };

    if (!deadlines || deadlines.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhum documento próximo do vencimento',
          results,
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    for (const deadline of deadlines) {
      try {
        if (deadline.applies_to_all) {
          console.log(`Processando prazo geral: ${deadline.document_type} para imóveis ${deadline.property_type}`);

          const { data: properties, error: propError } = await supabase
            .from('properties')
            .select(`
              id,
              name,
              customer_id,
              customers!inner (
                id,
                name,
                phone
              )
            `)
            .eq('property_type', deadline.property_type);

          if (propError) {
            console.error('Erro ao buscar imóveis:', propError);
            results.errors++;
            continue;
          }

          if (!properties || properties.length === 0) {
            console.log(`Nenhum imóvel do tipo ${deadline.property_type} encontrado`);
            results.skipped++;
            continue;
          }

          const uniqueCustomers = new Map();
          properties.forEach(prop => {
            const customer = prop.customers;
            if (customer && customer.phone && !uniqueCustomers.has(customer.id)) {
              uniqueCustomers.set(customer.id, {
                id: customer.id,
                name: customer.name,
                phone: customer.phone,
                properties: [prop.name]
              });
            } else if (customer && uniqueCustomers.has(customer.id)) {
              uniqueCustomers.get(customer.id).properties.push(prop.name);
            }
          });

          console.log(`Enviando alertas para ${uniqueCustomers.size} clientes únicos`);

          for (const [customerId, customerData] of uniqueCustomers) {
            try {
              if (!customerData.phone) {
                console.log(`Cliente ${customerData.name} sem telefone. Pulando...`);
                results.skipped++;
                continue;
              }

              const notificationResponse = await fetch(
                `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp-notification`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                  },
                  body: JSON.stringify({
                    deadlineId: deadline.id,
                    customerName: customerData.name,
                    customerPhone: customerData.phone,
                    propertyNames: customerData.properties.join(', '),
                    propertyType: deadline.property_type,
                    appliesToAll: true,
                    messageType: 'expiry_alert',
                    documentType: deadline.document_type,
                    documentNumber: deadline.document_number,
                    expiryDate: deadline.expiry_date,
                    renewalCost: deadline.renewal_cost,
                  }),
                }
              );

              if (notificationResponse.ok) {
                results.alerts_sent++;
                results.details.push({
                  deadline_id: deadline.id,
                  customer: customerData.name,
                  phone: customerData.phone,
                  properties: customerData.properties.join(', '),
                  status: 'sent',
                });
              } else {
                results.errors++;
                results.details.push({
                  deadline_id: deadline.id,
                  customer: customerData.name,
                  status: 'error',
                  reason: await notificationResponse.text(),
                });
              }

              await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
              console.error(`Erro ao enviar alerta para cliente ${customerData.name}:`, error);
              results.errors++;
            }
          }

          const { error: updateError } = await supabase
            .from('document_deadlines')
            .update({
              status: 'alert_sent',
              alert_sent_at: new Date().toISOString(),
            })
            .eq('id', deadline.id);

          if (updateError) {
            console.error(`Erro ao atualizar status do prazo ${deadline.id}:`, updateError);
          }

        } else {
          console.log(`Processando prazo específico para imóvel ${deadline.property_id}`);

          const { data: property, error: propError } = await supabase
            .from('properties')
            .select(`
              id,
              name,
              customer_id,
              customers!inner (
                id,
                name,
                phone
              )
            `)
            .eq('id', deadline.property_id)
            .single();

          if (propError || !property) {
            console.error('Erro ao buscar imóvel:', propError);
            results.errors++;
            continue;
          }

          const customer = property.customers;

          if (!customer.phone) {
            console.log(`Cliente ${customer.name} não possui telefone cadastrado. Pulando...`);
            results.skipped++;
            results.details.push({
              deadline_id: deadline.id,
              property: property.name,
              customer: customer.name,
              status: 'skipped',
              reason: 'Cliente sem telefone cadastrado',
            });
            continue;
          }

          console.log(`Enviando alerta para ${customer.name} - Documento ${deadline.document_type}`);

          const notificationResponse = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp-notification`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                deadlineId: deadline.id,
                propertyId: property.id,
                propertyName: property.name,
                customerPhone: customer.phone,
                messageType: 'expiry_alert',
                documentType: deadline.document_type,
                documentNumber: deadline.document_number,
                expiryDate: deadline.expiry_date,
                renewalCost: deadline.renewal_cost,
              }),
            }
          );

          if (notificationResponse.ok) {
            const { error: updateError } = await supabase
              .from('document_deadlines')
              .update({
                status: 'alert_sent',
                alert_sent_at: new Date().toISOString(),
              })
              .eq('id', deadline.id);

            if (updateError) {
              console.error(`Erro ao atualizar status do prazo ${deadline.id}:`, updateError);
            }

            results.alerts_sent++;
            results.details.push({
              deadline_id: deadline.id,
              property: property.name,
              customer: customer.name,
              phone: customer.phone,
              status: 'sent',
            });
          } else {
            results.errors++;
            results.details.push({
              deadline_id: deadline.id,
              property: property.name,
              customer: customer.name,
              status: 'error',
              reason: await notificationResponse.text(),
            });
          }

          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`Erro ao processar prazo ${deadline.id}:`, error);
        results.errors++;
        results.details.push({
          deadline_id: deadline.id,
          status: 'error',
          reason: error.message,
        });
      }
    }

    const { error: expiredError } = await supabase
      .from('document_deadlines')
      .update({ status: 'expired' })
      .lt('expiry_date', todayStr)
      .in('status', ['active', 'alert_sent']);

    if (expiredError) {
      console.error('Erro ao atualizar documentos vencidos:', expiredError);
    }

    console.log('Verificação concluída:', results);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Verificação concluída. ${results.alerts_sent} alertas enviados, ${results.errors} erros, ${results.skipped} ignorados.`,
        results,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Erro ao verificar prazos:", error);
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
