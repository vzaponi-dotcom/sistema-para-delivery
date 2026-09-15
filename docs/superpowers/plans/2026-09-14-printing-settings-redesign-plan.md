# Printing Settings Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar Configurações → Impressão para reproduzir a hierarquia do mockup aprovado em desktop e mobile, preservando as fronteiras funcionais entre política do negócio, estação e impressora local/QZ.

**Architecture:** A rota `settings-printing` passa a usar o mesmo cabeçalho/breadcrumb limpo das telas já homologadas, sem `AreaNavigation`. `PrintingSettingsContent` continua responsável pelos três recursos independentes, mas os apresenta como três cards compactos e responsivos. A plataforma usada para apresentação visual é detectada separadamente da plataforma operacional persistida, evitando alterar a semântica de transporte QZ/queue-only.

**Tech Stack:** React, Vite, CSS responsivo, Node test runner, componentes `Button`, `Icon`, `SystemSelect`, controller central de settings e printing manager existente.

**Spec:** `docs/superpowers/specs/2026-09-12-business-settings-policies-design.md`

## Global Constraints

- Preservar D04: pedidos avulsos aceitam 1 ou 2 vias; mesas/comandas aceitam 1 ou 2 vias; alterações valem apenas para novos jobs.
- Preservar seção 4.4 da Spec B: política, estação e impressora local continuam recursos independentes; não criar transação global entre D1, localStorage e hardware.
- Preservar confirmação explícita ao tornar uma estação principal.
- Preservar distinção entre QZ conectado, fila encontrada e prontidão física.
- Não alterar polling, heartbeat, recovery, timeouts ou transporte de impressão.
- Não alterar backend, migrations ou regras de fila nesta rodada.
- Layout deve funcionar em tema claro/escuro e mobile sem rolagem horizontal.

---

### Task 1: Contrato visual e plataforma de apresentação

**Files:**
- Create: `src/components/PrintingSettingsRedesign.test.js`
- Modify: `src/printing/localPrintStation.js`
- Modify: `src/components/Icon.jsx`
- Test: `src/printing/localPrintStation.test.js`

**Interfaces:**
- Consumes: `detectPrintStationPlatform(userAgent)` para semântica operacional existente.
- Produces: `detectPrintStationUiPlatform(userAgent)` retornando `windows | android | ios | other` exclusivamente para apresentação visual.

- [ ] **Step 1: Write the failing test**

Adicionar testes exigindo que `detectPrintStationUiPlatform` reconheça Windows, Android e iPhone/iPad sem modificar `detectPrintStationPlatform`, e que o catálogo de ícones tenha representações `windows`, `android` e `apple`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL porque `detectPrintStationUiPlatform` e os ícones de plataforma ainda não existem.

- [ ] **Step 3: Write minimal implementation**

Implementar a detecção visual separada. `detectPrintStationPlatform` deve continuar retornando somente `windows`, `android` ou `other`; iOS continua operacionalmente `other`. Adicionar ícones SVG internos ao componente `Icon` sem dependência externa.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: os testes de plataforma passam sem regressão dos testes de estação/QZ.

### Task 2: Redesenhar conteúdo e rota de Impressão

**Files:**
- Modify: `src/components/PrintingSettingsContent.jsx`
- Modify: `src/pages/Settings.jsx`
- Modify: `src/components/PrintingSettingsRedesign.test.js`

**Interfaces:**
- Consumes: `settings.policyState()`, `settings.stationState()`, `settings.primaryState()`, `settings.savePolicy()`, `settings.saveStation()`, `settings.discardPolicy()`, `settings.discardStation()`, `settings.makePrimary()`, `settings.savePrinter()`, `settings.refreshPrinters()`, `settings.testPrint()`.
- Produces: três cards visuais independentes: política, estação e impressora local/QZ.

- [ ] **Step 1: Write/extend failing tests**

Exigir título `Impressão de pedidos`, ausência de `AreaNavigation` na rota de impressão, três cards `.printing-settings-card`, seletores compactos de vias, card de estação com nome/plataforma/toggles e card local com status, fila pendente, teste e troca de impressora.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL porque a rota e o markup ainda seguem a estrutura antiga.

- [ ] **Step 3: Write minimal implementation**

Na rota `settings-printing`, renderizar `PageHeader` diretamente com breadcrumb `Configurações`, título `Impressão de pedidos` e descrição aprovada. No conteúdo:

- Card 1: ícone de documento, título `Política de impressão do negócio`, `SystemSelect` para Pedidos e Mesas / Comandas, aviso curto e ações independentes `Cancelar` / `Salvar política` quando gerenciável.
- Card 2: ícone de estação, nome editável apenas quando permitido, plataforma somente leitura com ícone Windows/Android/Apple/genérico, indicador `Principal`, controle de impressão automática somente em QZ e ação confirmada para tornar principal.
- Card 3: ícone de impressora, status operacional, impressora configurada, resumo de jobs pendentes, `Testar impressão` e fluxo compacto `Trocar impressora` que revela seleção/atualização/salvamento local somente quando QZ está disponível.
- Em queue-only, mostrar resumo claro de fila central sem controles físicos fictícios.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: GREEN no contrato novo e na suíte existente de impressão.

### Task 3: Responsividade, estados e gates finais

**Files:**
- Modify: `src/printing/printing.css`
- Modify: `src/components/PrintingSettingsRedesign.test.js`

**Interfaces:**
- Consumes: classes dos três cards criadas na Task 2.
- Produces: layout desktop em cards horizontais/compactos e mobile empilhado, sem rolagem horizontal e usando tokens semânticos existentes.

- [ ] **Step 1: Write/extend failing style assertions**

Exigir `.printing-settings-card`, `.printing-settings-card-header`, `.printing-platform-value`, `.printing-local-layout`, estados de status e `@media (max-width: 480px)` empilhando grids e ações.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL porque as classes responsivas ainda não existem.

- [ ] **Step 3: Write minimal CSS implementation**

Criar cards com borda/surface tokens, cabeçalhos com ícone circular, grids de duas colunas no desktop, inputs compactos, badges de status e empilhamento total no mobile. Não usar cores hardcoded para tema de sistema; usar `var(--primary)`, `var(--success)`, `var(--danger)`, `var(--surface*)`, `var(--text*)`, `var(--border*)`.

- [ ] **Step 4: Run full verification**

Run: `npm test && npm run lint && npm run build`
Expected: todos verdes.

- [ ] **Step 5: Verify CI/deploy**

Confirmar `Validate application` com tests/lint/build/Worker production/staging/migrations verdes e `Deploy staging` com migrations remotas, deploy e login de staging verdes antes de solicitar homologação.