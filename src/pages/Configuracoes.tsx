import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Settings, Trophy, DollarSign, Zap, Cog } from "lucide-react";
import { MetasPremiacaoTab } from "@/components/configuracoes/MetasPremiacaoTab";

export default function Configuracoes() {
  const { role, loading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = role === "admin" || role === "gestor";

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  const tab = searchParams.get("tab") || "metas-premiacao";
  const setTab = (v: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", v);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold neon-glow">Configurações</h1>
          <p className="text-muted-foreground text-sm mt-1">Regras e parâmetros do sistema</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="metas-premiacao" className="gap-2">
            <Trophy className="h-4 w-4" /> Metas & Premiação
          </TabsTrigger>
          <TabsTrigger value="comissao" className="gap-2">
            <DollarSign className="h-4 w-4" /> Comissão
          </TabsTrigger>
          <TabsTrigger value="automacoes" className="gap-2">
            <Zap className="h-4 w-4" /> Automações
          </TabsTrigger>
          <TabsTrigger value="geral" className="gap-2">
            <Cog className="h-4 w-4" /> Geral
          </TabsTrigger>
        </TabsList>

        <TabsContent value="metas-premiacao" className="mt-4">
          <MetasPremiacaoTab isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="comissao" className="mt-4">
          <Card className="glass-panel">
            <CardContent className="p-8 text-center text-muted-foreground">
              <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Em breve</p>
              <p className="text-sm mt-1">Configuração de custo de mensalidade e divisão técnico/empresa.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automacoes" className="mt-4">
          <Card className="glass-panel">
            <CardContent className="p-8 text-center text-muted-foreground">
              <Zap className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Em breve</p>
              <p className="text-sm mt-1">Regras de criação automática de tarefas por status de lead.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="geral" className="mt-4">
          <Card className="glass-panel">
            <CardContent className="p-8 text-center text-muted-foreground">
              <Cog className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Em breve</p>
              <p className="text-sm mt-1">Preferências gerais do sistema.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
