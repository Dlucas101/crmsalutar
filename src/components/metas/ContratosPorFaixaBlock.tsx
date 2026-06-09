import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";

interface Props {
  mes: number;
  ano: number;
}

interface Row {
  lead_id: string;
  cliente: string;
  vendedor: string;
  won_at: string;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ContratosPorFaixaBlock({ mes, ano }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [faixa, setFaixa] = useState<{ nome: string; valor_por_contrato: number } | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    (async () => {
      const start = new Date(ano, mes - 1, 1).toISOString();
      const end = new Date(ano, mes, 0, 23, 59, 59).toISOString();
      const [leadsRes, apRes, tiersRes, profilesRes] = await Promise.all([
        supabase.from("leads").select("id, nome, responsible_id, won_at")
          .eq("status", "fechado_ganho").gte("won_at", start).lte("won_at", end),
        supabase.from("meta_apuracao").select("*").eq("mes", mes).eq("ano", ano).maybeSingle(),
        supabase.from("meta_tiers").select("id, nome, valor_por_contrato, meta_id"),
        supabase.from("profiles").select("id, nome, participa_comissao"),
      ]);
      const profMap = new Map<string, any>();
      (profilesRes.data || []).forEach((p: any) => profMap.set(p.id, p));
      const participaIds = new Set((profilesRes.data || []).filter((p: any) => p.participa_comissao !== false).map((p: any) => p.id));

      const filtered = (leadsRes.data || []).filter((l: any) => l.responsible_id && participaIds.has(l.responsible_id));
      setTotal(filtered.length);

      const ap: any = apRes.data;
      const valor = ap?.valor_por_contrato_congelado || 0;
      let nome = "Sem faixa";
      if (ap?.faixa_atingida_id) {
        const t = (tiersRes.data || []).find((x: any) => x.id === ap.faixa_atingida_id);
        if (t) nome = (t as any).nome;
      }
      setFaixa({ nome, valor_por_contrato: Number(valor) });

      setRows(filtered.map((l: any) => ({
        lead_id: l.id,
        cliente: l.nome,
        vendedor: profMap.get(l.responsible_id)?.nome || "—",
        won_at: l.won_at,
      })));
    })();
  }, [mes, ano]);

  const valorUnit = faixa?.valor_por_contrato || 0;

  return (
    <Card className="glass-panel neon-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between flex-wrap gap-2">
          <span className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-400" />
            Contratos do mês — Faixa vigente: {faixa?.nome || "—"}
          </span>
          <Badge variant="outline">{total} contrato(s) • {brl(valorUnit)}/contrato</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">Nenhum contrato neste mês.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Fechamento</TableHead>
                <TableHead className="text-right">Faixa</TableHead>
                <TableHead className="text-right">Valor unitário</TableHead>
                <TableHead className="text-right">Premiação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.lead_id}>
                  <TableCell className="font-medium">{r.cliente}</TableCell>
                  <TableCell>{r.vendedor}</TableCell>
                  <TableCell className="text-xs">{new Date(r.won_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{faixa?.nome || "—"}</TableCell>
                  <TableCell className="text-right">{brl(valorUnit)}</TableCell>
                  <TableCell className="text-right text-green-500 font-semibold">{brl(valorUnit)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
