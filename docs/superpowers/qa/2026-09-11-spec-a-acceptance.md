# Spec A — evidência de aceite e fechamento

Data inicial: 2026-09-11
Fechamento: 2026-09-12
Branch: `integration/spec-a-navigation`
PR: #41
SHA candidato inicial: `4d2394f9a9bdf16268c6fcee75055990a5ae7d5a`
SHA final da aplicação homologado em staging: `7e1fb956908cf3c9efbb5506f7e9e3e152959d45`
T1 incorporado: `d4b4e7f` (PR #40, identidade esperada da comanda); consumo integrado em `12dd249`.

## Estado final

**APROVADO PARA MERGE, SEM DEPLOY DE PRODUÇÃO.**

A Spec A foi integralmente homologada em staging, incluindo a rodada final de polish mobile do topo de Pedidos → Cozinha. O SHA de aplicação efetivamente homologado é `7e1fb956908cf3c9efbb5506f7e9e3e152959d45`.

Este fechamento documental não substitui nem altera o SHA da aplicação homologada. Produção permanece intocada e o merge em `master` deve ocorrer somente após o fechamento dos gates finais do PR #41.

## Gates locais da fase de implementação

| Gate | Resultado | Evidência |
| --- | --- | --- |
| `navigationContinuity` | Verde (1/1) | `node --test src/navigationContinuity.test.js` |
| Regressão direcionada | Verde nos grupos afetados | 20 + 59 testes dos arquivos ajustados; `navigationContinuity` verde |
| `npm test` | Limitação do runner local na execução paralela | paralelo excedeu ~1,1 GB; mesma suíte serial verde: 1.184 pass, 0 fail, 125,4 s (`npm.cmd test -- --test-concurrency=1`) |
| `npm run lint` | Verde com warnings preexistentes | `npm.cmd run lint` |
| `npm run build` | Verde | Vite: 369 módulos; build concluído em 1,03 s |
| Dry-run default | Verde | Wrangler 4.128.0; `--dry-run: exiting now` |
| Dry-run staging | Verde | bindings de staging validadas; `--dry-run: exiting now` |
| D1 migrations locais | Verde | 23 migrations aplicadas em `.wrangler/state/v3/d1`; sem `--remote` |
| `git diff --check` | Verde | sem saída de erro |

## Gates finais no SHA homologado

Workflow GitHub Actions `Validate application` executado sobre `7e1fb956908cf3c9efbb5506f7e9e3e152959d45`: **SUCESSO**.

Etapas concluídas com sucesso:

- instalação de dependências;
- testes;
- lint;
- build;
- validação do bundle do Worker de produção (validação somente, sem deploy);
- validação do bundle do Worker de staging;
- aplicação das migrations no D1 local.

## Matriz A01–A30

| Critério | Estado final | Evidência |
| --- | --- | --- |
| A01 | APROVADO | `navigation.test.js`, `actionCapabilities.test.js` |
| A02 | APROVADO EM HOMOLOGAÇÃO | desktop visual/manual em staging |
| A03 | APROVADO EM HOMOLOGAÇÃO | mobile visual/manual em staging, incluindo polish final de Pedidos → Cozinha |
| A04 | APROVADO | `navigationLayout.test.js` |
| A05 | APROVADO | `navigationLayout.test.js`, `AppNewOrderGuard.test.js` |
| A06 | APROVADO | `settingsNavigation.test.js` |
| A07 | APROVADO | `settingsNavigation.test.js` |
| A08 | APROVADO | `settingsNavigation.test.js` |
| A09 | APROVADO | `dashboardPeriodPersistence.test.js`, `operationalHistoryAnalysis.test.js` |
| A10 | APROVADO | `queryContext.test.js`, `navigationContext.test.js` |
| A11 | APROVADO | `comandasTransferNavigation.test.js` |
| A12 | APROVADO | `AppNewOrderGuard.test.js`, `navigationContext.test.js` |
| A13 | APROVADO | T1 `tableTransferIdentityUi.test.js`, `comandasTransferNavigation.test.js` |
| A14 | APROVADO | `comandasAppWiring.test.js`, `comandasTransferNavigation.test.js` |
| A15 | APROVADO | `navigationContinuity.test.js` |
| A16 | APROVADO | `navigation.test.js`, `actionCapabilities.test.js` |
| A17 | APROVADO | `navigation.test.js`, `navigationContext.test.js` |
| A18 | APROVADO | `navigationContext.test.js`, `settingsNavigation.test.js`, `comandasAppWiring.test.js` |
| A19 | APROVADO EM HOMOLOGAÇÃO | teclado/foco manual em staging; estrutura coberta por `navigationLayout.test.js` |
| A20 | APROVADO | revisão final de escopo e `git diff --check` |
| A21 | APROVADO | `operationalPayment.test.js` + homologação em staging |
| A22 | APROVADO | `operationalPayment.test.js` + homologação em staging |
| A23 | APROVADO | `tableTransferIdentityUi.test.js`, `worker/tableRepository.test.js` + homologação em staging |
| A24 | APROVADO | `operationalHistoryAnalysis.test.js` |
| A25 | APROVADO | `settingsNavigation.test.js` + homologação em staging |
| A26 | APROVADO | `AppNewOrderGuard.test.js`, `navigationContext.test.js` |
| A27 | APROVADO | `queryContext.test.js`, `comandasTransferNavigation.test.js` |
| A28 | APROVADO | `navigationLayout.test.js` |
| A29 | APROVADO | `navigation.test.js`, `actionCapabilities.test.js` |
| A30 | APROVADO | `navigationContinuity.test.js` |

## Homologação final em staging

A rodada final de homologação foi concluída e aprovada. As pendências anteriormente registradas como manuais — desktop/mobile, tema claro/escuro, teclado/foco e fluxos operacionais aplicáveis à Spec A — foram encerradas em staging. O polish mobile final de Pedidos → Cozinha também foi aprovado.

**Pendências bloqueantes da Spec A: nenhuma.**

## Bloqueio de regressão resolvido

As 14 falhas reproduzidas durante a implementação eram asserções estruturais legadas que contradiziam decisões já incorporadas da Spec A. Foram atualizadas com asserts equivalentes do contrato atual, em grupos que passaram com 20 e 59 testes.

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

## Segurança de release

- Nenhum deploy de produção foi executado durante este fechamento.
- Nenhum merge em `master` foi executado durante este fechamento.
- O SHA de aplicação homologado permanece `7e1fb956908cf3c9efbb5506f7e9e3e152959d45`.
- O PR #41 pode ser preparado para merge após os gates finais da alteração exclusivamente documental deste QA.