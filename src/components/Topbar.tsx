import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "@/hooks/useTheme";
import { GlobalSearch } from "@/components/topbar/GlobalSearch";
import { NotificationsDropdown } from "@/components/topbar/NotificationsDropdown";

export function Topbar() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-14 border-b border-border flex items-center gap-4 px-4 bg-card/50 backdrop-blur-sm">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground" />

      <GlobalSearch />

      <div className="flex-1" />

      <Button variant="ghost" size="icon" onClick={toggleTheme} className="text-muted-foreground hover:text-foreground" title={theme === "dark" ? "Tema claro" : "Tema escuro"}>
        {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </Button>

      <NotificationsDropdown />
    </header>
  );
}
