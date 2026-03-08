import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.93.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TIMEOUT_MS = 120000; // 2 minutos timeout
const MAX_RETRIES = 3;

interface JobData {
  id: string;
  project_id: string;
  template_id: string;
  briefing: string;
  intake_answers: any;
  template: {
    name: string;
    document_type: string;
    ia_doc_type: string;
    ia_sections: any[];
    ia_style_guide: string;
    ia_rules: string[];
  };
  project: {
    name: string;
    property_type: string;
    property_name: string;
    start_date: string;
    estimated_completion_date: string | null;
    customer_name: string;
  };
  files: Array<{
    id: string;
    storage_path: string;
    file_name: string;
    mime_type: string;
  }>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const startTime = Date.now();
  let jobId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    jobId = body.job_id;

    if (!jobId) {
      throw new Error("job_id é obrigatório");
    }

    console.log(`[${jobId}] ========== INICIANDO PROCESSAMENTO ==========`);
    console.log(`[${jobId}] Timestamp: ${new Date().toISOString()}`);

    // 1. Validar e atualizar status para processing
    const { data: existingJob, error: jobCheckError } = await supabase
      .from("project_ia_jobs")
      .select("id, status, project_id, template_id, briefing")
      .eq("id", jobId)
      .single();

    if (jobCheckError) {
      throw new Error(`Job não encontrado: ${jobCheckError.message}`);
    }

    if (!existingJob.project_id || !existingJob.template_id || !existingJob.briefing) {
      throw new Error("Job com dados incompletos: faltam project_id, template_id ou briefing");
    }

    console.log(`[${jobId}] Job validado - Status atual: ${existingJob.status}`);

    // 2. Atualizar para processing
    const { error: updateError } = await supabase
      .from("project_ia_jobs")
      .update({
        status: "processing",
        progress_stage: "loading_data",
        progress_percent: 5,
        started_at: new Date().toISOString(),
        current_section: "Carregando dados do projeto...",
        timeout_at: new Date(Date.now() + TIMEOUT_MS).toISOString(),
      })
      .eq("id", jobId);

    if (updateError) {
      throw new Error(`Erro ao atualizar status: ${updateError.message}`);
    }

    console.log(`[${jobId}] Status atualizado para 'processing'`);

    // 3. Carregar dados completos (com timeout)
    const jobData = await Promise.race([
      loadJobData(supabase, jobId),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout ao carregar dados")), 30000)
      ),
    ]);

    console.log(`[${jobId}] Dados carregados com sucesso`);
    console.log(`[${jobId}] Template: ${jobData.template.name} (${jobData.template.ia_sections.length} seções)`);
    console.log(`[${jobId}] Projeto: ${jobData.project.name}`);

    // 4. Atualizar progresso
    await supabase
      .from("project_ia_jobs")
      .update({
        progress_percent: 15,
        progress_stage: "generating_document",
        current_section: "Gerando estrutura do documento...",
      })
      .eq("id", jobId);

    // 5. Gerar documento (com timeout)
    const document = await Promise.race([
      generateDocument(supabase, jobData),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout ao gerar documento")), 90000)
      ),
    ]);

    console.log(`[${jobId}] Documento gerado - ${document.markdown.length} chars`);

    // 6. Atualizar progresso
    await supabase
      .from("project_ia_jobs")
      .update({
        progress_percent: 90,
        current_section: "Salvando documento...",
      })
      .eq("id", jobId);

    // 7. Obter próxima versão
    const { data: maxVersionData } = await supabase
      .from("project_ia_outputs")
      .select("version")
      .eq("job_id", jobId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = maxVersionData ? maxVersionData.version + 1 : 1;

    // 8. Salvar output
    const { error: outputError } = await supabase
      .from("project_ia_outputs")
      .insert({
        job_id: jobId,
        version: nextVersion,
        output_markdown: document.markdown,
        executive_summary: document.executive_summary,
        pending_items: document.pending_items,
        word_count: countWords(document.markdown),
        section_count: jobData.template.ia_sections.length,
        placeholders_count: document.pending_items.length,
      });

    if (outputError) {
      throw new Error(`Erro ao salvar output: ${outputError.message}`);
    }

    console.log(`[${jobId}] Output salvo - versão ${nextVersion}`);

    // 9. Calcular tempo de processamento
    const processingTimeSeconds = Math.round((Date.now() - startTime) / 1000);

    // 10. Atualizar job para completed
    await supabase
      .from("project_ia_jobs")
      .update({
        status: "completed",
        progress_stage: "done",
        progress_percent: 100,
        completed_at: new Date().toISOString(),
        current_section: null,
        processing_time_seconds: processingTimeSeconds,
        timeout_at: null,
      })
      .eq("id", jobId);

    console.log(`[${jobId}] ========== PROCESSAMENTO CONCLUÍDO ==========`);
    console.log(`[${jobId}] Tempo total: ${processingTimeSeconds}s`);
    console.log(`[${jobId}] Palavras: ${countWords(document.markdown)}`);
    console.log(`[${jobId}] Placeholders: ${document.pending_items.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        job_id: jobId,
        version: nextVersion,
        word_count: countWords(document.markdown),
        pending_items_count: document.pending_items.length,
        processing_time_seconds: processingTimeSeconds,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    const processingTimeSeconds = Math.round((Date.now() - startTime) / 1000);
    const errorStage = error.message.includes("carregar dados") ? "loading_data" : "generating_document";

    console.error(`[${jobId || "unknown"}] ========== ERRO NO PROCESSAMENTO ==========`);
    console.error(`[${jobId || "unknown"}] Erro: ${error.message}`);
    console.error(`[${jobId || "unknown"}] Stack: ${error.stack}`);
    console.error(`[${jobId || "unknown"}] Tempo até erro: ${processingTimeSeconds}s`);

    // Tentar atualizar job para failed
    if (jobId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        await supabase
          .from("project_ia_jobs")
          .update({
            status: "failed",
            progress_stage: "error",
            progress_percent: 0,
            error_message: error.message || "Erro desconhecido ao processar documento",
            error_details: {
              stage: errorStage,
              timestamp: new Date().toISOString(),
              processing_time_seconds: processingTimeSeconds,
              error_type: error.name || "Error",
              stack: error.stack?.substring(0, 500), // Limitar tamanho do stack
            },
            completed_at: new Date().toISOString(),
            processing_time_seconds: processingTimeSeconds,
            timeout_at: null,
          })
          .eq("id", jobId);

        console.log(`[${jobId}] Status atualizado para 'failed'`);
      } catch (updateError: any) {
        console.error(`[${jobId}] ERRO CRÍTICO ao atualizar status: ${updateError.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Erro ao processar documento",
        job_id: jobId,
        stage: errorStage,
        processing_time_seconds: processingTimeSeconds,
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

async function loadJobData(supabase: any, jobId: string): Promise<JobData> {
  console.log(`[${jobId}] Carregando job...`);

  // Carregar job
  const { data: job, error: jobError } = await supabase
    .from("project_ia_jobs")
    .select(`
      id,
      project_id,
      template_id,
      briefing,
      intake_answers
    `)
    .eq("id", jobId)
    .single();

  if (jobError) throw new Error(`Erro ao carregar job: ${jobError.message}`);
  if (!job) throw new Error("Job não encontrado");

  console.log(`[${jobId}] Job carregado - Carregando template...`);

  // Carregar template
  const { data: template, error: templateError } = await supabase
    .from("ai_document_templates")
    .select("*")
    .eq("id", job.template_id)
    .single();

  if (templateError) throw new Error(`Erro ao carregar template: ${templateError.message}`);
  if (!template) throw new Error("Template não encontrado");

  console.log(`[${jobId}] Template carregado - Carregando projeto...`);

  // Carregar projeto com cliente
  const { data: project, error: projectError } = await supabase
    .from("engineering_projects")
    .select(`
      name,
      property_type,
      start_date,
      estimated_completion_date,
      properties!inner(name),
      customers!inner(name)
    `)
    .eq("id", job.project_id)
    .single();

  if (projectError) throw new Error(`Erro ao carregar projeto: ${projectError.message}`);
  if (!project) throw new Error("Projeto não encontrado");

  console.log(`[${jobId}] Projeto carregado - Carregando dados pré-preenchidos...`);

  // Carregar dados pré-preenchidos para PRAD
  const { data: prefilledData } = await supabase
    .from("prad_prefilled_data")
    .select("*")
    .eq("project_id", job.project_id)
    .single();

  console.log(`[${jobId}] Dados pré-preenchidos carregados - Carregando arquivos...`);

  // Carregar arquivos com classificação
  const { data: files, error: filesError } = await supabase
    .from("project_ia_job_files")
    .select("id, storage_path, file_name, mime_type, file_type, coordinates, order_index, description")
    .eq("job_id", jobId)
    .order("order_index");

  if (filesError) throw new Error(`Erro ao carregar arquivos: ${filesError.message}`);

  console.log(`[${jobId}] ${files?.length || 0} arquivo(s) carregado(s)`);

  // Aplicar inferências automáticas do briefing
  let enrichedAnswers = job.intake_answers || {};

  if (prefilledData && template.document_type === 'prad') {
    console.log(`[${jobId}] Aplicando pré-preenchimento inteligente para PRAD`);

    enrichedAnswers = {
      ...enrichedAnswers,
      // Dados do empreendedor (do cliente)
      empreendedor_nome: enrichedAnswers.empreendedor_nome || prefilledData.customer_name,
      empreendedor_cpf_cnpj: enrichedAnswers.empreendedor_cpf_cnpj || prefilledData.customer_document,
      localizacao_imovel: enrichedAnswers.localizacao_imovel ||
        `${prefilledData.property_name}, ${prefilledData.property_municipality}, ${prefilledData.property_state}`,

      // Responsável técnico (da configuração da empresa)
      responsavel_tecnico: enrichedAnswers.responsavel_tecnico ||
        prefilledData.default_technical_responsible?.name,
      registro_profissional: enrichedAnswers.registro_profissional ||
        prefilledData.default_technical_responsible?.registration,

      // Dados do imóvel
      matricula_imovel: enrichedAnswers.matricula_imovel || prefilledData.registration_number,
      ccir: enrichedAnswers.ccir || prefilledData.ccir,
      car: enrichedAnswers.car || prefilledData.car_receipt_code,

      // Inferências automáticas do briefing
      tipo_degradacao: enrichedAnswers.tipo_degradacao ||
        await inferFromBriefing(supabase, 'infer_degradation_type_from_briefing', job.briefing),
      causas_degradacao: enrichedAnswers.causas_degradacao ||
        await inferFromBriefing(supabase, 'infer_degradation_causes_from_briefing', job.briefing),
      situacao_legal: enrichedAnswers.situacao_legal ||
        await inferFromBriefing(supabase, 'infer_legal_situation_from_briefing', job.briefing),

      // Bioma inferido automaticamente do município
      bioma: enrichedAnswers.bioma || prefilledData.bioma,
      estado: enrichedAnswers.estado || prefilledData.state_with_legislation,
    };
  }

  return {
    id: job.id,
    project_id: job.project_id,
    template_id: job.template_id,
    briefing: job.briefing,
    intake_answers: enrichedAnswers,
    template: {
      name: template.name,
      document_type: template.document_type,
      ia_doc_type: template.ia_doc_type,
      ia_sections: template.ia_sections || [],
      ia_style_guide: template.ia_style_guide || "",
      ia_rules: template.ia_rules || [],
    },
    project: {
      name: project.name,
      property_type: project.property_type,
      property_name: project.properties.name,
      start_date: project.start_date,
      estimated_completion_date: project.estimated_completion_date,
      customer_name: project.customers.name,
    },
    files: files || [],
    prefilled_data: prefilledData,
  };
}

async function inferFromBriefing(supabase: any, functionName: string, briefing: string): Promise<string> {
  try {
    const { data, error } = await supabase.rpc(functionName, { briefing });
    if (error) {
      console.error(`Erro ao inferir usando ${functionName}:`, error);
      return '';
    }
    return data || '';
  } catch (err) {
    console.error(`Exceção ao inferir usando ${functionName}:`, err);
    return '';
  }
}

async function generateDocument(
  supabase: any,
  jobData: JobData
): Promise<{
  markdown: string;
  executive_summary: string;
  pending_items: Array<{ section: string; item: string; description: string }>;
}> {
  const pendingItems: Array<{ section: string; item: string; description: string }> = [];
  const sections: string[] = [];

  console.log(`[${jobData.id}] Gerando documento - ${jobData.template.ia_sections.length} seções`);

  // Header do documento
  sections.push(`# ${jobData.template.name}\n`);
  sections.push(`**Projeto:** ${jobData.project.name}`);
  sections.push(`**Cliente:** ${jobData.project.customer_name}`);
  sections.push(`**Imóvel:** ${jobData.project.property_name}`);
  sections.push(`**Tipo:** ${jobData.project.property_type === "rural" ? "Rural" : "Urbano"}`);
  sections.push(`**Data:** ${new Date().toLocaleDateString("pt-BR")}\n`);
  sections.push("---\n");

  // Gerar cada seção conforme template
  const totalSections = jobData.template.ia_sections.length;

  for (let i = 0; i < totalSections; i++) {
    const section = jobData.template.ia_sections[i];

    // Atualizar progresso (15% inicial + 75% das seções)
    const progress = 15 + Math.floor((i / totalSections) * 75);

    console.log(`[${jobData.id}] Gerando seção ${i + 1}/${totalSections}: ${section.title} (${progress}%)`);

    await supabase
      .from("project_ia_jobs")
      .update({
        progress_percent: progress,
        current_section: `Seção ${i + 1}/${totalSections}: ${section.title}`,
      })
      .eq("id", jobData.id);

    sections.push(`## ${section.order}. ${section.title}\n`);

    if (section.description) {
      sections.push(`*${section.description}*\n`);
    }

    // Gerar conteúdo da seção
    const content = generateSectionContent(section, jobData, pendingItems);
    sections.push(content);
    sections.push("\n");
  }

  // Anexos
  if (jobData.files.length > 0) {
    sections.push("## Anexos\n");
    sections.push("Os seguintes documentos foram anexados a este projeto:\n");
    jobData.files.forEach((file, idx) => {
      sections.push(`${idx + 1}. ${file.file_name}`);
    });
    sections.push("\n");
  }

  // Gerar resumo executivo
  const executive_summary = generateExecutiveSummary(jobData, pendingItems);

  console.log(`[${jobData.id}] Documento gerado - ${pendingItems.length} placeholders`);

  return {
    markdown: sections.join("\n"),
    executive_summary,
    pending_items: pendingItems,
  };
}

function generateSectionContent(
  section: any,
  jobData: JobData,
  pendingItems: Array<{ section: string; item: string; description: string }>
): string {
  const content: string[] = [];

  // Regras da seção
  if (section.content_rules && section.content_rules.length > 0) {
    content.push("**Requisitos desta seção:**\n");
    section.content_rules.forEach((rule: string) => {
      content.push(`- ${rule}`);
    });
    content.push("\n");
  }

  // Placeholders baseados no tipo
  if (section.placeholder_fields && section.placeholder_fields.length > 0) {
    section.placeholder_fields.forEach((field: any) => {
      const hasData = checkFieldData(field, jobData);

      if (!hasData) {
        content.push(`**${field.label}:** [A COMPLETAR]\n`);
        pendingItems.push({
          section: section.title,
          item: field.label,
          description: field.help_text || "Dado não fornecido",
        });
      } else {
        const value = getFieldValue(field, jobData);
        content.push(`**${field.label}:** ${value}\n`);
      }
    });
  }

  // Conteúdo baseado no briefing
  if (section.mandatory) {
    content.push("\n### Análise\n");
    content.push(
      `Com base no briefing fornecido: "${jobData.briefing.substring(0, 100)}${
        jobData.briefing.length > 100 ? "..." : ""
      }"\n`
    );
    content.push(
      "**[A COMPLETAR]** - Análise técnica detalhada necessária para esta seção.\n"
    );

    pendingItems.push({
      section: section.title,
      item: "Análise Técnica",
      description:
        "Necessário completar análise técnica detalhada com dados de campo, medições ou documentação específica.",
    });
  }

  // Intake answers relevantes
  if (Object.keys(jobData.intake_answers).length > 0) {
    content.push("\n### Informações Fornecidas\n");
    Object.entries(jobData.intake_answers).forEach(([key, value]) => {
      if (value && value !== "") {
        const displayValue =
          typeof value === "boolean" ? (value ? "Sim" : "Não") : value;
        content.push(`- **${key}:** ${displayValue}`);
      }
    });
    content.push("\n");
  }

  return content.join("\n");
}

function checkFieldData(field: any, jobData: JobData): boolean {
  if (field.field_key && jobData.intake_answers[field.field_key]) {
    return true;
  }

  const projectFields = [
    "property_name",
    "customer_name",
    "start_date",
    "property_type",
  ];

  if (projectFields.includes(field.field_key)) {
    return true;
  }

  return false;
}

function getFieldValue(field: any, jobData: JobData): string {
  if (field.field_key && jobData.intake_answers[field.field_key]) {
    const value = jobData.intake_answers[field.field_key];
    return typeof value === "boolean" ? (value ? "Sim" : "Não") : String(value);
  }

  const projectData: any = jobData.project;
  if (field.field_key && projectData[field.field_key]) {
    return String(projectData[field.field_key]);
  }

  return "[A COMPLETAR]";
}

function generateExecutiveSummary(
  jobData: JobData,
  pendingItems: Array<{ section: string; item: string; description: string }>
): string {
  const summary: string[] = [];

  summary.push(
    `Documento ${jobData.template.document_type} gerado para o projeto "${jobData.project.name}", ` +
      `localizado em ${jobData.project.property_name}.`
  );

  summary.push(
    `O documento foi estruturado em ${jobData.template.ia_sections.length} seções principais, ` +
      `seguindo as diretrizes do template "${jobData.template.name}".`
  );

  if (pendingItems.length > 0) {
    summary.push(
      `ATENÇÃO: Existem ${pendingItems.length} item(ns) pendente(s) que necessitam complementação ` +
        `com dados técnicos, medições de campo ou documentação adicional.`
    );
  } else {
    summary.push(
      "Todas as seções foram preenchidas com as informações disponíveis."
    );
  }

  if (jobData.files.length > 0) {
    summary.push(
      `Foram anexados ${jobData.files.length} arquivo(s) de referência ao projeto.`
    );
  }

  summary.push(
    "Este documento foi gerado automaticamente e deve ser revisado por profissional habilitado antes da entrega final."
  );

  return summary.join(" ");
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).length;
}
