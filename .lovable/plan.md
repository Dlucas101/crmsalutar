## Diagnóstico geral do sistema

Antes do plano de execução, o resumo honesto da minha análise como Dev Sênior:

### Pontos fortes
- **Arquitetura sólida**: roles bem separados (`user_roles` + `has_role` SECURITY DEFINER), edge functions enxutas, Lovable Cloud bem aproveitado.
- **Identidade visual forte**: o tema neon-futurista com `glass-panel`/`neon-border` e suporte a light/dark é coeso.
- **Domínio bem modelado**: o ciclo Lead → Cliente → Mensalidades → Comissões → Metas faz sentido e está bem amarrado.
- **Funcionalidades avançadas já entregues**: contratos DOCX→PDF via Browserless, calendário de visitas com feriados BR, super meta com bônus, divisão de contratos 50/50.

### Pontos fracos (sem rodeio)
1. **Inconsistência de data fetching**: só `Comissoes.tsx` usa react-query. As outras 9 páginas fazem `useState + useEffect + fetchX()` manual → re-fetches, sem cache, sem invalidação automática. Dashboard refaz 11 queries a cada 30s.
2. **`Contratos.tsx` está obeso**: 1.205 linhas em um único arquivo, mistura listagem, upload, geração, histórico e diálogos. Difícil manter.
3. **37 ocorrências de `as any`** espalhadas pelo código — denuncia campos que existem no banco mas não estão refletidos no `types.ts` em uso (na verdade estão, mas o código foi escrito sem eles inicialmente).
4. **Topbar quebrada**: input de busca não tem handler, sino de notificações conta mas não abre dropdown.
5. **Bug de meta/comissão**: filtra `fechado_ganho` por `updated_at` — se você editar qualquer coisa de um lead antigo, ele "renasce" no mês atual. Precisa de uma coluna `won_at` selada por trigger.
6. **Criar membro vai quebrar**: o fluxo de Membros usa `supabase.auth.signUp()`, mas signups foram desabilitados na última etapa. Hoje só admin via service_role consegue criar.
7. **`src/pages/Projetos.tsx`** ainda existe (74 linhas) sem rota — código morto. Você pediu para não mexer agora; fica anotado.
8. **RLS de SELECT permissivo**: leads/clientes/tarefas/comissões hoje são `USING (true)` — qualquer membro vê tudo. Você não priorizou agora; fica registrado como dívida.
9. **Mobile**: vários `grid-cols-2` ficam apertados < 360px; sidebar não tem agrupamento de seções.

---

## Escopo aprovado para esta etapa

### 1. Bugs funcionais (4 itens)

**1.1 — `won_at` para corrigir Dashboard, Metas e Comissões**
- Migration: adicionar `leads.won_at TIMESTAMPTZ` (nullable).
- Trigger `set_won_at`: quando `status` muda **para** `fechado_ganho`, grava `won_at = now()`. Quando muda **para fora**, zera `won_at = NULL` (evita inflar histórico se voltar atrás).
- Backfill: `UPDATE leads SET won_at = updated_at WHERE status = 'fechado_ganho'` (uma vez, sem fragilizar dados existentes).
- Trocar em **`Dashboard.tsx`**, **`Metas.tsx`** (`fetchData` + `fetchHistory`) e **`Comissoes.tsx`** (`leadsGanhoByTecnico`) os filtros `updated_at` por `won_at`.

**1.2 — Topbar: busca global**
- Implementar busca em **leads + clientes + tarefas (título)** com debounce de 250 ms.
- Resultado em `Popover` ancorado no input, agrupado por tipo, máximo 5 por grupo, click navega para a página correspondente.
- Sem nova rota, sem nova tabela.

**1.3 — Topbar: dropdown de notificações**
- `Popover` no sino com lista das últimas 10 notificações.
- Ações: marcar individual como lida, "marcar todas como lidas", clicar em uma com `link` navega.
- Já existe realtime no count — reusar para a lista.

**1.4 — Membros: criar/editar via edge function**
- Estender `admin-update-user/index.ts` com `action: "create_user"` (ou criar `admin-create-user` se preferir separado) usando `supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nome } })`.
- Substituir o `signUp` em `Membros.tsx > createMember` pela invocação dessa edge function.
- Mantém compatibilidade com `disable_signup: true` no auth.

### 2. Refatoração de código (sem mudar comportamento visível)

**2.1 — Quebrar `Contratos.tsx` (1.205 → ~250 linhas no shell)**
Estrutura nova em `src/components/contratos/`:
- `TemplatesTab.tsx` — listagem + upload + delete de templates.
- `GerarContratoTab.tsx` — seleção de template, formulário dinâmico (com lookup CNPJ), checkbox de seções condicionais, botão "Gerar PDF".
- `HistoricoTab.tsx` — lista de `generated_contracts` com download/abrir PDF (usando `sign-url` action).
- `useContratos.ts` (hook) — encapsula queries/mutations de templates e contratos gerados.
- `Contratos.tsx` vira só o shell com `Tabs` + título.

Sem mexer em `process-contract/index.ts` nesta etapa (já está estável).

**2.2 — Padronizar data fetching com react-query**
Migrar Dashboard, Leads, Clientes, Metas, Tarefas, Visitas, Membros, Relatórios para `useQuery` com keys consistentes (`["leads"]`, `["clients"]`, `["metas", mes, ano]`, etc).
- Benefícios imediatos: cache automático, invalidação após mutation (`queryClient.invalidateQueries`), loading states padronizados, menos re-renders.
- Dashboard: trocar `setInterval(30s)` por `refetchInterval: 30_000` nas queries → mata o efeito custoso de re-render manual.

**2.3 — Limpeza de `as any`**
Após o react-query, criar tipos derivados de `Tables<"leads">`, `Tables<"clients">` etc. e eliminar pelo menos 80% dos `as any` (campos como `endereco`, `equipamento`, `responsible_id` já existem no `types.ts` gerado).

### 3. UX / Visual

**3.1 — Sidebar com agrupamento**
Agrupar `navItems` em duas seções:
- **Operação**: Dashboard, Leads, Clientes, Tarefas, Visitas
- **Gestão**: Metas, Comissões, Contratos, Membros, Relatórios

Usa o `SidebarGroupLabel` que já está importado mas só mostra "Menu" hoje.

**3.2 — Mobile**
- Topbar: esconder o input de busca em `< sm` e expor um ícone de lupa que abre `Sheet` com a busca.
- `Dashboard` e `Leads`: garantir `grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4` (hoje pula direto de 1 para 2 em sm).
- `Tarefas`: melhorar `TaskCard` em telas estreitas (botão "Feito" não corta mais o título).

**3.3 — Microajustes visuais**
- Padronizar `Card` com altura mínima por linha em grids para não "pular" quando há descrição vazia.
- Adicionar feedback de loading (Skeletons) onde hoje aparece tela em branco durante o primeiro fetch.
- Topbar: badge da contagem de notificações com animação `pulse` quando > 0 e for nova.

### 4. Performance

- **Dashboard**: além do `refetchInterval`, consolidar as 11 queries em 1 RPC `dashboard_stats(_user_id)` — função SQL retornando JSON com todos os contadores. Reduz round-trips de 11 → 1.
- **Comissões**: já usa react-query, mas sem `staleTime` → adicionar `staleTime: 60_000` para evitar refetch a cada toggle de filtro.
- **Leads/Clientes**: paginação com cursor (20 por página) — hoje carrega tudo. Com 25 leads não dói, mas escalando vai.
- **Realtime opt-in**: ativar `postgres_changes` em `tasks` e `leads` para refletir alterações de outros usuários sem F5 (Topbar já faz isso para `notifications`).

---

## Arquivos afetados

| Camada | Arquivos |
|---|---|
| **Migrations** | 1 nova: `add_won_at_to_leads.sql` (coluna + trigger + backfill) + 1 opcional: `dashboard_stats_rpc.sql` |
| **Edge functions** | `admin-update-user/index.ts` (novo action `create_user`) |
| **Páginas refatoradas** | `Dashboard.tsx`, `Leads.tsx`, `Clientes.tsx`, `Metas.tsx`, `Tarefas.tsx`, `Visitas.tsx`, `Membros.tsx`, `Relatorios.tsx`, `Contratos.tsx` (shell) |
| **Componentes novos** | `src/components/contratos/{TemplatesTab,GerarContratoTab,HistoricoTab}.tsx`, `src/hooks/useContratos.ts`, `src/components/topbar/{GlobalSearch,NotificationsDropdown}.tsx` |
| **Componentes editados** | `Topbar.tsx`, `AppSidebar.tsx` |

## Não será alterado
- `process-contract/index.ts` (geração PDF está OK)
- `cnpj-lookup/index.ts`
- Sistema de roles e RLS (fica para a próxima etapa)
- `src/pages/Projetos.tsx` (você pediu para não mexer)
- Telas de Login / ResetPassword (acabaram de ser ajustadas)
- Visual geral (neon, glass, gradientes — preserva 100%)

---

## Sugestões para uma próxima etapa (não incluídas agora)

Para você ter visibilidade do que ficou no backlog do meu radar:

1. **Hardening de RLS de SELECT** em leads/clientes/tarefas/comissões — vendedor só vê os próprios; admin/gestor vê tudo. Hoje qualquer pessoa logada vê tudo.
2. **Remover/consolidar `Projetos`** (página + tabela) ou reativar com propósito claro.
3. **Auditoria** — popular a tabela `activities` (já existe) com triggers em insert/update/delete dos principais recursos, e criar uma página de timeline.
4. **Notificações automáticas** — toda vez que um lead muda de status ou tarefa é atribuída, gerar `notification` para o responsável.
5. **Exportar contratos gerados em massa** (zip) e relatório de comissões em PDF assinável.
6. **Onboarding de novo membro** — fluxo guiado em vez de só criar conta no painel.
7. **Multi-empresa / white-label** se houver intenção de revender o CRM.

---

### Resumo da execução

Quando aprovar, eu executo nesta ordem para garantir estabilidade incremental:

1. **Migration `won_at`** + ajuste em Dashboard/Metas/Comissões (corrige o bug que você já viu).
2. **Edge function de criar membro** + ajuste em `Membros.tsx`.
3. **Topbar**: busca global e dropdown de notificações.
4. **Refatoração de Contratos** em componentes.
5. **Padronização react-query** página por página (Dashboard primeiro, depois as demais).
6. **UX**: agrupamento da sidebar + ajustes mobile + skeletons.
7. **Perf**: RPC `dashboard_stats` + realtime em tasks/leads.

Cada passo é commitável de forma independente. Aprovar?