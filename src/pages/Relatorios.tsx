import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet, Target, Users, FolderKanban, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type ReportType = "leads" | "clients" | "projects" | "tasks";

const REPORT_OPTIONS: { value: ReportType; label: string; icon: typeof Target }[] = [
  { value: "leads", label: "Leads", icon: Target },
  { value: "clients", label: "Clientes", icon: Users },
  { value: "projects", label: "Projetos", icon: FolderKanban },
  { value: "tasks", label: "Tarefas", icon: CheckSquare },
];

const STATUS_LABELS: Record<string, string> = {
  novo: "Novo",
  primeiro_contato: "1º Contato",
  diagnostico: "Diagnóstico",
  proposta_enviada: "Proposta Enviada",
  negociacao: "Negociação",
  fechado_ganho: "Ganho",
  perdido: "Perdido",
  a_fazer: "A Fazer",
  em_progresso: "Em Progresso",
  em_revisao: "Em Revisão",
  concluido: "Concluído",
  backlog: "Backlog",
  em_analise: "Em Análise",
  em_desenvolvimento: "Em Desenvolvimento",
  em_testes: "Em Testes",
  entregue: "Entregue",
};

export default function Relatorios() {
  const [reportType, setReportType] = useState<ReportType>("leads");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    let result;
    switch (reportType) {
      case "leads":
        result = await supabase.from("leads").select("*").order("created_at", { ascending: false });
        break;
      case "clients":
        result = await supabase.from("clients").select("*").order("created_at", { ascending: false });
        break;
      case "projects":
        result = await supabase.from("projects").select("*").order("created_at", { ascending: false });
        break;
      case "tasks":
        result = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
        break;
    }
    setData(result?.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [reportType]);

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "";

  const exportToExcel = () => {
    if (data.length === 0) {
      toast.error("Nenhum dado para exportar");
      return;
    }

    let rows: Record<string, any>[] = [];
    const labels = REPORT_OPTIONS.find((r) => r.value === reportType)?.label || reportType;

    switch (reportType) {
      case "leads":
        rows = data.map((l: any) => ({
          Nome: l.nome,
          Empresa: l.empresa || "",
          Endereço: l.endereco || "",
          WhatsApp: l.whatsapp || "",
          Email: l.email || "",
          Interesse: l.interesse || "",
          Origem: l.origem || "",
          Status: STATUS_LABELS[l.status] || l.status,
          "Criado em": formatDate(l.created_at),
        }));
        break;
      case "clients":
        rows = data.map((c: any) => ({
          Nome: c.nome,
          "CPF/CNPJ": c.cnpj_cpf || "",
          Email: c.email || "",
          WhatsApp: c.whatsapp || "",
          Endereço: c.endereco || "",
          "Criado em": formatDate(c.created_at),
        }));
        break;
      case "projects":
        rows = data.map((p: any) => ({
          Nome: p.nome,
          Descrição: p.descricao || "",
          Status: STATUS_LABELS[p.status] || p.status,
          Prioridade: p.prioridade || "",
          "Data Início": formatDate(p.start_date),
          "Data Fim": formatDate(p.due_date),
          "Criado em": formatDate(p.created_at),
        }));
        break;
      case "tasks":
        rows = data.map((t: any) => ({
          Título: t.title,
          Descrição: t.description || "",
          Status: STATUS_LABELS[t.status] || t.status,
          Prioridade: t.priority || "",
          Prazo: formatDate(t.due_date),
          "Estimativa (h)": t.time_estimate || "",
          "Tempo Gasto (h)": t.time_spent || "",
          "Criado em": formatDate(t.created_at),
        }));
        break;
    }

    const ws = XLSX.utils.json_to_sheet(rows);

    // Auto-size columns
    const colWidths = Object.keys(rows[0] || {}).map((key) => ({
      wch: Math.max(key.length, ...rows.map((r) => String(r[key] || "").length)) + 2,
    }));
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, labels);
    XLSX.writeFile(wb, `relatorio_${reportType}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Relatório exportado!");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold neon-glow">Relatórios</h1>
          <p className="text-muted-foreground text-sm mt-1">Exporte dados formatados em Excel</p>
        </div>
        <Button onClick={exportToExcel} disabled={loading || data.length === 0} className="gradient-accent text-primary-foreground font-semibold">
          <Download className="h-4 w-4 mr-2" /> Exportar Excel
        </Button>
      </div>

      <div className="flex gap-3">
        {REPORT_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={reportType === opt.value ? "default" : "outline"}
            onClick={() => setReportType(opt.value)}
            className={reportType === opt.value ? "gradient-accent text-primary-foreground" : ""}
          >
            <opt.icon className="h-4 w-4 mr-2" />
            {opt.label}
          </Button>
        ))}
      </div>

      <Card className="glass-panel neon-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            {REPORT_OPTIONS.find((r) => r.value === reportType)?.label} — {data.length} registros
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm animate-pulse">Carregando...</p>
          ) : data.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum registro encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {reportType === "leads" && (
                      <>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Nome</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Empresa</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Status</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Interesse</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Data</th>
                      </>
                    )}
                    {reportType === "clients" && (
                      <>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Nome</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Email</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">WhatsApp</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Data</th>
                      </>
                    )}
                    {reportType === "projects" && (
                      <>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Nome</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Status</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Prioridade</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Prazo</th>
                      </>
                    )}
                    {reportType === "tasks" && (
                      <>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Título</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Status</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Prioridade</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Prazo</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.slice(0, 50).map((item: any) => (
                    <tr key={item.id} className="border-b border-border/50 hover:bg-secondary/20">
                      {reportType === "leads" && (
                        <>
                          <td className="py-2 px-3 text-foreground">{item.nome}</td>
                          <td className="py-2 px-3 text-muted-foreground">{item.empresa || "—"}</td>
                          <td className="py-2 px-3"><span className="chip-media text-[10px] rounded-full px-2 py-0.5">{STATUS_LABELS[item.status] || item.status}</span></td>
                          <td className="py-2 px-3 text-muted-foreground">{item.interesse || "—"}</td>
                          <td className="py-2 px-3 text-muted-foreground">{formatDate(item.created_at)}</td>
                        </>
                      )}
                      {reportType === "clients" && (
                        <>
                          <td className="py-2 px-3 text-foreground">{item.nome}</td>
                          <td className="py-2 px-3 text-muted-foreground">{item.email || "—"}</td>
                          <td className="py-2 px-3 text-muted-foreground">{item.whatsapp || "—"}</td>
                          <td className="py-2 px-3 text-muted-foreground">{formatDate(item.created_at)}</td>
                        </>
                      )}
                      {reportType === "projects" && (
                        <>
                          <td className="py-2 px-3 text-foreground">{item.nome}</td>
                          <td className="py-2 px-3"><span className="chip-media text-[10px] rounded-full px-2 py-0.5">{STATUS_LABELS[item.status] || item.status}</span></td>
                          <td className="py-2 px-3 text-muted-foreground">{item.prioridade || "—"}</td>
                          <td className="py-2 px-3 text-muted-foreground">{formatDate(item.due_date)}</td>
                        </>
                      )}
                      {reportType === "tasks" && (
                        <>
                          <td className="py-2 px-3 text-foreground">{item.title}</td>
                          <td className="py-2 px-3"><span className="chip-media text-[10px] rounded-full px-2 py-0.5">{STATUS_LABELS[item.status] || item.status}</span></td>
                          <td className="py-2 px-3 text-muted-foreground">{item.priority || "—"}</td>
                          <td className="py-2 px-3 text-muted-foreground">{formatDate(item.due_date)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.length > 50 && (
                <p className="text-xs text-muted-foreground mt-2">Mostrando 50 de {data.length} registros. Exporte para ver todos.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
