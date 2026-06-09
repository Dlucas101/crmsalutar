import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calculator } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Tier {
  id: string;
  ordem: number;
  nome: string;
  quantidade_minima: number;
  valor_por_contrato: number;
}

interface Props {
  mes: number;
  ano: number;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function SimuladorPremiacao({ mes, ano }: Props) {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [qtd, setQtd] = useState<number>(0);

  useEffect(() => {
    (async () => {
      const { data: meta } = await supabase.from("metas").select("id").eq("mes", mes).eq("ano", ano).maybeSingle();
      if (!meta?.id) { setTiers([]); return; }
      const { data } = await supabase.from("meta_tiers").select("*").eq("meta_id", meta.id).order("quantidade_minima");
      setTiers((data || []) as Tier[]);
    })();
  }, [mes, ano]);

  const faixa = [...tiers].reverse().find((t) => t.quantidade_minima <= qtd);
  const valorUnit = faixa?.valor_por_contrato || 0;
  const total = qtd * valorUnit;
  const parcela = total / 3;

  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" /> Simulador de Premiação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <Label className="text-xs">Simular contratos fechados no mês</Label>
            <Input
              type="number"
              min="0"
              value={qtd}
              onChange={(e) => setQtd(Math.max(0, Number(e.target.value) || 0))}
              className="w-[180px]"
            />
          </div>
          <div className="flex items-center gap-2">
            {faixa ? (
              <Badge className="bg-primary/20 text-primary">Faixa: {faixa.nome}</Badge>
            ) : (
              <Badge variant="outline">Nenhuma faixa atingida</Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded border">
            <p className="text-xs text-muted-foreground">Valor por contrato</p>
            <p className="text-lg font-semibold">{brl(valorUnit)}</p>
          </div>
          <div className="p-3 rounded border">
            <p className="text-xs text-muted-foreground">Total premiação</p>
            <p className="text-lg font-semibold text-green-500">{brl(total)}</p>
          </div>
          <div className="p-3 rounded border">
            <p className="text-xs text-muted-foreground">Valor por parcela (÷3)</p>
            <p className="text-lg font-semibold">{brl(parcela)}</p>
          </div>
          <div className="p-3 rounded border">
            <p className="text-xs text-muted-foreground">Contratos simulados</p>
            <p className="text-lg font-semibold">{qtd}</p>
          </div>
        </div>

        {tiers.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Comparativo entre faixas</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Faixa</TableHead>
                  <TableHead className="text-right">Qtd. mínima</TableHead>
                  <TableHead className="text-right">Valor/contrato</TableHead>
                  <TableHead className="text-right">Premiação total ({qtd} contr.)</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiers.map((t) => {
                  const atinge = qtd >= t.quantidade_minima;
                  const isAtual = faixa?.id === t.id;
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.nome}</TableCell>
                      <TableCell className="text-right">{t.quantidade_minima}</TableCell>
                      <TableCell className="text-right">{brl(t.valor_por_contrato)}</TableCell>
                      <TableCell className="text-right">{brl(qtd * t.valor_por_contrato)}</TableCell>
                      <TableCell className="text-right">
                        {isAtual ? (
                          <Badge className="bg-primary/20 text-primary">Atingida</Badge>
                        ) : atinge ? (
                          <Badge variant="outline">Disponível</Badge>
                        ) : (
                          <Badge variant="outline" className="opacity-50">Faltam {t.quantidade_minima - qtd}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {tiers.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-3">
            Nenhuma faixa configurada para {mes}/{ano}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
