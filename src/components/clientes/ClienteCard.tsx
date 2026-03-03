import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Phone, Building2, DollarSign, User, Pencil } from "lucide-react";

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
}

interface Props {
  client: Client;
  responsavelNome: string;
  onEdit: (c: Client) => void;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ClienteCard({ client, responsavelNome, onEdit }: Props) {
  const valorNeg = Number(client.valor_negociado) || 0;
  const valorVenc = Number(client.valor_ate_vencimento) || 0;
  const valorCusto = Number(client.valor_custo) || 0;
  const valorPago = Number(client.valor_pago) || 0;
  const valorFinal = valorPago - valorCusto;

  return (
    <Card className="glass-panel neon-border hover:border-primary/30 transition-colors">
      <CardHeader className="pb-2 flex flex-row items-start justify-between">
        <CardTitle className="text-base font-semibold text-foreground">{client.nome}</CardTitle>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(client)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
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
            <span>Valor pago</span>
            <span className="font-medium text-foreground">{fmt(valorPago)}</span>
          </div>
          <div className="flex justify-between text-xs font-semibold">
            <span className="flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-green-400" />
              Valor final (lucro)
            </span>
            <span className={valorFinal >= 0 ? "text-green-400" : "text-destructive"}>{fmt(valorFinal)}</span>
          </div>
          <div className="border-t border-border/30 pt-1 mt-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Mensalidades pagas</span>
              <div className="flex gap-1">
                {[1, 2, 3].map(m => (
                  <span
                    key={m}
                    className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${
                      m <= (client.mensalidades_pagas ?? 0)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {m}ª
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
