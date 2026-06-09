import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MetaTiersEditor } from "@/components/metas/MetaTiersEditor";
import { SimuladorPremiacao } from "./SimuladorPremiacao";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface Props {
  isAdmin: boolean;
}

export function MetasPremiacaoTab({ isAdmin }: Props) {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [metaId, setMetaId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const loadMeta = async () => {
    const { data } = await supabase
      .from("metas").select("id").eq("mes", mes).eq("ano", ano).maybeSingle();
    setMetaId(data?.id ?? null);
  };

  useEffect(() => { loadMeta(); }, [mes, ano]);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  const handleDeleteMeta = async () => {
    if (!metaId) return;
    if (!confirm(`Excluir a meta de ${MONTHS[mes - 1]}/${ano}?\n\nAs faixas serão removidas, mas:\n• Contratos fechados continuam contando para o mês.\n• Premiações já existentes mantêm seus valores.\n• A apuração histórica é preservada.`)) return;
    const { error } = await supabase.from("metas").delete().eq("id", metaId);
    if (error) { toast.error("Erro ao excluir: " + error.message); return; }
    toast.success("Meta excluída.");
    setMetaId(null);
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Mês</Label>
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger className="w-[160px] bg-secondary/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ano</Label>
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger className="w-[110px] bg-secondary/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {isAdmin && metaId && (
          <Button size="sm" variant="destructive" onClick={handleDeleteMeta}>
            <Trash2 className="h-4 w-4 mr-1" /> Excluir meta do mês
          </Button>
        )}
      </div>

      <MetaTiersEditor
        key={`${metaId}-${reloadKey}`}
        metaId={metaId}
        mes={mes}
        ano={ano}
        isAdmin={isAdmin}
        onCreateMeta={async () => {
          const { data, error } = await supabase
            .from("metas")
            .insert({ mes, ano, quantidade_meta: 0, valor_contrato: 0 })
            .select("id").single();
          if (error) { toast.error("Erro ao criar meta"); return null; }
          setMetaId(data?.id ?? null);
          return data?.id ?? null;
        }}
        onChanged={loadMeta}
      />

      <SimuladorPremiacao mes={mes} ano={ano} key={`sim-${mes}-${ano}-${reloadKey}`} />
    </div>
  );
}
