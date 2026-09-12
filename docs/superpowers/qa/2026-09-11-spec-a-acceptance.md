# Spec A — evidência de aceite automatizado

Data: 2026-09-11
Branch: `integration/spec-a-navigation`
SHA candidato inicial: `4d2394f9a9bdf16268c6fcee75055990a5ae7d5a`
T1 incorporado: `d4b4e7f` (PR #40, identidade esperada da comanda); consumo integrado em `12dd249`.

## Gates locais

| Gate | Resultado | Evidência |
| --- | --- | --- |
| `navigationContinuity` | Verde (1/1) | `node --test src/navigationContinuity.test.js` |
| Regressão direcionada | Verde nos grupos afetados | 20 + 59 testes dos arquivos ajustados; `navigationContinuity` verde |
| `npm test` | Limitação de runner — não verde | paralelo excedeu ~1,1 GB; mesma suíte serial verde: 1.184 pass, 0 fail, 125,4 s (`npm.cmd test -- --test-concurrency=1`) |
| `npm run lint` | Verde com warnings preexistentes | `npm.cmd run lint` |
| `npm run build` | Verde | Vite: 369 módulos; build concluído em 1,03 s |
| Dry-run default | Verde | Wrangler 4.128.0; `--dry-run: exiting now` |
| Dry-run staging | Verde | bindings de staging validadas; `--dry-run: exiting now` |
| D1 migrations locais | Verde | 23 migrations aplicadas em `.wrangler/state/v3/d1`; sem `--remote` |
| `git diff --check` | Verde | sem saída de erro |

## Matriz A01–A30

| Critério | Estado nesta fase | Evidência automatizada |
| --- | --- | --- |
| A01 | Comprovado automaticamente | `navigation.test.js`, `actionCapabilities.test.js` |
| A02 | PENDENTE DE HOMOLOGAÇÃO | desktop visual/manual |
| A03 | PENDENTE DE HOMOLOGAÇÃO | mobile visual/manual |
| A04 | Comprovado automaticamente | `navigationLayout.test.js` |
| A05 | Comprovado automaticamente | `navigationLayout.test.js`, `AppNewOrderGuard.test.js` |
| A06 | Comprovado automaticamente | `settingsNavigation.test.js` |
| A07 | Comprovado automaticamente | `settingsNavigation.test.js` |
| A08 | Comprovado automaticamente | `settingsNavigation.test.js` |
| A09 | Comprovado automaticamente | `dashboardPeriodPersistence.test.js`, `operationalHistoryAnalysis.test.js` |
| A10 | Comprovado automaticamente | `queryContext.test.js`, `navigationContext.test.js` |
| A11 | Comprovado automaticamente | `comandasTransferNavigation.test.js` |
| A12 | Comprovado automaticamente | `AppNewOrderGuard.test.js`, `navigationContext.test.js` |
| A13 | Comprovado automaticamente | T1 `tableTransferIdentityUi.test.js`, `comandasTransferNavigation.test.js` |
| A14 | Comprovado automaticamente | `comandasAppWiring.test.js`, `comandasTransferNavigation.test.js` |
| A15 | Comprovado automaticamente | `navigationContinuity.test.js` |
| A16 | Comprovado automaticamente | `navigation.test.js`, `actionCapabilities.test.js` |
| A17 | Comprovado automaticamente | `navigation.test.js`, `navigationContext.test.js` |
| A18 | Comprovado automaticamente | `navigationContext.test.js`, `settingsNavigation.test.js`, `comandasAppWiring.test.js` |
| A19 | PENDENTE DE HOMOLOGAÇÃO | teclado/foco manual; testes de estrutura em `navigationLayout.test.js` |
| A20 | Comprovado automaticamente | revisão final de escopo e `git diff --check` |
| A21 | Comprovado automaticamente | `operationalPayment.test.js` |
| A22 | Comprovado automaticamente | `operationalPayment.test.js` |
| A23 | Comprovado automaticamente | `tableTransferIdentityUi.test.js`, `worker/tableRepository.test.js` |
| A24 | Comprovado automaticamente | `operationalHistoryAnalysis.test.js` |
| A25 | Comprovado automaticamente | `settingsNavigation.test.js` |
| A26 | Comprovado automaticamente | `AppNewOrderGuard.test.js`, `navigationContext.test.js` |
| A27 | Comprovado automaticamente | `queryContext.test.js`, `comandasTransferNavigation.test.js` |
| A28 | Comprovado automaticamente | `navigationLayout.test.js` |
| A29 | Comprovado automaticamente | `navigation.test.js`, `actionCapabilities.test.js` |
| A30 | Comprovado automaticamente | `navigationContinuity.test.js` |

## Pendências de homologação após staging

- Desktop visual; mobile visual; tema claro/escuro; teclado e foco manual.
- Transferência em duas sessões reais; pagamento real em staging.
- Gravação e falha real de Configurações.
- Impressão física de 1 via, 2 vias e recovery; comportamento real de QZ/impressora.

## Bloqueio de regressão

As 14 falhas reproduzidas eram asserções estruturais legadas que contradiziam decisões já incorporadas da Spec A. Foram atualizadas com asserts equivalentes do contrato atual, em grupos que passaram com 20 e 59 testes.

| Arquivo / teste | Expectativa antiga | Contrato atual da Spec A |
| --- | --- | --- |
| `comandasNavigation.test.js` (2) | menus autônomos e ordem antiga | desktop agrupado; mobile `Pedidos → Comandas → Financeiro → Mais` (5.1/5.2) |
| `issue14UxPolish.test.js` | transferir em Mesas | Mesas abre a comanda; transferência é ação de Comandas (7) |
| `mobileFoundation.test.js` | FAB no Dashboard usa clearance mobile | FAB do Dashboard removido; novo pedido permanece na operação (6.3) |
| `mobilePageMotion.test.js` | FAB do Dashboard acima da barra | FAB removido pela reorganização do Dashboard (6.3) |
| `mobileStabilityRegression.test.js` | FAB portalizado no Dashboard | Dashboard não cria esse FAB; modais/sheets continuam portalizados (6.3/12) |
| `mobileViewportRegression.test.js` | camada do FAB no Dashboard | escala de camadas permanece; FAB removido (6.3) |
| `pages/PrintQueue.test.js` (2) | atalho/itens mobile pré-A | Fila em Operação desktop e Mais mobile; atalho abre Configurações → Impressão (4/5/8) |
| `printing/qzPrintingUi.test.js` | conteúdo QZ no wrapper modal | conteúdo é extraído para `PrintingSettingsContent` e reutilizado na página (8) |
| `tablesAppWiring.test.js` | transferência por Mesas | Mesas oferece `Ver comanda`; ação protegida fica em Comandas (7/T1) |
| `tablesNavigation.test.js` | handlers e markup mobile antigos | Mesas é item direto de Mais via registro de destinos (5.2) |
| `theme.test.js` | controles de tema na sidebar | tema fica em Configurações → Preferências, com origem local única (8.2) |
| `utils/mobileNavigation.test.js` | ordem antiga de transição | ordem operacional atual inclui Comandas e não usa cadastros como entrada principal (5.2) |

Não houve alteração de produção. Esta evidência descreve somente a fase local. Staging não foi publicado e nenhum teste físico foi marcado como aprovado.
