import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider, useTheme } from "@/hooks/useTheme";
import { AppLayout } from "@/components/AppLayout";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import Clientes from "./pages/Clientes";

import Tarefas from "./pages/Tarefas";
import Visitas from "./pages/Visitas";
import Membros from "./pages/Membros";
import Relatorios from "./pages/Relatorios";
import Metas from "./pages/Metas";
import Comissoes from "./pages/Comissoes";
import Contratos from "./pages/Contratos";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="dark min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(180deg, hsl(225 30% 4%) 0%, hsl(228 40% 8%) 100%)" }}>
        <div className="animate-pulse-neon text-primary text-lg font-semibold neon-glow">Carregando...</div>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />
              <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
              
              <Route path="/tarefas" element={<ProtectedRoute><Tarefas /></ProtectedRoute>} />
              <Route path="/visitas" element={<ProtectedRoute><Visitas /></ProtectedRoute>} />
              <Route path="/membros" element={<ProtectedRoute><Membros /></ProtectedRoute>} />
              <Route path="/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
              <Route path="/metas" element={<ProtectedRoute><Metas /></ProtectedRoute>} />
              <Route path="/comissoes" element={<ProtectedRoute><Comissoes /></ProtectedRoute>} />
              <Route path="/contratos" element={<ProtectedRoute><Contratos /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
