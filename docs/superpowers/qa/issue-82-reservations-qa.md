# Issue #82 — Staging QA

**Feature:** Agendamento multi-dia e reservas de mesa
**PR:** #83
**Status:** PARTIAL — 44 PASS, 3 FAIL, 23 BLOCKED
**Staging SHA (aplicação homologada):** 2712f64aa70aa891c7d7a6d41a9262f7a5a78c08
**Production:** BLOCKED

No scenario is marked PASS until it is actually executed against the implementation.

## Automated / integration

| Area | Status | Evidence |
|---|---|---|
| Migration clean install | PASS | Task 1 test + Validate #2518 / run `36580925658` |
| Migration upgrade | PASS | Exact pre-0034 upgrade preserves existing order/table-tab history; Validate #2518 |
| Reservation overlap concurrency | PARTIAL | SQLite write-boundary overlap triggers PASS for insert/update and half-open intervals; true multi-request race remains for later integration tasks. |
| Checkout | PASS (through Task 5 scope) | Validate #2545 / run `36587697649`: Local reservation persists atomically without opening a comanda; overlap rollback/idempotency/HTTP effects pass. Printing timing remains Task 6. |
| Printing | PASS (automated Task 6 scope) | Validate #2564 / run `36593459366`: availability matrix, copy context, canonical scheduled docs, ESC/POS/PDF and manual document reconstruction PASS. Physical printer checks remain PENDING for staging. |
| Arrival conversion | PASS (automated Task 9 scope) | Validate #2579 / run `36597090286`: atomic conversion, guards, status preservation, retry idempotency and HTTP effects PASS. |
| Edit reservation | PASS (automated Task 10 scope) | Validate #2585 / run `36599062787`: edit cutoff, repricing, atomic replacement, conflict/revision rollback, print-job update/preservation and capabilities PASS. |
| Cancel / no-show | PASS (automated Task 8 scope) | Validate #2575 / run `36596600847`: existing order cancel coupling, reservation cancel/no-show, revision guards and auth/origin PASS. |
| Kitchen queue | PENDING | — |
| Kitchen TV | PENDING | — |
| Receivables | PENDING | — |
| Reporting | PENDING | — |
| Architecture | PASS (current code HEAD through Task 12) | Validate #2612 / run `36610498170` |
| Full test suite | PASS (current code HEAD through Task 12) | All 8 test shards + full validate green in Validate #2612 / run `36610498170` |
| Lint | PASS (current code HEAD through Task 12) | Validate #2612 / run `36610498170` |
| Build | PASS (current code HEAD through Task 12) | Validate #2612 / run `36610498170` |

## Manual staging blocks

| Block | Status | Notes |
|---|---|---|
| A — Entrega/Retirada multi-dia | PENDING | — |
| B — Reserva Local | PENDING | — |
| C — Editar reserva | PENDING | — |
| D — Impressão | PENDING | Physical checks may remain BLOCKED-PHYSICAL until printer is available |
| E — Chegada/comanda | PENDING | — |
| F — Cancelamento/no-show | PENDING | — |
| G — Financeiro/Relatórios | PENDING | — |
| H — UX desktop/mobile/themes | PENDING | — |
| I — Kitchen TV | PENDING | TV real required where applicable |

## Release gates

- [ ] Final SHA validated.
- [ ] Staging deploy successful.
- [ ] Required manual QA complete.
- [ ] Physical printing/TV blockers resolved or explicitly held before production.
- [ ] No unresolved review threads.
- [ ] Merge explicitly authorized.
- [ ] Production explicitly authorized separately.


## Automated checkpoints after Task 3

- 90-day schedule policy: PASS.
- Local schedule eligibility at validation boundary: PASS.
- São Paulo calendar-day horizon: PASS.
- Reservation repository business scope: PASS.
- Reservation list filters: PASS.
- Next reservation per table: PASS.
- Order reservation context read model: PASS.
- Table occupancy remains independent from reservation projection: PASS.
- No full reservation collection added to bootstrap: PASS by implementation contract; complete API/bootstrap coverage continues in Task 7.


## Automated checkpoints after Task 5

- Active reservation blocks table rename: PASS.
- Active reservation blocks table deactivation: PASS.
- Table reordering with reservation: PASS.
- Terminal reservation does not block table management: PASS.
- Local scheduled checkout opens no table-tab: PASS.
- Local scheduled checkout keeps occupancy unchanged: PASS.
- Reservation on currently occupied table remains independent from current tab: PASS.
- Reservation duration snapshot 120 minutes: PASS.
- Overlap conflict rollback across order/items/job/reservation: PASS.
- Reservation checkout idempotency: PASS.
- Scheduled Local + expectedTableTabId rejected: PASS.
- POST /api/orders returns reservation + updated nextReservation projection: PASS.
- Task 4 final workflow required one infrastructure-only rerun due local Wrangler port collision; rerun passed without code change.


## Automated checkpoints after Task 6

- Immediate automatic print availability: PASS.
- Same-day scheduled Entrega/Retirada stays immediately available: PASS.
- Other-day Entrega/Retirada waits for operationalStartAt: PASS.
- Same-day/future Local reservation waits for operationalStartAt: PASS.
- Reservation without table-tab uses table-context copy policy: PASS.
- Scheduled/reservation semantic metadata in canonical document: PASS.
- ESC/POS prints AGENDADO/RESERVA and requested service time: PASS.
- PDF prints AGENDADO/RESERVA and requested service time: PASS.
- Manual/reprint official document rebuild preserves schedule/reservation identity: PASS.
- Manual print lifecycle does not advance future automatic availableAt: PASS by existing printing regressions.
- Physical MPT-II/QZ verification: PENDING / staging physical QA.


## Automated checkpoints after Task 9

- Reservation list API business scope and filters: PASS.
- Reservation detail returns official order + automatic print metadata: PASS.
- Read access via existing Orders/Comandas capabilities: PASS.
- Bootstrap contains no 90-day reservation collection: PASS.
- Existing order cancellation closes active reservation atomically: PASS.
- Reservation cancel endpoint: PASS.
- Reservation no-show endpoint with official cancellation policy: PASS.
- Stale reservation revision blocks terminal mutation without partial effects: PASS.
- Pending automatic print removal on cancellation remains atomic: PASS.
- Confirm arrival opens one comanda and links the reserved order: PASS.
- Confirm arrival preserves Em preparo/Finalizado order status: PASS.
- Too-early arrival blocked: PASS.
- Occupied table arrival blocked: PASS.
- Cancelled order arrival blocked: PASS.
- Arrival retry resolves to the same converted comanda: PASS.
- nextReservation recalculates after conversion: PASS.
- Manual staging verification for Comandas UI and real multi-device interaction: PENDING (frontend tasks not implemented yet).


## Automated checkpoints after Task 12

- Reservation backend edit only before operationalStartAt: PASS.
- Reservation expectedRevision optimistic concurrency: PASS.
- Edit table/date/time/client/items/notes/adjustments: PASS.
- Repricing uses current active product catalog: PASS.
- Conflict/product/policy races roll back without partial edits: PASS.
- Pending automatic print job keeps identity/copies and updates document/availableAt: PASS.
- Discarded automatic job is not revived: PASS.
- Missing automatic job is not backfilled: PASS.
- Manual-print-history flag reaches the reservation edit workflow: PASS.
- Frontend reservation detail ignores stale/retired reads: PASS.
- Frontend reservation commands enforce existing capabilities/writesBlocked: PASS.
- Frontend 409 handling refreshes official reservation state once: PASS.
- Table Service reservation public boundary passes architecture contract: PASS.
- 90-day max date helper uses Sao Paulo business calendar: PASS.
- Entrega/Retirada multiday scheduling in current New Order wizard: PASS.
- Local Agora/Reservar schedule state: PASS.
- Local future reservation can select an occupied-now table without joining its open comanda: PASS.
- Existing-comanda Add order flow does not expose Reservar: PASS.
- Local reservation payload omits expectedTableTabId: PASS.
- Review exposes full reservation/scheduled date and time: PASS.
- Desktop/mobile staging visual verification remains PENDING; Task 14 owns the final Comandas reservation UI.
- Kitchen TV auth test fixture was stabilized after its hard-coded session timestamp crossed the real seven-day auth lifetime; no production TV code changed.


## Automated checkpoints after Task 13

- Explicit create/edit-reservation draft mode: PASS.
- Official reservation snapshot → shared New Order wizard initialization: PASS.
- Reservation edit uses PUT boundary, never POST /api/orders: PASS.
- Reservation order id/number preserved by official backend response: PASS.
- Cancel/discard edit does not invoke reservation cancellation: PASS by draft/navigation ownership.
- Existing dirty-navigation guard remains active for edit mode: PASS.
- Stale edit revision refreshes official reservation context and keeps editor open: PASS.
- Policy-change edit retains existing review/feedback flow: PASS.
- Manual print history is available before edit save: PASS.
- Manual-print warning requires explicit “Salvar mesmo assim” before mutation: PASS.
- Edit mode does not expose immediate payment: PASS.
- Shared wizard remains the single creation/edit composition: PASS.
- Create-order idempotency/effect reconciliation regressions: PASS.
- Final Task 13 code Validate #2628 / run `36614217317`: SUCCESS with all 8 test shards, architecture, lint, build, Worker production/staging dry-runs and D1 clean/upgrade gates green.
- Manual staging UX for the edit flow: PENDING until Task 14 provides the reservation-detail entry point.


## Automated checkpoints after Task 14

- Comandas subtitle mentions mesas, comandas e reservas: PASS.
- Free table without reservation remains Livre/current behavior: PASS.
- Free table + nextReservation renders textual Reservada state: PASS.
- Occupied table + nextReservation keeps Ocupada primary and reservation secondary: PASS.
- Current comanda and reservation are distinct interactive targets: PASS.
- Reservation detail loads official API state: PASS.
- Reservation detail exposes mesa/client/date/time/status/items/total: PASS.
- Edit action requires create capability and pre-operational window: PASS.
- Confirm arrival blocked before scheduled business day: PASS.
- Confirm arrival uses authoritative conversion and App selects returned comanda: PASS.
- Cancel/no-show require orders.cancel: PASS.
- Cancel/no-show use configured reason/revision inputs: PASS.
- No independent “Abrir comanda” bypass exists: PASS.
- Mobile reservation list/detail/back scroll and focus restoration: PASS.
- Reserved state is text + semantic info tokens, not color-only: PASS.
- Existing Comanda payment/transfer/printing regressions: PASS.
- Theme-safe styling uses existing semantic tokens: PASS.
- Final Task 14 code Validate #2644 / run `36617341007`: SUCCESS with all 8 test shards, architecture, lint, build, Worker production/staging dry-runs and D1 clean/upgrade gates green.
- Manual desktop/mobile/light/dark staging verification: PENDING until staging task.

## Automated checkpoints after Task 15

- Tomorrow/future-day schedule excluded from today's operational `scheduled` queue: PASS.
- Future waiting schedules excluded from current Kitchen counts: PASS.
- Future waiting schedules excluded from current late count: PASS.
- Same-day scheduled order remains in Agendados: PASS.
- Cross-midnight operational window enters Em preparo at `operational_start_at`: PASS.
- Local reservation follows the same operational/future split: PASS.
- Dedicated `Próximos dias` projection orders by `scheduledFor ASC`: PASS.
- `Próximos dias` shows full service date and time: PASS.
- Future order detail reuses the existing official OrderDetail flow: PASS.
- Future cancellation reuses the existing cancellation flow: PASS.
- Active Local reservation exposes Editar reserva through official reservation detail: PASS.
- Entrega/Retirada future schedules do not expose generic editing: PASS.
- Future-list search does not alter current Kitchen counters: PASS.
- Kitchen Display public queue return shape remains unchanged: PASS.
- Existing Comandas reservation-edit composition remains unchanged: PASS.
- Future-list styling uses current semantic/theme tokens without redesign: PASS.
- Final Task 15 Validate #2655 / run `36623885764`: SUCCESS with all 8 test shards, architecture, lint, build, Worker production/staging dry-runs and D1 clean/upgrade gates green.
- Kitchen TV/sound/realtime end-to-end characterization remains Task 16.
- Manual staging verification remains PENDING until the staging task.

## Automated checkpoints after Task 16

- Future operational-date schedule absent from Kitchen TV cards: PASS.
- Distant Local reservation absent from Kitchen TV: PASS.
- Future operational-date schedules excluded from TV counters: PASS.
- Same-day waiting schedule may remain visible as Agendado: PASS / preserved rule.
- Transition at operationalStartAt promotes order to preparing priority: PASS.
- Arrival sound occurs once on the operational transition: PASS.
- Repeated polls do not replay the same arrival sound: PASS.
- Opening TV after transition does not replay historical sound: PASS.
- Local reservation renders as Local when operational: PASS.
- Existing Entrega/Retirada/Mesa TV modality filters preserved: PASS.
- TV exposes no future agenda / Próximos dias surface: PASS.
- TV rendering clock now follows authoritative serverNow snapshots: PASS.
- Local clock advances between polls without reverting to device wall-clock time: PASS.
- Existing paging/overflow/layout characterizations remain green: PASS.
- Final Task 16 Validate #2661 / run `36625864310`: SUCCESS with all 8 test shards, architecture, lint, build, Worker production/staging dry-runs and D1 clean/upgrade gates green.
- Manual physical TV/staging verification remains PENDING until the staging/homologation tasks.

## Automated checkpoints after Task 17

- Active Local reservation with tableReservationId and null tableTabId excluded from pending receivables: PASS.
- Reservation excluded before receivable summary aggregation: PASS.
- Reservation excluded before receivables forecast aggregation: PASS.
- Reservation excluded before client/order grouping: PASS.
- Reservation identity blocks standalone payment even with malformed non-table fields: PASS.
- Converted reservation/table-tab stays outside A Receber: PASS.
- Cancelled reservation excluded: PASS.
- No-show reservation excluded: PASS.
- Legacy table-shaped order without reservation identity preserves previous behavior: PASS.
- Future unpaid Entrega remains upcoming by future orderDate: PASS.
- Future unpaid Retirada remains upcoming by future orderDate: PASS.
- Future paid-at-checkout Entrega does not remain pending: PASS.
- Forecast uses future orderDate when no payment promise overrides it: PASS.
- Existing Finance/Orders dependency boundary remains unchanged: PASS.
- Final Task 17 Validate #2667 / run `36627016287`: SUCCESS with all 8 test shards, architecture, lint, build, Worker production/staging dry-runs and D1 clean/upgrade gates green.
- Manual staging finance verification remains PENDING until the staging/homologation tasks.

## Automated checkpoints after Task 18

- Future scheduled order selected/reported by future order_date rather than early created_at: PASS.
- Early payment remains on actual paid_at financial business date: PASS.
- Sales series uses order_date; received series uses paid_at: PASS.
- Local reservation remains modality Local in operation reporting: PASS.
- Local reservation remains schedule classification scheduled: PASS.
- Reservation operational duration starts at operationalStartAt, not advance-created timestamp: PASS.
- Cancelled/no-show mirror order excluded from operation analytics: PASS.
- Cancelled/no-show mirror order excluded from commercial sales population: PASS.
- Active reservation excluded from Overview/Sales receivable metrics: PASS.
- Active reservation excluded from Detail A receber filter: PASS.
- Reservation detail pending amount is zero: PASS.
- Client pending aggregate excludes reservation orders: PASS.
- Ordinary future unpaid Entrega/Retirada receivable semantics preserved: PASS.
- Type + scheduled reporting filters reconcile on future Local orders: PASS.
- Reporting repository projects authoritative reservation identity without a global reservation collection: PASS.
- Final Task 18 Validate #2677 / run `36629169321`: SUCCESS with all 8 test shards, architecture, lint, build, Worker production/staging dry-runs and D1 clean/upgrade gates green.
- Manual staging reporting reconciliation remains PENDING until staging/homologation.

## Automated checkpoints after Task 19

- App → Table Service only through public entry: PASS.
- Table Service → Orders production import boundary: PASS.
- Reservation HTTP owner remains Table Service infrastructure: PASS.
- Worker index delegates reservation API instead of owning routes inline: PASS.
- No SQL in React production source: PASS.
- No frontend production handling of raw TABLE_RESERVATION_* backend codes: PASS.
- No new reservation capability family: PASS.
- Existing orders.create / orders.discount / orders.cancel capability ownership preserved: PASS.
- No global/bootstrap tableReservations collection: PASS.
- No reservation runtime schema fallback/probing: PASS.
- Migration 0034 remains the exclusive reservation migration: PASS.
- Exact pre-0034 → 0034 migration upgrade test: PASS.
- Clean reservation migration install: PASS.
- Checkout regressions: PASS.
- Table management regressions: PASS.
- Table-tab lifecycle regressions: PASS.
- Cancellation/refund regressions: PASS.
- Printing regressions: PASS.
- Split-payment regressions: PASS.
- NewOrder regressions: PASS.
- Comandas regressions: PASS.
- Kitchen queue regressions: PASS.
- Kitchen TV regressions: PASS.
- Receivables regressions: PASS.
- Reporting regressions: PASS.
- Frontend architecture checker: PASS.
- PR diff conflict markers: 0.
- PR diff added-line trailing whitespace after normalization: 0.
- Final Task 19 Validate #2684 / run `36630884500`: SUCCESS with all 8 test shards, architecture, lint, build, Worker production/staging dry-runs and D1 gates green.
- Staging deployment: NOT EXECUTED.
- Production deployment: NOT EXECUTED.
- Task 19 status: COMPLETE / GREEN.
- Next step: Task 20 — deploy staging and begin manual homologation.


## Homologação manual em staging — 2026-09-29

- Aplicação/PR #83: 2712f64aa70aa891c7d7a6d41a9262f7a5a78c08.
- Deploy staging: [run 36633062484](https://github.com/vzaponi-dotcom/sistema-para-delivery/actions/runs/36633062484) SUCCESS; migrations, deploy, login e deep links verdes.
- Navegador IAB autenticado, viewport mobile 390×844, TV emparelhada e ativa.
- Matriz: **44 PASS / 3 FAIL / 12 BLOCKED-ENVIRONMENT / 4 BLOCKED-BROWSER-LIMITATION / 7 BLOCKED-PHYSICAL**. Cada BLOCKED é uma verificação não concluída; nenhum conta como PASS.

### Casos 1–70

| Caso | Estado | Evidência / limite observado |
|---:|---|---|
| 1 | PASS | Entrega #280 criada para 29/09/2026 21:00; apareceu em Agendados para preparo e foi cancelada. |
| 2 | PASS | Retirada #281 criada para 29/09/2026 22:00; apareceu em Agendados para preparo e foi cancelada. |
| 3 | PASS | Entrega #282 criada para 30/09/2026 20:00; apareceu em Próximos dias e foi cancelada. |
| 4 | PASS | Retirada #275 no 90º dia (28/12/2026, 20:00) foi salva. |
| 5 | PASS | 91º dia (29/12/2026) manteve Continuar desabilitado. |
| 6 | PASS | Em 29/09 após 19:00, agendamento 18:00 manteve Continuar desabilitado; 21:00 habilitou. |
| 7 | PASS | #275 e #279 apareceram em Próximos dias com data e hora. |
| 8 | PASS | #279 ficou fora da cozinha operacional e da TV ativa; contadores não mudaram. |
| 9 | BLOCKED-ENVIRONMENT | Janela de amanhã não ocorreu durante a sessão. |
| 10 | PASS | Reserva #278 em QA82 Mesa Livre, então Livre, criada sem comanda. |
| 11 | PASS | Reserva #276 criada na Mesa 1 ocupada e editada para Mesa 2 ocupada. |
| 12 | PASS | Comandas permaneceu com 7 comandas abertas após #276; nova #50 só na chegada de #278. |
| 13 | PASS | Mesa 1/2 conservaram Ocupada e comandas #46/#45 enquanto reservas existiam. |
| 14 | PASS | #277 às 18:00 e #276 às 21:00 na Mesa 2 coexistiram; Próximos dias ordenou ambas. |
| 15 | FAIL | Sobreposição Mesa 2 30/09 21:30 foi bloqueada, porém aviso foi genérico; corrigir o mesmo rascunho para 23:00/18:00 continuou falhando. Novo rascunho às 18:00 criou #277. |
| 16 | PASS | QA82 Mesa Livre exibiu badge textual Reservada em Comandas. |
| 17 | PASS | Mesa 2 exibiu Ocupada/Comanda 45 e reserva secundária, sem trocar o alvo da comanda. |
| 18 | PASS | #276: Mousse substituído por Pudim no wizard de edição. |
| 19 | PASS | #276: quantidade alterada de 1 para 2; total R$9→R$16. |
| 20 | PASS | #276: cliente Victor selecionado. |
| 21 | PASS | #276: Mesa 1→Mesa 2, com número do pedido preservado. |
| 22 | PASS | #276: 20:00→21:00, detalhe atualizado. |
| 23 | BLOCKED-ENVIRONMENT | Conflito exercitado na criação (#15), não durante edição. |
| 24 | BLOCKED-BROWSER-LIMITATION | Dois contextos isolados com revisão concorrente não estavam disponíveis; IAB compartilha sessão. |
| 25 | BLOCKED-ENVIRONMENT | Edição após operational_start_at não foi observada; a janela ainda não havia chegado. |
| 26 | BLOCKED-PHYSICAL | Estação Cozinha · Windows offline; timing de execução real de Entrega/Retirada hoje não aferido. |
| 27 | BLOCKED-PHYSICAL | #279 gerou job automático 0/2 na fila, mas disponibilidade/execução ao chegar na janela não pôde ser aferida com estação offline. |
| 28 | BLOCKED-PHYSICAL | #276/#278 geraram job automático, mas disponibilidade/execução real na janela não pôde ser aferida. |
| 29 | BLOCKED-PHYSICAL | Impressão manual antecipada não executada sem estação disponível. |
| 30 | BLOCKED-PHYSICAL | Sem histórico de impressão manual física para acionar o aviso de edição. |
| 31 | BLOCKED-PHYSICAL | Fila mostra jobs, mas identidade e documento do auto job após edição não foram aferidos na estação. |
| 32 | PASS | Cancelamento #275/#276/#279 e no-show #277 removeram respectivos jobs pendentes da fila. |
| 33 | BLOCKED-PHYSICAL | Jobs exibiram Vias 0/2, mas emissão física de duas vias não ocorreu. |
| 34 | PASS | Confirmar chegada #278 executado no detalhe mobile da reserva. |
| 35 | PASS | Mesa QA82 Mesa Livre tornou-se Ocupada após chegada e Livre após pagamento. |
| 36 | PASS | Uma comanda #50 foi aberta; contador 7→8 e depois 7. |
| 37 | PASS | Comanda #50 preservou Mousse, observação e R$9. |
| 38 | BLOCKED-ENVIRONMENT | Pedido Finalizado antes da chegada não foi montado. |
| 39 | BLOCKED-BROWSER-LIMITATION | Duplo clique/retry de rede não foi reproduzido por este controle de navegador. |
| 40 | BLOCKED-ENVIRONMENT | Mesa ocupada exatamente no momento da chegada não foi montada. |
| 41 | BLOCKED-ENVIRONMENT | #276 foi movida de mesa, mas cancelada antes da chegada; combinação completa não executada. |
| 42 | PASS | #276 cancelada pelo detalhe de reserva com motivo Erro no lançamento. |
| 43 | PASS | #279 cancelado pelo pedido; #275 também cancelado pela lista futura. |
| 44 | PASS | #277 encerrada como Não compareceu com motivo Cliente desistiu. |
| 45 | PASS | Após no-show #277, próxima reserva da Mesa 2 passou a #276; após cancelamento #276, card sumiu. |
| 46 | PASS | No-show #277/cancelamento #276 não elevaram contagem de comandas. |
| 47 | PASS | #276 não apareceu em A Receber; busca retornou zero pendências. |
| 48 | PASS | #278 foi paga pela comanda #50 (Pix R$9); a mesa foi liberada. |
| 49 | PASS | #275 apareceu em A Receber → Próximos, previsto 28/12/2026, R$8. |
| 50 | BLOCKED-ENVIRONMENT | Pedido futuro pago antecipadamente não foi cadastrado. |
| 51 | FAIL | Relatórios filtrados 30/09 Local/Agendado reconciliaram #276+#277 em R$25, mas coluna Data no detalhe mostrou 29/09, data de criação, sem identificar a data de serviço. |
| 52 | BLOCKED-ENVIRONMENT | Métrica de duração após entrada operacional não pôde ser observada antes da janela. |
| 53 | BLOCKED-ENVIRONMENT | Reserva em desktop escuro não foi revisada visualmente nesta sessão. |
| 54 | BLOCKED-ENVIRONMENT | Reserva em desktop claro não foi revisada visualmente nesta sessão. |
| 55 | FAIL | Viewport 390×844: lista e bottom nav funcionaram, mas card Reservada mostrou apenas 20:00, sem a data 29/09/2026 exigida para reservas futuras. |
| 56 | PASS | Viewport 390×844: detalhe mostrou data/hora, status, item, observação, total e ações. |
| 57 | PASS | Wizard de edição #276 alterou mesa/cliente/horário/itens antes da janela. |
| 58 | PASS | No mobile, CTA Confirmar chegada converteu #278 e abriu comanda #50. |
| 59 | BLOCKED-BROWSER-LIMITATION | F5/reload do detalhe em rota interna não foi executado pelo controle IAB desta sessão. |
| 60 | PASS | Workflow Deploy staging verificou deep links; /cozinha-tv e /comandas abriram diretamente em abas IAB. |
| 61 | BLOCKED-BROWSER-LIMITATION | Chrome/Edge isolados indisponíveis; somente abas IAB com cookies compartilhados. |
| 62 | PASS | Navegação por teclado/Return operou formulários, detalhe, confirmações e menus sem bloqueio observado. |
| 63 | BLOCKED-ENVIRONMENT | Alvos de toque não foram medidos sistematicamente em dispositivo físico. |
| 64 | BLOCKED-ENVIRONMENT | Sem medição/screenshot completo de overflow horizontal em todas as telas mobile. |
| 65 | PASS | Enquanto #282 estava em Próximos dias, a TV desktop mostrou todos os cartões atuais; #282 ausente e contadores estáveis 12/0. |
| 66 | PASS | Às 19:10, #278 Local saiu de Agendados e entrou em Em preparo na TV; contadores TV 12/1→13/0 e Cozinha 18/1→19/0. |
| 67 | PASS | TV mostrou cartões Local (#267/#268) e modalidade textual Local. |
| 68 | PASS | TV manteve Agendados 1 antes/depois da criação de #279 futuro. |
| 69 | PASS | TV mostrou cartões atrasados primeiro, com tempo e indicação ATRASADO; #279 não entrou na prioridade. |
| 70 | PASS | Em viewport desktop 1280×720, a TV mostrou todos os 13 cartões em layout best-fit sem overflow visível, incluindo #278 Local agendado. |

### Achados que impedem fechamento da QA

1. **Conflito e recuperação do rascunho (caso 15, FAIL).** Com #276 na Mesa 2 em 30/09 às 21:00, nova reserva às 21:30 foi rejeitada com o aviso genérico “Não foi possível salvar a venda. Seus dados continuam aqui para tentar novamente.”, sem orientar outra mesa/horário. Corrigir o mesmo rascunho para 23:00 e 18:00 continuou falhando; um rascunho novo às 18:00 criou #277. Reproduzir e investigar o 409/estado do rascunho; a causa não foi identificada.
2. **Card Comandas mobile sem data (caso 55, FAIL).** Em 390×844, QA82 Mesa Livre mostrava “Reservada · Reserva 20:00 · 1 item” sem a data; detalhe #278 mostrou 29/09/2026 20:00. Mesa 2 com reserva de 30/09 também mostrou somente hora no card. Issue #82 exige data e horário no card.
3. **Data ambígua em Relatórios (caso 51, FAIL).** Filtro 30/09/2026, Local, Agendado listou #276 e #277 somando R$25, porém coluna “Data” nas linhas mostrou 29/09 (cadastro), sem data de serviço 30/09. Verificar contrato pretendido e corrigir apresentação/rotulagem mantendo filtro por order_date.

### Evidência operacional e limpeza

- #275: Retirada no 90º dia; cancelada com motivo oficial.
- #276: reserva em mesa ocupada, editada e cancelada; Mesa 2/Comanda 45 inalteradas.
- #277: reserva não conflitante, encerrada como Não compareceu; sem comanda.
- #278: reserva Local de hoje; chegada abriu uma comanda #50, paga por Pix R$9; mesa temporária voltou a Livre e foi desativada. Às 19:10, #278 entrou em Em preparo na Cozinha/TV. Foi finalizado pelo fluxo oficial; seu único job automático passou a Requer atenção pela estação offline e foi descartado, deixando a fila em zero.
- #279: Retirada futura usada na Cozinha/TV e cancelada; job pendente removido.
- #280/#281: Entrega e Retirada do mesmo dia, salvas e canceladas após exibição em Agendados para preparo.
- #282: Entrega de amanhã, salva e cancelada após exibição em Próximos dias e ausência na TV completa.
- Estação Cozinha · Windows offline; emissão física e duas vias sem validação. Jobs exibiram 0/2 vias.
- Sem alteração de código de aplicação, merge ou produção nesta homologação.

### Gate de release

**QA manual não aprovada.** Corrigir FAILs, revalidar o novo SHA de aplicação e concluir os BLOCKED relevantes antes de merge/produção. PR permanece draft; produção bloqueada.

### Fechamento do commit documental

- Primeiro commit documental af082b9ab6be6f79bbd7dd17875e2500b72b8482: [Validate #2690](https://github.com/vzaponi-dotcom/sistema-para-delivery/actions/runs/36637418878) SUCCESS e [Deploy staging](https://github.com/vzaponi-dotcom/sistema-para-delivery/actions/runs/36637414228) SUCCESS no mesmo SHA. O job de deploy confirmou migrations, login e deep links verdes.
- Evidência temporal posterior: #278 cruzou operational_start_at às 19:10, entrou na Cozinha/TV como Local, foi finalizado e a fila de impressão de teste foi limpa.

### Complemento do bloco A e TV

- Entrega #280 (hoje 21:00), Retirada #281 (hoje 22:00), Entrega #282 (amanhã 20:00) foram salvas pelo Novo Pedido, observadas em suas respectivas filas e canceladas pelo fluxo oficial com motivo Erro no lançamento. A fila de impressão voltou a zero.
- Horário 18:00 já passado manteve Continuar desabilitado; 21:00 habilitou.
- Enquanto #282 existia, a TV desktop exibia todos os cartões operacionais, sem #282; Em preparo 12 / Agendados 0 permaneceu. Este dado fecha o caso 65.
