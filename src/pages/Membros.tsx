import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tag, Users, UserPlus, Pencil, KeyRound, Mail } from "lucide-react";
import { toast } from "sonner";

interface Profile {
  id: string;
  nome: string;
  avatar_url: string | null;
  custom_role_id: string | null;
  participa_comissao: boolean | null;
}

interface CustomRole {
  id: string;
  nome: string;
}

interface UserRole {
  user_id: string;
  role: string;
}

export default function Membros() {
  const { role, user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [openRole, setOpenRole] = useState(false);
  const [openMember, setOpenMember] = useState(false);
  const [memberForm, setMemberForm] = useState({ nome: "", email: "", password: "" });

  // Edit states
  const [editMember, setEditMember] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", email: "", password: "" });
  const [editCurrentEmail, setEditCurrentEmail] = useState("");
  const [openEdit, setOpenEdit] = useState(false);

  // Self password change
  const [openSelfPassword, setOpenSelfPassword] = useState(false);
  const [selfPasswordForm, setSelfPasswordForm] = useState({ current: "", newPassword: "", confirm: "" });

  const isAdmin = role === "admin";

  const fetchAll = async () => {
    const [profilesRes, rolesRes, userRolesRes] = await Promise.all([
      supabase.from("profiles").select("id, nome, avatar_url, custom_role_id, participa_comissao"),
      supabase.from("custom_roles").select("id, nome").order("nome"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (profilesRes.data) setProfiles(profilesRes.data);
    if (rolesRes.data) setCustomRoles(rolesRes.data);
    if (userRolesRes.data) setUserRoles(userRolesRes.data);
  };

  useEffect(() => { fetchAll(); }, []);

  const createCustomRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    const { error } = await supabase.from("custom_roles").insert({ nome: newRoleName.trim() });
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Função já existe" : "Erro ao criar função");
      return;
    }
    toast.success("Função criada!");
    setNewRoleName("");
    setOpenRole(false);
    fetchAll();
  };

  const createMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberForm.nome.trim() || !memberForm.email.trim() || !memberForm.password.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }
    if (memberForm.password.length < 6) {
      toast.error("Senha deve ter pelo menos 6 caracteres");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: memberForm.email.trim(),
      password: memberForm.password,
      options: { data: { nome: memberForm.nome.trim() } },
    });

    if (error) {
      toast.error(error.message.includes("already") ? "Email já cadastrado" : "Erro ao criar membro: " + error.message);
      return;
    }

    toast.success("Membro criado! Um email de confirmação foi enviado.");
    setMemberForm({ nome: "", email: "", password: "" });
    setOpenMember(false);
    setTimeout(() => fetchAll(), 2000);
  };

  const updateMemberRole = async (profileId: string, customRoleId: string) => {
    const { error } = await supabase.from("profiles").update({ custom_role_id: customRoleId || null }).eq("id", profileId);
    if (error) {
      toast.error("Erro ao atualizar");
      return;
    }
    toast.success("Função atualizada!");
    fetchAll();
  };

  const toggleParticipaComissao = async (profileId: string, currentValue: boolean | null) => {
    const newValue = !(currentValue ?? true);
    const { error } = await supabase.from("profiles").update({ participa_comissao: newValue }).eq("id", profileId);
    if (error) {
      toast.error("Erro ao atualizar");
      return;
    }
    toast.success(newValue ? "Membro agora participa das comissões/metas" : "Membro removido das comissões/metas");
    fetchAll();
  };

  const handleOpenEdit = async (member: Profile) => {
    setEditMember(member);
    setEditForm({ nome: member.nome || "", email: "", password: "" });
    setEditCurrentEmail("");
    setOpenEdit(true);

    const { data } = await supabase.functions.invoke("admin-update-user", {
      body: { user_id: member.id, action: "get_email" },
    });
    if (data?.email) {
      setEditCurrentEmail(data.email);
    }
  };

  const handleAdminEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMember) return;
    if (!editForm.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (editForm.password && editForm.password.length < 6) {
      toast.error("Senha deve ter pelo menos 6 caracteres");
      return;
    }

    const body: Record<string, string> = { user_id: editMember.id, nome: editForm.nome.trim() };
    if (editForm.email.trim()) body.email = editForm.email.trim();
    if (editForm.password) body.password = editForm.password;

    const { data, error } = await supabase.functions.invoke("admin-update-user", { body });

    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Erro ao atualizar membro");
      return;
    }

    toast.success("Membro atualizado!");
    setOpenEdit(false);
    setEditMember(null);
    fetchAll();
  };

  const handleSelfPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selfPasswordForm.newPassword || !selfPasswordForm.confirm) {
      toast.error("Preencha todos os campos");
      return;
    }
    if (selfPasswordForm.newPassword.length < 6) {
      toast.error("Senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (selfPasswordForm.newPassword !== selfPasswordForm.confirm) {
      toast.error("As senhas não coincidem");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: selfPasswordForm.newPassword });
    if (error) {
      toast.error("Erro ao alterar senha: " + error.message);
      return;
    }

    toast.success("Senha alterada com sucesso!");
    setSelfPasswordForm({ current: "", newPassword: "", confirm: "" });
    setOpenSelfPassword(false);
  };

  const getRoleName = (customRoleId: string | null) => {
    if (!customRoleId) return "—";
    return customRoles.find((r) => r.id === customRoleId)?.nome || "—";
  };

  const getSystemRole = (userId: string) => {
    const ur = userRoles.find((r) => r.user_id === userId);
    return ur?.role || "—";
  };

  const SYSTEM_ROLE_LABELS: Record<string, string> = {
    admin: "Admin",
    gestor: "Gestor",
    suporte: "Suporte",
    desenvolvedor: "Dev",
    vendas: "Vendas",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold neon-glow">Membros</h1>
          <p className="text-muted-foreground text-sm mt-1">{profiles.length} membros</p>
        </div>
        <div className="flex gap-2">
          {!isAdmin && (
            <Dialog open={openSelfPassword} onOpenChange={setOpenSelfPassword}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <KeyRound className="h-4 w-4 mr-2" /> Alterar Minha Senha
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-panel border-border max-w-sm">
                <DialogHeader>
                  <DialogTitle className="neon-glow">Alterar Senha</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSelfPasswordChange} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nova Senha</Label>
                    <Input type="password" value={selfPasswordForm.newPassword} onChange={(e) => setSelfPasswordForm({ ...selfPasswordForm, newPassword: e.target.value })} placeholder="Mínimo 6 caracteres" minLength={6} required className="bg-secondary/50" />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirmar Nova Senha</Label>
                    <Input type="password" value={selfPasswordForm.confirm} onChange={(e) => setSelfPasswordForm({ ...selfPasswordForm, confirm: e.target.value })} placeholder="Repita a nova senha" minLength={6} required className="bg-secondary/50" />
                  </div>
                  <Button type="submit" className="w-full gradient-accent text-primary-foreground font-semibold">Alterar Senha</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}

          {isAdmin && (
            <>
              <Dialog open={openMember} onOpenChange={setOpenMember}>
                <DialogTrigger asChild>
                  <Button className="gradient-accent text-primary-foreground font-semibold">
                    <UserPlus className="h-4 w-4 mr-2" /> Novo Membro
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass-panel border-border max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="neon-glow">Novo Membro</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={createMember} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nome</Label>
                      <Input value={memberForm.nome} onChange={(e) => setMemberForm({ ...memberForm, nome: e.target.value })} placeholder="Nome completo" maxLength={100} required className="bg-secondary/50" />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" value={memberForm.email} onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })} placeholder="email@exemplo.com" required className="bg-secondary/50" />
                    </div>
                    <div className="space-y-2">
                      <Label>Senha</Label>
                      <Input type="password" value={memberForm.password} onChange={(e) => setMemberForm({ ...memberForm, password: e.target.value })} placeholder="Mínimo 6 caracteres" minLength={6} required className="bg-secondary/50" />
                    </div>
                    <Button type="submit" className="w-full gradient-accent text-primary-foreground font-semibold">Criar Membro</Button>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={openRole} onOpenChange={setOpenRole}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Tag className="h-4 w-4 mr-2" /> Nova Função
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass-panel border-border max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="neon-glow">Nova Função</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={createCustomRole} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nome da Função</Label>
                      <Input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="Ex: Gerente Comercial" maxLength={50} required className="bg-secondary/50" />
                    </div>
                    <Button type="submit" className="w-full gradient-accent text-primary-foreground font-semibold">Criar Função</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      {/* Admin edit dialog */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent className="glass-panel border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="neon-glow">Editar Membro</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdminEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} placeholder="Nome completo" maxLength={100} required className="bg-secondary/50" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                Email atual
              </Label>
              <p className="text-sm text-foreground bg-secondary/30 rounded-md px-3 py-2 border border-border/50">
                {editCurrentEmail || "Carregando..."}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Novo Email <span className="text-muted-foreground font-normal">(deixe vazio para manter)</span></Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} placeholder="novo@email.com" className="bg-secondary/50" />
            </div>
            <div className="space-y-2">
              <Label>Nova Senha <span className="text-muted-foreground font-normal">(deixe vazio para manter)</span></Label>
              <Input type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} placeholder="Mínimo 6 caracteres" className="bg-secondary/50" />
            </div>
            <Button type="submit" className="w-full gradient-accent text-primary-foreground font-semibold">Salvar Alterações</Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profiles.map((member) => (
          <Card key={member.id} className="glass-panel neon-border hover:border-primary/30 transition-colors">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full gradient-accent flex items-center justify-center text-sm font-bold text-primary-foreground">
                  {member.nome?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{member.nome || "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground">
                    {SYSTEM_ROLE_LABELS[getSystemRole(member.id)] || getSystemRole(member.id)}
                  </p>
                </div>
                {isAdmin && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEdit(member)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Função</Label>
                {isAdmin ? (
                  <Select
                    value={member.custom_role_id || "none"}
                    onValueChange={(v) => updateMemberRole(member.id, v === "none" ? "" : v)}
                  >
                    <SelectTrigger className="bg-secondary/50 text-sm h-8">
                      <SelectValue placeholder="Selecionar função" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem função</SelectItem>
                      {customRoles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-foreground">{getRoleName(member.custom_role_id)}</p>
                )}
              </div>

              {/* Participa da comissão switch - admin only */}
              {isAdmin && (
                <div className="flex items-center justify-between pt-1 border-t border-border/50">
                  <Label className="text-xs text-muted-foreground cursor-pointer" htmlFor={`comissao-${member.id}`}>
                    Participa da comissão/metas
                  </Label>
                  <Switch
                    id={`comissao-${member.id}`}
                    checked={member.participa_comissao ?? true}
                    onCheckedChange={() => toggleParticipaComissao(member.id, member.participa_comissao)}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {profiles.length === 0 && (
        <Card className="glass-panel neon-border">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum membro encontrado.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
