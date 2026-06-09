## Objetivo

Separar **configuração de regras** (faixas de premiação, fechamento de apuração) da **visualização de desempenho** do mês, criando um novo menu `/configuracoes` com abas. A página `/metas` passa a ser apenas leitura: mostra o progresso do mês, faixa atingida, ranking de técnicos e histórico.

## Nova estrutura de menu

Adicionar item **"Configurações"** no grupo "Gestão" do `AppSidebar` (visível apenas para admin/gestor), ícone `Settings`.

```
Gestão
├── Metas              ← vira somente visualização
├── Comissões
├── Contratos
├── Membros
├── Relatórios
├── Configurações ⭐    ← novo, admin/gestor
└── Auditoria (admin)
```

## Página `/configuracoes` (nova)

Layout com abas (`Tabs` do shadcn). Estrutura preparada para crescer:

| Aba | Conteúdo agora |
|---|---|
| **Metas & Premiação** | Seletor mês/ano + `MetaTiersEditor` (faixas, status apuração, botão fechar) |
| **Comissão** | (placeholder) Configuração futura de custo da mensalidade, % técnico vs empresa |
| **Automações** | (placeholder) Regras de criação de tarefas por status de lead |
| **Geral** | (placeholder) Preferências do sistema |

Só a aba **Metas & Premiação** vem funcional nesta entrega. As outras ficam com um card "Em breve" para não criar páginas vazias.

Proteção de rota: redireciona para `/` se o usuário não for admin/gestor.

## Página `/metas` (refatorada — somente visualização)

Remove da UI:
- Editor de faixas (`MetaTiersEditor`) → migra para Configurações
- Campos antigos `quantidade_meta`, `valor_contrato`, `meta_bonus_quantidade`, `meta_bonus_valor` (escondidos da tela; colunas permanecem no banco para retrocompatibilidade)
- Botões de criar/editar meta crua

Mantém / adiciona:
- Seletor mês/ano
- Card **"Faixa atual"**: nome da faixa atingida, valor/contrato, total de contratos no mês, badge "Aberta/Fechada"
- Card **"Progresso"**: barra de progresso até a próxima faixa
- **Ranking** dos técnicos: contratos ganhos no mês (já existe parte disso)
- **Histórico** dos últimos meses com faixa final atingida
- Link/atalho "Configurar faixas →" que leva para `/configuracoes?tab=metas-premiacao` (visível apenas para admin/gestor)

## Arquivos afetados

**Criar:**
- `src/pages/Configuracoes.tsx` — página com Tabs
- `src/components/configuracoes/MetasPremiacaoTab.tsx` — wrapper que usa o `MetaTiersEditor` existente + seletor de mês

**Editar:**
- `src/App.tsx` — registrar rota `/configuracoes` com guard admin/gestor
- `src/components/AppSidebar.tsx` — adicionar item "Configurações" para admin/gestor
- `src/pages/Metas.tsx` — remover editor de faixas e campos legados da UI; deixar apenas visualização + link para Configurações

**Sem mudanças de banco.** Nenhuma migration: os campos antigos continuam existindo, só somem da interface. `meta_tiers`, `meta_apuracao`, `premiacoes`, `premiacao_parcelas` permanecem como estão.

**Memória:** atualizar `mem://funcionalidades/metas` explicando que metas são visualização e que configuração de faixas vive em `/configuracoes`.

## Pontos técnicos

- Guard de rota em `Configuracoes.tsx`: usa `useAuth()`; se `role !== 'admin' && role !== 'gestor'`, `<Navigate to="/" />`.
- Tabs com estado controlado por query param (`?tab=metas-premiacao`) para permitir deep-link a partir do `/metas`.
- Manter o `MetaTiersEditor` atual sem alterações de assinatura — só muda quem o renderiza.
