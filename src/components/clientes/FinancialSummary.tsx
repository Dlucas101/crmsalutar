import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Users, Archive, CheckSquare } from "lucide-react";

interface Client {
  id: string;
  valor_pago: number | null;
  valor_custo: number | null;
  valor_negociado: number | null;
  mensalidades_pagas: number | null;
  historico?: boolean | null;
}

interface Mensalidade {
  id: string;
  client_id: string;
  numero_mensalidade: number;
  valor: number;
  data_pagamento: string;
}

interface Props {
  clients: Client[];
  selectedClients: Client[];
  mensalidadesMap: Record<string, Mensalidade[]>;
  label: string;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function FinancialSummary({ clients, selectedClients, mensalidadesMap, label }: Props) {
  const ativos = clients.filter(c => !c.historico);
  const historico = clients.filter(c => !!c.historico);

  const sum = (list: Client[], field: "valor_pago" | "valor_custo") =>
    list.reduce((acc, c) => acc + (Number(c[field]) || 0), 0);

  const totalPago = sum(clients, "valor_pago");
  const totalCusto = sum(clients, "valor_custo");

  // Total a receber: meses restantes * (negociado - custo) para ativos
  const totalAReceber = ativos.reduce((acc, c) => {
    const mesesRestantes = 3 - (c.mensalidades_pagas ?? 0);
    const lucroPorMes = (Number(c.valor_negociado) || 0) - (Number(c.valor_custo) || 0);
    return acc + Math.max(0, mesesRestantes * lucroPorMes);
  }, 0);

  // Seleção: totalização dos selecionados
  const hasSelection = selectedClients.length > 0;
  const selTotalMensPago = selectedClients.reduce((acc, c) => {
    const mens = mensalidadesMap[c.id] || [];
    return acc + mens.reduce((s, m) => s + Number(m.valor), 0);
  }, 0);
  const selTotalCusto = selectedClients.reduce((acc, c) => {
    const mens = mensalidadesMap[c.id] || [];
    const custoTotal = mens.length * (Number(c.valor_custo) || 0);
    return acc + custoTotal;
  }, 0);
  const selLucro = selTotalMensPago - selTotalCusto;

  const items = [
    { icon: Users, label: "Clientes ativos", value: String(ativos.length), color: "text-primary" },
    { icon: Archive, label: "Histórico", value: String(historico.length), color: "text-muted-foreground" },
    { icon: DollarSign, label: "Total recebido", value: fmt(totalPago), color: "text-foreground" },
    { icon: DollarSign, label: "Total custos", value: fmt(totalCusto), color: "text-destructive" },
    { icon: DollarSign, label: "Lucro total", value: fmt(totalPago - totalCusto), color: "text-green-400" },
    { icon: DollarSign, label: "Total a receber", value: fmt(totalAReceber), color: "text-primary" },
  ];

  const selItems = hasSelection ? [
    { icon: CheckSquare, label: "Selecionados", value: String(selectedClients.length), color: "text-primary" },
    { icon: DollarSign, label: "Pago (seleção)", value: fmt(selTotalMensPago), color: "text-foreground" },
    { icon: DollarSign, label: "Custos (seleção)", value: fmt(selTotalCusto), color: "text-destructive" },
    { icon: DollarSign, label: "Lucro (seleção)", value: fmt(selLucro), color: "text-green-400" },
  ] : [];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground">{label}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
      {hasSelection && (
        <>
          <h3 className="text-sm font-semibold text-primary">Totalização dos selecionados</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {selItems.map((item, i) => (
              <Card key={i} className="glass-panel border-primary/30">
                <CardContent className="p-3 flex flex-col items-center text-center gap-1">
                  <item.icon className={`h-4 w-4 ${item.color}`} />
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <span className={`text-sm font-bold ${item.color}`}>{item.value}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
