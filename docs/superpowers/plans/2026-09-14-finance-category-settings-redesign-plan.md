# Finance Category Settings Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar Configurações → Categorias financeiras para ficar fiel ao mockup homologado, com tabelas compactas no desktop, cards compactos no mobile, drag-and-drop por grupo, ícones por categoria e identidade visual vermelha do Gestão Delivery.

**Architecture:** Preservar integralmente o recurso `financeCategories`, suas regras de permissões, tipo imutável, draft explícito e salvamento atômico já existentes. Substituir apenas a camada de apresentação baseada em `SettingsItemList` por duas listas ordenáveis próprias, reutilizando `@dnd-kit/react` e o padrão já homologado em Formas de pagamento/Motivos de cancelamento. A rota deixa de renderizar `AreaNavigation` e passa a usar breadcrumb para a Home de Configurações.

**Tech Stack:** React 19, `@dnd-kit/react` 0.5.0, CSS responsivo, Node test runner, react-test-renderer, Oxlint, Vite.

**Spec:** `docs/superpowers/specs/2026-09-12-business-settings-policies-design.md` e `docs/superpowers/specs/2026-09-12-business-settings-policies-visual-contract.md`, refinados pela homologação aprovada em 2026-09-14.

## Global Constraints

- Trabalhar apenas em `feature/spec-b-settings-policies`; não alterar `master` nem produção.
- Manter a identidade visual atual do sistema em vermelho; não copiar o azul do mockup.
- A coluna Tipo deve exibir somente `Receita` para `entrada` e `Despesa` para `saida`.
- Categorias nativas/personalizadas continuam obedecendo às permissões já fornecidas pelo backend, mas essa distinção não aparece na coluna Tipo.
- Ordenação é independente dentro de Entradas manuais e Saídas manuais.
- O tipo de uma categoria existente permanece imutável.
- Mobile não deve usar tabela horizontal nem expor botões de ação em bloco; deve usar cards compactos com menu de três pontos.
- Manter light/dark pelos tokens existentes.
- Aplicar TDD: RED explícito antes das mudanças de implementação.

---

### Task 1: Contrato visual e responsivo em RED

**Files:**
- Create: `src/pages/FinanceCategorySettings.redesign.test.js`

**Interfaces:**
- Consumes: `FinanceCategorySettings`, `Settings`, `nativeFinanceCategories`, `workspaceHarness`.
- Produces: contrato testável para cabeçalho, grupos, colunas, ícones, drag handles, status/tipo, mobile e remoção da navegação antiga.

- [ ] **Step 1: Escrever testes que exijam o layout homologado**

Cobrir:
- breadcrumb `Configurações`, título e botão `Adicionar categoria` no cabeçalho;
- aviso de categorias automáticas protegidas;
- dois grupos com descrições de receita/despesa;
- cabeçalhos `ORDEM | CATEGORIA | TIPO | STATUS | AÇÕES`;
- cada linha com drag handle, ordem, ícone, `Receita`/`Despesa`, `Ativa`/`Inativa` e menu de ações;
- categoria inativa com classe `is-inactive` sem perder o menu;
- mobile sem elemento `<table>` e com metadados compactos;
- rota sem `.area-navigation`.

- [ ] **Step 2: Commitar o teste RED**

Commit esperado: `test: define finance category redesign contract`.

- [ ] **Step 3: Confirmar falha do workflow `Validate application`**

Esperado: falha em `npm test` por ausência do novo contrato visual.

---

### Task 2: Estrutura agrupada, drag-and-drop e ações compactas

**Files:**
- Modify: `src/pages/FinanceCategorySettings.jsx`
- Modify: `src/pages/FinanceCategorySettings.test.js`

**Interfaces:**
- Consumes: `@dnd-kit/react`, metadata `canRename/canDelete/isSystem/usedEver`, callbacks `onEdit/onSave/onDiscard`.
- Produces: duas listas ordenáveis independentes e menus compactos sem alterar o shape `{ items }` do draft.

- [ ] **Step 1: Implementar row ordenável por grupo**

Usar `DragDropProvider`, `DragOverlay`, `useSortable` e `isSortable`. Cada linha expõe `data-finance-category-id`, `data-finance-category-type` e `data-finance-category-drag-handle`.

- [ ] **Step 2: Manter teclado e ações existentes**

`Alt+ArrowUp/ArrowDown` continua reordenando; menu contém ativar/desativar, renomear, excluir e mover para cima/baixo conforme permissões. Ações bem-sucedidas fecham o menu e restauram foco.

- [ ] **Step 3: Preservar regras de negócio**

Não permitir alteração do tipo de categoria existente, continuar falhando fechado quando metadata confiável estiver ausente e nunca expor rename/delete de nativas ou categorias já utilizadas.

- [ ] **Step 4: Ajustar cópia do shell**

Usar breadcrumb `Configurações`, descrição `Organize as categorias manuais de receitas e despesas`, botão de adicionar no header, `Cancelar` no rodapé e aviso equivalente ao mockup sobre Vendas/Estornos.

- [ ] **Step 5: Rodar o conjunto focado até GREEN**

Executar via CI `npm test` e confirmar que os testes de `FinanceCategorySettings` e do redesign passam.

---

### Task 3: Ícones por categoria e acabamento responsivo

**Files:**
- Modify: `src/components/Icon.jsx`
- Create: `src/finance-category-settings.css`
- Modify: `src/pages/FinanceCategorySettings.jsx`

**Interfaces:**
- Consumes: tokens `--primary`, `--success`, `--danger`, `--surface`, `--border`, `--muted`.
- Produces: ícones coerentes para categorias nativas e fallback para personalizadas; layout desktop/mobile fiel ao mockup.

- [ ] **Step 1: Mapear ícones das categorias nativas**

Mapeamento mínimo: `contribution`, `other_income`, `supplies`, `packaging`, `delivery_costs`, `gas`, `water`, `electricity`, `rent`, `maintenance`, `fees`, `owner_draw`, `other_expense`. Categorias custom usam fallback por tipo.

- [ ] **Step 2: Adicionar SVGs genéricos faltantes ao componente `Icon`**

Adicionar apenas os símbolos necessários (por exemplo flame, droplet, bolt, home, wrench, percent, user/withdraw, ellipsis/coins), mantendo stroke e acessibilidade do componente atual.

- [ ] **Step 3: Implementar desktop fiel ao mockup**

Dois cards de grupo; heading com ícone circular e descrição; tabela em grid; receita em tons de success e despesa em tons de danger; status ativo em success; inativo atenuado.

- [ ] **Step 4: Implementar mobile compacto**

Cada linha vira card: primeira linha com ordem/ícone/nome/ações; segunda linha com `Receita|Despesa` e `Ativa|Inativa` lado a lado. Sem botões grandes expostos e sem scroll horizontal.

- [ ] **Step 5: Verificar dark/light e reduced motion por CSS**

Usar somente tokens e `color-mix`; remover transição quando `prefers-reduced-motion: reduce`.

---

### Task 4: Rota, feedback e gates finais

**Files:**
- Modify: `src/pages/Settings.jsx`
- Test: `src/pages/FinanceCategorySettings.redesign.test.js`

**Interfaces:**
- Consumes: `businessSettings.save/discard`, `onNavigate`, `onSuccessMessage`.
- Produces: fluxo consistente com as telas já homologadas da Spec B.

- [ ] **Step 1: Remover `AreaNavigation` da rota de categorias financeiras**

Passar `onNavigateHome={() => onNavigate?.('settings-home')}` ao editor.

- [ ] **Step 2: Padronizar salvar/cancelar**

Ao salvar com sucesso, emitir `Categorias financeiras salvas com sucesso`. Ao cancelar, descartar e voltar para `settings-home` quando permitido.

- [ ] **Step 3: Rodar gates completos**

Esperado no workflow: `npm test`, `npm run lint`, `npm run build`, Worker production dry-run, Worker staging dry-run e migrations locais todos verdes.

- [ ] **Step 4: Aguardar deploy automático de staging**

Confirmar migrations de staging, deploy e verificação de login verdes antes de solicitar homologação visual.
