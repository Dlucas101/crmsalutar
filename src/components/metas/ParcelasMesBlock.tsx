import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Wallet } from "lucide-react";

interface Props {
  mes: number;
  ano: number;
}

interface Parcela {
  id: string;
  numero: number;
  valor: number;
  status: string;
  liberada_em: string | null;
  mensalidade_id: string | null;
  responsavel_id: string | null;
  premiacao: { client_id: string };
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ParcelasMesBlock({ mes, ano }: Props) {
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [clientes, setClientes] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data: prem } = await supabase
        .from("premiacoes")
        .select("id, client_id")
        .eq("mes_referencia", mes)
        .eq("ano_referencia", ano);
      const ids = (prem || []).map((p: any) => p.id);
      if (ids.length === 0) { setParcelas([]); return; }
      const { data: parc } = await supabase
        .from("premiacao_parcelas")
        .select("id, numero, valor, status, liberada_em, mensalidade_id, responsavel_id, premiacao_id")
        .in("premiacao_id", ids)
        .order("numero");

      const premMap = new Map<string, string>();
      (prem || []).forEach((p: any) => premMap.set(p.id, p.client_id));

      const clientIds = Array.from(new Set((prem || []).map((p: any) => p.client_id)));
      const { data: cls } = await supabase.from("clients").select("id, nome").in("id", clientIds);
      const cmap: Record<string, string> = {};
      (cls || []).forEach((c: any) => { cmap[c.id] = c.nome; });
      setClientes(cmap);

      const respIds = Array.from(new Set((parc || []).map((p: any) => p.responsavel_id).filter(Boolean)));
      const { data: profs } = await supabase.from("profiles").select("id, nome").in("id", respIds.length ? respIds : ["00000000-0000-0000-0000-000000000000"]);
      const pmap: Record<string, string> = {};
      (profs || []).forEach((p: any) => { pmap[p.id] = p.nome; });
      setProfiles(pmap);

      setParcelas((parc || []).map((p: any) => ({
        ...p,
        premiacao: { client_id: premMap.get(p.premiacao_id) || "" },
      })));
    })();
  }, [mes, ano]);

  const grupos = {
    liberada: parcelas.filter((p) => p.status === "liberada"),
    pendente: parcelas.filter((p) => p.status === "pendente"),
    cancelada: parcelas.filter((p) => p.status === "cancelada"),
  };

  const totais = {
    liberada: grupos.liberada.reduce((s, p) => s + Number(p.valor), 0),
    pendente: grupos.pendente.reduce((s, p) => s + Number(p.valor), 0),
    cancelada: grupos.cancelada.reduce((s, p) => s + Number(p.valor), 0),
  };

  const renderTable = (rows: Parcela[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cliente</TableHead>
          <TableHead>Vendedor</TableHead>
          <TableHead className="text-center">Parcela</TableHead>
          <TableHead className="text-right">Valor</TableHead>
          <TableHead>Liberada em</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma parcela.</TableCell></TableRow>
        ) : rows.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="font-medium">{clientes[p.premiacao.client_id] || "—"}</TableCell>
            <TableCell>{p.responsavel_id ? (profiles[p.responsavel_id] || "—") : "—"}</TableCell>
            <TableCell className="text-center">{p.numero}/3</TableCell>
            <TableCell className="text-right">{brl(Number(p.valor))}</TableCell>
            <TableCell className="text-xs">{p.liberada_em ? new Date(p.liberada_em).toLocaleDateString("pt-BR") : "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <Card className="glass-panel neon-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" /> Parcelas de Premiação
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="liberada">
          <TabsList>
            <TabsTrigger value="liberada" className="gap-2">
              Liberadas <Badge variant="outline">{grupos.liberada.length} · {brl(totais.liberada)}</Badge>
            </TabsTrigger>
            <TabsTrigger value="pendente" className="gap-2">
              Pendentes <Badge variant="outline">{grupos.pendente.length} · {brl(totais.pendente)}</Badge>
            </TabsTrigger>
            <TabsTrigger value="cancelada" className="gap-2">
              Canceladas <Badge variant="outline">{grupos.cancelada.length} · {brl(totais.cancelada)}</Badge>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="liberada" className="mt-3">{renderTable(grupos.liberada)}</TabsContent>
          <TabsContent value="pendente" className="mt-3">{renderTable(grupos.pendente)}</TabsContent>
          <TabsContent value="cancelada" className="mt-3">{renderTable(grupos.cancelada)}</TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
