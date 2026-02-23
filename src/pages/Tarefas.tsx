import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { CheckSquare, Clock, AlertTriangle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const KANBAN_COLUMNS = [
  { key: "a_fazer", label: "A Fazer" },
  { key: "em_progresso", label: "Em Progresso" },
  { key: "em_revisao", label: "Em Revisão" },
  { key: "concluido", label: "Concluído" },
];

const PRIORITY_CHIPS: Record<string, string> = {
  urgente: "chip-urgente",
  alta: "chip-alta",
  media: "chip-media",
  baixa: "chip-baixa",
};

const PRIORITY_LABELS: Record<string, string> = {
  urgente: "Urgente",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export default function Tarefas() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Tables<"tasks">[]>([]);

  const fetchTasks = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("assigned_user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setTasks(data);
  };

  useEffect(() => { fetchTasks(); }, [user]);

  const updateStatus = async (taskId: string, newStatus: string) => {
    await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId);
    fetchTasks();
  };

  const isOverdue = (task: Tables<"tasks">) => {
    if (!task.due_date || task.status === "concluido") return false;
    return new Date(task.due_date) < new Date();
  };

  const getTasksByStatus = (status: string) => tasks.filter((t) => t.status === status);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold neon-glow">Minhas Tarefas</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {tasks.filter((t) => t.status !== "concluido").length} tarefas pendentes
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {KANBAN_COLUMNS.map((col) => {
          const colTasks = getTasksByStatus(col.key);
          return (
            <div key={col.key} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {col.label}
                </h3>
                <span className="text-xs text-muted-foreground bg-secondary/50 rounded-full px-2 py-0.5">
                  {colTasks.length}
                </span>
              </div>
              <div className="space-y-2 min-h-[120px] glass-panel rounded-xl p-2">
                {colTasks.map((task) => (
                  <Card
                    key={task.id}
                    className={`neon-border hover:border-primary/30 transition-colors ${
                      isOverdue(task) ? "border-destructive/40" : ""
                    }`}
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm text-foreground line-clamp-2">{task.title}</p>
                        {isOverdue(task) && <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0 mt-0.5" />}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {task.priority && (
                          <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${PRIORITY_CHIPS[task.priority] || "chip-baixa"}`}>
                            {PRIORITY_LABELS[task.priority] || task.priority}
                          </span>
                        )}
                        {task.due_date && (
                          <span className={`text-[10px] flex items-center gap-1 ${isOverdue(task) ? "text-destructive" : "text-muted-foreground"}`}>
                            <Clock className="h-3 w-3" />
                            {new Date(task.due_date).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </div>
                      {col.key !== "concluido" && (
                        <select
                          value={task.status}
                          onChange={(e) => updateStatus(task.id, e.target.value)}
                          className="w-full text-xs bg-secondary/50 border border-border rounded-md p-1 text-foreground"
                        >
                          {KANBAN_COLUMNS.map((c) => (
                            <option key={c.key} value={c.key}>{c.label}</option>
                          ))}
                        </select>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {colTasks.length === 0 && (
                  <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
                    Nenhuma tarefa
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
