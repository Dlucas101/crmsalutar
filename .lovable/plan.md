

## Plano: Checkbox "Participa da Comissão" + Relatório Mensal PDF/Excel + Histórico de Metas + Correção tema claro

### 1. Checkbox "Participa da Comissão" na tabela profiles

**Banco de dados:**
- Migração: `ALTER TABLE profiles ADD COLUMN participa_comissao boolean DEFAULT true`

**Membros (`src/pages/Membros.tsx`):**
- Adicionar Switch "Participa da comissão" no card de cada membro (visível só para admin)
- Ao alterar, faz update na tabela profiles

**Metas (`src/pages/Metas.tsx`):**
- Substituir filtragem por `user_roles` (admin/gestor) por `WHERE participa_comissao = true`
- Buscar profiles com `participa_comissao` e filtrar membros e leads com base nisso

**Comissões (`src/pages/Comissoes.tsx`):**
- Mesma substituição: filtrar por `participa_comissao = true` em vez de verificar roles
- Bônus de meta/super meta apenas para participantes

**Dashboard (`src/pages/Dashboard.tsx`):**
- Atualizar filtro de metas para usar `participa_comissao`

### 2. Relatório Mensal Exportável (PDF + Excel)

**Relatórios (`src/pages/Relatorios.tsx`):**
- Adicionar novo tipo de relatório: "Fechamento Mensal"
- Seletor de mês/ano
- Busca comissões, metas e desempenho por membro participante
- Exportação Excel: planilha com colunas (Membro, Contratos, Comissão, Bônus Meta, Bônus Super Meta, Total)
- Exportação PDF: usar `jspdf` + `jspdf-autotable` para gerar PDF formatado com tabela e resumo
- Instalar dependência: `jspdf` e `jspdf-autotable`

### 3. Histórico de Metas (gráfico mês a mês)

**Metas (`src/pages/Metas.tsx`):**
- Adicionar seção "Histórico" abaixo dos cards existentes
- Buscar metas dos últimos 6-12 meses
- Para cada mês, buscar leads ganhos de membros participantes
- Gráfico de barras usando `recharts` (já disponível via shadcn/ui chart)
- Barras: meta vs fechados por mês, com cor verde quando atingida e vermelha quando não

### 4. Correção de visibilidade no tema claro

**CSS (`src/index.css`):**
- Revisar variáveis do tema claro (`:root`) para garantir contraste adequado
- Ajustar `glass-panel`, `neon-border`, `neon-glow` e classes customizadas para funcionar em ambos os temas
- Garantir que textos em cards, badges e progress bars tenham contraste suficiente no tema claro

### Arquivos afetados
- `supabase/migrations/` — nova migração (participa_comissao)
- `src/pages/Membros.tsx` — switch participa_comissao
- `src/pages/Metas.tsx` — filtro por participa_comissao + gráfico histórico
- `src/pages/Comissoes.tsx` — filtro por participa_comissao
- `src/pages/Dashboard.tsx` — filtro por participa_comissao
- `src/pages/Relatorios.tsx` — novo relatório "Fechamento Mensal" com PDF/Excel
- `src/index.css` — ajustes de contraste no tema claro
- `package.json` — adicionar `jspdf` e `jspdf-autotable`

