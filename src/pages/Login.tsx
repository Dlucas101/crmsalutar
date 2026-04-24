import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { Zap, ArrowLeft, MailCheck } from "lucide-react";

type Mode = "login" | "forgot" | "forgot-sent";

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }
    if (password.length < 6) {
      toast.error("Senha deve ter no mínimo 6 caracteres");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      navigate("/");
    } catch (error: any) {
      toast.error(error.message || "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      toast.error("Informe seu e-mail");
      return;
    }

    setLoading(true);
    try {
      // Não revelar se o email existe ou não — sempre seguir adiante
      await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch (err) {
      // Silencioso por segurança (evita enumeração de usuários)
      console.error("[reset-password] erro silencioso:", err);
    } finally {
      setLoading(false);
      setMode("forgot-sent");
    }
  };

  const goToLogin = () => {
    setMode("login");
    setResetEmail("");
  };

  return (
    <div
      className="dark min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(180deg, hsl(225 30% 4%) 0%, hsl(228 40% 8%) 100%)" }}
    >
      <Card className="w-full max-w-md glass-panel border-border">
        <CardHeader className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2 animate-float">
            <Zap className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold neon-glow text-foreground">CRM</h1>
          <p className="text-muted-foreground text-sm">
            {mode === "login" && "Acesse seu CRM"}
            {mode === "forgot" && "Recuperar senha"}
            {mode === "forgot-sent" && "Verifique seu e-mail"}
          </p>
        </CardHeader>
        <CardContent>
          {mode === "login" && (
            <>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    maxLength={255}
                    required
                    className="bg-secondary/50 border-border focus:border-primary focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                    required
                    className="bg-secondary/50 border-border focus:border-primary focus:ring-primary/20"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full gradient-accent text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
                >
                  {loading ? "Carregando..." : "Entrar"}
                </Button>
              </form>
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Esqueceu a senha?
                </button>
              </div>
            </>
          )}

          {mode === "forgot" && (
            <>
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="seu@email.com"
                    maxLength={255}
                    required
                    autoFocus
                    className="bg-secondary/50 border-border focus:border-primary focus:ring-primary/20"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enviaremos instruções para redefinir sua senha.
                  </p>
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full gradient-accent text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
                >
                  {loading ? "Enviando..." : "Enviar"}
                </Button>
              </form>
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={goToLogin}
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Voltar ao login
                </button>
              </div>
            </>
          )}

          {mode === "forgot-sent" && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="rounded-full bg-primary/10 p-4">
                  <MailCheck className="h-8 w-8 text-primary" />
                </div>
              </div>
              <p className="text-sm text-foreground">
                Se o e-mail estiver cadastrado, você receberá instruções para redefinir sua senha.
              </p>
              <Button
                type="button"
                onClick={goToLogin}
                className="w-full gradient-accent text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
              >
                Voltar ao login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
