import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
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
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, FileText, Download, Trash2, Plus, Loader2, Search, Eye, History, FileDown } from "lucide-react";

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

function formatCnpjInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
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

export default function Contratos() {
  const { role } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === "admin" || role === "gestor";

  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);
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

  // CNPJ lookup state
  const [cnpjInput, setCnpjInput] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

  // Preview
  const [previewOpen, setPreviewOpen] = useState(false);

  // History tab
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
      setTemplates(data.map((t: any) => ({
        ...t,
        campos: Array.isArray(t.campos) ? t.campos : [],
        secoes_condicionais: Array.isArray(t.secoes_condicionais) ? t.secoes_condicionais : [],
      })));
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
      toast({ title: "Preencha o nome e selecione um arquivo", variant: "destructive" });
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

      toast({ title: "Modelo enviado com sucesso!" });
      setUploadOpen(false);
      setTemplateName("");
      setSelectedFile(null);
      fetchTemplates();
    } catch (err: any) {
      toast({ title: "Erro ao enviar modelo", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteTemplate = async (id: string, filePath: string) => {
    const { error } = await supabase.from("contract_templates").delete().eq("id", id);
    if (!error) {
      await supabase.storage.from("contracts").remove([filePath]);
      fetchTemplates();
      toast({ title: "Modelo excluído" });
    }
  };

  const currentTemplate = templates.find((t) => t.id === selectedTemplate);

  // Filter out discount fields when discount is disabled
  const visibleFields = currentTemplate?.campos.filter((campo) => {
    if (!hasDiscount && isDiscountField(campo)) return false;
    return true;
  }) || [];

  const handleCnpjLookup = async () => {
    const digits = cnpjInput.replace(/\D/g, "");
    if (digits.length !== 14) {
      toast({ title: "Digite um CNPJ válido com 14 dígitos", variant: "destructive" });
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
      for (const campo of currentTemplate.campos) {
        const campoLower = campo.toLowerCase();
        for (const [keyword, apiKey] of Object.entries(CNPJ_FIELD_MAP)) {
          if (campoLower.includes(keyword) && apiData[apiKey]) {
            updatedForm[campo] = apiData[apiKey];
            break;
          }
        }
      }
      setFormData(updatedForm);
      toast({ title: "Dados do CNPJ preenchidos!" });
    } catch (err: any) {
      toast({ title: "Erro ao consultar CNPJ", description: err.message, variant: "destructive" });
    } finally {
      setLookingUp(false);
    }
  };

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
    }
  }, [selectedTemplate]);

  const handleGenerate = async () => {
    if (!selectedTemplate) {
      toast({ title: "Selecione um modelo", variant: "destructive" });
      return;
    }

    setGenerating(true);
    try {
      // Build final data: clear discount fields if disabled
      const finalData = { ...formData };
      if (!hasDiscount && currentTemplate) {
        for (const campo of currentTemplate.campos) {
          if (isDiscountField(campo)) {
            finalData[campo] = "";
          }
        }
      }

      // Also toggle the "desconto" conditional section based on checkbox
      const finalSections = { ...sections };
      for (const secao of currentTemplate?.secoes_condicionais || []) {
        if (secao.toLowerCase().includes("desconto")) {
          finalSections[secao] = hasDiscount;
        }
      }

      const response = await supabase.functions.invoke("process-contract", {
        body: {
          action: "generate",
          template_id: selectedTemplate,
          dados: finalData,
          secoes: finalSections,
        },
      });

      if (response.error) throw new Error(response.error.message);

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contrato_${currentTemplate?.nome || "gerado"}.docx`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: "Contrato gerado com sucesso!" });
      // Refresh history
      fetchHistory();
    } catch (err: any) {
      toast({ title: "Erro ao gerar contrato", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadFromHistory = async (filePath: string, templateName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("contracts")
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contrato_${templateName}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Erro ao baixar contrato", description: err.message, variant: "destructive" });
    }
  };

  const formatFieldLabel = (field: string) => {
    return field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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

      <Tabs defaultValue="gerar" className="w-full" onValueChange={(v) => {
        if (v === "historico") fetchHistory();
      }}>
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
                      <p className="text-[10px] mt-1 italic">Você pode criar campos personalizados usando <code className="bg-background px-1 rounded">{`{{nome_campo}}`}</code></p>
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
        <TabsContent value="gerar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Selecionar Modelo</CardTitle>
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
            </CardContent>
          </Card>

          {currentTemplate && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Consultar CNPJ</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label>CNPJ</Label>
                      <Input
                        value={cnpjInput}
                        onChange={(e) => setCnpjInput(formatCnpjInput(e.target.value))}
                        placeholder="00.000.000/0000-00"
                        maxLength={18}
                      />
                    </div>
                    <Button onClick={handleCnpjLookup} disabled={lookingUp} variant="outline">
                      {lookingUp ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Search className="h-4 w-4 mr-2" /> Consultar
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Digite o CNPJ para preencher automaticamente razão social, endereço e outros campos.
                  </p>
                </CardContent>
              </Card>

              {/* Discount toggle */}
              {currentTemplate.campos.some((c) => isDiscountField(c)) && (
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      <Switch
                        id="has-discount"
                        checked={hasDiscount}
                        onCheckedChange={setHasDiscount}
                      />
                      <Label htmlFor="has-discount" className="cursor-pointer font-medium">
                        Possui valor de desconto até o vencimento?
                      </Label>
                    </div>
                    {!hasDiscount && (
                      <p className="text-xs text-muted-foreground mt-2 ml-14">
                        Os campos e a seção de desconto serão removidos do contrato.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Preencher Campos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {visibleFields.map((campo) => (
                      <div key={campo}>
                        <Label>{formatFieldLabel(campo)}</Label>
                        <Input
                          value={formData[campo] || ""}
                          onChange={(e) => {
                            const newVal = e.target.value;
                            setFormData((prev) => {
                              const updated = { ...prev, [campo]: newVal };
                              const campoLower = campo.toLowerCase();
                              if (campoLower.includes("valor") && !campoLower.includes("extenso")) {
                                const extensoKey = currentTemplate?.campos.find(
                                  (c) => c.toLowerCase().includes("extenso") && c.toLowerCase().includes(
                                    campoLower.includes("desconto") ? "desconto" : campoLower.includes("acordado") ? "acordado" : "valor"
                                  )
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
                    ))}
                  </div>
                </CardContent>
              </Card>

              {currentTemplate.secoes_condicionais.filter(
                (s) => !s.toLowerCase().includes("desconto")
              ).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Seções Condicionais</CardTitle>
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

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setPreviewOpen(true)} className="flex-1">
                  <Eye className="h-4 w-4 mr-2" /> Pré-visualizar
                </Button>
                <Button onClick={handleGenerate} disabled={generating} className="flex-1">
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" /> Gerar e Baixar DOCX
                    </>
                  )}
                </Button>
              </div>

              {/* Preview Dialog */}
              <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Pré-visualização do Contrato</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="rounded-md border p-4 bg-background">
                      <h3 className="font-semibold text-foreground mb-3">
                        Modelo: {currentTemplate.nome}
                      </h3>

                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                          Campos preenchidos
                        </p>
                        {visibleFields.map((campo) => (
                          <div key={campo} className="flex justify-between py-1 border-b border-border/50 last:border-0">
                            <span className="text-sm font-medium text-foreground">
                              {formatFieldLabel(campo)}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {formData[campo] || <span className="italic text-destructive">Vazio</span>}
                            </span>
                          </div>
                        ))}
                      </div>

                      {currentTemplate.secoes_condicionais.length > 0 && (
                        <div className="mt-4">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                            Seções condicionais
                          </p>
                          {currentTemplate.secoes_condicionais.map((secao) => {
                            const isDiscountSection = secao.toLowerCase().includes("desconto");
                            const included = isDiscountSection ? hasDiscount : (sections[secao] ?? true);
                            return (
                              <div key={secao} className="flex justify-between py-1 border-b border-border/50 last:border-0">
                                <span className="text-sm font-medium text-foreground">
                                  {formatFieldLabel(secao)}
                                </span>
                                <span className={`text-sm ${included ? "text-green-600" : "text-destructive"}`}>
                                  {included ? "Incluída" : "Removida"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {!hasDiscount && currentTemplate.campos.some((c) => isDiscountField(c)) && (
                        <p className="text-xs text-muted-foreground mt-3 italic">
                          * Campos e seção de desconto serão removidos do contrato final.
                        </p>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setPreviewOpen(false)} className="flex-1">
                        Voltar e Editar
                      </Button>
                      <Button onClick={() => { setPreviewOpen(false); handleGenerate(); }} disabled={generating} className="flex-1">
                        {generating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando...
                          </>
                        ) : (
                          <>
                            <Download className="h-4 w-4 mr-2" /> Gerar e Baixar
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
                                  onClick={() => handleDownloadFromHistory(item.file_path!, tplName)}
                                  title="Baixar DOCX"
                                >
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
