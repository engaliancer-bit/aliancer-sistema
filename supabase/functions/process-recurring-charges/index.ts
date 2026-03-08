import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Criar cliente Supabase (service role para acesso completo)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Chamar função do banco para gerar cobranças (retroativas + atuais)
    const { data, error } = await supabase.rpc("process_all_recurring_charges");

    if (error) {
      console.error("Erro ao gerar cobranças:", error);
      throw error;
    }

    console.log("Cobranças geradas:", data);

    // Calcular totais
    const totalCharges = data?.reduce((sum: number, item: any) => sum + (item.charges_created || 0), 0) || 0;
    const totalAmount = data?.reduce((sum: number, item: any) => sum + parseFloat(item.total_amount || 0), 0) || 0;

    return new Response(
      JSON.stringify({
        success: true,
        message: "Cobranças recorrentes processadas com sucesso (incluindo retroativas)",
        results: data || [],
        total_projects: data?.length || 0,
        total_charges: totalCharges,
        total_amount: totalAmount,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Erro na edge function:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
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
