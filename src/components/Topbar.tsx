import { Palette, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme, THEMES, Theme } from "@/hooks/useTheme";
import { GlobalSearch } from "@/components/topbar/GlobalSearch";
import { NotificationsDropdown } from "@/components/topbar/NotificationsDropdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Topbar() {
  const { theme, setTheme } = useTheme();

  return (
    <header className="h-14 border-b border-border flex items-center gap-4 px-4 bg-card/50 backdrop-blur-sm">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground" />

      <GlobalSearch />

      <div className="flex-1" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" title="Trocar tema">
            <Palette className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>Aparência</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {THEMES.map((t) => (
            <DropdownMenuItem
              key={t.value}
              onClick={() => setTheme(t.value as Theme)}
              className="flex items-start gap-2 cursor-pointer"
            >
              <div className="flex-1">
                <div className="text-sm font-medium">{t.label}</div>
                <div className="text-xs text-muted-foreground">{t.description}</div>
              </div>
              {theme === t.value && <Check className="h-4 w-4 mt-0.5 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <NotificationsDropdown />
    </header>
  );
}
