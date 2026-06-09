import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trophy, Target, TrendingUp, Users, Settings, DollarSign, BarChart3 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ContratosPorFaixaBlock } from "@/components/metas/ContratosPorFaixaBlock";
import { ParcelasMesBlock } from "@/components/metas/ParcelasMesBlock";

interface Meta {
  id: string;
  mes: number;
  ano: number;
  quantidade_meta: number;
  valor_contrato: number;
  meta_bonus_quantidade: number | null;
  meta_bonus_valor: number | null;
  meta_bonus_descricao: string | null;
}

interface Profile {
  id: string;
  nome: string;
  cor: string | null;
}

interface LeadGanho {
  id: string;
  nome: string;
  responsible_id: string | null;
  valor_contrato: number | null;
  won_at: string | null;
}

interface HistoryEntry {
  label: string;
  meta: number;
  fechados: number;
  atingida: boolean;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function Metas() {
  const { role } = useAuth();
  const isAdmin = role === "admin" || role === "gestor";
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [meta, setMeta] = useState<Meta | null>(null);
  const [tiers, setTiers] = useState<{ id: string; nome: string; quantidade_minima: number; valor_por_contrato: number; ordem: number }[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [leadsGanhos, setLeadsGanhos] = useState<LeadGanho[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const fetchData = async () => {
    const { data: metaData } = await supabase
      .from("metas")
      .select("*")
      .eq("mes", selectedMonth)
      .eq("ano", selectedYear)
      .maybeSingle();
    setMeta(metaData as Meta | null);

    if (metaData?.id) {
      const { data: tiersData } = await supabase
        .from("meta_tiers")
        .select("id, nome, quantidade_minima, valor_por_contrato, ordem")
        .eq("meta_id", metaData.id)
        .order("quantidade_minima", { ascending: true });
      setTiers(tiersData || []);
    } else {
      setTiers([]);
    }

    const { data: allMembers } = await supabase.from("profiles").select("id, nome, cor, participa_comissao");
    const participatingMembers = (allMembers || []).filter((m: any) => m.participa_comissao !== false);
    setMembers(participatingMembers);
    const participatingIds = new Set(participatingMembers.map((m) => m.id));

    const startDate = new Date(selectedYear, selectedMonth - 1, 1).toISOString();
    const endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59).toISOString();
    const { data: leads } = await supabase
      .from("leads")
      .select("id, nome, responsible_id, valor_contrato, won_at")
      .eq("status", "fechado_ganho")
      .gte("won_at", startDate)
      .lte("won_at", endDate);
    const filteredLeads = (leads || []).filter((l: any) => l.responsible_id && participatingIds.has(l.responsible_id));
    setLeadsGanhos(filteredLeads as LeadGanho[]);
  };

  const fetchHistory = async () => {
    const entries: HistoryEntry[] = [];
    const { data: allMetas } = await supabase.from("metas").select("*").order("ano", { ascending: true }).order("mes", { ascending: true });
    const metaIds = (allMetas || []).map((m: any) => m.id);
    const { data: allTiers } = metaIds.length
      ? await supabase.from("meta_tiers").select("meta_id, quantidade_minima").in("meta_id", metaIds)
      : { data: [] as any[] };
    const { data: allProfiles } = await supabase.from("profiles").select("id, participa_comissao");
    const participatingIds = new Set((allProfiles || []).filter((p: any) => p.participa_comissao !== false).map((p) => p.id));
    const { data: allLeads } = await supabase.from("leads").select("responsible_id, won_at, status").eq("status", "fechado_ganho");

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      const metaForMonth = (allMetas || []).find((mt: any) => mt.mes === m && mt.ano === y);
      const monthTiers = metaForMonth ? (allTiers || []).filter((t: any) => t.meta_id === metaForMonth.id).sort((a: any, b: any) => a.quantidade_minima - b.quantidade_minima) : [];
      const baseT = monthTiers.find((t: any) => t.quantidade_minima > 0) || monthTiers[0];
      const metaQtd = baseT ? baseT.quantidade_minima : (metaForMonth ? (metaForMonth as any).quantidade_meta : 0);

      const startDate = new Date(y, m - 1, 1);
      const endDate = new Date(y, m, 0, 23, 59, 59);
      const fechados = (allLeads || []).filter((l: any) => {
        if (!l.responsible_id || !participatingIds.has(l.responsible_id)) return false;
        if (!l.won_at) return false;
        const wonDate = new Date(l.won_at);
        return wonDate >= startDate && wonDate <= endDate;
      }).length;

      entries.push({
        label: `${MONTHS_SHORT[m - 1]}/${String(y).slice(2)}`,
        meta: metaQtd,
        fechados,
        atingida: metaQtd > 0 && fechados >= metaQtd,
      });
    }
    setHistory(entries);
  };

  useEffect(() => { fetchData(); }, [selectedMonth, selectedYear]);
  useEffect(() => { fetchHistory(); }, []);


  // Calculations — derivadas das faixas configuradas (tiers) com fallback para os campos legados
  const sortedTiers = [...tiers].sort((a, b) => a.quantidade_minima - b.quantidade_minima);
  const baseTier = sortedTiers.find((t) => t.quantidade_minima > 0) || sortedTiers[0];
  const topTier = sortedTiers[sortedTiers.length - 1];
  const metaQtd = baseTier?.quantidade_minima ?? (meta?.quantidade_meta || 0);
  const metaValor = baseTier?.valor_por_contrato ?? (meta?.valor_contrato || 0);
  const totalFechados = leadsGanhos.length;
  const faltamFechar = Math.max(0, metaQtd - totalFechados);
  const progressPercent = metaQtd > 0 ? Math.min(100, (totalFechados / metaQtd) * 100) : 0;

  // Super meta = faixa mais alta (quando houver mais de uma faixa)
  const superMetaQtd = topTier && topTier !== baseTier ? topTier.quantidade_minima : (meta?.meta_bonus_quantidade || 0);
  const superMetaValor = topTier && topTier !== baseTier ? topTier.valor_por_contrato : Number(meta?.meta_bonus_valor || 0);
  const superMetaAtingida = superMetaQtd > 0 && totalFechados >= superMetaQtd;
  const superMetaProgress = superMetaQtd > 0 ? Math.min(100, (totalFechados / superMetaQtd) * 100) : 0;

  // Per member breakdown
  const memberStats = members
    .map((m) => {
      const memberLeads = leadsGanhos.filter((l) => l.responsible_id === m.id);
      const count = memberLeads.length;
      const totalValor = memberLeads.reduce((sum, l) => sum + (Number(l.valor_contrato) || metaValor), 0);
      return { ...m, count, totalValor };
    }).sort((a, b) => b.count - a.count);

  const totalValorGeral = leadsGanhos.reduce((sum, l) => sum + (Number(l.valor_contrato) || metaValor), 0);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold neon-glow">Metas</h1>
          <p className="text-muted-foreground text-sm mt-1">Acompanhamento de metas mensais</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-[140px] bg-secondary/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-[100px] bg-secondary/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAdmin && (
            <Button variant="outline" asChild>
              <Link to="/configuracoes?tab=metas-premiacao">
                <Settings className="h-4 w-4 mr-2" /> Configurar faixas
              </Link>
            </Button>
          )}
        </div>
      </div>





      {!meta ? (
        <Card className="glass-panel neon-border">
          <CardContent className="p-8 text-center">
            <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhuma meta definida para {MONTHS[selectedMonth - 1]} {selectedYear}.</p>
            {isAdmin && <p className="text-sm text-muted-foreground mt-1">Clique em "Configurar Meta" para definir.</p>}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Overview cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="glass-panel neon-border">
              <CardContent className="p-4 text-center">
                <Target className="h-5 w-5 mx-auto text-primary mb-1" />
                <p className="text-2xl font-bold text-foreground">{metaQtd}</p>
                <p className="text-xs text-muted-foreground">Meta</p>
              </CardContent>
            </Card>
            <Card className="glass-panel neon-border">
              <CardContent className="p-4 text-center">
                <TrendingUp className="h-5 w-5 mx-auto text-green-400 mb-1" />
                <p className="text-2xl font-bold text-foreground">{totalFechados}</p>
                <p className="text-xs text-muted-foreground">Fechados</p>
              </CardContent>
            </Card>
            <Card className="glass-panel neon-border">
              <CardContent className="p-4 text-center">
                <Target className="h-5 w-5 mx-auto text-amber-400 mb-1" />
                <p className="text-2xl font-bold text-foreground">{faltamFechar}</p>
                <p className="text-xs text-muted-foreground">Faltam</p>
              </CardContent>
            </Card>
            <Card className="glass-panel neon-border">
              <CardContent className="p-4 text-center">
                <DollarSign className="h-5 w-5 mx-auto text-green-400 mb-1" />
                <p className="text-2xl font-bold text-foreground">
                  R$ {totalValorGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">Valor Total</p>
              </CardContent>
            </Card>
          </div>

          {/* Progress bar */}
          <Card className="glass-panel neon-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-foreground">Progresso da Meta</p>
                <Badge className="text-xs" style={{
                  backgroundColor: progressPercent >= 100 ? "#22c55e30" : progressPercent >= 50 ? "#f59e0b30" : "#ef444430",
                  color: progressPercent >= 100 ? "#22c55e" : progressPercent >= 50 ? "#f59e0b" : "#ef4444",
                }}>
                  {progressPercent.toFixed(0)}%
                </Badge>
              </div>
              <div className="w-full bg-secondary/50 rounded-full h-3">
                <div
                  className="h-3 rounded-full transition-all duration-500"
                  style={{
                    width: `${progressPercent}%`,
                    background: progressPercent >= 100
                      ? "linear-gradient(90deg, #22c55e, #16a34a)"
                      : progressPercent >= 50
                      ? "linear-gradient(90deg, #f59e0b, #d97706)"
                      : "linear-gradient(90deg, #ef4444, #dc2626)",
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {totalFechados} de {metaQtd} contratos • Valor por contrato: R$ {metaValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>

          {/* Per member breakdown */}
          <Card className="glass-panel neon-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Desempenho por Membro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {memberStats.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum membro encontrado.</p>
              ) : (
                memberStats.map((m) => {
                  const memberProgress = metaQtd > 0 ? (m.count / metaQtd) * 100 : 0;
                  return (
                    <div key={m.id} className="p-3 rounded-lg border border-border/50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: m.cor || "#06b6d4" }} />
                          <span className="text-sm font-medium text-foreground">{m.nome}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-foreground font-semibold">{m.count} contratos</span>
                          <span className="text-green-400 font-semibold">
                            R$ {m.totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-secondary/50 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, memberProgress)}%`,
                            backgroundColor: m.cor || "#06b6d4",
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Super Meta card */}
          {superMetaQtd > 0 && (
            <Card className={`glass-panel neon-border ${superMetaAtingida ? 'ring-2 ring-amber-400/50' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-foreground flex items-center gap-2">
                    🎯 Super Meta
                    {superMetaAtingida && <Badge className="bg-amber-400/20 text-amber-400 text-xs">Atingida! 🎉</Badge>}
                  </p>
                  <Badge className="text-xs" style={{
                    backgroundColor: superMetaAtingida ? "#f59e0b30" : "#6b728030",
                    color: superMetaAtingida ? "#f59e0b" : "#6b7280",
                  }}>
                    {totalFechados}/{superMetaQtd}
                  </Badge>
                </div>
                <div className="w-full bg-secondary/50 rounded-full h-3">
                  <div
                    className="h-3 rounded-full transition-all duration-500"
                    style={{
                      width: `${superMetaProgress}%`,
                      background: superMetaAtingida
                        ? "linear-gradient(90deg, #f59e0b, #d97706)"
                        : "linear-gradient(90deg, #6b7280, #4b5563)",
                    }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {meta?.meta_bonus_valor && Number(meta.meta_bonus_valor) > 0 && (
                    <span>Bônus: R$ {Number(meta.meta_bonus_valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} por contrato</span>
                  )}
                  {meta?.meta_bonus_descricao && (
                    <span className="text-amber-400 font-medium">🏆 Prêmio: {meta.meta_bonus_descricao}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent won leads */}
          {leadsGanhos.length > 0 && (
            <Card className="glass-panel neon-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-400" />
                  Contratos Fechados em {MONTHS[selectedMonth - 1]}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {leadsGanhos.map((l) => {
                    const member = members.find((m) => m.id === l.responsible_id);
                    const valor = Number(l.valor_contrato) || metaValor;
                    return (
                      <div key={l.id} className="flex items-center justify-between p-2 rounded-lg border border-border/50">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: member?.cor || "#06b6d4" }} />
                          <span className="text-sm text-foreground">{l.nome}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-muted-foreground">{member?.nome || "—"}</span>
                          <span className="text-green-400 font-semibold">
                            R$ {valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Contratos & parcelas do mês */}
      <ContratosPorFaixaBlock mes={selectedMonth} ano={selectedYear} />
      <ParcelasMesBlock mes={selectedMonth} ano={selectedYear} />



      {/* Goals History Chart */}
      {history.length > 0 && (
        <Card className="glass-panel neon-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Histórico de Metas (últimos 6 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={history} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(value: number, name: string) => [value, name === "meta" ? "Meta" : "Fechados"]}
                />
                <Bar dataKey="meta" name="Meta" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.4} />
                <Bar dataKey="fechados" name="Fechados" radius={[4, 4, 0, 0]}>
                  {history.map((entry, index) => (
                    <Cell key={index} fill={entry.atingida ? "#22c55e" : entry.meta > 0 ? "#ef4444" : "#6b7280"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground justify-center">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-sm bg-[#22c55e]" />
                <span>Meta atingida</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-sm bg-[#ef4444]" />
                <span>Meta não atingida</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-sm bg-muted-foreground/40" />
                <span>Meta definida</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
