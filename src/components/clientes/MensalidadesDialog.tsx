import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Mensalidade {
  id: string;
  numero_mensalidade: number;
  valor: number;
  data_pagamento: string;
}

interface Props {
  open: boolean;
  clientId: string;
  clientName: string;
  onClose: () => void;
  onUpdate: () => void;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function MensalidadesDialog({ open, clientId, clientName, onClose, onUpdate }: Props) {
  const [mensalidades, setMensalidades] = useState<Mensalidade[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingNum, setAddingNum] = useState<number | null>(null);
  const [newValor, setNewValor] = useState("");
  const [newDate, setNewDate] = useState<Date>(new Date());

  const fetchMensalidades = async () => {
    const { data } = await supabase
      .from("mensalidades")
      .select("*")
      .eq("client_id", clientId)
      .order("numero_mensalidade", { ascending: true });
    if (data) setMensalidades(data as Mensalidade[]);
  };

  useEffect(() => {
    if (open && clientId) fetchMensalidades();
  }, [open, clientId]);

  const paidNumbers = mensalidades.map(m => m.numero_mensalidade);

  const handleAdd = async (num: number) => {
    if (!newValor || Number(newValor) <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("mensalidades").insert({
      client_id: clientId,
      numero_mensalidade: num,
      valor: Number(newValor),
      data_pagamento: format(newDate, "yyyy-MM-dd"),
    });
    if (error) {
      toast.error("Erro ao registrar mensalidade");
      setLoading(false);
      return;
    }

    // Update mensalidades_pagas and valor_pago on the client
    const { data: allMens } = await supabase
      .from("mensalidades")
      .select("valor")
      .eq("client_id", clientId);
    
    const totalPago = (allMens || []).reduce((acc, m) => acc + Number(m.valor), 0);
    const count = (allMens || []).length;

    await supabase.from("clients").update({
      mensalidades_pagas: count,
      valor_pago: totalPago,
    }).eq("id", clientId);

    toast.success(`${num}ª mensalidade registrada!`);
    setAddingNum(null);
    setNewValor("");
    setNewDate(new Date());
    setLoading(false);
    fetchMensalidades();
    onUpdate();
  };

  const handleDelete = async (m: Mensalidade) => {
    setLoading(true);
    await supabase.from("mensalidades").delete().eq("id", m.id);

    const { data: allMens } = await supabase
      .from("mensalidades")
      .select("valor")
      .eq("client_id", clientId);
    
    const totalPago = (allMens || []).reduce((acc, r) => acc + Number(r.valor), 0);
    const count = (allMens || []).length;

    await supabase.from("clients").update({
      mensalidades_pagas: count,
      valor_pago: totalPago,
    }).eq("id", clientId);

    toast.success("Mensalidade removida");
    setLoading(false);
    fetchMensalidades();
    onUpdate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="glass-panel border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="neon-glow">Mensalidades — {clientName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {[1, 2, 3].map(num => {
            const existing = mensalidades.find(m => m.numero_mensalidade === num);
            const isAdding = addingNum === num;

            return (
              <div key={num} className="rounded-lg border border-border/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">{num}ª Mensalidade</span>
                  {existing ? (
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-400" />
                      <span className="text-xs text-green-400 font-medium">Paga</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Pendente</span>
                  )}
                </div>

                {existing ? (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="space-y-0.5">
                      <div>Valor: <span className="font-medium text-foreground">{fmt(existing.valor)}</span></div>
                      <div>Data: <span className="font-medium text-foreground">
                        {format(new Date(existing.data_pagamento + "T12:00:00"), "dd/MM/yyyy")}
                      </span></div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(existing)}
                      disabled={loading}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : isAdding ? (
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Valor pago</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={newValor}
                        onChange={e => setNewValor(e.target.value)}
                        className="bg-secondary/50 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Data do pagamento</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn("w-full justify-start text-left font-normal h-8 text-sm bg-secondary/50")}
                          >
                            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                            {format(newDate, "dd/MM/yyyy")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={newDate}
                            onSelect={(d) => d && setNewDate(d)}
                            locale={ptBR}
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleAdd(num)} disabled={loading} className="flex-1 gradient-accent text-primary-foreground">
                        Confirmar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setAddingNum(null)} disabled={loading}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs"
                    onClick={() => {
                      setAddingNum(num);
                      setNewValor("");
                      setNewDate(new Date());
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Registrar pagamento
                  </Button>
                )}
              </div>
            );
          })}

          {/* Summary */}
          <div className="border-t border-border/50 pt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total pago</span>
              <span className="font-bold text-foreground">
                {fmt(mensalidades.reduce((acc, m) => acc + m.valor, 0))}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Mensalidades registradas</span>
              <span className="font-bold text-foreground">{mensalidades.length}/3</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
