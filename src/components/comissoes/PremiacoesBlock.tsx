import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, CheckCircle2, Clock, XCircle, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  mes: number;
  ano: number;
  isAdmin: boolean;
  currentUserId: string | null;
  filterTecnico?: string; // "todos" or profile id
}

interface ParcelaRow {
  id: string;
  premiacao_id: string;
  numero: number;
  valor: number;
  status: "pendente" | "liberada" | "cancelada";
  liberada_em: string | null;
  ajustada_manualmente: boolean;
  responsavel_id: string | null;
  responsavel_nome: string;
  client_id: string;
  client_nome: string;
  premiacao_status: string;
  premiacao_valor_total: number;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PremiacoesBlock({ mes, ano, isAdmin, currentUserId, filterTecnico }: Props) {
  const [rows, setRows] = useState<ParcelaRow[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    // Buscar premiacoes do mês
    const { data: prems } = await supabase
      .from("premiacoes")
      .select("id, client_id, responsavel_id, valor_total, status, mes_referencia, ano_referencia")
      .eq("mes_referencia", mes)
      .eq("ano_referencia", ano);

    if (!prems || prems.length === 0) { setRows([]); setLoading(false); return; }

    const premIds = prems.map((p: any) => p.id);
    const clientIds = prems.map((p: any) => p.client_id);
    const userIds = Array.from(new Set(prems.map((p: any) => p.responsavel_id).filter(Boolean)));

    const [parcRes, cliRes, profRes] = await Promise.all([
      supabase.from("premiacao_parcelas").select("*").in("premiacao_id", premIds).order("numero"),
      supabase.from("clients").select("id, nome").in("id", clientIds),
      userIds.length > 0
        ? supabase.from("profiles").select("id, nome").in("id", userIds)
        : Promise.resolve({ data: [] } as any),
    ]);

    const cliMap = new Map((cliRes.data || []).map((c: any) => [c.id, c.nome]));
    const profMap = new Map((profRes.data || []).map((p: any) => [p.id, p.nome]));
    const premMap = new Map(prems.map((p: any) => [p.id, p]));

    // collect extra responsavel_ids from parcelas
    const extraUserIds = Array.from(new Set(
      (parcRes.data || []).map((p: any) => p.responsavel_id).filter((id: any) => id && !profMap.has(id))
    ));
    if (extraUserIds.length > 0) {
      const { data: extras } = await supabase.from("profiles").select("id, nome").in("id", extraUserIds);
      (extras || []).forEach((p: any) => profMap.set(p.id, p.nome));
    }

    const all: ParcelaRow[] = (parcRes.data || []).map((p: any) => {
      const prem: any = premMap.get(p.premiacao_id);
      const respId = p.responsavel_id || prem.responsavel_id;
      return {
        id: p.id,
        premiacao_id: p.premiacao_id,
        numero: p.numero,
        valor: Number(p.valor),
        status: p.status,
        liberada_em: p.liberada_em,
        ajustada_manualmente: p.ajustada_manualmente,
        responsavel_id: respId,
        responsavel_nome: (profMap.get(respId) as string) || "—",
        client_id: prem.client_id,
        client_nome: cliMap.get(prem.client_id) || "—",
        premiacao_status: prem.status,
        premiacao_valor_total: Number(prem.valor_total),
      };
    });

    setRows(all);
    setLoading(false);
  };

  useEffect(() => { load(); }, [mes, ano]);

  const filtered = useMemo(() => {
    let r = rows;
    if (!isAdmin && currentUserId) r = r.filter((p) => p.responsavel_id === currentUserId);
    if (isAdmin && filterTecnico && filterTecnico !== "todos") r = r.filter((p) => p.responsavel_id === filterTecnico);
    return r;
  }, [rows, isAdmin, currentUserId, filterTecnico]);

  // Group by responsavel + client
  const grouped = useMemo(() => {
    const map = new Map<string, { responsavel_nome: string; contratos: Map<string, ParcelaRow[]> }>();
    for (const p of filtered) {
      const key = p.responsavel_id || "sem-resp";
      if (!map.has(key)) map.set(key, { responsavel_nome: p.responsavel_nome, contratos: new Map() });
      const g = map.get(key)!;
      if (!g.contratos.has(p.client_id)) g.contratos.set(p.client_id, []);
      g.contratos.get(p.client_id)!.push(p);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].responsavel_nome.localeCompare(b[1].responsavel_nome));
  }, [filtered]);

  const totals = useMemo(() => {
    let liberada = 0, pendente = 0, cancelada = 0;
    for (const p of filtered) {
      if (p.status === "liberada") liberada += p.valor;
      else if (p.status === "pendente") pendente += p.valor;
      else if (p.status === "cancelada") cancelada += p.valor;
    }
    return { liberada, pendente, cancelada };
  }, [filtered]);

  const saveEdit = async (id: string) => {
    const v = parseFloat(editValue);
    if (isNaN(v) || v < 0) { toast.error("Valor inválido"); return; }
    const { error } = await supabase
      .from("premiacao_parcelas")
      .update({ valor: v, ajustada_manualmente: true })
      .eq("id", id);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Parcela atualizada");
    setEditing(null);
    await load();
  };

  const statusBadge = (s: string) => {
    if (s === "liberada") return <Badge className="bg-chart-2/20 text-chart-2"><CheckCircle2 className="h-3 w-3 mr-1" />Liberada</Badge>;
    if (s === "pendente") return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
    return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Cancelada</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
          <span className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            Premiação por Contrato
          </span>
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="text-chart-2 font-semibold">Liberada: {fmt(totals.liberada)}</span>
            <span className="text-muted-foreground">Pendente: {fmt(totals.pendente)}</span>
            {totals.cancelada > 0 && <span className="text-destructive">Cancelada: {fmt(totals.cancelada)}</span>}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!loading && grouped.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma premiação para este período.</p>
        )}
        {grouped.map(([respId, g]) => (
          <div key={respId} className="space-y-2">
            <p className="text-sm font-semibold text-foreground">{g.responsavel_nome}</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Liberada em</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  {isAdmin && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from(g.contratos.entries()).map(([cid, parcelas]) => (
                  parcelas.sort((a, b) => a.numero - b.numero).map((p, idx) => (
                    <TableRow key={p.id}>
                      {idx === 0 ? (
                        <TableCell rowSpan={parcelas.length} className="font-medium align-top">
                          {p.client_nome}
                          {p.premiacao_status === "cancelada" && (
                            <Badge variant="destructive" className="ml-2 text-xs">Cancelado</Badge>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            Total: {fmt(p.premiacao_valor_total)}
                          </div>
                        </TableCell>
                      ) : null}
                      <TableCell>
                        {p.numero}ª {p.ajustada_manualmente && <Badge variant="outline" className="ml-1 text-xs">Ajustada</Badge>}
                      </TableCell>
                      <TableCell>{statusBadge(p.status)}</TableCell>
                      <TableCell className="text-xs">
                        {p.liberada_em ? new Date(p.liberada_em).toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {editing === p.id ? (
                          <div className="flex gap-1 items-center justify-end">
                            <Input
                              type="number"
                              step="0.01"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-24 h-8"
                            />
                            <Button size="icon" variant="ghost" onClick={() => saveEdit(p.id)}>
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setEditing(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <span className={p.status === "liberada" ? "text-chart-2 font-semibold" : ""}>
                            {fmt(p.valor)}
                          </span>
                        )}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          {editing !== p.id && p.status !== "cancelada" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => { setEditing(p.id); setEditValue(String(p.valor)); }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
