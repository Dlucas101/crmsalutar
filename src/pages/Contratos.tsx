import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  FileText,
  Download,
  Trash2,
  Plus,
  Loader2,
  Search,
  Eye,
  History,
  FileDown,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

// ============== Types ==============

interface ContractTemplate {
  id: string;
  nome: string;
  file_path: string;
  campos: string[];
  secoes_condicionais: string[];
  created_at: string;
}

interface GeneratedContract {
  id: string;
  template_id: string;
  dados: Record<string, string>;
  file_path: string | null;
  generated_by: string | null;
  created_at: string;
  contract_templates?: { nome: string } | null;
}

// ============== Constants ==============

const CNPJ_FIELD_MAP: Record<string, string> = {
  razao: "razao_social",
  fantasia: "nome_fantasia",
  cnpj: "cnpj",
  endereco: "endereco",
  cidade: "cidade",
  municipio: "cidade",
  uf: "uf",
  estado: "uf",
  cep: "cep",
};

const DISCOUNT_KEYWORDS = ["desconto", "discount"];
// Fields that are auto-derived (e.g. "valor por extenso") should not be required.
const AUTO_DERIVED_KEYWORDS = ["extenso"];

// ============== Helpers ==============

function formatCnpjInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function valorPorExtenso(valor: string): string {
  const unidades = ["", "UM", "DOIS", "TRÊS", "QUATRO", "CINCO", "SEIS", "SETE", "OITO", "NOVE"];
  const especiais = ["DEZ", "ONZE", "DOZE", "TREZE", "QUATORZE", "QUINZE", "DEZESSEIS", "DEZESSETE", "DEZOITO", "DEZENOVE"];
  const dezenas = ["", "", "VINTE", "TRINTA", "QUARENTA", "CINQUENTA", "SESSENTA", "SETENTA", "OITENTA", "NOVENTA"];
  const centenas = ["", "CENTO", "DUZENTOS", "TREZENTOS", "QUATROCENTOS", "QUINHENTOS", "SEISCENTOS", "SETECENTOS", "OITOCENTOS", "NOVECENTOS"];

  const limpo = valor.replace(/[R$\s.]/g, "").replace(",", ".");
  const num = parseFloat(limpo);
  if (isNaN(num) || num < 0) return "";
  if (num === 0) return "ZERO REAIS";

  const inteiro = Math.floor(num);
  const centavosNum = Math.round((num - inteiro) * 100);

  function porExtensoAte999(n: number): string {
    if (n === 0) return "";
    if (n === 100) return "CEM";
    const parts: string[] = [];
    if (n >= 100) { parts.push(centenas[Math.floor(n / 100)]); n %= 100; }
    if (n >= 10 && n <= 19) { parts.push(especiais[n - 10]); return parts.join(" E "); }
    if (n >= 20) { parts.push(dezenas[Math.floor(n / 10)]); n %= 10; }
    if (n >= 1) { parts.push(unidades[n]); }
    return parts.join(" E ");
  }

  function porExtensoInteiro(n: number): string {
    if (n === 0) return "";
    if (n >= 1000000) {
      const milhoes = Math.floor(n / 1000000);
      const resto = n % 1000000;
      const mPart = milhoes === 1 ? "UM MILHÃO" : `${porExtensoAte999(milhoes)} MILHÕES`;
      if (resto === 0) return mPart;
      return `${mPart} ${resto < 1000 && resto > 0 ? "E " : ""}${porExtensoInteiro(resto)}`;
    }
    if (n >= 1000) {
      const milhares = Math.floor(n / 1000);
      const resto = n % 1000;
      const mPart = milhares === 1 ? "MIL" : `${porExtensoAte999(milhares)} MIL`;
      if (resto === 0) return mPart;
      return `${mPart} ${resto < 100 ? "E " : ""}${porExtensoAte999(resto)}`;
    }
    return porExtensoAte999(n);
  }

  const partes: string[] = [];
  if (inteiro > 0) {
    partes.push(`${porExtensoInteiro(inteiro)} ${inteiro === 1 ? "REAL" : "REAIS"}`);
  }
  if (centavosNum > 0) {
    partes.push(`${porExtensoAte999(centavosNum)} ${centavosNum === 1 ? "CENTAVO" : "CENTAVOS"}`);
  }
  return partes.join(" E ");
}

function isDiscountField(campo: string): boolean {
  const lower = campo.toLowerCase();
  return DISCOUNT_KEYWORDS.some((kw) => lower.includes(kw));
}

function isAutoDerivedField(campo: string): boolean {
  const lower = campo.toLowerCase();
  return AUTO_DERIVED_KEYWORDS.some((kw) => lower.includes(kw));
}

function formatFieldLabel(field: string): string {
  return field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke later so browsers can finish the download
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ============== Step Header ==============

function StepHeader({ step, title, description }: { step: number; title: string; description?: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {step}
      </div>
      <div className="flex-1">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && (
          <CardDescription className="mt-0.5 text-xs">{description}</CardDescription>
        )}
      </div>
    </div>
  );
}

// ============== Component ==============

export default function Contratos() {
  const { role } = useAuth();
  const isAdmin = role === "admin" || role === "gestor";

  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Modelos tab state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Generate tab state
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [sections, setSections] = useState<Record<string, boolean>>({});
  const [generating, setGenerating] = useState(false);
  const [hasDiscount, setHasDiscount] = useState(false);
  const [touched, setTouched] = useState(false);

  // CNPJ lookup
  const [cnpjInput, setCnpjInput] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

  // Preview
  const [previewOpen, setPreviewOpen] = useState(false);

  // History
  const [history, setHistory] = useState<GeneratedContract[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from("contract_templates")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setTemplates(
        data.map((t: any) => ({
          ...t,
          campos: Array.isArray(t.campos) ? t.campos : [],
          secoes_condicionais: Array.isArray(t.secoes_condicionais)
            ? t.secoes_condicionais
            : [],
        })),
      );
    }
    setLoading(false);
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from("generated_contracts")
      .select("*, contract_templates(nome)")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setHistory(data as any);
    }
    setLoadingHistory(false);
  };

  const handleUpload = async () => {
    if (!selectedFile || !templateName.trim()) {
      toast.error("Preencha o nome e selecione um arquivo");
      return;
    }

    setUploading(true);
    try {
      const filePath = `templates/${Date.now()}_${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("contracts")
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const response = await supabase.functions.invoke("process-contract", {
        body: { action: "parse", file_path: filePath },
      });

      if (response.error) throw new Error(response.error.message);

      const { campos, secoes_condicionais } = response.data;

      const { error: insertError } = await supabase
        .from("contract_templates")
        .insert({
          nome: templateName.trim(),
          file_path: filePath,
          campos,
          secoes_condicionais,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });

      if (insertError) throw insertError;

      toast.success("Modelo enviado com sucesso!");
      setUploadOpen(false);
      setTemplateName("");
      setSelectedFile(null);
      fetchTemplates();
    } catch (err: any) {
      toast.error("Erro ao enviar modelo", { description: err.message });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteTemplate = async (id: string, filePath: string) => {
    const { error } = await supabase.from("contract_templates").delete().eq("id", id);
    if (!error) {
      await supabase.storage.from("contracts").remove([filePath]);
      fetchTemplates();
      toast.success("Modelo excluído");
    } else {
      toast.error("Erro ao excluir modelo", { description: error.message });
    }
  };

  const currentTemplate = templates.find((t) => t.id === selectedTemplate);

  // Visible fields: hide discount-related fields when discount toggle is off.
  const visibleFields = useMemo(
    () =>
      currentTemplate?.campos.filter((campo) => {
        if (!hasDiscount && isDiscountField(campo)) return false;
        return true;
      }) || [],
    [currentTemplate, hasDiscount],
  );

  // Required fields = all visible fields that aren't auto-derived.
  const requiredFields = useMemo(
    () => visibleFields.filter((c) => !isAutoDerivedField(c)),
    [visibleFields],
  );

  const missingFields = useMemo(
    () => requiredFields.filter((c) => !formData[c]?.trim()),
    [requiredFields, formData],
  );

  const isFormValid = selectedTemplate && missingFields.length === 0;

  // Reset form when switching templates
  useEffect(() => {
    if (currentTemplate) {
      const newFormData: Record<string, string> = {};
      currentTemplate.campos.forEach((c) => (newFormData[c] = ""));
      setFormData(newFormData);

      const newSections: Record<string, boolean> = {};
      currentTemplate.secoes_condicionais.forEach((s) => (newSections[s] = true));
      setSections(newSections);
      setCnpjInput("");
      setHasDiscount(false);
      setTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplate]);

  const handleCnpjLookup = async () => {
    const digits = cnpjInput.replace(/\D/g, "");
    if (digits.length !== 14) {
      toast.error("Digite um CNPJ válido com 14 dígitos");
      return;
    }

    setLookingUp(true);
    try {
      const response = await supabase.functions.invoke("cnpj-lookup", {
        body: { cnpj: digits },
      });

      if (response.error) throw new Error(response.error.message);
      const apiData = response.data as Record<string, string>;

      if (!currentTemplate) return;

      const updatedForm = { ...formData };
      let filledCount = 0;
      for (const campo of currentTemplate.campos) {
        const campoLower = campo.toLowerCase();
        for (const [keyword, apiKey] of Object.entries(CNPJ_FIELD_MAP)) {
          if (campoLower.includes(keyword) && apiData[apiKey]) {
            updatedForm[campo] = apiData[apiKey];
            filledCount++;
            break;
          }
        }
      }
      setFormData(updatedForm);
      toast.success(`CNPJ consultado`, {
        description: `${filledCount} campo(s) preenchido(s) automaticamente.`,
      });
    } catch (err: any) {
      toast.error("Erro ao consultar CNPJ", { description: err.message });
    } finally {
      setLookingUp(false);
    }
  };

  // Build the final payload (data + sections), with discount logic applied.
  const buildGenerationPayload = () => {
    if (!currentTemplate) return null;

    const finalData: Record<string, string> = { ...formData };
    if (!hasDiscount) {
      for (const campo of currentTemplate.campos) {
        if (isDiscountField(campo)) finalData[campo] = "";
      }
    }

    const finalSections: Record<string, boolean> = { ...sections };
    for (const secao of currentTemplate.secoes_condicionais) {
      if (secao.toLowerCase().includes("desconto")) {
        finalSections[secao] = hasDiscount;
      }
    }

    return { finalData, finalSections };
  };

  const handleGenerate = async () => {
    setTouched(true);

    if (!selectedTemplate) {
      toast.error("Selecione um modelo");
      return;
    }
    if (missingFields.length > 0) {
      toast.error("Campos obrigatórios não preenchidos", {
        description: `${missingFields.length} campo(s) pendente(s). Revise o formulário.`,
      });
      return;
    }

    const payload = buildGenerationPayload();
    if (!payload) return;

    // Pre-open a tab synchronously so popup-blockers don't kill it after the await.
    const popup = window.open("about:blank", "_blank");

    setGenerating(true);
    const loadingToast = toast.loading("Gerando contrato em PDF...");
    try {
      const response = await supabase.functions.invoke("process-contract", {
        body: {
          action: "generate-pdf",
          template_id: selectedTemplate,
          dados: payload.finalData,
          secoes: payload.finalSections,
        },
      });

      if (response.error) throw new Error(response.error.message);
      const url = (response.data as { url?: string })?.url;
      if (!url) throw new Error("URL do PDF não retornada");

      if (popup && !popup.closed) {
        popup.location.href = url;
      } else {
        // Popup blocked — fallback to opening directly (may also be blocked).
        window.open(url, "_blank");
        toast.warning("Permita pop-ups para abrir o PDF automaticamente.");
      }

      toast.dismiss(loadingToast);
      toast.success("Contrato gerado!", {
        description: "O PDF foi aberto em uma nova aba.",
      });
      fetchHistory();
    } catch (err: any) {
      if (popup && !popup.closed) popup.close();
      toast.dismiss(loadingToast);
      toast.error("Erro ao gerar contrato", {
        description: err?.message || "Tente novamente em alguns instantes.",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadFromHistory = async (filePath: string) => {
    // Pre-open tab synchronously to avoid pop-up blockers.
    const popup = window.open("about:blank", "_blank");
    try {
      // History entries may be either old DOCX (in "contracts") or new PDF (in "contratos-gerados").
      const isPdf = filePath.toLowerCase().endsWith(".pdf");
      if (isPdf) {
        const response = await supabase.functions.invoke("process-contract", {
          body: { action: "sign-url", file_path: filePath },
        });
        if (response.error) throw new Error(response.error.message);
        const url = (response.data as { url?: string })?.url;
        if (!url) throw new Error("URL não retornada");
        if (popup && !popup.closed) popup.location.href = url;
        else window.open(url, "_blank");
      } else {
        if (popup && !popup.closed) popup.close();
        const { data, error } = await supabase.storage.from("contracts").download(filePath);
        if (error) throw error;
        downloadBlob(data, `contrato.docx`);
      }
    } catch (err: any) {
      if (popup && !popup.closed) popup.close();
      toast.error("Erro ao abrir contrato", { description: err.message });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Contratos</h1>
        <p className="text-muted-foreground">Gerencie modelos e gere contratos preenchidos</p>
      </div>

      <Tabs
        defaultValue="gerar"
        className="w-full"
        onValueChange={(v) => {
          if (v === "historico") fetchHistory();
        }}
      >
        <TabsList>
          {isAdmin && <TabsTrigger value="modelos">Modelos</TabsTrigger>}
          <TabsTrigger value="gerar">Gerar Contrato</TabsTrigger>
          <TabsTrigger value="historico">
            <History className="h-4 w-4 mr-1" /> Histórico
          </TabsTrigger>
        </TabsList>

        {/* ============ MODELOS TAB ============ */}
        {isAdmin && (
          <TabsContent value="modelos" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" /> Novo Modelo
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Enviar Modelo de Contrato</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Nome do Modelo</Label>
                      <Input
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="Ex: Contrato Locação Padrão"
                      />
                    </div>
                    <div>
                      <Label>Arquivo DOCX</Label>
                      <div className="mt-1">
                        <label className="flex items-center gap-2 cursor-pointer border border-input rounded-md p-3 hover:bg-accent transition-colors">
                          <Upload className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {selectedFile ? selectedFile.name : "Selecionar arquivo .docx"}
                          </span>
                          <input
                            type="file"
                            accept=".docx"
                            className="hidden"
                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                          />
                        </label>
                      </div>
                    </div>
                    <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground space-y-2">
                      <p className="font-medium text-foreground">Marcadores suportados:</p>
                      <p className="font-medium text-foreground text-[11px] mt-1">Dados da empresa (CNPJ):</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                        <p><code className="bg-background px-1 rounded">{`{{razao_social}}`}</code> — Razão Social</p>
                        <p><code className="bg-background px-1 rounded">{`{{nome_fantasia}}`}</code> — Nome Fantasia</p>
                        <p><code className="bg-background px-1 rounded">{`{{cnpj}}`}</code> — CNPJ</p>
                        <p><code className="bg-background px-1 rounded">{`{{endereco}}`}</code> — Endereço</p>
                        <p><code className="bg-background px-1 rounded">{`{{cidade}}`}</code> — Cidade</p>
                        <p><code className="bg-background px-1 rounded">{`{{uf}}`}</code> — Estado (UF)</p>
                        <p><code className="bg-background px-1 rounded">{`{{cep}}`}</code> — CEP</p>
                      </div>
                      <p className="font-medium text-foreground text-[11px] mt-1">Dados do contrato:</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                        <p><code className="bg-background px-1 rounded">{`{{dia_vencimento}}`}</code> — Dia do vencimento</p>
                        <p><code className="bg-background px-1 rounded">{`{{valor_acordado}}`}</code> — Valor acordado</p>
                        <p><code className="bg-background px-1 rounded">{`{{valor_desconto}}`}</code> — Valor do desconto</p>
                        <p><code className="bg-background px-1 rounded">{`{{valor_desconto_extenso}}`}</code> — Valor desconto por extenso</p>
                        <p><code className="bg-background px-1 rounded">{`{{valor_acordado_extenso}}`}</code> — Valor acordado por extenso</p>
                        <p><code className="bg-background px-1 rounded">{`{{nome_sistema}}`}</code> — Nome do sistema</p>
                        <p><code className="bg-background px-1 rounded">{`{{qtd_computadores}}`}</code> — Qtd computadores</p>
                        <p><code className="bg-background px-1 rounded">{`{{chave}}`}</code> — Chave de identificação</p>
                      </div>
                      <p className="font-medium text-foreground text-[11px] mt-1">Datas e assinatura:</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                        <p><code className="bg-background px-1 rounded">{`{{data_inicio}}`}</code> — Data início</p>
                        <p><code className="bg-background px-1 rounded">{`{{data_fim}}`}</code> — Data fim</p>
                        <p><code className="bg-background px-1 rounded">{`{{dia}}`}</code> — Dia (assinatura)</p>
                        <p><code className="bg-background px-1 rounded">{`{{mes}}`}</code> — Mês (assinatura)</p>
                        <p><code className="bg-background px-1 rounded">{`{{ano}}`}</code> — Ano (assinatura)</p>
                        <p><code className="bg-background px-1 rounded">{`{{nome_responsavel}}`}</code> — Nome responsável</p>
                        <p><code className="bg-background px-1 rounded">{`{{cpf_responsavel}}`}</code> — CPF responsável</p>
                      </div>
                      <p className="font-medium text-foreground text-[11px] mt-1">Seções condicionais:</p>
                      <p><code className="bg-background px-1 rounded">{`{{#desconto}}...{{/desconto}}`}</code> — Bloco de desconto (incluir/remover)</p>
                      <p className="text-[10px] mt-1 italic">
                        Você pode criar campos personalizados usando{" "}
                        <code className="bg-background px-1 rounded">{`{{nome_campo}}`}</code>
                      </p>
                    </div>
                    <Button onClick={handleUpload} disabled={uploading} className="w-full">
                      {uploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...
                        </>
                      ) : (
                        "Enviar Modelo"
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Campos</TableHead>
                      <TableHead>Seções</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Nenhum modelo cadastrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      templates.map((tpl) => (
                        <TableRow key={tpl.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-primary" />
                              {tpl.nome}
                            </div>
                          </TableCell>
                          <TableCell>{tpl.campos.length} campos</TableCell>
                          <TableCell>{tpl.secoes_condicionais.length} seções</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {new Date(tpl.created_at).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteTemplate(tpl.id, tpl.file_path)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ============ GERAR CONTRATO TAB ============ */}
        <TabsContent value="gerar" className="space-y-5">
          {/* Step 1: Modelo */}
          <Card>
            <CardHeader>
              <StepHeader
                step={1}
                title="Selecionar modelo"
                description="Escolha o modelo de contrato que deseja preencher."
              />
            </CardHeader>
            <CardContent>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um modelo de contrato" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentTemplate && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary">{currentTemplate.campos.length} campos</Badge>
                  {currentTemplate.secoes_condicionais.length > 0 && (
                    <Badge variant="secondary">
                      {currentTemplate.secoes_condicionais.length} seções condicionais
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {currentTemplate && (
            <>
              {/* Step 2: CNPJ + Discount + Fields */}
              <Card>
                <CardHeader>
                  <StepHeader
                    step={2}
                    title="Preencher dados"
                    description="Consulte um CNPJ para auto-preencher e ajuste os campos restantes."
                  />
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* CNPJ lookup */}
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      Consulta de CNPJ (opcional)
                    </Label>
                    <div className="flex gap-2 items-end mt-1">
                      <div className="flex-1">
                        <Input
                          value={cnpjInput}
                          onChange={(e) => setCnpjInput(formatCnpjInput(e.target.value))}
                          placeholder="00.000.000/0000-00"
                          maxLength={18}
                        />
                      </div>
                      <Button
                        onClick={handleCnpjLookup}
                        disabled={lookingUp}
                        variant="outline"
                        type="button"
                      >
                        {lookingUp ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Search className="h-4 w-4 mr-2" /> Consultar
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Os campos compatíveis (razão social, endereço, etc.) serão preenchidos automaticamente.
                    </p>
                  </div>

                  {/* Discount toggle */}
                  {currentTemplate.campos.some((c) => isDiscountField(c)) && (
                    <>
                      <Separator />
                      <div className="flex items-start gap-3">
                        <Switch
                          id="has-discount"
                          checked={hasDiscount}
                          onCheckedChange={setHasDiscount}
                        />
                        <div className="flex-1">
                          <Label htmlFor="has-discount" className="cursor-pointer font-medium">
                            Possui valor de desconto até o vencimento?
                          </Label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {hasDiscount
                              ? "Os campos de desconto serão exibidos abaixo e a seção será mantida no contrato."
                              : "Campos e seção de desconto serão removidos do contrato gerado."}
                          </p>
                        </div>
                      </div>
                    </>
                  )}

                  <Separator />

                  {/* Fields */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                        Campos do contrato
                      </Label>
                      {touched && missingFields.length > 0 && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {missingFields.length} pendente{missingFields.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                      {touched && missingFields.length === 0 && requiredFields.length > 0 && (
                        <Badge className="gap-1 bg-[hsl(var(--neon-green))] hover:bg-[hsl(var(--neon-green))] text-white">
                          <CheckCircle2 className="h-3 w-3" />
                          Tudo preenchido
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {visibleFields.map((campo) => {
                        const isAuto = isAutoDerivedField(campo);
                        const isMissing = touched && !isAuto && !formData[campo]?.trim();
                        return (
                          <div key={campo}>
                            <Label className="flex items-center gap-1">
                              {formatFieldLabel(campo)}
                              {!isAuto && <span className="text-destructive">*</span>}
                              {isAuto && (
                                <span className="text-[10px] text-muted-foreground font-normal">
                                  (automático)
                                </span>
                              )}
                            </Label>
                            <Input
                              value={formData[campo] || ""}
                              aria-invalid={isMissing}
                              className={isMissing ? "border-destructive focus-visible:ring-destructive" : ""}
                              onChange={(e) => {
                                const newVal = e.target.value;
                                setFormData((prev) => {
                                  const updated = { ...prev, [campo]: newVal };
                                  const campoLower = campo.toLowerCase();
                                  if (campoLower.includes("valor") && !campoLower.includes("extenso")) {
                                    const extensoKey = currentTemplate?.campos.find(
                                      (c) =>
                                        c.toLowerCase().includes("extenso") &&
                                        c
                                          .toLowerCase()
                                          .includes(
                                            campoLower.includes("desconto")
                                              ? "desconto"
                                              : campoLower.includes("acordado")
                                                ? "acordado"
                                                : "valor",
                                          ),
                                    );
                                    if (extensoKey) {
                                      updated[extensoKey] = valorPorExtenso(newVal);
                                    }
                                  }
                                  return updated;
                                });
                              }}
                              placeholder={`Digite ${formatFieldLabel(campo).toLowerCase()}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Step 3: Conditional sections (non-discount) */}
              {currentTemplate.secoes_condicionais.filter(
                (s) => !s.toLowerCase().includes("desconto"),
              ).length > 0 && (
                <Card>
                  <CardHeader>
                    <StepHeader
                      step={3}
                      title="Seções condicionais"
                      description="Marque as seções opcionais que devem aparecer no contrato."
                    />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {currentTemplate.secoes_condicionais
                        .filter((s) => !s.toLowerCase().includes("desconto"))
                        .map((secao) => (
                          <div key={secao} className="flex items-center gap-3">
                            <Checkbox
                              id={secao}
                              checked={sections[secao] ?? true}
                              onCheckedChange={(checked) =>
                                setSections((prev) => ({ ...prev, [secao]: !!checked }))
                              }
                            />
                            <Label htmlFor={secao} className="cursor-pointer">
                              Incluir seção: {formatFieldLabel(secao)}
                            </Label>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Step 4: Generate */}
              <Card>
                <CardHeader>
                  <StepHeader
                    step={
                      currentTemplate.secoes_condicionais.filter(
                        (s) => !s.toLowerCase().includes("desconto"),
                      ).length > 0
                        ? 4
                        : 3
                    }
                    title="Revisar e gerar"
                    description="Verifique os dados na pré-visualização e gere o documento final."
                  />
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setTouched(true);
                        setPreviewOpen(true);
                      }}
                      className="flex-1"
                    >
                      <Eye className="h-4 w-4 mr-2" /> Pré-visualizar
                    </Button>
                    <Button
                      onClick={handleGenerate}
                      disabled={generating || !isFormValid}
                      className="flex-1"
                    >
                      {generating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando PDF...
                        </>
                      ) : (
                        <>
                          <FileDown className="h-4 w-4 mr-2" /> Gerar Contrato (PDF)
                        </>
                      )}
                    </Button>
                  </div>
                  {touched && missingFields.length > 0 && (
                    <p className="text-xs text-destructive mt-3 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Preencha os campos obrigatórios antes de gerar.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Preview Dialog */}
              <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Pré-visualização do contrato</DialogTitle>
                    <DialogDescription>
                      Confira os dados antes de gerar o documento final.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    {/* Summary */}
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">
                        <FileText className="h-3 w-3 mr-1" />
                        {currentTemplate.nome}
                      </Badge>
                      {missingFields.length === 0 ? (
                        <Badge className="gap-1 bg-[hsl(var(--neon-green))] hover:bg-[hsl(var(--neon-green))] text-white">
                          <CheckCircle2 className="h-3 w-3" />
                          Pronto para gerar
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {missingFields.length} campo(s) vazio(s)
                        </Badge>
                      )}
                    </div>

                    {/* Fields */}
                    <div className="rounded-md border">
                      <div className="px-4 py-2 border-b bg-muted/50">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Campos preenchidos
                        </p>
                      </div>
                      <div className="divide-y">
                        {visibleFields.map((campo) => {
                          const value = formData[campo];
                          const isAuto = isAutoDerivedField(campo);
                          const isEmpty = !value?.trim();
                          return (
                            <div
                              key={campo}
                              className="flex justify-between items-center gap-4 px-4 py-2.5"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm font-medium text-foreground truncate">
                                  {formatFieldLabel(campo)}
                                </span>
                                {!isAuto && <span className="text-destructive text-xs">*</span>}
                                {isAuto && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    auto
                                  </Badge>
                                )}
                              </div>
                              <span
                                className={`text-sm text-right truncate max-w-[55%] ${
                                  isEmpty
                                    ? "italic text-destructive"
                                    : "text-foreground"
                                }`}
                              >
                                {isEmpty ? "Vazio" : value}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Sections */}
                    {currentTemplate.secoes_condicionais.length > 0 && (
                      <div className="rounded-md border">
                        <div className="px-4 py-2 border-b bg-muted/50">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Seções condicionais
                          </p>
                        </div>
                        <div className="divide-y">
                          {currentTemplate.secoes_condicionais.map((secao) => {
                            const isDiscountSection = secao.toLowerCase().includes("desconto");
                            const included = isDiscountSection
                              ? hasDiscount
                              : (sections[secao] ?? true);
                            return (
                              <div
                                key={secao}
                                className="flex justify-between items-center px-4 py-2.5"
                              >
                                <span className="text-sm font-medium text-foreground">
                                  {formatFieldLabel(secao)}
                                </span>
                                <Badge
                                  variant={included ? "default" : "outline"}
                                  className={
                                    included
                                      ? "bg-[hsl(var(--neon-green))] hover:bg-[hsl(var(--neon-green))] text-white"
                                      : "text-muted-foreground"
                                  }
                                >
                                  {included ? "Incluída" : "Removida"}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {!hasDiscount &&
                      currentTemplate.campos.some((c) => isDiscountField(c)) && (
                        <p className="text-xs text-muted-foreground italic">
                          * Campos e seção de desconto serão removidos do contrato final.
                        </p>
                      )}

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <Button
                        variant="outline"
                        onClick={() => setPreviewOpen(false)}
                        className="flex-1"
                      >
                        Voltar e editar
                      </Button>
                      <Button
                        onClick={() => {
                          setPreviewOpen(false);
                          handleGenerate();
                        }}
                        disabled={generating || missingFields.length > 0}
                        className="flex-1"
                      >
                        {generating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando PDF...
                          </>
                        ) : (
                          <>
                            <FileDown className="h-4 w-4 mr-2" /> Gerar PDF
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </TabsContent>

        {/* ============ HISTÓRICO TAB ============ */}
        <TabsContent value="historico" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contratos Gerados</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Modelo</TableHead>
                      <TableHead>Dados Principais</TableHead>
                      <TableHead>Data de Geração</TableHead>
                      <TableHead className="w-20">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Nenhum contrato gerado ainda
                        </TableCell>
                      </TableRow>
                    ) : (
                      history.map((item) => {
                        const dados = (item.dados || {}) as Record<string, string>;
                        const razao = dados.razao_social || dados.nome_fantasia || "";
                        const cnpj = dados.cnpj || "";
                        const tplName = (item as any).contract_templates?.nome || "—";

                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-primary" />
                                <span className="font-medium">{tplName}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {razao && <p className="font-medium text-foreground">{razao}</p>}
                                {cnpj && <p className="text-muted-foreground text-xs">{cnpj}</p>}
                                {!razao && !cnpj && <span className="text-muted-foreground">—</span>}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {new Date(item.created_at).toLocaleDateString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </TableCell>
                            <TableCell>
                              {item.file_path && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDownloadFromHistory(item.file_path!)}
                                  title="Abrir contrato"
                                >
                                  <FileDown className="h-4 w-4" />
                                </Button>
                                  <FileDown className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
