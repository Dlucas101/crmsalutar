import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Plus, Check, Download, Clock, User, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";

// Brazilian national holidays
function getBrazilianHolidays(year: number): { date: Date; name: string }[] {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(year, month, day);
  const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

  return [
    { date: new Date(year, 0, 1), name: "Confraternização Universal" },
    { date: addDays(easter, -47), name: "Carnaval" },
    { date: addDays(easter, -46), name: "Carnaval" },
    { date: addDays(easter, -2), name: "Sexta-feira Santa" },
    { date: easter, name: "Páscoa" },
    { date: new Date(year, 3, 21), name: "Tiradentes" },
    { date: new Date(year, 4, 1), name: "Dia do Trabalho" },
    { date: addDays(easter, 60), name: "Corpus Christi" },
    { date: new Date(year, 8, 7), name: "Independência" },
    { date: new Date(year, 9, 12), name: "N. Sra. Aparecida" },
    { date: new Date(year, 10, 2), name: "Finados" },
    { date: new Date(year, 10, 15), name: "Proclamação da República" },
    { date: new Date(year, 10, 20), name: "Consciência Negra" },
    { date: new Date(year, 11, 25), name: "Natal" },
  ];
}

interface Visit {
  id: string;
  titulo: string;
  descricao: string | null;
  visit_date: string;
  visit_end: string | null;
  member_id: string | null;
  lead_id: string | null;
  client_id: string | null;
  status: string;
  cor: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  nome: string;
  cor: string | null;
}

const MEMBER_COLORS = [
  "#06b6d4", "#8b5cf6", "#f59e0b", "#ef4444", "#22c55e",
  "#ec4899", "#3b82f6", "#f97316", "#14b8a6", "#a855f7",
];

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const emptyForm = {
  titulo: "",
  descricao: "",
  visit_date: "",
  visit_date_end: "",
  visit_time: "08:00",
  member_id: "",
  cor: MEMBER_COLORS[0],
};

export default function Visitas() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [openNew, setOpenNew] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [filterMember, setFilterMember] = useState<string>("all");

  // Edit state
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
  const [openEdit, setOpenEdit] = useState(false);
  const [editForm, setEditForm] = useState({ ...emptyForm });

  const holidays = getBrazilianHolidays(currentMonth.getFullYear());

  const fetchData = async () => {
    const [visitsRes, membersRes] = await Promise.all([
      supabase.from("visits").select("*").order("visit_date", { ascending: true }),
      supabase.from("profiles").select("id, nome, cor"),
    ]);
    if (visitsRes.data) setVisits(visitsRes.data as Visit[]);
    if (membersRes.data) setMembers(membersRes.data);
  };

  useEffect(() => { fetchData(); }, []);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart);

  // Filter visits
  const filteredVisits = filterMember === "all"
    ? visits
    : visits.filter((v) => v.member_id === filterMember);

  const getVisitsForDay = (day: Date) =>
    filteredVisits.filter((v) => isSameDay(new Date(v.visit_date), day));

  const getHolidayForDay = (day: Date) =>
    holidays.find((h) => isSameDay(h.date, day));

  const getMemberName = (id: string | null) =>
    members.find((m) => m.id === id)?.nome || "—";

  const getMemberColor = (memberId: string | null, visitCor: string | null) => {
    if (visitCor) return visitCor;
    const member = members.find((m) => m.id === memberId);
    return member?.cor || "#06b6d4";
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim() || !form.visit_date || !form.member_id) {
      toast.error("Preencha título, data e técnico");
      return;
    }
    const startDate = new Date(form.visit_date + "T00:00:00");
    const endDate = form.visit_date_end.trim() ? new Date(form.visit_date_end + "T00:00:00") : startDate;
    const allDates = eachDayOfInterval({ start: startDate, end: endDate });
    const rows = allDates.map((d) => ({
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      visit_date: `${format(d, "yyyy-MM-dd")}T${form.visit_time}:00`,
      member_id: form.member_id,
      cor: form.cor,
      status: "agendado",
    }));
    const { error } = await supabase.from("visits").insert(rows);
    if (error) { toast.error("Erro ao criar visita"); return; }
    toast.success(allDates.length > 1 ? `${allDates.length} visitas agendadas!` : "Visita agendada!");
    setForm({ ...emptyForm });
    setOpenNew(false);
    fetchData();
  };

  const openEditDialog = (v: Visit) => {
    setEditingVisit(v);
    const d = new Date(v.visit_date);
    setEditForm({
      titulo: v.titulo,
      descricao: v.descricao || "",
      visit_date: format(d, "yyyy-MM-dd"),
      visit_date_end: "",
      visit_time: format(d, "HH:mm"),
      member_id: v.member_id || "",
      cor: v.cor || MEMBER_COLORS[0],
    });
    setOpenEdit(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVisit) return;
    if (!editForm.titulo.trim() || !editForm.visit_date || !editForm.member_id) {
      toast.error("Preencha título, data e técnico");
      return;
    }
    const dateTime = `${editForm.visit_date}T${editForm.visit_time}:00`;
    const { error } = await supabase.from("visits").update({
      titulo: editForm.titulo.trim(),
      descricao: editForm.descricao.trim() || null,
      visit_date: dateTime,
      member_id: editForm.member_id,
      cor: editForm.cor,
    }).eq("id", editingVisit.id);
    if (error) { toast.error("Erro ao editar visita"); return; }
    toast.success("Visita atualizada!");
    setOpenEdit(false);
    setEditingVisit(null);
    fetchData();
  };

  const markComplete = async (id: string) => {
    const { error } = await supabase.from("visits").update({ status: "concluido" }).eq("id", id);
    if (error) { toast.error("Erro ao concluir visita"); return; }
    toast.success("Visita concluída!");
    fetchData();
  };

  const exportExcel = () => {
    if (filteredVisits.length === 0) { toast.error("Nenhuma visita para exportar"); return; }
    const rows = filteredVisits.map((v) => ({
      Título: v.titulo,
      Descrição: v.descricao || "",
      "Data/Hora": format(new Date(v.visit_date), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      Técnico: getMemberName(v.member_id),
      Status: v.status === "concluido" ? "Concluído" : "Agendado",
      "Criado em": format(new Date(v.created_at), "dd/MM/yyyy", { locale: ptBR }),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const colWidths = Object.keys(rows[0]).map((key) => ({
      wch: Math.max(key.length, ...rows.map((r) => String((r as any)[key] || "").length)) + 2,
    }));
    ws["!cols"] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Visitas");
    XLSX.writeFile(wb, `visitas_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Relatório exportado!");
  };

  const dayVisits = selectedDay ? getVisitsForDay(selectedDay) : [];
  const totalVisits = filteredVisits.length;
  const completedVisits = filteredVisits.filter((v) => v.status === "concluido").length;
  const pendingVisits = filteredVisits.filter((v) => v.status === "agendado").length;

  const renderFormFields = (f: typeof form, setF: (v: typeof form) => void) => (
    <>
      <div className="space-y-2">
        <Label>Título</Label>
        <Input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Ex: Instalação de equipamento" className="bg-secondary/50" required />
      </div>
      <div className="space-y-2">
        <Label>Descrição</Label>
        <Textarea value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} placeholder="Detalhes da visita" className="bg-secondary/50" rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Data</Label>
          <Input type="date" value={f.visit_date} onChange={(e) => setF({ ...f, visit_date: e.target.value })} className="bg-secondary/50" required />
        </div>
        <div className="space-y-2">
          <Label>Hora</Label>
          <Input type="time" value={f.visit_time} onChange={(e) => setF({ ...f, visit_time: e.target.value })} className="bg-secondary/50" required />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Data final <span className="text-muted-foreground font-normal">(opcional — cria visitas para todos os dias do período)</span></Label>
        <Input type="date" value={f.visit_date_end} onChange={(e) => setF({ ...f, visit_date_end: e.target.value })} className="bg-secondary/50" min={f.visit_date || undefined} />
      </div>
      <div className="space-y-2">
        <Label>Técnico</Label>
        <Select value={f.member_id} onValueChange={(v) => setF({ ...f, member_id: v })}>
          <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Selecionar técnico" /></SelectTrigger>
          <SelectContent>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Cor</Label>
        <div className="flex gap-2 flex-wrap">
          {MEMBER_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setF({ ...f, cor: c })}
              className="h-7 w-7 rounded-full border-2 transition-transform"
              style={{
                backgroundColor: c,
                borderColor: f.cor === c ? "white" : "transparent",
                transform: f.cor === c ? "scale(1.2)" : "scale(1)",
              }}
            />
          ))}
        </div>
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold neon-glow">Visitas</h1>
          <p className="text-muted-foreground text-sm mt-1">Calendário de visitas técnicas</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Member filter */}
          <Select value={filterMember} onValueChange={setFilterMember}>
            <SelectTrigger className="w-[180px] bg-secondary/50">
              <SelectValue placeholder="Filtrar técnico" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os técnicos</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={exportExcel} variant="outline" disabled={filteredVisits.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Excel
          </Button>
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button className="gradient-accent text-primary-foreground font-semibold">
                <Plus className="h-4 w-4 mr-2" /> Nova Visita
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-panel border-border max-w-md">
              <DialogHeader>
                <DialogTitle className="neon-glow">Agendar Visita</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                {renderFormFields(form, setForm)}
                <Button type="submit" className="w-full gradient-accent text-primary-foreground font-semibold">Agendar Visita</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="glass-panel neon-border">
          <CardContent className="p-4 text-center">
            <CalendarDays className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold text-foreground">{totalVisits}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="glass-panel neon-border">
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto text-amber-400 mb-1" />
            <p className="text-2xl font-bold text-foreground">{pendingVisits}</p>
            <p className="text-xs text-muted-foreground">Agendadas</p>
          </CardContent>
        </Card>
        <Card className="glass-panel neon-border">
          <CardContent className="p-4 text-center">
            <Check className="h-5 w-5 mx-auto text-green-400 mb-1" />
            <p className="text-2xl font-bold text-foreground">{completedVisits}</p>
            <p className="text-xs text-muted-foreground">Concluídas</p>
          </CardContent>
        </Card>
      </div>

      {/* Calendar */}
      <Card className="glass-panel neon-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>←</Button>
            <CardTitle className="text-base capitalize">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>→</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-xs font-medium text-muted-foreground py-1">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startPad }).map((_, i) => (
              <div key={`pad-${i}`} className="h-20" />
            ))}
            {daysInMonth.map((day) => {
              const dayV = getVisitsForDay(day);
              const holiday = getHolidayForDay(day);
              const isSelected = selectedDay && isSameDay(day, selectedDay);
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(day)}
                  className={`h-20 rounded-lg border text-left p-1 transition-colors overflow-hidden ${
                    isSelected ? "border-primary bg-primary/10" : "border-border/50 hover:border-primary/30"
                  } ${isToday(day) ? "ring-1 ring-primary/40" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium ${isToday(day) ? "text-primary" : "text-foreground"}`}>
                      {format(day, "d")}
                    </span>
                    {holiday && <span className="text-[8px] text-destructive font-medium truncate ml-1">🎉</span>}
                  </div>
                  {holiday && <p className="text-[8px] text-destructive/80 truncate leading-tight">{holiday.name}</p>}
                  <div className="mt-0.5 space-y-0.5">
                    {dayV.slice(0, 2).map((v) => (
                      <div key={v.id} className="text-[9px] leading-tight truncate rounded px-1 py-0.5"
                        style={{
                          backgroundColor: getMemberColor(v.member_id, v.cor) + "30",
                          color: getMemberColor(v.member_id, v.cor),
                          textDecoration: v.status === "concluido" ? "line-through" : "none",
                        }}
                      >
                        {format(new Date(v.visit_date), "HH:mm")} {getMemberName(v.member_id).split(" ")[0]}
                      </div>
                    ))}
                    {dayV.length > 2 && <p className="text-[8px] text-muted-foreground">+{dayV.length - 2} mais</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected day detail */}
      {selectedDay && (
        <Card className="glass-panel neon-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              {format(selectedDay, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              {getHolidayForDay(selectedDay) && (
                <Badge variant="destructive" className="text-[10px]">{getHolidayForDay(selectedDay)!.name}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dayVisits.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma visita neste dia.</p>
            ) : (
              dayVisits.map((v) => (
                <div key={v.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50"
                  style={{ borderLeftWidth: 4, borderLeftColor: getMemberColor(v.member_id, v.cor) }}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm text-foreground ${v.status === "concluido" ? "line-through opacity-60" : ""}`}>
                      {v.titulo}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {format(new Date(v.visit_date), "HH:mm")}
                      <User className="h-3 w-3 ml-2" />
                      <span style={{ color: getMemberColor(v.member_id, v.cor) }}>{getMemberName(v.member_id)}</span>
                    </div>
                    {v.descricao && <p className="text-xs text-muted-foreground mt-1">{v.descricao}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="text-[10px]"
                      style={{
                        backgroundColor: v.status === "concluido" ? "#22c55e30" : getMemberColor(v.member_id, v.cor) + "30",
                        color: v.status === "concluido" ? "#22c55e" : getMemberColor(v.member_id, v.cor),
                      }}
                    >
                      {v.status === "concluido" ? "Concluído" : "Agendado"}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={() => openEditDialog(v)} className="h-7 text-xs">
                      <Pencil className="h-3 w-3" />
                    </Button>
                    {v.status !== "concluido" && (
                      <Button size="sm" variant="outline" onClick={() => markComplete(v.id)} className="h-7 text-xs">
                        <Check className="h-3 w-3 mr-1" /> Concluir
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit dialog */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent className="glass-panel border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="neon-glow">Editar Visita</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            {renderFormFields(editForm, setEditForm)}
            <Button type="submit" className="w-full gradient-accent text-primary-foreground font-semibold">Salvar Alterações</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Legend */}
      {filteredVisits.length > 0 && (
        <Card className="glass-panel neon-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Técnicos</p>
            <div className="flex flex-wrap gap-3">
              {members
                .filter((m) => filteredVisits.some((v) => v.member_id === m.id))
                .map((m) => {
                  const memberVisits = filteredVisits.filter((v) => v.member_id === m.id);
                  const color = memberVisits[0]?.cor || m.cor || "#06b6d4";
                  const done = memberVisits.filter((v) => v.status === "concluido").length;
                  return (
                    <div key={m.id} className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-xs text-foreground">{m.nome}</span>
                      <span className="text-[10px] text-muted-foreground">({done}/{memberVisits.length})</span>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
