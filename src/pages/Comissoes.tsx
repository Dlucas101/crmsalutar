import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Users, FileText, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";

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
  detalhes: MensalidadeWithClient[];
}

export default function Comissoes() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedTecnico, setSelectedTecnico] = useState<string>("todos");
  const [expandedTecnico, setExpandedTecnico] = useState<string | null>(null);

  const { data: clients } = useQuery({
    queryKey: ["comissoes-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, nome, responsavel_id, valor_custo, lead_id");
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
      const { data } = await supabase.from("profiles").select("id, nome");
      return data || [];
    },
  });

  const { data: leads } = useQuery({
    queryKey: ["comissoes-leads"],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("id, responsible_id");
      return data || [];
    },
  });

  const years = useMemo(() => {
    const currentYear = now.getFullYear();
    return [currentYear - 1, currentYear, currentYear + 1];
  }, []);

  const tecnicoSummaries = useMemo(() => {
    if (!clients || !mensalidades || !profiles) return [];

    const leadsMap = new Map((leads || []).map((l) => [l.id, l.responsible_id]));
    const profilesMap = new Map(profiles.map((p) => [p.id, p.nome]));

    // Build client -> responsavel mapping (with lead fallback)
    const clientMap = new Map(
      clients.map((c) => {
        const responsavel = c.responsavel_id || (c.lead_id ? leadsMap.get(c.lead_id) : null);
        return [c.id, { ...c, responsavel_id_resolved: responsavel }];
      })
    );

    // Filter mensalidades: only <= 3 and matching month/year
    const filtered = mensalidades.filter((m) => {
      if (m.numero_mensalidade > 3) return false;
      const d = new Date(m.data_pagamento);
      return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
    });

    // Group by técnico
    const byTecnico = new Map<string, MensalidadeWithClient[]>();

    for (const m of filtered) {
      const client = clientMap.get(m.client_id);
      if (!client) continue;
      const tecId = client.responsavel_id_resolved;
      if (!tecId) continue;

      const custo = Number(client.valor_custo) || 0;
      const valor = Number(m.valor);
      const comissao = valor - custo;

      const entry: MensalidadeWithClient = {
        id: m.id,
        client_id: m.client_id,
        client_nome: client.nome,
        numero_mensalidade: m.numero_mensalidade,
        data_pagamento: m.data_pagamento,
        valor,
        valor_custo: custo,
        responsavel_id: tecId,
        comissao,
      };

      if (!byTecnico.has(tecId)) byTecnico.set(tecId, []);
      byTecnico.get(tecId)!.push(entry);
    }

    const summaries: TecnicoSummary[] = [];
    for (const [tecId, detalhes] of byTecnico) {
      const uniqueClients = new Set(detalhes.map((d) => d.client_id));
      const valorBruto = detalhes.reduce((s, d) => s + d.valor, 0);
      const totalCustos = detalhes.reduce((s, d) => s + d.valor_custo, 0);

      summaries.push({
        id: tecId,
        nome: profilesMap.get(tecId) || "Desconhecido",
        contratos: uniqueClients.size,
        mensalidades: detalhes.length,
        valorBruto,
        totalCustos,
        comissaoLiquida: valorBruto - totalCustos,
        detalhes: detalhes.sort((a, b) => a.client_nome.localeCompare(b.client_nome)),
      });
    }

    return summaries.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [clients, mensalidades, profiles, leads, selectedMonth, selectedYear]);

  const displayedSummaries = useMemo(() => {
    if (selectedTecnico === "todos") return tecnicoSummaries;
    return tecnicoSummaries.filter((t) => t.id === selectedTecnico);
  }, [tecnicoSummaries, selectedTecnico]);

  const totals = useMemo(() => {
    return displayedSummaries.reduce(
      (acc, t) => ({
        contratos: acc.contratos + t.contratos,
        mensalidades: acc.mensalidades + t.mensalidades,
        valorBruto: acc.valorBruto + t.valorBruto,
        totalCustos: acc.totalCustos + t.totalCustos,
        comissaoLiquida: acc.comissaoLiquida + t.comissaoLiquida,
      }),
      { contratos: 0, mensalidades: 0, valorBruto: 0, totalCustos: 0, comissaoLiquida: 0 }
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
          Cálculo de comissões por técnico/membro baseado nas mensalidades pagas
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m, i) => (
              <SelectItem key={i} value={String(i + 1)}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedTecnico} onValueChange={setSelectedTecnico}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Todos os técnicos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os técnicos</SelectItem>
            {(profiles || []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Mensalidades</p>
              <p className="text-lg font-bold text-foreground">{totals.mensalidades}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Valor Bruto</p>
              <p className="text-lg font-bold text-foreground">{fmt(totals.valorBruto)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-xs text-muted-foreground">Custos</p>
              <p className="text-lg font-bold text-foreground">{fmt(totals.totalCustos)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-chart-2" />
            <div>
              <p className="text-xs text-muted-foreground">Comissão Líquida</p>
              <p className="text-lg font-bold text-chart-2">{fmt(totals.comissaoLiquida)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

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
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Comissão Líquida</p>
                      <p className="text-lg font-bold text-chart-2">{fmt(tec.comissaoLiquida)}</p>
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
                  <div className="px-4 pb-2 flex gap-4 text-xs text-muted-foreground">
                    <span>Bruto: {fmt(tec.valorBruto)}</span>
                    <span>Custos: {fmt(tec.totalCustos)}</span>
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
