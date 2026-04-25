import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { JSZip } from "https://deno.land/x/jszip@0.11.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const PDF_BUCKET = "contratos-gerados";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

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
  let result = xml.split(`{{${key}}}`).join(safeValue);
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

// Apply sections + placeholders, returning the final document XML.
function fillTemplate(
  xml: string,
  dados: Record<string, string>,
  sectionFlags: Record<string, boolean>,
  sectionNames: string[],
): string {
  let out = xml;
  for (const section of sectionNames) {
    const include = sectionFlags[section] ?? false;
    out = include
      ? keepConditionalSection(out, section)
      : removeConditionalSection(out, section);
  }
  for (const [key, value] of Object.entries(dados)) {
    out = replacePlaceholder(out, String(key), String(value ?? ""));
  }
  return out;
}

// Convert filled document.xml to a structured plain-text representation,
// preserving paragraphs and rough alignment.
function docxXmlToText(xml: string): { paragraphs: { align: string; text: string }[] } {
  const paragraphs: { align: string; text: string }[] = [];
  // Match each w:p block
  const paragraphRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let pMatch: RegExpExecArray | null;
  while ((pMatch = paragraphRegex.exec(xml)) !== null) {
    const inner = pMatch[1];
    // Detect alignment
    const alignMatch = inner.match(/<w:jc\s+w:val="([^"]+)"/);
    const align = alignMatch ? alignMatch[1] : "left";
    // Extract text from <w:t> tags (including preserve-space variant)
    const textRegex = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
    let text = "";
    let tMatch: RegExpExecArray | null;
    while ((tMatch = textRegex.exec(inner)) !== null) {
      text += tMatch[1];
    }
    // Decode XML entities
    text = text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
    paragraphs.push({ align, text });
  }
  return { paragraphs };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildHtml(
  paragraphs: { align: string; text: string }[],
  title: string,
): string {
  const alignMap: Record<string, string> = {
    left: "left",
    right: "right",
    center: "center",
    both: "justify",
    justify: "justify",
    start: "left",
    end: "right",
  };
  const body = paragraphs
    .map((p) => {
      const align = alignMap[p.align] || "left";
      const text = p.text.trim();
      if (!text) return `<p class="empty">&nbsp;</p>`;
      return `<p style="text-align:${align}">${escapeHtml(text)}</p>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 2.5cm 2cm; }
  * { box-sizing: border-box; }
  html, body {
    font-family: "Times New Roman", Times, serif;
    font-size: 12pt;
    line-height: 1.55;
    color: #000;
    background: #fff;
    margin: 0;
    padding: 0;
  }
  p { margin: 0 0 10px 0; text-align: justify; }
  p.empty { margin: 0 0 6px 0; min-height: 1em; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

async function htmlToPdfViaBrowserless(html: string): Promise<Uint8Array> {
  const apiKey = Deno.env.get("BROWSERLESS_API_KEY");
  if (!apiKey) {
    throw new Error("BROWSERLESS_API_KEY não configurada");
  }
  const url = `https://production-sfo.browserless.io/pdf?token=${apiKey}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html,
      options: {
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "2.5cm", bottom: "2.5cm", left: "2cm", right: "2cm" },
      },
      gotoOptions: { waitUntil: "networkidle0" },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Browserless falhou [${resp.status}]: ${errText.slice(0, 300)}`);
  }
  const ab = await resp.arrayBuffer();
  return new Uint8Array(ab);
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

    // ---------- parse ----------
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

    // Shared loader for generate / generate-pdf
    async function loadFilledDocx(): Promise<{
      template: any;
      filledXml: string;
      zip: JSZip;
    }> {
      if (!template_id || typeof template_id !== "string") {
        throw new Error("template_id obrigatório");
      }
      if (!dados || typeof dados !== "object") {
        throw new Error("dados obrigatórios");
      }
      const { data: template, error: tplError } = await supabase
        .from("contract_templates")
        .select("*")
        .eq("id", template_id)
        .single();
      if (tplError || !template) {
        throw new Error("Modelo não encontrado");
      }
      const { data: fileData, error: fileError } = await supabase.storage
        .from("contracts")
        .download(template.file_path);
      if (fileError || !fileData) {
        throw new Error("Arquivo do modelo não encontrado");
      }
      const buffer = await fileData.arrayBuffer();
      const { zip } = await loadDocxXml(buffer);
      const xmlContent = await zip.file("word/document.xml")!.async("string");
      const sectionNames: string[] = Array.isArray(template.secoes_condicionais)
        ? template.secoes_condicionais
        : [];
      const sectionFlags: Record<string, boolean> = (secoes ?? {}) as Record<string, boolean>;
      const filledXml = fillTemplate(
        xmlContent,
        dados as Record<string, string>,
        sectionFlags,
        sectionNames,
      );
      return { template, filledXml, zip };
    }

    // ---------- generate (DOCX) ----------
    if (action === "generate") {
      const { template, filledXml, zip } = await loadFilledDocx();
      (zip as any).file("word/document.xml", filledXml);
      const outputBuffer = await zip.generateAsync({ type: "uint8array" });

      const outputPath = `generated/${user.id}/${Date.now()}.docx`;
      const { error: uploadError } = await supabase.storage
        .from("contracts")
        .upload(outputPath, outputBuffer, { contentType: DOCX_CONTENT_TYPE });
      if (uploadError) console.error("Upload error:", uploadError);

      const { error: insertError } = await supabase.from("generated_contracts").insert({
        template_id: template.id,
        dados,
        file_path: outputPath,
        generated_by: user.id,
      });
      if (insertError) console.error("Insert error:", insertError);

      return new Response(outputBuffer as BlobPart as any, {
        headers: {
          ...corsHeaders,
          "Content-Type": DOCX_CONTENT_TYPE,
          "Content-Disposition": `attachment; filename="contrato.docx"`,
        },
      });
    }

    // ---------- generate-pdf ----------
    if (action === "generate-pdf") {
      const { template, filledXml } = await loadFilledDocx();

      // Convert filled XML -> structured text -> HTML -> PDF
      const { paragraphs } = docxXmlToText(filledXml);
      if (paragraphs.length === 0) {
        return errorResponse("Não foi possível extrair conteúdo do modelo", 500);
      }
      const html = buildHtml(paragraphs, template.nome || "Contrato");
      const pdfBytes = await htmlToPdfViaBrowserless(html);

      const outputPath = `contratos/${user.id}/${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from(PDF_BUCKET)
        .upload(outputPath, pdfBytes, {
          contentType: "application/pdf",
          upsert: false,
        });
      if (uploadError) {
        console.error("PDF upload error:", uploadError);
        return errorResponse(`Falha ao salvar PDF: ${uploadError.message}`, 500);
      }

      const { data: signed, error: signError } = await supabase.storage
        .from(PDF_BUCKET)
        .createSignedUrl(outputPath, SIGNED_URL_TTL_SECONDS);
      if (signError || !signed?.signedUrl) {
        console.error("Signed URL error:", signError);
        return errorResponse("Falha ao gerar URL do PDF", 500);
      }

      // Persist history (file_path stored for re-signing later if needed)
      const { error: insertError } = await supabase.from("generated_contracts").insert({
        template_id: template.id,
        dados,
        file_path: outputPath,
        generated_by: user.id,
      });
      if (insertError) console.error("Insert error:", insertError);

      return jsonResponse({
        url: signed.signedUrl,
        file_path: outputPath,
        expires_in: SIGNED_URL_TTL_SECONDS,
      });
    }

    // ---------- sign-url (re-sign existing PDF for history downloads) ----------
    if (action === "sign-url") {
      if (!file_path || typeof file_path !== "string") {
        return errorResponse("file_path obrigatório", 400);
      }
      const { data: signed, error: signError } = await supabase.storage
        .from(PDF_BUCKET)
        .createSignedUrl(file_path, SIGNED_URL_TTL_SECONDS);
      if (signError || !signed?.signedUrl) {
        return errorResponse("Falha ao gerar URL", 500);
      }
      return jsonResponse({ url: signed.signedUrl, expires_in: SIGNED_URL_TTL_SECONDS });
    }

    return errorResponse("Ação inválida", 400);
  } catch (error: any) {
    console.error("process-contract error:", error);
    return errorResponse(error?.message || "Erro interno", 500);
  }
});
