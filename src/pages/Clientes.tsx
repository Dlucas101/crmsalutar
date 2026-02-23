import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Mail, Phone, Building2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

export default function Clientes() {
  const [clients, setClients] = useState<Tables<"clients">[]>([]);

  useEffect(() => {
    supabase.from("clients").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      if (data) setClients(data);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold neon-glow">Clientes</h1>
        <p className="text-muted-foreground text-sm mt-1">{clients.length} clientes cadastrados</p>
      </div>

      {clients.length === 0 ? (
        <Card className="glass-panel neon-border">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum cliente ainda.</p>
            <p className="text-xs text-muted-foreground mt-1">Clientes são criados automaticamente ao fechar um lead como "Ganho".</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => (
            <Card key={client.id} className="glass-panel neon-border hover:border-primary/30 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-foreground">{client.nome}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
