import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface EditValues {
  valor_negociado: string;
  valor_ate_vencimento: string;
  valor_custo: string;
  valor_pago: string;
  mensalidades_pagas: string;
}

interface Props {
  open: boolean;
  clientName: string;
  values: EditValues;
  onChange: (values: EditValues) => void;
  onSave: () => void;
  onClose: () => void;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ClienteEditDialog({ open, clientName, values, onChange, onSave, onClose }: Props) {
  const valorPago = Number(values.valor_pago) || 0;
  const valorCusto = Number(values.valor_custo) || 0;
  const valorFinal = valorPago - valorCusto;

  const set = (field: keyof EditValues, val: string) => onChange({ ...values, [field]: val });

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
          <div className="space-y-2">
            <Label>Mensalidades pagas</Label>
            <Input type="number" step="1" min="0" value={values.mensalidades_pagas} onChange={e => set("mensalidades_pagas", e.target.value)} className="bg-secondary/50" />
          </div>
          <div className="p-3 rounded-lg bg-secondary/30 text-sm space-y-1">
            <div className="flex justify-between">
              <span>Valor final (lucro)</span>
              <span className={`font-bold ${valorFinal >= 0 ? "text-green-400" : "text-destructive"}`}>
                {fmt(valorFinal)}
              </span>
            </div>
          </div>
          <Button onClick={onSave} className="w-full gradient-accent text-primary-foreground font-semibold">Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
