import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { Zap, KeyRound } from "lucide-react";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    // O Supabase processa o token do hash da URL automaticamente e dispara
    // o evento PASSWORD_RECOVERY. Aguardamos esse sinal antes de liberar o form.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setHasRecoverySession(true);
        setChecking(false);
      }
    });

    // Fallback: se já houver uma sessão (link válido) consideramos pronto.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setHasRecoverySession(true);
      }
      setChecking(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha redefinida com sucesso!");
      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Erro ao redefinir senha");
    } finally {
      setLoading(false);
    }
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
          <h1 className="text-2xl font-bold neon-glow text-foreground">Redefinir senha</h1>
          <p className="text-muted-foreground text-sm">Crie uma nova senha para sua conta</p>
        </CardHeader>
        <CardContent>
          {checking ? (
            <div className="text-center text-sm text-muted-foreground py-6">
              Validando link de recuperação...
            </div>
          ) : !hasRecoverySession ? (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <div className="rounded-full bg-destructive/10 p-4">
                  <KeyRound className="h-8 w-8 text-destructive" />
                </div>
              </div>
              <p className="text-sm text-foreground">
                Link inválido ou expirado. Solicite um novo e-mail de recuperação.
              </p>
              <Button
                type="button"
                onClick={() => navigate("/login", { replace: true })}
                className="w-full gradient-accent text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
              >
                Voltar ao login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nova senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  required
                  autoFocus
                  className="bg-secondary/50 border-border focus:border-primary focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
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
                {loading ? "Salvando..." : "Redefinir senha"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
