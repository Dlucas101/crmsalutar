import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Users, FileText, TrendingUp, ChevronDown, ChevronUp, Target, Wallet } from "lucide-react";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface MensalidadeWithClient {
  id: string;
  client_id: string;
  client_nome: string;
  numero_mensalidade: number;
  data_pagamento: string;
  valor: number;
  valor_custo: number;
  responsavel_id: string | null;
  comissao: number;
}

interface TecnicoSummary {
  id: string;
  nome: string;
  contratos: number;
  mensalidades: number;
  valorBruto: number;
  totalCustos: number;
  comissaoLiquida: number;
  metaBonus: number;
  superMetaBonus: number;
  totalReceber: number;
  detalhes: MensalidadeWithClient[];
}

export default function Comissoes() {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedTecnico, setSelectedTecnico] = useState<string>("todos");
  const [expandedTecnico, setExpandedTecnico] = useState<string | null>(null);

  const { data: clients } = useQuery({
    queryKey: ["comissoes-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, nome, responsavel_id, valor_custo, lead_id, dividir_contrato, parceiro_id");
      return data || [];
    },
  });

  const { data: mensalidades } = useQuery({
    queryKey: ["comissoes-mensalidades"],
    queryFn: async () => {
      const { data } = await supabase.from("mensalidades").select("*");
      return data || [];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["comissoes-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nome, participa_comissao");
      return data || [];
    },
  });

  // Filter by participa_comissao instead of user_roles
  const participatingProfiles = useMemo(() => {
    if (!profiles) return [];
    return profiles.filter((p: any) => p.participa_comissao !== false);
  }, [profiles]);

  const participatingIds = useMemo(() => {
    return new Set(participatingProfiles.map((p) => p.id));
  }, [participatingProfiles]);

  const { data: leads } = useQuery({
    queryKey: ["comissoes-leads"],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("id, responsible_id, status, updated_at");
      return data || [];
    },
  });

  const { data: metas } = useQuery({
    queryKey: ["comissoes-metas", selectedMonth, selectedYear],
    queryFn: async () => {
      const { data } = await supabase
        .from("metas")
        .select("*")
        .eq("mes", selectedMonth)
        .eq("ano", selectedYear)
        .maybeSingle();
      return data;
    },
  });

  const years = useMemo(() => {
    const currentYear = now.getFullYear();
    return [currentYear - 1, currentYear, currentYear + 1];
  }, []);

  // Count leads fechado_ganho per responsible in the selected month
  const leadsGanhoByTecnico = useMemo(() => {
    if (!leads) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const l of leads) {
      if (l.status !== "fechado_ganho" || !l.responsible_id) continue;
      if (!participatingIds.has(l.responsible_id)) continue;
      const d = new Date(l.updated_at);
      if (d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear) {
        map.set(l.responsible_id, (map.get(l.responsible_id) || 0) + 1);
      }
    }
    return map;
  }, [leads, selectedMonth, selectedYear, participatingIds]);

  const totalLeadsGanho = useMemo(() => {
    let total = 0;
    for (const count of leadsGanhoByTecnico.values()) total += count;
    return total;
  }, [leadsGanhoByTecnico]);

  const metaAtingida = metas ? totalLeadsGanho >= metas.quantidade_meta && metas.quantidade_meta > 0 : false;
  const superMetaQtd = metas ? Number((metas as any).meta_bonus_quantidade) || 0 : 0;
  const superMetaAtingida = superMetaQtd > 0 && totalLeadsGanho >= superMetaQtd;
  const superMetaBonusValor = metas ? Number((metas as any).meta_bonus_valor) || 0 : 0;
  const superMetaDescricao = metas ? (metas as any).meta_bonus_descricao as string | null : null;

  const tecnicoSummaries = useMemo(() => {
    if (!clients || !mensalidades || !participatingProfiles.length) return [];

    const leadsMap = new Map((leads || []).map((l) => [l.id, l.responsible_id]));
    const profilesMap = new Map(participatingProfiles.map((p) => [p.id, p.nome]));

    const clientMap = new Map(
      clients.map((c) => {
        const responsavel = c.responsavel_id || (c.lead_id ? leadsMap.get(c.lead_id) : null);
        return [c.id, { ...c, responsavel_id_resolved: responsavel }];
      })
    );

    const filtered = mensalidades.filter((m) => {
      if (m.numero_mensalidade > 3) return false;
      const d = new Date(m.data_pagamento);
      return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
    });

    const byTecnico = new Map<string, MensalidadeWithClient[]>();

    for (const m of filtered) {
      const client = clientMap.get(m.client_id);
      if (!client) continue;
      const tecId = client.responsavel_id_resolved;
      if (!tecId) continue;

      const custo = Number(client.valor_custo) || 0;
      const valor = Number(m.valor);
      const isDividido = !!(client as any).dividir_contrato && !!(client as any).parceiro_id;
      const comissao = isDividido ? (valor - custo) / 2 : valor - custo;

      const entry: MensalidadeWithClient = {
        id: m.id,
        client_id: m.client_id,
        client_nome: client.nome + (isDividido ? " (50%)" : ""),
        numero_mensalidade: m.numero_mensalidade,
        data_pagamento: m.data_pagamento,
        valor: isDividido ? valor / 2 : valor,
        valor_custo: isDividido ? custo / 2 : custo,
        responsavel_id: tecId,
        comissao,
      };

      if (!byTecnico.has(tecId)) byTecnico.set(tecId, []);
      byTecnico.get(tecId)!.push(entry);

      // If contract is split, also add entry for the partner
      if (isDividido) {
        const partnerId = (client as any).parceiro_id as string;
        if (partnerId && partnerId !== tecId) {
          const partnerEntry: MensalidadeWithClient = {
            ...entry,
            id: m.id + "-partner",
            client_nome: client.nome + " (50%)",
            responsavel_id: partnerId,
          };
          if (!byTecnico.has(partnerId)) byTecnico.set(partnerId, []);
          byTecnico.get(partnerId)!.push(partnerEntry);
        }
      }
    }

    const valorContratoMeta = metas ? Number(metas.valor_contrato) : 0;

    const summaries: TecnicoSummary[] = [];
    for (const [tecId, detalhes] of byTecnico) {
      const uniqueClients = new Set(detalhes.map((d) => d.client_id));
      const valorBruto = detalhes.reduce((s, d) => s + d.valor, 0);
      const totalCustos = detalhes.reduce((s, d) => s + d.valor_custo, 0);
      const comissaoLiquida = valorBruto - totalCustos;

      const leadsGanhoCount = leadsGanhoByTecnico.get(tecId) || 0;
      const metaBonus = metaAtingida ? leadsGanhoCount * valorContratoMeta : 0;
      const superMetaBonus = superMetaAtingida && superMetaBonusValor > 0 ? leadsGanhoCount * superMetaBonusValor : 0;

      summaries.push({
        id: tecId,
        nome: profilesMap.get(tecId) || "Desconhecido",
        contratos: uniqueClients.size,
        mensalidades: detalhes.length,
        valorBruto,
        totalCustos,
        comissaoLiquida,
        metaBonus,
        superMetaBonus,
        totalReceber: comissaoLiquida + metaBonus + superMetaBonus,
        detalhes: detalhes.sort((a, b) => a.client_nome.localeCompare(b.client_nome)),
      });
    }

    return summaries.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [clients, mensalidades, participatingProfiles, leads, selectedMonth, selectedYear, metas, metaAtingida, superMetaAtingida, superMetaBonusValor, leadsGanhoByTecnico, participatingIds]);

  const displayedSummaries = useMemo(() => {
    let filtered = tecnicoSummaries;

    // Non-admin: only show own commissions
    if (!isAdmin && user) {
      filtered = filtered.filter((t) => t.id === user.id);
    }

    if (isAdmin && selectedTecnico !== "todos") {
      filtered = filtered.filter((t) => t.id === selectedTecnico);
    }

    return filtered;
  }, [tecnicoSummaries, selectedTecnico, isAdmin, user]);

  const totals = useMemo(() => {
    return displayedSummaries.reduce(
      (acc, t) => ({
        contratos: acc.contratos + t.contratos,
        mensalidades: acc.mensalidades + t.mensalidades,
        valorBruto: acc.valorBruto + t.valorBruto,
        totalCustos: acc.totalCustos + t.totalCustos,
        comissaoLiquida: acc.comissaoLiquida + t.comissaoLiquida,
        metaBonus: acc.metaBonus + t.metaBonus,
        superMetaBonus: acc.superMetaBonus + t.superMetaBonus,
        totalReceber: acc.totalReceber + t.totalReceber,
      }),
      { contratos: 0, mensalidades: 0, valorBruto: 0, totalCustos: 0, comissaoLiquida: 0, metaBonus: 0, superMetaBonus: 0, totalReceber: 0 }
    );
  }, [displayedSummaries]);

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const toggleExpand = (id: string) => {
    setExpandedTecnico((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Comissões</h1>
        <p className="text-muted-foreground text-sm">
          {isAdmin
            ? "Cálculo de comissões por técnico/membro baseado nas mensalidades pagas"
            : "Suas comissões baseadas nas mensalidades pagas"}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m, i) => (
              <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isAdmin && (
          <Select value={selectedTecnico} onValueChange={setSelectedTecnico}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todos os técnicos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os técnicos</SelectItem>
              {participatingProfiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {metas && (
          <>
            <Badge variant={metaAtingida ? "default" : "outline"} className={metaAtingida ? "bg-chart-2 text-white" : ""}>
              <Target className="h-3 w-3 mr-1" />
              Meta: {totalLeadsGanho}/{metas.quantidade_meta} contratos
              {metaAtingida ? " ✓" : ""}
            </Badge>
            {superMetaQtd > 0 && (
              <Badge variant={superMetaAtingida ? "default" : "outline"} className={superMetaAtingida ? "bg-amber-500 text-white" : ""}>
                🎯 Super Meta: {totalLeadsGanho}/{superMetaQtd}
                {superMetaAtingida ? " ✓" : ""}
              </Badge>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Contratos</p>
              <p className="text-lg font-bold text-foreground">{totals.contratos}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-chart-2" />
            <div>
              <p className="text-xs text-muted-foreground">Comissão</p>
              <p className="text-lg font-bold text-chart-2">{fmt(totals.comissaoLiquida)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Target className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Metas</p>
              <p className="text-lg font-bold text-foreground">{fmt(totals.metaBonus)}</p>
            </div>
          </CardContent>
        </Card>
        {totals.superMetaBonus > 0 && (
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <span className="text-lg">🎯</span>
              <div>
                <p className="text-xs text-muted-foreground">Super Meta</p>
                <p className="text-lg font-bold text-amber-500">{fmt(totals.superMetaBonus)}</p>
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Wallet className="h-5 w-5 text-chart-2" />
            <div>
              <p className="text-xs text-muted-foreground">Total a Receber</p>
              <p className="text-lg font-bold text-chart-2">{fmt(totals.totalReceber)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Super meta prize description */}
      {superMetaAtingida && superMetaDescricao && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <div>
              <p className="text-sm font-semibold text-foreground">Super Meta Atingida!</p>
              <p className="text-sm text-muted-foreground">Prêmio: {superMetaDescricao}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-technician cards */}
      {displayedSummaries.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhuma comissão encontrada para o período selecionado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {displayedSummaries.map((tec) => (
            <Card key={tec.id}>
              <CardHeader
                className="cursor-pointer p-4"
                onClick={() => toggleExpand(tec.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                      {tec.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <CardTitle className="text-base">{tec.nome}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {tec.contratos} contrato(s) · {tec.mensalidades} mensalidade(s)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-muted-foreground">Comissão</p>
                      <p className="text-sm font-semibold text-chart-2">{fmt(tec.comissaoLiquida)}</p>
                    </div>
                    {tec.metaBonus > 0 && (
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-muted-foreground">Metas</p>
                        <p className="text-sm font-semibold text-primary">{fmt(tec.metaBonus)}</p>
                      </div>
                    )}
                    {tec.superMetaBonus > 0 && (
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-muted-foreground">Super Meta</p>
                        <p className="text-sm font-semibold text-amber-500">{fmt(tec.superMetaBonus)}</p>
                      </div>
                    )}
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total a Receber</p>
                      <p className="text-lg font-bold text-chart-2">{fmt(tec.totalReceber)}</p>
                    </div>
                    {expandedTecnico === tec.id ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardHeader>

              {expandedTecnico === tec.id && (
                <CardContent className="p-0 pb-2">
                  <div className="px-4 pb-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>Bruto: {fmt(tec.valorBruto)}</span>
                    <span>Custos: {fmt(tec.totalCustos)}</span>
                    <span>Comissão: {fmt(tec.comissaoLiquida)}</span>
                    {tec.metaBonus > 0 && (
                      <span className="text-primary font-semibold">Bônus Meta: {fmt(tec.metaBonus)}</span>
                    )}
                    {tec.superMetaBonus > 0 && (
                      <span className="text-amber-500 font-semibold">Super Meta: {fmt(tec.superMetaBonus)}</span>
                    )}
                    <span className="font-semibold text-chart-2">Total: {fmt(tec.totalReceber)}</span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Mensalidade</TableHead>
                        <TableHead>Data Pgto</TableHead>
                        <TableHead className="text-right">Valor Pago</TableHead>
                        <TableHead className="text-right">Custo</TableHead>
                        <TableHead className="text-right">Comissão</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tec.detalhes.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">{d.client_nome}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{d.numero_mensalidade}ª</Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(d.data_pagamento + "T00:00:00").toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-right">{fmt(d.valor)}</TableCell>
                          <TableCell className="text-right">{fmt(d.valor_custo)}</TableCell>
                          <TableCell className="text-right font-semibold text-chart-2">
                            {fmt(d.comissao)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
