import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Target, Users, FolderKanban, CheckSquare, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Stats {
  leads: number;
  clients: number;
  projects: number;
  tasksOpen: number;
  tasksOverdue: number;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  suporte: "Suporte",
  desenvolvedor: "Desenvolvedor",
  vendas: "Vendas",
};

export default function Dashboard() {
  const { profile, role } = useAuth();
  const [stats, setStats] = useState<Stats>({ leads: 0, clients: 0, projects: 0, tasksOpen: 0, tasksOverdue: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const [leadsRes, clientsRes, projectsRes, tasksRes] = await Promise.all([
        supabase.from("leads").select("*", { count: "exact", head: true }),
        supabase.from("clients").select("*", { count: "exact", head: true }),
        supabase.from("projects").select("*", { count: "exact", head: true }).neq("status", "entregue"),
        supabase.from("tasks").select("*", { count: "exact", head: true }).neq("status", "concluido"),
      ]);

      const { count: overdueCount } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .neq("status", "concluido")
        .lt("due_date", new Date().toISOString());

      setStats({
        leads: leadsRes.count || 0,
        clients: clientsRes.count || 0,
        projects: projectsRes.count || 0,
        tasksOpen: tasksRes.count || 0,
        tasksOverdue: overdueCount || 0,
      });
    };
    fetchStats();
  }, []);

  const cards = [
    { title: "Leads", value: stats.leads, icon: Target, color: "text-neon-cyan" },
    { title: "Clientes", value: stats.clients, icon: Users, color: "text-neon-purple" },
    { title: "Projetos Ativos", value: stats.projects, icon: FolderKanban, color: "text-neon-green" },
    { title: "Tarefas Abertas", value: stats.tasksOpen, icon: CheckSquare, color: "text-neon-orange" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold neon-glow">
          Olá, {profile?.nome || "Usuário"} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {role ? ROLE_LABELS[role] : ""} • Visão geral do CRM
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.title} className="glass-panel neon-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.tasksOverdue > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-foreground">
              <span className="font-semibold">{stats.tasksOverdue} tarefa(s)</span> com prazo vencido.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
