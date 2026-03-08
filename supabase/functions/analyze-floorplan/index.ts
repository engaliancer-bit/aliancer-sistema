import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ElementSuggestion {
  element_type: string;
  label: string;
  room: string | null;
  params: Record<string, number>;
  ia_confidence: number;
  ia_reasoning: string;
}

interface IAAnalysisResult {
  elements: ElementSuggestion[];
  general_observations: string;
  total_area_estimated: number | null;
  budget_type_detected: string | null;
}

const ANALYSIS_PROMPT = `Voce e um engenheiro civil especialista em levantamento de quantitativos para orcamentos de obras.
Analise esta planta baixa (ou imagem arquitetonica) e identifique os elementos construtivos presentes.

Para cada elemento encontrado, retorne um objeto JSON com os seguintes campos:
- element_type: tipo do elemento (use EXATAMENTE um dos valores permitidos abaixo)
- label: identificador do elemento (ex: V1, P-01, PAREDE-SALA, SAPATA-A1)
- room: nome do comodo ou area onde o elemento esta (ou null se nao aplicavel)
- params: objeto com as dimensoes medidas em metros (use as chaves: largura, comprimento, altura, espessura, diametro, quantidade conforme o tipo)
- ia_confidence: numero de 0 a 1 indicando sua confianca na medicao (1 = certeza total, 0 = estimativa)
- ia_reasoning: breve explicacao do que voce identificou e como mediu

Tipos de elementos permitidos:
Fundacoes: sapata, bloco_fundacao, baldrame, radier, estaca
Estrutura: viga, pilar, laje, escada
Vedacao: parede_alvenaria, parede_drywall, muro
Esquadrias: porta, janela
Revestimentos: revestimento_piso, revestimento_parede, revestimento_teto
Cobertura: cobertura, impermeabilizacao
Acabamento: pintura
Pavimentacao: pavimentacao_asfalto, pavimentacao_concreto, pavimentacao_intertravado
Terraplanagem: terraplanagem
Drenagem: drenagem
Instalacoes: instalacao_eletrica, instalacao_hidraulica
Outros: outros

Retorne APENAS um JSON valido com a seguinte estrutura (sem texto antes ou depois):
{
  "elements": [
    {
      "element_type": "parede_alvenaria",
      "label": "PAREDE-01",
      "room": "Sala de Estar",
      "params": { "comprimento": 4.5, "altura": 2.8, "quantidade": 1, "area_deducao": 0 },
      "ia_confidence": 0.9,
      "ia_reasoning": "Parede identificada na lateral da sala de estar com comprimento aproximado de 4.5m e pe-direito de 2.8m"
    }
  ],
  "general_observations": "Planta residencial de 2 quartos com sala integrada. Total estimado de 80m2.",
  "total_area_estimated": 80.0,
  "budget_type_detected": "residencial"
}

Se nao conseguir identificar a imagem como uma planta baixa ou desenho arquitetonico, retorne:
{
  "elements": [],
  "general_observations": "A imagem enviada nao parece ser uma planta baixa ou nao contem informacoes arquitetonicas suficientes para levantamento.",
  "total_area_estimated": null,
  "budget_type_detected": null
}`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { floorplan_id, budget_id, image_base64, image_url, ai_api_key } = body;

    if (!floorplan_id || !budget_id) {
      return new Response(
        JSON.stringify({ error: "floorplan_id e budget_id sao obrigatorios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase
      .from("budget_floorplans")
      .update({ status: "processando", processing_started_at: new Date().toISOString() })
      .eq("id", floorplan_id);

    const openaiKey = ai_api_key || Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      await supabase
        .from("budget_floorplans")
        .update({ status: "erro", error_message: "Chave de API OpenAI nao configurada. Configure OPENAI_API_KEY nas variaveis de ambiente ou envie ai_api_key no corpo da requisicao." })
        .eq("id", floorplan_id);

      return new Response(
        JSON.stringify({ error: "Chave de API OpenAI nao configurada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const imageContent: any = image_base64
      ? { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image_base64}`, detail: "high" } }
      : image_url
      ? { type: "image_url", image_url: { url: image_url, detail: "high" } }
      : null;

    if (!imageContent) {
      await supabase
        .from("budget_floorplans")
        .update({ status: "erro", error_message: "Nenhuma imagem fornecida (image_base64 ou image_url)" })
        .eq("id", floorplan_id);

      return new Response(
        JSON.stringify({ error: "Forneça image_base64 ou image_url" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: ANALYSIS_PROMPT },
              imageContent,
            ],
          },
        ],
      }),
    });

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text();
      await supabase
        .from("budget_floorplans")
        .update({ status: "erro", error_message: `Erro OpenAI: ${openaiResponse.status} - ${errText.slice(0, 300)}` })
        .eq("id", floorplan_id);

      return new Response(
        JSON.stringify({ error: `Erro na API OpenAI: ${openaiResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await openaiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    let analysis: IAAnalysisResult;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { elements: [], general_observations: rawContent, total_area_estimated: null, budget_type_detected: null };
    } catch {
      analysis = { elements: [], general_observations: rawContent, total_area_estimated: null, budget_type_detected: null };
    }

    const suggestions = (analysis.elements || []).map((el) => ({
      budget_id,
      floorplan_id,
      element_type: el.element_type || "outros",
      label: el.label || "Sem identificacao",
      room: el.room || null,
      params: el.params || {},
      ia_confidence: Math.min(1, Math.max(0, el.ia_confidence || 0.5)),
      ia_reasoning: el.ia_reasoning || null,
      status: "pendente",
    }));

    if (suggestions.length > 0) {
      await supabase.from("budget_ia_suggestions").insert(suggestions);
    }

    await supabase
      .from("budget_floorplans")
      .update({
        status: "concluido",
        ia_model: "gpt-4o",
        processing_finished_at: new Date().toISOString(),
        elements_suggested: suggestions.length,
        notes: analysis.general_observations || null,
      })
      .eq("id", floorplan_id);

    return new Response(
      JSON.stringify({
        success: true,
        elements_suggested: suggestions.length,
        general_observations: analysis.general_observations,
        total_area_estimated: analysis.total_area_estimated,
        budget_type_detected: analysis.budget_type_detected,
        suggestions,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
