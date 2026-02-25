import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Target, Users, CalendarDays, CheckSquare, AlertTriangle, TrendingUp, Clock, BarChart3 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Stats {
  leads: number;
  clients: number;
  visitsScheduled: number;
  tasksOpen: number;
  tasksOverdue: number;
  leadsThisMonth: number;
  leadsWon: number;
  leadsLost: number;
  tasksDone: number;
  visitsDone: number;
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
  const [stats, setStats] = useState<Stats>({
    leads: 0, clients: 0, visitsScheduled: 0, tasksOpen: 0, tasksOverdue: 0,
    leadsThisMonth: 0, leadsWon: 0, leadsLost: 0, tasksDone: 0, visitsDone: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [leadsRes, clientsRes, visitsScheduledRes, tasksOpenRes, leadsMonthRes, leadsWonRes, leadsLostRes, tasksDoneRes, visitsDoneRes] = await Promise.all([
        supabase.from("leads").select("*", { count: "exact", head: true }),
        supabase.from("clients").select("*", { count: "exact", head: true }),
        supabase.from("visits").select("*", { count: "exact", head: true }).eq("status", "agendado"),
        supabase.from("tasks").select("*", { count: "exact", head: true }).neq("status", "concluido"),
        supabase.from("leads").select("*", { count: "exact", head: true }).gte("created_at", startOfMonth),
        supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "fechado_ganho"),
        supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "perdido"),
        supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "concluido"),
        supabase.from("visits").select("*", { count: "exact", head: true }).eq("status", "concluido"),
      ]);

      const { count: overdueCount } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .neq("status", "concluido")
        .lt("due_date", now.toISOString());

      setStats({
        leads: leadsRes.count || 0,
        clients: clientsRes.count || 0,
        visitsScheduled: visitsScheduledRes.count || 0,
        tasksOpen: tasksOpenRes.count || 0,
        tasksOverdue: overdueCount || 0,
        leadsThisMonth: leadsMonthRes.count || 0,
        leadsWon: leadsWonRes.count || 0,
        leadsLost: leadsLostRes.count || 0,
        tasksDone: tasksDoneRes.count || 0,
        visitsDone: visitsDoneRes.count || 0,
      });
    };
    fetchStats();

    // Refresh every 30s for real-time feel
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const conversionRate = stats.leads > 0 ? ((stats.leadsWon / stats.leads) * 100).toFixed(1) : "0";
  const taskCompletionRate = (stats.tasksOpen + stats.tasksDone) > 0
    ? ((stats.tasksDone / (stats.tasksOpen + stats.tasksDone)) * 100).toFixed(1) : "0";

  const mainCards = [
    { title: "Total de Leads", value: stats.leads, icon: Target, color: "text-cyan-400" },
    { title: "Clientes", value: stats.clients, icon: Users, color: "text-purple-400" },
    { title: "Visitas Agendadas", value: stats.visitsScheduled, icon: CalendarDays, color: "text-green-400" },
    { title: "Tarefas Abertas", value: stats.tasksOpen, icon: CheckSquare, color: "text-orange-400" },
  ];

  const secondaryCards = [
    { title: "Leads este mês", value: stats.leadsThisMonth, icon: TrendingUp, color: "text-cyan-400" },
    { title: "Leads Ganhos", value: stats.leadsWon, icon: Target, color: "text-green-400" },
    { title: "Leads Perdidos", value: stats.leadsLost, icon: Target, color: "text-destructive" },
    { title: "Tarefas Concluídas", value: stats.tasksDone, icon: CheckSquare, color: "text-green-400" },
    { title: "Visitas Concluídas", value: stats.visitsDone, icon: CalendarDays, color: "text-green-400" },
    { title: "Taxa de Conversão", value: `${conversionRate}%`, icon: BarChart3, color: "text-primary" },
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
        {mainCards.map((card) => (
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

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {secondaryCards.map((card) => (
          <Card key={card.title} className="glass-panel neon-border">
            <CardContent className="p-4 text-center space-y-1">
              <card.icon className={`h-4 w-4 mx-auto ${card.color}`} />
              <p className="text-xl font-bold text-foreground">{card.value}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{card.title}</p>
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
