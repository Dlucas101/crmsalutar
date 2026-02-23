

# CRM Software House — Plano MVP

## Visão Geral
CRM interno para software house com visual **neon-futurista dark mode**, backend Supabase (Postgres + Auth + Edge Functions), ~6 usuários com permissões por role. Idioma: pt-BR.

---

## Fase 1: Fundação (Auth + Tema + Layout)

### Tema Neon-Futurista
- Aplicar o design system neon (dark mode padrão) com as cores fornecidas: cyan, pink, purple
- Background gradiente escuro, cards com glassmorphism, glow effects
- Tipografia moderna (Inter), chips de status coloridos, inputs com brilho neon no foco

### Layout Principal
- **Sidebar lateral** com logo animado (float), menu de navegação com ícones, indicador de role do usuário
- **Topbar** com busca global, sino de notificações e avatar do usuário logado
- Layout responsivo (sidebar colapsável em mobile)

### Autenticação & Roles
- Login com email + senha via Supabase Auth
- Tabela `profiles` com campo `role` (Admin, Gestor, Suporte, Desenvolvedor, Vendas)
- Row-Level Security (RLS) para que cada usuário veja apenas o que lhe é atribuído
- Admin vê tudo, Gestor tem visão ampliada, demais veem apenas seus itens

---

## Fase 2: Módulo de Leads + Pipeline

### Cadastro de Leads
- Formulário completo: nome, empresa, cargo, WhatsApp, email, interesse (site/sistema/app/suporte/consultoria), origem, notas
- Validação de campos obrigatórios

### Pipeline / Funil (Kanban)
- Colunas: Novo → Primeiro Contato → Diagnóstico/Reunião → Proposta Enviada → Negociação → Fechado (Ganho) → Perdido
- Drag & drop para mover leads entre etapas
- Cards com nome, empresa, interesse e prioridade visual

### Timeline de Atividade
- Histórico cronológico de ações por lead (criação, mudanças de status, comentários)
- Registro automático no activity log

---

## Fase 3: Kanban Pessoal + Tarefas

### Kanban por Usuário
- Cada usuário vê **apenas suas tarefas** atribuídas
- Colunas: A Fazer → Em Progresso → Em Revisão → Concluído
- Drag & drop entre colunas

### Tarefas
- Campos: título, descrição, prioridade (Baixa/Média/Alta/Urgente), status, prazo, projeto/lead vinculado, estimativa de tempo
- Chips coloridos por prioridade (neon gradient)
- Indicador visual de tarefas vencidas (overdue)

---

## Fase 4: Dashboard do Gestor (KPIs)

### Métricas Visuais
- Leads no período e taxa de conversão
- Projetos ativos e clientes ativos
- Tickets abertos vs resolvidos
- Tarefas por usuário (gráfico de barras)

### Alertas
- Tabela de tarefas overdue
- SLAs violados em destaque
- Gráficos com Recharts (já instalado) no estilo neon

---

## Fase 5: Automações com Edge Functions

### Regra A — Novo Lead Criado
- Edge Function acionada por database trigger
- Atribui lead ao vendedor (round-robin)
- Cria tarefa "Primeiro contato" com prazo de 24h
- Cria notificação para o vendedor

### Regra C — Lead Fechado (Ganho)
- Converte lead → cliente (copia dados automaticamente)
- Cria projeto padrão vinculado ao cliente
- Gera tarefas padrão: Levantamento de Requisitos, Planejamento, Desenvolvimento, Testes, Deploy
- Notifica equipe (Dev + Suporte)

### Notificações em Tempo Real
- Tabela `notifications` com Supabase Realtime
- Sino na topbar com contador e dropdown de notificações não lidas

---

## Banco de Dados (Supabase/Postgres)

### Tabelas Principais
- `profiles` (id, role, nome, avatar)
- `leads` (nome, empresa, contato, origem, interesse, status, assigned_user_id)
- `clients` (nome, cnpj_cpf, contatos, convertido de lead)
- `projects` (client_id, nome, status, prioridade, datas)
- `tasks` (project_id, assigned_user_id, título, status, prioridade, prazo, time_estimate)
- `activities` (user_id, action_type, target_type, target_id, dados, timestamp)
- `notifications` (user_id, tipo, mensagem, lida, created_at)

### Segurança
- RLS em todas as tabelas
- Admin: acesso total
- Gestor: leitura ampla + escrita limitada
- Demais: apenas registros atribuídos a eles

---

## Módulos para Fases Futuras (pós-MVP)
- **Gestão de Clientes** completa (perfil, contratos, histórico)
- **Propostas/Negócios** (templates, envio, follow-up automático — Regra B)
- **Projetos completos** (Kanban de projeto, timesheet, milestones)
- **Suporte/Tickets** com SLA automático e escalonamento (Regra D)
- **Integrações** (WhatsApp, Email SMTP, gateway de pagamentos)
- **Light mode** toggle

