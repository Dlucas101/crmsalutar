import {
  LayoutDashboard,
  Users,
  Target,
  
  CheckSquare,
  LogOut,
  Zap,
  FileSpreadsheet,
  UserCog,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  gestor: "Gestor",
  suporte: "Suporte",
  desenvolvedor: "Dev",
  vendas: "Vendas",
};

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Leads", url: "/leads", icon: Target },
  { title: "Clientes", url: "/clientes", icon: Users },
  
  { title: "Minhas Tarefas", url: "/tarefas", icon: CheckSquare },
  { title: "Membros", url: "/membros", icon: UserCog },
  { title: "Relatórios", url: "/relatorios", icon: FileSpreadsheet },
];

export function AppSidebar() {
  const { profile, role, signOut } = useAuth();

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2 animate-float">
          <Zap className="h-7 w-7 text-primary" />
          <span className="text-lg font-bold neon-glow text-foreground">CRM</span>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground text-xs uppercase tracking-wider">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                      activeClassName="bg-sidebar-accent text-primary font-medium neon-border"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-8 w-8 rounded-full gradient-accent flex items-center justify-center text-xs font-bold text-primary-foreground">
            {profile?.nome?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-foreground">
              {profile?.nome || "Usuário"}
            </p>
            {role && (
              <p className="text-xs text-muted-foreground">
                {ROLE_LABELS[role] || role}
              </p>
            )}
          </div>
        </div>
        <SidebarMenuButton
          onClick={signOut}
          className="flex items-center gap-2 text-muted-foreground hover:text-destructive w-full"
        >
          <LogOut className="h-4 w-4" />
          <span>Sair</span>
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}
