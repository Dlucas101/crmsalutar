import { useEffect, useState, useRef } from "react";
import { Search, Loader2, Target, Users, CheckSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface SearchResult {
  type: "lead" | "client" | "task";
  id: string;
  title: string;
  subtitle?: string;
}

export function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    const handle = setTimeout(async () => {
      setLoading(true);
      const term = `%${query.trim()}%`;
      const [leadsRes, clientsRes, tasksRes] = await Promise.all([
        supabase
          .from("leads")
          .select("id, nome, empresa")
          .or(`nome.ilike.${term},empresa.ilike.${term}`)
          .limit(5),
        supabase
          .from("clients")
          .select("id, nome, cnpj_cpf")
          .ilike("nome", term)
          .limit(5),
        supabase
          .from("tasks")
          .select("id, title, status")
          .ilike("title", term)
          .limit(5),
      ]);

      const all: SearchResult[] = [
        ...(leadsRes.data || []).map((l) => ({
          type: "lead" as const,
          id: l.id,
          title: l.nome,
          subtitle: l.empresa || undefined,
        })),
        ...(clientsRes.data || []).map((c) => ({
          type: "client" as const,
          id: c.id,
          title: c.nome,
          subtitle: c.cnpj_cpf || undefined,
        })),
        ...(tasksRes.data || []).map((t) => ({
          type: "task" as const,
          id: t.id,
          title: t.title,
          subtitle: t.status,
        })),
      ];

      setResults(all);
      setOpen(true);
      setLoading(false);
    }, 250);

    return () => clearTimeout(handle);
  }, [query]);

  const handleSelect = (r: SearchResult) => {
    setOpen(false);
    setQuery("");
    if (r.type === "lead") navigate("/leads");
    else if (r.type === "client") navigate("/clientes");
    else navigate("/tarefas");
  };

  const grouped = {
    lead: results.filter((r) => r.type === "lead"),
    client: results.filter((r) => r.type === "client"),
    task: results.filter((r) => r.type === "task"),
  };

  return (
    <div className="flex-1 max-w-md relative">
      <Popover open={open && results.length > 0} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar leads, clientes, tarefas..."
              className="pl-9 bg-secondary/50 border-border focus:border-primary h-9 text-sm"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0 max-h-[400px] overflow-auto"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {grouped.lead.length > 0 && (
            <SectionGroup label="Leads" icon={<Target className="h-3 w-3" />}>
              {grouped.lead.map((r) => (
                <ResultRow key={r.id} result={r} onSelect={handleSelect} />
              ))}
            </SectionGroup>
          )}
          {grouped.client.length > 0 && (
            <SectionGroup label="Clientes" icon={<Users className="h-3 w-3" />}>
              {grouped.client.map((r) => (
                <ResultRow key={r.id} result={r} onSelect={handleSelect} />
              ))}
            </SectionGroup>
          )}
          {grouped.task.length > 0 && (
            <SectionGroup label="Tarefas" icon={<CheckSquare className="h-3 w-3" />}>
              {grouped.task.map((r) => (
                <ResultRow key={r.id} result={r} onSelect={handleSelect} />
              ))}
            </SectionGroup>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function SectionGroup({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <div className="px-3 py-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}

function ResultRow({ result, onSelect }: { result: SearchResult; onSelect: (r: SearchResult) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(result)}
      className="w-full text-left px-3 py-2 hover:bg-accent/30 transition-colors flex flex-col gap-0.5 border-b border-border/40 last:border-0"
    >
      <span className="text-sm font-medium text-foreground truncate">{result.title}</span>
      {result.subtitle && (
        <span className="text-xs text-muted-foreground truncate">{result.subtitle}</span>
      )}
    </button>
  );
}
