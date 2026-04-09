

## Auditoria de Segurança e Plano de Correção

### Problemas Encontrados

**3 problemas CRITICOS:**

1. **Tabela `visits` acessível sem login** — As políticas RLS estão configuradas para `public` em vez de `authenticated`. Qualquer pessoa na internet pode ler, criar, editar e apagar visitas.

2. **Qualquer membro pode se tornar admin** — A política `user_roles_all` permite que qualquer usuário autenticado insira/atualize/delete roles. Um membro comum pode se dar permissão de admin.

3. **Notificações de outros usuários visíveis** — Qualquer usuário pode ler e marcar como lida as notificações de outros.

**Problemas de nível WARN (26 ocorrências):**

4. **Políticas RLS "sempre true"** — Quase todas as tabelas (leads, clients, tasks, mensalidades, profiles, projects, activities, custom_roles) têm INSERT/UPDATE/DELETE com `USING (true)` ou `WITH CHECK (true)`. Isso significa que qualquer usuário logado pode modificar qualquer registro, sem verificação de propriedade ou role.

5. **Proteção contra senhas vazadas desabilitada** — O sistema não verifica se a senha do usuário já apareceu em vazamentos conhecidos.

6. **Dados sensíveis de clientes e leads** — Email, WhatsApp, CPF/CNPJ e valores financeiros acessíveis a todos os membros sem restrição.

---

### Plano de Correção

**Fase 1 — Correções criticas (migração SQL)**

Uma única migração que:

- **visits**: Troca todas as políticas de `public` para `authenticated`
- **user_roles**: Remove a política `user_roles_all` e cria políticas restritas:
  - SELECT: qualquer autenticado pode ver
  - INSERT/UPDATE/DELETE: apenas admin/gestor via `is_admin_or_gestor(auth.uid())`
- **notifications**: Restringe SELECT e UPDATE para `auth.uid() = user_id`; INSERT mantém para autenticados
- **profiles**: Restringe UPDATE para `auth.uid() = id` (cada um edita só o próprio) OU admin via `is_admin_or_gestor`

**Fase 2 — Restrições por role nas tabelas de dados**

Dado que este é um CRM interno onde a equipe precisa colaborar, a abordagem recomendada é:

- **leads, clients, tasks, mensalidades, projects**: Manter SELECT aberto para autenticados. Restringir INSERT/UPDATE/DELETE para admin/gestor OU para o responsável do registro (`responsible_id = auth.uid()`, `assigned_user_id = auth.uid()`, etc.)
- **custom_roles**: INSERT/UPDATE/DELETE apenas para admin/gestor
- **metas**: Já está correto (admin/gestor para escrita)

**Fase 3 — Proteção de senha**

- Ativar a proteção HIBP (Have I Been Pwned) via configuração de autenticação

---

### Decisão necessaria

Considerando que este é um CRM usado por uma equipe pequena e confiável, as correções da **Fase 2** (restringir quem pode editar leads, clientes, etc.) podem impactar o fluxo de trabalho se membros de vendas precisarem editar seus próprios leads. A sugestão é:

- Membros podem editar registros atribuídos a eles (`responsible_id` / `assigned_user_id`)
- Admin/Gestor podem editar qualquer registro
- Apenas Admin/Gestor podem deletar

### Arquivos afetados

| Arquivo | Acao |
|---|---|
| `supabase/migrations/` | Nova migração com todas as correções de RLS |
| Nenhum arquivo frontend | As correções são apenas no banco de dados |

### Sugestoes de melhorias funcionais

- **Log de auditoria**: registrar quem alterou o que e quando (tabela `audit_log`)
- **Backup automático de dados**: exportação periódica dos dados do CRM
- **Validação de entrada**: adicionar validação com `zod` nos formulários de lead e cliente para prevenir dados malformados

