
## Problema atual

Hoje os temas só trocam variáveis HSL no `:root`. As classes utilitárias (`.neon-glow`, `.neon-border`, `.glass-panel`, `.gradient-accent`) e várias páginas usam o **mesmo** layout neon como base, então apenas o Sunset (que tem overrides agressivos) muda de verdade. Componentes ainda têm valores fixos como `bg-card/60 backdrop-blur`, `bg-gradient-to-r from-yellow-400`, `neon-glow` direto no JSX, etc.

## Estratégia

Tratar cada tema como uma **skin completa**, não uma variação de cores. Para isso vou:

1. **Centralizar tudo em tokens por tema** (incluindo coisas que hoje são fixas: raio, sombras, blur, gradientes, fontes, peso de borda).
2. **Reescrever as utilitárias** (`.neon-glow`, `.neon-border`, `.glass-panel`, `.gradient-accent`, `.chip-*`) para apenas **consumir tokens** — sem `if [data-theme=...]` espalhado.
3. **Limpar valores fixos no JSX** das páginas/sidebars/topbar e trocar por classes/utilitárias que respondem ao tema.
4. Redesenhar 5 identidades distintas.

## Identidades visuais (o "DNA" de cada tema)

### 1. Neon Dark (atual, refinado)
- Atmosfera: cyberpunk / produto SaaS futurista.
- Fundo: gradiente escuro azul-violeta + leve grain.
- Superfícies: glass com blur 12px, borda ciano translúcida.
- Tipografia: Inter, tracking levemente positivo em títulos.
- Botões/headings: glow ciano + acento magenta.
- Raio: 0.75rem. Sombra: glow neon.

### 2. Light (Clean Professional) — **sem nenhum vestígio neon**
- Atmosfera: Notion / Linear claro.
- Fundo: branco off-white sólido (sem gradientes radiais, sem blur).
- Superfícies: branco puro, borda 1px cinza, sombra sutil em camadas.
- Tipografia: Inter, peso 500 em títulos, sem letter-spacing.
- Botões: sólidos, hover com darken simples.
- Sidebar: cinza claríssimo, ícones outline.
- Raio: 0.5rem. Sombra: `0 1px 2px / 0 1px 3px`.
- **Remover** glow, gradientes coloridos, glass, neon-border (vira borda sólida).

### 3. Liquid Glass (Apple-inspired)
- Atmosfera: iOS / visionOS.
- Fundo: gradientes radiais pastéis (azul, lilás, ciano) com `background-attachment: fixed`.
- Superfícies: vidro fosco intenso (`backdrop-filter: blur(24px) saturate(180%)`), borda branca translúcida, highlight interno.
- Tipografia: SF Pro / -apple-system, tracking -0.015em, peso 600 em títulos.
- Botões: gradiente azul→roxo, raio 14px, sombra colorida suave.
- Inputs/cards arredondados generosos (1.1rem).
- Sidebar também translúcida sobre o fundo pastel.

### 4. Midnight Glass
- Atmosfera: Linear dark + Apple.
- Fundo: quase preto azulado com gradientes radiais discretos.
- Superfícies: vidro escuro (blur 18px), borda branca 8% opacidade, highlight interno sutil.
- Tipografia: SF Pro, peso 600, tracking levemente negativo.
- Acento: azul elétrico + violeta.
- Sem glow forte; usa profundidade por sombra escura + highlight.

### 5. Sunset (manter como referência)
- Já está bem; só vou garantir consistência (sidebar, topbar, inputs, chips usando os mesmos gradientes warm).

## Arquitetura técnica

### Novos tokens (por tema, em `index.css`)

Além dos tokens HSL atuais, adicionar:

```
--radius
--font-sans
--tracking-tight
--shadow-card
--shadow-elev
--shadow-glow              /* só neon/midnight usam — outros = none */
--surface-blur             /* px ou 0 */
--surface-bg               /* cor/gradiente do card */
--surface-border           /* cor da borda do card */
--surface-highlight        /* inset highlight ou none */
--gradient-primary         /* gradiente do botão primário */
--gradient-accent-text     /* gradiente para títulos destacados */
--bg-page                  /* gradiente/fundo do body */
--input-bg
--input-border
```

Cada tema define **todos** esses tokens. Light define `--surface-blur: 0`, `--shadow-glow: none`, `--gradient-accent-text: none` → automaticamente sem neon.

### Reescrever utilitárias para consumir tokens

```css
.glass-panel {
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  box-shadow: var(--shadow-card);
  backdrop-filter: blur(var(--surface-blur));
  border-radius: var(--radius);
}
.neon-border { border: 1px solid var(--surface-border); box-shadow: var(--shadow-glow); }
.neon-glow   { background: var(--gradient-accent-text); -webkit-background-clip: text; color: transparent; }
                /* fallback p/ temas sem gradiente: color: hsl(var(--foreground)) */
.gradient-accent { background: var(--gradient-primary); color: var(--primary-foreground); }
```

Resultado: zero `[data-theme=…]` espalhado nas utilitárias — comportamento muda automaticamente.

### Body + tipografia globais
`body { font-family: var(--font-sans); letter-spacing: var(--tracking-tight); background: var(--bg-page); }`

### Inputs/Buttons base (em `index.css`)
Forçar `input, textarea, [role=combobox] { background: var(--input-bg); border-color: var(--input-border); border-radius: var(--radius); }` para todos os temas, eliminando overrides por tema.

### Limpeza no JSX
- `src/components/Topbar.tsx`: trocar `bg-card/50 backdrop-blur-sm` por classe `topbar` consumindo tokens.
- `src/components/AppSidebar.tsx`: remover `neon-glow` no logo em temas claros (a utilitária já cuida), trocar `gradient-accent` se necessário (já consome token).
- `src/pages/Dashboard.tsx`:
  - `bg-card/60 backdrop-blur` → `glass-panel` (já consome token).
  - `bg-gradient-to-r from-yellow-400/70 via-orange-400/70 to-red-400/70` → usar tokens semânticos (`--warning-gradient`) por tema.
  - `neon-glow` em `<h1>` continua, mas agora a utilitária se adapta (gradient text no Sunset/Glass, cor sólida no Light, glow no Neon).
- Auditar `rg "from-|to-|backdrop|bg-card/"` em `src/pages` e `src/components` e converter para utilitárias/tokens.

### Sidebar com identidade própria por tema
Já temos `--sidebar-*`. Vou adicionar `--sidebar-bg` (pode ser gradiente) e aplicar no componente Sidebar via classe `app-sidebar { background: var(--sidebar-bg); }`.

## Entregáveis

1. `src/index.css` reescrito:
   - Bloco de tokens estendidos por tema (5 temas).
   - Utilitárias reescritas consumindo tokens (sem `[data-theme]` interno).
   - Estilos base de `input/button/sidebar/topbar` via tokens.
2. `src/components/Topbar.tsx`: substituir classes fixas por utilitária `topbar-surface`.
3. `src/components/AppSidebar.tsx`: substituir hardcodes por classe `app-sidebar-surface`.
4. `src/pages/Dashboard.tsx`: remover `bg-card/60 backdrop-blur`, gradientes hardcoded, e padronizar com utilitárias.
5. Varredura nas demais páginas (`Leads`, `Clientes`, `Tarefas`, `Visitas`, `Metas`, `Comissoes`, `Relatorios`, `Auditoria`, `Membros`, `Contratos`) substituindo `from-*/to-*/backdrop-*/bg-card\/\d+` por utilitárias temáticas. Sem mudar lógica.
6. QA visual: trocar entre os 5 temas e validar Dashboard, Sidebar, Topbar, um formulário (Leads) e uma tabela (Tarefas).

## Sugestões / pontos a confirmar

1. **Quantidade de temas**: 5 já é bastante. Sugiro **consolidar** removendo `Liquid Glass` **ou** `Midnight Glass` (são primos próximos — um claro e um escuro do mesmo conceito glass). Mantenho ambos se preferir.
2. **Tipografia premium**: para Liquid/Midnight Glass posso carregar **Inter Display** via Google Fonts (peso variável) — fica mais perto do SF Pro em quem não está em macOS. Confirma se posso adicionar a fonte.
3. **Acessibilidade**: o tema Sunset atual tem contraste apertado em texto secundário. Vou subir `--muted-foreground` para passar WCAG AA. OK?
4. **Persistência por usuário**: hoje o tema fica em `localStorage`. Posso salvar no perfil (Supabase) para sincronizar entre dispositivos. Quer incluir agora?
5. **Modo "auto"**: adicionar opção que segue `prefers-color-scheme` (Light de dia / Neon Dark à noite)?

Posso seguir já com a refatoração assumindo: manter os 5 temas, adicionar Inter Display, corrigir contraste do Sunset, **sem** persistência em DB e **sem** modo auto — se você não responder essas perguntas. Caso queira diferente, me avise antes de eu começar.
