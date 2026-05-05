import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { getDateRange, type DateRangePreset, WON_AT_COLUMN } from "@/hooks/useWonAtRange";
import { MonthCountdown } from "@/components/dashboard/MonthCountdown";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  suporte: "Suporte",
  desenvolvedor: "Desenvolvedor",
  vendas: "Vendas",
};

const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "month", label: "Mês atual" },
];

async function fetchDashboardStats(preset: DateRangePreset) {
  const now = new Date();
  const range = getDateRange(preset, now);

  // Mês de referência para a META — sempre o mês corrente, conforme regra do produto.
  const monthRange = getDateRange("month", now);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();

  const [
    leadsRes, clientsRes, visitsScheduledRes, tasksOpenRes,
    leadsRangeRes, leadsWonAllRes, leadsLostRes, tasksDoneRes,
    visitsDoneRes, metaRes, leadsWonRangeRes, leadsWonMonthRes, overdueRes,
    mensalidadesRangeRes, mensalidadesPrevMonthRes,
    leadsHistoryRes, mensalidadesHistoryRes, activitiesRes,
  ] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase.from("clients").select("*", { count: "exact", head: true }),
    supabase.from("visits").select("*", { count: "exact", head: true }).eq("status", "agendado"),
    supabase.from("tasks").select("*", { count: "exact", head: true }).neq("status", "concluido"),
    // Leads criados no intervalo (para taxa de conversão do período)
    supabase.from("leads").select("*", { count: "exact", head: true })
      .gte("created_at", range.startISO).lte("created_at", range.endISO),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "fechado_ganho"),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "perdido"),
    supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "concluido"),
    supabase.from("visits").select("*", { count: "exact", head: true }).eq("status", "concluido"),
    supabase.from("metas").select("quantidade_meta")
      .eq("mes", now.getMonth() + 1).eq("ano", now.getFullYear()).maybeSingle(),
    // Ganhos no intervalo selecionado — usa SEMPRE won_at
    supabase.from("leads").select("*", { count: "exact", head: true })
      .eq("status", "fechado_ganho")
      .gte(WON_AT_COLUMN, range.startISO).lte(WON_AT_COLUMN, range.endISO),
    // Ganhos no mês corrente — base da META (sempre won_at)
    supabase.from("leads").select("*", { count: "exact", head: true })
      .eq("status", "fechado_ganho")
      .gte(WON_AT_COLUMN, monthRange.startISO).lte(WON_AT_COLUMN, monthRange.endISO),
    supabase.from("tasks").select("*", { count: "exact", head: true })
      .neq("status", "concluido").lt("due_date", now.toISOString()),
    supabase.from("mensalidades").select("valor, data_pagamento")
      .gte("data_pagamento", range.startDate).lte("data_pagamento", range.endDate),
    supabase.from("mensalidades").select("valor")
      .gte("data_pagamento", startOfPrevMonth.slice(0, 10))
      .lte("data_pagamento", endOfPrevMonth.slice(0, 10)),
    supabase.from("leads").select("won_at").eq("status", "fechado_ganho").gte(WON_AT_COLUMN, sixMonthsAgo),
    supabase.from("mensalidades").select("valor, data_pagamento").gte("data_pagamento", sixMonthsAgo.slice(0, 10)),
    supabase.from("activities").select("id, action_type, target_type, data, created_at")
      .order("created_at", { ascending: false }).limit(5),
  ]);

  const faturamentoRange = (mensalidadesRangeRes.data || []).reduce((s, m: any) => s + Number(m.valor || 0), 0);
  const faturamentoPrev = (mensalidadesPrevMonthRes.data || []).reduce((s, m: any) => s + Number(m.valor || 0), 0);

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
    range,
    stats: {
      leads: leadsRes.count || 0,
      clients: clientsRes.count || 0,
      visitsScheduled: visitsScheduledRes.count || 0,
      tasksOpen: tasksOpenRes.count || 0,
      tasksOverdue: overdueRes.count || 0,
      leadsInRange: leadsRangeRes.count || 0,
      leadsWon: leadsWonAllRes.count || 0,
      leadsLost: leadsLostRes.count || 0,
      tasksDone: tasksDoneRes.count || 0,
      visitsDone: visitsDoneRes.count || 0,
      leadsWonRange: leadsWonRangeRes.count || 0,
      leadsWonMonth: leadsWonMonthRes.count || 0,
      faturamentoRange,
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
  create: "Criou", update: "Atualizou", delete: "Removeu",
  status_change: "Alterou status de", won: "Ganhou", lost: "Perdeu",
};
const TARGET_LABELS: Record<string, string> = {
  lead: "lead", client: "cliente", task: "tarefa", visit: "visita", contract: "contrato",
};

export default function Dashboard() {
  const { profile, role } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [preset, setPreset] = useState<DateRangePreset>("month");

  const { data } = useQuery({
    queryKey: ["dashboard-stats", preset],
    queryFn: () => fetchDashboardStats(preset),
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
    leadsInRange: 0, leadsWon: 0, leadsLost: 0, tasksDone: 0, visitsDone: 0,
    leadsWonRange: 0, leadsWonMonth: 0, faturamentoRange: 0, faturamentoPrev: 0,
  };
  const monthlySeries = data?.monthlySeries ?? [];
  const activities = data?.activities ?? [];

  // META — sempre baseada em won_at do mês corrente.
  const meta = data?.meta
    ? (() => {
        const quantidadeMeta = data.meta.quantidade_meta;
        const fechadosMes = stats.leadsWonMonth;
        const faltam = Math.max(0, quantidadeMeta - fechadosMes);
        const percentual = quantidadeMeta > 0 ? Math.min(100, (fechadosMes / quantidadeMeta) * 100) : 0;
        return { quantidadeMeta, fechadosMes, faltam, percentual, atingida: fechadosMes >= quantidadeMeta };
      })()
    : null;

  // Conversão = ganhos no período / leads criados no período (ambos via filtros canônicos)
  const conversionRate = stats.leadsInRange > 0
    ? (stats.leadsWonRange / stats.leadsInRange) * 100
    : 0;

  const faturamentoDelta = useMemo(() => {
    if (stats.faturamentoPrev <= 0) return null;
    return ((stats.faturamentoRange - stats.faturamentoPrev) / stats.faturamentoPrev) * 100;
  }, [stats.faturamentoRange, stats.faturamentoPrev]);

  const periodLabel = data?.range.label ?? "Mês atual";

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold neon-glow truncate">
            Olá, {profile?.nome || "Usuário"} 👋
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            {role ? ROLE_LABELS[role] : ""} • Painel de controle • <span className="text-foreground/80">{periodLabel}</span>
          </p>
        </div>

        {/* Filtro de datas */}
        <div className="surface-soft inline-flex items-center gap-1 p-1 self-start lg:self-auto overflow-x-auto">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPreset(p.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                preset === p.value
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* === KPI principal: Faturamento === */}
      <Card className="glass-panel neon-border overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-5">
          <div className="lg:col-span-2 p-5 sm:p-6">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground">
              <DollarSign className="h-4 w-4 text-green-400" />
              Faturamento • {periodLabel}
            </div>
            <p className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mt-2 tracking-tight break-all">
              {fmtBRL(stats.faturamentoRange)}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
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
          <div className="lg:col-span-3 px-2 pb-3 sm:p-4">
            <div className="h-28 sm:h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlySeries} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
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
                  <Area type="monotone" dataKey="faturamento" stroke="hsl(142 76% 50%)" strokeWidth={2} fill="url(#fatGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </Card>

      {/* === META do mês — destaque alto, com countdown === */}
      {meta ? (
        <Card
          className={`glass-panel neon-border overflow-hidden relative ${
            meta.atingida ? "border-green-500/40" : "border-yellow-500/30"
          }`}
        >
          <div
            className={`absolute inset-x-0 top-0 h-0.5 ${
              meta.atingida ? "bar-success" : "bar-warning"
            }`}
          />
          <CardHeader className="pb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Trophy className={`h-4 w-4 ${meta.atingida ? "text-green-400" : "text-yellow-400"}`} />
              Meta do mês
              {meta.atingida && (
                <Badge className="ml-1 text-[10px] bg-green-400/15 text-green-400 hover:bg-green-400/20">
                  ✅ Atingida
                </Badge>
              )}
            </CardTitle>
            <MonthCountdown />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Realizados</p>
                <p className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none mt-1">
                  {meta.fechadosMes}
                  <span className="text-base text-muted-foreground font-normal"> / {meta.quantidadeMeta}</span>
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">contratos fechados</p>
              </div>
              <div className="sm:text-center">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Faltam</p>
                <p className={`text-3xl sm:text-4xl font-bold tracking-tight leading-none mt-1 ${
                  meta.atingida ? "text-green-400" : "text-yellow-300"
                }`}>
                  {meta.atingida ? `+${meta.fechadosMes - meta.quantidadeMeta}` : meta.faltam}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {meta.atingida ? "acima da meta" : "para bater a meta"}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Progresso</p>
                <p className="text-3xl sm:text-4xl font-bold text-cyan-300 tracking-tight leading-none mt-1">
                  {meta.percentual.toFixed(0)}<span className="text-lg">%</span>
                </p>
              </div>
            </div>
            <Progress value={meta.percentual} className="h-3" />
          </CardContent>
        </Card>
      ) : (
        <Card className="glass-panel neon-border border-dashed">
          <CardContent className="flex flex-col items-center justify-center text-center gap-2 py-6">
            <Trophy className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Configure a meta deste mês em <Link to="/metas" className="text-primary underline">Metas</Link>.
            </p>
          </CardContent>
        </Card>
      )}

      {/* === KPIs secundários === */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { title: "Ganhos no período", value: stats.leadsWonRange, icon: Target, color: "text-green-400" },
          { title: "Conversão", value: `${conversionRate.toFixed(1)}%`, icon: BarChart3, color: "text-primary" },
          { title: "Clientes", value: stats.clients, icon: Users, color: "text-purple-400" },
          { title: "Visitas agendadas", value: stats.visitsScheduled, icon: CalendarDays, color: "text-cyan-400" },
        ].map((card) => (
          <Card key={card.title} className="glass-panel neon-border">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground truncate pr-2">
                  {card.title}
                </p>
                <card.icon className={`h-4 w-4 ${card.color} shrink-0`} />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-foreground mt-2 tracking-tight">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* === Gráfico + Atividades === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="glass-panel neon-border lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Evolução mensal — últimos 6 meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 sm:h-56">
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
          <CardContent className="space-y-1">
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

      {/* === KPIs auxiliares === */}
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

      {/* === Alertas interativos === */}
      {(stats.tasksOverdue > 0 || stats.tasksOpen > 0 || (meta && !meta.atingida && meta.faltam > 0)) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(stats.tasksOverdue > 0 || stats.tasksOpen > 0) && (
            <button
              onClick={() => navigate("/tarefas?status=abertas")}
              className="text-left group"
            >
              <Card className="border-destructive/30 bg-destructive/5 hover:bg-destructive/10 transition-colors h-full">
                <CardContent className="flex items-center gap-3 py-3">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">
                      {stats.tasksOverdue > 0 ? (
                        <><span className="font-semibold">{stats.tasksOverdue} tarefa(s)</span> com prazo vencido</>
                      ) : (
                        <><span className="font-semibold">{stats.tasksOpen} tarefa(s)</span> em aberto</>
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground">clique para abrir</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-destructive opacity-60 group-hover:opacity-100 transition-opacity" />
                </CardContent>
              </Card>
            </button>
          )}
          {meta && !meta.atingida && meta.faltam > 0 && (
            <button
              onClick={() => navigate("/metas")}
              className="text-left group"
            >
              <Card className="border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10 transition-colors h-full">
                <CardContent className="flex items-center gap-3 py-3">
                  <Trophy className="h-4 w-4 text-yellow-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">
                      Faltam <span className="font-semibold">{meta.faltam} contrato(s)</span> para bater a meta
                    </p>
                    <p className="text-[10px] text-muted-foreground">clique para abrir Metas</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-yellow-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                </CardContent>
              </Card>
            </button>
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
