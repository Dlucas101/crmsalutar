import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, Mail, Phone, Building2, DollarSign, User, Pencil } from "lucide-react";
import { toast } from "sonner";

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
  responsavel_id: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  nome: string;
}

export default function Clientes() {
  const [clients, setClients] = useState<Client[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [filterMember, setFilterMember] = useState<string>("all");
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [editValues, setEditValues] = useState({ valor_negociado: "", valor_custo: "" });

  const fetchData = async () => {
    const [clientsRes, membersRes] = await Promise.all([
      supabase.from("clients").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, nome"),
    ]);
    if (clientsRes.data) setClients(clientsRes.data as Client[]);
    if (membersRes.data) setMembers(membersRes.data);
  };

  useEffect(() => { fetchData(); }, []);

  // Try to get responsavel from lead if not set on client
  const [leadResponsaveis, setLeadResponsaveis] = useState<Record<string, string>>({});
  useEffect(() => {
    const leadsWithoutResp = clients.filter(c => !c.responsavel_id && c.lead_id);
    if (leadsWithoutResp.length === 0) return;
    const ids = leadsWithoutResp.map(c => c.lead_id!);
    supabase.from("leads").select("id, responsible_id").in("id", ids).then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {};
        data.forEach(l => { if (l.responsible_id) map[l.id] = l.responsible_id; });
        setLeadResponsaveis(map);
      }
    });
  }, [clients]);

  const getResponsavelId = (c: Client) => c.responsavel_id || (c.lead_id ? leadResponsaveis[c.lead_id] : null);
  const getMemberName = (id: string | null | undefined) => members.find(m => m.id === id)?.nome || "—";

  const filteredClients = filterMember === "all"
    ? clients
    : clients.filter(c => getResponsavelId(c) === filterMember);

  const getValorLiquido = (c: Client) => {
    const neg = Number(c.valor_negociado) || 0;
    const custo = Number(c.valor_custo) || 0;
    return neg - custo;
  };

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const openEdit = (c: Client) => {
    setEditClient(c);
    setEditValues({
      valor_negociado: String(c.valor_negociado || ""),
      valor_custo: String(c.valor_custo || ""),
    });
  };

  const handleSave = async () => {
    if (!editClient) return;
    const { error } = await supabase.from("clients").update({
      valor_negociado: Number(editValues.valor_negociado) || 0,
      valor_custo: Number(editValues.valor_custo) || 0,
    }).eq("id", editClient.id);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Valores atualizados!");
    setEditClient(null);
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold neon-glow">Clientes</h1>
          <p className="text-muted-foreground text-sm mt-1">{filteredClients.length} clientes cadastrados</p>
        </div>
        <Select value={filterMember} onValueChange={setFilterMember}>
          <SelectTrigger className="w-[200px] bg-secondary/50">
            <SelectValue placeholder="Filtrar por técnico" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os membros</SelectItem>
            {members.map(m => (
              <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredClients.length === 0 ? (
        <Card className="glass-panel neon-border">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum cliente ainda.</p>
            <p className="text-xs text-muted-foreground mt-1">Clientes são criados automaticamente ao fechar um lead como "Ganho".</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => {
            const responsavelId = getResponsavelId(client);
            const valorNeg = Number(client.valor_negociado) || 0;
            const valorCusto = Number(client.valor_custo) || 0;
            const valorLiquido = getValorLiquido(client);
            return (
              <Card key={client.id} className="glass-panel neon-border hover:border-primary/30 transition-colors">
                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                  <CardTitle className="text-base font-semibold text-foreground">{client.nome}</CardTitle>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(client)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium text-foreground">{getMemberName(responsavelId)}</span>
                  </div>
                  {client.cnpj_cpf && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5" />
                      <span>{client.cnpj_cpf}</span>
                    </div>
                  )}
                  {client.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5" />
                      <span>{client.email}</span>
                    </div>
                  )}
                  {client.whatsapp && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{client.whatsapp}</span>
                    </div>
                  )}
                  {/* Financial info */}
                  <div className="border-t border-border/50 pt-2 mt-2 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Valor negociado</span>
                      <span className="font-medium text-foreground">{formatCurrency(valorNeg)}</span>
                    </div>
                    {valorCusto > 0 && (
                      <div className="flex justify-between text-xs">
                        <span>Valor de custo</span>
                        <span className="font-medium text-destructive">{formatCurrency(valorCusto)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-green-400" />
                        Valor líquido
                      </span>
                      <span className="text-green-400">{formatCurrency(valorLiquido)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editClient} onOpenChange={(open) => { if (!open) setEditClient(null); }}>
        <DialogContent className="glass-panel border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="neon-glow">Editar Valores — {editClient?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Valor negociado (mensalidade)</Label>
              <Input type="number" step="0.01" value={editValues.valor_negociado} onChange={e => setEditValues(v => ({ ...v, valor_negociado: e.target.value }))} className="bg-secondary/50" />
            </div>
            <div className="space-y-2">
              <Label>Valor de custo <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Input type="number" step="0.01" value={editValues.valor_custo} onChange={e => setEditValues(v => ({ ...v, valor_custo: e.target.value }))} className="bg-secondary/50" />
            </div>
            <div className="p-3 rounded-lg bg-secondary/30 text-sm">
              <div className="flex justify-between">
                <span>Valor líquido</span>
                <span className="font-bold text-green-400">
                  {formatCurrency((Number(editValues.valor_negociado) || 0) - (Number(editValues.valor_custo) || 0))}
                </span>
              </div>
            </div>
            <Button onClick={handleSave} className="w-full gradient-accent text-primary-foreground font-semibold">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
