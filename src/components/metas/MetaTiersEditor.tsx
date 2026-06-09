import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Lock, Target } from "lucide-react";
import { toast } from "sonner";

interface Tier {
  id?: string;
  ordem: number;
  nome: string;
  quantidade_minima: number;
  valor_por_contrato: number;
  _isNew?: boolean;
}

interface Apuracao {
  id: string;
  faixa_atingida_id: string | null;
  valor_por_contrato_congelado: number;
  total_contratos: number;
  fechada_em: string | null;
}

interface Props {
  metaId: string | null;
  mes: number;
  ano: number;
  isAdmin: boolean;
  onCreateMeta: () => Promise<string | null>;
  onChanged?: () => void;
}

export function MetaTiersEditor({ metaId, mes, ano, isAdmin, onCreateMeta, onChanged }: Props) {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [apuracao, setApuracao] = useState<Apuracao | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!metaId) {
      setTiers([]);
      setApuracao(null);
      return;
    }
    const [tiersRes, apRes] = await Promise.all([
      supabase.from("meta_tiers").select("*").eq("meta_id", metaId).order("ordem"),
      supabase.from("meta_apuracao").select("*").eq("mes", mes).eq("ano", ano).maybeSingle(),
    ]);
    setTiers((tiersRes.data || []) as Tier[]);
    setApuracao((apRes.data as Apuracao) || null);
  };

  useEffect(() => { load(); }, [metaId, mes, ano]);

  const addTier = () => {
    const next = Math.max(0, ...tiers.map((t) => t.ordem)) + 1;
    setTiers([...tiers, { ordem: next, nome: `Faixa ${next}`, quantidade_minima: 0, valor_por_contrato: 0, _isNew: true }]);
  };

  const removeTier = async (idx: number) => {
    const t = tiers[idx];
    if (t.id) {
      const { error } = await supabase.from("meta_tiers").delete().eq("id", t.id);
      if (error) { toast.error("Erro ao remover"); return; }
    }
    setTiers(tiers.filter((_, i) => i !== idx));
    onChanged?.();
  };

  const updateTier = (idx: number, patch: Partial<Tier>) => {
    setTiers(tiers.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  };

  const saveAll = async () => {
    setLoading(true);
    let mid = metaId;
    if (!mid) {
      mid = await onCreateMeta();
      if (!mid) { setLoading(false); return; }
    }
    for (const t of tiers) {
      const payload = {
        meta_id: mid,
        ordem: t.ordem,
        nome: t.nome,
        quantidade_minima: Number(t.quantidade_minima) || 0,
        valor_por_contrato: Number(t.valor_por_contrato) || 0,
      };
      if (t.id) {
        await supabase.from("meta_tiers").update(payload).eq("id", t.id);
      } else {
        await supabase.from("meta_tiers").insert(payload);
      }
    }
    // Refresh apuração aberta
    await supabase.rpc("refresh_apuracao_aberta", { _mes: mes, _ano: ano });
    toast.success("Faixas salvas!");
    setLoading(false);
    await load();
    onChanged?.();
  };

  const closeApuracao = async () => {
    if (!confirm(`Fechar apuração de ${mes}/${ano}? O valor por contrato será congelado e não poderá ser alterado.`)) return;
    setLoading(true);
    const { error } = await supabase.rpc("close_apuracao", { _mes: mes, _ano: ano });
    if (error) { toast.error("Erro ao fechar apuração"); setLoading(false); return; }
    toast.success("Apuração fechada!");
    setLoading(false);
    await load();
    onChanged?.();
  };

  const faixaAtual = tiers.find((t) => t.id === apuracao?.faixa_atingida_id);
  const isFechada = !!apuracao?.fechada_em;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
          <span className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Faixas de Premiação
          </span>
          {apuracao && (
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {apuracao.total_contratos} contrato(s) — {faixaAtual ? `Faixa: ${faixaAtual.nome}` : "Sem faixa atingida"}
              </Badge>
              {isFechada ? (
                <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  <Lock className="h-3 w-3 mr-1" /> Fechada em {new Date(apuracao.fechada_em!).toLocaleDateString("pt-BR")}
                </Badge>
              ) : (
                <Badge variant="outline">Em apuração</Badge>
              )}
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {tiers.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma faixa configurada. Adicione uma faixa (ex: "Meta" com qtd mínima 8 e valor R$ 150 por contrato).
          </p>
        )}
        {tiers.map((t, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 rounded-lg border border-border/50">
            <div className="col-span-1">
              <Label className="text-xs">Ordem</Label>
              <Input
                type="number"
                value={t.ordem}
                disabled={!isAdmin || isFechada}
                onChange={(e) => updateTier(idx, { ordem: Number(e.target.value) })}
              />
            </div>
            <div className="col-span-4">
              <Label className="text-xs">Nome</Label>
              <Input
                value={t.nome}
                disabled={!isAdmin || isFechada}
                onChange={(e) => updateTier(idx, { nome: e.target.value })}
              />
            </div>
            <div className="col-span-3">
              <Label className="text-xs">Qtd. mínima</Label>
              <Input
                type="number"
                min="0"
                value={t.quantidade_minima}
                disabled={!isAdmin || isFechada}
                onChange={(e) => updateTier(idx, { quantidade_minima: Number(e.target.value) })}
              />
            </div>
            <div className="col-span-3">
              <Label className="text-xs">Valor/contrato (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={t.valor_por_contrato}
                disabled={!isAdmin || isFechada}
                onChange={(e) => updateTier(idx, { valor_por_contrato: Number(e.target.value) })}
              />
            </div>
            <div className="col-span-1 flex justify-end">
              {isAdmin && !isFechada && (
                <Button size="icon" variant="ghost" onClick={() => removeTier(idx)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        ))}

        {isAdmin && !isFechada && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={addTier}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar faixa
            </Button>
            <Button size="sm" onClick={saveAll} disabled={loading || tiers.length === 0}>
              Salvar faixas
            </Button>
            {apuracao && (
              <Button size="sm" variant="secondary" onClick={closeApuracao} disabled={loading}>
                <Lock className="h-4 w-4 mr-1" /> Fechar apuração
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
