import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users } from "lucide-react";

interface EditValues {
  valor_negociado: string;
  valor_ate_vencimento: string;
  valor_custo: string;
  valor_pago: string;
}

interface Member {
  id: string;
  nome: string;
}

interface Props {
  open: boolean;
  clientName: string;
  values: EditValues;
  onChange: (values: EditValues) => void;
  onSave: () => void;
  onClose: () => void;
  dividirContrato: boolean;
  onDividirContratoChange: (v: boolean) => void;
  parceiroId: string | null;
  onParceiroIdChange: (v: string | null) => void;
  members: Member[];
  currentResponsavelId?: string | null;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ClienteEditDialog({
  open, clientName, values, onChange, onSave, onClose,
  dividirContrato, onDividirContratoChange, parceiroId, onParceiroIdChange,
  members, currentResponsavelId,
}: Props) {
  const valorPago = Number(values.valor_pago) || 0;
  const valorCusto = Number(values.valor_custo) || 0;
  const valorFinal = valorPago - valorCusto;

  const set = (field: keyof EditValues, val: string) => onChange({ ...values, [field]: val });

  // Filter out the current responsible from partner options
  const partnerOptions = members.filter(m => m.id !== currentResponsavelId);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="glass-panel border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="neon-glow">Editar — {clientName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Valor negociado (mensalidade)</Label>
            <Input type="number" step="0.01" value={values.valor_negociado} onChange={e => set("valor_negociado", e.target.value)} className="bg-secondary/50" />
          </div>
          <div className="space-y-2">
            <Label>Valor até vencimento <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Input type="number" step="0.01" value={values.valor_ate_vencimento} onChange={e => set("valor_ate_vencimento", e.target.value)} className="bg-secondary/50" />
          </div>
          <div className="space-y-2">
            <Label>Custo do sistema <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Input type="number" step="0.01" value={values.valor_custo} onChange={e => set("valor_custo", e.target.value)} className="bg-secondary/50" />
          </div>
          <div className="space-y-2">
            <Label>Valor pago</Label>
            <Input type="number" step="0.01" value={values.valor_pago} onChange={e => set("valor_pago", e.target.value)} className="bg-secondary/50" />
          </div>

          {/* Contract Split */}
          <div className="border-t border-border pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-primary" />
                Dividir contrato?
              </Label>
              <Switch
                checked={dividirContrato}
                onCheckedChange={(checked) => {
                  onDividirContratoChange(checked);
                  if (!checked) onParceiroIdChange(null);
                }}
              />
            </div>
            {dividirContrato && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Dividir com qual membro? (50/50)</Label>
                <Select
                  value={parceiroId || ""}
                  onValueChange={(v) => onParceiroIdChange(v || null)}
                >
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue placeholder="Selecionar membro" />
                  </SelectTrigger>
                  <SelectContent>
                    {partnerOptions.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="p-3 rounded-lg bg-secondary/30 text-sm space-y-1">
            <div className="flex justify-between">
              <span>Valor final (lucro)</span>
              <span className={`font-bold ${valorFinal >= 0 ? "text-green-400" : "text-destructive"}`}>
                {fmt(valorFinal)}
              </span>
            </div>
            {dividirContrato && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Cada membro recebe (50%)</span>
                <span className="font-medium text-foreground">{fmt(valorFinal / 2)}</span>
              </div>
            )}
          </div>
          <Button onClick={onSave} className="w-full gradient-accent text-primary-foreground font-semibold">Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
