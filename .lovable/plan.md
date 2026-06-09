Ajustar o módulo de Metas e Premiações para melhorar visualização, auditoria, simulação e manutenção das regras atuais, sem alterar a lógica de negócio já implementada.

OBJETIVO

Melhorar a gestão e acompanhamento das metas mensais, das premiações por contrato e das parcelas vinculadas às mensalidades, mantendo a regra atual já funcional.

IMPORTANTE

- Não alterar a regra de cálculo existente.
- Não alterar a estrutura de premiações já implementada.
- Não alterar a forma de liberação das parcelas.
- Não alterar a regra de contratos, mensalidades ou transferências.
- Focar apenas em visualização, auditoria, simulação e manutenção administrativa.

──────────────────────────────

1. MELHORIAS NA TELA /METAS  
──────────────────────────────

Adicionar novos blocos de visualização para o mês selecionado.

Bloco: Contratos do Mês

Exibir todos os contratos fechados no mês contendo:

- Cliente
- Vendedor responsável
- Data do fechamento
- Faixa vigente do mês
- Valor unitário da premiação
- Valor total da premiação

Importante:

Não criar cálculo individual de faixa por contrato.

A faixa utilizada deve ser a faixa atualmente apurada para aquele mês.

Objetivo:

Permitir rastrear quais contratos estão participando da meta e da premiação daquele período.

──────────────────────────────  
2. PARCELAS DA PREMIAÇÃO  
──────────────────────────────

Adicionar bloco de acompanhamento das parcelas.

Separar visualmente:

- Liberadas
- Pendentes
- Canceladas

Exibir:

- Cliente
- Vendedor
- Parcela (1, 2 ou 3)
- Valor
- Status
- Data de liberação
- Mensalidade vinculada

Adicionar totais por categoria.

Objetivo:

Permitir acompanhamento financeiro das premiações.

──────────────────────────────  
3. AUDITORIA DE METAS E FAIXAS  
──────────────────────────────

Criar auditoria para alterações realizadas em:

- Metas
- Faixas de premiação
- Apurações mensais

Registrar:

- Usuário
- Data e hora
- Tipo da alteração
- Valor anterior
- Valor novo

Disponibilizar visualização em Configurações > Auditoria de Metas.

Objetivo:

Rastreabilidade administrativa.

Não é necessário implementar um sistema complexo de diff nesta etapa.

──────────────────────────────  
4. SIMULADOR DE PREMIAÇÃO  
──────────────────────────────

Adicionar em Configurações > Metas & Premiações.

Permitir informar:

- Mês/Ano
- Quantidade de contratos

O simulador deve mostrar:

- Faixa atingida
- Valor por contrato
- Valor total da premiação
- Valor de cada parcela
- Comparativo entre as faixas configuradas

Importante:

O simulador não grava informações.

É apenas uma prévia administrativa.

──────────────────────────────  
5. VALIDAÇÕES DAS FAIXAS  
──────────────────────────────

Adicionar validações no editor de faixas.

Não permitir:

- Ordem duplicada
- Quantidade mínima duplicada
- Quantidade mínima menor que a faixa anterior
- Valores negativos
- Nome vazio

Exibir erros diretamente nos campos.

Bloquear salvamento enquanto existirem inconsistências.

Adicionar validações equivalentes também no banco.

──────────────────────────────  
6. REABRIR APURAÇÃO DO MÊS  
──────────────────────────────

Substituir qualquer conceito de "desfazer meta" por "Reabrir Apuração".

Objetivo:

Permitir correções administrativas sem perder histórico.

Funcionamento:

- Os contratos continuam pertencendo ao mês original.
- Os contratos continuam contando para aquele mês.
- O mês volta para estado "em apuração".
- As faixas podem ser alteradas novamente.
- A apuração é recalculada.

Importante:

- Parcelas já liberadas não devem ser recalculadas.
- Parcelas pendentes podem ser recalculadas conforme as novas regras.
- Registrar a ação na auditoria.

──────────────────────────────  
7. VERIFICAÇÃO DE CONSISTÊNCIA  
──────────────────────────────

Verificar se o progresso atual da meta está utilizando exclusivamente a nova estrutura de faixas e apuração.

Confirmar que:

- Quantidade de contratos do mês
- Faixa atingida
- Valor por contrato
- Premiações pendentes

estão sendo recalculados corretamente após alterações nas faixas enquanto a apuração estiver aberta.

Objetivo final:

## Melhorar gestão, rastreabilidade e visualização das metas e premiações sem alterar a lógica financeira já implementada.