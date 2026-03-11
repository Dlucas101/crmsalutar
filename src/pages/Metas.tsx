import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Trophy, Target, TrendingUp, Users, Settings, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

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
  updated_at: string;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function Metas() {
  const { role } = useAuth();
  const isAdmin = role === "admin" || role === "gestor";
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [meta, setMeta] = useState<Meta | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [adminIds, setAdminIds] = useState<string[]>([]);
  const [leadsGanhos, setLeadsGanhos] = useState<LeadGanho[]>([]);
  const [openConfig, setOpenConfig] = useState(false);
  const [formQtd, setFormQtd] = useState("");
  const [formValor, setFormValor] = useState("");
  const [formBonusQtd, setFormBonusQtd] = useState("");
  const [formBonusValor, setFormBonusValor] = useState("");
  const [formBonusDesc, setFormBonusDesc] = useState("");

  const fetchData = async () => {
    // Fetch meta for selected month
    const { data: metaData } = await supabase
      .from("metas")
      .select("*")
      .eq("mes", selectedMonth)
      .eq("ano", selectedYear)
      .maybeSingle();
    setMeta(metaData as Meta | null);
    if (metaData) {
      setFormQtd(String((metaData as any).quantidade_meta));
      setFormValor(String((metaData as any).valor_contrato));
    } else {
      setFormQtd("");
      setFormValor("");
    }

    // Fetch members (non-admin)
    const { data: allMembers } = await supabase.from("profiles").select("id, nome, cor");
    setMembers(allMembers || []);

    // Fetch leads won in selected month/year
    const startDate = new Date(selectedYear, selectedMonth - 1, 1).toISOString();
    const endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59).toISOString();
    const { data: leads } = await supabase
      .from("leads")
      .select("id, nome, responsible_id, valor_contrato, updated_at")
      .eq("status", "fechado_ganho")
      .gte("updated_at", startDate)
      .lte("updated_at", endDate);
    setLeadsGanhos((leads || []) as LeadGanho[]);
  };

  useEffect(() => { fetchData(); }, [selectedMonth, selectedYear]);

  const handleSaveMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtd = parseInt(formQtd) || 0;
    const valor = parseFloat(formValor) || 0;
    if (qtd <= 0) { toast.error("Informe a quantidade da meta"); return; }

    if (meta) {
      const { error } = await supabase.from("metas").update({
        quantidade_meta: qtd,
        valor_contrato: valor,
      }).eq("id", meta.id);
      if (error) { toast.error("Erro ao atualizar meta"); return; }
    } else {
      const { error } = await supabase.from("metas").insert({
        mes: selectedMonth,
        ano: selectedYear,
        quantidade_meta: qtd,
        valor_contrato: valor,
      });
      if (error) { toast.error("Erro ao criar meta"); return; }
    }
    toast.success("Meta salva!");
    setOpenConfig(false);
    fetchData();
  };

  // Calculations
  const metaQtd = meta?.quantidade_meta || 0;
  const metaValor = meta?.valor_contrato || 0;
  const totalFechados = leadsGanhos.length;
  const faltamFechar = Math.max(0, metaQtd - totalFechados);
  const progressPercent = metaQtd > 0 ? Math.min(100, (totalFechados / metaQtd) * 100) : 0;

  // Per member breakdown
  const memberStats = members.map((m) => {
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
            <Dialog open={openConfig} onOpenChange={setOpenConfig}>
              <DialogTrigger asChild>
                <Button variant="outline"><Settings className="h-4 w-4 mr-2" /> Configurar Meta</Button>
              </DialogTrigger>
              <DialogContent className="glass-panel border-border max-w-sm">
                <DialogHeader>
                  <DialogTitle className="neon-glow">Meta de {MONTHS[selectedMonth - 1]} {selectedYear}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSaveMeta} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Quantidade da Meta (contratos)</Label>
                    <Input type="number" min="1" value={formQtd} onChange={(e) => setFormQtd(e.target.value)} placeholder="Ex: 8" className="bg-secondary/50" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor por Contrato (R$)</Label>
                    <Input type="number" min="0" step="0.01" value={formValor} onChange={(e) => setFormValor(e.target.value)} placeholder="Ex: 150.00" className="bg-secondary/50" required />
                  </div>
                  <Button type="submit" className="w-full gradient-accent text-primary-foreground font-semibold">Salvar Meta</Button>
                </form>
              </DialogContent>
            </Dialog>
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
    </div>
  );
}
