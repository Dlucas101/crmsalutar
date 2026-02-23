import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Building2, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

const PIPELINE_COLUMNS = [
  { key: "novo", label: "Novo", color: "border-neon-cyan/30" },
  { key: "primeiro_contato", label: "1º Contato", color: "border-neon-purple/30" },
  { key: "diagnostico", label: "Diagnóstico", color: "border-neon-orange/30" },
  { key: "proposta_enviada", label: "Proposta", color: "border-neon-pink/30" },
  { key: "negociacao", label: "Negociação", color: "border-neon-green/30" },
  { key: "fechado_ganho", label: "Ganho ✓", color: "border-neon-green/50" },
  { key: "perdido", label: "Perdido", color: "border-destructive/30" },
];

const INTERESSES = [
  { value: "site", label: "Site" },
  { value: "sistema", label: "Sistema" },
  { value: "app", label: "Aplicativo" },
  { value: "suporte", label: "Suporte" },
  { value: "consultoria", label: "Consultoria" },
];

export default function Leads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Tables<"leads">[]>([]);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<TablesInsert<"leads">>>({});

  const fetchLeads = async () => {
    const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    if (data) setLeads(data);
  };

  useEffect(() => { fetchLeads(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome?.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    const { error } = await supabase.from("leads").insert({
      nome: formData.nome.trim(),
      empresa: formData.empresa?.trim() || null,
      cargo: formData.cargo?.trim() || null,
      whatsapp: formData.whatsapp?.trim() || null,
      email: formData.email?.trim() || null,
      interesse: formData.interesse || null,
      origem: formData.origem?.trim() || null,
      notas: formData.notas?.trim() || null,
      assigned_user_id: user?.id || null,
    });

    if (error) {
      toast.error("Erro ao criar lead");
      return;
    }

    toast.success("Lead criado!");
    setOpen(false);
    setFormData({});
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

  const getLeadsByStatus = (status: string) => leads.filter((l) => l.status === status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold neon-glow">Pipeline de Leads</h1>
          <p className="text-muted-foreground text-sm mt-1">{leads.length} leads no funil</p>
        </div>
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
            <form onSubmit={handleCreate} className="space-y-4">
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
                  <Label>Cargo</Label>
                  <Input value={formData.cargo || ""} onChange={(e) => setFormData({ ...formData, cargo: e.target.value })} maxLength={100} className="bg-secondary/50" />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input value={formData.whatsapp || ""} onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })} maxLength={20} className="bg-secondary/50" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={formData.email || ""} onChange={(e) => setFormData({ ...formData, email: e.target.value })} maxLength={255} className="bg-secondary/50" />
                </div>
                <div className="space-y-2">
                  <Label>Interesse</Label>
                  <Select value={formData.interesse || ""} onValueChange={(v) => setFormData({ ...formData, interesse: v })}>
                    <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {INTERESSES.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Origem</Label>
                <Input value={formData.origem || ""} onChange={(e) => setFormData({ ...formData, origem: e.target.value })} placeholder="Ex: Google, Indicação, LinkedIn..." maxLength={100} className="bg-secondary/50" />
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea value={formData.notas || ""} onChange={(e) => setFormData({ ...formData, notas: e.target.value })} maxLength={1000} rows={3} className="bg-secondary/50" />
              </div>
              <Button type="submit" className="w-full gradient-accent text-primary-foreground font-semibold">
                Criar Lead
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {PIPELINE_COLUMNS.map((col) => {
          const colLeads = getLeadsByStatus(col.key);
          return (
            <div
              key={col.key}
              className={`flex-shrink-0 w-56 rounded-xl glass-panel border-l-2 ${col.color} p-3 space-y-2`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {col.label}
                </h3>
                <span className="text-xs text-muted-foreground bg-secondary/50 rounded-full px-2 py-0.5">
                  {colLeads.length}
                </span>
              </div>
              <div className="space-y-2 min-h-[100px]">
                {colLeads.map((lead) => (
                  <Card key={lead.id} className="glass-panel neon-border cursor-pointer hover:border-primary/30 transition-colors">
                    <CardContent className="p-3 space-y-2">
                      <p className="font-medium text-sm text-foreground truncate">{lead.nome}</p>
                      {lead.empresa && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          <span className="truncate">{lead.empresa}</span>
                        </div>
                      )}
                      {lead.interesse && (
                        <span className="inline-block text-[10px] font-medium chip-media rounded-full px-2 py-0.5">
                          {lead.interesse}
                        </span>
                      )}
                      {lead.whatsapp && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span>{lead.whatsapp}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
