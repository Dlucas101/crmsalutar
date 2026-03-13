import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import ClienteCard from "@/components/clientes/ClienteCard";
import ClienteEditDialog from "@/components/clientes/ClienteEditDialog";
import FinancialSummary from "@/components/clientes/FinancialSummary";
import MensalidadesDialog from "@/components/clientes/MensalidadesDialog";

interface Client {
  id: string;
  nome: string;
  cnpj_cpf: string | null;
  email: string | null;
  whatsapp: string | null;
  endereco: string | null;
  lead_id: string | null;
  valor_negociado: number | null;
  valor_custo: number | null;
  valor_ate_vencimento: number | null;
  valor_pago: number | null;
  mensalidades_pagas: number | null;
  responsavel_id: string | null;
  historico: boolean | null;
  dividir_contrato: boolean | null;
  parceiro_id: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  nome: string;
}

export interface Mensalidade {
  id: string;
  client_id: string;
  numero_mensalidade: number;
  valor: number;
  data_pagamento: string;
}

export default function Clientes() {
  const { user, role } = useAuth();
  const isAdmin = role === "admin" || role === "gestor";

  const [clients, setClients] = useState<Client[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [filterMember, setFilterMember] = useState<string>("all");
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [mensalidadesClient, setMensalidadesClient] = useState<Client | null>(null);
  const [mensalidadesMap, setMensalidadesMap] = useState<Record<string, Mensalidade[]>>({});
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  const [editValues, setEditValues] = useState({
    valor_negociado: "", valor_custo: "", valor_ate_vencimento: "", valor_pago: "",
  });
  const [editDividir, setEditDividir] = useState(false);
  const [editParceiroId, setEditParceiroId] = useState<string | null>(null);

  const fetchData = async () => {
    const [clientsRes, membersRes, mensRes] = await Promise.all([
      supabase.from("clients").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, nome"),
      supabase.from("mensalidades").select("*").order("numero_mensalidade", { ascending: true }),
    ]);
    if (clientsRes.data) setClients(clientsRes.data as Client[]);
    if (membersRes.data) setMembers(membersRes.data);
    if (mensRes.data) {
      const map: Record<string, Mensalidade[]> = {};
      (mensRes.data as Mensalidade[]).forEach(m => {
        if (!map[m.client_id]) map[m.client_id] = [];
        map[m.client_id].push(m);
      });
      setMensalidadesMap(map);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Lead responsáveis fallback
  const [leadResp, setLeadResp] = useState<Record<string, string>>({});
  useEffect(() => {
    const need = clients.filter(c => !c.responsavel_id && c.lead_id);
    if (!need.length) return;
    supabase.from("leads").select("id, responsible_id").in("id", need.map(c => c.lead_id!)).then(({ data }) => {
      if (data) {
        const m: Record<string, string> = {};
        data.forEach(l => { if (l.responsible_id) m[l.id] = l.responsible_id; });
        setLeadResp(m);
      }
    });
  }, [clients]);

  const getRespId = (c: Client) => c.responsavel_id || (c.lead_id ? leadResp[c.lead_id] : null);
  const getMemberName = (id: string | null | undefined) => members.find(m => m.id === id)?.nome || "—";

  const myClients = isAdmin
    ? clients
    : clients.filter(c => getRespId(c) === user?.id || c.parceiro_id === user?.id);

  const filteredClients = filterMember === "all"
    ? myClients
    : myClients.filter(c => getRespId(c) === filterMember || c.parceiro_id === filterMember);

  const activeClients = filteredClients.filter(c => !c.historico);
  const historyClients = filteredClients.filter(c => !!c.historico);

  const toggleSelect = (id: string) => {
    setSelectedClientIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const openEdit = (c: Client) => {
    setEditClient(c);
    setEditValues({
      valor_negociado: String(c.valor_negociado ?? ""),
      valor_custo: String(c.valor_custo ?? ""),
      valor_ate_vencimento: String(c.valor_ate_vencimento ?? ""),
      valor_pago: String(c.valor_pago ?? ""),
    });
    setEditDividir(!!c.dividir_contrato);
    setEditParceiroId(c.parceiro_id || null);
  };

  const handleSave = async () => {
    if (!editClient) return;
    const { error } = await supabase.from("clients").update({
      valor_negociado: Number(editValues.valor_negociado) || 0,
      valor_custo: Number(editValues.valor_custo) || 0,
      valor_ate_vencimento: Number(editValues.valor_ate_vencimento) || 0,
      valor_pago: Number(editValues.valor_pago) || 0,
      dividir_contrato: editDividir,
      parceiro_id: editDividir ? editParceiroId : null,
    } as any).eq("id", editClient.id);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Valores atualizados!");
    setEditClient(null);
    fetchData();
  };

  const handleMoveToHistory = async (clientId: string) => {
    const { error } = await supabase.from("clients").update({ historico: true } as any).eq("id", clientId);
    if (error) { toast.error("Erro ao mover para histórico"); return; }
    toast.success("Cliente movido para histórico!");
    fetchData();
  };

  const selectedClients = activeClients.filter(c => selectedClientIds.has(c.id));

  const renderGrid = (list: Client[], showSelection = false) =>
    list.length === 0 ? (
      <Card className="glass-panel neon-border">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum cliente nesta aba.</p>
        </CardContent>
      </Card>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map(c => (
          <ClienteCard
            key={c.id}
            client={c}
            responsavelNome={getMemberName(getRespId(c))}
            parceiroNome={c.dividir_contrato && c.parceiro_id ? getMemberName(c.parceiro_id) : undefined}
            mensalidades={mensalidadesMap[c.id] || []}
            selected={showSelection ? selectedClientIds.has(c.id) : undefined}
            onToggleSelect={showSelection ? () => toggleSelect(c.id) : undefined}
            onEdit={openEdit}
            onMensalidades={(c) => setMensalidadesClient(c as Client)}
            onMoveToHistory={handleMoveToHistory}
          />
        ))}
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold neon-glow">Clientes</h1>
          <p className="text-muted-foreground text-sm mt-1">{myClients.length} clientes</p>
        </div>
        {isAdmin && (
          <Select value={filterMember} onValueChange={setFilterMember}>
            <SelectTrigger className="w-[200px] bg-secondary/50">
              <SelectValue placeholder="Filtrar por membro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os membros</SelectItem>
              {members.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <FinancialSummary
        clients={filteredClients}
        selectedClients={selectedClients}
        mensalidadesMap={mensalidadesMap}
        label={isAdmin && filterMember !== "all" ? `Resumo — ${getMemberName(filterMember)}` : "Resumo financeiro"}
      />

      <Tabs defaultValue="ativos" className="w-full">
        <TabsList>
          <TabsTrigger value="ativos">Ativos ({activeClients.length})</TabsTrigger>
          <TabsTrigger value="historico">Histórico ({historyClients.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="ativos">{renderGrid(activeClients, true)}</TabsContent>
        <TabsContent value="historico">{renderGrid(historyClients)}</TabsContent>
      </Tabs>

      <ClienteEditDialog
        open={!!editClient}
        clientName={editClient?.nome ?? ""}
        values={editValues}
        onChange={setEditValues}
        onSave={handleSave}
        onClose={() => setEditClient(null)}
        dividirContrato={editDividir}
        onDividirContratoChange={setEditDividir}
        parceiroId={editParceiroId}
        onParceiroIdChange={setEditParceiroId}
        members={members}
        currentResponsavelId={editClient ? getRespId(editClient) : null}
      />

      {mensalidadesClient && (
        <MensalidadesDialog
          open={!!mensalidadesClient}
          clientId={mensalidadesClient.id}
          clientName={mensalidadesClient.nome}
          onClose={() => setMensalidadesClient(null)}
          onUpdate={fetchData}
        />
      )}
    </div>
  );
}
