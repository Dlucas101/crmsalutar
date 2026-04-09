import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function cleanCnpj(raw: string): string {
  return raw.replace(/\D/g, "");
}

function isValidCnpj(cnpj: string): boolean {
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calc = (digits: string, weights: number[]) =>
    digits.split("").reduce((sum, d, i) => sum + parseInt(d) * weights[i], 0);

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let r = calc(cnpj.slice(0, 12), w1) % 11;
  const d1 = r < 2 ? 0 : 11 - r;
  if (parseInt(cnpj[12]) !== d1) return false;

  r = calc(cnpj.slice(0, 13), w2) % 11;
  const d2 = r < 2 ? 0 : 11 - r;
  return parseInt(cnpj[13]) === d2;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data, error } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (error || !data?.claims) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { cnpj: rawCnpj } = await req.json();
    if (!rawCnpj || typeof rawCnpj !== "string") {
      return new Response(JSON.stringify({ error: "CNPJ é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cnpj = cleanCnpj(rawCnpj);
    if (!isValidCnpj(cnpj)) {
      return new Response(JSON.stringify({ error: "CNPJ inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(
      `https://receitaws.com.br/v1/cnpj/${cnpj}`,
      {
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Erro ao consultar ReceitaWS" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const apiData = await response.json();

    if (apiData.status === "ERROR") {
      return new Response(
        JSON.stringify({ error: apiData.message || "CNPJ não encontrado" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const endereco = [
      apiData.logradouro,
      apiData.numero,
      apiData.complemento,
      apiData.bairro,
    ]
      .filter(Boolean)
      .join(", ");

    return new Response(
      JSON.stringify({
        razao_social: apiData.nome || "",
        nome_fantasia: apiData.fantasia || "",
        cnpj: apiData.cnpj || "",
        endereco,
        cidade: apiData.municipio || "",
        uf: apiData.uf || "",
        cep: apiData.cep || "",
        email: apiData.email || "",
        telefone: apiData.telefone || "",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
