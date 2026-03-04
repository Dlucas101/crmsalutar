import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Phone, Building2, DollarSign, User, Pencil, CreditCard, Archive } from "lucide-react";

interface Mensalidade {
  id: string;
  client_id: string;
  numero_mensalidade: number;
  valor: number;
  data_pagamento: string;
}

interface Client {
  id: string;
  nome: string;
  cnpj_cpf: string | null;
  email: string | null;
  whatsapp: string | null;
  valor_negociado: number | null;
  valor_ate_vencimento: number | null;
  valor_custo: number | null;
  valor_pago: number | null;
  mensalidades_pagas: number | null;
  responsavel_id: string | null;
  lead_id: string | null;
  historico?: boolean | null;
}

interface Props {
  client: Client;
  responsavelNome: string;
  mensalidades: Mensalidade[];
  selected?: boolean;
  onToggleSelect?: () => void;
  onEdit: (c: Client) => void;
  onMensalidades: (c: Client) => void;
  onMoveToHistory: (id: string) => void;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ClienteCard({ client, responsavelNome, mensalidades, selected, onToggleSelect, onEdit, onMensalidades, onMoveToHistory }: Props) {
  const valorNeg = Number(client.valor_negociado) || 0;
  const valorVenc = Number(client.valor_ate_vencimento) || 0;
  const valorCusto = Number(client.valor_custo) || 0;
  const valorPago = Number(client.valor_pago) || 0;
  const valorFinal = valorPago - valorCusto;
  const canMoveToHistory = (client.mensalidades_pagas ?? 0) >= 3 && !client.historico;

  return (
    <Card className="glass-panel neon-border hover:border-primary/30 transition-colors">
      <CardHeader className="pb-2 flex flex-row items-start justify-between">
        <div className="flex items-center gap-2">
          {selected !== undefined && (
            <Checkbox checked={selected} onCheckedChange={onToggleSelect} />
          )}
          <CardTitle className="text-base font-semibold text-foreground">{client.nome}</CardTitle>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMensalidades(client)} title="Mensalidades">
            <CreditCard className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(client)} title="Editar valores">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium text-foreground">{responsavelNome}</span>
        </div>
        {client.cnpj_cpf && (
          <div className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5" />
            <span>{client.cnpj_cpf}</span>
          </div>
        )}
        {client.email && (
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5" />
            <span>{client.email}</span>
          </div>
        )}
        {client.whatsapp && (
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5" />
            <span>{client.whatsapp}</span>
          </div>
        )}
        <div className="border-t border-border/50 pt-2 mt-2 space-y-1">
          <div className="flex justify-between text-xs">
            <span>Valor negociado</span>
            <span className="font-medium text-foreground">{fmt(valorNeg)}</span>
          </div>
          {valorVenc > 0 && (
            <div className="flex justify-between text-xs">
              <span>Valor até vencimento</span>
              <span className="font-medium text-muted-foreground">{fmt(valorVenc)}</span>
            </div>
          )}
          {valorCusto > 0 && (
            <div className="flex justify-between text-xs">
              <span>Custo do sistema</span>
              <span className="font-medium text-destructive">{fmt(valorCusto)}</span>
            </div>
          )}
          <div className="flex justify-between text-xs">
            <span>Valor pago (total)</span>
            <span className="font-medium text-foreground">{fmt(valorPago)}</span>
          </div>
          <div className="flex justify-between text-xs font-semibold">
            <span className="flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-green-400" />
              Lucro total
            </span>
            <span className={valorFinal >= 0 ? "text-green-400" : "text-destructive"}>{fmt(valorFinal)}</span>
          </div>

          {/* Mensalidades com lucro individual */}
          <div className="border-t border-border/30 pt-1 mt-1 space-y-1">
            <span className="text-xs text-muted-foreground">Mensalidades</span>
            {[1, 2, 3].map(num => {
              const mens = mensalidades.find(m => m.numero_mensalidade === num);
              const lucro = mens ? Number(mens.valor) - valorCusto : null;
              return (
                <div key={num} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${
                        mens
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {num}ª
                    </span>
                    {mens ? (
                      <span className="text-foreground">{fmt(Number(mens.valor))}</span>
                    ) : (
                      <span className="text-muted-foreground/50">Pendente</span>
                    )}
                  </div>
                  {lucro !== null && (
                    <span className={`font-medium ${lucro >= 0 ? "text-green-400" : "text-destructive"}`}>
                      Lucro: {fmt(lucro)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {canMoveToHistory && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-2 text-xs"
            onClick={() => onMoveToHistory(client.id)}
          >
            <Archive className="h-3.5 w-3.5 mr-1" />
            Passar para histórico
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
