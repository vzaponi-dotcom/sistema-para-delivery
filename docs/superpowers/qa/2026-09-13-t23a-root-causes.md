# T23A - Root cause inventory

Base: `48b5448`; recovered transcript: `2026-09-13T22-48-45-01a09d9a-39c3-76b1-9fd8-af878bac5b00`.

The complete aggregate output is truncated in the transcript. A subsequent filtered output in that same transcript contains all 39 `not ok` records with names and partial stacks. That recovered output is persisted at `logs/t23a-root-causes/recovered-filtered-failures.log`. No aggregate was rerun to recover the inventory.

The initial focused selection of the 14 affected files reproduced 39 failures out of 72 tests (`groups-red.log`). The parent A6 record repeats the failed payment subtest; it is counted to reconcile the original 39, not as an independent defect.

| Category | Records | Root cause |
|---|---:|---|
| migration/schema fixture drift | 19 | Three handwritten SQLite schemas omit 0024 tables/columns and parts of 0025. |
| textual/contract expectation drift | 5 | Old internal wiring, old theme callback, timing argument, printer action and missing categoryLabel. |
| session/effective-config fixture drift | 14 | Eleven SQL-double cases omit current policy reads; payment UI lacks effective methods; relogin lacks trusted owner; one parent failure. |
| possible production defect | 0 | None confirmed after focused reproduction and fixtures corrected. |
| other | 1 | Navigation combines obsolete autosave/owner fixture with Vite FSWatcher timers contaminating lifecycle counts. |

| Original TAP ID | Category | Test name |
|---|---|---|
| 208 | textual/contract | table tab integration stays wired across persistence, app, receivables and new order |
| 3 | session/effective-config | an accepted payment keeps reconciling after A loses visual ownership |
| 262 | session/effective-config (parent only) | A6 keeps comanda identity across transfer, navigation, payment, and order entry |
| 430 | other (navigation fixture + watcher) | A9 keeps navigation continuity across repeated page cycles |
| 462 | textual/contract | theme is absent from Sidebar and remains available in Settings device preferences |
| 596 | textual/contract | orders page composes the approved kitchen heading, actions, counters, and persistent queues |
| 771 | textual/contract | Windows printing settings expose QZ Tray queue configuration without legacy Android transport |
| 876 | session/effective-config | App consumes official bootstrap tables and clears old business tables on session reset |
| 1087 | session/effective-config | createOrder uses server product prices for several items, fee and adjustment |
| 1088 | session/effective-config | local orders without a client reuse the persistent table tab and its exact name snapshot |
| 1089 | session/effective-config | local order persists an optional same-business client snapshot |
| 1090 | session/effective-config | local order rejects an optional client from another business |
| 1091 | session/effective-config | paid retry creates one order, payment and movement and stays Em preparo |
| 1114 | migration/schema | current checkout snapshots customer contact and enqueues one paid automatic print job atomically |
| 1115 | migration/schema | automatic local print snapshot preserves table and optional customer identity |
| 1116 | migration/schema | automatic local print snapshot preserves a table without a customer |
| 1117 | migration/schema | automatic delivery print snapshot preserves the customer without a table |
| 1118 | migration/schema | automatic local print snapshot does not duplicate the table identity |
| 1119 | migration/schema | table checkout requests one automatic copy when the central default is two |
| 1120 | migration/schema | delivery checkout snapshots the central default of one or two copies |
| 1121 | migration/schema | pickup checkout snapshots the central default of one or two copies |
| 1122 | migration/schema | changing the central default does not rewrite an existing automatic job copy snapshot |
| 1123 | migration/schema | new scheduled order is printable immediately while keeping its scheduled time |
| 1124 | migration/schema | checkout retry with the same idempotency key keeps one order and one automatic print job |
| 1125 | migration/schema | eligible checkout creates one unassigned automatic job without a ready primary station |
| 1126 | migration/schema | historical/backdated orders never enqueue automatic kitchen printing |
| 1281 | session/effective-config | createOrder calculates server cents and writes order contact snapshot and item in one batch |
| 1282 | session/effective-config | new orders use independent business sequences and never reuse cancelled or finalized numbers |
| 1284 | session/effective-config | distinct concurrent creations receive distinct numbers even when sequence gaps are safer than reuse |
| 1286 | session/effective-config | payment uses official total and duplicate payment creates no second movement |
| 1287 | session/effective-config | finalization is idempotent and preserves paid order audit history |
| 1290 | session/effective-config | valid cart passes route validation and reaches repository lookup |
| 1310 | textual/contract | write-effect readers return mapped payment movement and current table tab |
| 1446 | migration/schema | two full payments produce one settlement and one stable conflict |
| 1447 | migration/schema | cancellation that commits after the payment pre-read makes the whole payment batch fail |
| 1448 | migration/schema | payment that commits first preserves existing paid cancellation and deferred-refund behavior |
| 1450 | migration/schema | expected table tab identity allows same-tab reuse and rejects close transfer or replacement |
| 1463 | migration/schema | delivery checkout retains its response contract and creates the centralized automatic print job |
| 1464 | migration/schema | a local order opens a fresh stable tab and returns its occupied pending summary before payment |

## Confirmação e correção por causa

- **Schema:** o checkout automático representativo falhava ao ler `business_cancel_reasons`; lifecycle falhava em `cr.label`. `OperationalDb` reutiliza `createSettingsDb`, aplica 0001–0025 reais e fornece o adaptador D1/SQLite transacional existente. Os negócios adicionais entram antes do backfill 0024; dados de cenário usam colunas explícitas e timestamps. Nenhum schema de produção ou teste histórico de migration foi alterado. A seleção das três famílias e migrations passou **36/36** (`schema-green.log`).
- **Doubles/políticas:** `createOrder` em CheckoutDb não recebia a modalidade/revisão; OrderDb não respondia à leitura válida de impressão; AuthOnlyDb interrompia o checkout antes do cliente inexistente. Esses três emuladores foram substituídos por banco migrado real, sem respostas fictícias para guards. As assertions verificam persistência, identidade, número, pagamento e batch. Um drift secundário antes mascarado foi confirmado: a leitura real retorna `Mesa 4 · Maria`, conforme `d36945d`, mantendo `client_name_snapshot = Maria`.
- **Contratos:** T08 (`8449d3f`) mudou criação da comanda para o batch guardado; Spec B §4.3 exige reportar falha de persistência do tema; §4.4 exige `Salvar impressora` separado; §6.4 usa tempos efetivos para ativos; T20 preserva rótulo financeiro legível. Ajustadas somente expectativas correspondentes, com regressões comportamentais existentes de dispositivo, impressão e operação. Seleção conjunta contratos/doubles/regressões: **53/53** (`contracts-db-green.log`).
- **Sessão/configuração UI:** o pagamento A6 não fazia POST porque bootstrap não continha métodos efetivos; o relogin de Mesas não apresentava businessId/settingsContextId/capabilities. Respostas explícitas usam `appSessionFixtures.js`; não há injeção global de defaults no harness. A9 agora fornece envelopes/revisões reais e clica em `Salvar política`; verifica zero writes ao editar, um save e navegação durante save. Ausência e ownership inválido continuam cobertos nas regressões.
- **Watcher:** A9 variava entre falta de radio e `cycle N added a global effect`. Instrumentação temporária capturou timers 1000/5 ms de `FSWatcher._throttle` (`navigation-trace-concurrent.log`), mantendo 13 listeners e quatro timers do App. O RED independente verifica observadores reais após carregar App. O harness ignora arquivos no watcher, preservando carregamento SSR e a contagem de timers do App. A opção `watch: null` era descartada pelo merge da configuração local do Vite; fechar o watcher permitia registro posterior pelo carregamento. A configuração final `watch.ignored` evita a observação desde a criação. Seleção UI/ownership/recuperação/harness: **18/18**, incluindo os dois novos testes (`ui-green.log`).

## Cache e processos

O commit **`be978f1` — `test: isolate Vite cache per workspace harness`** contém somente o isolamento e sua regressão. RED determinístico: dois harnesses vivos usavam `node_modules/.vite`. GREEN: **30/30**, incluindo consumidores; o teste escreve em caches distintos, encerra um, confirma sua remoção e a preservação do outro, e encerra o segundo. Teardown usa `finally` para limpeza e restauração dos globals. Evidências: `cache-red.log` / `cache-green.log`.

Antes do agregado, inventário CIM encontrou runner antigo T21 iniciado em 13/09 às 21:43: PID 30184, filho 23416 (`settingsPrintingPolicy.test.js`). Identidades e horário foram conferidos antes de encerrar somente esses dois processos. Nova conferência: **zero runners**. Os processos de Codex, conectores e aplicações permaneceram intactos.

Todos os logs citados ficam em `logs/t23a-root-causes/` nesta worktree. São artefatos locais ignorados pelo Git.

## Agregado limpo

**PASS: 1514/1514**, zero falhas/cancelamentos/skips/todo, uma suite, **58.318,2888 ms**, exit 0 e resumo final presente. A contagem anterior 1512 aumentou somente pelos dois testes de cache/watcher.

- Início: `2026-09-14T02:43:23.621Z`; término do supervisor: `2026-09-14T02:44:23.009Z` (13/09 23:43–23:44 em São Paulo).
- Uma execução de `npm test`, invocando o CLI do npm com Node sob o supervisor existente. Stdout: `aggregate.stdout.log`; stderr: `aggregate.stderr.log`; resultado verificável: `aggregate-summary.json`.
- O primeiro lançamento via cmd falhou por quoting **antes de iniciar npm ou testes**. Evidência preservada em `launch-failed.stderr.log` e `launch-failed-summary.json`; não foi uma segunda execução de testes.
- Supervisor confirmou `drained: true`, `closed: true`, `exitCode: 0`. Inventários CIM anterior/posterior confirmaram **zero runners**; pós-execução em `runners-after.json`.
- `git diff --check` passou. Nenhum teste foi ignorado e nenhum contrato de produção foi alterado para obter o resultado.

O resultado vale para o código e os fixtures locais deste checkpoint. Não constitui aprovação dos gates seguintes nem fechamento completo da T23A/T23B.

Antes da autorização de commit: HEAD `be978f1`; correções posteriores e documentação preservadas no working tree, sem arquivos no index. A revisão automática rejeitou a primeira tentativa de staging Git/commit adicional, interpretando a proibição de staging do usuário e considerando somente o commit separado do cache claramente autorizado. Não houve contorno nem push.

O usuário autorizou posteriormente `git add` e **um único commit local adicional**, restrito às correções T23A investigadas e à documentação correspondente, com mensagem `test: align legacy fixtures with current Spec B contracts`. A autorização não inclui ambiente staging, deploy, publicação ou gates seguintes. O código executável permanece o mesmo que passou no agregado 1514/1514; esta atualização apenas registra a autorização e a preparação do commit.

## Limites

Nenhum defeito de produção foi confirmado e nenhum arquivo de produção foi modificado. Sem push, ambiente staging, migration remota, T23B, produção, merge ou force-push. Lint/build/dry-runs/D1 e demais gates não foram iniciados nesta correção.

Revisão independente somente leitura: **nenhum Critical/Important**. Referências de seções deste relatório foram corrigidas após conferência. Permanece um **Minor** de infraestrutura fora das 39 falhas: se `createServer()` rejeitar antes de registrar o teardown, o cache temporário e o fetch de setup não são limpos. A regressão entregue garante isolamento e remoção no teardown de harnesses inicializados, inclusive na saída por erro de unmount/close; não cobre falha de inicialização do Vite. O código executável foi preservado após o agregado verde; essa melhoria de setup fica registrada para uma próxima rodada focada.
