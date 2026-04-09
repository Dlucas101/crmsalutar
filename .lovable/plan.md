

## Plano: Consulta de CNPJ via ReceitaWS nos Contratos

### O que muda

Na aba "Gerar Contrato", um campo de CNPJ com botão "Consultar" aparecerá acima dos campos do formulário. Ao digitar o CNPJ e clicar, o sistema busca os dados na ReceitaWS e preenche automaticamente os campos correspondentes no formulário (razão social, endereço, cidade, UF, CNPJ, nome fantasia).

### Detalhes técnicos

**Edge Function `cnpj-lookup`:**
- Nova function que recebe o CNPJ, chama `https://receitaws.com.br/v1/cnpj/{cnpj}` server-side (evita bloqueio de CORS no navegador) e retorna os dados
- Validação do formato do CNPJ antes de chamar a API
- Autenticação obrigatória (usuário logado)

**Frontend (`Contratos.tsx`):**
- Novo bloco acima dos campos com input de CNPJ (máscara XX.XXX.XXX/XXXX-XX) + botão "Consultar CNPJ"
- Ao receber resposta, mapeia os campos da ReceitaWS para os campos do template:
  - `nome` / `razao_social` → razão social
  - `fantasia` / `nome_fantasia` → nome fantasia
  - `logradouro` + `numero` + `complemento` + `bairro` → endereço
  - `municipio` / `cidade` → cidade
  - `uf` → UF
  - `cnpj` → CNPJ
- O mapeamento é flexível: busca campos cujo nome contenha palavras-chave (ex: campo que contenha "razao" recebe a razão social)
- Campos preenchidos podem ser editados manualmente depois

**Segurança:**
- Edge function requer autenticação
- CNPJ validado no backend antes da chamada externa
- RLS existente mantida sem alteração

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| `supabase/functions/cnpj-lookup/index.ts` | Nova edge function para consulta ReceitaWS |
| `src/pages/Contratos.tsx` | Adicionar campo CNPJ com botão de consulta e auto-preenchimento |

