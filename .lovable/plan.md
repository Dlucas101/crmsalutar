

## Plano: Módulo de Comissões por Mensalidade

### O que já funciona (validado)

O módulo Clientes está operacional: registro de mensalidades individuais com valor/data, lucro por mensalidade, seleção com totalização, botão manual de histórico. Nenhuma correção necessária.

### O que será construído (novo)

Uma nova página **Comissões** acessível pelo menu lateral, com cálculo automático de comissões por técnico/membro baseado nas mensalidades pagas.

---

### 1. Nova página: `src/pages/Comissoes.tsx`

**Filtros no topo:**
- Seletor de mês/ano (padrão: mês atual)
- Seletor de técnico/membro (padrão: todos)

**Resumo por técnico (cards):**
Para cada técnico que tem comissão no mês filtrado:
- Nome do técnico
- Qtd de contratos com mensalidade no período
- Qtd de mensalidades pagas consideradas
- Valor bruto recebido (soma dos valores pagos)
- Total de custos
- Valor líquido da comissão

**Tabela detalhada por contrato:**
Ao clicar em um técnico ou quando filtrado por um específico:
- Cliente (nome)
- Nº da mensalidade (1ª, 2ª ou 3ª)
- Data do pagamento
- Valor pago
- Custo do sistema
- Comissão final (valor pago - custo)

### 2. Lógica de cálculo

```text
Para cada técnico no mês selecionado:
  1. Buscar todos os clients onde responsavel_id = técnico
     (fallback: lead.responsible_id se client.responsavel_id = null)
  2. Para cada client, buscar mensalidades onde:
     - numero_mensalidade <= 3
     - EXTRACT(MONTH FROM data_pagamento) = mês filtrado
     - EXTRACT(YEAR FROM data_pagamento) = ano filtrado
  3. Comissão de cada mensalidade = valor - custo_do_sistema
     (se custo = 0 ou null, comissão = valor)
  4. Totalizar por técnico
```

### 3. Consulta de dados

Toda a lógica será client-side usando dados já disponíveis:
- `clients` (com responsavel_id e valor_custo)
- `mensalidades` (com data_pagamento, valor, numero_mensalidade, client_id)
- `profiles` (nomes dos membros)
- `leads` (fallback de responsible_id)

Filtragem por mês usando `data_pagamento` das mensalidades.

### 4. Navegação

Adicionar item "Comissões" no `AppSidebar.tsx` com ícone `DollarSign`, e rota `/comissoes` no `App.tsx`.

### 5. Histórico

O comportamento de histórico permanece inalterado — continua manual via botão no card do cliente.

---

### Arquivos

| Arquivo | Ação |
|---|---|
| `src/pages/Comissoes.tsx` | Criar — página completa com filtros, resumo e tabela |
| `src/components/AppSidebar.tsx` | Editar — adicionar link "Comissões" |
| `src/App.tsx` | Editar — adicionar rota `/comissoes` |

Nenhuma alteração no banco de dados necessária — os dados já existem nas tabelas `mensalidades` e `clients`.

