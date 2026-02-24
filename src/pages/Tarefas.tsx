import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Undo2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type TaskWithLead = Tables<"tasks"> & {
  leads: { nome: string } | null;
};

export default function Tarefas() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskWithLead[]>([]);

  const fetchTasks = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("tasks")
      .select("*, leads(nome)")
      .eq("assigned_user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setTasks(data as TaskWithLead[]);
  };

  useEffect(() => {
    fetchTasks();
  }, [user]);

  const updateStatus = async (taskId: string, newStatus: string) => {
    await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId);
    fetchTasks();
  };

  const pendentes = tasks.filter((t) => t.status !== "concluido");
  const concluidas = tasks.filter((t) => t.status === "concluido");

  const TaskCard = ({ task, showDone }: { task: TaskWithLead; showDone: boolean }) => (
    <Card className="neon-border hover:border-primary/30 transition-colors">
      <CardContent className="p-4 flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm text-foreground">{task.title}</p>
          {task.leads?.nome && (
            <Badge variant="secondary" className="mt-1 text-[10px]">
              {task.leads.nome}
            </Badge>
          )}
        </div>
        {showDone ? (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 gap-1.5 text-xs"
            onClick={() => updateStatus(task.id, "concluido")}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Feito
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0 gap-1.5 text-xs"
            onClick={() => updateStatus(task.id, "a_fazer")}
          >
            <Undo2 className="h-3.5 w-3.5" />
            Desfazer
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold neon-glow">Minhas Tarefas</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {pendentes.length} tarefas pendentes
        </p>
      </div>

      <Tabs defaultValue="pendentes">
        <TabsList>
          <TabsTrigger value="pendentes">Pendentes ({pendentes.length})</TabsTrigger>
          <TabsTrigger value="concluidas">Concluídas ({concluidas.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes" className="space-y-2">
          {pendentes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma tarefa pendente</p>
          ) : (
            pendentes.map((task) => <TaskCard key={task.id} task={task} showDone />)
          )}
        </TabsContent>

        <TabsContent value="concluidas" className="space-y-2">
          {concluidas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma tarefa concluída</p>
          ) : (
            concluidas.map((task) => <TaskCard key={task.id} task={task} showDone={false} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
