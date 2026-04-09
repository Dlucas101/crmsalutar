

## Plano: Módulo de Contratos com Templates DOCX

### Como funciona

Você faz upload de um arquivo Word (.docx) como modelo de contrato. Dentro do Word, você coloca marcadores especiais que o sistema reconhece:

**Para campos preenchíveis**, use chaves duplas:
```text
{{nome_cliente}}
{{cpf_cnpj}}
{{valor_mensal}}
{{endereco}}
```

**Para seções condicionais** (que podem ser removidas via checkbox), use chaves com `#` para abrir e `/` para fechar:
```text
{{#desconto}}
O CONTRATANTE terá desconto de {{valor_desconto}} aplicado nas primeiras {{meses_desconto}} mensalidades.
{{/desconto}}
```

No Word, basta digitar esses marcadores exatamente assim no texto. O sistema lê o DOCX, encontra todos os `{{...}}` e monta o formulário automaticamente.

### Fluxo do usuário

1. **Aba Contratos** no menu lateral
2. **Gerenciar Modelos** — upload de DOCX, dar nome ao modelo (ex: "Contrato Locação Padrão")
3. **Gerar Contrato** — seleciona modelo, sistema mostra formulário com todos os campos encontrados + checkboxes para seções condicionais
4. **Preencher** — digita os dados nos campos
5. **Exportar** — botão PDF e botão DOCX, ambos com os dados preenchidos e seções removidas

### Logo

A logo que já está no seu modelo Word será mantida. O sistema preserva imagens, formatação e layout do DOCX original — ele só substitui os marcadores pelos valores digitados.

### Detalhes técnicos

**Banco de dados:**
- Tabela `contract_templates`: id, nome, arquivo (storage), campos detectados (JSON), created_at
- Tabela `generated_contracts`: id, template_id, dados preenchidos (JSON), gerado_por, created_at
- Storage bucket para os arquivos DOCX (modelos e gerados)
- RLS: apenas admin/gestor pode gerenciar modelos; membros podem gerar contratos

**Backend (Edge Function):**
- `process-contract`: recebe o template DOCX do storage, substitui os `{{campo}}` pelos valores, remove blocos `{{#secao}}...{{/secao}}` desmarcados, gera DOCX final e converte para PDF
- Usa a biblioteca `docx-templates` para manipulação do DOCX server-side

**Frontend:**
- Nova página `src/pages/Contratos.tsx` com duas abas: "Modelos" e "Gerar"
- Upload de DOCX com preview do nome e campos detectados
- Formulário dinâmico gerado a partir dos marcadores encontrados
- Botões de download PDF e DOCX

**Segurança:**
- Bucket com RLS: upload apenas admin/gestor, download autenticados
- Tabelas com RLS restritivas (admin/gestor para modelos, autenticados para geração)
- Validação de segurança após implementação

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| `supabase/migrations/` | Criar tabelas contract_templates e generated_contracts |
| `supabase/functions/process-contract/` | Edge function para processar DOCX |
| `src/pages/Contratos.tsx` | Nova página com abas Modelos e Gerar |
| `src/components/AppSidebar.tsx` | Adicionar link "Contratos" |
| `src/App.tsx` | Adicionar rota `/contratos` |

### Exemplo prático no Word

```text
CONTRATO DE PRESTAÇÃO DE SERVIÇOS

CONTRATANTE: {{nome_cliente}}
CPF/CNPJ: {{cpf_cnpj}}
Endereço: {{endereco}}

Valor mensal: R$ {{valor_mensal}}

{{#desconto}}
CLÁUSULA DE DESCONTO
O CONTRATANTE terá desconto de R$ {{valor_desconto}} nas primeiras {{meses_desconto}} mensalidades.
{{/desconto}}

{{#fidelidade}}
CLÁUSULA DE FIDELIDADE
O presente contrato tem prazo mínimo de {{prazo_fidelidade}} meses.
{{/fidelidade}}
```

No sistema, apareceriam:
- **Campos de texto**: nome_cliente, cpf_cnpj, endereco, valor_mensal, valor_desconto, meses_desconto, prazo_fidelidade
- **Checkboxes**: "Incluir seção: desconto", "Incluir seção: fidelidade"

