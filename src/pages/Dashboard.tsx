import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Target, Users, CalendarDays, CheckSquare, AlertTriangle, TrendingUp, BarChart3, Trophy } from "lucide-react";
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

interface MetaInfo {
  quantidadeMeta: number;
  fechadosMes: number;
  faltam: number;
  percentual: number;
  atingida: boolean;
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
  const [meta, setMeta] = useState<MetaInfo | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

      const [leadsRes, clientsRes, visitsScheduledRes, tasksOpenRes, leadsMonthRes, leadsWonRes, leadsLostRes, tasksDoneRes, visitsDoneRes, metaRes, leadsWonMonthRes] = await Promise.all([
        supabase.from("leads").select("*", { count: "exact", head: true }),
        supabase.from("clients").select("*", { count: "exact", head: true }),
        supabase.from("visits").select("*", { count: "exact", head: true }).eq("status", "agendado"),
        supabase.from("tasks").select("*", { count: "exact", head: true }).neq("status", "concluido"),
        supabase.from("leads").select("*", { count: "exact", head: true }).gte("created_at", startOfMonth),
        supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "fechado_ganho"),
        supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "perdido"),
        supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "concluido"),
        supabase.from("visits").select("*", { count: "exact", head: true }).eq("status", "concluido"),
        supabase.from("metas").select("quantidade_meta").eq("mes", now.getMonth() + 1).eq("ano", now.getFullYear()).maybeSingle(),
        supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "fechado_ganho").gte("won_at", startOfMonth).lte("won_at", endOfMonth),
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

      if (metaRes.data) {
        const quantidadeMeta = metaRes.data.quantidade_meta || 0;
        const fechadosMes = leadsWonMonthRes.count || 0;
        const faltam = Math.max(0, quantidadeMeta - fechadosMes);
        const percentual = quantidadeMeta > 0 ? Math.min(100, (fechadosMes / quantidadeMeta) * 100) : 0;
        setMeta({ quantidadeMeta, fechadosMes, faltam, percentual, atingida: fechadosMes >= quantidadeMeta });
      } else {
        setMeta(null);
      }
    };
    fetchStats();

    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const conversionRate = stats.leads > 0 ? ((stats.leadsWon / stats.leads) * 100).toFixed(1) : "0";

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

      {/* Meta do mês */}
      {meta ? (
        <Card className={`glass-panel neon-border ${meta.atingida ? "border-green-500/40" : ""}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Trophy className={`h-5 w-5 ${meta.atingida ? "text-green-400" : "text-yellow-400"}`} />
              Meta do Mês
            </CardTitle>
            {meta.atingida && (
              <span className="text-xs font-semibold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                ✅ Meta Atingida!
              </span>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold text-foreground">
                  {meta.fechadosMes}
                  <span className="text-lg text-muted-foreground font-normal"> / {meta.quantidadeMeta}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">contratos fechados este mês</p>
              </div>
              <div className="text-right">
                {meta.faltam > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Faltam <span className="font-bold text-yellow-400">{meta.faltam}</span> para bater a meta
                  </p>
                ) : (
                  <p className="text-sm text-green-400 font-medium">
                    +{meta.fechadosMes - meta.quantidadeMeta} além da meta 🎉
                  </p>
                )}
              </div>
            </div>
            <Progress value={meta.percentual} className="h-2.5" />
            <p className="text-xs text-muted-foreground text-right">{meta.percentual.toFixed(0)}%</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass-panel neon-border border-dashed">
          <CardContent className="flex items-center gap-3 py-4">
            <Trophy className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhuma meta configurada para este mês. Configure em <span className="font-medium text-foreground">Metas</span>.
            </p>
          </CardContent>
        </Card>
      )}

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
