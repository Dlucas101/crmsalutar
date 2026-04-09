import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Upload, FileText, Download, Trash2, Plus, Loader2 } from "lucide-react";

interface ContractTemplate {
  id: string;
  nome: string;
  file_path: string;
  campos: string[];
  secoes_condicionais: string[];
  created_at: string;
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

      // Parse fields from DOCX
      const { data: session } = await supabase.auth.getSession();
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

  useEffect(() => {
    if (currentTemplate) {
      const newFormData: Record<string, string> = {};
      currentTemplate.campos.forEach((c) => (newFormData[c] = ""));
      setFormData(newFormData);

      const newSections: Record<string, boolean> = {};
      currentTemplate.secoes_condicionais.forEach((s) => (newSections[s] = true));
      setSections(newSections);
    }
  }, [selectedTemplate]);

  const handleGenerate = async () => {
    if (!selectedTemplate) {
      toast({ title: "Selecione um modelo", variant: "destructive" });
      return;
    }

    setGenerating(true);
    try {
      const response = await supabase.functions.invoke("process-contract", {
        body: {
          action: "generate",
          template_id: selectedTemplate,
          dados: formData,
          secoes: sections,
        },
      });

      if (response.error) throw new Error(response.error.message);

      // Download the generated DOCX
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
    } catch (err: any) {
      toast({ title: "Erro ao gerar contrato", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
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

      <Tabs defaultValue="gerar" className="w-full">
        <TabsList>
          {isAdmin && <TabsTrigger value="modelos">Modelos</TabsTrigger>}
          <TabsTrigger value="gerar">Gerar Contrato</TabsTrigger>
        </TabsList>

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
                    <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground space-y-1">
                      <p className="font-medium text-foreground">Marcadores suportados:</p>
                      <p>
                        <code className="bg-background px-1 rounded">{`{{nome_campo}}`}</code> — campo de preenchimento
                      </p>
                      <p>
                        <code className="bg-background px-1 rounded">{`{{#secao}}...{{/secao}}`}</code> — seção condicional
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
                  <CardTitle className="text-lg">Preencher Campos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentTemplate.campos.map((campo) => (
                      <div key={campo}>
                        <Label>{formatFieldLabel(campo)}</Label>
                        <Input
                          value={formData[campo] || ""}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, [campo]: e.target.value }))
                          }
                          placeholder={`Digite ${formatFieldLabel(campo).toLowerCase()}`}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {currentTemplate.secoes_condicionais.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Seções Condicionais</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {currentTemplate.secoes_condicionais.map((secao) => (
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
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
