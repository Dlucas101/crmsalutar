import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) return json({ error: "Não autorizado" }, 401);

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .single();

    if (roleData?.role !== "admin") {
      return json({ error: "Apenas administradores podem realizar esta ação" }, 403);
    }

    const body = await req.json();
    const { user_id, password, nome, email, action } = body;

    // ===== Action: create_user (admin creates a new member) =====
    if (action === "create_user") {
      if (!email || !password || !nome) {
        return json({ error: "nome, email e senha são obrigatórios" }, 400);
      }
      if (typeof password !== "string" || password.length < 6) {
        return json({ error: "Senha deve ter pelo menos 6 caracteres" }, 400);
      }

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: String(email).trim(),
        password,
        email_confirm: true,
        user_metadata: { nome: String(nome).trim() },
      });

      if (error) {
        const msg = error.message?.toLowerCase().includes("already")
          ? "Email já cadastrado"
          : error.message;
        return json({ error: msg }, 400);
      }

      return json({ success: true, user_id: data.user?.id });
    }

    // All other actions require user_id
    if (!user_id) {
      return json({ error: "user_id é obrigatório" }, 400);
    }

    // Action: get_email
    if (action === "get_email") {
      const { data: { user: targetUser }, error } = await supabaseAdmin.auth.admin.getUserById(user_id);
      if (error || !targetUser) return json({ error: "Usuário não encontrado" }, 404);
      return json({ email: targetUser.email });
    }

    // Update auth fields (password and/or email)
    const authUpdate: Record<string, string> = {};
    if (password) {
      if (password.length < 6) {
        return json({ error: "Senha deve ter pelo menos 6 caracteres" }, 400);
      }
      authUpdate.password = password;
    }
    if (email) authUpdate.email = email;

    if (Object.keys(authUpdate).length > 0) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, authUpdate);
      if (error) return json({ error: error.message }, 400);
    }

    // Update profile name
    if (nome !== undefined) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ nome })
        .eq("id", user_id);
      if (error) return json({ error: error.message }, 400);
    }

    return json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return json({ error: message }, 500);
  }
});
