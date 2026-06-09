import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LogRow {
  id: string;
  created_at: string;
  user_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  mes: number | null;
  ano: number | null;
  before: any;
  after: any;
  changes: any;
}

const ENTITY_LABEL: Record<string, string> = { meta: "Meta", tier: "Faixa", apuracao: "Apuração" };
const ACTION_COLOR: Record<string, string> = {
  create: "bg-green-500/20 text-green-600",
  update: "bg-blue-500/20 text-blue-600",
  delete: "bg-red-500/20 text-red-600",
  close: "bg-amber-500/20 text-amber-600",
  reopen: "bg-purple-500/20 text-purple-600",
};

export function AuditoriaMetasTab() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("meta_audit_log").select("*").order("created_at", { ascending: false }).limit(200);
      setRows((data as LogRow[]) || []);
      const { data: prof } = await supabase.from("profiles").select("id, nome");
      const map: Record<string, string> = {};
      (prof || []).forEach((p: any) => { map[p.id] = p.nome; });
      setProfiles(map);
      setLoading(false);
    })();
  }, []);

  const toggle = (id: string) => {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  };

  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4 text-primary" /> Auditoria de Metas e Faixas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma alteração registrada.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Quando</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Período</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const isOpen = expanded.has(r.id);
                return (
                  <>
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => toggle(r.id)}>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-6 w-6">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-sm">{r.user_id ? (profiles[r.user_id] || "—") : "Sistema"}</TableCell>
                      <TableCell>{ENTITY_LABEL[r.entity_type] || r.entity_type}</TableCell>
                      <TableCell>
                        <Badge className={ACTION_COLOR[r.action] || ""}>{r.action}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.mes && r.ano ? `${String(r.mes).padStart(2, "0")}/${r.ano}` : "—"}
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow key={r.id + "-d"}>
                        <TableCell colSpan={6} className="bg-muted/30">
                          <div className="text-xs space-y-1">
                            {r.changes && Object.keys(r.changes).length > 0 ? (
                              <div className="space-y-1">
                                {Object.entries(r.changes).map(([k, v]: any) => (
                                  <div key={k} className="flex gap-2 items-baseline">
                                    <span className="font-mono font-semibold min-w-[160px]">{k}</span>
                                    {v?.before !== undefined ? (
                                      <>
                                        <span className="text-red-500 line-through">{JSON.stringify(v.before)}</span>
                                        <span>→</span>
                                        <span className="text-green-500">{JSON.stringify(v.after)}</span>
                                      </>
                                    ) : (
                                      <span className="text-green-500">{JSON.stringify(v)}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-muted-foreground">Sem detalhes.</p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
