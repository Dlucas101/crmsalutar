import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { JSZip } from "https://deno.land/x/jszip@0.11.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function extractTextFromDocx(buffer: ArrayBuffer): Promise<string> {
  const zip = new JSZip();
  await zip.loadAsync(buffer);
  const docXml = zip.file("word/document.xml");
  if (!docXml) {
    throw new Error("document.xml não encontrado no DOCX");
  }
  return await docXml.async("string");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: userError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, template_id, file_path, dados, secoes } = await req.json();

    // Action: parse - extract fields from uploaded DOCX
    if (action === "parse") {
      if (!file_path) {
        return new Response(JSON.stringify({ error: "file_path obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: fileData, error: fileError } = await supabase.storage
        .from("contracts")
        .download(file_path);

      if (fileError || !fileData) {
        return new Response(JSON.stringify({ error: "Arquivo não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const buffer = await fileData.arrayBuffer();
      const xmlText = await extractTextFromDocx(buffer);

      // Word often splits {{field}} across multiple XML tags like:
      // <w:r><w:t>{{</w:t></w:r><w:r><w:t>field</w:t></w:r><w:r><w:t>}}</w:t></w:r>
      // So we strip XML tags first to get plain text, then search for markers
      const plainText = xmlText.replace(/<[^>]+>/g, "");

      const fieldRegex = /\{\{([^#/}][^}]*)\}\}/g;
      const sectionRegex = /\{\{#([^}]+)\}\}/g;

      const campos: string[] = [];
      const secoes_condicionais: string[] = [];
      const seenFields = new Set<string>();
      const seenSections = new Set<string>();

      let match;
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
          secoes_condicionais.push(section);
        }
      }

      return new Response(JSON.stringify({ campos, secoes_condicionais }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: generate - fill template and return DOCX
    if (action === "generate") {
      if (!template_id || !dados) {
        return new Response(JSON.stringify({ error: "template_id e dados obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: template, error: tplError } = await supabase
        .from("contract_templates")
        .select("*")
        .eq("id", template_id)
        .single();

      if (tplError || !template) {
        return new Response(JSON.stringify({ error: "Modelo não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: fileData, error: fileError } = await supabase.storage
        .from("contracts")
        .download(template.file_path);

      if (fileError || !fileData) {
        return new Response(JSON.stringify({ error: "Arquivo do modelo não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const buffer = await fileData.arrayBuffer();
      const zip = new JSZip();
      await zip.loadAsync(buffer);

      const docXmlFile = zip.file("word/document.xml");
      if (!docXmlFile) {
        return new Response(JSON.stringify({ error: "document.xml não encontrado" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let xmlContent = await docXmlFile.async("string");

      const sectionNames: string[] = template.secoes_condicionais || [];

      // Handle conditional sections
      for (const section of sectionNames) {
        const include = secoes?.[section] ?? false;
        const openTag = `{{#${section}}}`;
        const closeTag = `{{/${section}}}`;

        if (!include) {
          // Remove entire section including tags (handling XML-split tags)
          const plainOpen = openTag.replace(/[{}#]/g, (c) => `(?:<[^>]*>)*\\` + c);
          const plainClose = closeTag.replace(/[{}\/]/g, (c) => `(?:<[^>]*>)*\\` + c);
          // Simple approach: find and remove between tags in plain text mapped back
          const openIdx = xmlContent.indexOf(openTag);
          const closeIdx = xmlContent.indexOf(closeTag);
          if (openIdx !== -1 && closeIdx !== -1) {
            xmlContent = xmlContent.substring(0, openIdx) +
              xmlContent.substring(closeIdx + closeTag.length);
          }
        } else {
          xmlContent = xmlContent.split(openTag).join("").split(closeTag).join("");
        }
      }

      // Replace {{field}} placeholders - handle Word XML splitting
      for (const [key, value] of Object.entries(dados as Record<string, string>)) {
        const placeholder = `{{${key}}}`;
        // Direct replacement first
        xmlContent = xmlContent.split(placeholder).join(value || "");

        // Handle XML-split placeholders
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const chars = escapedKey.split("");
        const xmlTagPattern = "(?:<[^>]*>)*";
        const splitPattern = chars.join(xmlTagPattern);
        const regex = new RegExp(
          `\\{${xmlTagPattern}\\{${xmlTagPattern}${splitPattern}${xmlTagPattern}\\}${xmlTagPattern}\\}`,
          "g"
        );
        xmlContent = xmlContent.replace(regex, value || "");
      }

      zip.file("word/document.xml", xmlContent);
      const outputBuffer = await zip.generateAsync({ type: "uint8array" });

      // Save generated contract
      const outputPath = `generated/${user.id}/${Date.now()}.docx`;
      await supabase.storage
        .from("contracts")
        .upload(outputPath, outputBuffer, {
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });

      await supabase.from("generated_contracts").insert({
        template_id,
        dados,
        file_path: outputPath,
        generated_by: user.id,
      });

      return new Response(outputBuffer, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="contrato.docx"`,
        },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
