import { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Topbar } from "@/components/Topbar";
import { useTheme } from "@/hooks/useTheme";

export function AppLayout({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <SidebarProvider>
      <div className={`${theme === "dark" ? "dark" : ""} min-h-screen flex w-full`}>
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar />
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
