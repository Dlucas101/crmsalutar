import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { JSZip } from "https://deno.land/x/jszip@0.11.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// ---------- helpers ----------

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

async function loadDocxXml(buffer: ArrayBuffer): Promise<{ zip: JSZip; xml: string }> {
  const zip = new JSZip();
  await zip.loadAsync(buffer);
  const docXml = zip.file("word/document.xml");
  if (!docXml) {
    throw new Error("document.xml não encontrado no DOCX");
  }
  const xml = await docXml.async("string");
  return { zip, xml };
}

function extractMarkers(xml: string): { campos: string[]; secoes: string[] } {
  // Word frequently splits {{field}} across multiple XML tags. Strip tags first.
  const plainText = xml.replace(/<[^>]+>/g, "");

  const fieldRegex = /\{\{([^#/}][^}]*)\}\}/g;
  const sectionRegex = /\{\{#([^}]+)\}\}/g;

  const campos: string[] = [];
  const secoes: string[] = [];
  const seenFields = new Set<string>();
  const seenSections = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = fieldRegex.exec(plainText)) !== null) {
    const field = match[1].trim();
    if (!seenFields.has(field)) {
      seenFields.add(field);
      campos.push(field);
    }
  }

  while ((match = sectionRegex.exec(plainText)) !== null) {
    const section = match[1].trim();
    if (!seenSections.has(section)) {
      seenSections.add(section);
      secoes.push(section);
    }
  }

  return { campos, secoes };
}

function removeConditionalSection(xml: string, section: string): string {
  const openTag = `{{#${section}}}`;
  const closeTag = `{{/${section}}}`;
  const openIdx = xml.indexOf(openTag);
  const closeIdx = xml.indexOf(closeTag);
  if (openIdx !== -1 && closeIdx !== -1 && closeIdx > openIdx) {
    return xml.substring(0, openIdx) + xml.substring(closeIdx + closeTag.length);
  }
  return xml;
}

function keepConditionalSection(xml: string, section: string): string {
  const openTag = `{{#${section}}}`;
  const closeTag = `{{/${section}}}`;
  return xml.split(openTag).join("").split(closeTag).join("");
}

function replacePlaceholder(xml: string, key: string, value: string): string {
  const safeValue = value ?? "";
  // Direct replacement covers placeholders in a single run.
  let result = xml.split(`{{${key}}}`).join(safeValue);

  // Handle Word's XML splitting of placeholders across runs.
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const xmlTagPattern = "(?:<[^>]*>)*";
  const splitPattern = escapedKey.split("").join(xmlTagPattern);
  const regex = new RegExp(
    `\\{${xmlTagPattern}\\{${xmlTagPattern}${splitPattern}${xmlTagPattern}\\}${xmlTagPattern}\\}`,
    "g",
  );
  result = result.replace(regex, safeValue);
  return result;
}

// ---------- handler ----------

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("Não autorizado", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: userError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userError || !user) {
      return errorResponse("Não autorizado", 401);
    }

    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return errorResponse("Corpo da requisição inválido", 400);
    }

    const { action, template_id, file_path, dados, secoes } = payload ?? {};

    if (!action || typeof action !== "string") {
      return errorResponse("Ação obrigatória", 400);
    }

    // ---------- parse: extract fields/sections from uploaded DOCX ----------
    if (action === "parse") {
      if (!file_path || typeof file_path !== "string") {
        return errorResponse("file_path obrigatório", 400);
      }

      const { data: fileData, error: fileError } = await supabase.storage
        .from("contracts")
        .download(file_path);

      if (fileError || !fileData) {
        return errorResponse("Arquivo não encontrado", 404);
      }

      const buffer = await fileData.arrayBuffer();
      const { xml } = await loadDocxXml(buffer);
      const { campos, secoes: secoes_condicionais } = extractMarkers(xml);

      return jsonResponse({ campos, secoes_condicionais });
    }

    // ---------- generate: fill template and return DOCX ----------
    if (action === "generate") {
      if (!template_id || typeof template_id !== "string") {
        return errorResponse("template_id obrigatório", 400);
      }
      if (!dados || typeof dados !== "object") {
        return errorResponse("dados obrigatórios", 400);
      }

      const { data: template, error: tplError } = await supabase
        .from("contract_templates")
        .select("*")
        .eq("id", template_id)
        .single();

      if (tplError || !template) {
        return errorResponse("Modelo não encontrado", 404);
      }

      const { data: fileData, error: fileError } = await supabase.storage
        .from("contracts")
        .download(template.file_path);

      if (fileError || !fileData) {
        return errorResponse("Arquivo do modelo não encontrado", 404);
      }

      const buffer = await fileData.arrayBuffer();
      const { zip } = await loadDocxXml(buffer);
      let xmlContent = await zip.file("word/document.xml")!.async("string");

      // Apply conditional sections.
      const sectionNames: string[] = Array.isArray(template.secoes_condicionais)
        ? template.secoes_condicionais
        : [];
      const sectionFlags: Record<string, boolean> = (secoes ?? {}) as Record<string, boolean>;

      for (const section of sectionNames) {
        const include = sectionFlags[section] ?? false;
        xmlContent = include
          ? keepConditionalSection(xmlContent, section)
          : removeConditionalSection(xmlContent, section);
      }

      // Replace placeholders.
      for (const [key, value] of Object.entries(dados as Record<string, string>)) {
        xmlContent = replacePlaceholder(xmlContent, String(key), String(value ?? ""));
      }

      zip.file("word/document.xml", xmlContent);
      const outputBuffer = await zip.generateAsync({ type: "uint8array" });

      // Persist generated contract.
      const outputPath = `generated/${user.id}/${Date.now()}.docx`;
      const { error: uploadError } = await supabase.storage
        .from("contracts")
        .upload(outputPath, outputBuffer, { contentType: DOCX_CONTENT_TYPE });

      if (uploadError) {
        console.error("Upload error:", uploadError);
      }

      const { error: insertError } = await supabase.from("generated_contracts").insert({
        template_id,
        dados,
        file_path: outputPath,
        generated_by: user.id,
      });

      if (insertError) {
        console.error("Insert error:", insertError);
      }

      return new Response(outputBuffer, {
        headers: {
          ...corsHeaders,
          "Content-Type": DOCX_CONTENT_TYPE,
          "Content-Disposition": `attachment; filename="contrato.docx"`,
        },
      });
    }

    return errorResponse("Ação inválida", 400);
  } catch (error: any) {
    console.error("process-contract error:", error);
    return errorResponse(error?.message || "Erro interno", 500);
  }
});
