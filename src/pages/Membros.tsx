import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, UserPlus, Tag, Users } from "lucide-react";
import { toast } from "sonner";

interface Profile {
  id: string;
  nome: string;
  avatar_url: string | null;
  custom_role_id: string | null;
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
  const { role } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [openRole, setOpenRole] = useState(false);

  const isAdmin = role === "admin";

  const fetchAll = async () => {
    const [profilesRes, rolesRes, userRolesRes] = await Promise.all([
      supabase.from("profiles").select("id, nome, avatar_url, custom_role_id"),
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

  const updateMemberRole = async (profileId: string, customRoleId: string) => {
    const { error } = await supabase.from("profiles").update({ custom_role_id: customRoleId || null }).eq("id", profileId);
    if (error) {
      toast.error("Erro ao atualizar");
      return;
    }
    toast.success("Função atualizada!");
    fetchAll();
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold neon-glow">Membros</h1>
          <p className="text-muted-foreground text-sm mt-1">{profiles.length} membros</p>
        </div>
        {isAdmin && (
          <Dialog open={openRole} onOpenChange={setOpenRole}>
            <DialogTrigger asChild>
              <Button className="gradient-accent text-primary-foreground font-semibold">
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
                  <Input
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="Ex: Gerente Comercial"
                    maxLength={50}
                    required
                    className="bg-secondary/50"
                  />
                </div>
                <Button type="submit" className="w-full gradient-accent text-primary-foreground font-semibold">
                  Criar Função
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

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
