import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

interface MeetingRow {
  id: string;
  title: string;
  date: string;
  transcript: string;
  status: string;
}

interface ExtractedTopic {
  title: string;
  summary: string;
  order_index: number;
}

interface ExtractedTask {
  description: string;
  responsible_name: string;
  due_date: string | null;
  priority: "low" | "medium" | "high";
  category: string;
  status: "pending";
}

interface AIStructuredOutput {
  summary: string;
  topics: ExtractedTopic[];
  tasks: ExtractedTask[];
}

async function callOpenAI(transcript: string, meetingTitle: string, meetingDate: string): Promise<AIStructuredOutput> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) throw new Error("OPENAI_API_KEY não configurado");

  const systemPrompt = `Você é um assistente especializado em analisar transcrições de reuniões técnicas de engenharia.
Analise a transcrição fornecida e extraia as informações estruturadas no formato JSON especificado.
Responda APENAS com um JSON válido, sem nenhum texto adicional fora do JSON.`;

  const userPrompt = `Analise a seguinte transcrição da reunião intitulada "${meetingTitle}" realizada em ${meetingDate}.

TRANSCRIÇÃO:
${transcript.slice(0, 12000)}

Retorne um JSON com EXATAMENTE esta estrutura:
{
  "summary": "Resumo executivo da reunião em 2-4 frases, destacando os principais pontos discutidos e decisões tomadas",
  "topics": [
    {
      "title": "Título conciso do tópico",
      "summary": "Breve descrição do que foi discutido neste tópico",
      "order_index": 0
    }
  ],
  "tasks": [
    {
      "description": "Descrição clara e acionável da tarefa ou ação definida",
      "responsible_name": "Nome da pessoa responsável ou vazio se não identificado",
      "due_date": "YYYY-MM-DD ou null se não definido",
      "priority": "high | medium | low (baseado na urgência/impacto discutido)",
      "category": "Categoria da tarefa (ex: Documentação, Aprovação, Visita, Orçamento, etc)",
      "status": "pending"
    }
  ]
}

Regras:
- O resumo deve ser em português, profissional e objetivo
- Extraia apenas tópicos que representem assuntos realmente discutidos
- Extraia apenas tarefas ou ações explicitamente mencionadas
- Se não houver tarefas claras, retorne array vazio
- Se não houver tópicos distintos, retorne um único tópico geral
- Mantenha os nomes exatamente como aparecem na transcrição`;

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error("Resposta vazia da OpenAI");

  const parsed: AIStructuredOutput = JSON.parse(content);
  if (!parsed.summary || !Array.isArray(parsed.topics) || !Array.isArray(parsed.tasks)) {
    throw new Error("Estrutura JSON da IA inválida");
  }
  return parsed;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { meeting_id } = body;

    if (!meeting_id) {
      return new Response(
        JSON.stringify({ success: false, error: "meeting_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: meeting, error: fetchError } = await supabase
      .from("meetings")
      .select("id, title, date, transcript, status")
      .eq("id", meeting_id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!meeting) {
      return new Response(
        JSON.stringify({ success: false, error: "Reunião não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const m = meeting as MeetingRow;

    if (!m.transcript || m.transcript.trim().length < 20) {
      return new Response(
        JSON.stringify({ success: false, error: "A transcrição está vazia ou muito curta para processamento" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await supabase
      .from("meetings")
      .update({ status: "processing" })
      .eq("id", meeting_id);

    let structured: AIStructuredOutput;
    try {
      structured = await callOpenAI(m.transcript, m.title, m.date);
    } catch (aiError) {
      await supabase
        .from("meetings")
        .update({ status: "imported" })
        .eq("id", meeting_id);
      throw aiError;
    }

    await supabase.from("meeting_topics").delete().eq("meeting_id", meeting_id);
    await supabase.from("meeting_tasks").delete().eq("meeting_id", meeting_id);

    if (structured.topics.length > 0) {
      const topicsToInsert = structured.topics.map((t, i) => ({
        meeting_id,
        title: t.title || "Tópico sem título",
        summary: t.summary || "",
        order_index: t.order_index ?? i,
      }));
      const { error: topicsError } = await supabase.from("meeting_topics").insert(topicsToInsert);
      if (topicsError) throw topicsError;
    }

    if (structured.tasks.length > 0) {
      const tasksToInsert = structured.tasks.map((t) => ({
        meeting_id,
        description: t.description || "",
        responsible_name: t.responsible_name || "",
        due_date: t.due_date || null,
        priority: ["low", "medium", "high"].includes(t.priority) ? t.priority : "medium",
        category: t.category || "",
        status: "pending",
      }));
      const { error: tasksError } = await supabase.from("meeting_tasks").insert(tasksToInsert);
      if (tasksError) throw tasksError;
    }

    const { error: updateError } = await supabase
      .from("meetings")
      .update({ summary: structured.summary, status: "processed" })
      .eq("id", meeting_id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        message: "Transcrição processada com sucesso",
        topics_count: structured.topics.length,
        tasks_count: structured.tasks.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Erro ao processar reunião:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
