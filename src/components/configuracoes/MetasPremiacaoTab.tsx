import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MetaTiersEditor } from "@/components/metas/MetaTiersEditor";
import { toast } from "sonner";

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

  const loadMeta = async () => {
    const { data } = await supabase
      .from("metas")
      .select("id")
      .eq("mes", mes)
      .eq("ano", ano)
      .maybeSingle();
    setMetaId(data?.id ?? null);
  };

  useEffect(() => { loadMeta(); }, [mes, ano]);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="space-y-4">
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

      <MetaTiersEditor
        metaId={metaId}
        mes={mes}
        ano={ano}
        isAdmin={isAdmin}
        onCreateMeta={async () => {
          const { data, error } = await supabase
            .from("metas")
            .insert({ mes, ano, quantidade_meta: 0, valor_contrato: 0 })
            .select("id")
            .single();
          if (error) { toast.error("Erro ao criar meta"); return null; }
          setMetaId(data?.id ?? null);
          return data?.id ?? null;
        }}
        onChanged={loadMeta}
      />
    </div>
  );
}
