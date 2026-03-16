import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet, Target, Users, CheckSquare, CalendarDays, FileText } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type ReportType = "leads" | "clients" | "tasks" | "visits" | "fechamento";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const REPORT_OPTIONS: { value: ReportType; label: string; icon: typeof Target }[] = [
  { value: "leads", label: "Leads", icon: Target },
  { value: "clients", label: "Clientes", icon: Users },
  { value: "tasks", label: "Tarefas", icon: CheckSquare },
  { value: "visits", label: "Visitas", icon: CalendarDays },
  { value: "fechamento", label: "Fechamento Mensal", icon: FileText },
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

interface FechamentoRow {
  nome: string;
  contratos: number;
  comissao: number;
  metaBonus: number;
  superMetaBonus: number;
  total: number;
}

export default function Relatorios() {
  const [reportType, setReportType] = useState<ReportType>("leads");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const now = new Date();
  const [fechMonth, setFechMonth] = useState(now.getMonth() + 1);
  const [fechYear, setFechYear] = useState(now.getFullYear());
  const [fechamentoData, setFechamentoData] = useState<FechamentoRow[]>([]);
  const [fechamentoMeta, setFechamentoMeta] = useState<any>(null);

  const fetchData = async () => {
    if (reportType === "fechamento") {
      await fetchFechamento();
      return;
    }
    setLoading(true);
    let result;
    switch (reportType) {
      case "leads":
        result = await supabase.from("leads").select("*").order("created_at", { ascending: false });
        break;
      case "clients":
        result = await supabase.from("clients").select("*").order("created_at", { ascending: false });
        break;
      case "tasks":
        result = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
        break;
      case "visits":
        result = await supabase.from("visits").select("*").order("visit_date", { ascending: false });
        break;
    }
    setData(result?.data || []);
    setLoading(false);
  };

  const fetchFechamento = async () => {
    setLoading(true);
    const [profilesRes, clientsRes, mensalidadesRes, leadsRes, metaRes] = await Promise.all([
      supabase.from("profiles").select("id, nome, participa_comissao"),
      supabase.from("clients").select("id, nome, responsavel_id, valor_custo, lead_id, dividir_contrato, parceiro_id"),
      supabase.from("mensalidades").select("*"),
      supabase.from("leads").select("id, responsible_id, status, updated_at"),
      supabase.from("metas").select("*").eq("mes", fechMonth).eq("ano", fechYear).maybeSingle(),
    ]);

    const profiles = (profilesRes.data || []).filter((p: any) => p.participa_comissao !== false);
    const participatingIds = new Set(profiles.map((p) => p.id));
    const clients = clientsRes.data || [];
    const mensalidades = mensalidadesRes.data || [];
    const leads = leadsRes.data || [];
    const meta = metaRes.data;
    setFechamentoMeta(meta);

    const leadsMap = new Map(leads.map((l) => [l.id, l.responsible_id]));
    const clientMap = new Map(clients.map((c) => {
      const responsavel = c.responsavel_id || (c.lead_id ? leadsMap.get(c.lead_id) : null);
      return [c.id, { ...c, responsavel_id_resolved: responsavel }];
    }));

    // Count leads ganho per member
    const leadsGanhoByMember = new Map<string, number>();
    for (const l of leads) {
      if (l.status !== "fechado_ganho" || !l.responsible_id || !participatingIds.has(l.responsible_id)) continue;
      const d = new Date(l.updated_at);
      if (d.getMonth() + 1 === fechMonth && d.getFullYear() === fechYear) {
        leadsGanhoByMember.set(l.responsible_id, (leadsGanhoByMember.get(l.responsible_id) || 0) + 1);
      }
    }

    let totalLeadsGanho = 0;
    for (const c of leadsGanhoByMember.values()) totalLeadsGanho += c;
    const metaAtingida = meta ? totalLeadsGanho >= meta.quantidade_meta && meta.quantidade_meta > 0 : false;
    const superMetaQtd = meta ? Number((meta as any).meta_bonus_quantidade) || 0 : 0;
    const superMetaAtingida = superMetaQtd > 0 && totalLeadsGanho >= superMetaQtd;
    const superMetaBonusValor = meta ? Number((meta as any).meta_bonus_valor) || 0 : 0;
    const valorContratoMeta = meta ? Number(meta.valor_contrato) : 0;

    // Calculate commissions per member
    const byMember = new Map<string, { comissao: number; contratos: Set<string> }>();
    const filtered = mensalidades.filter((m) => {
      if (m.numero_mensalidade > 3) return false;
      const d = new Date(m.data_pagamento);
      return d.getMonth() + 1 === fechMonth && d.getFullYear() === fechYear;
    });

    for (const m of filtered) {
      const client = clientMap.get(m.client_id);
      if (!client) continue;
      const tecId = client.responsavel_id_resolved;
      if (!tecId) continue;

      const custo = Number(client.valor_custo) || 0;
      const valor = Number(m.valor);
      const isDividido = !!client.dividir_contrato && !!client.parceiro_id;
      const comissao = isDividido ? (valor - custo) / 2 : valor - custo;

      if (!byMember.has(tecId)) byMember.set(tecId, { comissao: 0, contratos: new Set() });
      const entry = byMember.get(tecId)!;
      entry.comissao += comissao;
      entry.contratos.add(m.client_id);

      if (isDividido && client.parceiro_id && client.parceiro_id !== tecId) {
        if (!byMember.has(client.parceiro_id)) byMember.set(client.parceiro_id, { comissao: 0, contratos: new Set() });
        const pe = byMember.get(client.parceiro_id)!;
        pe.comissao += comissao;
        pe.contratos.add(m.client_id);
      }
    }

    const rows: FechamentoRow[] = profiles.map((p) => {
      const entry = byMember.get(p.id);
      const leadsCount = leadsGanhoByMember.get(p.id) || 0;
      const comissao = entry?.comissao || 0;
      const metaBonus = metaAtingida ? leadsCount * valorContratoMeta : 0;
      const superMetaBonus = superMetaAtingida && superMetaBonusValor > 0 ? leadsCount * superMetaBonusValor : 0;
      return {
        nome: p.nome,
        contratos: leadsCount,
        comissao,
        metaBonus,
        superMetaBonus,
        total: comissao + metaBonus + superMetaBonus,
      };
    }).filter((r) => r.contratos > 0 || r.comissao > 0);

    rows.sort((a, b) => b.total - a.total);
    setFechamentoData(rows);
    setData([]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [reportType]);
  useEffect(() => { if (reportType === "fechamento") fetchFechamento(); }, [fechMonth, fechYear]);

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "";
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const exportToExcel = () => {
    if (reportType === "fechamento") {
      if (fechamentoData.length === 0) { toast.error("Nenhum dado para exportar"); return; }
      const rows = fechamentoData.map((r) => ({
        Membro: r.nome,
        Contratos: r.contratos,
        "Comissão": r.comissao,
        "Bônus Meta": r.metaBonus,
        "Bônus Super Meta": r.superMetaBonus,
        Total: r.total,
      }));
      const totals = fechamentoData.reduce((a, r) => ({
        Membro: "TOTAL",
        Contratos: a.Contratos + r.contratos,
        "Comissão": a["Comissão"] + r.comissao,
        "Bônus Meta": a["Bônus Meta"] + r.metaBonus,
        "Bônus Super Meta": a["Bônus Super Meta"] + r.superMetaBonus,
        Total: a.Total + r.total,
      }), { Membro: "TOTAL", Contratos: 0, "Comissão": 0, "Bônus Meta": 0, "Bônus Super Meta": 0, Total: 0 });
      rows.push(totals);
      const ws = XLSX.utils.json_to_sheet(rows);
      const colWidths = Object.keys(rows[0]).map((key) => ({
        wch: Math.max(key.length, ...rows.map((r) => String((r as any)[key] || "").length)) + 2,
      }));
      ws["!cols"] = colWidths;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Fechamento ${MONTHS[fechMonth - 1]}`);
      XLSX.writeFile(wb, `fechamento_${fechMonth}_${fechYear}.xlsx`);
      toast.success("Relatório exportado!");
      return;
    }

    if (data.length === 0) { toast.error("Nenhum dado para exportar"); return; }

    let rows: Record<string, any>[] = [];
    const labels = REPORT_OPTIONS.find((r) => r.value === reportType)?.label || reportType;

    switch (reportType) {
      case "leads":
        rows = data.map((l: any) => ({
          Nome: l.nome, Empresa: l.empresa || "", Endereço: l.endereco || "", WhatsApp: l.whatsapp || "", Email: l.email || "", Interesse: l.interesse || "", Origem: l.origem || "", Status: STATUS_LABELS[l.status] || l.status, "Criado em": formatDate(l.created_at),
        }));
        break;
      case "clients":
        rows = data.map((c: any) => ({
          Nome: c.nome, "CPF/CNPJ": c.cnpj_cpf || "", Email: c.email || "", WhatsApp: c.whatsapp || "", Endereço: c.endereco || "", "Criado em": formatDate(c.created_at),
        }));
        break;
      case "tasks":
        rows = data.map((t: any) => ({
          Título: t.title, Descrição: t.description || "", Status: STATUS_LABELS[t.status] || t.status, Prioridade: t.priority || "", Prazo: formatDate(t.due_date), "Estimativa (h)": t.time_estimate || "", "Tempo Gasto (h)": t.time_spent || "", "Criado em": formatDate(t.created_at),
        }));
        break;
      case "visits":
        rows = data.map((v: any) => ({
          Título: v.titulo, Descrição: v.descricao || "", "Data/Hora": v.visit_date ? new Date(v.visit_date).toLocaleString("pt-BR") : "", Status: v.status === "concluido" ? "Concluído" : "Agendado", "Criado em": formatDate(v.created_at),
        }));
        break;
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const colWidths = Object.keys(rows[0] || {}).map((key) => ({
      wch: Math.max(key.length, ...rows.map((r) => String(r[key] || "").length)) + 2,
    }));
    ws["!cols"] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, labels);
    XLSX.writeFile(wb, `relatorio_${reportType}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Relatório exportado!");
  };

  const exportToPdf = () => {
    if (fechamentoData.length === 0) { toast.error("Nenhum dado para exportar"); return; }

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Fechamento Mensal - ${MONTHS[fechMonth - 1]} ${fechYear}`, 14, 20);

    if (fechamentoMeta) {
      doc.setFontSize(10);
      doc.text(`Meta: ${fechamentoMeta.quantidade_meta} contratos | Valor por contrato: R$ ${Number(fechamentoMeta.valor_contrato).toFixed(2)}`, 14, 28);
    }

    const totals = fechamentoData.reduce((a, r) => ({
      contratos: a.contratos + r.contratos,
      comissao: a.comissao + r.comissao,
      metaBonus: a.metaBonus + r.metaBonus,
      superMetaBonus: a.superMetaBonus + r.superMetaBonus,
      total: a.total + r.total,
    }), { contratos: 0, comissao: 0, metaBonus: 0, superMetaBonus: 0, total: 0 });

    const tableBody = fechamentoData.map((r) => [
      r.nome,
      String(r.contratos),
      fmt(r.comissao),
      fmt(r.metaBonus),
      fmt(r.superMetaBonus),
      fmt(r.total),
    ]);

    tableBody.push([
      "TOTAL",
      String(totals.contratos),
      fmt(totals.comissao),
      fmt(totals.metaBonus),
      fmt(totals.superMetaBonus),
      fmt(totals.total),
    ]);

    autoTable(doc, {
      startY: 34,
      head: [["Membro", "Contratos", "Comissão", "Bônus Meta", "Super Meta", "Total"]],
      body: tableBody,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [6, 182, 212] },
      footStyles: { fontStyle: "bold" },
    });

    doc.save(`fechamento_${fechMonth}_${fechYear}.pdf`);
    toast.success("PDF exportado!");
  };

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold neon-glow">Relatórios</h1>
          <p className="text-muted-foreground text-sm mt-1">Exporte dados formatados em Excel ou PDF</p>
        </div>
        <div className="flex gap-2">
          {reportType === "fechamento" && (
            <Button onClick={exportToPdf} disabled={loading || fechamentoData.length === 0} variant="outline" className="font-semibold">
              <Download className="h-4 w-4 mr-2" /> PDF
            </Button>
          )}
          <Button
            onClick={exportToExcel}
            disabled={loading || (reportType === "fechamento" ? fechamentoData.length === 0 : data.length === 0)}
            className="gradient-accent text-primary-foreground font-semibold"
          >
            <Download className="h-4 w-4 mr-2" /> Excel
          </Button>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
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

      {reportType === "fechamento" && (
        <div className="flex gap-3 items-center">
          <Select value={String(fechMonth)} onValueChange={(v) => setFechMonth(Number(v))}>
            <SelectTrigger className="w-[150px] bg-secondary/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(fechYear)} onValueChange={(v) => setFechYear(Number(v))}>
            <SelectTrigger className="w-[100px] bg-secondary/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Card className="glass-panel neon-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            {REPORT_OPTIONS.find((r) => r.value === reportType)?.label}
            {reportType === "fechamento"
              ? ` — ${MONTHS[fechMonth - 1]} ${fechYear} — ${fechamentoData.length} membros`
              : ` — ${data.length} registros`
            }
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm animate-pulse">Carregando...</p>
          ) : reportType === "fechamento" ? (
            fechamentoData.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum dado para o período selecionado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Membro</th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium">Contratos</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-medium">Comissão</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-medium">Bônus Meta</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-medium">Super Meta</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fechamentoData.map((row) => (
                      <tr key={row.nome} className="border-b border-border/50 hover:bg-secondary/20">
                        <td className="py-2 px-3 text-foreground font-medium">{row.nome}</td>
                        <td className="py-2 px-3 text-center text-foreground">{row.contratos}</td>
                        <td className="py-2 px-3 text-right text-foreground">{fmt(row.comissao)}</td>
                        <td className="py-2 px-3 text-right text-foreground">{fmt(row.metaBonus)}</td>
                        <td className="py-2 px-3 text-right text-foreground">{fmt(row.superMetaBonus)}</td>
                        <td className="py-2 px-3 text-right text-foreground font-semibold">{fmt(row.total)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-border font-bold">
                      <td className="py-2 px-3 text-foreground">TOTAL</td>
                      <td className="py-2 px-3 text-center text-foreground">{fechamentoData.reduce((s, r) => s + r.contratos, 0)}</td>
                      <td className="py-2 px-3 text-right text-foreground">{fmt(fechamentoData.reduce((s, r) => s + r.comissao, 0))}</td>
                      <td className="py-2 px-3 text-right text-foreground">{fmt(fechamentoData.reduce((s, r) => s + r.metaBonus, 0))}</td>
                      <td className="py-2 px-3 text-right text-foreground">{fmt(fechamentoData.reduce((s, r) => s + r.superMetaBonus, 0))}</td>
                      <td className="py-2 px-3 text-right text-foreground">{fmt(fechamentoData.reduce((s, r) => s + r.total, 0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )
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
                    {reportType === "tasks" && (
                      <>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Título</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Status</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Prioridade</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Prazo</th>
                      </>
                    )}
                    {reportType === "visits" && (
                      <>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Título</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Data/Hora</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Status</th>
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
                      {reportType === "tasks" && (
                        <>
                          <td className="py-2 px-3 text-foreground">{item.title}</td>
                          <td className="py-2 px-3"><span className="chip-media text-[10px] rounded-full px-2 py-0.5">{STATUS_LABELS[item.status] || item.status}</span></td>
                          <td className="py-2 px-3 text-muted-foreground">{item.priority || "—"}</td>
                          <td className="py-2 px-3 text-muted-foreground">{formatDate(item.due_date)}</td>
                        </>
                      )}
                      {reportType === "visits" && (
                        <>
                          <td className="py-2 px-3 text-foreground">{item.titulo}</td>
                          <td className="py-2 px-3 text-muted-foreground">{item.visit_date ? new Date(item.visit_date).toLocaleString("pt-BR") : "—"}</td>
                          <td className="py-2 px-3"><span className="chip-media text-[10px] rounded-full px-2 py-0.5">{item.status === "concluido" ? "Concluído" : "Agendado"}</span></td>
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
