import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Building2, Phone, User, MapPin, Wrench, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

interface Profile {
  id: string;
  nome: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  novo: { label: "Novo", color: "bg-cyan-500/20 text-cyan-400" },
  primeiro_contato: { label: "1º Contato", color: "bg-purple-500/20 text-purple-400" },
  diagnostico: { label: "Diagnóstico", color: "bg-orange-500/20 text-orange-400" },
  proposta_enviada: { label: "Proposta", color: "bg-pink-500/20 text-pink-400" },
  negociacao: { label: "Negociação", color: "bg-blue-500/20 text-blue-400" },
  fechado_ganho: { label: "Ganho ✓", color: "bg-green-500/20 text-green-400" },
  perdido: { label: "Perdido", color: "bg-destructive/20 text-destructive" },
};

const EMPTY_FORM = {} as Partial<TablesInsert<"leads"> & { endereco?: string; responsible_id?: string; equipamento?: string }>;

export default function Leads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Tables<"leads">[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Tables<"leads"> | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [filterResponsible, setFilterResponsible] = useState<string>("all");

  const fetchLeads = async () => {
    const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    if (data) setLeads(data);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase.from("profiles").select("id, nome");
    if (data) setProfiles(data);
  };

  useEffect(() => { fetchLeads(); fetchProfiles(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome?.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    const { error } = await supabase.from("leads").insert({
      nome: formData.nome.trim(),
      empresa: formData.empresa?.trim() || null,
      endereco: (formData as any).endereco?.trim() || null,
      whatsapp: formData.whatsapp?.trim() || null,
      equipamento: (formData as any).equipamento?.trim() || null,
      interesse: formData.interesse?.trim() || null,
      origem: formData.origem?.trim() || null,
      notas: formData.notas?.trim() || null,
      assigned_user_id: user?.id || null,
      responsible_id: (formData as any).responsible_id || null,
    } as any);

    if (error) {
      toast.error("Erro ao criar lead");
      console.error(error);
      return;
    }

    toast.success("Lead criado!");
    setOpen(false);
    setFormData(EMPTY_FORM);
    fetchLeads();
  };

  const openEdit = (lead: Tables<"leads">) => {
    setEditingLead(lead);
    setFormData({
      nome: lead.nome,
      empresa: lead.empresa || "",
      endereco: (lead as any).endereco || "",
      whatsapp: lead.whatsapp || "",
      equipamento: (lead as any).equipamento || "",
      interesse: lead.interesse || "",
      origem: lead.origem || "",
      notas: lead.notas || "",
      responsible_id: (lead as any).responsible_id || "",
    });
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLead || !formData.nome?.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    const { error } = await supabase.from("leads").update({
      nome: formData.nome.trim(),
      empresa: formData.empresa?.trim() || null,
      endereco: (formData as any).endereco?.trim() || null,
      whatsapp: formData.whatsapp?.trim() || null,
      equipamento: (formData as any).equipamento?.trim() || null,
      interesse: formData.interesse?.trim() || null,
      origem: formData.origem?.trim() || null,
      notas: formData.notas?.trim() || null,
      responsible_id: (formData as any).responsible_id || null,
    } as any).eq("id", editingLead.id);

    if (error) {
      toast.error("Erro ao atualizar lead");
      console.error(error);
      return;
    }

    toast.success("Lead atualizado!");
    setEditOpen(false);
    setEditingLead(null);
    setFormData(EMPTY_FORM);
    fetchLeads();
  };

  const updateStatus = async (leadId: string, newStatus: string) => {
    const { error } = await supabase.from("leads").update({ status: newStatus }).eq("id", leadId);
    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }
    fetchLeads();
  };

  const getCountByStatus = (status: string) => filteredLeads.filter((l) => l.status === status).length;

  const filteredLeads = filterResponsible === "all"
    ? leads
    : filterResponsible === "none"
      ? leads.filter((l) => !(l as any).responsible_id)
      : leads.filter((l) => (l as any).responsible_id === filterResponsible);

  const renderLeadForm = (onSubmit: (e: React.FormEvent) => Promise<void>, submitLabel: string) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nome *</Label>
          <Input value={formData.nome || ""} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} maxLength={100} required className="bg-secondary/50" />
        </div>
        <div className="space-y-2">
          <Label>Empresa</Label>
          <Input value={formData.empresa || ""} onChange={(e) => setFormData({ ...formData, empresa: e.target.value })} maxLength={100} className="bg-secondary/50" />
        </div>
        <div className="space-y-2">
          <Label>Endereço</Label>
          <Input value={(formData as any).endereco || ""} onChange={(e) => setFormData({ ...formData, endereco: e.target.value } as any)} maxLength={200} className="bg-secondary/50" />
        </div>
        <div className="space-y-2">
          <Label>WhatsApp</Label>
          <Input value={formData.whatsapp || ""} onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })} maxLength={20} className="bg-secondary/50" />
        </div>
        <div className="space-y-2">
          <Label>Equipamento</Label>
          <Input value={(formData as any).equipamento || ""} onChange={(e) => setFormData({ ...formData, equipamento: e.target.value } as any)} placeholder="Ex: Impressora, Computador..." maxLength={255} className="bg-secondary/50" />
        </div>
        <div className="space-y-2">
          <Label>Interesse</Label>
          <Input value={formData.interesse || ""} onChange={(e) => setFormData({ ...formData, interesse: e.target.value })} placeholder="Ex: Site, Sistema, App..." maxLength={100} className="bg-secondary/50" />
        </div>
        <div className="space-y-2">
          <Label>Responsável</Label>
          <Select value={(formData as any).responsible_id || ""} onValueChange={(v) => setFormData({ ...formData, responsible_id: v } as any)}>
            <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Origem</Label>
          <Input value={formData.origem || ""} onChange={(e) => setFormData({ ...formData, origem: e.target.value })} placeholder="Ex: Google, Indicação..." maxLength={100} className="bg-secondary/50" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Observação? (Opcional)</Label>
        <Textarea value={formData.notas || ""} onChange={(e) => setFormData({ ...formData, notas: e.target.value })} maxLength={1000} rows={3} className="bg-secondary/50" />
      </div>
      <Button type="submit" className="w-full gradient-accent text-primary-foreground font-semibold">
        {submitLabel}
      </Button>
    </form>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold neon-glow">Leads</h1>
          <p className="text-muted-foreground text-sm mt-1">{filteredLeads.length} leads no funil</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={filterResponsible} onValueChange={setFilterResponsible}>
            <SelectTrigger className="h-9 w-44 text-xs bg-secondary/50">
              <SelectValue placeholder="Filtrar responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="none">Sem responsável</SelectItem>
              {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-accent text-primary-foreground font-semibold">
                <Plus className="h-4 w-4 mr-2" /> Novo Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-panel border-border max-w-lg">
              <DialogHeader>
                <DialogTitle className="neon-glow">Novo Lead</DialogTitle>
              </DialogHeader>
              {renderLeadForm(handleCreate, "Criar Lead")}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) { setEditingLead(null); setFormData(EMPTY_FORM); } }}>
        <DialogContent className="glass-panel border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="neon-glow">Editar Lead</DialogTitle>
          </DialogHeader>
          {renderLeadForm(handleEdit, "Salvar Alterações")}
        </DialogContent>
      </Dialog>

      {/* Status summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Object.entries(STATUS_LABELS).map(([key, { label, color }]) => (
          <Card key={key} className="glass-panel neon-border">
            <CardContent className="p-4 flex items-center justify-between">
              <span className={`text-xs font-semibold rounded-full px-2 py-1 ${color}`}>{label}</span>
              <span className="text-2xl font-bold text-foreground">{getCountByStatus(key)}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Leads list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredLeads.map((lead) => {
          const status = STATUS_LABELS[lead.status] || { label: lead.status, color: "bg-secondary text-muted-foreground" };
          return (
            <Card key={lead.id} className="glass-panel neon-border hover:border-primary/30 transition-colors">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{lead.nome}</p>
                    {lead.empresa && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Building2 className="h-3 w-3" />
                        <span className="truncate">{lead.empresa}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(lead)} className="text-muted-foreground hover:text-primary transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <span className={`text-[10px] font-semibold rounded-full px-2 py-1 whitespace-nowrap ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {(lead as any).endereco && (
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{(lead as any).endereco}</span>
                  )}
                  {lead.whatsapp && (
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.whatsapp}</span>
                  )}
                  {(lead as any).equipamento && (
                    <span className="flex items-center gap-1"><Wrench className="h-3 w-3" />{(lead as any).equipamento}</span>
                  )}
                  {lead.interesse && (
                    <span className="inline-block text-[10px] font-medium chip-media rounded-full px-2 py-0.5">{lead.interesse}</span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2">
                  {(lead as any).responsible_id ? (
                    <div className="flex items-center gap-1 text-xs font-medium text-primary">
                      <User className="h-3 w-3" />
                      <span className="truncate">{profiles.find((p) => p.id === (lead as any).responsible_id)?.nome || "—"}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sem responsável</span>
                  )}
                  <Select value={lead.status} onValueChange={(v) => updateStatus(lead.id, v)}>
                    <SelectTrigger className="h-7 w-32 text-xs bg-secondary/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredLeads.length === 0 && (
        <Card className="glass-panel neon-border">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Plus className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum lead ainda. Clique em "Novo Lead" para começar.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
