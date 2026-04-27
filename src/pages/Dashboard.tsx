import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  Target, Users, CalendarDays, CheckSquare, AlertTriangle,
  TrendingUp, TrendingDown, BarChart3, Trophy, DollarSign,
  ArrowUpRight, Activity,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  suporte: "Suporte",
  desenvolvedor: "Desenvolvedor",
  vendas: "Vendas",
};

const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

async function fetchDashboardStats() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();

  const [
    leadsRes, clientsRes, visitsScheduledRes, tasksOpenRes,
    leadsMonthRes, leadsWonRes, leadsLostRes, tasksDoneRes,
    visitsDoneRes, metaRes, leadsWonMonthRes, overdueRes,
    mensalidadesMonthRes, mensalidadesPrevMonthRes,
    leadsHistoryRes, mensalidadesHistoryRes, activitiesRes,
  ] = await Promise.all([
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
    supabase.from("tasks").select("*", { count: "exact", head: true }).neq("status", "concluido").lt("due_date", now.toISOString()),
    supabase.from("mensalidades").select("valor, data_pagamento").gte("data_pagamento", startOfMonth.slice(0, 10)).lte("data_pagamento", endOfMonth.slice(0, 10)),
    supabase.from("mensalidades").select("valor").gte("data_pagamento", startOfPrevMonth.slice(0, 10)).lte("data_pagamento", endOfPrevMonth.slice(0, 10)),
    supabase.from("leads").select("won_at").eq("status", "fechado_ganho").gte("won_at", sixMonthsAgo),
    supabase.from("mensalidades").select("valor, data_pagamento").gte("data_pagamento", sixMonthsAgo.slice(0, 10)),
    supabase.from("activities").select("id, action_type, target_type, data, created_at").order("created_at", { ascending: false }).limit(5),
  ]);

  const faturamentoMes = (mensalidadesMonthRes.data || []).reduce((s, m: any) => s + Number(m.valor || 0), 0);
  const faturamentoPrev = (mensalidadesPrevMonthRes.data || []).reduce((s, m: any) => s + Number(m.valor || 0), 0);

  // Build last 6 months series for chart
  const months: { label: string; ganhos: number; faturamento: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = d.getMonth();
    const y = d.getFullYear();
    const startMs = new Date(y, m, 1).getTime();
    const endMs = new Date(y, m + 1, 0, 23, 59, 59).getTime();

    const ganhos = (leadsHistoryRes.data || []).filter((l: any) => {
      if (!l.won_at) return false;
      const t = new Date(l.won_at).getTime();
      return t >= startMs && t <= endMs;
    }).length;

    const faturamento = (mensalidadesHistoryRes.data || []).filter((mm: any) => {
      const t = new Date(mm.data_pagamento).getTime();
      return t >= startMs && t <= endMs;
    }).reduce((s, mm: any) => s + Number(mm.valor || 0), 0);

    months.push({ label: MONTHS_SHORT[m], ganhos, faturamento });
  }

  return {
    stats: {
      leads: leadsRes.count || 0,
      clients: clientsRes.count || 0,
      visitsScheduled: visitsScheduledRes.count || 0,
      tasksOpen: tasksOpenRes.count || 0,
      tasksOverdue: overdueRes.count || 0,
      leadsThisMonth: leadsMonthRes.count || 0,
      leadsWon: leadsWonRes.count || 0,
      leadsLost: leadsLostRes.count || 0,
      tasksDone: tasksDoneRes.count || 0,
      visitsDone: visitsDoneRes.count || 0,
      leadsWonMonth: leadsWonMonthRes.count || 0,
      faturamentoMes,
      faturamentoPrev,
    },
    meta: metaRes.data ? { quantidade_meta: metaRes.data.quantidade_meta || 0 } : null,
    monthlySeries: months,
    activities: activitiesRes.data || [],
  };
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const ACTION_LABELS: Record<string, string> = {
  create: "Criou",
  update: "Atualizou",
  delete: "Removeu",
  status_change: "Alterou status de",
  won: "Ganhou",
  lost: "Perdeu",
};
const TARGET_LABELS: Record<string, string> = {
  lead: "lead",
  client: "cliente",
  task: "tarefa",
  visit: "visita",
  contract: "contrato",
};

export default function Dashboard() {
  const { profile, role } = useAuth();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchDashboardStats,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "mensalidades" }, () => {
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const stats = data?.stats ?? {
    leads: 0, clients: 0, visitsScheduled: 0, tasksOpen: 0, tasksOverdue: 0,
    leadsThisMonth: 0, leadsWon: 0, leadsLost: 0, tasksDone: 0, visitsDone: 0,
    leadsWonMonth: 0, faturamentoMes: 0, faturamentoPrev: 0,
  };
  const monthlySeries = data?.monthlySeries ?? [];
  const activities = data?.activities ?? [];

  const meta = data?.meta
    ? (() => {
        const quantidadeMeta = data.meta.quantidade_meta;
        const fechadosMes = stats.leadsWonMonth;
        const faltam = Math.max(0, quantidadeMeta - fechadosMes);
        const percentual = quantidadeMeta > 0 ? Math.min(100, (fechadosMes / quantidadeMeta) * 100) : 0;
        return { quantidadeMeta, fechadosMes, faltam, percentual, atingida: fechadosMes >= quantidadeMeta };
      })()
    : null;

  const conversionRate = stats.leads > 0 ? (stats.leadsWon / stats.leads) * 100 : 0;
  const faturamentoDelta = useMemo(() => {
    if (stats.faturamentoPrev <= 0) return null;
    return ((stats.faturamentoMes - stats.faturamentoPrev) / stats.faturamentoPrev) * 100;
  }, [stats.faturamentoMes, stats.faturamentoPrev]);

  const headerSummary = [
    { label: "Faturamento", value: fmtBRL(stats.faturamentoMes), accent: "text-green-400" },
    {
      label: "vs mês passado",
      value: faturamentoDelta === null ? "—" : `${faturamentoDelta >= 0 ? "+" : ""}${faturamentoDelta.toFixed(1)}%`,
      accent: faturamentoDelta === null ? "text-muted-foreground" : faturamentoDelta >= 0 ? "text-green-400" : "text-destructive",
    },
    { label: "Meta", value: meta ? `${meta.percentual.toFixed(0)}%` : "—", accent: "text-cyan-400" },
    { label: "Conversão", value: `${conversionRate.toFixed(1)}%`, accent: "text-purple-400" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold neon-glow">
            Olá, {profile?.nome || "Usuário"} 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {role ? ROLE_LABELS[role] : ""} • Painel de controle
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:gap-3">
          {headerSummary.map((it) => (
            <div
              key={it.label}
              className="px-3 py-2 rounded-lg border border-border/60 bg-card/60 backdrop-blur min-w-[120px]"
            >
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{it.label}</p>
              <p className={`text-base font-semibold ${it.accent} leading-tight truncate`}>{it.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* KPI principal: Faturamento + Meta lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Faturamento card grande */}
        <Card className="glass-panel neon-border lg:col-span-2 overflow-hidden">
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-400" />
                Faturamento do mês
              </CardTitle>
              <p className="text-4xl font-bold text-foreground mt-2 tracking-tight">
                {fmtBRL(stats.faturamentoMes)}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {faturamentoDelta === null ? (
                  <span className="text-xs text-muted-foreground">Sem dados do mês anterior</span>
                ) : (
                  <Badge
                    variant="outline"
                    className={`text-xs ${faturamentoDelta >= 0 ? "border-green-400/40 text-green-400" : "border-destructive/40 text-destructive"}`}
                  >
                    {faturamentoDelta >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                    {faturamentoDelta >= 0 ? "+" : ""}{faturamentoDelta.toFixed(1)}% vs mês passado
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  Anterior: {fmtBRL(stats.faturamentoPrev)}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-24 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlySeries} margin={{ top: 5, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fatGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(142 76% 50%)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(142 76% 50%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                    formatter={(v: number) => fmtBRL(v)}
                    labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="faturamento"
                    stroke="hsl(142 76% 50%)"
                    strokeWidth={2}
                    fill="url(#fatGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Meta destacada */}
        {meta ? (
          <Card className={`glass-panel neon-border ${meta.atingida ? "border-green-500/40" : ""}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Trophy className={`h-4 w-4 ${meta.atingida ? "text-green-400" : "text-yellow-400"}`} />
                  Meta do mês
                </span>
                {meta.atingida && (
                  <Badge className="text-[10px] bg-green-400/15 text-green-400 hover:bg-green-400/20">
                    ✅ Atingida
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-3xl font-bold text-foreground tracking-tight">
                  {meta.fechadosMes}
                  <span className="text-lg text-muted-foreground font-normal"> / {meta.quantidadeMeta}</span>
                </p>
                <p className="text-xs text-muted-foreground">contratos fechados</p>
              </div>
              <Progress value={meta.percentual} className="h-3" />
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{meta.percentual.toFixed(0)}% concluído</span>
                {meta.faltam > 0 ? (
                  <span className="text-yellow-400 font-medium">faltam {meta.faltam}</span>
                ) : (
                  <span className="text-green-400 font-medium">+{meta.fechadosMes - meta.quantidadeMeta} acima</span>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-panel neon-border border-dashed">
            <CardContent className="flex flex-col items-center justify-center text-center gap-2 h-full py-6">
              <Trophy className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Configure a meta deste mês em <Link to="/metas" className="text-primary underline">Metas</Link>.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { title: "Leads ganhos", value: stats.leadsWon, icon: Target, color: "text-green-400" },
          { title: "Conversão", value: `${conversionRate.toFixed(1)}%`, icon: BarChart3, color: "text-primary" },
          { title: "Clientes", value: stats.clients, icon: Users, color: "text-purple-400" },
          { title: "Visitas agendadas", value: stats.visitsScheduled, icon: CalendarDays, color: "text-cyan-400" },
        ].map((card) => (
          <Card key={card.title} className="glass-panel neon-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{card.title}</p>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
              <p className="text-3xl font-bold text-foreground mt-2 tracking-tight">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gráfico de evolução + Atividades */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="glass-panel neon-border lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Evolução mensal — últimos 6 meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlySeries} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                    labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                  />
                  <Line type="monotone" dataKey="ganhos" name="Leads ganhos" stroke="hsl(190 90% 55%)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel neon-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Atividades recentes</CardTitle>
            <Link to="/leads" className="text-xs text-primary hover:underline flex items-center gap-1">
              ver mais <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {activities.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma atividade registrada.</p>
            ) : (
              activities.map((a: any) => {
                const action = ACTION_LABELS[a.action_type] || a.action_type;
                const target = TARGET_LABELS[a.target_type] || a.target_type;
                const name = a.data?.nome || a.data?.title || "";
                const when = new Date(a.created_at);
                const ago = formatRelative(when);
                return (
                  <div key={a.id} className="flex items-start gap-2 py-2 border-b border-border/30 last:border-0">
                    <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">
                        {action} {target} {name && <span className="text-muted-foreground">— {name}</span>}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{ago}</p>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* KPIs secundários */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { title: "Leads total", value: stats.leads, icon: TrendingUp, color: "text-cyan-400" },
          { title: "Perdidos", value: stats.leadsLost, icon: TrendingDown, color: "text-destructive" },
          { title: "Tarefas concluídas", value: stats.tasksDone, icon: CheckSquare, color: "text-green-400" },
          { title: "Tarefas abertas", value: stats.tasksOpen, icon: CheckSquare, color: "text-orange-400" },
        ].map((card) => (
          <Card key={card.title} className="glass-panel neon-border">
            <CardContent className="p-3 flex items-center gap-3">
              <card.icon className={`h-4 w-4 ${card.color} shrink-0`} />
              <div className="min-w-0">
                <p className="text-xl font-bold text-foreground leading-none">{card.value}</p>
                <p className="text-[10px] text-muted-foreground mt-1 truncate">{card.title}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alertas */}
      {(stats.tasksOverdue > 0 || (meta && !meta.atingida && meta.faltam > 0)) && (
        <div className="space-y-2">
          {stats.tasksOverdue > 0 && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="flex items-center gap-3 py-3">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-sm text-foreground">
                  <span className="font-semibold">{stats.tasksOverdue} tarefa(s)</span> com prazo vencido.
                </p>
                <Link to="/tarefas" className="ml-auto text-xs text-primary hover:underline">ver tarefas</Link>
              </CardContent>
            </Card>
          )}
          {meta && !meta.atingida && meta.faltam > 0 && (
            <Card className="border-yellow-500/30 bg-yellow-500/5">
              <CardContent className="flex items-center gap-3 py-3">
                <Trophy className="h-4 w-4 text-yellow-400 shrink-0" />
                <p className="text-sm text-foreground">
                  Faltam <span className="font-semibold">{meta.faltam} contrato(s)</span> para bater a meta do mês.
                </p>
                <Link to="/metas" className="ml-auto text-xs text-primary hover:underline">ver meta</Link>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d}d`;
  return date.toLocaleDateString("pt-BR");
}
