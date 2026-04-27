import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Filter, RefreshCw, Search, ShieldCheck, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

type AuditRecord = {
  id: string;
  trigger_name: string;
  function_name: string;
  table_name: string;
  event_type: string;
  user_id: string | null;
  lead_id: string | null;
  status_before: string | null;
  status_after: string | null;
  success: boolean;
  error_message: string | null;
  error_details: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
};

type Profile = { id: string; nome: string };
type Lead = { id: string; nome: string; empresa: string | null };

const triggerLabels: Record<string, string> = {
  on_lead_ganho: "Lead ganho",
  on_lead_novo: "Lead novo",
  trg_set_lead_won_at: "Registro won_at",
  trg_set_lead_won_at_insert: "Won_at inicial",
};

const statusLabels: Record<string, string> = {
  novo: "Novo",
  primeiro_contato: "1º Contato",
  diagnostico: "Diagnóstico",
  proposta_enviada: "Proposta enviada",
  negociacao: "Negociação",
  fechado_ganho: "Ganho",
  perdido: "Perdido",
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));

export default function Auditoria() {
  const { role } = useAuth();
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [triggerFilter, setTriggerFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");

  const isAdmin = role === "admin";

  const profileById = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile.nome])), [profiles]);
  const leadById = useMemo(() => new Map(leads.map((lead) => [lead.id, lead])), [leads]);

  const fetchAudit = async () => {
    if (!isAdmin) return;
    setLoading(true);

    const [auditRes, profilesRes, leadsRes] = await Promise.all([
      (supabase as any).from("trigger_audit").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("profiles").select("id, nome"),
      supabase.from("leads").select("id, nome, empresa"),
    ]);

    if (auditRes.error) {
      toast.error("Erro ao carregar auditoria: " + auditRes.error.message);
      setRecords([]);
    } else {
      setRecords((auditRes.data || []) as AuditRecord[]);
    }

    if (profilesRes.data) setProfiles(profilesRes.data);
    if (leadsRes.data) setLeads(leadsRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchAudit();
  }, [isAdmin]);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return records.filter((record) => {
      if (triggerFilter !== "all" && record.trigger_name !== triggerFilter) return false;
      if (resultFilter === "success" && !record.success) return false;
      if (resultFilter === "failed" && record.success) return false;

      if (!normalizedSearch) return true;

      const lead = record.lead_id ? leadById.get(record.lead_id) : null;
      const userName = record.user_id ? profileById.get(record.user_id) : "";
      const searchable = [
        record.trigger_name,
        record.function_name,
        record.event_type,
        record.status_before,
        record.status_after,
        record.error_message,
        record.error_details,
        record.user_id,
        record.lead_id,
        userName,
        lead?.nome,
        lead?.empresa,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedSearch);
    });
  }, [leadById, profileById, records, resultFilter, search, triggerFilter]);

  const stats = useMemo(() => {
    const failed = filteredRecords.filter((record) => !record.success).length;
    const successful = filteredRecords.length - failed;
    const uniqueUsers = new Set(filteredRecords.map((record) => record.user_id).filter(Boolean)).size;
    const uniqueLeads = new Set(filteredRecords.map((record) => record.lead_id).filter(Boolean)).size;
    return { failed, successful, uniqueUsers, uniqueLeads };
  }, [filteredRecords]);

  const triggers = useMemo(() => Array.from(new Set(records.map((record) => record.trigger_name))).sort(), [records]);

  const getUserName = (userId: string | null) => {
    if (!userId) return "Sistema";
    return profileById.get(userId) || userId.slice(0, 8);
  };

  const getLeadName = (leadId: string | null) => {
    if (!leadId) return "—";
    const lead = leadById.get(leadId);
    if (!lead) return leadId.slice(0, 8);
    return lead.empresa ? `${lead.nome} · ${lead.empresa}` : lead.nome;
  };

  if (!isAdmin) {
    return (
      <main className="space-y-6 p-4 md:p-6">
        <Card className="glass-panel neon-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Auditoria restrita
            </CardTitle>
            <CardDescription>Somente administradores podem visualizar os registros de auditoria.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="space-y-6 p-4 md:p-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <ShieldCheck className="h-4 w-4" />
            Auditoria administrativa
          </div>
          <h1 className="text-2xl font-bold tracking-normal text-foreground md:text-3xl">Triggers de Leads</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Registro por usuário e por lead dos disparos das automações de novo lead, ganho e atualização do won_at.
          </p>
        </div>
        <Button onClick={fetchAudit} disabled={loading} className="gap-2 self-start lg:self-auto">
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Atualizar
        </Button>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="glass-panel">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Sucessos</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{stats.successful}</p>
            </div>
            <CheckCircle2 className="h-7 w-7 text-primary" />
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Falhas</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{stats.failed}</p>
            </div>
            <XCircle className="h-7 w-7 text-destructive" />
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Usuários</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{stats.uniqueUsers}</p>
            </div>
            <Filter className="h-7 w-7 text-accent" />
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Leads</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{stats.uniqueLeads}</p>
            </div>
            <AlertTriangle className="h-7 w-7 text-primary" />
          </CardContent>
        </Card>
      </section>

      <Card className="glass-panel neon-border">
        <CardHeader className="gap-4">
          <div>
            <CardTitle>Eventos auditados</CardTitle>
            <CardDescription>Últimos 300 registros, com filtros por trigger, resultado, usuário, lead e erro.</CardDescription>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_220px_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por usuário, lead, trigger ou erro"
                className="pl-9"
              />
            </div>
            <Select value={triggerFilter} onValueChange={setTriggerFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Trigger" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as triggers</SelectItem>
                {triggers.map((trigger) => (
                  <SelectItem key={trigger} value={trigger}>
                    {triggerLabels[trigger] || trigger}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={resultFilter} onValueChange={setResultFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Resultado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="success">Sucesso</SelectItem>
                <SelectItem value="failed">Falha</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Mensagem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-28 text-center text-muted-foreground">
                    Carregando auditoria...
                  </TableCell>
                </TableRow>
              ) : filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-28 text-center text-muted-foreground">
                    Nenhum registro encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="min-w-32 text-muted-foreground">{formatDateTime(record.created_at)}</TableCell>
                    <TableCell className="min-w-40">
                      <div className="font-medium text-foreground">{triggerLabels[record.trigger_name] || record.trigger_name}</div>
                      <div className="text-xs text-muted-foreground">{record.function_name}</div>
                    </TableCell>
                    <TableCell className="min-w-36 text-foreground">{getUserName(record.user_id)}</TableCell>
                    <TableCell className="min-w-56 text-foreground">{getLeadName(record.lead_id)}</TableCell>
                    <TableCell className="min-w-40 text-sm text-muted-foreground">
                      {statusLabels[record.status_before || ""] || record.status_before || "—"}
                      <span className="px-2">→</span>
                      {statusLabels[record.status_after || ""] || record.status_after || "—"}
                    </TableCell>
                    <TableCell>
                      {record.success ? (
                        <Badge className="gap-1" variant="secondary">
                          <CheckCircle2 className="h-3 w-3" />
                          Sucesso
                        </Badge>
                      ) : (
                        <Badge className="gap-1" variant="destructive">
                          <XCircle className="h-3 w-3" />
                          Falha
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="min-w-72 max-w-md">
                      <div className={record.success ? "text-sm text-muted-foreground" : "text-sm font-medium text-destructive"}>
                        {record.error_message || "Sem erro registrado"}
                      </div>
                      {record.error_details && <div className="mt-1 text-xs text-muted-foreground">Código: {record.error_details}</div>}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}