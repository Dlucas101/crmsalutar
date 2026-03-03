import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Users, Archive } from "lucide-react";

interface Client {
  valor_pago: number | null;
  valor_custo: number | null;
  mensalidades_pagas: number | null;
}

interface Props {
  clients: Client[];
  label: string;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function FinancialSummary({ clients, label }: Props) {
  const ativos = clients.filter(c => (c.mensalidades_pagas ?? 0) < 3);
  const historico = clients.filter(c => (c.mensalidades_pagas ?? 0) >= 3);

  const sum = (list: Client[], field: "valor_pago" | "valor_custo") =>
    list.reduce((acc, c) => acc + (Number(c[field]) || 0), 0);

  const totalPagoAtivos = sum(ativos, "valor_pago");
  const totalCustoAtivos = sum(ativos, "valor_custo");
  const totalPagoHist = sum(historico, "valor_pago");
  const totalCustoHist = sum(historico, "valor_custo");
  const totalPago = sum(clients, "valor_pago");
  const totalCusto = sum(clients, "valor_custo");

  const items = [
    { icon: Users, label: "Clientes ativos", value: String(ativos.length), color: "text-primary" },
    { icon: Archive, label: "Histórico", value: String(historico.length), color: "text-muted-foreground" },
    { icon: DollarSign, label: "Total recebido", value: fmt(totalPago), color: "text-foreground" },
    { icon: DollarSign, label: "Total custos", value: fmt(totalCusto), color: "text-destructive" },
    { icon: DollarSign, label: "Lucro total", value: fmt(totalPago - totalCusto), color: "text-green-400" },
  ];

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground">{label}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {items.map((item, i) => (
          <Card key={i} className="glass-panel neon-border">
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <item.icon className={`h-4 w-4 ${item.color}`} />
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <span className={`text-sm font-bold ${item.color}`}>{item.value}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
