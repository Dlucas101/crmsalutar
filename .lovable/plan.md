

## Plano de Ajustes na Tela de Clientes

### Resumo das Mudanças

Quatro ajustes principais: (1) mostrar lucro por mensalidade no card, (2) adicionar seleção de clientes com totalização dinâmica no resumo financeiro, (3) mudar regra de histórico para botão manual na 3a mensalidade, (4) remover campo "Mensalidades pagas" do diálogo de edição.

---

### 1. Lucro por mensalidade no ClienteCard

No `ClienteCard`, para cada mensalidade paga, exibir o lucro individual: `valor da mensalidade - custo do sistema`. Isso requer buscar as mensalidades do cliente. Duas opções: buscar no componente pai e passar como prop, ou exibir apenas o total. A abordagem mais limpa é carregar as mensalidades na página `Clientes.tsx` e passar para o card.

- **Clientes.tsx**: Fetch da tabela `mensalidades` para todos os clientes e armazenar em um Map `clientId → Mensalidade[]`
- **ClienteCard**: Receber `mensalidades` como prop e exibir, ao lado de cada badge (1ª, 2ª, 3ª), o valor pago e o lucro (`valor_mens - custo_sistema`)

### 2. Seleção de clientes + totalização dinâmica no FinancialSummary

- **Clientes.tsx**: Adicionar state `selectedClientIds: Set<string>` com checkboxes nos cards de clientes ativos
- **ClienteCard**: Adicionar checkbox de seleção
- **FinancialSummary**: Receber prop `selectedClients` (subset dos ativos selecionados) e exibir totalizadores específicos dos selecionados:
  - Total pago (soma dos valores das mensalidades dos selecionados)
  - Total custos (soma dos custos dos selecionados)
  - Lucro dos selecionados
- Quando nenhum cliente selecionado, mostrar o resumo geral como hoje

### 3. Histórico manual com botão

- **Mudança de lógica**: Clientes com 3 mensalidades pagas **não** vão automaticamente para o histórico
- **Database**: Adicionar coluna `historico boolean DEFAULT false` na tabela `clients`
- **ClienteCard**: Quando `mensalidades_pagas >= 3` e `historico = false`, exibir botão "Passar para histórico"
- **Clientes.tsx**: 
  - Ativos = `historico = false`
  - Histórico = `historico = true`
  - Handler para o botão que faz `UPDATE clients SET historico = true`

### 4. Remover "Mensalidades pagas" do ClienteEditDialog

- **ClienteEditDialog**: Remover o campo `mensalidades_pagas` do formulário (já é controlado pelo diálogo de mensalidades)
- Remover do `editValues` state e do `handleSave`

---

### Mudança no Banco de Dados

Uma migration para adicionar a coluna `historico`:

```sql
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS historico boolean DEFAULT false;
```

### Arquivos Modificados

| Arquivo | Mudança |
|---|---|
| `src/pages/Clientes.tsx` | Fetch mensalidades, state de seleção, lógica ativos/histórico por coluna `historico`, remover `mensalidades_pagas` do edit |
| `src/components/clientes/ClienteCard.tsx` | Checkbox seleção, lucro por mensalidade, botão "Passar para histórico" |
| `src/components/clientes/ClienteEditDialog.tsx` | Remover campo "Mensalidades pagas" |
| `src/components/clientes/FinancialSummary.tsx` | Aceitar clientes selecionados e mostrar totalização dinâmica |
| Migration SQL | Adicionar coluna `historico` |

