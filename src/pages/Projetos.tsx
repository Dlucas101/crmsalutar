import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban, Calendar } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  em_analise: "Em Análise",
  em_desenvolvimento: "Em Desenvolvimento",
  em_testes: "Em Testes",
  entregue: "Entregue",
};

const STATUS_CHIPS: Record<string, string> = {
  backlog: "chip-baixa",
  em_analise: "chip-media",
  em_desenvolvimento: "chip-alta",
  em_testes: "chip-media",
  entregue: "chip-baixa",
};

export default function Projetos() {
  const [projects, setProjects] = useState<Tables<"projects">[]>([]);

  useEffect(() => {
    supabase.from("projects").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      if (data) setProjects(data);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold neon-glow">Projetos</h1>
        <p className="text-muted-foreground text-sm mt-1">{projects.length} projetos</p>
      </div>

      {projects.length === 0 ? (
        <Card className="glass-panel neon-border">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum projeto ainda.</p>
            <p className="text-xs text-muted-foreground mt-1">Projetos são criados automaticamente ao converter um lead.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Card key={project.id} className="glass-panel neon-border hover:border-primary/30 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-foreground">{project.nome}</CardTitle>
                  <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${STATUS_CHIPS[project.status] || "chip-baixa"}`}>
                    {STATUS_LABELS[project.status] || project.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {project.descricao && <p className="line-clamp-2">{project.descricao}</p>}
                {project.due_date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{new Date(project.due_date).toLocaleDateString("pt-BR")}</span>
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
