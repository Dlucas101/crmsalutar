# Plano: Nova regra de Metas e Premiação

## Objetivo

Trocar a lógica atual (bônus = quantidade de leads ganhos × valor fixo da meta, pago "de uma vez") por uma premiação **por contrato**, com **faixas configuráveis por mês** e **liberação parcelada em 3 vezes** atrelada ao pagamento das 3 primeiras mensalidades. A comissão atual `(valor da mensalidade − custo) / 2` continua existindo em paralelo (somando).

## Modelo de dados (novas tabelas)

### `meta_tiers` — faixas configuráveis por mês
- `meta_id` (FK → `metas`)
- `ordem` (1, 2, 3…) — ordem da menor para a maior
- `nome` (ex.: "Base", "Meta", "Super Meta")
- `quantidade_minima` (int) — nº de contratos do mês para atingir essa faixa
- `valor_por_contrato` (numeric)
- Único por (`meta_id`, `ordem`)

Faixa "Base" = `quantidade_minima = 0`. Admin pode criar quantas faixas quiser.

### `meta_apuracao` — fechamento do mês (snapshot)
- `mes`, `ano` (único)
- `fechada_em` (timestamp; null = aberta)
- `faixa_atingida_id` (FK → `meta_tiers`)
- `valor_por_contrato_congelado` (numeric)
- `total_contratos` (int)

Enquanto `fechada_em IS NULL`, a faixa é recalculada em tempo real. Um job/edge function diária fecha automaticamente o mês anterior no dia 1 de cada mês (cron via `pg_cron` ou edge function agendada).

### `premiacoes` — premiação por contrato
- `client_id` (FK, único) — 1 premiação por contrato
- `responsavel_id` (FK → profiles) — pode mudar em transferência
- `mes_referencia`, `ano_referencia` — mês de fechamento do contrato (`won_at`)
- `valor_total` (numeric) — vem da faixa congelada × 1 contrato
- `status` ('ativa' | 'cancelada')

### `premiacao_parcelas` — 3 parcelas por premiação
- `premiacao_id` (FK)
- `numero` (1, 2, 3)
- `valor` (numeric) — `valor_total / 3` por padrão, editável manualmente
- `mensalidade_id` (FK → mensalidades, nullable) — vínculo com a mensalidade que liberou
- `status` ('pendente' | 'liberada' | 'cancelada')
- `liberada_em` (timestamp, nullable)
- `responsavel_id` (FK → profiles) — herda do contrato no momento da liberação
- `ajustada_manualmente` (boolean)

## Triggers e automações

1. **Criação da premiação**: trigger em `clients` (após insert via `handle_lead_ganho` ou manual). Busca a faixa congelada do mês de `won_at` do lead; se o mês ainda está aberto, usa a faixa **provisoriamente** atingida e recalcula em cada mudança até o mês fechar.
2. **Liberação de parcela**: trigger em `mensalidades` (after insert). Se `numero_mensalidade ∈ {1,2,3}`, marca a parcela correspondente como `liberada`, grava `mensalidade_id`, `liberada_em` e `responsavel_id` atual do contrato.
3. **Cancelamento de contrato**: quando `clients.historico = true` (campo já existe) ou novo status de cancelamento → marca premiação como `cancelada` e cancela parcelas ainda `pendente`. Parcelas já `liberada` permanecem.
4. **Transferência**: ao alterar `clients.responsavel_id`, parcelas `pendente` recebem o novo responsável; parcelas `liberada` ficam com quem recebeu.
5. **Fechamento mensal** (edge function agendada, executa dia 1): para cada mês não-fechado anterior, calcula faixa atingida, grava `meta_apuracao` e atualiza `valor_total` de todas as premiações daquele mês para `faixa.valor_por_contrato`. Após fechado, valor não muda mais.

## UI

### Página Metas (`src/pages/Metas.tsx`)
- Editor de faixas: lista de linhas (ordem, nome, qtd mínima, valor por contrato) com adicionar/remover.
- Indicador da faixa atual atingida no mês.
- Botão "Fechar apuração agora" (admin) e badge "Apuração fechada em DD/MM".
- Histórico mostra faixa final atingida por mês.

### Página Comissões (`src/pages/Comissoes.tsx`)
- Mantém o bloco atual de comissão `(valor − custo)`.
- Novo bloco **"Premiação por contrato"** por técnico:
  - Lista contratos do mês com: valor total da premiação, status das 3 parcelas, valores, mensalidade vinculada.
  - Editor inline do valor de cada parcela (admin) — marca `ajustada_manualmente`.
  - Totais separados: "Comissão", "Premiação liberada no mês", "Premiação pendente", "Total a receber no mês".
- Filtro por status (liberada/pendente/cancelada).

## Migração de dados existentes

Script único na migration:
1. Para cada `meta` antiga, criar `meta_tiers`: "Meta" (`quantidade_meta`, `valor_contrato`) e, se houver, "Super Meta" (`meta_bonus_quantidade`, `meta_bonus_valor`).
2. Para cada `client` com `lead.status = fechado_ganho`, criar `premiacao` + 3 `premiacao_parcelas` baseadas no `won_at` e na faixa do mês correspondente.
3. Para cada `mensalidade` 1-3 já paga, marcar a parcela correspondente como `liberada`.
4. Marcar como `fechada` todas as `meta_apuracao` de meses anteriores ao atual.

Campos antigos (`metas.quantidade_meta`, `valor_contrato`, `meta_bonus_*`) ficam por compatibilidade e poderão ser removidos depois.

## RLS (resumo)

- `meta_tiers`, `meta_apuracao`: leitura para `authenticated`, escrita só para `is_admin_or_gestor`.
- `premiacoes`, `premiacao_parcelas`: admin/gestor vê tudo; técnico vê apenas onde `responsavel_id = auth.uid()`. Edição só admin/gestor.
- GRANTs explícitos para `authenticated` e `service_role` em todas as tabelas novas.

## Entregáveis

1. Migration: novas tabelas + triggers + funções + GRANTs + RLS + migração de dados.
2. Edge function `close-monthly-apuracao` agendada (cron diário).
3. `src/pages/Metas.tsx`: editor de faixas + fechamento.
4. `src/pages/Comissoes.tsx`: novo bloco de premiação por contrato com edição de parcelas.
5. Atualização de `mem://funcionalidades/metas` e `mem://funcionalidades/comissoes`.

## Pontos em aberto (decidir durante a build se não responder agora)

- **Cancelamento de contrato**: hoje só existe `clients.historico`. Posso usar esse flag como gatilho de cancelamento ou prefere um campo novo `status_contrato` ('ativo'|'cancelado')?
- **Edge function agendada**: ok usar `pg_cron` da Lovable Cloud rodando uma SQL function diária às 00:05? (mais simples que edge function externa).
